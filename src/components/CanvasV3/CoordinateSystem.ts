/**
 * CoordinateSystem - The Single Source of Truth for Coordinate Conversions
 * 
 * GOLDEN PATH RULE 2: All Conversions Go Through CoordinateSystem
 */

import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  VIEWPORT_CENTER_X,
  VIEWPORT_CENTER_Y,
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

  screenToWorld(screenX: number, screenY: number): Point {
    const rect = this.getValidatedRect();
    
    const scaleX = this.canvasElement.width / rect.width;
    const scaleY = this.canvasElement.height / rect.height;
    const canvasX = (screenX - rect.left) * scaleX;
    const canvasY = (screenY - rect.top) * scaleY;
    
    const worldX = (canvasX - VIEWPORT_CENTER_X - this._panX) / this._zoom;
    const worldY = (canvasY - VIEWPORT_CENTER_Y - this._panY) / this._zoom;
    
    return { x: Math.floor(worldX), y: Math.floor(worldY) };
  }

  worldToScreen(worldX: number, worldY: number): Point {
    const rect = this.getValidatedRect();
    
    const canvasX = worldX * this._zoom + VIEWPORT_CENTER_X + this._panX;
    const canvasY = worldY * this._zoom + VIEWPORT_CENTER_Y + this._panY;
    
    const scaleX = rect.width / this.canvasElement.width;
    const scaleY = rect.height / this.canvasElement.height;
    const screenX = canvasX * scaleX + rect.left;
    const screenY = canvasY * scaleY + rect.top;
    
    return { x: Math.round(screenX), y: Math.round(screenY) };
  }

  worldToImage(worldX: number, worldY: number): Point {
    return { x: worldX, y: worldY };
  }

  isInBounds(worldX: number, worldY: number): boolean {
    return worldX >= 0 && worldX < CANVAS_WIDTH && 
           worldY >= 0 && worldY < CANVAS_HEIGHT;
  }

  applyTransform(ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D): void {
    ctx.translate(VIEWPORT_CENTER_X + this._panX, VIEWPORT_CENTER_Y + this._panY);
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
