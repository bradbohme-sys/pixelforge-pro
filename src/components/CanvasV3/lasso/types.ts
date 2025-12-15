/**
 * Lasso System Types
 */

export interface LassoPoint {
  x: number;
  y: number;
  edgeStrength?: number;
  timestamp?: number;
}

export interface LassoAnchor {
  point: LassoPoint;
  strength: number; // 0-1, for elastic anchoring
  locked: boolean;
  edgeQuality: number;
}

export interface LassoPath {
  points: LassoPoint[];
  anchors: LassoAnchor[];
  closed: boolean;
}

export type EdgeMethod = 'sobel' | 'prewitt' | 'scharr' | 'roberts' | 'laplacian' | 'canny';

export type AnchorMode = 
  | 'manual' 
  | 'distance' 
  | 'time' 
  | 'hybrid' 
  | 'elastic' 
  | 'edge-quality' 
  | 'predictive';

export type LassoVariant = 
  | 'classic-dijkstra'      // Intelligent Scissors
  | 'photoshop-auto'        // Auto-anchoring
  | 'elastic-progressive'   // Progressive strength
  | 'predictive-directional'; // Prediction-based

export interface EdgeDetectionSettings {
  method: EdgeMethod;
  sensitivity: number;       // 0-100
  threshold: number;         // 0-255
  hysteresisLow: number;     // For Canny
  hysteresisHigh: number;    // For Canny
  useNMS: boolean;           // Non-maximum suppression
  blurRadius: number;        // Gaussian blur before detection
  adaptiveEdge: boolean;
}

export interface AnchorSettings {
  mode: AnchorMode;
  distanceThreshold: number;  // pixels
  timeInterval: number;       // ms
  minMovement: number;        // minimum cursor movement
  elasticZoneLength: number;  // for elastic mode
  strengthCurve: 'linear' | 'exponential' | 'ease-in-out';
  lockThreshold: number;      // 0-1
}

export interface CursorSettings {
  radius: number;             // Dead zone radius
  smoothingFactor: number;    // 0-1
  searchRadius: number;       // Edge search radius
  trajectoryLookback: number; // Points to analyze
}

export interface PathfindingSettings {
  algorithm: 'dijkstra' | 'astar';
  connectivity: 4 | 8;
  cursorInfluence: number;    // 0-1, how much cursor affects path
  directionContinuity: number; // Cost for direction changes
}

export interface VisualizationSettings {
  nodeSize: number;
  pathColor: string;
  anchorColor: string;
  previewColor: string;
  showElasticGradient: boolean;
  showPredictionZone: boolean;
  showEdgeTrail: boolean;
  showMetrics: boolean;
}

export interface LassoSettings {
  variant: LassoVariant;
  edge: EdgeDetectionSettings;
  anchor: AnchorSettings;
  cursor: CursorSettings;
  pathfinding: PathfindingSettings;
  visualization: VisualizationSettings;
}

export interface LassoMetrics {
  fps: number;
  pathComputeMs: number;
  totalPoints: number;
  anchorCount: number;
  edgeQuality: number;
  cursorInfluence: number;
  cursorSpeed: number;
}

export interface EdgeMap {
  magnitude: Float32Array;
  direction: Float32Array;
  width: number;
  height: number;
}

// Default settings
export const DEFAULT_LASSO_SETTINGS: LassoSettings = {
  variant: 'classic-dijkstra',
  edge: {
    method: 'canny',
    sensitivity: 50,
    threshold: 30,
    hysteresisLow: 50,
    hysteresisHigh: 150,
    useNMS: true,
    blurRadius: 1.4,
    adaptiveEdge: false,
  },
  anchor: {
    mode: 'manual',
    distanceThreshold: 30,
    timeInterval: 500,
    minMovement: 5,
    elasticZoneLength: 50,
    strengthCurve: 'linear',
    lockThreshold: 0.8,
  },
  cursor: {
    radius: 15,
    smoothingFactor: 0.5,
    searchRadius: 20,
    trajectoryLookback: 8,
  },
  pathfinding: {
    algorithm: 'dijkstra',
    connectivity: 8,
    cursorInfluence: 0.3,
    directionContinuity: 0.5,
  },
  visualization: {
    nodeSize: 6,
    pathColor: '#00FFFF',
    anchorColor: '#FFFFFF',
    previewColor: 'rgba(0, 255, 255, 0.5)',
    showElasticGradient: true,
    showPredictionZone: false,
    showEdgeTrail: true,
    showMetrics: true,
  },
};
