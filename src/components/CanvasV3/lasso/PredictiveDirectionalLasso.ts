/**
 * Predictive Directional Lasso
 * 
 * Movement pattern analysis for direction prediction.
 * Directional search cone with configurable angle.
 * Auto-anchor based on prediction stability.
 */

import { BaseLassoHandler } from './BaseLassoHandler';
import type { CoordinateSystem } from '../CoordinateSystem';
import type { Layer } from '../types';
import type { LassoSettings, LassoPoint } from './types';
import { DEFAULT_LASSO_SETTINGS } from './types';

interface PredictionState {
  direction: number;
  confidence: number;
  straightLineScore: number;
  curveConsistency: number;
}

export class PredictiveDirectionalLasso extends BaseLassoHandler {
  private prediction: PredictionState = {
    direction: 0,
    confidence: 0,
    straightLineScore: 0,
    curveConsistency: 0,
  };
  
  private predictionConeAngle: number = Math.PI / 4; // 45 degrees
  private predictionDistance: number = 50;
  private lastFrameTime: number = 0;
  private frameCount: number = 0;
  private fpsUpdateTime: number = 0;
  private lastAnchorDistance: number = 0;

  constructor(
    coordSystem: CoordinateSystem,
    layers: Layer[],
    imageCache: Map<string, HTMLImageElement>
  ) {
    const settings: LassoSettings = {
      ...DEFAULT_LASSO_SETTINGS,
      variant: 'predictive-directional',
      anchor: {
        ...DEFAULT_LASSO_SETTINGS.anchor,
        mode: 'predictive',
        distanceThreshold: 40,
      },
      cursor: {
        ...DEFAULT_LASSO_SETTINGS.cursor,
        trajectoryLookback: 12, // More lookback for prediction
      },
      pathfinding: {
        ...DEFAULT_LASSO_SETTINGS.pathfinding,
        cursorInfluence: 0.3,
        directionContinuity: 0.7, // Higher for direction-aware paths
      },
      visualization: {
        ...DEFAULT_LASSO_SETTINGS.visualization,
        pathColor: '#88CCFF', // Light blue
        showPredictionZone: true,
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
    
    // Update prediction
    this.updatePrediction();
    
    // Check for predictive auto-anchor
    this.checkPredictiveAnchor(stablePoint);
    
    // Find path using prediction-weighted search
    this.previewPath = this.findPredictivePath(stablePoint);
    
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
      this.lastAnchorDistance = 0;
      
      this.ensureImageData();
      
    } else if (this.state === 'drawing') {
      // Commit and anchor
      if (this.previewPath.length > 0) {
        this.commitPath(this.previewPath);
      }
      
      const stablePoint = this.lazyCursor.getPosition();
      this.addAnchor(stablePoint, 1);
      this.previewPath = [];
      this.cursorTrail = [stablePoint];
      this.lastAnchorDistance = 0;
      
      // Reset prediction
      this.prediction = {
        direction: 0,
        confidence: 0,
        straightLineScore: 0,
        curveConsistency: 0,
      };
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

  private updatePrediction(): void {
    const trajectory = this.lazyCursor.getTrajectory();
    if (trajectory.length < 3) {
      this.prediction.confidence = 0;
      return;
    }
    
    // Calculate average direction
    let sumDx = 0, sumDy = 0;
    let totalWeight = 0;
    
    for (let i = 1; i < trajectory.length; i++) {
      const weight = i / trajectory.length; // Recent points weighted more
      const dx = trajectory[i].x - trajectory[i - 1].x;
      const dy = trajectory[i].y - trajectory[i - 1].y;
      sumDx += dx * weight;
      sumDy += dy * weight;
      totalWeight += weight;
    }
    
    if (totalWeight > 0) {
      sumDx /= totalWeight;
      sumDy /= totalWeight;
    }
    
    this.prediction.direction = Math.atan2(sumDy, sumDx);
    
    // Calculate straight line score
    // How well do points fit a line?
    const first = trajectory[0];
    const last = trajectory[trajectory.length - 1];
    const lineLength = Math.sqrt(
      Math.pow(last.x - first.x, 2) + Math.pow(last.y - first.y, 2)
    );
    
    let pathLength = 0;
    for (let i = 1; i < trajectory.length; i++) {
      const dx = trajectory[i].x - trajectory[i - 1].x;
      const dy = trajectory[i].y - trajectory[i - 1].y;
      pathLength += Math.sqrt(dx * dx + dy * dy);
    }
    
    this.prediction.straightLineScore = lineLength / Math.max(pathLength, 1);
    
    // Calculate curve consistency
    // How consistent is the turning direction?
    let turnSum = 0;
    let turnCount = 0;
    
    for (let i = 2; i < trajectory.length; i++) {
      const dx1 = trajectory[i - 1].x - trajectory[i - 2].x;
      const dy1 = trajectory[i - 1].y - trajectory[i - 2].y;
      const dx2 = trajectory[i].x - trajectory[i - 1].x;
      const dy2 = trajectory[i].y - trajectory[i - 1].y;
      
      const angle1 = Math.atan2(dy1, dx1);
      const angle2 = Math.atan2(dy2, dx2);
      let turn = angle2 - angle1;
      
      // Normalize to -PI to PI
      while (turn > Math.PI) turn -= 2 * Math.PI;
      while (turn < -Math.PI) turn += 2 * Math.PI;
      
      turnSum += turn;
      turnCount++;
    }
    
    if (turnCount > 0) {
      const avgTurn = turnSum / turnCount;
      // Consistency is higher when all turns are in the same direction
      this.prediction.curveConsistency = 1 - Math.min(Math.abs(avgTurn) / Math.PI, 1);
    }
    
    // Overall confidence
    this.prediction.confidence = 
      (this.prediction.straightLineScore * 0.5 + 
       this.prediction.curveConsistency * 0.5) *
      Math.min(trajectory.length / this.settings.cursor.trajectoryLookback, 1);
  }

  private checkPredictiveAnchor(point: LassoPoint): void {
    const lastAnchor = this.path.anchors[this.path.anchors.length - 1];
    if (!lastAnchor) return;
    
    // Distance from last anchor
    const dx = point.x - lastAnchor.point.x;
    const dy = point.y - lastAnchor.point.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    this.lastAnchorDistance = distance;
    
    // Auto-anchor when prediction confidence drops
    // OR when we've traveled far enough
    const confidenceThreshold = 0.5;
    const distanceThreshold = this.settings.anchor.distanceThreshold;
    
    const confidenceDropped = 
      this.prediction.confidence < confidenceThreshold && 
      distance > distanceThreshold * 0.5;
    
    const distanceExceeded = distance >= distanceThreshold;
    
    if (confidenceDropped || distanceExceeded) {
      if (this.previewPath.length > 0) {
        this.commitPath(this.previewPath);
      }
      this.addAnchor(point, 1);
      this.previewPath = [];
      this.cursorTrail = [point];
      this.lastAnchorDistance = 0;
    }
  }

  private findPredictivePath(target: LassoPoint): LassoPoint[] {
    const lastAnchor = this.path.anchors[this.path.anchors.length - 1];
    if (!lastAnchor) return [];
    
    // If high confidence in straight line, extend search forward
    if (this.prediction.straightLineScore > 0.8 && this.prediction.confidence > 0.6) {
      // Project target point further in the prediction direction
      const extendDist = this.predictionDistance * this.prediction.confidence;
      const extendedTarget: LassoPoint = {
        x: target.x + Math.cos(this.prediction.direction) * extendDist,
        y: target.y + Math.sin(this.prediction.direction) * extendDist,
      };
      
      // Find path to extended target then trim
      const extendedPath = this.pathEngine.findPath(
        lastAnchor.point, 
        extendedTarget,
        this.cursorTrail
      );
      
      // Trim to actual target
      return this.trimPathToPoint(extendedPath, target);
    }
    
    // Standard path finding
    return this.pathEngine.findPath(lastAnchor.point, target, this.cursorTrail);
  }

  private trimPathToPoint(path: LassoPoint[], target: LassoPoint): LassoPoint[] {
    // Find closest point in path to target
    let closestIdx = 0;
    let closestDist = Infinity;
    
    for (let i = 0; i < path.length; i++) {
      const dx = path[i].x - target.x;
      const dy = path[i].y - target.y;
      const dist = dx * dx + dy * dy;
      if (dist < closestDist) {
        closestDist = dist;
        closestIdx = i;
      }
    }
    
    return path.slice(0, closestIdx + 1);
  }

  // Override draw to add prediction visualization
  draw(ctx: CanvasRenderingContext2D): void {
    super.draw(ctx);
    
    if (this.state !== 'drawing' || !this.settings.visualization.showPredictionZone) return;
    
    const pos = this.lazyCursor.getPosition();
    const confidence = this.prediction.confidence;
    
    if (confidence < 0.2) return;
    
    ctx.save();
    
    // Draw prediction cone
    const coneLength = this.predictionDistance * confidence;
    const coneAngle = this.predictionConeAngle * (1 - confidence * 0.5);
    
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    
    const leftAngle = this.prediction.direction - coneAngle;
    const rightAngle = this.prediction.direction + coneAngle;
    
    ctx.lineTo(
      pos.x + Math.cos(leftAngle) * coneLength,
      pos.y + Math.sin(leftAngle) * coneLength
    );
    ctx.arc(pos.x, pos.y, coneLength, leftAngle, rightAngle);
    ctx.lineTo(pos.x, pos.y);
    
    ctx.fillStyle = `rgba(255, 150, 0, ${confidence * 0.3})`; // Orange
    ctx.fill();
    ctx.strokeStyle = `rgba(255, 150, 0, ${confidence * 0.6})`;
    ctx.lineWidth = 1;
    ctx.stroke();
    
    // Draw direction arrow
    const arrowLength = 30 * confidence;
    const arrowX = pos.x + Math.cos(this.prediction.direction) * arrowLength;
    const arrowY = pos.y + Math.sin(this.prediction.direction) * arrowLength;
    
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    ctx.lineTo(arrowX, arrowY);
    ctx.strokeStyle = 'rgba(255, 200, 0, 0.8)';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Arrowhead
    const headSize = 8;
    const headAngle = Math.PI / 6;
    ctx.beginPath();
    ctx.moveTo(arrowX, arrowY);
    ctx.lineTo(
      arrowX - Math.cos(this.prediction.direction - headAngle) * headSize,
      arrowY - Math.sin(this.prediction.direction - headAngle) * headSize
    );
    ctx.moveTo(arrowX, arrowY);
    ctx.lineTo(
      arrowX - Math.cos(this.prediction.direction + headAngle) * headSize,
      arrowY - Math.sin(this.prediction.direction + headAngle) * headSize
    );
    ctx.stroke();
    
    ctx.restore();
  }

  getPrediction(): PredictionState {
    return { ...this.prediction };
  }

  setConeAngle(radians: number): void {
    this.predictionConeAngle = Math.max(0.1, Math.min(Math.PI / 2, radians));
  }

  setPredictionDistance(pixels: number): void {
    this.predictionDistance = Math.max(20, Math.min(150, pixels));
  }
}
