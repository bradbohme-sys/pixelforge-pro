/**
 * Lazy Cursor Stabilization
 * 
 * Implements a "lazy" cursor that creates a dead zone,
 * only moving when pushed by the outer cursor circle.
 */

import type { LassoPoint, CursorSettings } from './types';

export class LazyCursor {
  private settings: CursorSettings;
  private outerPosition: LassoPoint = { x: 0, y: 0 };
  private innerPosition: LassoPoint = { x: 0, y: 0 };
  private trajectory: LassoPoint[] = [];
  private lastUpdateTime: number = 0;
  private speed: number = 0;

  constructor(settings: CursorSettings) {
    this.settings = settings;
  }

  updateSettings(settings: Partial<CursorSettings>): void {
    this.settings = { ...this.settings, ...settings };
  }

  /**
   * Update cursor with new mouse position
   */
  update(mouseX: number, mouseY: number): LassoPoint {
    const now = performance.now();
    const dt = now - this.lastUpdateTime;
    
    // Update outer position (follows mouse exactly)
    const prevOuter = { ...this.outerPosition };
    this.outerPosition = { x: mouseX, y: mouseY };
    
    // Calculate speed
    if (dt > 0) {
      const dx = mouseX - prevOuter.x;
      const dy = mouseY - prevOuter.y;
      this.speed = Math.sqrt(dx * dx + dy * dy) / dt * 1000; // pixels/second
    }
    
    // Calculate distance from inner to outer
    const dx = this.outerPosition.x - this.innerPosition.x;
    const dy = this.outerPosition.y - this.innerPosition.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    // Only move inner if outside the dead zone radius
    if (distance > this.settings.radius) {
      // Calculate how much to move
      const excess = distance - this.settings.radius;
      const moveAmount = excess * this.settings.smoothingFactor;
      
      // Normalize direction
      const nx = dx / distance;
      const ny = dy / distance;
      
      // Move inner position
      this.innerPosition = {
        x: this.innerPosition.x + nx * moveAmount,
        y: this.innerPosition.y + ny * moveAmount,
        timestamp: now,
      };
    }
    
    // Update trajectory
    this.trajectory.push({ ...this.innerPosition, timestamp: now });
    
    // Keep only recent trajectory points
    while (this.trajectory.length > this.settings.trajectoryLookback) {
      this.trajectory.shift();
    }
    
    this.lastUpdateTime = now;
    
    return this.innerPosition;
  }

  /**
   * Set position directly (for initialization or teleport)
   */
  setPosition(x: number, y: number): void {
    this.outerPosition = { x, y };
    this.innerPosition = { x, y };
    this.trajectory = [{ x, y, timestamp: performance.now() }];
  }

  /**
   * Get the stabilized cursor position
   */
  getPosition(): LassoPoint {
    return { ...this.innerPosition };
  }

  /**
   * Get the actual mouse position
   */
  getOuterPosition(): LassoPoint {
    return { ...this.outerPosition };
  }

  /**
   * Get recent trajectory for direction analysis
   */
  getTrajectory(): LassoPoint[] {
    return [...this.trajectory];
  }

  /**
   * Get current cursor speed
   */
  getSpeed(): number {
    return this.speed;
  }

  /**
   * Check if cursor is in "break free" mode
   * (user pulled away from edges quickly)
   */
  isBreakingFree(): boolean {
    const dx = this.outerPosition.x - this.innerPosition.x;
    const dy = this.outerPosition.y - this.innerPosition.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    // Break free when distance is more than 2x the radius and moving fast
    return distance > this.settings.radius * 2 && this.speed > 200;
  }

  /**
   * Get movement direction (average from trajectory)
   */
  getMovementDirection(): number {
    if (this.trajectory.length < 2) return 0;
    
    let sumX = 0, sumY = 0;
    
    for (let i = 1; i < this.trajectory.length; i++) {
      sumX += this.trajectory[i].x - this.trajectory[i - 1].x;
      sumY += this.trajectory[i].y - this.trajectory[i - 1].y;
    }
    
    return Math.atan2(sumY, sumX);
  }

  /**
   * Get cursor influence factor (0-1)
   * Higher when user is pulling hard against the edge
   */
  getCursorInfluence(): number {
    const dx = this.outerPosition.x - this.innerPosition.x;
    const dy = this.outerPosition.y - this.innerPosition.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    // Normalize to 0-1 range based on radius
    return Math.min(distance / (this.settings.radius * 2), 1);
  }

  /**
   * Draw cursor visualization
   */
  draw(ctx: CanvasRenderingContext2D): void {
    const { outerPosition, innerPosition } = this;
    
    // Draw outer circle (follows mouse)
    ctx.beginPath();
    ctx.arc(outerPosition.x, outerPosition.y, this.settings.radius, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 1;
    ctx.stroke();
    
    // Draw inner node (stabilized)
    ctx.beginPath();
    ctx.arc(innerPosition.x, innerPosition.y, 4, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 255, 255, 0.8)';
    ctx.fill();
    
    // Draw connection line
    ctx.beginPath();
    ctx.moveTo(outerPosition.x, outerPosition.y);
    ctx.lineTo(innerPosition.x, innerPosition.y);
    ctx.strokeStyle = 'rgba(0, 255, 255, 0.3)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}
