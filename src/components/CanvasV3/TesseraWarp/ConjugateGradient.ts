/**
 * Tessera Warp - Conjugate Gradient Solver
 * 
 * Iterative solver for the SPD system Ax = b.
 * Supports warm-starting for interactive performance.
 */

import type { CSR } from './types';
import { csrMulVec } from './CSR';

/**
 * Conjugate Gradient solver with warm-starting
 * 
 * @param A - SPD matrix in CSR format
 * @param b - Right-hand side vector
 * @param x - Solution vector (warm-started, modified in place)
 * @param maxIters - Maximum iterations
 * @param tol - Convergence tolerance (relative)
 * @returns Number of iterations performed
 */
export function cgSolve(
  A: CSR,
  b: Float32Array,
  x: Float32Array,
  maxIters: number = 40,
  tol: number = 1e-4
): number {
  const n = A.n;
  
  // Allocate work vectors
  const r = new Float32Array(n);
  const p = new Float32Array(n);
  const Ap = new Float32Array(n);

  // r = b - A*x
  csrMulVec(A, x, Ap);
  
  let rr = 0;
  for (let i = 0; i < n; i++) {
    r[i] = b[i] - Ap[i];
    p[i] = r[i];
    rr += r[i] * r[i];
  }
  
  const rr0 = rr;
  if (rr0 < 1e-20) {
    return 0; // Already converged
  }
  
  const tolSq = tol * tol * rr0;

  for (let k = 0; k < maxIters; k++) {
    // Ap = A * p
    csrMulVec(A, p, Ap);
    
    // pAp = p^T * A * p
    let pAp = 0;
    for (let i = 0; i < n; i++) {
      pAp += p[i] * Ap[i];
    }
    
    if (Math.abs(pAp) < 1e-20) {
      return k + 1;
    }
    
    const alpha = rr / pAp;
    
    // x = x + alpha * p
    // r = r - alpha * Ap
    let rrNew = 0;
    for (let i = 0; i < n; i++) {
      x[i] += alpha * p[i];
      r[i] -= alpha * Ap[i];
      rrNew += r[i] * r[i];
    }
    
    // Check convergence
    if (rrNew <= tolSq) {
      return k + 1;
    }
    
    const beta = rrNew / rr;
    
    // p = r + beta * p
    for (let i = 0; i < n; i++) {
      p[i] = r[i] + beta * p[i];
    }
    
    rr = rrNew;
  }
  
  return maxIters;
}

/**
 * Preconditioned Conjugate Gradient with Jacobi preconditioner
 * 
 * Uses diagonal preconditioning for better convergence.
 */
export function cgSolvePreconditioned(
  A: CSR,
  b: Float32Array,
  x: Float32Array,
  diag: Float32Array,
  maxIters: number = 40,
  tol: number = 1e-4
): number {
  const n = A.n;
  
  // Precompute inverse diagonal (Jacobi preconditioner)
  const invDiag = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    invDiag[i] = diag[i] !== 0 ? 1 / diag[i] : 1;
  }
  
  // Allocate work vectors
  const r = new Float32Array(n);
  const z = new Float32Array(n);
  const p = new Float32Array(n);
  const Ap = new Float32Array(n);

  // r = b - A*x
  csrMulVec(A, x, Ap);
  
  for (let i = 0; i < n; i++) {
    r[i] = b[i] - Ap[i];
    z[i] = invDiag[i] * r[i];  // z = M^-1 * r
    p[i] = z[i];
  }
  
  // rz = r^T * z
  let rz = 0;
  for (let i = 0; i < n; i++) {
    rz += r[i] * z[i];
  }
  
  const rz0 = rz;
  if (Math.abs(rz0) < 1e-20) {
    return 0;
  }
  
  const tolSq = tol * tol * Math.abs(rz0);

  for (let k = 0; k < maxIters; k++) {
    // Ap = A * p
    csrMulVec(A, p, Ap);
    
    // pAp = p^T * A * p
    let pAp = 0;
    for (let i = 0; i < n; i++) {
      pAp += p[i] * Ap[i];
    }
    
    if (Math.abs(pAp) < 1e-20) {
      return k + 1;
    }
    
    const alpha = rz / pAp;
    
    // x = x + alpha * p
    // r = r - alpha * Ap
    for (let i = 0; i < n; i++) {
      x[i] += alpha * p[i];
      r[i] -= alpha * Ap[i];
      z[i] = invDiag[i] * r[i];  // z = M^-1 * r
    }
    
    // rzNew = r^T * z
    let rzNew = 0;
    for (let i = 0; i < n; i++) {
      rzNew += r[i] * z[i];
    }
    
    // Check convergence
    if (Math.abs(rzNew) <= tolSq) {
      return k + 1;
    }
    
    const beta = rzNew / rz;
    
    // p = z + beta * p
    for (let i = 0; i < n; i++) {
      p[i] = z[i] + beta * p[i];
    }
    
    rz = rzNew;
  }
  
  return maxIters;
}
