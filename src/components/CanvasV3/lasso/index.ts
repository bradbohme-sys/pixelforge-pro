/**
 * Lasso System Exports
 */

export * from './types';
export { EdgeDetectionEngine } from './EdgeDetectionEngine';
export { PathfindingEngine } from './PathfindingEngine';
export { LazyCursor } from './LazyCursor';
export { BaseLassoHandler } from './BaseLassoHandler';
export { ClassicDijkstraLasso } from './ClassicDijkstraLasso';
export { PhotoshopAutoLasso } from './PhotoshopAutoLasso';
export { ElasticProgressiveLasso } from './ElasticProgressiveLasso';
export { PredictiveDirectionalLasso } from './PredictiveDirectionalLasso';

import type { CoordinateSystem } from '../CoordinateSystem';
import type { Layer } from '../types';
import type { LassoVariant, LassoSettings } from './types';
import { BaseLassoHandler } from './BaseLassoHandler';
import { ClassicDijkstraLasso } from './ClassicDijkstraLasso';
import { PhotoshopAutoLasso } from './PhotoshopAutoLasso';
import { ElasticProgressiveLasso } from './ElasticProgressiveLasso';
import { PredictiveDirectionalLasso } from './PredictiveDirectionalLasso';

/**
 * Factory function to create lasso handler by variant
 */
export function createLassoHandler(
  variant: LassoVariant,
  coordSystem: CoordinateSystem,
  layers: Layer[],
  imageCache: Map<string, HTMLImageElement>
): BaseLassoHandler {
  switch (variant) {
    case 'classic-dijkstra':
      return new ClassicDijkstraLasso(coordSystem, layers, imageCache);
    case 'photoshop-auto':
      return new PhotoshopAutoLasso(coordSystem, layers, imageCache);
    case 'elastic-progressive':
      return new ElasticProgressiveLasso(coordSystem, layers, imageCache);
    case 'predictive-directional':
      return new PredictiveDirectionalLasso(coordSystem, layers, imageCache);
    default:
      return new ClassicDijkstraLasso(coordSystem, layers, imageCache);
  }
}
