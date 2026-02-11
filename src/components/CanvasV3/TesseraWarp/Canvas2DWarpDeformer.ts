/**
 * Canvas2D Warp Deformer
 * 
 * Deforms an image using a grid mesh displaced by advanced warp pins.
 * Uses Canvas 2D triangle rendering for real-time deformation.
 */

import type { Vec2 } from './types';
import { v2 } from './types';
import type { AdvancedPin, CagePin, ControlPin, BonePin } from './AdvancedPinTypes';
import { evaluateFalloff } from './AdvancedPinTypes';

// Grid resolution for the deformation mesh
const DEFAULT_GRID_COLS = 30;
const DEFAULT_GRID_ROWS = 30;

interface MeshVertex {
  /** Rest position (UV mapped to image) */
  restX: number;
  restY: number;
  /** Deformed position */
  defX: number;
  defY: number;
}

/**
 * Compute the displacement for a single point based on all pins
 */
function computeDisplacement(
  px: number,
  py: number,
  pins: AdvancedPin[]
): { dx: number; dy: number } {
  let dx = 0;
  let dy = 0;
  let totalWeight = 0;

  for (const pin of pins) {
    const pinPos = pin.pos;
    let pinTarget: Vec2;
    let radius: number;
    let strength: number;

    switch (pin.kind) {
      case 'cage': {
        const cp = pin as CagePin;
        pinTarget = cp.target;
        radius = cp.radius;
        strength = cp.stiffness;
        break;
      }
      case 'control': {
        const cp = pin as ControlPin;
        pinTarget = { x: cp.target.x, y: cp.target.y };
        radius = cp.radius;
        strength = cp.strength;
        break;
      }
      case 'bone': {
        const bp = pin as BonePin;
        pinTarget = bp.target;
        radius = bp.radius;
        strength = bp.stiffness;
        break;
      }
      default:
        continue;
    }

    // Displacement of pin from rest to target
    const pinDx = pinTarget.x - pinPos.x;
    const pinDy = pinTarget.y - pinPos.y;

    // Skip pins with no displacement
    if (Math.abs(pinDx) < 0.01 && Math.abs(pinDy) < 0.01) continue;

    // Distance from this point to pin rest position
    const distX = px - pinPos.x;
    const distY = py - pinPos.y;
    const dist = Math.sqrt(distX * distX + distY * distY);

    if (dist > radius) continue;

    // Normalized distance (0 at pin, 1 at radius edge)
    const t = dist / radius;

    // Evaluate falloff
    let falloffValue: number;
    if (pin.kind === 'control') {
      falloffValue = evaluateFalloff((pin as ControlPin).falloff, t);
    } else {
      // Linear falloff for cage/bone
      falloffValue = 1 - t;
    }

    const weight = falloffValue * strength;
    dx += pinDx * weight;
    dy += pinDy * weight;
    totalWeight += weight;
  }

  // Normalize if multiple pins overlap to prevent over-displacement
  if (totalWeight > 1) {
    dx /= totalWeight;
    dy /= totalWeight;
  }

  return { dx, dy };
}

/**
 * Build a deformation mesh grid
 */
function buildMeshGrid(
  imgWidth: number,
  imgHeight: number,
  imgX: number,
  imgY: number,
  cols: number,
  rows: number,
  pins: AdvancedPin[]
): MeshVertex[] {
  const vertices: MeshVertex[] = [];

  for (let r = 0; r <= rows; r++) {
    for (let c = 0; c <= cols; c++) {
      const u = c / cols;
      const v = r / rows;
      const restX = imgX + u * imgWidth;
      const restY = imgY + v * imgHeight;

      const { dx, dy } = computeDisplacement(restX, restY, pins);

      vertices.push({
        restX,
        restY,
        defX: restX + dx,
        defY: restY + dy,
      });
    }
  }

  return vertices;
}

/**
 * Draw the deformed image using triangle mesh on Canvas 2D
 */
export function drawDeformedImage(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  image: CanvasImageSource,
  imgX: number,
  imgY: number,
  imgWidth: number,
  imgHeight: number,
  pins: AdvancedPin[],
  opacity: number = 1,
  gridCols: number = DEFAULT_GRID_COLS,
  gridRows: number = DEFAULT_GRID_ROWS
): void {
  // Check if any pin has displacement
  const hasDisplacement = pins.some(pin => {
    const target = pin.kind === 'control'
      ? { x: (pin as ControlPin).target.x, y: (pin as ControlPin).target.y }
      : (pin as CagePin | BonePin).target;
    const dx = target.x - pin.pos.x;
    const dy = target.y - pin.pos.y;
    return Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5;
  });

  if (!hasDisplacement) {
    // No deformation needed, draw normally
    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.drawImage(image, imgX, imgY, imgWidth, imgHeight);
    ctx.restore();
    return;
  }

  const vertices = buildMeshGrid(imgWidth, imgHeight, imgX, imgY, gridCols, gridRows, pins);
  const colsP1 = gridCols + 1;

  const imgEl = image as any;
  const srcW = imgEl.naturalWidth || imgEl.width || imgWidth;
  const srcH = imgEl.naturalHeight || imgEl.height || imgHeight;

  ctx.save();
  ctx.globalAlpha = opacity;

  // Draw each quad as two triangles
  for (let r = 0; r < gridRows; r++) {
    for (let c = 0; c < gridCols; c++) {
      const i0 = r * colsP1 + c;
      const i1 = r * colsP1 + c + 1;
      const i2 = (r + 1) * colsP1 + c;
      const i3 = (r + 1) * colsP1 + c + 1;

      const v0 = vertices[i0];
      const v1 = vertices[i1];
      const v2 = vertices[i2];
      const v3 = vertices[i3];

      // Source UVs in image pixel space
      const su0 = ((v0.restX - imgX) / imgWidth) * srcW;
      const sv0 = ((v0.restY - imgY) / imgHeight) * srcH;
      const su1 = ((v1.restX - imgX) / imgWidth) * srcW;
      const sv1 = ((v1.restY - imgY) / imgHeight) * srcH;
      const su2 = ((v2.restX - imgX) / imgWidth) * srcW;
      const sv2 = ((v2.restY - imgY) / imgHeight) * srcH;
      const su3 = ((v3.restX - imgX) / imgWidth) * srcW;
      const sv3 = ((v3.restY - imgY) / imgHeight) * srcH;

      // Triangle 1: v0, v1, v2
      drawTexturedTriangle(
        ctx, image,
        v0.defX, v0.defY, su0, sv0,
        v1.defX, v1.defY, su1, sv1,
        v2.defX, v2.defY, su2, sv2
      );

      // Triangle 2: v1, v3, v2
      drawTexturedTriangle(
        ctx, image,
        v1.defX, v1.defY, su1, sv1,
        v3.defX, v3.defY, su3, sv3,
        v2.defX, v2.defY, su2, sv2
      );
    }
  }

  ctx.restore();
}

/**
 * Draw a textured triangle using affine transform approximation.
 * Maps source image triangle to destination triangle using canvas 2D transforms.
 */
function drawTexturedTriangle(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  image: CanvasImageSource,
  // Destination triangle vertices
  dx0: number, dy0: number, sx0: number, sy0: number,
  dx1: number, dy1: number, sx1: number, sy1: number,
  dx2: number, dy2: number, sx2: number, sy2: number
): void {
  ctx.save();

  // Clip to destination triangle
  ctx.beginPath();
  ctx.moveTo(dx0, dy0);
  ctx.lineTo(dx1, dy1);
  ctx.lineTo(dx2, dy2);
  ctx.closePath();
  ctx.clip();

  // Compute affine transform from source triangle to destination triangle
  // We solve: [dx] = [a c e] [sx]
  //           [dy]   [b d f] [sy]
  //                          [1 ]
  
  // Source vectors
  const sAx = sx1 - sx0;
  const sAy = sy1 - sy0;
  const sBx = sx2 - sx0;
  const sBy = sy2 - sy0;

  // Destination vectors
  const dAx = dx1 - dx0;
  const dAy = dy1 - dy0;
  const dBx = dx2 - dx0;
  const dBy = dy2 - dy0;

  // Inverse of source matrix
  const det = sAx * sBy - sBx * sAy;
  if (Math.abs(det) < 1e-10) {
    ctx.restore();
    return;
  }
  const invDet = 1 / det;

  // Transform matrix components
  const a = (dAx * sBy - dBx * sAy) * invDet;
  const b = (dAy * sBy - dBy * sAy) * invDet;
  const c = (dBx * sAx - dAx * sBx) * invDet;
  const d = (dBy * sAx - dAy * sBx) * invDet;
  const e = dx0 - a * sx0 - c * sy0;
  const f = dy0 - b * sx0 - d * sy0;

  ctx.setTransform(a, b, c, d, e, f);
  
  // Draw the full image (clipping will show only the triangle)
  ctx.drawImage(image, 0, 0);

  ctx.restore();
}
