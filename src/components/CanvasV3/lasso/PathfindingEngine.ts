/**
 * Pathfinding Engine
 * 
 * Implements Dijkstra and A* algorithms for finding
 * optimal paths along edges.
 */

import type { LassoPoint, PathfindingSettings } from './types';
import type { EdgeDetectionEngine } from './EdgeDetectionEngine';

interface PathNode {
  x: number;
  y: number;
  cost: number;
  parent: PathNode | null;
  direction: number; // Angle of incoming direction
}

// Min-heap priority queue
class MinHeap {
  private heap: PathNode[] = [];

  push(node: PathNode): void {
    this.heap.push(node);
    this.bubbleUp(this.heap.length - 1);
  }

  pop(): PathNode | undefined {
    if (this.heap.length === 0) return undefined;
    
    const min = this.heap[0];
    const last = this.heap.pop()!;
    
    if (this.heap.length > 0) {
      this.heap[0] = last;
      this.bubbleDown(0);
    }
    
    return min;
  }

  isEmpty(): boolean {
    return this.heap.length === 0;
  }

  private bubbleUp(index: number): void {
    while (index > 0) {
      const parentIdx = Math.floor((index - 1) / 2);
      if (this.heap[parentIdx].cost <= this.heap[index].cost) break;
      [this.heap[parentIdx], this.heap[index]] = [this.heap[index], this.heap[parentIdx]];
      index = parentIdx;
    }
  }

  private bubbleDown(index: number): void {
    while (true) {
      const left = 2 * index + 1;
      const right = 2 * index + 2;
      let smallest = index;
      
      if (left < this.heap.length && this.heap[left].cost < this.heap[smallest].cost) {
        smallest = left;
      }
      if (right < this.heap.length && this.heap[right].cost < this.heap[smallest].cost) {
        smallest = right;
      }
      
      if (smallest === index) break;
      
      [this.heap[smallest], this.heap[index]] = [this.heap[index], this.heap[smallest]];
      index = smallest;
    }
  }
}

export class PathfindingEngine {
  private edgeEngine: EdgeDetectionEngine;
  private settings: PathfindingSettings;
  private width: number = 0;
  private height: number = 0;

  constructor(edgeEngine: EdgeDetectionEngine, settings: PathfindingSettings) {
    this.edgeEngine = edgeEngine;
    this.settings = settings;
  }

  updateSettings(settings: Partial<PathfindingSettings>): void {
    this.settings = { ...this.settings, ...settings };
  }

  setDimensions(width: number, height: number): void {
    this.width = width;
    this.height = height;
  }

  /**
   * Find optimal path between two points
   */
  findPath(
    start: LassoPoint,
    end: LassoPoint,
    cursorPath?: LassoPoint[]
  ): LassoPoint[] {
    if (this.settings.algorithm === 'astar') {
      return this.astarSearch(start, end, cursorPath);
    }
    return this.dijkstraSearch(start, end, cursorPath);
  }

  /**
   * Dijkstra's algorithm for shortest path
   */
  private dijkstraSearch(
    start: LassoPoint,
    end: LassoPoint,
    cursorPath?: LassoPoint[]
  ): LassoPoint[] {
    const startX = Math.round(start.x);
    const startY = Math.round(start.y);
    const endX = Math.round(end.x);
    const endY = Math.round(end.y);
    
    const visited = new Set<string>();
    const heap = new MinHeap();
    
    heap.push({
      x: startX,
      y: startY,
      cost: 0,
      parent: null,
      direction: Math.atan2(endY - startY, endX - startX),
    });
    
    const maxIterations = this.width * this.height;
    let iterations = 0;
    
    while (!heap.isEmpty() && iterations < maxIterations) {
      iterations++;
      
      const current = heap.pop()!;
      const key = `${current.x},${current.y}`;
      
      if (visited.has(key)) continue;
      visited.add(key);
      
      // Found the end
      if (current.x === endX && current.y === endY) {
        return this.reconstructPath(current);
      }
      
      // Explore neighbors
      const neighbors = this.getNeighbors(current.x, current.y);
      
      for (const [nx, ny] of neighbors) {
        const nkey = `${nx},${ny}`;
        if (visited.has(nkey)) continue;
        
        const moveCost = this.calculateMoveCost(
          current.x, current.y,
          nx, ny,
          current.direction,
          cursorPath
        );
        
        const newCost = current.cost + moveCost;
        const direction = Math.atan2(ny - current.y, nx - current.x);
        
        heap.push({
          x: nx,
          y: ny,
          cost: newCost,
          parent: current,
          direction,
        });
      }
    }
    
    // No path found, return straight line
    return this.straightLine(start, end);
  }

  /**
   * A* algorithm with heuristic
   */
  private astarSearch(
    start: LassoPoint,
    end: LassoPoint,
    cursorPath?: LassoPoint[]
  ): LassoPoint[] {
    const startX = Math.round(start.x);
    const startY = Math.round(start.y);
    const endX = Math.round(end.x);
    const endY = Math.round(end.y);
    
    const visited = new Set<string>();
    const gScore = new Map<string, number>();
    const heap = new MinHeap();
    
    const startKey = `${startX},${startY}`;
    gScore.set(startKey, 0);
    
    heap.push({
      x: startX,
      y: startY,
      cost: this.heuristic(startX, startY, endX, endY),
      parent: null,
      direction: Math.atan2(endY - startY, endX - startX),
    });
    
    const maxIterations = this.width * this.height;
    let iterations = 0;
    
    while (!heap.isEmpty() && iterations < maxIterations) {
      iterations++;
      
      const current = heap.pop()!;
      const key = `${current.x},${current.y}`;
      
      if (current.x === endX && current.y === endY) {
        return this.reconstructPath(current);
      }
      
      if (visited.has(key)) continue;
      visited.add(key);
      
      const neighbors = this.getNeighbors(current.x, current.y);
      
      for (const [nx, ny] of neighbors) {
        const nkey = `${nx},${ny}`;
        if (visited.has(nkey)) continue;
        
        const moveCost = this.calculateMoveCost(
          current.x, current.y,
          nx, ny,
          current.direction,
          cursorPath
        );
        
        const tentativeG = (gScore.get(key) ?? Infinity) + moveCost;
        
        if (tentativeG < (gScore.get(nkey) ?? Infinity)) {
          gScore.set(nkey, tentativeG);
          const f = tentativeG + this.heuristic(nx, ny, endX, endY);
          const direction = Math.atan2(ny - current.y, nx - current.x);
          
          heap.push({
            x: nx,
            y: ny,
            cost: f,
            parent: current,
            direction,
          });
        }
      }
    }
    
    return this.straightLine(start, end);
  }

  /**
   * Calculate cost of moving to a cell
   */
  private calculateMoveCost(
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    prevDirection: number,
    cursorPath?: LassoPoint[]
  ): number {
    // Base cost: edge cost (lower for stronger edges)
    const edgeCost = this.edgeEngine.getEdgeCost(toX, toY);
    
    // Distance cost (diagonal is sqrt(2))
    const dx = toX - fromX;
    const dy = toY - fromY;
    const distCost = Math.sqrt(dx * dx + dy * dy);
    
    // Direction continuity cost
    const newDirection = Math.atan2(dy, dx);
    let angleDiff = Math.abs(newDirection - prevDirection);
    if (angleDiff > Math.PI) angleDiff = 2 * Math.PI - angleDiff;
    const directionCost = (angleDiff / Math.PI) * this.settings.directionContinuity;
    
    // Cursor influence: reduce cost near cursor path
    let cursorCost = 0;
    if (cursorPath && cursorPath.length > 0 && this.settings.cursorInfluence > 0) {
      const minDistToCursor = this.minDistanceToPath(toX, toY, cursorPath);
      cursorCost = -this.settings.cursorInfluence * Math.exp(-minDistToCursor / 10);
    }
    
    return edgeCost * distCost + directionCost + cursorCost;
  }

  /**
   * Get valid neighbors based on connectivity
   */
  private getNeighbors(x: number, y: number): [number, number][] {
    const neighbors: [number, number][] = [];
    
    // 4-connected (cardinal directions)
    const cardinal: [number, number][] = [
      [x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]
    ];
    
    for (const [nx, ny] of cardinal) {
      if (nx >= 0 && nx < this.width && ny >= 0 && ny < this.height) {
        neighbors.push([nx, ny]);
      }
    }
    
    // 8-connected (add diagonals)
    if (this.settings.connectivity === 8) {
      const diagonal: [number, number][] = [
        [x - 1, y - 1], [x + 1, y - 1], [x - 1, y + 1], [x + 1, y + 1]
      ];
      
      for (const [nx, ny] of diagonal) {
        if (nx >= 0 && nx < this.width && ny >= 0 && ny < this.height) {
          neighbors.push([nx, ny]);
        }
      }
    }
    
    return neighbors;
  }

  /**
   * Euclidean heuristic for A*
   */
  private heuristic(x1: number, y1: number, x2: number, y2: number): number {
    const dx = x2 - x1;
    const dy = y2 - y1;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Reconstruct path from end node
   */
  private reconstructPath(endNode: PathNode): LassoPoint[] {
    const path: LassoPoint[] = [];
    let current: PathNode | null = endNode;
    
    while (current) {
      path.unshift({
        x: current.x,
        y: current.y,
        edgeStrength: this.edgeEngine.getEdgeStrength(current.x, current.y),
      });
      current = current.parent;
    }
    
    return path;
  }

  /**
   * Generate straight line path
   */
  private straightLine(start: LassoPoint, end: LassoPoint): LassoPoint[] {
    const path: LassoPoint[] = [];
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const steps = Math.max(Math.abs(dx), Math.abs(dy));
    
    for (let i = 0; i <= steps; i++) {
      const t = steps === 0 ? 0 : i / steps;
      path.push({
        x: start.x + dx * t,
        y: start.y + dy * t,
      });
    }
    
    return path;
  }

  /**
   * Minimum distance from point to path
   */
  private minDistanceToPath(x: number, y: number, path: LassoPoint[]): number {
    let minDist = Infinity;
    
    for (const p of path) {
      const dx = x - p.x;
      const dy = y - p.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < minDist) minDist = dist;
    }
    
    return minDist;
  }

  // ============================================
  // PATH UTILITIES
  // ============================================

  /**
   * Simplify path using Ramer-Douglas-Peucker algorithm
   */
  simplifyPath(path: LassoPoint[], epsilon: number = 1): LassoPoint[] {
    if (path.length <= 2) return path;
    
    // Find point with maximum distance from line
    let maxDist = 0;
    let maxIndex = 0;
    
    const start = path[0];
    const end = path[path.length - 1];
    
    for (let i = 1; i < path.length - 1; i++) {
      const dist = this.perpendicularDistance(path[i], start, end);
      if (dist > maxDist) {
        maxDist = dist;
        maxIndex = i;
      }
    }
    
    // If max distance is greater than epsilon, recursively simplify
    if (maxDist > epsilon) {
      const left = this.simplifyPath(path.slice(0, maxIndex + 1), epsilon);
      const right = this.simplifyPath(path.slice(maxIndex), epsilon);
      
      return [...left.slice(0, -1), ...right];
    }
    
    return [start, end];
  }

  /**
   * Smooth path using averaging
   */
  smoothPath(path: LassoPoint[], iterations: number = 2): LassoPoint[] {
    let result = [...path];
    
    for (let iter = 0; iter < iterations; iter++) {
      const smoothed: LassoPoint[] = [result[0]]; // Keep first point
      
      for (let i = 1; i < result.length - 1; i++) {
        const prev = result[i - 1];
        const curr = result[i];
        const next = result[i + 1];
        
        smoothed.push({
          x: (prev.x + curr.x + next.x) / 3,
          y: (prev.y + curr.y + next.y) / 3,
          edgeStrength: curr.edgeStrength,
        });
      }
      
      smoothed.push(result[result.length - 1]); // Keep last point
      result = smoothed;
    }
    
    return result;
  }

  /**
   * Apply Chaikin's corner cutting
   */
  chaikinSmooth(path: LassoPoint[], iterations: number = 2): LassoPoint[] {
    let result = [...path];
    
    for (let iter = 0; iter < iterations; iter++) {
      const smoothed: LassoPoint[] = [result[0]]; // Keep first point
      
      for (let i = 0; i < result.length - 1; i++) {
        const p0 = result[i];
        const p1 = result[i + 1];
        
        smoothed.push({
          x: 0.75 * p0.x + 0.25 * p1.x,
          y: 0.75 * p0.y + 0.25 * p1.y,
        });
        
        smoothed.push({
          x: 0.25 * p0.x + 0.75 * p1.x,
          y: 0.25 * p0.y + 0.75 * p1.y,
        });
      }
      
      smoothed.push(result[result.length - 1]); // Keep last point
      result = smoothed;
    }
    
    return result;
  }

  /**
   * Resample path at regular intervals
   */
  resamplePath(path: LassoPoint[], spacing: number): LassoPoint[] {
    if (path.length < 2) return path;
    
    const result: LassoPoint[] = [path[0]];
    let accumulated = 0;
    
    for (let i = 1; i < path.length; i++) {
      const prev = path[i - 1];
      const curr = path[i];
      const dx = curr.x - prev.x;
      const dy = curr.y - prev.y;
      const segmentLength = Math.sqrt(dx * dx + dy * dy);
      
      accumulated += segmentLength;
      
      while (accumulated >= spacing) {
        accumulated -= spacing;
        const t = 1 - (accumulated / segmentLength);
        result.push({
          x: prev.x + dx * t,
          y: prev.y + dy * t,
        });
      }
    }
    
    // Always include last point
    const last = path[path.length - 1];
    if (result[result.length - 1].x !== last.x || result[result.length - 1].y !== last.y) {
      result.push(last);
    }
    
    return result;
  }

  private perpendicularDistance(
    point: LassoPoint,
    lineStart: LassoPoint,
    lineEnd: LassoPoint
  ): number {
    const dx = lineEnd.x - lineStart.x;
    const dy = lineEnd.y - lineStart.y;
    
    if (dx === 0 && dy === 0) {
      return Math.sqrt(
        Math.pow(point.x - lineStart.x, 2) + Math.pow(point.y - lineStart.y, 2)
      );
    }
    
    const t = Math.max(0, Math.min(1,
      ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / (dx * dx + dy * dy)
    ));
    
    const projX = lineStart.x + t * dx;
    const projY = lineStart.y + t * dy;
    
    return Math.sqrt(Math.pow(point.x - projX, 2) + Math.pow(point.y - projY, 2));
  }
}
