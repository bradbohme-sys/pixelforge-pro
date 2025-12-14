/**
 * CoordinateSystem - The Single Source of Truth for Coordinate Conversions
 * 
 * GOLDEN PATH RULE 2: All Conversions Go Through CoordinateSystem
 * 
 * DYNAMIC DIMENSIONS: Document size is now dynamic based on loaded image.
 * All coordinate calculations use the current document dimensions.
 */

import {
  DEFAULT_CANVAS_WIDTH,
  DEFAULT_CANVAS_HEIGHT,
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
  
  // Dynamic document dimensions
  private _documentWidth: number = DEFAULT_CANVAS_WIDTH;
  private _documentHeight: number = DEFAULT_CANVAS_HEIGHT;
  
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
  
  // Document dimension getters/setters
  get documentWidth(): number { return this._documentWidth; }
  get documentHeight(): number { return this._documentHeight; }
  
  setDocumentSize(width: number, height: number): void {
    this._documentWidth = width;
    this._documentHeight = height;
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
   * Get the offset to center the document in the viewport
   * At zoom=1 and pan=0, the document should be centered
   * 
   * NOTE: Use CSS dimensions (rect) not buffer dimensions (canvas.width) because
   * applyTransform is called AFTER the DPR scale is applied to the context
   */
  private getImageOffset(): { x: number; y: number } {
    const rect = this.getValidatedRect();
    
    // Center the document in the CSS viewport
    return {
      x: (rect.width - this._documentWidth * this._zoom) / 2,
      y: (rect.height - this._documentHeight * this._zoom) / 2,
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
   * 
   * All calculations in CSS space (not buffer space) for consistency
   */
  screenToWorld(screenX: number, screenY: number): Point {
    const rect = this.getValidatedRect();
    
    // Convert screen coords to CSS-relative coords (NOT buffer coords)
    const canvasX = screenX - rect.left;
    const canvasY = screenY - rect.top;
    
    // Get the offset where the image is drawn (CSS space)
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
    
    // Get the offset where the image is drawn (CSS space)
    const offset = this.getImageOffset();
    
    // Convert world to CSS-relative coords
    const canvasX = worldX * this._zoom + offset.x + this._panX;
    const canvasY = worldY * this._zoom + offset.y + this._panY;
    
    // Convert to screen coords
    const screenX = canvasX + rect.left;
    const screenY = canvasY + rect.top;
    
    return { x: Math.round(screenX), y: Math.round(screenY) };
  }

  worldToImage(worldX: number, worldY: number): Point {
    return { x: worldX, y: worldY };
  }

  isInBounds(worldX: number, worldY: number): boolean {
    return worldX >= 0 && worldX < this._documentWidth && 
           worldY >= 0 && worldY < this._documentHeight;
  }

  /**
   * Apply the transform to a canvas context for rendering
   * This positions content so the image is centered in the viewport
   * 
   * IMPORTANT: We apply DPR scale here, not in initializeHighDPICanvas,
   * so all our coordinate math stays in CSS space.
   */
  applyTransform(ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D): void {
    const dpr = this.dpr;
    const offset = this.getImageOffset();
    
    // First scale by DPR to convert CSS coords to buffer coords
    ctx.scale(dpr, dpr);
    
    // Then apply pan and centering offset (all in CSS space)
    ctx.translate(offset.x + this._panX, offset.y + this._panY);
    
    // Finally apply zoom
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
    const maxPanX = this._documentWidth * PAN_CONSTRAINT_RATIO;
    const maxPanY = this._documentHeight * PAN_CONSTRAINT_RATIO;
    this._panX = Math.max(-maxPanX, Math.min(maxPanX, this._panX));
    this._panY = Math.max(-maxPanY, Math.min(maxPanY, this._panY));
  }
}
