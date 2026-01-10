/**
 * Tessera Warp - Control Graph Module
 * 
 * Sparse control mesh for efficient ARAP deformation.
 * Nodes are distributed over the image, edges define coupling.
 */

import type {
  Vec2,
  Mat2,
  ControlGraph,
  ControlNode,
  GraphEdge,
  WarpPin,
  WarpAnchorPin,
  WarpPosePin,
  WarpRailPin,
  SeamBarrierOptions,
  CSR,
} from './types';
import { v2, m2 } from './types';
import { buildCSRFromCOO, type COOEntry } from './CSR';

export interface ControlGraphOptions {
  /** Target number of control nodes */
  nodeCount: number;
  /** Maximum distance for edge connections (relative to spacing) */
  maxEdgeDistanceRatio: number;
  /** Small jitter to avoid perfect grid artifacts */
  jitterRatio: number;
}

export const DEFAULT_CONTROL_GRAPH_OPTIONS: ControlGraphOptions = {
  nodeCount: 100,
  maxEdgeDistanceRatio: 1.5,
  jitterRatio: 0.1,
};

/**
 * Create a control graph for the given image dimensions
 */
export function createControlGraph(
  width: number,
  height: number,
  options: Partial<ControlGraphOptions> = {}
): ControlGraph {
  const opts = { ...DEFAULT_CONTROL_GRAPH_OPTIONS, ...options };
  
  // Generate nodes in a quasi-uniform grid
  const nodes = generateNodes(width, height, opts.nodeCount, opts.jitterRatio);
  
  // Compute spacing for edge connections
  const spacing = Math.sqrt((width * height) / opts.nodeCount);
  const maxEdgeDistance = spacing * opts.maxEdgeDistanceRatio;
  
  // Build edges
  buildEdges(nodes, maxEdgeDistance);
  
  return {
    nodes,
    width,
    height,
  };
}

/**
 * Generate control nodes in a quasi-uniform grid
 */
function generateNodes(
  width: number,
  height: number,
  targetCount: number,
  jitterRatio: number
): ControlNode[] {
  const nodes: ControlNode[] = [];
  
  // Compute grid dimensions
  const spacing = Math.sqrt((width * height) / targetCount);
  const cols = Math.max(2, Math.ceil(width / spacing));
  const rows = Math.max(2, Math.ceil(height / spacing));
  const actualSpacingX = width / (cols - 1);
  const actualSpacingY = height / (rows - 1);
  
  const jitter = spacing * jitterRatio;
  
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      // Add small jitter except at boundaries
      let jitterX = 0;
      let jitterY = 0;
      
      if (col > 0 && col < cols - 1) {
        jitterX = (Math.random() - 0.5) * jitter;
      }
      if (row > 0 && row < rows - 1) {
        jitterY = (Math.random() - 0.5) * jitter;
      }
      
      const x = Math.max(0, Math.min(width - 1, col * actualSpacingX + jitterX));
      const y = Math.max(0, Math.min(height - 1, row * actualSpacingY + jitterY));
      
      nodes.push({
        p: { x, y },
        x: { x, y }, // Initialize deformed = rest
        R: m2.identity(),
        edges: [],
        pinW: 0,
        pinB: v2.zero(),
        stiffMul: 1.0,
      });
    }
  }
  
  return nodes;
}

/**
 * Build edges between nearby nodes
 */
function buildEdges(nodes: ControlNode[], maxDistance: number): void {
  const n = nodes.length;
  
  for (let i = 0; i < n; i++) {
    const nodeI = nodes[i];
    const edges: GraphEdge[] = [];
    
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      
      const nodeJ = nodes[j];
      const dx = nodeJ.p.x - nodeI.p.x;
      const dy = nodeJ.p.y - nodeI.p.y;
      const distance = Math.hypot(dx, dy);
      
      if (distance <= maxDistance) {
        // Weight decreases with distance (inverse distance weighting)
        const weight = 1 / (distance + 1);
        
        edges.push({
          j,
          w: weight,
          p_ij: { x: nodeI.p.x - nodeJ.p.x, y: nodeI.p.y - nodeJ.p.y },
        });
      }
    }
    
    nodeI.edges = edges;
  }
}

/**
 * Apply seam barrier weights to edges
 */
export function applySeamBarriers(
  graph: ControlGraph,
  options: SeamBarrierOptions
): void {
  if (!options.enabled || !options.boundaryField) return;
  
  const { boundaryField, width, height, barrierStrength } = options;
  
  for (const node of graph.nodes) {
    for (const edge of node.edges) {
      const neighbor = graph.nodes[edge.j];
      
      // Sample boundary field along the edge
      const barrier = computeSeamBarrier(
        node.p,
        neighbor.p,
        boundaryField,
        width,
        height,
        barrierStrength
      );
      
      // Reduce edge weight based on barrier
      edge.w *= barrier;
    }
  }
}

/**
 * Compute seam barrier factor for an edge
 */
function computeSeamBarrier(
  a: Vec2,
  b: Vec2,
  boundaryField: Uint8Array,
  width: number,
  height: number,
  kappa: number
): number {
  // Sample ~8 points along the segment
  const steps = 8;
  let sum = 0;
  
  for (let s = 0; s <= steps; s++) {
    const t = s / steps;
    const x = Math.max(0, Math.min(width - 1, Math.round(a.x + (b.x - a.x) * t)));
    const y = Math.max(0, Math.min(height - 1, Math.round(a.y + (b.y - a.y) * t)));
    const idx = y * width + x;
    const strength = boundaryField[idx] / 255; // Normalize to [0,1]
    sum += strength;
  }
  
  const avgBoundary = sum / (steps + 1);
  
  // Barrier factor: exp(-kappa * boundary_strength)
  return Math.exp(-kappa * avgBoundary);
}

/**
 * Reset pin influences on all nodes
 */
export function resetPinInfluences(graph: ControlGraph): void {
  for (const node of graph.nodes) {
    node.pinW = 0;
    node.pinB = v2.zero();
  }
}

/**
 * Apply pins to the control graph
 */
export function applyPins(graph: ControlGraph, pins: WarpPin[]): void {
  resetPinInfluences(graph);
  
  for (const pin of pins) {
    if (pin.kind === 'anchor') {
      applyAnchorPin(graph, pin);
    } else if (pin.kind === 'pose') {
      applyPosePin(graph, pin);
    } else if (pin.kind === 'rail') {
      applyRailPin(graph, pin);
    }
  }
}

/**
 * Apply anchor pin to graph nodes
 */
function applyAnchorPin(graph: ControlGraph, pin: WarpAnchorPin): void {
  for (const node of graph.nodes) {
    const dist = v2.dist(node.p, pin.pos);
    
    if (dist <= pin.radius) {
      // Weight decreases with distance (smooth falloff)
      const t = dist / pin.radius;
      const falloff = 1 - t * t * (3 - 2 * t); // Smoothstep
      const weight = pin.stiffness * falloff;
      
      node.pinW += weight;
      node.pinB = v2.add(node.pinB, v2.mul(pin.target, weight));
    }
  }
}

/**
 * Apply pose pin to graph nodes
 */
function applyPosePin(graph: ControlGraph, pin: WarpPosePin): void {
  const rotation = m2.rotation(pin.angle);
  const scale = pin.scale ?? 1;
  
  for (const node of graph.nodes) {
    const dist = v2.dist(node.p, pin.pos);
    
    if (dist <= pin.radius) {
      const t = dist / pin.radius;
      const falloff = 1 - t * t * (3 - 2 * t);
      const weight = pin.stiffness * falloff;
      
      // Transform local position by rotation and scale
      const local = v2.sub(node.p, pin.pos);
      const scaled = v2.mul(local, scale);
      const rotated = m2.mulVec(rotation, scaled);
      const target = v2.add(pin.target, rotated);
      
      node.pinW += weight;
      node.pinB = v2.add(node.pinB, v2.mul(target, weight));
    }
  }
}

/**
 * Apply rail pin to graph nodes
 */
function applyRailPin(graph: ControlGraph, pin: WarpRailPin): void {
  if (pin.poly.length < 2) return;
  
  for (const node of graph.nodes) {
    // Find closest point on polyline
    let minDist = Infinity;
    let closestPoint: Vec2 | null = null;
    
    for (let i = 0; i < pin.poly.length - 1; i++) {
      const p0 = pin.poly[i];
      const p1 = pin.poly[i + 1];
      
      // Project node onto line segment
      const seg = v2.sub(p1, p0);
      const segLen = v2.len(seg);
      if (segLen < 1e-6) continue;
      
      const toNode = v2.sub(node.p, p0);
      const t = Math.max(0, Math.min(1, v2.dot(toNode, seg) / (segLen * segLen)));
      const proj = v2.add(p0, v2.mul(seg, t));
      const dist = v2.dist(node.p, proj);
      
      if (dist < minDist) {
        minDist = dist;
        closestPoint = proj;
      }
    }
    
    if (closestPoint && minDist <= pin.radius) {
      const t = minDist / pin.radius;
      const falloff = 1 - t * t * (3 - 2 * t);
      const weight = pin.stiffness * falloff;
      
      node.pinW += weight;
      node.pinB = v2.add(node.pinB, v2.mul(closestPoint, weight));
    }
  }
}

/**
 * Build the system matrix (L + P) in CSR format
 */
export function buildSystemMatrix(graph: ControlGraph): CSR {
  const n = graph.nodes.length;
  const entries: COOEntry[] = [];
  
  for (let i = 0; i < n; i++) {
    const node = graph.nodes[i];
    let diagonal = 0;
    
    // Graph edges: Laplacian entries
    for (const edge of node.edges) {
      const w = edge.w * node.stiffMul;
      entries.push({ i, j: edge.j, value: -w });
      diagonal += w;
    }
    
    // Add pin stiffness to diagonal
    diagonal += node.pinW;
    entries.push({ i, j: i, value: diagonal });
  }
  
  return buildCSRFromCOO(n, entries);
}

/**
 * Initialize node positions to rest positions
 */
export function resetNodePositions(graph: ControlGraph): void {
  for (const node of graph.nodes) {
    node.x = v2.copy(node.p);
    node.R = m2.identity();
  }
}

/**
 * Get deformed position for a point using inverse distance weighting
 */
export function deformPoint(graph: ControlGraph, point: Vec2, k: number = 4): Vec2 {
  const { nodes } = graph;
  
  // Find k nearest nodes
  const distances = nodes.map((node, idx) => ({
    idx,
    dist: v2.dist(point, node.p),
  }));
  
  distances.sort((a, b) => a.dist - b.dist);
  
  let totalWeight = 0;
  let result = v2.zero();
  
  for (let i = 0; i < Math.min(k, distances.length); i++) {
    const node = nodes[distances[i].idx];
    const dist = distances[i].dist;
    
    // Inverse distance weighting
    const weight = dist > 0 ? 1 / (dist * dist + 1e-6) : 1e6;
    
    // Local rigid map: R_i(y - p_i) + x_i
    const rel = v2.sub(point, node.p);
    const rotated = m2.mulVec(node.R, rel);
    const transformed = v2.add(rotated, node.x);
    
    result = v2.add(result, v2.mul(transformed, weight));
    totalWeight += weight;
  }
  
  if (totalWeight > 0) {
    return v2.div(result, totalWeight);
  }
  
  return point;
}
