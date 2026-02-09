/**
 * Tessera Warp - Material-Aware Image Deformation System
 * 
 * A two-layer architecture (Control Graph + Render Mesh) with content-respecting
 * propagation, three types of pins (Anchor, Pose, Rail), and ARAP solver.
 * 
 * Core Components:
 * - Math primitives (Vec2, Mat2, polar decomposition)
 * - Pin types (Anchor, Pose, Rail)
 * - Control Graph (sparse deformation grid)
 * - ARAP Solver (As-Rigid-As-Possible deformation)
 * - Render Mesh (dense triangle mesh for rendering)
 * - Seam Barriers (content-respecting propagation)
 * - Material Presets (Rigid, Rubber, Cloth, Gel, Anisotropic)
 */

// Types and math primitives
export * from './types';

// CSR sparse matrix
export { createCSR, buildCSRFromCOO, csrMulVec, csrGetDiagonal } from './CSR';
export type { COOEntry } from './CSR';

// Conjugate Gradient solver
export { cgSolve, cgSolvePreconditioned } from './ConjugateGradient';

// Control Graph
export {
  createControlGraph,
  applySeamBarriers,
  applyPins,
  resetPinInfluences,
  buildSystemMatrix,
  resetNodePositions,
  deformPoint,
} from './ControlGraph';
export type { ControlGraphOptions } from './ControlGraph';

// ARAP Solver
export {
  createSolverState,
  initializeSolver,
  arapIteration,
  solve,
  updateSystemMatrix,
} from './ARAPSolver';
export type { ARAPSolverState } from './ARAPSolver';

// Render Mesh
export {
  generateRenderMesh,
  computeSkinWeights,
  deformMesh,
  getTriangles,
} from './RenderMesh';
export type { RenderMeshOptions } from './RenderMesh';

// Basic React hook (simple pin system)
export { useTesseraWarp } from './useTesseraWarp';
export type { UseTesseraWarpReturn } from './useTesseraWarp';

// Advanced Pin System (cage pins, control pins, bones, connections, 3D depth)
export * from './AdvancedPinTypes';
export { useAdvancedWarp } from './useAdvancedWarp';
export type { UseAdvancedWarpReturn } from './useAdvancedWarp';

// Advanced Pin Renderer
export { drawAdvancedWarpOverlay } from './AdvancedPinRenderer';

// Keyframe Animation
export * from './KeyframeAnimation';

// WebGL Renderer
export { WebGLWarpRenderer } from './WebGLRenderer';
export type { TransformMatrix, WebGLRendererOptions, DepthShaderSettings } from './WebGLRenderer';
