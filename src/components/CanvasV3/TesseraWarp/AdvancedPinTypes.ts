/**
 * Advanced Pin System - Comprehensive Deformation Controls
 * 
 * This module extends the basic pin system with:
 * - Cage pins that connect to form rigid boundaries
 * - 3D depth displacement (push/pull effect)
 * - Bone chains for skeletal animation
 * - Bezier curve connections between pins
 * - Advanced strength and falloff controls
 * - Pin groups and hierarchies
 */

import type { Vec2, Mat2 } from './types';
import { v2 } from './types';

// ============================================
// 3D VECTOR (for depth/push-pull)
// ============================================

export interface Vec3 {
  x: number;
  y: number;
  z: number; // Depth: positive = toward camera, negative = away
}

export const v3 = {
  create(x = 0, y = 0, z = 0): Vec3 {
    return { x, y, z };
  },
  
  add(a: Vec3, b: Vec3): Vec3 {
    return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
  },
  
  sub(a: Vec3, b: Vec3): Vec3 {
    return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
  },
  
  mul(v: Vec3, s: number): Vec3 {
    return { x: v.x * s, y: v.y * s, z: v.z * s };
  },
  
  len(v: Vec3): number {
    return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
  },
  
  normalize(v: Vec3): Vec3 {
    const len = v3.len(v) || 1;
    return { x: v.x / len, y: v.y / len, z: v.z / len };
  },
  
  lerp(a: Vec3, b: Vec3, t: number): Vec3 {
    return {
      x: a.x + (b.x - a.x) * t,
      y: a.y + (b.y - a.y) * t,
      z: a.z + (b.z - a.z) * t,
    };
  },
  
  toVec2(v: Vec3): Vec2 {
    return { x: v.x, y: v.y };
  },
  
  fromVec2(v: Vec2, z = 0): Vec3 {
    return { x: v.x, y: v.y, z };
  },
};

// ============================================
// FALLOFF CURVES
// ============================================

export type FalloffType = 
  | 'linear'      // Simple linear falloff
  | 'smooth'      // Smooth step (hermite)
  | 'gaussian'    // Bell curve (natural feel)
  | 'sharp'       // Quick drop-off
  | 'flat'        // Constant strength, sharp cutoff
  | 'custom';     // User-defined bezier curve

export interface FalloffCurve {
  type: FalloffType;
  /** For custom curves: bezier control points [p1, p2] where p0=(0,1) and p3=(1,0) */
  bezierPoints?: [Vec2, Vec2];
}

/** Evaluate falloff at distance t (0-1 normalized) */
export function evaluateFalloff(curve: FalloffCurve, t: number): number {
  const clamped = Math.max(0, Math.min(1, t));
  
  switch (curve.type) {
    case 'linear':
      return 1 - clamped;
      
    case 'smooth':
      // Hermite smoothstep
      return 1 - (clamped * clamped * (3 - 2 * clamped));
      
    case 'gaussian':
      // Gaussian with sigma=0.3
      const sigma = 0.3;
      return Math.exp(-(clamped * clamped) / (2 * sigma * sigma));
      
    case 'sharp':
      // Quadratic falloff
      return (1 - clamped) * (1 - clamped);
      
    case 'flat':
      return clamped < 0.95 ? 1 : 0;
      
    case 'custom':
      if (curve.bezierPoints) {
        return evaluateBezierFalloff(clamped, curve.bezierPoints);
      }
      return 1 - clamped;
      
    default:
      return 1 - clamped;
  }
}

function evaluateBezierFalloff(t: number, [p1, p2]: [Vec2, Vec2]): number {
  // Cubic bezier from (0,1) through p1, p2 to (1,0)
  const p0 = { x: 0, y: 1 };
  const p3 = { x: 1, y: 0 };
  
  const mt = 1 - t;
  const mt2 = mt * mt;
  const mt3 = mt2 * mt;
  const t2 = t * t;
  const t3 = t2 * t;
  
  return mt3 * p0.y + 3 * mt2 * t * p1.y + 3 * mt * t2 * p2.y + t3 * p3.y;
}

// ============================================
// ADVANCED PIN BASE
// ============================================

export interface AdvancedPinBase {
  id: string;
  /** Display name for UI */
  name?: string;
  /** Pin is locked/unlocked */
  locked: boolean;
  /** Pin visibility */
  visible: boolean;
  /** Color for visualization (hex) */
  color: string;
  /** Group ID (for grouped selection/movement) */
  groupId?: string;
  /** Parent pin ID (for hierarchical movement) */
  parentId?: string;
}

// ============================================
// CAGE PIN - Boundary Control
// ============================================

export interface CagePin extends AdvancedPinBase {
  kind: 'cage';
  /** Rest position in image coords */
  pos: Vec2;
  /** Current position (locked in place unless explicitly moved) */
  target: Vec2;
  /** Connection IDs (other cage pins this is connected to) */
  connections: string[];
  /** Whether this pin "locks" the area (prevents deformation passing through) */
  lockArea: boolean;
  /** Influence radius */
  radius: number;
  /** Stiffness of this pin's hold (0-1) */
  stiffness: number;
}

// ============================================
// CONTROL PIN - Push/Pull with 3D Depth
// ============================================

export interface ControlPin extends AdvancedPinBase {
  kind: 'control';
  /** Rest position (2D) */
  pos: Vec2;
  /** Target position with 3D depth */
  target: Vec3;
  /** Rotation angle (radians) */
  angle: number;
  /** Scale factor (1 = no scale) */
  scale: number;
  /** Influence radius */
  radius: number;
  /** Pin strength (0-1) */
  strength: number;
  /** Falloff curve */
  falloff: FalloffCurve;
  /** Depth influence strength (how much Z affects perspective) */
  depthStrength: number;
  /** Whether depth creates perspective foreshortening */
  perspectiveMode: boolean;
}

// ============================================
// BONE PIN - Skeletal Animation
// ============================================

export interface BonePin extends AdvancedPinBase {
  kind: 'bone';
  /** Joint position (start of bone) */
  pos: Vec2;
  /** Current joint position */
  target: Vec2;
  /** Bone length (distance to child) */
  length: number;
  /** Bone rotation angle */
  angle: number;
  /** Next bone in chain (child) */
  childId?: string;
  /** Influence radius along bone */
  radius: number;
  /** Bone stiffness */
  stiffness: number;
  /** Weight falloff along bone length */
  falloff: FalloffCurve;
  /** IK enabled (inverse kinematics) */
  ikEnabled: boolean;
  /** IK chain length (how many parents to solve) */
  ikChainLength: number;
}

// ============================================
// CONNECTION/EDGE TYPES
// ============================================

export type ConnectionType = 
  | 'rigid'     // Fixed distance between pins
  | 'elastic'   // Spring-like stretchy connection
  | 'bezier';   // Smooth curved connection

export interface PinConnection {
  id: string;
  /** Source pin ID */
  fromId: string;
  /** Target pin ID */
  toId: string;
  /** Connection type */
  type: ConnectionType;
  /** Connection strength/stiffness (0-1) */
  strength: number;
  /** For bezier: control points (relative to midpoint) */
  bezierHandles?: [Vec2, Vec2];
  /** Rest length (auto-calculated from initial positions) */
  restLength: number;
  /** Maximum stretch ratio (for elastic, e.g., 1.5 = 50% stretch allowed) */
  maxStretch?: number;
  /** Color for visualization */
  color: string;
  /** Line width for visualization */
  lineWidth: number;
  /** Whether connection is visible */
  visible: boolean;
}

// ============================================
// PIN GROUP
// ============================================

export interface PinGroup {
  id: string;
  name: string;
  /** Pin IDs in this group */
  pinIds: string[];
  /** Group color */
  color: string;
  /** Group is locked (pins can't be moved individually) */
  locked: boolean;
  /** Group is visible */
  visible: boolean;
  /** Group center (computed) */
  center?: Vec2;
}

// ============================================
// DEPTH SETTINGS
// ============================================

export interface DepthSettings {
  /** Enable 3D depth mode */
  enabled: boolean;
  /** Maximum depth range (pixels in Z) */
  maxDepth: number;
  /** Perspective amount (0 = orthographic, 1 = strong perspective) */
  perspectiveStrength: number;
  /** Virtual camera focal length */
  focalLength: number;
  /** Generate ambient occlusion from depth */
  ambientOcclusion: boolean;
  /** AO strength */
  aoStrength: number;
  /** Generate specular highlights based on depth normals */
  specularHighlights: boolean;
  /** Light direction for depth shading */
  lightDirection: Vec3;
}

export const DEFAULT_DEPTH_SETTINGS: DepthSettings = {
  enabled: false,
  maxDepth: 100,
  perspectiveStrength: 0.5,
  focalLength: 500,
  ambientOcclusion: false,
  aoStrength: 0.3,
  specularHighlights: false,
  lightDirection: { x: -0.5, y: -0.5, z: 1 },
};

// ============================================
// ADVANCED PIN UNION TYPE
// ============================================

export type AdvancedPin = CagePin | ControlPin | BonePin;

// ============================================
// ADVANCED WARP STATE
// ============================================

export interface AdvancedWarpState {
  /** All pins */
  pins: AdvancedPin[];
  /** Pin connections/edges */
  connections: PinConnection[];
  /** Pin groups */
  groups: PinGroup[];
  /** Currently selected pin IDs (multi-select) */
  selectedPinIds: string[];
  /** Pin being dragged */
  draggingPinId: string | null;
  /** Connection being edited */
  editingConnectionId: string | null;
  /** Current tool mode */
  toolMode: AdvancedWarpToolMode;
  /** Depth settings */
  depthSettings: DepthSettings;
  /** Show connection lines */
  showConnections: boolean;
  /** Show influence radii */
  showInfluence: boolean;
  /** Show mesh wireframe */
  showMesh: boolean;
  /** Snap to grid */
  snapToGrid: boolean;
  /** Grid size for snapping */
  gridSize: number;
  /** Symmetry mode */
  symmetryMode: SymmetryMode;
  /** Symmetry axis (for axial symmetry) */
  symmetryAxis?: { point: Vec2; angle: number };
}

export type AdvancedWarpToolMode = 
  | 'select'        // Select/move pins
  | 'cage'          // Add cage pins
  | 'control'       // Add control pins
  | 'bone'          // Add bone pins
  | 'connect'       // Draw connections between pins
  | 'disconnect'    // Remove connections
  | 'adjust'        // Adjust pin properties
  | 'group';        // Create/manage groups

export type SymmetryMode = 'none' | 'horizontal' | 'vertical' | 'radial';

export const DEFAULT_ADVANCED_WARP_STATE: AdvancedWarpState = {
  pins: [],
  connections: [],
  groups: [],
  selectedPinIds: [],
  draggingPinId: null,
  editingConnectionId: null,
  toolMode: 'select',
  depthSettings: DEFAULT_DEPTH_SETTINGS,
  showConnections: true,
  showInfluence: true,
  showMesh: false,
  snapToGrid: false,
  gridSize: 10,
  symmetryMode: 'none',
};

// ============================================
// PIN CREATION HELPERS
// ============================================

let advancedPinIdCounter = 0;

export function generateAdvancedPinId(prefix: string = 'pin'): string {
  return `${prefix}_${++advancedPinIdCounter}_${Date.now()}`;
}

export function createCagePin(pos: Vec2, options: Partial<CagePin> = {}): CagePin {
  return {
    id: generateAdvancedPinId('cage'),
    kind: 'cage',
    name: options.name || 'Cage Pin',
    locked: false,
    visible: true,
    color: '#22c55e', // Green
    pos: v2.copy(pos),
    target: v2.copy(pos),
    connections: [],
    lockArea: true,
    radius: options.radius ?? 40,
    stiffness: options.stiffness ?? 0.9,
    ...options,
  };
}

export function createControlPin(pos: Vec2, options: Partial<ControlPin> = {}): ControlPin {
  return {
    id: generateAdvancedPinId('control'),
    kind: 'control',
    name: options.name || 'Control Pin',
    locked: false,
    visible: true,
    color: '#3b82f6', // Blue
    pos: v2.copy(pos),
    target: { x: pos.x, y: pos.y, z: 0 },
    angle: 0,
    scale: 1,
    radius: options.radius ?? 60,
    strength: options.strength ?? 0.8,
    falloff: { type: 'smooth' },
    depthStrength: 1.0,
    perspectiveMode: true,
    ...options,
  };
}

export function createBonePin(pos: Vec2, length: number, options: Partial<BonePin> = {}): BonePin {
  return {
    id: generateAdvancedPinId('bone'),
    kind: 'bone',
    name: options.name || 'Bone',
    locked: false,
    visible: true,
    color: '#f59e0b', // Amber
    pos: v2.copy(pos),
    target: v2.copy(pos),
    length,
    angle: 0,
    radius: options.radius ?? 30,
    stiffness: options.stiffness ?? 0.85,
    falloff: { type: 'linear' },
    ikEnabled: true,
    ikChainLength: 2,
    ...options,
  };
}

export function createConnection(
  fromId: string, 
  toId: string, 
  type: ConnectionType = 'elastic',
  restLength: number,
  options: Partial<PinConnection> = {}
): PinConnection {
  return {
    id: generateAdvancedPinId('conn'),
    fromId,
    toId,
    type,
    strength: type === 'rigid' ? 1.0 : 0.7,
    restLength,
    maxStretch: type === 'elastic' ? 1.5 : undefined,
    color: type === 'rigid' ? '#ef4444' : type === 'bezier' ? '#a855f7' : '#64748b',
    lineWidth: 2,
    visible: true,
    ...options,
  };
}

// ============================================
// 3D PROJECTION HELPERS
// ============================================

/**
 * Apply perspective projection to a 3D point
 * Returns 2D position with scale factor for foreshortening
 */
export function perspectiveProject(
  point: Vec3, 
  settings: DepthSettings,
  imageCenter: Vec2
): { pos: Vec2; scale: number } {
  if (!settings.enabled || settings.perspectiveStrength === 0) {
    return { pos: { x: point.x, y: point.y }, scale: 1 };
  }
  
  const focalLength = settings.focalLength;
  const perspectiveAmount = settings.perspectiveStrength;
  
  // Normalize depth to 0-1 range
  const normalizedZ = point.z / settings.maxDepth;
  
  // Calculate perspective scale
  // Positive Z = toward camera = larger, Negative Z = away = smaller
  const perspectiveScale = 1 + (normalizedZ * perspectiveAmount * 0.5);
  
  // Apply radial displacement from center based on depth
  const dx = point.x - imageCenter.x;
  const dy = point.y - imageCenter.y;
  
  const projectedX = imageCenter.x + dx * perspectiveScale;
  const projectedY = imageCenter.y + dy * perspectiveScale;
  
  return {
    pos: { x: projectedX, y: projectedY },
    scale: perspectiveScale,
  };
}

/**
 * Compute depth-based shading intensity
 */
export function computeDepthShading(
  depth: number,
  settings: DepthSettings
): { ao: number; specular: number } {
  if (!settings.enabled) {
    return { ao: 0, specular: 0 };
  }
  
  const normalizedDepth = depth / settings.maxDepth;
  
  // AO increases in recessed areas (negative depth)
  const ao = settings.ambientOcclusion 
    ? Math.max(0, -normalizedDepth * settings.aoStrength)
    : 0;
  
  // Specular on raised areas
  const specular = settings.specularHighlights
    ? Math.max(0, normalizedDepth * 0.5)
    : 0;
  
  return { ao, specular };
}

// ============================================
// INVERSE KINEMATICS HELPERS
// ============================================

/**
 * Solve 2-bone IK (most common case)
 * Returns the new angles for joint1 and joint2
 */
export function solveTwoBoneIK(
  root: Vec2,
  target: Vec2,
  length1: number,
  length2: number,
  preferredBend: 'cw' | 'ccw' = 'ccw'
): { angle1: number; angle2: number } | null {
  const targetDist = v2.dist(root, target);
  
  // Check if target is reachable
  if (targetDist > length1 + length2) {
    // Target too far, stretch toward it
    const angle = Math.atan2(target.y - root.y, target.x - root.x);
    return { angle1: angle, angle2: 0 };
  }
  
  if (targetDist < Math.abs(length1 - length2)) {
    // Target too close
    return null;
  }
  
  // Law of cosines to find angles
  const cosAngle2 = (length1 * length1 + length2 * length2 - targetDist * targetDist) 
    / (2 * length1 * length2);
  const angle2 = Math.acos(Math.max(-1, Math.min(1, cosAngle2)));
  
  const cosAngle1Part = (length1 * length1 + targetDist * targetDist - length2 * length2)
    / (2 * length1 * targetDist);
  const angle1Offset = Math.acos(Math.max(-1, Math.min(1, cosAngle1Part)));
  
  const targetAngle = Math.atan2(target.y - root.y, target.x - root.x);
  
  if (preferredBend === 'ccw') {
    return {
      angle1: targetAngle - angle1Offset,
      angle2: Math.PI - angle2,
    };
  } else {
    return {
      angle1: targetAngle + angle1Offset,
      angle2: -(Math.PI - angle2),
    };
  }
}

// ============================================
// BEZIER CURVE HELPERS
// ============================================

/**
 * Evaluate a cubic bezier curve at t
 */
export function evaluateBezier(
  p0: Vec2, 
  p1: Vec2, 
  p2: Vec2, 
  p3: Vec2, 
  t: number
): Vec2 {
  const mt = 1 - t;
  const mt2 = mt * mt;
  const mt3 = mt2 * mt;
  const t2 = t * t;
  const t3 = t2 * t;
  
  return {
    x: mt3 * p0.x + 3 * mt2 * t * p1.x + 3 * mt * t2 * p2.x + t3 * p3.x,
    y: mt3 * p0.y + 3 * mt2 * t * p1.y + 3 * mt * t2 * p2.y + t3 * p3.y,
  };
}

/**
 * Get points along a bezier connection for rendering
 */
export function getBezierConnectionPoints(
  from: Vec2,
  to: Vec2,
  handles: [Vec2, Vec2] | undefined,
  segments: number = 20
): Vec2[] {
  const mid = v2.lerp(from, to, 0.5);
  
  // Default handles: perpendicular to line
  const defaultHandle = v2.mul(v2.perpCCW(v2.normalize(v2.sub(to, from))), v2.dist(from, to) * 0.25);
  
  const h1 = handles ? v2.add(mid, handles[0]) : v2.add(v2.lerp(from, to, 0.25), defaultHandle);
  const h2 = handles ? v2.add(mid, handles[1]) : v2.add(v2.lerp(from, to, 0.75), v2.negate(defaultHandle));
  
  const points: Vec2[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    points.push(evaluateBezier(from, h1, h2, to, t));
  }
  
  return points;
}
