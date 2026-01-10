/**
 * Tessera Warp - CSR Sparse Matrix Module
 * 
 * Compressed Sparse Row format for efficient storage and operations.
 * Used for the ARAP global step linear system.
 */

import type { CSR } from './types';

/**
 * Create empty CSR matrix
 */
export function createCSR(n: number, estimatedNNZ: number = 0): CSR {
  return {
    n,
    rowPtr: new Uint32Array(n + 1),
    colInd: new Uint32Array(estimatedNNZ),
    values: new Float32Array(estimatedNNZ),
  };
}

/**
 * COO entry for building CSR
 */
export interface COOEntry {
  i: number;
  j: number;
  value: number;
}

/**
 * Build CSR matrix from COO (Coordinate) format
 */
export function buildCSRFromCOO(n: number, entries: COOEntry[]): CSR {
  if (entries.length === 0) {
    return createCSR(n, 0);
  }

  // Sort by (i, j) and combine duplicates
  entries.sort((a, b) => a.i !== b.i ? a.i - b.i : a.j - b.j);

  // Combine duplicates
  const combined: COOEntry[] = [];
  let prev: COOEntry | null = null;
  
  for (const entry of entries) {
    if (prev && prev.i === entry.i && prev.j === entry.j) {
      prev.value += entry.value;
    } else {
      combined.push({ i: entry.i, j: entry.j, value: entry.value });
      prev = combined[combined.length - 1];
    }
  }

  const nnz = combined.length;
  const csr = createCSR(n, nnz);

  // Build row pointers
  let row = 0;
  for (let k = 0; k < nnz; k++) {
    while (row <= combined[k].i) {
      csr.rowPtr[row] = k;
      row++;
    }
    csr.colInd[k] = combined[k].j;
    csr.values[k] = combined[k].value;
  }
  
  // Fill remaining row pointers
  while (row <= n) {
    csr.rowPtr[row] = nnz;
    row++;
  }

  return csr;
}

/**
 * CSR matrix-vector multiplication: out = A * x
 */
export function csrMulVec(A: CSR, x: Float32Array, out: Float32Array): void {
  const { n, rowPtr, colInd, values } = A;
  
  for (let i = 0; i < n; i++) {
    let sum = 0;
    for (let k = rowPtr[i]; k < rowPtr[i + 1]; k++) {
      sum += values[k] * x[colInd[k]];
    }
    out[i] = sum;
  }
}

/**
 * Get diagonal element of CSR matrix
 */
export function csrGetDiagonal(A: CSR, i: number): number {
  const { rowPtr, colInd, values } = A;
  
  for (let k = rowPtr[i]; k < rowPtr[i + 1]; k++) {
    if (colInd[k] === i) {
      return values[k];
    }
  }
  return 0;
}

/**
 * Extract diagonal as array
 */
export function csrExtractDiagonal(A: CSR): Float32Array {
  const diag = new Float32Array(A.n);
  for (let i = 0; i < A.n; i++) {
    diag[i] = csrGetDiagonal(A, i);
  }
  return diag;
}

/**
 * Update diagonal element (in-place)
 */
export function csrUpdateDiagonal(A: CSR, i: number, value: number): void {
  const { rowPtr, colInd, values } = A;
  
  for (let k = rowPtr[i]; k < rowPtr[i + 1]; k++) {
    if (colInd[k] === i) {
      values[k] = value;
      return;
    }
  }
}

/**
 * Get number of non-zeros
 */
export function csrNNZ(A: CSR): number {
  return A.rowPtr[A.n];
}
