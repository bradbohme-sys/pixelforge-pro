/**
 * Classic Dijkstra Lasso (Intelligent Scissors)
 * 
 * Pure edge-following with Dijkstra pathfinding.
 * Manual anchor placement on click.
 * Low cursor influence for maximum edge adherence.
 */

import { BaseLassoHandler, LassoState } from './BaseLassoHandler';
import type { CoordinateSystem } from '../CoordinateSystem';
import type { Layer } from '../types';
import type { LassoSettings, LassoPoint } from './types';
import { DEFAULT_LASSO_SETTINGS } from './types';

export class ClassicDijkstraLasso extends BaseLassoHandler {
  private lastFrameTime: number = 0;
  private frameCount: number = 0;
  private fpsUpdateTime: number = 0;

  constructor(
    coordSystem: CoordinateSystem,
    layers: Layer[],
    imageCache: Map<string, HTMLImageElement>
  ) {
    // Classic variant uses low cursor influence
    const settings: LassoSettings = {
      ...DEFAULT_LASSO_SETTINGS,
      variant: 'classic-dijkstra',
      anchor: {
        ...DEFAULT_LASSO_SETTINGS.anchor,
        mode: 'manual',
      },
      pathfinding: {
        ...DEFAULT_LASSO_SETTINGS.pathfinding,
        cursorInfluence: 0.1, // Low influence for edge adherence
      },
      visualization: {
        ...DEFAULT_LASSO_SETTINGS.visualization,
        pathColor: '#00FFFF', // Cyan
        anchorColor: '#FFFFFF',
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
    
    // Ensure edge data is ready
    this.ensureImageData();
    
    // Update lazy cursor
    const imagePoint = this.worldToImage(screenX, screenY);
    const stablePoint = this.lazyCursor.update(imagePoint.x, imagePoint.y);
    
    // Track cursor trail for pathfinding
    this.cursorTrail.push(stablePoint);
    if (this.cursorTrail.length > this.settings.cursor.trajectoryLookback * 2) {
      this.cursorTrail.shift();
    }
    
    // Find preview path from last anchor to cursor
    this.previewPath = this.findPathToPoint(stablePoint);
    
    // Update metrics
    this.updateMetrics();
    this.onMetricsUpdate?.(this.metrics);
  }

  handleClick(screenX: number, screenY: number): void {
    const imagePoint = this.worldToImage(screenX, screenY);
    
    if (this.state === 'idle') {
      // Start new path
      this.state = 'drawing';
      this.lazyCursor.setPosition(imagePoint.x, imagePoint.y);
      this.addAnchor(imagePoint, 1);
      this.cursorTrail = [imagePoint];
      
      // Ensure edge detection is done
      this.ensureImageData();
      
    } else if (this.state === 'drawing') {
      // Commit current preview path and add anchor
      if (this.previewPath.length > 0) {
        this.commitPath(this.previewPath);
      }
      
      const stablePoint = this.lazyCursor.getPosition();
      this.addAnchor(stablePoint, 1);
      this.previewPath = [];
      this.cursorTrail = [stablePoint];
    }
    
    this.onPathChange?.(this.path);
  }

  handleDoubleClick(_screenX: number, _screenY: number): void {
    if (this.state === 'drawing') {
      // Complete the path
      if (this.path.anchors.length >= 2) {
        // Find path back to start
        const startPoint = this.path.anchors[0].point;
        const closingPath = this.findPathToPoint(startPoint);
        this.commitPath(closingPath);
      }
      
      this.complete();
    }
  }

  /**
   * Undo last anchor
   */
  undoLastAnchor(): void {
    if (this.path.anchors.length <= 1) {
      this.cancel();
      return;
    }
    
    // Remove last anchor
    const removedAnchor = this.path.anchors.pop();
    this.metrics.anchorCount = this.path.anchors.length;
    
    // Remove points back to previous anchor
    if (removedAnchor && this.path.anchors.length > 0) {
      const prevAnchor = this.path.anchors[this.path.anchors.length - 1];
      
      // Find index where path splits
      let splitIndex = this.path.points.length;
      for (let i = this.path.points.length - 1; i >= 0; i--) {
        const p = this.path.points[i];
        if (Math.abs(p.x - prevAnchor.point.x) < 1 && 
            Math.abs(p.y - prevAnchor.point.y) < 1) {
          splitIndex = i + 1;
          break;
        }
      }
      
      this.path.points = this.path.points.slice(0, splitIndex);
      this.metrics.totalPoints = this.path.points.length;
    }
    
    // Reset cursor to last anchor position
    const lastAnchor = this.path.anchors[this.path.anchors.length - 1];
    if (lastAnchor) {
      this.lazyCursor.setPosition(lastAnchor.point.x, lastAnchor.point.y);
    }
    
    this.previewPath = [];
    this.onPathChange?.(this.path);
    this.onMetricsUpdate?.(this.metrics);
  }
}
