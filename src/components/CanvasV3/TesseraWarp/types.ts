/**
 * Tessera Warp - Type Definitions
 * 
 * Core types for the material-aware image deformation system.
 * Includes math primitives, pin types, mesh structures, and solver interfaces.
 */

// ============================================
// MATH PRIMITIVES
// ============================================

export interface Vec2 {
  x: number;
  y: number;
}

export interface Mat2 {
  a: number; // m00
  b: number; // m01
  c: number; // m10
  d: number; // m11
}

// ============================================
// VECTOR OPERATIONS
// ============================================

export const v2 = {
  create(x: number = 0, y: number = 0): Vec2 {
    return { x, y };
  },

  add(a: Vec2, b: Vec2): Vec2 {
    return { x: a.x + b.x, y: a.y + b.y };
  },

  sub(a: Vec2, b: Vec2): Vec2 {
    return { x: a.x - b.x, y: a.y - b.y };
  },

  mul(v: Vec2, s: number): Vec2 {
    return { x: v.x * s, y: v.y * s };
  },

  div(v: Vec2, s: number): Vec2 {
    const inv = 1 / (s || 1e-10);
    return { x: v.x * inv, y: v.y * inv };
  },

  dot(a: Vec2, b: Vec2): number {
    return a.x * b.x + a.y * b.y;
  },

  cross(a: Vec2, b: Vec2): number {
    return a.x * b.y - a.y * b.x;
  },

  len(v: Vec2): number {
    return Math.hypot(v.x, v.y);
  },

  lenSq(v: Vec2): number {
    return v.x * v.x + v.y * v.y;
  },

  normalize(v: Vec2): Vec2 {
    const len = Math.hypot(v.x, v.y) || 1;
    return { x: v.x / len, y: v.y / len };
  },

  rotate(v: Vec2, angle: number): Vec2 {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    return {
      x: v.x * c - v.y * s,
      y: v.x * s + v.y * c,
    };
  },

  lerp(a: Vec2, b: Vec2, t: number): Vec2 {
    return {
      x: a.x + (b.x - a.x) * t,
      y: a.y + (b.y - a.y) * t,
    };
  },

  dist(a: Vec2, b: Vec2): number {
    return Math.hypot(b.x - a.x, b.y - a.y);
  },

  distSq(a: Vec2, b: Vec2): number {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    return dx * dx + dy * dy;
  },

  copy(v: Vec2): Vec2 {
    return { x: v.x, y: v.y };
  },

  zero(): Vec2 {
    return { x: 0, y: 0 };
  },

  negate(v: Vec2): Vec2 {
    return { x: -v.x, y: -v.y };
  },

  perpCCW(v: Vec2): Vec2 {
    return { x: -v.y, y: v.x };
  },

  perpCW(v: Vec2): Vec2 {
    return { x: v.y, y: -v.x };
  },
};

// ============================================
// MATRIX OPERATIONS
// ============================================

export const m2 = {
  identity(): Mat2 {
    return { a: 1, b: 0, c: 0, d: 1 };
  },

  rotation(angle: number): Mat2 {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    return { a: c, b: -s, c: s, d: c };
  },

  scale(sx: number, sy: number = sx): Mat2 {
    return { a: sx, b: 0, c: 0, d: sy };
  },

  mul(A: Mat2, B: Mat2): Mat2 {
    return {
      a: A.a * B.a + A.b * B.c,
      b: A.a * B.b + A.b * B.d,
      c: A.c * B.a + A.d * B.c,
      d: A.c * B.b + A.d * B.d,
    };
  },

  mulVec(M: Mat2, v: Vec2): Vec2 {
    return {
      x: M.a * v.x + M.b * v.y,
      y: M.c * v.x + M.d * v.y,
    };
  },

  add(A: Mat2, B: Mat2): Mat2 {
    return {
      a: A.a + B.a,
      b: A.b + B.b,
      c: A.c + B.c,
      d: A.d + B.d,
    };
  },

  scaleBy(M: Mat2, s: number): Mat2 {
    return {
      a: M.a * s,
      b: M.b * s,
      c: M.c * s,
      d: M.d * s,
    };
  },

  transpose(M: Mat2): Mat2 {
    return { a: M.a, b: M.c, c: M.b, d: M.d };
  },

  det(M: Mat2): number {
    return M.a * M.d - M.b * M.c;
  },

  inv(M: Mat2): Mat2 {
    const d = M.a * M.d - M.b * M.c;
    if (Math.abs(d) < 1e-10) {
      return m2.identity();
    }
    const invD = 1 / d;
    return {
      a: M.d * invD,
      b: -M.b * invD,
      c: -M.c * invD,
      d: M.a * invD,
    };
  },

  copy(M: Mat2): Mat2 {
    return { a: M.a, b: M.b, c: M.c, d: M.d };
  },
};

// ============================================
// POLAR DECOMPOSITION
// ============================================

/**
 * Polar decomposition: M = R * S
 * Returns rotation R (closest rotation to M)
 * 
 * This is used in the ARAP solver local step to extract
 * the best-fit rotation from the covariance matrix.
 */
export function polarDecomposition(M: Mat2): Mat2 {
  const a = M.a;
  const b = M.b;
  const c = M.c;
  const d = M.d;

  // Compute M^T * M
  const MTM_a = a * a + c * c;
  const MTM_b = a * b + c * d;
  const MTM_d = b * b + d * d;

  // Eigenvalues of M^T * M
  const trace = MTM_a + MTM_d;
  const det = MTM_a * MTM_d - MTM_b * MTM_b;
  const disc = Math.sqrt(Math.max(0, trace * trace - 4 * det));
  const lambda1 = Math.max(1e-12, (trace + disc) / 2);
  const lambda2 = Math.max(1e-12, (trace - disc) / 2);

  // Compute eigenvectors
  let v1: Vec2;
  if (Math.abs(MTM_b) > 1e-9) {
    v1 = v2.normalize({ x: MTM_b, y: lambda1 - MTM_a });
  } else if (MTM_a > MTM_d) {
    v1 = { x: 1, y: 0 };
  } else {
    v1 = { x: 0, y: 1 };
  }
  const v2e: Vec2 = { x: -v1.y, y: v1.x };

  // sqrt(eigenvalues)^-1
  const i1 = 1 / Math.sqrt(lambda1);
  const i2 = 1 / Math.sqrt(lambda2);

  // V * D^(-1/2) * V^T
  const V: Mat2 = { a: v1.x, b: v2e.x, c: v1.y, d: v2e.y };
  const VT = m2.transpose(V);
  const D: Mat2 = { a: i1, b: 0, c: 0, d: i2 };

  const invSqrt = m2.mul(m2.mul(V, D), VT);
  const R = m2.mul(M, invSqrt);

  // Ensure det(R) = +1 (avoid reflection)
  if (m2.det(R) < 0) {
    const Df: Mat2 = { a: i1, b: 0, c: 0, d: -i2 };
    const invSqrtF = m2.mul(m2.mul(V, Df), VT);
    return m2.mul(M, invSqrtF);
  }

  return R;
}

/**
 * Extract rotation from covariance matrix S
 * Alias for polarDecomposition
 */
export function rotationFromS(S: Mat2): Mat2 {
  return polarDecomposition(S);
}

// ============================================
// PIN TYPES
// ============================================

/**
 * Anchor Pin: Hard positional constraint
 * "Do not move this point."
 */
export interface WarpAnchorPin {
  id: string;
  kind: 'anchor';
  pos: Vec2;          // Rest position (in image coordinates)
  target: Vec2;       // Target position (where user dragged)
  stiffness: number;  // 0 = soft spring, 1 = hard constraint
  radius: number;     // Influence radius (pixels)
}

/**
 * Pose Pin: Position + rotation + optional scale
 * "I'm grabbing this part and turning/scaling it."
 */
export interface WarpPosePin {
  id: string;
  kind: 'pose';
  pos: Vec2;          // Rest position
  target: Vec2;       // Target position
  angle: number;      // Rotation angle (radians)
  stiffness: number;
  radius: number;
  scale?: number;     // Optional scale factor
}

/**
 * Rail Pin: Constrain a curve to deform smoothly
 * "I want this feature line to remain a feature line."
 */
export interface WarpRailPin {
  id: string;
  kind: 'rail';
  poly: Vec2[];       // Polyline vertices (rest positions)
  stiffness: number;
  radius: number;
  preserveLength?: boolean;  // Preserve arc length
  preserveCurvature?: boolean;  // Preserve curvature
}

export type WarpPin = WarpAnchorPin | WarpPosePin | WarpRailPin;

// ============================================
// CONTROL GRAPH TYPES
// ============================================

/**
 * Graph Edge (for control graph adjacency)
 */
export interface GraphEdge {
  j: number;            // Neighbor node index
  w: number;            // Coupling weight (includes seam/anisotropy)
  p_ij: Vec2;           // Rest edge vector (p_i - p_j) precomputed
}

/**
 * Control Node (sparse deformation grid)
 */
export interface ControlNode {
  p: Vec2;              // Rest position
  x: Vec2;              // Current deformed position (solved each iteration)
  R: Mat2;              // Local rotation from local step
  edges: GraphEdge[];   // Adjacency list
  pinW: number;         // Per-node pin stiffness (sum of influences)
  pinB: Vec2;           // Per-node pin RHS contribution (sum w*target)
  stiffMul: number;     // From tension brush (>=0, default 1)
}

/**
 * Control Graph (sparse solver grid)
 */
export interface ControlGraph {
  nodes: ControlNode[];
  width: number;        // Image width
  height: number;       // Image height
  // CSR matrix will be stored separately in solver
}

// ============================================
// RENDER MESH TYPES
// ============================================

/**
 * Skin Weights (for mesh vertex deformation)
 */
export interface SkinWeights {
  idx: Uint16Array;     // [v*k + t] node indices
  w: Float32Array;      // [v*k + t] weights (sum to 1)
  k: number;            // Number of nodes per vertex (kNN)
}

/**
 * Render Mesh (dense triangle mesh for rendering)
 */
export interface RenderMesh {
  positions: Float32Array;  // [x0,y0,x1,y1,...] rest positions (image coords)
  uvs: Float32Array;        // [u0,v0,...] texture coordinates
  indices: Uint32Array;     // Triangle indices
  deformed: Float32Array;   // Deformed positions (same size as positions)
  skin: SkinWeights;        // Per-vertex kNN weights into control nodes
}

// ============================================
// MATERIAL PRESETS
// ============================================

export interface MaterialPreset {
  name: string;
  description: string;
  rigidityWeight: number;   // ARAP rigidity (higher = more rigid)
  stretchLimit: number;     // Maximum stretch (0 = no limit)
  shearControl: number;     // Shear penalty (higher = less shear)
  bendingWeight: number;    // Smoothness/bending penalty
}

export const MATERIAL_PRESETS: Record<string, MaterialPreset> = {
  rigid: {
    name: 'Rigid Plate',
    description: 'Almost as-rigid-as-possible, bends only in broad arcs',
    rigidityWeight: 1.0,
    stretchLimit: 0.05,
    shearControl: 1.0,
    bendingWeight: 0.5,
  },
  rubber: {
    name: 'Rubber',
    description: 'More stretch allowed, local pulls propagate more',
    rigidityWeight: 0.7,
    stretchLimit: 0.3,
    shearControl: 0.5,
    bendingWeight: 0.3,
  },
  cloth: {
    name: 'Cloth',
    description: 'Shear-friendly, stretch-limited, wrinkles implied',
    rigidityWeight: 0.5,
    stretchLimit: 0.15,
    shearControl: 0.2,
    bendingWeight: 0.2,
  },
  gel: {
    name: 'Gel',
    description: 'Very smooth, blobby, useful for stylized effects',
    rigidityWeight: 0.3,
    stretchLimit: 0.5,
    shearControl: 0.1,
    bendingWeight: 0.1,
  },
  anisotropic: {
    name: 'Anisotropic',
    description: 'Stiffer along detected edges/texture flow',
    rigidityWeight: 0.6,
    stretchLimit: 0.2,
    shearControl: 0.4,
    bendingWeight: 0.25,
  },
};

// ============================================
// CSR SPARSE MATRIX FORMAT
// ============================================

/**
 * Compressed Sparse Row matrix format
 * Used for efficient storage and operations in the ARAP global step.
 */
export interface CSR {
  n: number;              // Number of rows
  rowPtr: Uint32Array;    // Row pointers (length n+1)
  colInd: Uint32Array;    // Column indices (length nnz)
  values: Float32Array;   // Values (length nnz)
}

// ============================================
// SOLVER OPTIONS
// ============================================

export interface ARAPSolverOptions {
  /** Number of ARAP iterations per frame (1-4 for interactive, more for release) */
  iterations: number;
  /** Number of CG iterations per global step */
  cgIterations: number;
  /** CG convergence tolerance */
  cgTolerance: number;
  /** Use warm-starting (keep solution from last frame) */
  warmStart: boolean;
  /** Material preset to use */
  material: string;
}

export const DEFAULT_SOLVER_OPTIONS: ARAPSolverOptions = {
  iterations: 3,
  cgIterations: 40,
  cgTolerance: 1e-4,
  warmStart: true,
  material: 'rubber',
};

// ============================================
// SEAM BARRIER OPTIONS
// ============================================

export interface SeamBarrierOptions {
  /** Boundary field data (Uint8Array, 0-255) */
  boundaryField: Uint8Array | null;
  /** Image width */
  width: number;
  /** Image height */
  height: number;
  /** Barrier strength (kappa, higher = stronger barrier) */
  barrierStrength: number;
  /** Enable content-respecting propagation */
  enabled: boolean;
}

export const DEFAULT_SEAM_BARRIER_OPTIONS: SeamBarrierOptions = {
  boundaryField: null,
  width: 0,
  height: 0,
  barrierStrength: 5.0,
  enabled: false,
};

// ============================================
// WARP SYSTEM STATE
// ============================================

export interface TesseraWarpState {
  /** Control graph for sparse deformation */
  graph: ControlGraph | null;
  /** Render mesh for high-quality rendering */
  mesh: RenderMesh | null;
  /** Active pins */
  pins: WarpPin[];
  /** Currently selected pin ID */
  selectedPinId: string | null;
  /** Pin being dragged */
  draggingPinId: string | null;
  /** Solver options */
  solverOptions: ARAPSolverOptions;
  /** Seam barrier options */
  seamOptions: SeamBarrierOptions;
  /** Is the system initialized? */
  initialized: boolean;
  /** Source image for warping */
  sourceImage: HTMLImageElement | HTMLCanvasElement | null;
}

export const DEFAULT_TESSERA_WARP_STATE: TesseraWarpState = {
  graph: null,
  mesh: null,
  pins: [],
  selectedPinId: null,
  draggingPinId: null,
  solverOptions: DEFAULT_SOLVER_OPTIONS,
  seamOptions: DEFAULT_SEAM_BARRIER_OPTIONS,
  initialized: false,
  sourceImage: null,
};
