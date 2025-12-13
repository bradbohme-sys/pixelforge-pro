/**
 * CoordinateSystem - The Single Source of Truth for Coordinate Conversions
 * 
 * GOLDEN PATH RULE 2: All Conversions Go Through CoordinateSystem
 * 
 * FIX: Use dynamic viewport center based on actual canvas element dimensions,
 * not fixed CANVAS_WIDTH/HEIGHT. This ensures the image is centered in the
 * viewport regardless of container size.
 */

import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  ZOOM_MIN,
  ZOOM_MAX,
  PAN_CONSTRAINT_RATIO,
  DPR_CACHE_TTL,
  BROWSER_ZOOM_CHECK_INTERVAL,
} from './constants';
import type { Point } from './types';

export class CoordinateSystem {
  private canvasElement: HTMLCanvasElement;
  
  private _panX: number = 0;
  private _panY: number = 0;
  private _zoom: number = 1;
  
  private cachedRect: DOMRect | null = null;
  private cachedDpr: number = 1;
  private lastDprCheck: number = 0;
  private cachedBrowserZoom: number = 1;
  private lastBrowserZoomCheck: number = 0;

  constructor(canvasElement: HTMLCanvasElement) {
    this.canvasElement = canvasElement;
    this.updateBounds();
    this.updateDpr();
  }

  get panX(): number { return this._panX; }
  get panY(): number { return this._panY; }
  get zoom(): number { return this._zoom; }
  
  get dpr(): number {
    const now = Date.now();
    if (now - this.lastDprCheck > DPR_CACHE_TTL) {
      this.updateDpr();
    }
    return this.cachedDpr;
  }

  /**
   * Get the offset to center the image (CANVAS_WIDTH x CANVAS_HEIGHT) in the viewport
   * At zoom=1 and pan=0, the image should be centered
   */
  private getImageOffset(): { x: number; y: number } {
    // Use the actual canvas buffer dimensions (already scaled by DPR)
    const canvasWidth = this.canvasElement.width;
    const canvasHeight = this.canvasElement.height;
    
    // Center the image in the canvas buffer
    return {
      x: (canvasWidth - CANVAS_WIDTH * this._zoom) / 2,
      y: (canvasHeight - CANVAS_HEIGHT * this._zoom) / 2,
    };
  }

  setPan(x: number, y: number): void {
    this._panX = x;
    this._panY = y;
    this.constrainPan();
  }

  addPan(dx: number, dy: number): void {
    this._panX += dx;
    this._panY += dy;
    this.constrainPan();
  }

  setZoom(zoom: number): void {
    this._zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, zoom));
  }

  zoomAtPoint(newZoom: number, screenX: number, screenY: number): void {
    const worldBefore = this.screenToWorld(screenX, screenY);
    this.setZoom(newZoom);
    const worldAfter = this.screenToWorld(screenX, screenY);
    this._panX += (worldAfter.x - worldBefore.x) * this._zoom;
    this._panY += (worldAfter.y - worldBefore.y) * this._zoom;
    this.constrainPan();
  }

  updateBounds(): void {
    this.cachedRect = this.canvasElement.getBoundingClientRect();
  }

  private updateDpr(): void {
    this.cachedDpr = window.devicePixelRatio || 1;
    this.lastDprCheck = Date.now();
  }

  private getBrowserZoom(): number {
    const now = Date.now();
    if (now - this.lastBrowserZoomCheck < BROWSER_ZOOM_CHECK_INTERVAL) {
      return this.cachedBrowserZoom;
    }
    
    if (window.visualViewport) {
      this.cachedBrowserZoom = window.visualViewport.scale;
    } else {
      this.cachedBrowserZoom = window.outerWidth / window.screen.availWidth;
    }
    
    this.lastBrowserZoomCheck = now;
    return this.cachedBrowserZoom;
  }

  /**
   * Convert screen coordinates to world (image) coordinates
   * World coordinates are 0-CANVAS_WIDTH and 0-CANVAS_HEIGHT
   */
  screenToWorld(screenX: number, screenY: number): Point {
    const rect = this.getValidatedRect();
    const dpr = this.cachedDpr;
    
    // Convert screen coords to canvas buffer coords
    const canvasX = (screenX - rect.left) * dpr;
    const canvasY = (screenY - rect.top) * dpr;
    
    // Get the offset where the image is drawn
    const offset = this.getImageOffset();
    
    // Convert to world coords (accounting for pan and zoom)
    const worldX = (canvasX - offset.x - this._panX) / this._zoom;
    const worldY = (canvasY - offset.y - this._panY) / this._zoom;
    
    return { x: Math.floor(worldX), y: Math.floor(worldY) };
  }

  /**
   * Convert world (image) coordinates to screen coordinates
   */
  worldToScreen(worldX: number, worldY: number): Point {
    const rect = this.getValidatedRect();
    const dpr = this.cachedDpr;
    
    // Get the offset where the image is drawn
    const offset = this.getImageOffset();
    
    // Convert world to canvas buffer coords
    const canvasX = worldX * this._zoom + offset.x + this._panX;
    const canvasY = worldY * this._zoom + offset.y + this._panY;
    
    // Convert to screen coords
    const screenX = canvasX / dpr + rect.left;
    const screenY = canvasY / dpr + rect.top;
    
    return { x: Math.round(screenX), y: Math.round(screenY) };
  }

  worldToImage(worldX: number, worldY: number): Point {
    return { x: worldX, y: worldY };
  }

  isInBounds(worldX: number, worldY: number): boolean {
    return worldX >= 0 && worldX < CANVAS_WIDTH && 
           worldY >= 0 && worldY < CANVAS_HEIGHT;
  }

  /**
   * Apply the transform to a canvas context for rendering
   * This positions content so the image is centered in the viewport
   */
  applyTransform(ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D): void {
    const offset = this.getImageOffset();
    ctx.translate(offset.x + this._panX, offset.y + this._panY);
    ctx.scale(this._zoom, this._zoom);
  }

  private getValidatedRect(): DOMRect {
    if (!this.cachedRect || this.isRectStale()) {
      this.updateBounds();
    }
    return this.cachedRect!;
  }

  private isRectStale(): boolean {
    if (!this.cachedRect) return true;
    
    const currentRect = this.canvasElement.getBoundingClientRect();
    return (
      Math.abs(currentRect.width - this.cachedRect.width) > 0.5 ||
      Math.abs(currentRect.height - this.cachedRect.height) > 0.5 ||
      Math.abs(currentRect.left - this.cachedRect.left) > 0.5 ||
      Math.abs(currentRect.top - this.cachedRect.top) > 0.5
    );
  }

  private constrainPan(): void {
    const maxPanX = CANVAS_WIDTH * PAN_CONSTRAINT_RATIO;
    const maxPanY = CANVAS_HEIGHT * PAN_CONSTRAINT_RATIO;
    this._panX = Math.max(-maxPanX, Math.min(maxPanX, this._panX));
    this._panY = Math.max(-maxPanY, Math.min(maxPanY, this._panY));
  }
}
