/**
 * Photoshop-Style Auto-Anchoring Lasso
 * 
 * Hybrid auto-anchor mode based on distance and time.
 * Configurable anchor frequency.
 * Higher cursor influence for user control balance.
 */

import { BaseLassoHandler } from './BaseLassoHandler';
import type { CoordinateSystem } from '../CoordinateSystem';
import type { Layer } from '../types';
import type { LassoSettings, LassoPoint } from './types';
import { DEFAULT_LASSO_SETTINGS } from './types';

export class PhotoshopAutoLasso extends BaseLassoHandler {
  private lastAnchorTime: number = 0;
  private lastAnchorPoint: LassoPoint | null = null;
  private accumulatedDistance: number = 0;
  private lastFrameTime: number = 0;
  private frameCount: number = 0;
  private fpsUpdateTime: number = 0;

  constructor(
    coordSystem: CoordinateSystem,
    layers: Layer[],
    imageCache: Map<string, HTMLImageElement>
  ) {
    const settings: LassoSettings = {
      ...DEFAULT_LASSO_SETTINGS,
      variant: 'photoshop-auto',
      anchor: {
        ...DEFAULT_LASSO_SETTINGS.anchor,
        mode: 'hybrid',
        distanceThreshold: 25,
        timeInterval: 300,
        minMovement: 5,
      },
      pathfinding: {
        ...DEFAULT_LASSO_SETTINGS.pathfinding,
        cursorInfluence: 0.5, // Higher influence for user control
      },
      visualization: {
        ...DEFAULT_LASSO_SETTINGS.visualization,
        pathColor: '#FF4444', // Red
        nodeSize: 5, // Smaller nodes
      },
    };
    
    super(coordSystem, layers, imageCache, settings);
  }

  handleMove(screenX: number, screenY: number): void {
    // Update FPS
    const now = performance.now();
    this.frameCount++;
    if (now - this.fpsUpdateTime >= 1000) {
      this.metrics.fps = this.frameCount;
      this.frameCount = 0;
      this.fpsUpdateTime = now;
    }
    this.lastFrameTime = now;
    
    if (this.state !== 'drawing') return;
    
    this.ensureImageData();
    
    const imagePoint = this.worldToImage(screenX, screenY);
    const stablePoint = this.lazyCursor.update(imagePoint.x, imagePoint.y);
    
    // Track cursor trail
    this.cursorTrail.push(stablePoint);
    if (this.cursorTrail.length > this.settings.cursor.trajectoryLookback * 2) {
      this.cursorTrail.shift();
    }
    
    // Check for auto-anchor conditions
    this.checkAutoAnchor(stablePoint, now);
    
    // Update preview path
    this.previewPath = this.findPathToPoint(stablePoint);
    
    this.updateMetrics();
    this.onMetricsUpdate?.(this.metrics);
  }

  handleClick(screenX: number, screenY: number): void {
    const imagePoint = this.worldToImage(screenX, screenY);
    const now = performance.now();
    
    if (this.state === 'idle') {
      // Start new path
      this.state = 'drawing';
      this.lazyCursor.setPosition(imagePoint.x, imagePoint.y);
      this.addAnchor(imagePoint, 1);
      this.lastAnchorPoint = imagePoint;
      this.lastAnchorTime = now;
      this.accumulatedDistance = 0;
      this.cursorTrail = [imagePoint];
      
      this.ensureImageData();
      
    } else if (this.state === 'drawing') {
      // Force anchor at click position
      this.commitPreviewAndAnchor(imagePoint, now);
    }
    
    this.onPathChange?.(this.path);
  }

  handleDoubleClick(_screenX: number, _screenY: number): void {
    if (this.state === 'drawing' && this.path.anchors.length >= 2) {
      // Close path
      const startPoint = this.path.anchors[0].point;
      const closingPath = this.findPathToPoint(startPoint);
      this.commitPath(closingPath);
      this.complete();
    }
  }

  private checkAutoAnchor(point: LassoPoint, now: number): void {
    if (!this.lastAnchorPoint) return;
    
    // Calculate distance from last anchor
    const dx = point.x - this.lastAnchorPoint.x;
    const dy = point.y - this.lastAnchorPoint.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    // Track accumulated distance (for small movements)
    this.accumulatedDistance += distance;
    
    const timeSinceAnchor = now - this.lastAnchorTime;
    const { distanceThreshold, timeInterval, minMovement } = this.settings.anchor;
    
    // Auto-anchor conditions:
    // 1. Distance threshold exceeded
    // 2. Time threshold exceeded AND we've moved enough
    const distanceTriggered = distance >= distanceThreshold;
    const timeTriggered = timeSinceAnchor >= timeInterval && 
                         this.accumulatedDistance >= minMovement;
    
    if (distanceTriggered || timeTriggered) {
      this.commitPreviewAndAnchor(point, now);
    }
  }

  private commitPreviewAndAnchor(point: LassoPoint, now: number): void {
    if (this.previewPath.length > 0) {
      this.commitPath(this.previewPath);
    }
    
    this.addAnchor(point, 1);
    this.lastAnchorPoint = point;
    this.lastAnchorTime = now;
    this.accumulatedDistance = 0;
    this.previewPath = [];
    this.cursorTrail = [point];
  }

  /**
   * Adjust anchor frequency (0-100 scale)
   */
  setAnchorFrequency(frequency: number): void {
    // Higher frequency = lower distance threshold, shorter time
    const normalizedFreq = Math.max(0, Math.min(100, frequency)) / 100;
    
    this.updateSettings({
      anchor: {
        ...this.settings.anchor,
        distanceThreshold: 50 - normalizedFreq * 40, // 50 to 10
        timeInterval: 500 - normalizedFreq * 400, // 500 to 100
      },
    });
  }
}
