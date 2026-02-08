/**
 * Advanced Warp System - React Hook
 * 
 * Manages the full state of the advanced pin-based deformation system
 * with cage pins, control pins, bones, connections, and 3D depth.
 */

import { useState, useCallback, useRef, useMemo } from 'react';
import { v2 } from './types';
import type { Vec2 } from './types';
import {
  v3,
  type Vec3,
  type AdvancedPin,
  type CagePin,
  type ControlPin,
  type BonePin,
  type PinConnection,
  type PinGroup,
  type AdvancedWarpState,
  type AdvancedWarpToolMode,
  type DepthSettings,
  type FalloffCurve,
  type ConnectionType,
  type SymmetryMode,
  DEFAULT_ADVANCED_WARP_STATE,
  DEFAULT_DEPTH_SETTINGS,
  createCagePin,
  createControlPin,
  createBonePin,
  createConnection,
  generateAdvancedPinId,
  perspectiveProject,
  solveTwoBoneIK,
} from './AdvancedPinTypes';

export interface UseAdvancedWarpReturn {
  state: AdvancedWarpState;
  
  // Tool mode
  setToolMode: (mode: AdvancedWarpToolMode) => void;
  
  // Pin creation
  addCagePin: (pos: Vec2, options?: Partial<CagePin>) => string;
  addControlPin: (pos: Vec2, options?: Partial<ControlPin>) => string;
  addBonePin: (pos: Vec2, length: number, parentId?: string) => string;
  
  // Pin manipulation
  selectPin: (id: string | null, addToSelection?: boolean) => void;
  selectPins: (ids: string[]) => void;
  clearSelection: () => void;
  deleteSelectedPins: () => void;
  deletePin: (id: string) => void;
  
  // Dragging
  startDrag: (id: string) => void;
  updateDrag: (target: Vec2 | Vec3, angle?: number) => void;
  endDrag: () => void;
  
  // Pin property updates
  updatePinPosition: (id: string, target: Vec2 | Vec3) => void;
  updatePinRadius: (id: string, radius: number) => void;
  updatePinStrength: (id: string, strength: number) => void;
  updatePinAngle: (id: string, angle: number) => void;
  updatePinScale: (id: string, scale: number) => void;
  updatePinDepth: (id: string, depth: number) => void;
  updatePinFalloff: (id: string, falloff: FalloffCurve) => void;
  updatePinColor: (id: string, color: string) => void;
  lockPin: (id: string, locked: boolean) => void;
  
  // Connections
  addConnection: (fromId: string, toId: string, type?: ConnectionType) => string | null;
  removeConnection: (id: string) => void;
  updateConnectionStrength: (id: string, strength: number) => void;
  updateConnectionType: (id: string, type: ConnectionType) => void;
  autoConnectCagePins: (mode: 'nearest' | 'sequential' | 'mesh') => void;
  
  // Groups
  createGroup: (name: string, pinIds: string[]) => string;
  addToGroup: (groupId: string, pinIds: string[]) => void;
  removeFromGroup: (groupId: string, pinIds: string[]) => void;
  deleteGroup: (id: string) => void;
  
  // Bones/IK
  solveBoneIK: (tipBoneId: string, target: Vec2) => void;
  
  // Settings
  setDepthSettings: (settings: Partial<DepthSettings>) => void;
  setSymmetryMode: (mode: SymmetryMode) => void;
  toggleShowConnections: () => void;
  toggleShowInfluence: () => void;
  toggleShowMesh: () => void;
  
  // Query
  getPinById: (id: string) => AdvancedPin | undefined;
  getPinAtPoint: (point: Vec2, tolerance?: number) => AdvancedPin | null;
  getConnectionsForPin: (pinId: string) => PinConnection[];
  getConnectedPins: (pinId: string) => AdvancedPin[];
  getBoneChain: (startBoneId: string) => BonePin[];
  
  // Reset
  reset: () => void;
  clearAllPins: () => void;
}

export function useAdvancedWarp(): UseAdvancedWarpReturn {
  const [state, setState] = useState<AdvancedWarpState>(DEFAULT_ADVANCED_WARP_STATE);
  const stateRef = useRef<AdvancedWarpState>(state);
  stateRef.current = state;
  
  // ============================================
  // TOOL MODE
  // ============================================
  
  const setToolMode = useCallback((mode: AdvancedWarpToolMode) => {
    setState(prev => ({ ...prev, toolMode: mode }));
  }, []);
  
  // ============================================
  // PIN CREATION
  // ============================================
  
  const addCagePin = useCallback((pos: Vec2, options?: Partial<CagePin>): string => {
    const pin = createCagePin(pos, options);
    
    setState(prev => {
      const pins = [...prev.pins, pin];
      
      // If symmetry is enabled, create mirrored pin
      let mirroredPin: CagePin | null = null;
      if (prev.symmetryMode !== 'none') {
        mirroredPin = createMirroredCagePin(pin, prev);
        if (mirroredPin) {
          pins.push(mirroredPin);
        }
      }
      
      return {
        ...prev,
        pins,
        selectedPinIds: [pin.id],
      };
    });
    
    return pin.id;
  }, []);
  
  const addControlPin = useCallback((pos: Vec2, options?: Partial<ControlPin>): string => {
    const pin = createControlPin(pos, options);
    
    setState(prev => {
      const pins = [...prev.pins, pin];
      
      // Symmetry
      if (prev.symmetryMode !== 'none') {
        const mirroredPin = createMirroredControlPin(pin, prev);
        if (mirroredPin) pins.push(mirroredPin);
      }
      
      return {
        ...prev,
        pins,
        selectedPinIds: [pin.id],
      };
    });
    
    return pin.id;
  }, []);
  
  const addBonePin = useCallback((pos: Vec2, length: number, parentId?: string): string => {
    const pin = createBonePin(pos, length);
    
    setState(prev => {
      const pins = [...prev.pins];
      
      // If parent specified, link them
      if (parentId) {
        const parentIdx = pins.findIndex(p => p.id === parentId);
        if (parentIdx !== -1 && pins[parentIdx].kind === 'bone') {
          const parent = pins[parentIdx] as BonePin;
          pins[parentIdx] = { ...parent, childId: pin.id };
          
          // Position new bone at end of parent
          const endPos = {
            x: parent.target.x + Math.cos(parent.angle) * parent.length,
            y: parent.target.y + Math.sin(parent.angle) * parent.length,
          };
          pin.pos = endPos;
          pin.target = endPos;
        }
      }
      
      pins.push(pin);
      
      return {
        ...prev,
        pins,
        selectedPinIds: [pin.id],
      };
    });
    
    return pin.id;
  }, []);
  
  // ============================================
  // PIN SELECTION
  // ============================================
  
  const selectPin = useCallback((id: string | null, addToSelection = false) => {
    setState(prev => {
      if (id === null) {
        return { ...prev, selectedPinIds: [] };
      }
      
      if (addToSelection) {
        const exists = prev.selectedPinIds.includes(id);
        return {
          ...prev,
          selectedPinIds: exists
            ? prev.selectedPinIds.filter(pid => pid !== id)
            : [...prev.selectedPinIds, id],
        };
      }
      
      return { ...prev, selectedPinIds: [id] };
    });
  }, []);
  
  const selectPins = useCallback((ids: string[]) => {
    setState(prev => ({ ...prev, selectedPinIds: ids }));
  }, []);
  
  const clearSelection = useCallback(() => {
    setState(prev => ({ ...prev, selectedPinIds: [] }));
  }, []);
  
  // ============================================
  // PIN DELETION
  // ============================================
  
  const deletePin = useCallback((id: string) => {
    setState(prev => {
      // Remove pin
      const pins = prev.pins.filter(p => p.id !== id);
      
      // Remove connections involving this pin
      const connections = prev.connections.filter(
        c => c.fromId !== id && c.toId !== id
      );
      
      // Update bone parent references
      const updatedPins = pins.map(p => {
        if (p.kind === 'bone' && p.childId === id) {
          return { ...p, childId: undefined } as BonePin;
        }
        if (p.kind === 'cage') {
          const cage = p as CagePin;
          return { ...cage, connections: cage.connections.filter(cid => cid !== id) };
        }
        return p;
      });
      
      return {
        ...prev,
        pins: updatedPins,
        connections,
        selectedPinIds: prev.selectedPinIds.filter(pid => pid !== id),
      };
    });
  }, []);
  
  const deleteSelectedPins = useCallback(() => {
    setState(prev => {
      const idsToDelete = new Set(prev.selectedPinIds);
      
      const pins = prev.pins.filter(p => !idsToDelete.has(p.id));
      const connections = prev.connections.filter(
        c => !idsToDelete.has(c.fromId) && !idsToDelete.has(c.toId)
      );
      
      // Update references
      const updatedPins = pins.map(p => {
        if (p.kind === 'bone' && p.childId && idsToDelete.has(p.childId)) {
          return { ...p, childId: undefined } as BonePin;
        }
        if (p.kind === 'cage') {
          const cage = p as CagePin;
          return { ...cage, connections: cage.connections.filter(cid => !idsToDelete.has(cid)) };
        }
        return p;
      });
      
      return {
        ...prev,
        pins: updatedPins,
        connections,
        selectedPinIds: [],
      };
    });
  }, []);
  
  // ============================================
  // DRAGGING
  // ============================================
  
  const startDrag = useCallback((id: string) => {
    setState(prev => ({
      ...prev,
      draggingPinId: id,
      selectedPinIds: prev.selectedPinIds.includes(id) ? prev.selectedPinIds : [id],
    }));
  }, []);
  
  const updateDrag = useCallback((target: Vec2 | Vec3, angle?: number) => {
    setState(prev => {
      if (!prev.draggingPinId) return prev;
      
      const pins = prev.pins.map(pin => {
        if (pin.id !== prev.draggingPinId) return pin;
        
        // Handle locked pins
        if (pin.locked) return pin;
        
        switch (pin.kind) {
          case 'cage':
            return {
              ...pin,
              target: 'z' in target ? { x: target.x, y: target.y } : target,
            };
            
          case 'control':
            return {
              ...pin,
              target: 'z' in target ? target : { ...target, z: pin.target.z },
              angle: angle !== undefined ? angle : pin.angle,
            };
            
          case 'bone':
            return {
              ...pin,
              target: 'z' in target ? { x: target.x, y: target.y } : target,
              angle: angle !== undefined ? angle : pin.angle,
            };
            
          default:
            return pin;
        }
      });
      
      return { ...prev, pins };
    });
  }, []);
  
  const endDrag = useCallback(() => {
    setState(prev => ({ ...prev, draggingPinId: null }));
  }, []);
  
  // ============================================
  // PIN PROPERTY UPDATES
  // ============================================
  
  const updatePinPosition = useCallback((id: string, target: Vec2 | Vec3) => {
    setState(prev => ({
      ...prev,
      pins: prev.pins.map(pin => {
        if (pin.id !== id) return pin;
        
        if (pin.kind === 'control') {
          return { ...pin, target: 'z' in target ? target : { ...target, z: pin.target.z } };
        }
        return { ...pin, target: 'z' in target ? { x: target.x, y: target.y } : target } as typeof pin;
      }),
    }));
  }, []);
  
  const updatePinRadius = useCallback((id: string, radius: number) => {
    setState(prev => ({
      ...prev,
      pins: prev.pins.map(pin => 
        pin.id === id ? { ...pin, radius: Math.max(5, radius) } : pin
      ),
    }));
  }, []);
  
  const updatePinStrength = useCallback((id: string, strength: number) => {
    setState(prev => ({
      ...prev,
      pins: prev.pins.map(pin => {
        if (pin.id !== id) return pin;
        
        if (pin.kind === 'cage' || pin.kind === 'bone') {
          return { ...pin, stiffness: Math.max(0, Math.min(1, strength)) };
        }
        if (pin.kind === 'control') {
          return { ...pin, strength: Math.max(0, Math.min(1, strength)) };
        }
        return pin;
      }),
    }));
  }, []);
  
  const updatePinAngle = useCallback((id: string, angle: number) => {
    setState(prev => ({
      ...prev,
      pins: prev.pins.map(pin => {
        if (pin.id !== id) return pin;
        if (pin.kind === 'control' || pin.kind === 'bone') {
          return { ...pin, angle };
        }
        return pin;
      }),
    }));
  }, []);
  
  const updatePinScale = useCallback((id: string, scale: number) => {
    setState(prev => ({
      ...prev,
      pins: prev.pins.map(pin => {
        if (pin.id !== id) return pin;
        if (pin.kind === 'control') {
          return { ...pin, scale: Math.max(0.1, Math.min(3, scale)) };
        }
        return pin;
      }),
    }));
  }, []);
  
  const updatePinDepth = useCallback((id: string, depth: number) => {
    setState(prev => ({
      ...prev,
      pins: prev.pins.map(pin => {
        if (pin.id !== id) return pin;
        if (pin.kind === 'control') {
          return { ...pin, target: { ...pin.target, z: depth } };
        }
        return pin;
      }),
    }));
  }, []);
  
  const updatePinFalloff = useCallback((id: string, falloff: FalloffCurve) => {
    setState(prev => ({
      ...prev,
      pins: prev.pins.map(pin => {
        if (pin.id !== id) return pin;
        if (pin.kind === 'control' || pin.kind === 'bone') {
          return { ...pin, falloff };
        }
        return pin;
      }),
    }));
  }, []);
  
  const updatePinColor = useCallback((id: string, color: string) => {
    setState(prev => ({
      ...prev,
      pins: prev.pins.map(pin => 
        pin.id === id ? { ...pin, color } : pin
      ),
    }));
  }, []);
  
  const lockPin = useCallback((id: string, locked: boolean) => {
    setState(prev => ({
      ...prev,
      pins: prev.pins.map(pin => 
        pin.id === id ? { ...pin, locked } : pin
      ),
    }));
  }, []);
  
  // ============================================
  // CONNECTIONS
  // ============================================
  
  const addConnection = useCallback((
    fromId: string, 
    toId: string, 
    type: ConnectionType = 'elastic'
  ): string | null => {
    const from = stateRef.current.pins.find(p => p.id === fromId);
    const to = stateRef.current.pins.find(p => p.id === toId);
    
    if (!from || !to) return null;
    
    // Calculate rest length - all pins have 'target' in our system
    const getPos = (pin: AdvancedPin): Vec2 => {
      if (pin.kind === 'control') {
        return { x: pin.target.x, y: pin.target.y };
      }
      return pin.target;
    };
    
    const fromPos = getPos(from);
    const toPos = getPos(to);
    
    const restLength = v2.dist(fromPos, toPos);
    const connection = createConnection(fromId, toId, type, restLength);
    
    setState(prev => {
      // Check for duplicate
      const exists = prev.connections.some(
        c => (c.fromId === fromId && c.toId === toId) || 
             (c.fromId === toId && c.toId === fromId)
      );
      if (exists) return prev;
      
      // Update cage pin connection lists
      const pins = prev.pins.map(p => {
        if (p.kind === 'cage') {
          if (p.id === fromId) {
            return { ...p, connections: [...p.connections, toId] };
          }
          if (p.id === toId) {
            return { ...p, connections: [...p.connections, fromId] };
          }
        }
        return p;
      });
      
      return {
        ...prev,
        pins,
        connections: [...prev.connections, connection],
      };
    });
    
    return connection.id;
  }, []);
  
  const removeConnection = useCallback((id: string) => {
    setState(prev => {
      const conn = prev.connections.find(c => c.id === id);
      if (!conn) return prev;
      
      // Update cage pin connection lists
      const pins = prev.pins.map(p => {
        if (p.kind === 'cage') {
          if (p.id === conn.fromId) {
            return { ...p, connections: p.connections.filter(cid => cid !== conn.toId) };
          }
          if (p.id === conn.toId) {
            return { ...p, connections: p.connections.filter(cid => cid !== conn.fromId) };
          }
        }
        return p;
      });
      
      return {
        ...prev,
        pins,
        connections: prev.connections.filter(c => c.id !== id),
      };
    });
  }, []);
  
  const updateConnectionStrength = useCallback((id: string, strength: number) => {
    setState(prev => ({
      ...prev,
      connections: prev.connections.map(c =>
        c.id === id ? { ...c, strength: Math.max(0, Math.min(1, strength)) } : c
      ),
    }));
  }, []);
  
  const updateConnectionType = useCallback((id: string, type: ConnectionType) => {
    setState(prev => ({
      ...prev,
      connections: prev.connections.map(c =>
        c.id === id ? { 
          ...c, 
          type, 
          strength: type === 'rigid' ? 1 : c.strength,
          color: type === 'rigid' ? '#ef4444' : type === 'bezier' ? '#a855f7' : '#64748b',
        } : c
      ),
    }));
  }, []);
  
  const autoConnectCagePins = useCallback((mode: 'nearest' | 'sequential' | 'mesh') => {
    setState(prev => {
      const cagePins = prev.pins.filter(p => p.kind === 'cage') as CagePin[];
      if (cagePins.length < 2) return prev;
      
      const newConnections: PinConnection[] = [];
      const updatedPins = [...prev.pins];
      
      if (mode === 'sequential') {
        // Connect each cage pin to the next one
        for (let i = 0; i < cagePins.length - 1; i++) {
          const from = cagePins[i];
          const to = cagePins[i + 1];
          const restLength = v2.dist(from.target, to.target);
          newConnections.push(createConnection(from.id, to.id, 'rigid', restLength));
        }
        // Close the loop
        if (cagePins.length > 2) {
          const from = cagePins[cagePins.length - 1];
          const to = cagePins[0];
          const restLength = v2.dist(from.target, to.target);
          newConnections.push(createConnection(from.id, to.id, 'rigid', restLength));
        }
      } else if (mode === 'nearest') {
        // Connect each cage pin to its 2 nearest neighbors
        for (const pin of cagePins) {
          const others = cagePins
            .filter(p => p.id !== pin.id)
            .map(p => ({ pin: p, dist: v2.dist(pin.target, p.target) }))
            .sort((a, b) => a.dist - b.dist)
            .slice(0, 2);
          
          for (const { pin: other, dist } of others) {
            // Check if connection already exists
            const exists = newConnections.some(
              c => (c.fromId === pin.id && c.toId === other.id) ||
                   (c.fromId === other.id && c.toId === pin.id)
            );
            if (!exists) {
              newConnections.push(createConnection(pin.id, other.id, 'rigid', dist));
            }
          }
        }
      } else if (mode === 'mesh') {
        // Connect all cage pins to all others (full mesh)
        for (let i = 0; i < cagePins.length; i++) {
          for (let j = i + 1; j < cagePins.length; j++) {
            const from = cagePins[i];
            const to = cagePins[j];
            const restLength = v2.dist(from.target, to.target);
            newConnections.push(createConnection(from.id, to.id, 'elastic', restLength, {
              strength: 0.5,
            }));
          }
        }
      }
      
      return {
        ...prev,
        connections: [...prev.connections, ...newConnections],
      };
    });
  }, []);
  
  // ============================================
  // GROUPS
  // ============================================
  
  const createGroup = useCallback((name: string, pinIds: string[]): string => {
    const groupId = generateAdvancedPinId('group');
    
    setState(prev => ({
      ...prev,
      groups: [...prev.groups, {
        id: groupId,
        name,
        pinIds,
        color: '#6366f1',
        locked: false,
        visible: true,
      }],
      pins: prev.pins.map(p => 
        pinIds.includes(p.id) ? { ...p, groupId } : p
      ),
    }));
    
    return groupId;
  }, []);
  
  const addToGroup = useCallback((groupId: string, pinIds: string[]) => {
    setState(prev => ({
      ...prev,
      groups: prev.groups.map(g => 
        g.id === groupId ? { ...g, pinIds: [...new Set([...g.pinIds, ...pinIds])] } : g
      ),
      pins: prev.pins.map(p => 
        pinIds.includes(p.id) ? { ...p, groupId } : p
      ),
    }));
  }, []);
  
  const removeFromGroup = useCallback((groupId: string, pinIds: string[]) => {
    setState(prev => ({
      ...prev,
      groups: prev.groups.map(g => 
        g.id === groupId ? { ...g, pinIds: g.pinIds.filter(id => !pinIds.includes(id)) } : g
      ),
      pins: prev.pins.map(p => 
        pinIds.includes(p.id) ? { ...p, groupId: undefined } : p
      ),
    }));
  }, []);
  
  const deleteGroup = useCallback((id: string) => {
    setState(prev => ({
      ...prev,
      groups: prev.groups.filter(g => g.id !== id),
      pins: prev.pins.map(p => 
        p.groupId === id ? { ...p, groupId: undefined } : p
      ),
    }));
  }, []);
  
  // ============================================
  // BONES / IK
  // ============================================
  
  const solveBoneIK = useCallback((tipBoneId: string, target: Vec2) => {
    setState(prev => {
      const tipBone = prev.pins.find(p => p.id === tipBoneId) as BonePin | undefined;
      if (!tipBone || tipBone.kind !== 'bone' || !tipBone.ikEnabled) return prev;
      
      // Build chain from tip back to root
      const chain: BonePin[] = [tipBone];
      let current = tipBone;
      
      for (let i = 0; i < tipBone.ikChainLength; i++) {
        const parent = prev.pins.find(p => p.kind === 'bone' && (p as BonePin).childId === current.id) as BonePin | undefined;
        if (!parent) break;
        chain.unshift(parent);
        current = parent;
      }
      
      if (chain.length < 2) return prev;
      
      // Simple 2-bone IK for now
      if (chain.length >= 2) {
        const root = chain[0];
        const result = solveTwoBoneIK(
          root.pos,
          target,
          chain[0].length,
          chain[1].length
        );
        
        if (result) {
          const pins = prev.pins.map(p => {
            if (p.id === chain[0].id) {
              return { ...p, angle: result.angle1 } as BonePin;
            }
            if (p.id === chain[1].id) {
              // Update position to be at end of first bone
              const newPos = {
                x: root.pos.x + Math.cos(result.angle1) * chain[0].length,
                y: root.pos.y + Math.sin(result.angle1) * chain[0].length,
              };
              return { 
                ...p, 
                pos: newPos,
                target: newPos,
                angle: result.angle1 + result.angle2,
              } as BonePin;
            }
            return p;
          });
          
          return { ...prev, pins };
        }
      }
      
      return prev;
    });
  }, []);
  
  // ============================================
  // SETTINGS
  // ============================================
  
  const setDepthSettings = useCallback((settings: Partial<DepthSettings>) => {
    setState(prev => ({
      ...prev,
      depthSettings: { ...prev.depthSettings, ...settings },
    }));
  }, []);
  
  const setSymmetryMode = useCallback((mode: SymmetryMode) => {
    setState(prev => ({ ...prev, symmetryMode: mode }));
  }, []);
  
  const toggleShowConnections = useCallback(() => {
    setState(prev => ({ ...prev, showConnections: !prev.showConnections }));
  }, []);
  
  const toggleShowInfluence = useCallback(() => {
    setState(prev => ({ ...prev, showInfluence: !prev.showInfluence }));
  }, []);
  
  const toggleShowMesh = useCallback(() => {
    setState(prev => ({ ...prev, showMesh: !prev.showMesh }));
  }, []);
  
  // ============================================
  // QUERY
  // ============================================
  
  const getPinById = useCallback((id: string): AdvancedPin | undefined => {
    return stateRef.current.pins.find(p => p.id === id);
  }, []);
  
  const getPinAtPoint = useCallback((point: Vec2, tolerance = 15): AdvancedPin | null => {
    const { pins } = stateRef.current;
    
    for (let i = pins.length - 1; i >= 0; i--) {
      const pin = pins[i];
      const target = pin.kind === 'control' 
        ? { x: pin.target.x, y: pin.target.y }
        : pin.target;
      
      if (v2.dist(point, target) <= tolerance) {
        return pin;
      }
    }
    
    return null;
  }, []);
  
  const getConnectionsForPin = useCallback((pinId: string): PinConnection[] => {
    return stateRef.current.connections.filter(
      c => c.fromId === pinId || c.toId === pinId
    );
  }, []);
  
  const getConnectedPins = useCallback((pinId: string): AdvancedPin[] => {
    const connections = getConnectionsForPin(pinId);
    const connectedIds = connections.map(c => c.fromId === pinId ? c.toId : c.fromId);
    return stateRef.current.pins.filter(p => connectedIds.includes(p.id));
  }, [getConnectionsForPin]);
  
  const getBoneChain = useCallback((startBoneId: string): BonePin[] => {
    const chain: BonePin[] = [];
    let current = stateRef.current.pins.find(p => p.id === startBoneId) as BonePin | undefined;
    
    while (current && current.kind === 'bone') {
      chain.push(current);
      if (!current.childId) break;
      current = stateRef.current.pins.find(p => p.id === current!.childId) as BonePin | undefined;
    }
    
    return chain;
  }, []);
  
  // ============================================
  // RESET
  // ============================================
  
  const reset = useCallback(() => {
    setState(DEFAULT_ADVANCED_WARP_STATE);
  }, []);
  
  const clearAllPins = useCallback(() => {
    setState(prev => ({
      ...prev,
      pins: [],
      connections: [],
      groups: [],
      selectedPinIds: [],
      draggingPinId: null,
    }));
  }, []);
  
  return {
    state,
    setToolMode,
    addCagePin,
    addControlPin,
    addBonePin,
    selectPin,
    selectPins,
    clearSelection,
    deleteSelectedPins,
    deletePin,
    startDrag,
    updateDrag,
    endDrag,
    updatePinPosition,
    updatePinRadius,
    updatePinStrength,
    updatePinAngle,
    updatePinScale,
    updatePinDepth,
    updatePinFalloff,
    updatePinColor,
    lockPin,
    addConnection,
    removeConnection,
    updateConnectionStrength,
    updateConnectionType,
    autoConnectCagePins,
    createGroup,
    addToGroup,
    removeFromGroup,
    deleteGroup,
    solveBoneIK,
    setDepthSettings,
    setSymmetryMode,
    toggleShowConnections,
    toggleShowInfluence,
    toggleShowMesh,
    getPinById,
    getPinAtPoint,
    getConnectionsForPin,
    getConnectedPins,
    getBoneChain,
    reset,
    clearAllPins,
  };
}

// ============================================
// SYMMETRY HELPERS
// ============================================

function createMirroredCagePin(pin: CagePin, state: AdvancedWarpState): CagePin | null {
  // Implement symmetry based on mode
  // This is a simplified version - full implementation would need image dimensions
  if (state.symmetryMode === 'horizontal') {
    return createCagePin(
      { x: pin.pos.x, y: -pin.pos.y }, // Mirror Y
      { ...pin, id: generateAdvancedPinId('cage'), name: `${pin.name} (Mirror)` }
    );
  }
  return null;
}

function createMirroredControlPin(pin: ControlPin, state: AdvancedWarpState): ControlPin | null {
  if (state.symmetryMode === 'horizontal') {
    return createControlPin(
      { x: pin.pos.x, y: -pin.pos.y },
      { ...pin, id: generateAdvancedPinId('control'), name: `${pin.name} (Mirror)` }
    );
  }
  return null;
}
