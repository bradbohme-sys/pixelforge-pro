/**
 * V3MagicWandHandler - Magic Wand Tool with V6 Organic Preview
 * 
 * Features:
 * - Ring BFS expansion with adjustable speed
 * - Scroll wheel adjusts tolerance live (breathing tolerance)
 * - Zero-latency seed preview
 * - Cursor hover shows segment preview
 */

import { CoordinateSystem } from './CoordinateSystem';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from './constants';
import type { SelectionMask, HoverPreview, Layer, Point } from './types';
import {
  PreviewWaveEngine,
  ZeroLatencyPreview,
  ExpansionMode,
  PreviewResult,
} from './preview';

export class V3MagicWandHandler {
  private coordSystem: CoordinateSystem;
  private isTerminated: boolean = false;
  
  private layers: Layer[] = [];
  private imageCache: Map<string, HTMLImageElement> = new Map();
  private cachedImageData: ImageData | null = null;
  private imageDataDirty: boolean = true;
  
  // V6 Preview System
  private waveEngine: PreviewWaveEngine;
  private zeroLatency: ZeroLatencyPreview;
  
  // State
  private currentMask: SelectionMask | null = null;
  private currentSeedPoint: Point | null = null;
  private isHovering: boolean = false;
  
  // Options
  tolerance: number = 32;
  contiguous: boolean = true;
  expansionMode: ExpansionMode = 'fast';
  
  // Callbacks
  private onSelectionChange: ((mask: SelectionMask | null) => void) | null = null;
  private onHoverPreviewChange: ((preview: HoverPreview | null) => void) | null = null;
  private onToleranceChange: ((tolerance: number) => void) | null = null;
  private onError: ((message: string) => void) | null = null;

  constructor(
    coordSystem: CoordinateSystem,
    layers: Layer[] = [],
    imageCache: Map<string, HTMLImageElement> = new Map()
  ) {
    this.coordSystem = coordSystem;
    this.layers = layers;
    this.imageCache = imageCache;
    
    // Initialize V6 preview system
    this.waveEngine = new PreviewWaveEngine();
    this.zeroLatency = new ZeroLatencyPreview();
    
    // Set up wave engine callbacks
    this.waveEngine.setOnProgress(this.handleWaveProgress);
    this.waveEngine.setOnComplete(this.handleWaveComplete);
  }

  terminate(): void {
    if (!this.isTerminated) {
      this.waveEngine.cancelAll();
      this.isTerminated = true;
    }
  }

  // ============================================
  // CALLBACK SETTERS
  // ============================================

  setOnSelectionChange(callback: (mask: SelectionMask | null) => void): void {
    this.onSelectionChange = callback;
  }

  setOnHoverPreviewChange(callback: (preview: HoverPreview | null) => void): void {
    this.onHoverPreviewChange = callback;
  }

  setOnToleranceChange(callback: (tolerance: number) => void): void {
    this.onToleranceChange = callback;
  }

  setOnError(callback: (message: string) => void): void {
    this.onError = callback;
  }

  // ============================================
  // LAYER MANAGEMENT
  // ============================================

  updateLayers(layers: Layer[], imageCache: Map<string, HTMLImageElement>): void {
    this.layers = layers;
    this.imageCache = imageCache;
    this.markImageDataDirty();
  }

  markImageDataDirty(): void {
    this.imageDataDirty = true;
    this.cachedImageData = null;
  }

  // ============================================
  // EXPANSION MODE
  // ============================================

  setExpansionMode(mode: ExpansionMode): void {
    this.expansionMode = mode;
    this.waveEngine.setExpansionMode(mode);
  }

  // ============================================
  // IMAGE DATA
  // ============================================

  private getCompositeImageData(): ImageData | null {
    if (!this.imageDataDirty && this.cachedImageData) {
      return this.cachedImageData;
    }
    
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = CANVAS_WIDTH;
    tempCanvas.height = CANVAS_HEIGHT;
    const ctx = tempCanvas.getContext('2d');
    
    if (!ctx) return null;
    
    // Fill with white background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    
    for (const layer of this.layers) {
      if (!layer.visible || !layer.image) continue;
      
      try {
        ctx.save();
        ctx.globalAlpha = layer.opacity;
        ctx.globalCompositeOperation = layer.blendMode || 'source-over';
        
        const { x, y, width, height } = layer.bounds;
        const transform = layer.transform || { rotation: 0, scaleX: 1, scaleY: 1 };
        
        ctx.translate(x + width / 2, y + height / 2);
        ctx.rotate((transform.rotation * Math.PI) / 180);
        ctx.scale(transform.scaleX, transform.scaleY);
        ctx.translate(-(width / 2), -(height / 2));
        
        ctx.drawImage(layer.image, 0, 0, width, height);
        ctx.restore();
      } catch {
        ctx.restore();
      }
    }
    
    try {
      this.cachedImageData = ctx.getImageData(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      this.imageDataDirty = false;
      return this.cachedImageData;
    } catch {
      return null;
    }
  }

  // ============================================
  // HOVER HANDLING (V6 Preview)
  // ============================================

  handleHover(screenX: number, screenY: number): void {
    if (this.isTerminated) return;
    
    const worldPoint = this.coordSystem.screenToWorld(screenX, screenY);
    
    if (!this.coordSystem.isInBounds(worldPoint.x, worldPoint.y)) {
      this.clearHoverPreview();
      return;
    }
    
    this.isHovering = true;
    this.currentSeedPoint = { x: Math.floor(worldPoint.x), y: Math.floor(worldPoint.y) };
    
    const imageData = this.getCompositeImageData();
    if (!imageData) return;
    
    // Start wave preview
    this.waveEngine.startWave(imageData, this.currentSeedPoint, this.tolerance);
  }

  clearHoverPreview(): void {
    this.isHovering = false;
    this.currentSeedPoint = null;
    this.waveEngine.cancelAll();
    this.onHoverPreviewChange?.(null);
  }

  // ============================================
  // SCROLL HANDLING (Breathing Tolerance)
  // ============================================

  handleWheel(deltaY: number): void {
    if (!this.isHovering || !this.currentSeedPoint) return;
    
    // Adjust tolerance based on scroll direction
    const toleranceStep = 2;
    const newTolerance = Math.max(0, Math.min(255, 
      this.tolerance + (deltaY > 0 ? toleranceStep : -toleranceStep)
    ));
    
    if (newTolerance !== this.tolerance) {
      this.tolerance = newTolerance;
      this.onToleranceChange?.(newTolerance);
      
      // Use breathing tolerance to expand/contract
      if (deltaY > 0) {
        // Increasing tolerance - re-test rejected frontier
        this.waveEngine.updateTolerance(newTolerance);
      } else {
        // Decreasing tolerance - restart preview (simpler than contraction)
        const imageData = this.getCompositeImageData();
        if (imageData && this.currentSeedPoint) {
          this.waveEngine.startWave(imageData, this.currentSeedPoint, newTolerance);
        }
      }
    }
  }

  // ============================================
  // CLICK HANDLING (Finalize Selection)
  // ============================================

  handleClick(screenX: number, screenY: number): void {
    if (this.isTerminated) return;
    
    const worldPoint = this.coordSystem.screenToWorld(screenX, screenY);
    
    if (!this.coordSystem.isInBounds(worldPoint.x, worldPoint.y)) {
      return;
    }
    
    const imageData = this.getCompositeImageData();
    if (!imageData) {
      this.onError?.('Cannot segment: Failed to get image data');
      return;
    }
    
    const seedPoint = { x: Math.floor(worldPoint.x), y: Math.floor(worldPoint.y) };
    
    // Use instant mode for click (immediate result)
    const previousMode = this.expansionMode;
    this.waveEngine.setExpansionMode('instant');
    
    // Set completion callback to finalize selection
    this.waveEngine.setOnComplete((result) => {
      this.finalizeSelection(result);
      // Restore expansion mode
      this.waveEngine.setExpansionMode(previousMode);
    });
    
    this.waveEngine.startWave(imageData, seedPoint, this.tolerance);
  }

  // ============================================
  // WAVE CALLBACKS
  // ============================================

  private handleWaveProgress = (result: PreviewResult): void => {
    if (!this.isHovering) return;
    
    const mask: SelectionMask = {
      data: new Uint8Array(result.mask),
      width: CANVAS_WIDTH,
      height: CANVAS_HEIGHT,
      bounds: result.bounds,
    };
    
    this.onHoverPreviewChange?.({
      mask,
      worldPoint: { x: 0, y: 0, __space: 'world' },
      timestamp: Date.now(),
    });
  };

  private handleWaveComplete = (result: PreviewResult): void => {
    // If hovering, update preview
    if (this.isHovering) {
      this.handleWaveProgress(result);
    }
  };

  private finalizeSelection(result: PreviewResult): void {
    const mask: SelectionMask = {
      data: new Uint8Array(result.mask),
      width: CANVAS_WIDTH,
      height: CANVAS_HEIGHT,
      bounds: result.bounds,
    };
    
    this.currentMask = mask;
    this.onSelectionChange?.(mask);
  }

  // ============================================
  // ZERO LATENCY PREVIEW
  // ============================================

  drawInstantSeed(ctx: CanvasRenderingContext2D): void {
    if (this.currentSeedPoint && this.isHovering) {
      this.zeroLatency.drawInstantSeed(ctx, this.currentSeedPoint, this.coordSystem.zoom);
    }
  }

  // ============================================
  // GETTERS
  // ============================================

  getCurrentMask(): SelectionMask | null {
    return this.currentMask;
  }

  getCurrentSeedPoint(): Point | null {
    return this.currentSeedPoint;
  }

  isPreviewActive(): boolean {
    return this.waveEngine.isActive();
  }

  clearSelection(): void {
    this.currentMask = null;
    this.onSelectionChange?.(null);
  }
}
