/**
 * PreviewWaveEngine - Ring BFS expansion for organic wave preview
 * 
 * V6 ORGANIC FLOW: Progressive expansion with natural wave motion
 * - Ring BFS for natural wave expansion
 * - Time-budgeted processing (4-8ms per frame)
 * - Breathing tolerance for smooth expansion/contraction
 */

import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../constants';
import type { Point, LayerBounds } from '../types';
import {
  PreviewResult,
  RingBFSState,
  ExpansionMode,
  EXPANSION_SPEEDS,
  PIXEL_UNSEEN,
  PIXEL_ACCEPTED,
  PIXEL_REJECTED,
} from './PreviewTypes';
import { RequestCancellation } from './RequestCancellation';

export class PreviewWaveEngine {
  private state: RingBFSState | null = null;
  private imageData: ImageData | null = null;
  private requestId: number = 0;
  private rafId: number | null = null;
  private isRunning: boolean = false;
  private expansionMode: ExpansionMode = 'normal';
  private connectivity: 4 | 8 = 4;
  
  private cancellation: RequestCancellation;
  private onProgress: ((result: PreviewResult) => void) | null = null;
  private onComplete: ((result: PreviewResult) => void) | null = null;

  constructor() {
    this.cancellation = new RequestCancellation();
  }

  /**
   * Set connectivity mode (4 or 8)
   */
  setConnectivity(connectivity: 4 | 8): void {
    this.connectivity = connectivity;
  }

  /**
   * Set expansion mode (instant, fast, normal, slow)
   */
  setExpansionMode(mode: ExpansionMode): void {
    this.expansionMode = mode;
  }

  /**
   * Set progress callback (called each frame with partial result)
   */
  setOnProgress(callback: (result: PreviewResult) => void): void {
    this.onProgress = callback;
  }

  /**
   * Set complete callback
   */
  setOnComplete(callback: (result: PreviewResult) => void): void {
    this.onComplete = callback;
  }

  /**
   * Start preview wave expansion
   */
  startWave(
    imageData: ImageData,
    seedPoint: Point,
    tolerance: number
  ): number {
    // Cancel any existing preview
    this.cancelAll();
    
    // Generate new request ID
    this.requestId = this.cancellation.startPreview(seedPoint);
    this.imageData = imageData;
    
    // Initialize Ring BFS state
    const width = imageData.width;
    const height = imageData.height;
    const data = imageData.data;
    
    const seedX = Math.floor(seedPoint.x);
    const seedY = Math.floor(seedPoint.y);
    
    // Bounds check
    if (seedX < 0 || seedX >= width || seedY < 0 || seedY >= height) {
      return this.requestId;
    }
    
    const seedIdx = seedY * width + seedX;
    const pixelIdx = seedIdx * 4;
    
    this.state = {
      queue: [seedIdx],
      nextRing: [],
      visited: new Uint8Array(width * height),
      mask: new Uint8ClampedArray(width * height),
      rejectedFrontier: [],
      ringNumber: 0,
      minX: seedX,
      maxX: seedX,
      minY: seedY,
      maxY: seedY,
      pixelCount: 0,
      seedR: data[pixelIdx],
      seedG: data[pixelIdx + 1],
      seedB: data[pixelIdx + 2],
      connectivity: this.connectivity,
    };
    
    // Mark seed as visited
    this.state.visited[seedIdx] = PIXEL_ACCEPTED;
    this.state.mask[seedIdx] = 255;
    this.state.pixelCount = 1;
    
    this.isRunning = true;
    
    // Start expansion loop
    if (this.expansionMode === 'instant') {
      // Complete immediately
      this.completeInstantly(tolerance);
    } else {
      // Animate expansion
      this.scheduleNextFrame(tolerance);
    }
    
    return this.requestId;
  }

  /**
   * Update tolerance (breathing tolerance)
   * Re-tests rejected frontier and expands if newly accepted
   */
  updateTolerance(newTolerance: number): void {
    if (!this.state || !this.imageData) return;
    
    const { width, height, data } = this.imageData;
    const { visited, mask, rejectedFrontier, seedR, seedG, seedB } = this.state;
    
    const toleranceSq = newTolerance * newTolerance * 3;
    const newQueue: number[] = [];
    const remainingRejected: number[] = [];
    
    // Re-test rejected frontier
    for (const idx of rejectedFrontier) {
      const pixelIdx = idx * 4;
      const r = data[pixelIdx];
      const g = data[pixelIdx + 1];
      const b = data[pixelIdx + 2];
      
      const dr = r - seedR;
      const dg = g - seedG;
      const db = b - seedB;
      const distSq = dr * dr + dg * dg + db * db;
      
      if (distSq <= toleranceSq) {
        // Now accepted
        visited[idx] = PIXEL_ACCEPTED;
        mask[idx] = 255;
        this.state.pixelCount++;
        
        // Update bounds
        const x = idx % width;
        const y = Math.floor(idx / width);
        this.state.minX = Math.min(this.state.minX, x);
        this.state.maxX = Math.max(this.state.maxX, x);
        this.state.minY = Math.min(this.state.minY, y);
        this.state.maxY = Math.max(this.state.maxY, y);
        
        // Add to queue for further expansion
        newQueue.push(idx);
      } else {
        // Still rejected
        remainingRejected.push(idx);
      }
    }
    
    // Update state
    this.state.rejectedFrontier = remainingRejected;
    
    if (newQueue.length > 0) {
      // Resume expansion from newly accepted pixels
      this.state.queue = newQueue;
      
      if (!this.isRunning) {
        this.isRunning = true;
        this.scheduleNextFrame(newTolerance);
      }
    }
    
    // Emit progress
    this.emitProgress();
  }

  /**
   * Cancel specific request
   */
  cancel(requestId: number): void {
    if (requestId === this.requestId) {
      this.cancelAll();
    }
  }

  /**
   * Cancel all preview requests
   */
  cancelAll(): void {
    this.cancellation.cancelAll();
    this.isRunning = false;
    
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    
    this.state = null;
    this.imageData = null;
  }

  /**
   * Get current preview result
   */
  getCurrentPreview(): PreviewResult | null {
    if (!this.state) return null;
    
    return {
      mask: this.state.mask,
      bounds: {
        x: this.state.minX,
        y: this.state.minY,
        width: this.state.maxX - this.state.minX + 1,
        height: this.state.maxY - this.state.minY + 1,
      },
      complete: !this.isRunning,
      ringNumber: this.state.ringNumber,
      seedPoint: { x: 0, y: 0 },
      tolerance: 0,
      pixelCount: this.state.pixelCount,
    };
  }

  /**
   * Check if preview is active
   */
  isActive(): boolean {
    return this.isRunning;
  }

  // ============================================
  // PRIVATE METHODS
  // ============================================

  private scheduleNextFrame(tolerance: number): void {
    this.rafId = requestAnimationFrame(() => {
      this.processFrame(tolerance);
    });
  }

  private processFrame(tolerance: number): void {
    if (!this.state || !this.imageData || !this.cancellation.isValid(this.requestId)) {
      this.isRunning = false;
      return;
    }
    
    const startTime = performance.now();
    const { timeBudget, ringsPerFrame } = EXPANSION_SPEEDS[this.expansionMode];
    
    let ringsProcessed = 0;
    
    // Process rings until budget exhausted
    while (this.state.queue.length > 0) {
      if (ringsProcessed >= ringsPerFrame) break;
      if (performance.now() - startTime > timeBudget) break;
      
      this.processRing(tolerance);
      ringsProcessed++;
    }
    
    // Emit progress
    this.emitProgress();
    
    // Continue or complete
    if (this.state.queue.length > 0) {
      this.scheduleNextFrame(tolerance);
    } else {
      this.isRunning = false;
      this.cancellation.complete(this.requestId);
      
      if (this.onComplete) {
        this.onComplete(this.getCurrentPreview()!);
      }
    }
  }

  private processRing(tolerance: number): void {
    if (!this.state || !this.imageData) return;
    
    const { width, height, data } = this.imageData;
    const { queue, nextRing, visited, mask, rejectedFrontier, seedR, seedG, seedB } = this.state;
    
    const toleranceSq = tolerance * tolerance * 3;
    
    while (queue.length > 0) {
      const currentIdx = queue.pop()!;
      const x = currentIdx % width;
      const y = Math.floor(currentIdx / width);
      
      // Build neighbor list based on connectivity
      const neighbors: number[] = [
        x > 0 ? currentIdx - 1 : -1,           // left
        x < width - 1 ? currentIdx + 1 : -1,   // right
        y > 0 ? currentIdx - width : -1,        // up
        y < height - 1 ? currentIdx + width : -1, // down
      ];
      
      // Add diagonal neighbors for 8-connectivity
      if (this.state?.connectivity === 8) {
        neighbors.push(
          (x > 0 && y > 0) ? currentIdx - width - 1 : -1,           // top-left
          (x < width - 1 && y > 0) ? currentIdx - width + 1 : -1,   // top-right
          (x > 0 && y < height - 1) ? currentIdx + width - 1 : -1,  // bottom-left
          (x < width - 1 && y < height - 1) ? currentIdx + width + 1 : -1, // bottom-right
        );
      }
      
      for (const neighborIdx of neighbors) {
        if (neighborIdx < 0) continue;
        if (visited[neighborIdx] !== PIXEL_UNSEEN) continue;
        
        const pixelIdx = neighborIdx * 4;
        const r = data[pixelIdx];
        const g = data[pixelIdx + 1];
        const b = data[pixelIdx + 2];
        
        const dr = r - seedR;
        const dg = g - seedG;
        const db = b - seedB;
        const distSq = dr * dr + dg * dg + db * db;
        
        if (distSq <= toleranceSq) {
          // Accepted
          visited[neighborIdx] = PIXEL_ACCEPTED;
          mask[neighborIdx] = 255;
          this.state!.pixelCount++;
          nextRing.push(neighborIdx);
          
          // Update bounds
          const nx = neighborIdx % width;
          const ny = Math.floor(neighborIdx / width);
          this.state!.minX = Math.min(this.state!.minX, nx);
          this.state!.maxX = Math.max(this.state!.maxX, nx);
          this.state!.minY = Math.min(this.state!.minY, ny);
          this.state!.maxY = Math.max(this.state!.maxY, ny);
        } else {
          // Rejected - add to frontier for breathing tolerance
          visited[neighborIdx] = PIXEL_REJECTED;
          rejectedFrontier.push(neighborIdx);
        }
      }
    }
    
    // Move next ring to queue
    this.state.queue = [...nextRing];
    this.state.nextRing = [];
    this.state.ringNumber++;
  }

  private completeInstantly(tolerance: number): void {
    if (!this.state || !this.imageData) return;
    
    // Process all rings without animation
    while (this.state.queue.length > 0) {
      this.processRing(tolerance);
    }
    
    this.isRunning = false;
    this.cancellation.complete(this.requestId);
    
    // Emit final result
    if (this.onComplete) {
      this.onComplete(this.getCurrentPreview()!);
    }
  }

  private emitProgress(): void {
    if (this.onProgress && this.state) {
      this.onProgress(this.getCurrentPreview()!);
    }
  }
}
