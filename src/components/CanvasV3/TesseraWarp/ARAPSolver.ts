/**
 * Tessera Warp - ARAP Solver
 * 
 * As-Rigid-As-Possible deformation solver using local/global iteration.
 * Local step: compute per-node rotations
 * Global step: solve for positions using Conjugate Gradient
 */

import type {
  ControlGraph,
  ControlNode,
  Vec2,
  Mat2,
  CSR,
  ARAPSolverOptions,
} from './types';
import { v2, m2, rotationFromS, DEFAULT_SOLVER_OPTIONS } from './types';
import { buildSystemMatrix } from './ControlGraph';
import { cgSolve } from './ConjugateGradient';

export interface ARAPSolverState {
  /** System matrix (L + P) */
  A: CSR | null;
  /** Solution vectors for x and y coordinates */
  solX: Float32Array | null;
  solY: Float32Array | null;
  /** RHS vectors */
  rhsX: Float32Array | null;
  rhsY: Float32Array | null;
  /** Iteration count from last solve */
  lastIterations: number;
}

/**
 * Create solver state
 */
export function createSolverState(): ARAPSolverState {
  return {
    A: null,
    solX: null,
    solY: null,
    rhsX: null,
    rhsY: null,
    lastIterations: 0,
  };
}

/**
 * Initialize solver for a control graph
 */
export function initializeSolver(
  solverState: ARAPSolverState,
  graph: ControlGraph
): void {
  const n = graph.nodes.length;
  
  // Build system matrix
  solverState.A = buildSystemMatrix(graph);
  
  // Allocate solution and RHS vectors
  solverState.solX = new Float32Array(n);
  solverState.solY = new Float32Array(n);
  solverState.rhsX = new Float32Array(n);
  solverState.rhsY = new Float32Array(n);
  
  // Initialize solution from current node positions
  for (let i = 0; i < n; i++) {
    solverState.solX[i] = graph.nodes[i].x.x;
    solverState.solY[i] = graph.nodes[i].x.y;
  }
}

/**
 * Run one complete ARAP iteration (local + global)
 */
export function arapIteration(
  graph: ControlGraph,
  solverState: ARAPSolverState,
  options: Partial<ARAPSolverOptions> = {}
): void {
  const opts = { ...DEFAULT_SOLVER_OPTIONS, ...options };
  const { nodes } = graph;
  const n = nodes.length;
  
  if (!solverState.A || !solverState.solX || !solverState.solY) {
    throw new Error('Solver not initialized');
  }

  // ============================================
  // LOCAL STEP: Compute per-node rotations
  // ============================================
  
  for (let i = 0; i < n; i++) {
    const ni = nodes[i];
    
    // Build covariance matrix S_i = Σ_j w_ij (x_i - x_j)(p_i - p_j)^T
    let S: Mat2 = { a: 0, b: 0, c: 0, d: 0 };
    
    for (const edge of ni.edges) {
      const nj = nodes[edge.j];
      
      // Current edge (deformed)
      const xij: Vec2 = {
        x: ni.x.x - nj.x.x,
        y: ni.x.y - nj.x.y,
      };
      
      // Rest edge (from precomputed p_ij)
      const pij = edge.p_ij;
      
      // Weighted outer product: w * xij * pij^T
      const w = edge.w * ni.stiffMul;
      S.a += w * xij.x * pij.x;
      S.b += w * xij.x * pij.y;
      S.c += w * xij.y * pij.x;
      S.d += w * xij.y * pij.y;
    }
    
    // Extract rotation via polar decomposition
    ni.R = rotationFromS(S);
  }

  // ============================================
  // GLOBAL STEP: Build RHS and solve
  // ============================================
  
  const { rhsX, rhsY, solX, solY, A } = solverState;
  
  // Build RHS: b_i = Σ_j w_ij (R_i + R_j)/2 (p_i - p_j) + w_i^pin * t_i
  for (let i = 0; i < n; i++) {
    const ni = nodes[i];
    let bx = 0;
    let by = 0;
    
    // Edge terms
    for (const edge of ni.edges) {
      const nj = nodes[edge.j];
      
      // Average rotation: (R_i + R_j) / 2
      const Ravg: Mat2 = {
        a: (ni.R.a + nj.R.a) * 0.5,
        b: (ni.R.b + nj.R.b) * 0.5,
        c: (ni.R.c + nj.R.c) * 0.5,
        d: (ni.R.d + nj.R.d) * 0.5,
      };
      
      // Rotated rest edge
      const rotated = m2.mulVec(Ravg, edge.p_ij);
      
      const w = edge.w * ni.stiffMul;
      bx += w * rotated.x;
      by += w * rotated.y;
    }
    
    // Pin term
    if (ni.pinW > 0) {
      bx += ni.pinB.x;
      by += ni.pinB.y;
    }
    
    rhsX![i] = bx;
    rhsY![i] = by;
  }
  
  // Solve Ax = b for x and y separately
  const itersX = cgSolve(A, rhsX!, solX, opts.cgIterations, opts.cgTolerance);
  const itersY = cgSolve(A, rhsY!, solY, opts.cgIterations, opts.cgTolerance);
  
  solverState.lastIterations = Math.max(itersX, itersY);
  
  // Update node positions from solution
  for (let i = 0; i < n; i++) {
    nodes[i].x.x = solX[i];
    nodes[i].x.y = solY[i];
  }
}

/**
 * Run multiple ARAP iterations
 */
export function solve(
  graph: ControlGraph,
  solverState: ARAPSolverState,
  options: Partial<ARAPSolverOptions> = {}
): number {
  const opts = { ...DEFAULT_SOLVER_OPTIONS, ...options };
  
  for (let iter = 0; iter < opts.iterations; iter++) {
    arapIteration(graph, solverState, opts);
  }
  
  return solverState.lastIterations;
}

/**
 * Update system matrix after pins change
 */
export function updateSystemMatrix(
  solverState: ARAPSolverState,
  graph: ControlGraph
): void {
  solverState.A = buildSystemMatrix(graph);
}
