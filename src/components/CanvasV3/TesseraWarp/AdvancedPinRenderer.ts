/**
 * Advanced Pin Renderer
 * 
 * Draws cage connections, bone chains with joint markers, depth indicators,
 * and all advanced pin types with rich visual feedback.
 */

import type { Vec2 } from './types';
import { v2 } from './types';
import type {
  AdvancedPin,
  CagePin,
  ControlPin,
  BonePin,
  PinConnection,
  AdvancedWarpState,
  Vec3,
} from './AdvancedPinTypes';
import { evaluateBezier, getBezierConnectionPoints, evaluateFalloff, perspectiveProject } from './AdvancedPinTypes';

// ============================================
// MAIN DRAW FUNCTION
// ============================================

export function drawAdvancedWarpOverlay(
  ctx: CanvasRenderingContext2D,
  state: AdvancedWarpState
): void {
  const transform = ctx.getTransform();
  const scale = Math.sqrt(transform.a * transform.a + transform.b * transform.b);
  const invScale = 1 / scale;

  // Draw connections first (behind pins)
  if (state.showConnections) {
    drawConnections(ctx, state, invScale);
  }

  // Draw influence radii
  if (state.showInfluence) {
    for (const pin of state.pins) {
      if (!pin.visible) continue;
      drawInfluenceRadius(ctx, pin, state.selectedPinIds, invScale);
    }
  }

  // Draw bone chains
  const drawnBones = new Set<string>();
  for (const pin of state.pins) {
    if (pin.kind === 'bone' && !drawnBones.has(pin.id)) {
      drawBoneChain(ctx, pin, state, drawnBones, invScale);
    }
  }

  // Draw pins
  for (const pin of state.pins) {
    if (!pin.visible) continue;
    const isSelected = state.selectedPinIds.includes(pin.id);
    const isDragging = pin.id === state.draggingPinId;
    drawPin(ctx, pin, isSelected, isDragging, invScale);
  }

  // Draw depth indicators for control pins with non-zero depth
  if (state.depthSettings.enabled) {
    for (const pin of state.pins) {
      if (pin.kind === 'control' && pin.target.z !== 0) {
        drawDepthIndicator(ctx, pin, invScale);
      }
    }
  }
}

// ============================================
// CONNECTIONS
// ============================================

function drawConnections(
  ctx: CanvasRenderingContext2D,
  state: AdvancedWarpState,
  invScale: number
): void {
  for (const conn of state.connections) {
    if (!conn.visible) continue;

    const fromPin = state.pins.find(p => p.id === conn.fromId);
    const toPin = state.pins.find(p => p.id === conn.toId);
    if (!fromPin || !toPin) continue;

    const fromPos = getPinPos2D(fromPin);
    const toPos = getPinPos2D(toPin);

    ctx.save();

    if (conn.type === 'bezier') {
      // Draw bezier curve
      const points = getBezierConnectionPoints(fromPos, toPos, conn.bezierHandles, 30);
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y);
      }
      ctx.strokeStyle = conn.color;
      ctx.lineWidth = conn.lineWidth * invScale;
      ctx.stroke();
    } else if (conn.type === 'elastic') {
      // Draw elastic (spring-like wavy line)
      drawSpringLine(ctx, fromPos, toPos, conn, invScale);
    } else {
      // Rigid: solid line
      ctx.beginPath();
      ctx.moveTo(fromPos.x, fromPos.y);
      ctx.lineTo(toPos.x, toPos.y);
      ctx.strokeStyle = conn.color;
      ctx.lineWidth = conn.lineWidth * invScale;
      ctx.stroke();
    }

    // Draw strength indicator at midpoint
    const mid = v2.lerp(fromPos, toPos, 0.5);
    const strengthSize = 3 * invScale;
    ctx.beginPath();
    ctx.arc(mid.x, mid.y, strengthSize, 0, Math.PI * 2);
    ctx.fillStyle = conn.color;
    ctx.globalAlpha = conn.strength;
    ctx.fill();
    ctx.globalAlpha = 1;

    ctx.restore();
  }
}

function drawSpringLine(
  ctx: CanvasRenderingContext2D,
  from: Vec2,
  to: Vec2,
  conn: PinConnection,
  invScale: number
): void {
  const dir = v2.sub(to, from);
  const len = v2.len(dir);
  if (len < 1) return;

  const norm = v2.normalize(dir);
  const perp = { x: -norm.y, y: norm.x };
  const amplitude = 4 * invScale * conn.strength;
  const segments = Math.max(10, Math.floor(len / (3 * invScale)));

  ctx.beginPath();
  ctx.moveTo(from.x, from.y);

  for (let i = 1; i <= segments; i++) {
    const t = i / segments;
    const baseX = from.x + dir.x * t;
    const baseY = from.y + dir.y * t;
    const wave = Math.sin(t * Math.PI * 6) * amplitude * (1 - Math.abs(2 * t - 1));
    ctx.lineTo(baseX + perp.x * wave, baseY + perp.y * wave);
  }

  ctx.strokeStyle = conn.color;
  ctx.lineWidth = conn.lineWidth * invScale;
  ctx.stroke();
}

// ============================================
// INFLUENCE RADIUS
// ============================================

function drawInfluenceRadius(
  ctx: CanvasRenderingContext2D,
  pin: AdvancedPin,
  selectedIds: string[],
  invScale: number
): void {
  const isSelected = selectedIds.includes(pin.id);
  const pos = getPinPos2D(pin);
  const color = pin.color;

  ctx.beginPath();
  ctx.arc(pos.x, pos.y, pin.radius, 0, Math.PI * 2);

  // Fill with gradient
  const grad = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, pin.radius);
  const baseAlpha = isSelected ? 0.12 : 0.04;
  grad.addColorStop(0, hexToRGBA(color, baseAlpha));
  grad.addColorStop(1, hexToRGBA(color, 0));
  ctx.fillStyle = grad;
  ctx.fill();

  // Stroke
  ctx.strokeStyle = hexToRGBA(color, isSelected ? 0.5 : 0.2);
  ctx.lineWidth = 1 * invScale;
  ctx.setLineDash([4 * invScale, 4 * invScale]);
  ctx.stroke();
  ctx.setLineDash([]);
}

// ============================================
// PIN DRAWING
// ============================================

function drawPin(
  ctx: CanvasRenderingContext2D,
  pin: AdvancedPin,
  isSelected: boolean,
  isDragging: boolean,
  invScale: number
): void {
  switch (pin.kind) {
    case 'cage':
      drawCagePin(ctx, pin, isSelected, isDragging, invScale);
      break;
    case 'control':
      drawControlPin(ctx, pin, isSelected, isDragging, invScale);
      break;
    case 'bone':
      // Bones are drawn as part of chain, but draw joint marker
      drawBoneJoint(ctx, pin, isSelected, isDragging, invScale);
      break;
  }
}

function drawCagePin(
  ctx: CanvasRenderingContext2D,
  pin: CagePin,
  isSelected: boolean,
  isDragging: boolean,
  invScale: number
): void {
  const { pos, target } = pin;
  const hasMoved = v2.dist(pos, target) > 0.5;

  // Draw movement line
  if (hasMoved) {
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    ctx.lineTo(target.x, target.y);
    ctx.strokeStyle = hexToRGBA(pin.color, 0.5);
    ctx.lineWidth = 1.5 * invScale;
    ctx.setLineDash([3 * invScale, 3 * invScale]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Rest position ghost
    drawGhostMarker(ctx, pos, invScale);
  }

  // Main pin: square shape for cage pins
  const size = (isDragging ? 10 : isSelected ? 8 : 6) * invScale;
  ctx.save();
  ctx.translate(target.x, target.y);
  ctx.rotate(Math.PI / 4); // Diamond shape

  ctx.beginPath();
  ctx.rect(-size / 2, -size / 2, size, size);
  ctx.fillStyle = pin.color;
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2 * invScale;
  ctx.stroke();

  ctx.restore();

  // Lock indicator
  if (pin.lockArea) {
    ctx.beginPath();
    ctx.arc(target.x, target.y, 2.5 * invScale, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
  }
}

function drawControlPin(
  ctx: CanvasRenderingContext2D,
  pin: ControlPin,
  isSelected: boolean,
  isDragging: boolean,
  invScale: number
): void {
  const pos2D = { x: pin.pos.x, y: pin.pos.y };
  const target2D = { x: pin.target.x, y: pin.target.y };
  const hasMoved = v2.dist(pos2D, target2D) > 0.5 || pin.target.z !== 0;

  // Draw movement line
  if (hasMoved) {
    ctx.beginPath();
    ctx.moveTo(pos2D.x, pos2D.y);
    ctx.lineTo(target2D.x, target2D.y);
    ctx.strokeStyle = hexToRGBA(pin.color, 0.6);
    ctx.lineWidth = 2 * invScale;
    ctx.stroke();

    drawGhostMarker(ctx, pos2D, invScale);
  }

  // Main pin: circle for control pins
  const pinRadius = (isDragging ? 12 : isSelected ? 10 : 8) * invScale;
  ctx.beginPath();
  ctx.arc(target2D.x, target2D.y, pinRadius, 0, Math.PI * 2);
  ctx.fillStyle = pin.color;
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2.5 * invScale;
  ctx.stroke();

  // Inner highlight
  ctx.beginPath();
  ctx.arc(target2D.x - 2 * invScale, target2D.y - 2 * invScale, 3 * invScale, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.fill();

  // Rotation indicator
  if (pin.angle !== 0) {
    const len = 22 * invScale;
    ctx.beginPath();
    ctx.moveTo(target2D.x, target2D.y);
    ctx.lineTo(
      target2D.x + Math.cos(pin.angle) * len,
      target2D.y + Math.sin(pin.angle) * len
    );
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.5 * invScale;
    ctx.lineCap = 'round';
    ctx.stroke();

    // Arrow head
    const arrowSize = 6 * invScale;
    const ax = target2D.x + Math.cos(pin.angle) * len;
    const ay = target2D.y + Math.sin(pin.angle) * len;
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(ax - Math.cos(pin.angle - 0.4) * arrowSize, ay - Math.sin(pin.angle - 0.4) * arrowSize);
    ctx.moveTo(ax, ay);
    ctx.lineTo(ax - Math.cos(pin.angle + 0.4) * arrowSize, ay - Math.sin(pin.angle + 0.4) * arrowSize);
    ctx.stroke();
    ctx.lineCap = 'butt';
  }

  // Scale ring
  if (pin.scale !== 1) {
    ctx.beginPath();
    ctx.arc(target2D.x, target2D.y, pinRadius + 4 * invScale, 0, Math.PI * 2 * Math.min(pin.scale / 2, 1));
    ctx.strokeStyle = hexToRGBA(pin.color, 0.6);
    ctx.lineWidth = 2 * invScale;
    ctx.stroke();
  }
}

// ============================================
// BONE CHAIN
// ============================================

function drawBoneChain(
  ctx: CanvasRenderingContext2D,
  startBone: BonePin,
  state: AdvancedWarpState,
  drawnBones: Set<string>,
  invScale: number
): void {
  let current: BonePin | undefined = startBone;

  while (current) {
    if (drawnBones.has(current.id)) break;
    drawnBones.add(current.id);

    // Draw bone body
    const endPos = {
      x: current.target.x + Math.cos(current.angle) * current.length,
      y: current.target.y + Math.sin(current.angle) * current.length,
    };

    // Bone shape: tapered trapezoid
    const halfWidth = 5 * invScale;
    const tipWidth = 2 * invScale;
    const perpX = -Math.sin(current.angle);
    const perpY = Math.cos(current.angle);

    ctx.beginPath();
    ctx.moveTo(current.target.x + perpX * halfWidth, current.target.y + perpY * halfWidth);
    ctx.lineTo(endPos.x + perpX * tipWidth, endPos.y + perpY * tipWidth);
    ctx.lineTo(endPos.x - perpX * tipWidth, endPos.y - perpY * tipWidth);
    ctx.lineTo(current.target.x - perpX * halfWidth, current.target.y - perpY * halfWidth);
    ctx.closePath();

    const isSelected = state.selectedPinIds.includes(current.id);
    ctx.fillStyle = hexToRGBA(current.color, isSelected ? 0.5 : 0.3);
    ctx.fill();
    ctx.strokeStyle = current.color;
    ctx.lineWidth = 1.5 * invScale;
    ctx.stroke();

    // Find child bone
    if (current.childId) {
      current = state.pins.find(p => p.id === current!.childId) as BonePin | undefined;
    } else {
      // Draw end joint
      ctx.beginPath();
      ctx.arc(endPos.x, endPos.y, 3 * invScale, 0, Math.PI * 2);
      ctx.fillStyle = current.color;
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5 * invScale;
      ctx.stroke();
      break;
    }
  }
}

function drawBoneJoint(
  ctx: CanvasRenderingContext2D,
  pin: BonePin,
  isSelected: boolean,
  isDragging: boolean,
  invScale: number
): void {
  const jointRadius = (isDragging ? 8 : isSelected ? 7 : 5) * invScale;

  // Joint circle
  ctx.beginPath();
  ctx.arc(pin.target.x, pin.target.y, jointRadius, 0, Math.PI * 2);
  ctx.fillStyle = pin.color;
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2 * invScale;
  ctx.stroke();

  // IK indicator
  if (pin.ikEnabled) {
    ctx.beginPath();
    ctx.arc(pin.target.x, pin.target.y, jointRadius + 3 * invScale, 0, Math.PI * 2);
    ctx.strokeStyle = hexToRGBA(pin.color, 0.4);
    ctx.lineWidth = 1 * invScale;
    ctx.setLineDash([2 * invScale, 2 * invScale]);
    ctx.stroke();
    ctx.setLineDash([]);
  }
}

// ============================================
// DEPTH INDICATOR
// ============================================

function drawDepthIndicator(
  ctx: CanvasRenderingContext2D,
  pin: ControlPin,
  invScale: number
): void {
  const target2D = { x: pin.target.x, y: pin.target.y };
  const depth = pin.target.z;
  const isForward = depth > 0;

  // Draw depth arrow
  const arrowLen = Math.abs(depth) * 0.3 * invScale;
  const maxLen = 30 * invScale;
  const len = Math.min(arrowLen, maxLen);

  // Vertical line indicating depth
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(target2D.x, target2D.y);
  ctx.lineTo(target2D.x, target2D.y - (isForward ? -len : len));
  ctx.strokeStyle = isForward ? '#22c55e' : '#ef4444';
  ctx.lineWidth = 2.5 * invScale;
  ctx.lineCap = 'round';
  ctx.stroke();

  // Depth value label
  ctx.font = `${10 * invScale}px monospace`;
  ctx.fillStyle = isForward ? '#22c55e' : '#ef4444';
  ctx.textAlign = 'center';
  ctx.fillText(
    `${isForward ? '+' : ''}${depth.toFixed(0)}z`,
    target2D.x,
    target2D.y - (isForward ? -len - 12 * invScale : len + 6 * invScale)
  );

  // Concentric rings for depth effect
  const rings = Math.min(3, Math.ceil(Math.abs(depth) / 30));
  for (let i = 0; i < rings; i++) {
    const ringRadius = (14 + i * 6) * invScale;
    ctx.beginPath();
    ctx.arc(target2D.x, target2D.y, ringRadius, 0, Math.PI * 2);
    ctx.strokeStyle = hexToRGBA(isForward ? '#22c55e' : '#ef4444', 0.2 - i * 0.05);
    ctx.lineWidth = 1 * invScale;
    ctx.stroke();
  }

  ctx.restore();
}

// ============================================
// HELPER DRAWING
// ============================================

function drawGhostMarker(ctx: CanvasRenderingContext2D, pos: Vec2, invScale: number): void {
  ctx.beginPath();
  ctx.arc(pos.x, pos.y, 4 * invScale, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(150, 150, 150, 0.3)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.lineWidth = 1 * invScale;
  ctx.stroke();
}

function getPinPos2D(pin: AdvancedPin): Vec2 {
  if (pin.kind === 'control') {
    return { x: pin.target.x, y: pin.target.y };
  }
  return pin.target;
}

function hexToRGBA(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
