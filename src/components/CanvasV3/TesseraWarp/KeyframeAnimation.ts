/**
 * Keyframe Animation System for Advanced Warp
 * 
 * Allows saving pin positions at different times and interpolating between them.
 * Supports easing curves, loop modes, and timeline scrubbing.
 */

import type { Vec2 } from './types';
import { v2 } from './types';
import type { AdvancedPin, Vec3, FalloffCurve } from './AdvancedPinTypes';
import { v3 } from './AdvancedPinTypes';

// ============================================
// TYPES
// ============================================

export type EasingType = 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out' | 'bounce' | 'elastic';
export type LoopMode = 'none' | 'loop' | 'ping-pong';

export interface PinSnapshot {
  pinId: string;
  target: Vec2 | Vec3;
  angle?: number;
  scale?: number;
  radius?: number;
}

export interface Keyframe {
  id: string;
  /** Time in seconds */
  time: number;
  /** Pin states at this keyframe */
  pinSnapshots: PinSnapshot[];
  /** Easing to next keyframe */
  easing: EasingType;
  /** Label for UI */
  label?: string;
}

export interface AnimationTimeline {
  keyframes: Keyframe[];
  /** Total duration in seconds */
  duration: number;
  /** Current playback time */
  currentTime: number;
  /** Is playing */
  isPlaying: boolean;
  /** Playback speed multiplier */
  speed: number;
  /** Loop mode */
  loopMode: LoopMode;
  /** FPS for export */
  fps: number;
}

export const DEFAULT_TIMELINE: AnimationTimeline = {
  keyframes: [],
  duration: 2,
  currentTime: 0,
  isPlaying: false,
  speed: 1,
  loopMode: 'none',
  fps: 30,
};

// ============================================
// EASING FUNCTIONS
// ============================================

export function applyEasing(t: number, easing: EasingType): number {
  const c = Math.max(0, Math.min(1, t));

  switch (easing) {
    case 'linear':
      return c;
    case 'ease-in':
      return c * c * c;
    case 'ease-out':
      return 1 - Math.pow(1 - c, 3);
    case 'ease-in-out':
      return c < 0.5 ? 4 * c * c * c : 1 - Math.pow(-2 * c + 2, 3) / 2;
    case 'bounce': {
      const n1 = 7.5625;
      const d1 = 2.75;
      let x = c;
      if (x < 1 / d1) return n1 * x * x;
      if (x < 2 / d1) return n1 * (x -= 1.5 / d1) * x + 0.75;
      if (x < 2.5 / d1) return n1 * (x -= 2.25 / d1) * x + 0.9375;
      return n1 * (x -= 2.625 / d1) * x + 0.984375;
    }
    case 'elastic': {
      if (c === 0 || c === 1) return c;
      const p = 0.3;
      return Math.pow(2, -10 * c) * Math.sin((c - p / 4) * (2 * Math.PI) / p) + 1;
    }
    default:
      return c;
  }
}

// ============================================
// KEYFRAME HELPERS
// ============================================

let keyframeIdCounter = 0;

export function createKeyframe(time: number, pins: AdvancedPin[], easing: EasingType = 'ease-in-out'): Keyframe {
  const snapshots: PinSnapshot[] = pins.map(pin => {
    const snap: PinSnapshot = {
      pinId: pin.id,
      target: pin.kind === 'control' ? { ...pin.target } : { ...pin.target },
      radius: pin.radius,
    };
    if (pin.kind === 'control' || pin.kind === 'bone') {
      snap.angle = pin.angle;
    }
    if (pin.kind === 'control') {
      snap.scale = pin.scale;
    }
    return snap;
  });

  return {
    id: `kf_${++keyframeIdCounter}_${Date.now()}`,
    time,
    pinSnapshots: snapshots,
    easing,
  };
}

/**
 * Interpolate between two keyframes at a given normalized time t (0-1)
 */
export function interpolateKeyframes(
  fromKf: Keyframe,
  toKf: Keyframe,
  t: number
): PinSnapshot[] {
  const eased = applyEasing(t, fromKf.easing);
  const result: PinSnapshot[] = [];

  for (const toSnap of toKf.pinSnapshots) {
    const fromSnap = fromKf.pinSnapshots.find(s => s.pinId === toSnap.pinId);
    if (!fromSnap) {
      result.push({ ...toSnap });
      continue;
    }

    const fromTarget = fromSnap.target;
    const toTarget = toSnap.target;

    let interpolatedTarget: Vec2 | Vec3;
    if ('z' in fromTarget && 'z' in toTarget) {
      interpolatedTarget = v3.lerp(fromTarget as Vec3, toTarget as Vec3, eased);
    } else {
      const f2 = 'z' in fromTarget ? { x: fromTarget.x, y: fromTarget.y } : fromTarget;
      const t2 = 'z' in toTarget ? { x: toTarget.x, y: toTarget.y } : toTarget;
      interpolatedTarget = v2.lerp(f2 as Vec2, t2 as Vec2, eased);
    }

    result.push({
      pinId: toSnap.pinId,
      target: interpolatedTarget,
      angle: fromSnap.angle !== undefined && toSnap.angle !== undefined
        ? fromSnap.angle + (toSnap.angle - fromSnap.angle) * eased
        : toSnap.angle,
      scale: fromSnap.scale !== undefined && toSnap.scale !== undefined
        ? fromSnap.scale + (toSnap.scale - fromSnap.scale) * eased
        : toSnap.scale,
      radius: fromSnap.radius !== undefined && toSnap.radius !== undefined
        ? fromSnap.radius + (toSnap.radius - fromSnap.radius) * eased
        : toSnap.radius,
    });
  }

  return result;
}

/**
 * Get interpolated pin snapshots at a given time on the timeline
 */
export function getSnapshotsAtTime(timeline: AnimationTimeline, time: number): PinSnapshot[] | null {
  const { keyframes } = timeline;
  if (keyframes.length === 0) return null;
  if (keyframes.length === 1) return keyframes[0].pinSnapshots;

  // Sort by time
  const sorted = [...keyframes].sort((a, b) => a.time - b.time);

  // Handle loop modes
  let effectiveTime = time;
  if (timeline.loopMode === 'loop') {
    effectiveTime = time % timeline.duration;
  } else if (timeline.loopMode === 'ping-pong') {
    const cycle = time / timeline.duration;
    const phase = cycle % 2;
    effectiveTime = phase < 1 ? phase * timeline.duration : (2 - phase) * timeline.duration;
  } else {
    effectiveTime = Math.max(0, Math.min(timeline.duration, time));
  }

  // Find surrounding keyframes
  if (effectiveTime <= sorted[0].time) return sorted[0].pinSnapshots;
  if (effectiveTime >= sorted[sorted.length - 1].time) return sorted[sorted.length - 1].pinSnapshots;

  for (let i = 0; i < sorted.length - 1; i++) {
    if (effectiveTime >= sorted[i].time && effectiveTime <= sorted[i + 1].time) {
      const segmentDuration = sorted[i + 1].time - sorted[i].time;
      const t = segmentDuration > 0 ? (effectiveTime - sorted[i].time) / segmentDuration : 0;
      return interpolateKeyframes(sorted[i], sorted[i + 1], t);
    }
  }

  return null;
}

/**
 * Apply pin snapshots to the advanced warp state
 * Returns updates as [pinId, partial update] pairs
 */
export function applySnapshots(
  snapshots: PinSnapshot[]
): Map<string, Partial<{ target: Vec2 | Vec3; angle: number; scale: number; radius: number }>> {
  const updates = new Map<string, Partial<{ target: Vec2 | Vec3; angle: number; scale: number; radius: number }>>();
  
  for (const snap of snapshots) {
    const update: any = { target: snap.target };
    if (snap.angle !== undefined) update.angle = snap.angle;
    if (snap.scale !== undefined) update.scale = snap.scale;
    if (snap.radius !== undefined) update.radius = snap.radius;
    updates.set(snap.pinId, update);
  }

  return updates;
}
