/**
 * RenderPipeline - RAF-Driven Rendering Engine
 * 
 * GOLDEN PATH RULE 6: Render Loop is rAF + Refs (Not React State)
 * 
 * DYNAMIC DIMENSIONS: Now uses document dimensions from state instead of fixed constants.
 */

import {
  FRAME_BUDGET_MS,
  CHECKERBOARD_SIZE,
  CHECKERBOARD_LIGHT,
  CHECKERBOARD_DARK,
} from './constants';
import type { Layer, CanvasState } from './types';
import { CoordinateSystem } from './CoordinateSystem';

export class RenderPipeline {
  private rafId: number | null = null;
  private lastFrameTime: number = 0;
  private fpsHistory: number[] = [];
  
  private layerCacheCanvas: OffscreenCanvas;
  private layerCacheCtx: OffscreenCanvasRenderingContext2D;
  private layerCacheDirty: boolean = true;
  
  private checkerboardPattern: CanvasPattern | null = null;
  
  private mainCanvas: HTMLCanvasElement | null = null;
  private coordSystem: CoordinateSystem | null = null;
  private stateRef: { current: CanvasState } | null = null;
  
  // Dynamic document dimensions
  private docWidth: number;
  private docHeight: number;
  
  private onRenderInteraction: ((ctx: CanvasRenderingContext2D, deltaTime: number) => void) | null = null;

  constructor(width: number, height: number) {
    this.docWidth = width;
    this.docHeight = height;
    this.layerCacheCanvas = new OffscreenCanvas(width, height);
    const ctx = this.layerCacheCanvas.getContext('2d');
    if (!ctx) {
      throw new Error('[RenderPipeline] Failed to create OffscreenCanvas context');
    }
    this.layerCacheCtx = ctx;
    this.createCheckerboardPattern();
  }

  private createCheckerboardPattern(): void {
    const patternCanvas = new OffscreenCanvas(CHECKERBOARD_SIZE * 2, CHECKERBOARD_SIZE * 2);
    const patternCtx = patternCanvas.getContext('2d');
    if (!patternCtx) return;

    patternCtx.fillStyle = CHECKERBOARD_LIGHT;
    patternCtx.fillRect(0, 0, CHECKERBOARD_SIZE * 2, CHECKERBOARD_SIZE * 2);
    
    patternCtx.fillStyle = CHECKERBOARD_DARK;
    patternCtx.fillRect(0, 0, CHECKERBOARD_SIZE, CHECKERBOARD_SIZE);
    patternCtx.fillRect(CHECKERBOARD_SIZE, CHECKERBOARD_SIZE, CHECKERBOARD_SIZE, CHECKERBOARD_SIZE);
    
    this.checkerboardPattern = this.layerCacheCtx.createPattern(patternCanvas, 'repeat');
  }

  start(
    mainCanvas: HTMLCanvasElement,
    coordSystem: CoordinateSystem,
    stateRef: { current: CanvasState }
  ): void {
    this.mainCanvas = mainCanvas;
    this.coordSystem = coordSystem;
    this.stateRef = stateRef;
    this.lastFrameTime = performance.now();
    
    const loop = (time: number) => {
      const deltaTime = time - this.lastFrameTime;
      this.lastFrameTime = time;
      
      const fps = 1000 / deltaTime;
      this.fpsHistory.push(fps);
      if (this.fpsHistory.length > 60) {
        this.fpsHistory.shift();
      }
      
      this.renderFrame(deltaTime);
      this.rafId = requestAnimationFrame(loop);
    };
    
    this.rafId = requestAnimationFrame(loop);
  }

  stop(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  markLayersDirty(): void {
    this.layerCacheDirty = true;
  }

  setInteractionRenderer(
    callback: (ctx: CanvasRenderingContext2D, deltaTime: number) => void
  ): void {
    this.onRenderInteraction = callback;
  }

  getAverageFps(): number {
    if (this.fpsHistory.length === 0) return 60;
    return this.fpsHistory.reduce((a, b) => a + b, 0) / this.fpsHistory.length;
  }

  private renderFrame(deltaTime: number): void {
    if (!this.mainCanvas || !this.coordSystem || !this.stateRef) return;
    
    const ctx = this.mainCanvas.getContext('2d');
    if (!ctx) return;
    
    // Reset transform and clear entire buffer
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.mainCanvas.width, this.mainCanvas.height);
    
    if (this.layerCacheDirty) {
      this.renderLayerCache();
      this.layerCacheDirty = false;
    }
    
    ctx.save();
    this.coordSystem.applyTransform(ctx);
    ctx.drawImage(this.layerCacheCanvas, 0, 0);
    ctx.restore();
    
    if (this.onRenderInteraction) {
      this.onRenderInteraction(ctx, deltaTime);
    }
  }

  private renderLayerCache(): void {
    if (!this.stateRef) return;
    
    const ctx = this.layerCacheCtx;
    const state = this.stateRef.current;
    
    ctx.clearRect(0, 0, this.layerCacheCanvas.width, this.layerCacheCanvas.height);
    
    // Draw checkerboard pattern for transparency
    if (this.checkerboardPattern) {
      ctx.fillStyle = this.checkerboardPattern;
      ctx.fillRect(0, 0, this.docWidth, this.docHeight);
    }
    
    // Draw border
    ctx.strokeStyle = '#454549';
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, this.docWidth, this.docHeight);
    
    // Render each visible layer
    for (const layer of state.layers) {
      if (!layer.visible) continue;
      this.renderLayer(ctx, layer);
    }
  }

  private renderLayer(
    ctx: OffscreenCanvasRenderingContext2D,
    layer: Layer
  ): void {
    const image = layer.image;
    if (!image) return;
    
    ctx.save();
    ctx.globalAlpha = layer.opacity;
    ctx.globalCompositeOperation = layer.blendMode || 'source-over';
    
    const { x, y, width, height } = layer.bounds;
    const transform = layer.transform || { rotation: 0, scaleX: 1, scaleY: 1 };
    const { rotation, scaleX, scaleY } = transform;
    
    ctx.translate(x + width / 2, y + height / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.scale(scaleX, scaleY);
    ctx.translate(-(width / 2), -(height / 2));
    
    ctx.drawImage(image, 0, 0, width, height);
    ctx.restore();
  }

  resizeCache(width: number, height: number): void {
    this.docWidth = width;
    this.docHeight = height;
    this.layerCacheCanvas = new OffscreenCanvas(width, height);
    const ctx = this.layerCacheCanvas.getContext('2d');
    if (ctx) {
      this.layerCacheCtx = ctx;
      this.createCheckerboardPattern();
    }
    this.layerCacheDirty = true;
  }
  
  getDocumentSize(): { width: number; height: number } {
    return { width: this.docWidth, height: this.docHeight };
  }
}
