/**
 * Elastic Progressive Anchoring Lasso
 * 
 * Progressive anchor strength system (0.0 to 1.0).
 * Nodes start weak and strengthen over time/distance.
 * Rubber-band correction for recent path.
 */

import { BaseLassoHandler } from './BaseLassoHandler';
import type { CoordinateSystem } from '../CoordinateSystem';
import type { Layer } from '../types';
import type { LassoSettings, LassoPoint, LassoAnchor } from './types';
import { DEFAULT_LASSO_SETTINGS } from './types';

export class ElasticProgressiveLasso extends BaseLassoHandler {
  private elasticZone: LassoAnchor[] = [];
  private edgeTrailPoint: LassoPoint | null = null;
  private lastFrameTime: number = 0;
  private frameCount: number = 0;
  private fpsUpdateTime: number = 0;
  private lastMoveTime: number = 0;

  constructor(
    coordSystem: CoordinateSystem,
    layers: Layer[],
    imageCache: Map<string, HTMLImageElement>
  ) {
    const settings: LassoSettings = {
      ...DEFAULT_LASSO_SETTINGS,
      variant: 'elastic-progressive',
      anchor: {
        ...DEFAULT_LASSO_SETTINGS.anchor,
        mode: 'elastic',
        elasticZoneLength: 60,
        strengthCurve: 'ease-in-out',
        lockThreshold: 0.85,
      },
      pathfinding: {
        ...DEFAULT_LASSO_SETTINGS.pathfinding,
        cursorInfluence: 0.4,
      },
      visualization: {
        ...DEFAULT_LASSO_SETTINGS.visualization,
        pathColor: '#44FF44', // Green
        showElasticGradient: true,
        showEdgeTrail: true,
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
    
    // Update elastic zone strengths
    this.updateElasticStrengths(now);
    
    // Check for edge quality degradation (edge trail point)
    this.updateEdgeTrailPoint(stablePoint);
    
    // Progressive anchor: add weak anchor when moved far enough
    this.checkProgressiveAnchor(stablePoint, now);
    
    // Update preview with rubber-banding from elastic zone
    this.previewPath = this.findElasticPath(stablePoint);
    
    this.lastMoveTime = now;
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
      this.addProgressiveAnchor(imagePoint, 0.3); // Start with moderate strength
      this.cursorTrail = [imagePoint];
      this.lastMoveTime = now;
      
      this.ensureImageData();
      
    } else if (this.state === 'drawing') {
      // Click locks all elastic anchors and adds strong anchor
      this.lockElasticAnchors();
      this.commitElasticPath();
      this.addProgressiveAnchor(imagePoint, 1.0); // Full strength at click
    }
    
    this.onPathChange?.(this.path);
  }

  handleDoubleClick(_screenX: number, _screenY: number): void {
    if (this.state === 'drawing' && this.path.anchors.length >= 2) {
      this.lockElasticAnchors();
      this.commitElasticPath();
      
      // Close path
      const startPoint = this.path.anchors[0].point;
      const closingPath = this.findPathToPoint(startPoint);
      this.commitPath(closingPath);
      this.complete();
    }
  }

  private addProgressiveAnchor(point: LassoPoint, initialStrength: number): void {
    const anchor: LassoAnchor = {
      point,
      strength: initialStrength,
      locked: initialStrength >= this.settings.anchor.lockThreshold,
      edgeQuality: this.edgeEngine.getLocalEdgeQuality(point.x, point.y),
    };
    
    this.path.anchors.push(anchor);
    this.elasticZone.push(anchor);
    this.metrics.anchorCount = this.path.anchors.length;
  }

  private updateElasticStrengths(now: number): void {
    const dt = now - this.lastMoveTime;
    const { strengthCurve, lockThreshold } = this.settings.anchor;
    
    // Strength increase rate (per second)
    const strengthRate = 0.3;
    
    for (const anchor of this.elasticZone) {
      if (anchor.locked) continue;
      
      // Increase strength over time
      let increase = strengthRate * (dt / 1000);
      
      // Apply curve
      switch (strengthCurve) {
        case 'exponential':
          increase *= 1 + anchor.strength; // Faster as it gets stronger
          break;
        case 'ease-in-out':
          // Slow at start and end, fast in middle
          const t = anchor.strength;
          const curveMultiplier = Math.sin(t * Math.PI);
          increase *= 0.5 + curveMultiplier * 0.5;
          break;
        // 'linear' uses default increase
      }
      
      anchor.strength = Math.min(anchor.strength + increase, 1);
      
      // Check for lock
      if (anchor.strength >= lockThreshold) {
        anchor.locked = true;
      }
    }
  }

  private updateEdgeTrailPoint(currentPoint: LassoPoint): void {
    // Edge trail shows where edge quality starts to degrade
    const quality = this.edgeEngine.getLocalEdgeQuality(currentPoint.x, currentPoint.y);
    
    // Threshold for "good" edge quality
    const qualityThreshold = 0.3;
    
    if (quality < qualityThreshold && !this.edgeTrailPoint) {
      // Record where quality dropped
      const lastGoodAnchor = [...this.elasticZone]
        .reverse()
        .find(a => a.edgeQuality >= qualityThreshold);
      
      if (lastGoodAnchor) {
        this.edgeTrailPoint = lastGoodAnchor.point;
      }
    } else if (quality >= qualityThreshold) {
      this.edgeTrailPoint = null;
    }
  }

  private checkProgressiveAnchor(point: LassoPoint, _now: number): void {
    const lastAnchor = this.elasticZone[this.elasticZone.length - 1];
    if (!lastAnchor) return;
    
    // Distance check
    const dx = point.x - lastAnchor.point.x;
    const dy = point.y - lastAnchor.point.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    // Add anchor at intervals within elastic zone
    const anchorSpacing = this.settings.anchor.distanceThreshold;
    
    if (distance >= anchorSpacing) {
      // Strength based on position in elastic zone
      const zonePosition = this.elasticZone.length / 
        (this.settings.anchor.elasticZoneLength / anchorSpacing);
      const initialStrength = Math.min(0.2 + zonePosition * 0.1, 0.5);
      
      this.addProgressiveAnchor(point, initialStrength);
      
      // Trim elastic zone to max length
      this.trimElasticZone();
    }
  }

  private trimElasticZone(): void {
    const maxAnchors = Math.ceil(
      this.settings.anchor.elasticZoneLength / this.settings.anchor.distanceThreshold
    );
    
    while (this.elasticZone.length > maxAnchors) {
      const removed = this.elasticZone.shift();
      if (removed) {
        removed.locked = true; // Lock when leaving elastic zone
      }
    }
  }

  private lockElasticAnchors(): void {
    for (const anchor of this.elasticZone) {
      anchor.locked = true;
      anchor.strength = 1;
    }
  }

  private commitElasticPath(): void {
    // Commit path through all elastic anchors
    for (let i = 1; i < this.elasticZone.length; i++) {
      const from = this.elasticZone[i - 1];
      const to = this.elasticZone[i];
      const pathSegment = this.pathEngine.findPath(from.point, to.point);
      this.commitPath(pathSegment);
    }
    
    this.elasticZone = [];
    this.previewPath = [];
  }

  private findElasticPath(target: LassoPoint): LassoPoint[] {
    if (this.elasticZone.length === 0) {
      return [];
    }
    
    // Rubber-band: recalculate path from earliest unlocked anchor
    const firstUnlocked = this.elasticZone.find(a => !a.locked);
    const startAnchor = firstUnlocked || this.elasticZone[this.elasticZone.length - 1];
    
    return this.pathEngine.findPath(startAnchor.point, target, this.cursorTrail);
  }

  // Override draw to add elastic visualization
  draw(ctx: CanvasRenderingContext2D): void {
    super.draw(ctx);
    
    if (this.state !== 'drawing') return;
    
    ctx.save();
    
    // Draw elastic gradient on path
    if (this.settings.visualization.showElasticGradient && this.elasticZone.length > 1) {
      for (let i = 1; i < this.elasticZone.length; i++) {
        const from = this.elasticZone[i - 1];
        const to = this.elasticZone[i];
        
        // Gradient from yellow (weak) to green (strong)
        const avgStrength = (from.strength + to.strength) / 2;
        const hue = 60 + avgStrength * 60; // 60=yellow, 120=green
        
        ctx.beginPath();
        ctx.moveTo(from.point.x, from.point.y);
        ctx.lineTo(to.point.x, to.point.y);
        ctx.strokeStyle = `hsl(${hue}, 100%, 50%)`;
        ctx.lineWidth = 3;
        ctx.stroke();
      }
    }
    
    // Draw edge trail point
    if (this.settings.visualization.showEdgeTrail && this.edgeTrailPoint) {
      ctx.beginPath();
      ctx.arc(this.edgeTrailPoint.x, this.edgeTrailPoint.y, 8, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 200, 0, 0.8)'; // Golden
      ctx.fill();
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    
    ctx.restore();
  }
}
