/**
 * V3MagicWandHandler - Magic Wand Tool with V6 Organic Preview
 * 
 * Features:
 * - Ring BFS expansion with adjustable speed
 * - Scroll wheel adjusts tolerance live (breathing tolerance)
 * - Zero-latency seed preview
 * - Cursor hover shows segment preview
 * - 4 or 8 connectivity
 * - Shift+click to add, Alt+click to subtract
 * - Feathering support
 */

import { CoordinateSystem } from './CoordinateSystem';
import type { SelectionMask, HoverPreview, Layer, Point, SelectionMode } from './types';
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
  connectivity: 4 | 8 = 4;
  feather: number = 0;
  
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
    
    // Set up wave engine callbacks (bound to instance)
    this.waveEngine.setOnProgress((result) => this.handleWaveProgress(result));
    this.waveEngine.setOnComplete((result) => this.handleWaveComplete(result));
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
  // OPTIONS
  // ============================================

  setExpansionMode(mode: ExpansionMode): void {
    this.expansionMode = mode;
    this.waveEngine.setExpansionMode(mode);
  }

  setConnectivity(connectivity: 4 | 8): void {
    this.connectivity = connectivity;
    this.waveEngine.setConnectivity(connectivity);
  }

  setFeather(feather: number): void {
    this.feather = feather;
  }

  // ============================================
  // IMAGE DATA
  // ============================================

  private getCompositeImageData(): ImageData | null {
    if (!this.imageDataDirty && this.cachedImageData) {
      return this.cachedImageData;
    }
    
    // Use dynamic document dimensions from coordinate system
    const docWidth = this.coordSystem.documentWidth;
    const docHeight = this.coordSystem.documentHeight;
    
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = docWidth;
    tempCanvas.height = docHeight;
    const ctx = tempCanvas.getContext('2d');
    
    if (!ctx) return null;
    
    // Fill with white background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, docWidth, docHeight);
    
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
      this.cachedImageData = ctx.getImageData(0, 0, docWidth, docHeight);
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
    
    // Apply current connectivity setting
    this.waveEngine.setConnectivity(this.connectivity);
    
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

  handleClick(screenX: number, screenY: number, selectionMode: SelectionMode = 'replace'): void {
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
    this.waveEngine.setConnectivity(this.connectivity);
    
    // Set completion callback to finalize selection
    this.waveEngine.setOnComplete((result) => {
      this.finalizeSelection(result, selectionMode);
      // Restore expansion mode
      this.waveEngine.setExpansionMode(previousMode);
    });
    
    this.waveEngine.startWave(imageData, seedPoint, this.tolerance);
  }

  // ============================================
  // WAVE CALLBACKS
  // ============================================

  private handleWaveProgress(result: PreviewResult): void {
    if (!this.isHovering) return;
    
    const docWidth = this.coordSystem.documentWidth;
    const docHeight = this.coordSystem.documentHeight;
    
    const mask: SelectionMask = {
      data: new Uint8Array(result.mask),
      width: docWidth,
      height: docHeight,
      bounds: result.bounds,
    };
    
    this.onHoverPreviewChange?.({
      mask,
      worldPoint: { x: 0, y: 0, __space: 'world' },
      timestamp: Date.now(),
    });
  }

  private handleWaveComplete(result: PreviewResult): void {
    // If hovering, update preview
    if (this.isHovering) {
      this.handleWaveProgress(result);
    }
  }

  private finalizeSelection(result: PreviewResult, selectionMode: SelectionMode): void {
    const docWidth = this.coordSystem.documentWidth;
    const docHeight = this.coordSystem.documentHeight;
    
    let finalMask: Uint8Array;
    
    // Apply feathering if enabled
    const featheredMask = this.feather > 0 
      ? this.applyFeather(new Uint8Array(result.mask), docWidth, docHeight, this.feather)
      : new Uint8Array(result.mask);
    
    // Handle add/subtract modes
    if (this.currentMask && selectionMode !== 'replace') {
      finalMask = new Uint8Array(docWidth * docHeight);
      
      for (let i = 0; i < finalMask.length; i++) {
        if (selectionMode === 'add') {
          // Add: union of existing and new
          finalMask[i] = Math.min(255, this.currentMask.data[i] + featheredMask[i]);
        } else if (selectionMode === 'subtract') {
          // Subtract: existing minus new
          finalMask[i] = Math.max(0, this.currentMask.data[i] - featheredMask[i]);
        }
      }
    } else {
      finalMask = featheredMask;
    }
    
    // Recalculate bounds for final mask
    const bounds = this.calculateMaskBounds(finalMask, docWidth, docHeight);
    
    const mask: SelectionMask = {
      data: finalMask,
      width: docWidth,
      height: docHeight,
      bounds,
    };
    
    this.currentMask = mask;
    this.onSelectionChange?.(mask);
  }

  private calculateMaskBounds(mask: Uint8Array, width: number, height: number): { x: number; y: number; width: number; height: number } {
    let minX = width, maxX = 0, minY = height, maxY = 0;
    let hasSelection = false;
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (mask[y * width + x] > 0) {
          hasSelection = true;
          minX = Math.min(minX, x);
          maxX = Math.max(maxX, x);
          minY = Math.min(minY, y);
          maxY = Math.max(maxY, y);
        }
      }
    }
    
    if (!hasSelection) {
      return { x: 0, y: 0, width: 0, height: 0 };
    }
    
    return {
      x: minX,
      y: minY,
      width: maxX - minX + 1,
      height: maxY - minY + 1,
    };
  }

  /**
   * Apply Gaussian-like feathering to the mask edges
   */
  private applyFeather(mask: Uint8Array, width: number, height: number, radius: number): Uint8Array {
    if (radius <= 0) return mask;
    
    const result = new Uint8Array(width * height);
    const kernelSize = Math.ceil(radius * 2) + 1;
    const sigma = radius / 2;
    
    // Create Gaussian kernel
    const kernel: number[] = [];
    let kernelSum = 0;
    for (let i = 0; i < kernelSize; i++) {
      const x = i - Math.floor(kernelSize / 2);
      const value = Math.exp(-(x * x) / (2 * sigma * sigma));
      kernel.push(value);
      kernelSum += value;
    }
    // Normalize kernel
    for (let i = 0; i < kernelSize; i++) {
      kernel[i] /= kernelSum;
    }
    
    const halfKernel = Math.floor(kernelSize / 2);
    
    // Horizontal pass
    const temp = new Float32Array(width * height);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let sum = 0;
        for (let k = 0; k < kernelSize; k++) {
          const sx = Math.max(0, Math.min(width - 1, x + k - halfKernel));
          sum += mask[y * width + sx] * kernel[k];
        }
        temp[y * width + x] = sum;
      }
    }
    
    // Vertical pass
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let sum = 0;
        for (let k = 0; k < kernelSize; k++) {
          const sy = Math.max(0, Math.min(height - 1, y + k - halfKernel));
          sum += temp[sy * width + x] * kernel[k];
        }
        result[y * width + x] = Math.round(sum);
      }
    }
    
    return result;
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