/**
 * Tessera Warp - React Hook
 * 
 * Main hook for managing the warp system state and interactions.
 */

import { useState, useCallback, useRef, useMemo } from 'react';
import type {
  TesseraWarpState,
  WarpPin,
  WarpAnchorPin,
  WarpPosePin,
  Vec2,
  ARAPSolverOptions,
  SeamBarrierOptions,
  ControlGraph,
  RenderMesh,
} from './types';
import { DEFAULT_TESSERA_WARP_STATE, v2 } from './types';
import {
  createControlGraph,
  applyPins,
  resetNodePositions,
  deformPoint,
} from './ControlGraph';
import {
  createSolverState,
  initializeSolver,
  solve,
  updateSystemMatrix,
  type ARAPSolverState,
} from './ARAPSolver';
import {
  generateRenderMesh,
  computeSkinWeights,
  deformMesh,
} from './RenderMesh';

export interface UseTesseraWarpReturn {
  state: TesseraWarpState;
  // Initialization
  initialize: (image: HTMLImageElement | HTMLCanvasElement, nodeCount?: number) => void;
  reset: () => void;
  // Pin management
  addAnchorPin: (pos: Vec2, radius?: number, stiffness?: number) => string;
  addPosePin: (pos: Vec2, angle?: number, radius?: number, stiffness?: number) => string;
  removePin: (id: string) => void;
  clearPins: () => void;
  selectPin: (id: string | null) => void;
  // Pin manipulation
  startDrag: (id: string) => void;
  updateDrag: (target: Vec2, angle?: number) => void;
  endDrag: () => void;
  updatePinTarget: (id: string, target: Vec2) => void;
  updatePinAngle: (id: string, angle: number) => void;
  updatePinRadius: (id: string, radius: number) => void;
  // Solver
  solveDeformation: () => void;
  // Options
  setSolverOptions: (options: Partial<ARAPSolverOptions>) => void;
  setSeamOptions: (options: Partial<SeamBarrierOptions>) => void;
  // Query
  getPinAtPoint: (point: Vec2, tolerance?: number) => WarpPin | null;
  getDeformedPoint: (restPoint: Vec2) => Vec2;
}

let pinIdCounter = 0;

function generatePinId(): string {
  return `warp_pin_${++pinIdCounter}_${Date.now()}`;
}

export function useTesseraWarp(): UseTesseraWarpReturn {
  const [state, setState] = useState<TesseraWarpState>(DEFAULT_TESSERA_WARP_STATE);
  
  // Refs for mutable solver state (not in React state for performance)
  const solverStateRef = useRef<ARAPSolverState>(createSolverState());
  const graphRef = useRef<ControlGraph | null>(null);
  const meshRef = useRef<RenderMesh | null>(null);
  const stateRef = useRef<TesseraWarpState>(state);
  stateRef.current = state;

  // ============================================
  // INITIALIZATION
  // ============================================

  const initialize = useCallback((
    image: HTMLImageElement | HTMLCanvasElement,
    nodeCount: number = 100
  ) => {
    const width = image.width || (image as HTMLCanvasElement).width;
    const height = image.height || (image as HTMLCanvasElement).height;
    
    // Create control graph
    const graph = createControlGraph(width, height, { nodeCount });
    graphRef.current = graph;
    
    // Initialize solver
    const solverState = createSolverState();
    initializeSolver(solverState, graph);
    solverStateRef.current = solverState;
    
    // Create render mesh
    const mesh = generateRenderMesh(width, height, { resolution: 10, kNN: 4 });
    computeSkinWeights(mesh, graph);
    meshRef.current = mesh;
    
    setState(prev => ({
      ...prev,
      sourceImage: image,
      graph,
      mesh,
      initialized: true,
      pins: [],
      selectedPinId: null,
      draggingPinId: null,
    }));
  }, []);

  const reset = useCallback(() => {
    graphRef.current = null;
    meshRef.current = null;
    solverStateRef.current = createSolverState();
    setState(DEFAULT_TESSERA_WARP_STATE);
  }, []);

  // ============================================
  // PIN MANAGEMENT
  // ============================================

  const addAnchorPin = useCallback((
    pos: Vec2,
    radius: number = 50,
    stiffness: number = 0.8
  ): string => {
    const id = generatePinId();
    const pin: WarpAnchorPin = {
      id,
      kind: 'anchor',
      pos: v2.copy(pos),
      target: v2.copy(pos),
      stiffness,
      radius,
    };

    setState(prev => {
      const newPins = [...prev.pins, pin];
      
      // Apply pins to graph
      if (graphRef.current) {
        applyPins(graphRef.current, newPins);
        updateSystemMatrix(solverStateRef.current, graphRef.current);
      }
      
      return {
        ...prev,
        pins: newPins,
        selectedPinId: id,
      };
    });

    return id;
  }, []);

  const addPosePin = useCallback((
    pos: Vec2,
    angle: number = 0,
    radius: number = 60,
    stiffness: number = 0.8
  ): string => {
    const id = generatePinId();
    const pin: WarpPosePin = {
      id,
      kind: 'pose',
      pos: v2.copy(pos),
      target: v2.copy(pos),
      angle,
      stiffness,
      radius,
    };

    setState(prev => {
      const newPins = [...prev.pins, pin];
      
      if (graphRef.current) {
        applyPins(graphRef.current, newPins);
        updateSystemMatrix(solverStateRef.current, graphRef.current);
      }
      
      return {
        ...prev,
        pins: newPins,
        selectedPinId: id,
      };
    });

    return id;
  }, []);

  const removePin = useCallback((id: string) => {
    setState(prev => {
      const newPins = prev.pins.filter(p => p.id !== id);
      
      if (graphRef.current) {
        applyPins(graphRef.current, newPins);
        updateSystemMatrix(solverStateRef.current, graphRef.current);
      }
      
      return {
        ...prev,
        pins: newPins,
        selectedPinId: prev.selectedPinId === id ? null : prev.selectedPinId,
        draggingPinId: prev.draggingPinId === id ? null : prev.draggingPinId,
      };
    });
  }, []);

  const clearPins = useCallback(() => {
    if (graphRef.current) {
      resetNodePositions(graphRef.current);
      applyPins(graphRef.current, []);
      updateSystemMatrix(solverStateRef.current, graphRef.current);
    }
    
    setState(prev => ({
      ...prev,
      pins: [],
      selectedPinId: null,
      draggingPinId: null,
    }));
  }, []);

  const selectPin = useCallback((id: string | null) => {
    setState(prev => ({ ...prev, selectedPinId: id }));
  }, []);

  // ============================================
  // PIN MANIPULATION
  // ============================================

  const startDrag = useCallback((id: string) => {
    setState(prev => ({
      ...prev,
      draggingPinId: id,
      selectedPinId: id,
    }));
  }, []);

  const updateDrag = useCallback((target: Vec2, angle?: number) => {
    setState(prev => {
      if (!prev.draggingPinId) return prev;

      const newPins = prev.pins.map(pin => {
        if (pin.id !== prev.draggingPinId) return pin;

        if (pin.kind === 'anchor') {
          return { ...pin, target: v2.copy(target) };
        } else if (pin.kind === 'pose') {
          return {
            ...pin,
            target: v2.copy(target),
            angle: angle !== undefined ? angle : pin.angle,
          };
        }
        return pin;
      });
      
      // Apply updated pins
      if (graphRef.current) {
        applyPins(graphRef.current, newPins);
      }

      return { ...prev, pins: newPins };
    });
  }, []);

  const endDrag = useCallback(() => {
    setState(prev => ({ ...prev, draggingPinId: null }));
  }, []);

  const updatePinTarget = useCallback((id: string, target: Vec2) => {
    setState(prev => {
      const newPins = prev.pins.map(pin => {
        if (pin.id !== id) return pin;
        if (pin.kind === 'rail') return pin;
        return { ...pin, target: v2.copy(target) };
      });
      
      if (graphRef.current) {
        applyPins(graphRef.current, newPins);
      }
      
      return { ...prev, pins: newPins };
    });
  }, []);

  const updatePinAngle = useCallback((id: string, angle: number) => {
    setState(prev => {
      const newPins = prev.pins.map(pin => {
        if (pin.id !== id || pin.kind !== 'pose') return pin;
        return { ...pin, angle };
      });
      
      if (graphRef.current) {
        applyPins(graphRef.current, newPins);
      }
      
      return { ...prev, pins: newPins };
    });
  }, []);

  const updatePinRadius = useCallback((id: string, radius: number) => {
    setState(prev => {
      const newPins = prev.pins.map(pin => {
        if (pin.id !== id) return pin;
        return { ...pin, radius: Math.max(10, radius) };
      });
      
      if (graphRef.current) {
        applyPins(graphRef.current, newPins);
        updateSystemMatrix(solverStateRef.current, graphRef.current);
      }
      
      return { ...prev, pins: newPins };
    });
  }, []);

  // ============================================
  // SOLVER
  // ============================================

  const solveDeformation = useCallback(() => {
    if (!graphRef.current || !meshRef.current) return;
    
    const { solverOptions } = stateRef.current;
    
    // Run ARAP solver
    solve(graphRef.current, solverStateRef.current, solverOptions);
    
    // Deform render mesh
    deformMesh(meshRef.current, graphRef.current);
    
    // Update state to trigger re-render
    setState(prev => ({
      ...prev,
      graph: graphRef.current,
      mesh: meshRef.current,
    }));
  }, []);

  // ============================================
  // OPTIONS
  // ============================================

  const setSolverOptions = useCallback((options: Partial<ARAPSolverOptions>) => {
    setState(prev => ({
      ...prev,
      solverOptions: { ...prev.solverOptions, ...options },
    }));
  }, []);

  const setSeamOptions = useCallback((options: Partial<SeamBarrierOptions>) => {
    setState(prev => ({
      ...prev,
      seamOptions: { ...prev.seamOptions, ...options },
    }));
  }, []);

  // ============================================
  // QUERY
  // ============================================

  const getPinAtPoint = useCallback((point: Vec2, tolerance: number = 15): WarpPin | null => {
    const { pins } = stateRef.current;

    for (let i = pins.length - 1; i >= 0; i--) {
      const pin = pins[i];

      if (pin.kind === 'anchor' || pin.kind === 'pose') {
        const dist = v2.dist(point, pin.target);
        if (dist <= tolerance) {
          return pin;
        }
      } else if (pin.kind === 'rail') {
        for (let j = 0; j < pin.poly.length - 1; j++) {
          const p0 = pin.poly[j];
          const p1 = pin.poly[j + 1];
          const dist = pointToSegmentDistance(point, p0, p1);
          if (dist <= tolerance) {
            return pin;
          }
        }
      }
    }

    return null;
  }, []);

  const getDeformedPoint = useCallback((restPoint: Vec2): Vec2 => {
    if (!graphRef.current) {
      return v2.copy(restPoint);
    }
    return deformPoint(graphRef.current, restPoint);
  }, []);

  return {
    state,
    initialize,
    reset,
    addAnchorPin,
    addPosePin,
    removePin,
    clearPins,
    selectPin,
    startDrag,
    updateDrag,
    endDrag,
    updatePinTarget,
    updatePinAngle,
    updatePinRadius,
    solveDeformation,
    setSolverOptions,
    setSeamOptions,
    getPinAtPoint,
    getDeformedPoint,
  };
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function pointToSegmentDistance(p: Vec2, a: Vec2, b: Vec2): number {
  const ab = v2.sub(b, a);
  const ap = v2.sub(p, a);
  const lenSq = v2.lenSq(ab);

  if (lenSq < 1e-10) {
    return v2.len(ap);
  }

  const t = Math.max(0, Math.min(1, v2.dot(ap, ab) / lenSq));
  const proj = v2.add(a, v2.mul(ab, t));
  return v2.dist(p, proj);
}
