/**
 * Tessera Warp - Render Mesh Module
 * 
 * Dense triangle mesh for high-quality rendering.
 * Vertices are deformed by weighted blend of control node transforms.
 */

import type {
  Vec2,
  ControlGraph,
  RenderMesh,
  SkinWeights,
} from './types';
import { v2, m2 } from './types';

export interface RenderMeshOptions {
  /** Mesh resolution (pixels per triangle edge) */
  resolution: number;
  /** Number of nearest nodes for skinning (kNN) */
  kNN: number;
}

export const DEFAULT_MESH_OPTIONS: RenderMeshOptions = {
  resolution: 10,
  kNN: 4,
};

/**
 * Generate uniform triangle mesh
 */
export function generateRenderMesh(
  width: number,
  height: number,
  options: Partial<RenderMeshOptions> = {}
): RenderMesh {
  const opts = { ...DEFAULT_MESH_OPTIONS, ...options };
  const spacing = opts.resolution;
  
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  
  const cols = Math.ceil(width / spacing) + 1;
  const rows = Math.ceil(height / spacing) + 1;
  
  // Generate vertices
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const x = Math.min(col * spacing, width);
      const y = Math.min(row * spacing, height);
      const u = x / width;
      const v = y / height;
      
      positions.push(x, y);
      uvs.push(u, v);
    }
  }
  
  // Generate triangles
  for (let row = 0; row < rows - 1; row++) {
    for (let col = 0; col < cols - 1; col++) {
      const i0 = row * cols + col;
      const i1 = row * cols + (col + 1);
      const i2 = (row + 1) * cols + col;
      const i3 = (row + 1) * cols + (col + 1);
      
      // Two triangles per quad
      indices.push(i0, i1, i2);
      indices.push(i1, i3, i2);
    }
  }
  
  const vertexCount = positions.length / 2;
  const k = opts.kNN;
  
  const skin: SkinWeights = {
    idx: new Uint16Array(vertexCount * k),
    w: new Float32Array(vertexCount * k),
    k,
  };
  
  return {
    positions: new Float32Array(positions),
    uvs: new Float32Array(uvs),
    indices: new Uint32Array(indices),
    deformed: new Float32Array(positions), // Copy of positions
    skin,
  };
}

/**
 * Compute skin weights from control graph
 */
export function computeSkinWeights(
  mesh: RenderMesh,
  graph: ControlGraph
): void {
  const { positions, skin } = mesh;
  const { nodes } = graph;
  const k = skin.k;
  const vertexCount = positions.length / 2;
  
  for (let vi = 0; vi < vertexCount; vi++) {
    const vx = positions[vi * 2];
    const vy = positions[vi * 2 + 1];
    const vertex: Vec2 = { x: vx, y: vy };
    
    // Find k nearest nodes
    const distances = nodes.map((node, idx) => ({
      idx,
      dist: v2.dist(vertex, node.p),
    }));
    
    distances.sort((a, b) => a.dist - b.dist);
    
    // Compute inverse distance weights
    let totalWeight = 0;
    for (let t = 0; t < Math.min(k, distances.length); t++) {
      const dist = distances[t].dist;
      const weight = dist > 0 ? 1 / (dist * dist + 1e-6) : 1e6;
      skin.idx[vi * k + t] = distances[t].idx;
      skin.w[vi * k + t] = weight;
      totalWeight += weight;
    }
    
    // Normalize weights
    if (totalWeight > 0) {
      for (let t = 0; t < k; t++) {
        skin.w[vi * k + t] /= totalWeight;
      }
    }
  }
}

/**
 * Deform mesh vertices using control graph
 */
export function deformMesh(mesh: RenderMesh, graph: ControlGraph): void {
  const { positions, deformed, skin } = mesh;
  const { nodes } = graph;
  const k = skin.k;
  const vertexCount = positions.length / 2;
  
  for (let vi = 0; vi < vertexCount; vi++) {
    const vx = positions[vi * 2];
    const vy = positions[vi * 2 + 1];
    const restPos: Vec2 = { x: vx, y: vy };
    
    let dx = 0;
    let dy = 0;
    
    // Blend transforms from k nearest nodes
    for (let t = 0; t < k; t++) {
      const nodeIdx = skin.idx[vi * k + t];
      const weight = skin.w[vi * k + t];
      
      if (weight === 0 || nodeIdx >= nodes.length) continue;
      
      const node = nodes[nodeIdx];
      
      // Local rigid map: R_i(y - p_i) + x_i
      const rel = v2.sub(restPos, node.p);
      const rotated = m2.mulVec(node.R, rel);
      const transformed = v2.add(rotated, node.x);
      
      dx += weight * transformed.x;
      dy += weight * transformed.y;
    }
    
    deformed[vi * 2] = dx;
    deformed[vi * 2 + 1] = dy;
  }
}

/**
 * Get triangle vertices for rendering
 */
export function getTriangles(mesh: RenderMesh): Array<{
  v0: Vec2;
  v1: Vec2;
  v2: Vec2;
  uv0: Vec2;
  uv1: Vec2;
  uv2: Vec2;
}> {
  const { deformed, uvs, indices } = mesh;
  const triangles: Array<{
    v0: Vec2;
    v1: Vec2;
    v2: Vec2;
    uv0: Vec2;
    uv1: Vec2;
    uv2: Vec2;
  }> = [];
  
  for (let i = 0; i < indices.length; i += 3) {
    const i0 = indices[i];
    const i1 = indices[i + 1];
    const i2 = indices[i + 2];
    
    triangles.push({
      v0: { x: deformed[i0 * 2], y: deformed[i0 * 2 + 1] },
      v1: { x: deformed[i1 * 2], y: deformed[i1 * 2 + 1] },
      v2: { x: deformed[i2 * 2], y: deformed[i2 * 2 + 1] },
      uv0: { x: uvs[i0 * 2], y: uvs[i0 * 2 + 1] },
      uv1: { x: uvs[i1 * 2], y: uvs[i1 * 2 + 1] },
      uv2: { x: uvs[i2 * 2], y: uvs[i2 * 2 + 1] },
    });
  }
  
  return triangles;
}
