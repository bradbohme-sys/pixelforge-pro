/**
 * V6 Preview System Types
 * Ring BFS expansion with breathing tolerance
 */

import type { Point, LayerBounds } from '../types';

// ============================================
// PIXEL STATES (3-state tracking)
// ============================================

export const PIXEL_UNSEEN = 0;
export const PIXEL_ACCEPTED = 1;
export const PIXEL_REJECTED = 2;

export type PixelState = typeof PIXEL_UNSEEN | typeof PIXEL_ACCEPTED | typeof PIXEL_REJECTED;

// ============================================
// PREVIEW RESULT
// ============================================

export interface PreviewResult {
  /** Preview mask (partial or complete) */
  mask: Uint8ClampedArray;
  /** Preview bounds */
  bounds: LayerBounds;
  /** Is preview complete? */
  complete: boolean;
  /** Current ring number */
  ringNumber: number;
  /** Seed point used */
  seedPoint: Point;
  /** Tolerance used */
  tolerance: number;
  /** Pixel count */
  pixelCount: number;
}

// ============================================
// RING BFS STATE
// ============================================

export interface RingBFSState {
  /** Current queue (pixels to process this ring) */
  queue: number[];
  /** Next ring queue */
  nextRing: number[];
  /** Visited array (0=unseen, 1=accepted, 2=rejected) */
  visited: Uint8Array;
  /** Mask array (0 or 255) */
  mask: Uint8ClampedArray;
  /** Rejected frontier for breathing tolerance */
  rejectedFrontier: number[];
  /** Current ring number */
  ringNumber: number;
  /** Bounds tracking */
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  /** Pixel count */
  pixelCount: number;
  /** Seed color */
  seedR: number;
  seedG: number;
  seedB: number;
}

// ============================================
// EXPANSION MODE
// ============================================

export type ExpansionMode = 'instant' | 'fast' | 'normal' | 'slow';

export const EXPANSION_SPEEDS: Record<ExpansionMode, { ringsPerFrame: number; timeBudget: number }> = {
  instant: { ringsPerFrame: Infinity, timeBudget: 50 },  // Complete in one frame
  fast: { ringsPerFrame: 50, timeBudget: 8 },            // 50 rings per frame
  normal: { ringsPerFrame: 10, timeBudget: 6 },          // 10 rings per frame (wave effect)
  slow: { ringsPerFrame: 3, timeBudget: 4 },             // 3 rings per frame (dramatic reveal)
};
