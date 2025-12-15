/**
 * Base Lasso Handler
 * 
 * Common functionality shared by all lasso variations.
 */

import type { CoordinateSystem } from '../CoordinateSystem';
import type { Layer, SelectionMask } from '../types';
import type { 
  LassoPoint, 
  LassoAnchor, 
  LassoPath, 
  LassoSettings,
  LassoMetrics,
} from './types';
import { EdgeDetectionEngine } from './EdgeDetectionEngine';
import { PathfindingEngine } from './PathfindingEngine';
import { LazyCursor } from './LazyCursor';

export type LassoState = 'idle' | 'drawing' | 'editing' | 'complete';

export abstract class BaseLassoHandler {
  protected coordSystem: CoordinateSystem;
  protected layers: Layer[];
  protected imageCache: Map<string, HTMLImageElement>;
  
  protected edgeEngine: EdgeDetectionEngine;
  protected pathEngine: PathfindingEngine;
  protected lazyCursor: LazyCursor;
  
  protected settings: LassoSettings;
  protected state: LassoState = 'idle';
  
  protected path: LassoPath = { points: [], anchors: [], closed: false };
  protected previewPath: LassoPoint[] = [];
  protected cursorTrail: LassoPoint[] = [];
  
  protected imageData: ImageData | null = null;
  protected imageDataDirty: boolean = true;
  
  protected metrics: LassoMetrics = {
    fps: 0,
    pathComputeMs: 0,
    totalPoints: 0,
    anchorCount: 0,
    edgeQuality: 0,
    cursorInfluence: 0,
    cursorSpeed: 0,
  };
  
  // Callbacks
  protected onPathChange?: (path: LassoPath) => void;
  protected onSelectionComplete?: (mask: SelectionMask) => void;
  protected onMetricsUpdate?: (metrics: LassoMetrics) => void;
  protected onError?: (message: string) => void;

  constructor(
    coordSystem: CoordinateSystem,
    layers: Layer[],
    imageCache: Map<string, HTMLImageElement>,
    settings: LassoSettings
  ) {
    this.coordSystem = coordSystem;
    this.layers = layers;
    this.imageCache = imageCache;
    this.settings = settings;
    
    this.edgeEngine = new EdgeDetectionEngine(settings.edge);
    this.pathEngine = new PathfindingEngine(this.edgeEngine, settings.pathfinding);
    this.lazyCursor = new LazyCursor(settings.cursor);
  }

  // Abstract methods that variations must implement
  abstract handleMove(screenX: number, screenY: number): void;
  abstract handleClick(screenX: number, screenY: number): void;
  abstract handleDoubleClick(screenX: number, screenY: number): void;
  
  // Common methods
  
  updateSettings(settings: Partial<LassoSettings>): void {
    this.settings = { ...this.settings, ...settings };
    
    if (settings.edge) {
      this.edgeEngine.updateSettings(settings.edge);
      this.imageDataDirty = true;
    }
    if (settings.pathfinding) {
      this.pathEngine.updateSettings(settings.pathfinding);
    }
    if (settings.cursor) {
      this.lazyCursor.updateSettings(settings.cursor);
    }
  }

  updateLayers(layers: Layer[], cache: Map<string, HTMLImageElement>): void {
    this.layers = layers;
    this.imageCache = cache;
    this.imageDataDirty = true;
  }

  markImageDataDirty(): void {
    this.imageDataDirty = true;
  }

  getState(): LassoState {
    return this.state;
  }

  getPath(): LassoPath {
    return this.path;
  }

  getPreviewPath(): LassoPoint[] {
    return this.previewPath;
  }

  getMetrics(): LassoMetrics {
    return this.metrics;
  }

  // Setters for callbacks
  setOnPathChange(callback: (path: LassoPath) => void): void {
    this.onPathChange = callback;
  }

  setOnSelectionComplete(callback: (mask: SelectionMask) => void): void {
    this.onSelectionComplete = callback;
  }

  setOnMetricsUpdate(callback: (metrics: LassoMetrics) => void): void {
    this.onMetricsUpdate = callback;
  }

  setOnError(callback: (message: string) => void): void {
    this.onError = callback;
  }

  /**
   * Cancel current operation
   */
  cancel(): void {
    this.state = 'idle';
    this.path = { points: [], anchors: [], closed: false };
    this.previewPath = [];
    this.cursorTrail = [];
    this.onPathChange?.(this.path);
  }

  /**
   * Complete the path and create selection mask
   */
  complete(): void {
    if (this.path.points.length < 3) {
      this.onError?.('Path too short to create selection');
      this.cancel();
      return;
    }
    
    // Close the path
    this.path.closed = true;
    
    // Create selection mask
    const mask = this.pathToMask(this.path);
    
    this.state = 'complete';
    this.onPathChange?.(this.path);
    this.onSelectionComplete?.(mask);
  }

  /**
   * Draw the lasso visualization
   */
  draw(ctx: CanvasRenderingContext2D): void {
    if (this.state === 'idle') return;
    
    ctx.save();
    
    // Draw committed path
    this.drawPath(ctx, this.path.points, this.settings.visualization.pathColor);
    
    // Draw anchors
    this.drawAnchors(ctx);
    
    // Draw preview path
    if (this.previewPath.length > 0) {
      this.drawPath(ctx, this.previewPath, this.settings.visualization.previewColor);
    }
    
    // Draw lazy cursor
    if (this.state === 'drawing') {
      this.lazyCursor.draw(ctx);
    }
    
    // Draw metrics if enabled
    if (this.settings.visualization.showMetrics) {
      this.drawMetrics(ctx);
    }
    
    ctx.restore();
  }

  // Protected helper methods

  protected ensureImageData(): ImageData | null {
    if (!this.imageDataDirty && this.imageData) {
      return this.imageData;
    }
    
    const docWidth = this.coordSystem.documentWidth;
    const docHeight = this.coordSystem.documentHeight;
    
    // Create composite image from visible layers
    const canvas = new OffscreenCanvas(docWidth, docHeight);
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    
    // Draw layers
    for (const layer of this.layers) {
      if (!layer.visible) continue;
      
      const img = layer.image || this.imageCache.get(layer.id);
      if (!img) continue;
      
      ctx.globalAlpha = layer.opacity;
      ctx.drawImage(img, layer.bounds.x, layer.bounds.y, layer.bounds.width, layer.bounds.height);
    }
    
    this.imageData = ctx.getImageData(0, 0, docWidth, docHeight);
    
    // Process edge detection
    this.edgeEngine.processImage(this.imageData);
    this.pathEngine.setDimensions(docWidth, docHeight);
    
    this.imageDataDirty = false;
    
    return this.imageData;
  }

  protected worldToImage(screenX: number, screenY: number): LassoPoint {
    const world = this.coordSystem.screenToWorld(screenX, screenY);
    return { x: world.x, y: world.y };
  }

  protected addAnchor(point: LassoPoint, strength: number = 1): void {
    const anchor: LassoAnchor = {
      point,
      strength,
      locked: strength >= this.settings.anchor.lockThreshold,
      edgeQuality: this.edgeEngine.getLocalEdgeQuality(point.x, point.y),
    };
    
    this.path.anchors.push(anchor);
    this.metrics.anchorCount = this.path.anchors.length;
    this.onMetricsUpdate?.(this.metrics);
  }

  protected findPathToPoint(target: LassoPoint): LassoPoint[] {
    const start = performance.now();
    
    const lastAnchor = this.path.anchors[this.path.anchors.length - 1];
    if (!lastAnchor) {
      return [target];
    }
    
    const pathPoints = this.pathEngine.findPath(
      lastAnchor.point,
      target,
      this.cursorTrail
    );
    
    this.metrics.pathComputeMs = performance.now() - start;
    this.onMetricsUpdate?.(this.metrics);
    
    return pathPoints;
  }

  protected commitPath(points: LassoPoint[]): void {
    this.path.points.push(...points);
    this.metrics.totalPoints = this.path.points.length;
    this.onPathChange?.(this.path);
    this.onMetricsUpdate?.(this.metrics);
  }

  protected pathToMask(path: LassoPath): SelectionMask {
    const docWidth = this.coordSystem.documentWidth;
    const docHeight = this.coordSystem.documentHeight;
    
    // Create mask data
    const maskData = new Uint8Array(docWidth * docHeight);
    
    // Use scanline fill algorithm
    const points = path.points;
    if (points.length < 3) {
      return {
        data: maskData,
        width: docWidth,
        height: docHeight,
        bounds: { x: 0, y: 0, width: 0, height: 0 },
      };
    }
    
    // Find bounds
    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;
    
    for (const p of points) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }
    
    minX = Math.max(0, Math.floor(minX));
    minY = Math.max(0, Math.floor(minY));
    maxX = Math.min(docWidth - 1, Math.ceil(maxX));
    maxY = Math.min(docHeight - 1, Math.ceil(maxY));
    
    // Scanline fill
    for (let y = minY; y <= maxY; y++) {
      const intersections: number[] = [];
      
      for (let i = 0; i < points.length; i++) {
        const p1 = points[i];
        const p2 = points[(i + 1) % points.length];
        
        if ((p1.y <= y && p2.y > y) || (p2.y <= y && p1.y > y)) {
          const x = p1.x + (y - p1.y) / (p2.y - p1.y) * (p2.x - p1.x);
          intersections.push(x);
        }
      }
      
      intersections.sort((a, b) => a - b);
      
      for (let i = 0; i < intersections.length - 1; i += 2) {
        const x1 = Math.max(minX, Math.ceil(intersections[i]));
        const x2 = Math.min(maxX, Math.floor(intersections[i + 1]));
        
        for (let x = x1; x <= x2; x++) {
          maskData[y * docWidth + x] = 255;
        }
      }
    }
    
    return {
      data: maskData,
      width: docWidth,
      height: docHeight,
      bounds: {
        x: minX,
        y: minY,
        width: maxX - minX + 1,
        height: maxY - minY + 1,
      },
    };
  }

  protected drawPath(
    ctx: CanvasRenderingContext2D,
    points: LassoPoint[],
    color: string
  ): void {
    if (points.length < 2) return;
    
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }
    
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
  }

  protected drawAnchors(ctx: CanvasRenderingContext2D): void {
    const { nodeSize, anchorColor } = this.settings.visualization;
    
    for (const anchor of this.path.anchors) {
      ctx.beginPath();
      ctx.arc(anchor.point.x, anchor.point.y, nodeSize / 2, 0, Math.PI * 2);
      
      if (this.settings.visualization.showElasticGradient && !anchor.locked) {
        // Gradient from yellow (weak) to green (locked)
        const hue = 60 + anchor.strength * 60; // 60=yellow, 120=green
        ctx.fillStyle = `hsl(${hue}, 100%, 50%)`;
      } else {
        ctx.fillStyle = anchorColor;
      }
      
      ctx.fill();
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  protected drawMetrics(ctx: CanvasRenderingContext2D): void {
    const x = 10;
    let y = 20;
    const lineHeight = 14;
    
    ctx.font = '11px monospace';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
    ctx.shadowBlur = 2;
    
    ctx.fillText(`FPS: ${this.metrics.fps.toFixed(0)}`, x, y);
    y += lineHeight;
    ctx.fillText(`Path: ${this.metrics.pathComputeMs.toFixed(1)}ms`, x, y);
    y += lineHeight;
    ctx.fillText(`Points: ${this.metrics.totalPoints}`, x, y);
    y += lineHeight;
    ctx.fillText(`Anchors: ${this.metrics.anchorCount}`, x, y);
    y += lineHeight;
    ctx.fillText(`Edge: ${(this.metrics.edgeQuality * 100).toFixed(0)}%`, x, y);
    y += lineHeight;
    ctx.fillText(`Speed: ${this.metrics.cursorSpeed.toFixed(0)}px/s`, x, y);
    
    ctx.shadowBlur = 0;
  }

  protected updateMetrics(): void {
    const cursor = this.lazyCursor;
    this.metrics.cursorSpeed = cursor.getSpeed();
    this.metrics.cursorInfluence = cursor.getCursorInfluence();
    
    const pos = cursor.getPosition();
    this.metrics.edgeQuality = this.edgeEngine.getLocalEdgeQuality(pos.x, pos.y);
  }
}
