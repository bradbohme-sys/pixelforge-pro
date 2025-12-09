/**
 * PanZoomHandler - Pointer Events API Based Pan & Zoom
 * 
 * GOLDEN PATH RULE 12: Pointer Capture is Tool-Level Invariant
 */

import { CoordinateSystem } from './CoordinateSystem';
import { ZOOM_MIN, ZOOM_MAX, ZOOM_STEP } from './constants';

export class PanZoomHandler {
  private coordSystem: CoordinateSystem;
  private canvas: HTMLCanvasElement;
  
  private isDragging: boolean = false;
  private lastPointerX: number = 0;
  private lastPointerY: number = 0;
  private pointerId: number | null = null;
  private isPanMode: boolean = false;
  
  private touchZoomState: {
    active: boolean;
    initialDistance: number;
    initialZoom: number;
    centerX: number;
    centerY: number;
  } | null = null;
  
  private onUpdate: () => void;

  constructor(
    coordSystem: CoordinateSystem,
    canvas: HTMLCanvasElement,
    onUpdate: () => void
  ) {
    this.coordSystem = coordSystem;
    this.canvas = canvas;
    this.onUpdate = onUpdate;
    
    this.attachListeners();
  }

  setPanMode(enabled: boolean): void {
    this.isPanMode = enabled;
    this.canvas.style.cursor = enabled ? 'grab' : 'default';
  }

  destroy(): void {
    this.detachListeners();
    
    if (this.pointerId !== null) {
      try {
        this.canvas.releasePointerCapture(this.pointerId);
      } catch {
        // Ignore if already released
      }
      this.pointerId = null;
    }
  }

  private attachListeners(): void {
    this.canvas.addEventListener('pointerdown', this.handlePointerDown);
    this.canvas.addEventListener('pointermove', this.handlePointerMove);
    this.canvas.addEventListener('pointerup', this.handlePointerUp);
    this.canvas.addEventListener('pointercancel', this.handlePointerUp);
    this.canvas.addEventListener('wheel', this.handleWheel, { passive: false });
    this.canvas.addEventListener('touchstart', this.handleTouchStart, { passive: false });
    this.canvas.addEventListener('touchmove', this.handleTouchMove, { passive: false });
    this.canvas.addEventListener('touchend', this.handleTouchEnd);
  }

  private detachListeners(): void {
    this.canvas.removeEventListener('pointerdown', this.handlePointerDown);
    this.canvas.removeEventListener('pointermove', this.handlePointerMove);
    this.canvas.removeEventListener('pointerup', this.handlePointerUp);
    this.canvas.removeEventListener('pointercancel', this.handlePointerUp);
    this.canvas.removeEventListener('wheel', this.handleWheel);
    this.canvas.removeEventListener('touchstart', this.handleTouchStart);
    this.canvas.removeEventListener('touchmove', this.handleTouchMove);
    this.canvas.removeEventListener('touchend', this.handleTouchEnd);
  }

  private handlePointerDown = (e: PointerEvent): void => {
    // Middle click, right click, or pan mode with left click
    if (e.button === 1 || e.button === 2 || (this.isPanMode && e.button === 0)) {
      e.preventDefault();
      
      this.isDragging = true;
      this.lastPointerX = e.clientX;
      this.lastPointerY = e.clientY;
      this.pointerId = e.pointerId;
      
      this.canvas.setPointerCapture(e.pointerId);
      this.canvas.style.cursor = 'grabbing';
    }
  };

  private handlePointerMove = (e: PointerEvent): void => {
    if (!this.isDragging || this.pointerId !== e.pointerId) return;
    
    const dx = e.clientX - this.lastPointerX;
    const dy = e.clientY - this.lastPointerY;
    
    this.lastPointerX = e.clientX;
    this.lastPointerY = e.clientY;
    
    this.coordSystem.addPan(dx, dy);
    this.onUpdate();
  };

  private handlePointerUp = (e: PointerEvent): void => {
    if (this.pointerId !== e.pointerId) return;
    
    this.isDragging = false;
    this.canvas.style.cursor = this.isPanMode ? 'grab' : 'default';
    
    if (this.pointerId !== null) {
      try {
        this.canvas.releasePointerCapture(this.pointerId);
      } catch {
        // Ignore if already released
      }
      this.pointerId = null;
    }
  };

  private handleWheel = (e: WheelEvent): void => {
    e.preventDefault();
    
    // Ctrl+Wheel or trackpad pinch = zoom to cursor
    if (e.ctrlKey || Math.abs(e.deltaY) < 50) {
      const zoomDelta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
      const newZoom = this.coordSystem.zoom + zoomDelta;
      this.coordSystem.zoomAtPoint(newZoom, e.clientX, e.clientY);
    } else {
      // Regular scroll = pan
      this.coordSystem.addPan(-e.deltaX, -e.deltaY);
    }
    
    this.onUpdate();
  };

  private handleTouchStart = (e: TouchEvent): void => {
    if (e.touches.length === 2) {
      e.preventDefault();
      
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      
      const distance = this.getTouchDistance(touch1, touch2);
      const centerX = (touch1.clientX + touch2.clientX) / 2;
      const centerY = (touch1.clientY + touch2.clientY) / 2;
      
      this.touchZoomState = {
        active: true,
        initialDistance: distance,
        initialZoom: this.coordSystem.zoom,
        centerX,
        centerY,
      };
    }
  };

  private handleTouchMove = (e: TouchEvent): void => {
    if (!this.touchZoomState?.active || e.touches.length !== 2) return;
    
    e.preventDefault();
    
    const touch1 = e.touches[0];
    const touch2 = e.touches[1];
    
    const distance = this.getTouchDistance(touch1, touch2);
    const scale = distance / this.touchZoomState.initialDistance;
    const newZoom = this.touchZoomState.initialZoom * scale;
    
    this.coordSystem.zoomAtPoint(
      newZoom,
      this.touchZoomState.centerX,
      this.touchZoomState.centerY
    );
    
    this.onUpdate();
  };

  private handleTouchEnd = (e: TouchEvent): void => {
    if (e.touches.length < 2) {
      this.touchZoomState = null;
    }
  };

  private getTouchDistance(touch1: Touch, touch2: Touch): number {
    const dx = touch1.clientX - touch2.clientX;
    const dy = touch1.clientY - touch2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  zoomIn(): void {
    const newZoom = Math.min(ZOOM_MAX, this.coordSystem.zoom + ZOOM_STEP);
    this.coordSystem.setZoom(newZoom);
    this.onUpdate();
  }

  zoomOut(): void {
    const newZoom = Math.max(ZOOM_MIN, this.coordSystem.zoom - ZOOM_STEP);
    this.coordSystem.setZoom(newZoom);
    this.onUpdate();
  }

  resetView(): void {
    this.coordSystem.setPan(0, 0);
    this.coordSystem.setZoom(1);
    this.onUpdate();
  }
}
