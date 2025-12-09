/**
 * RequestCancellation - Prevents visual glitches from stale requests
 * 
 * V6 ORGANIC FLOW: All preview requests must be cancellable
 */

import type { Point } from '../types';

export class RequestCancellation {
  private currentRequestId: number = 0;
  private activeRequests: Set<number> = new Set();

  /**
   * Start new preview request, cancelling all previous
   */
  startPreview(seedPoint: Point): number {
    // Cancel all existing requests
    this.cancelAll();
    
    // Generate new request ID
    this.currentRequestId++;
    this.activeRequests.add(this.currentRequestId);
    
    return this.currentRequestId;
  }

  /**
   * Check if request is still valid (not cancelled)
   */
  isValid(requestId: number): boolean {
    return this.activeRequests.has(requestId) && requestId === this.currentRequestId;
  }

  /**
   * Cancel specific request
   */
  cancel(requestId: number): void {
    this.activeRequests.delete(requestId);
  }

  /**
   * Cancel all active requests
   */
  cancelAll(): void {
    this.activeRequests.clear();
  }

  /**
   * Complete request (remove from active set)
   */
  complete(requestId: number): void {
    this.activeRequests.delete(requestId);
  }

  /**
   * Get current request ID
   */
  getCurrentRequestId(): number {
    return this.currentRequestId;
  }
}
