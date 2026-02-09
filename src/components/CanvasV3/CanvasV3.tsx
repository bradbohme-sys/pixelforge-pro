/**
 * CanvasV3 - The Main V3 Canvas Component
 * 
 * V8 Features:
 * - Advanced Warp System with cage/control/bone pins
 * - Visual rendering for connections, bone chains, depth indicators
 * - Integrated Lasso system with multiple variants
 * - Edge map debug overlay
 */

import React, { useRef, useLayoutEffect, useState, useCallback, useEffect } from 'react';
import { CoordinateSystem } from './CoordinateSystem';
import { RenderPipeline } from './RenderPipeline';
import { PanZoomHandler } from './PanZoomHandler';
import { V3MagicWandHandler } from './V3MagicWandHandler';
import {
  DEFAULT_CANVAS_WIDTH,
  DEFAULT_CANVAS_HEIGHT,
  SELECTION_COLOR,
  HOVER_PREVIEW_COLOR,
} from './constants';
import type { CanvasState, Layer, ToolType, SelectionMask, HoverPreview, WandOptions, SelectionMode } from './types';
import type { ExpansionMode } from './preview';
import { 
  createLassoHandler, 
  BaseLassoHandler,
  type LassoSettings,
  type LassoPath,
  type LassoMetrics,
  type EdgeMap,
  DEFAULT_LASSO_SETTINGS,
} from './lasso';
import type { Vec2, RenderMesh } from './TesseraWarp/types';
import { v2 } from './TesseraWarp/types';
import { WebGLWarpRenderer, type TransformMatrix } from './TesseraWarp/WebGLRenderer';
import type { AdvancedWarpState, AdvancedPin, Vec3, ConnectionType } from './TesseraWarp/AdvancedPinTypes';
import { drawAdvancedWarpOverlay } from './TesseraWarp/AdvancedPinRenderer';

// ============================================
// HIGH-DPI INITIALIZATION
// ============================================

function initializeHighDPICanvas(canvas: HTMLCanvasElement): number {
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  
  canvas.style.width = `${rect.width}px`;
  canvas.style.height = `${rect.height}px`;
  
  return dpr;
}

// ============================================
// PROPS
// ============================================

interface CanvasV3Props {
  layers: Layer[];
  activeTool: ToolType;
  wandOptions?: WandOptions;
  lassoSettings?: LassoSettings;
  expansionMode?: ExpansionMode;
  documentWidth?: number;
  documentHeight?: number;
  showEdgeMapOverlay?: boolean;
  edgeMapColorScheme?: 'heat' | 'grayscale' | 'direction';
  // Advanced Warp props
  advancedWarpState?: AdvancedWarpState;
  onAdvancedWarpAddCagePin?: (pos: Vec2) => string;
  onAdvancedWarpAddControlPin?: (pos: Vec2) => string;
  onAdvancedWarpAddBonePin?: (pos: Vec2, length: number, parentId?: string) => string;
  onAdvancedWarpSelectPin?: (id: string | null, addToSelection?: boolean) => void;
  onAdvancedWarpDeletePin?: (id: string) => void;
  onAdvancedWarpStartDrag?: (id: string) => void;
  onAdvancedWarpUpdateDrag?: (target: Vec2 | Vec3, angle?: number) => void;
  onAdvancedWarpEndDrag?: () => void;
  onAdvancedWarpAddConnection?: (fromId: string, toId: string, type?: ConnectionType) => string | null;
  advancedWarpGetPinAtPoint?: (point: Vec2, tolerance?: number) => AdvancedPin | null;
  // Callbacks
  onSelectionChange?: (mask: SelectionMask | null) => void;
  onZoomChange?: (zoom: number) => void;
  onToleranceChange?: (tolerance: number) => void;
  onLassoMetricsChange?: (metrics: LassoMetrics) => void;
  onError?: (message: string) => void;
}

// ============================================
// COMPONENT
// ============================================

export const CanvasV3: React.FC<CanvasV3Props> = ({
  layers,
  activeTool,
  wandOptions,
  lassoSettings,
  expansionMode = 'fast',
  documentWidth = DEFAULT_CANVAS_WIDTH,
  documentHeight = DEFAULT_CANVAS_HEIGHT,
  showEdgeMapOverlay = false,
  edgeMapColorScheme = 'heat',
  // Advanced Warp props
  advancedWarpState,
  onAdvancedWarpAddCagePin,
  onAdvancedWarpAddControlPin,
  onAdvancedWarpAddBonePin,
  onAdvancedWarpSelectPin,
  onAdvancedWarpDeletePin,
  onAdvancedWarpStartDrag,
  onAdvancedWarpUpdateDrag,
  onAdvancedWarpEndDrag,
  onAdvancedWarpAddConnection,
  advancedWarpGetPinAtPoint,
  // Callbacks
  onSelectionChange,
  onZoomChange,
  onToleranceChange,
  onLassoMetricsChange,
  onError,
}) => {
  const mainCanvasRef = useRef<HTMLCanvasElement>(null);
  const interactionCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const coordSystemRef = useRef<CoordinateSystem | null>(null);
  const renderPipelineRef = useRef<RenderPipeline | null>(null);
  const panZoomHandlerRef = useRef<PanZoomHandler | null>(null);
  const magicWandHandlerRef = useRef<V3MagicWandHandler | null>(null);
  const lassoHandlerRef = useRef<BaseLassoHandler | null>(null);
  const interactionRafIdRef = useRef<number | null>(null);
  
  // Advanced Warp refs
  const advancedWarpStateRef = useRef<AdvancedWarpState | undefined>(advancedWarpState);
  advancedWarpStateRef.current = advancedWarpState;
  
  // Connection drawing state
  const [connectFromPinId, setConnectFromPinId] = useState<string | null>(null);
  
  const imageCache = useRef<Map<string, HTMLImageElement>>(new Map());
  
  const stateRef = useRef<CanvasState>({
    panX: 0,
    panY: 0,
    zoom: 1,
    layers: [],
  });
  
  const [zoomPercent, setZoomPercent] = useState(100);
  const [hoverPreview, setHoverPreview] = useState<HoverPreview | null>(null);
  const [currentSelection, setCurrentSelection] = useState<SelectionMask | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cursorPosition, setCursorPosition] = useState<{ x: number; y: number } | null>(null);
  const [currentTolerance, setCurrentTolerance] = useState(wandOptions?.tolerance ?? 32);
  const [lassoPath, setLassoPath] = useState<LassoPath | null>(null);
  const [edgeMap, setEdgeMap] = useState<EdgeMap | null>(null);

  // Refs for animation loop (to avoid stale closure)
  const hoverPreviewRef = useRef<HoverPreview | null>(null);
  const currentSelectionRef = useRef<SelectionMask | null>(null);
  const activeToolRef = useRef<ToolType>(activeTool);
  const lassoHandlerStateRef = useRef<BaseLassoHandler | null>(null);

  // Keep refs in sync with state
  useEffect(() => {
    hoverPreviewRef.current = hoverPreview;
  }, [hoverPreview]);

  useEffect(() => {
    currentSelectionRef.current = currentSelection;
  }, [currentSelection]);

  useEffect(() => {
    activeToolRef.current = activeTool;
  }, [activeTool]);

  useEffect(() => {
    lassoHandlerStateRef.current = lassoHandlerRef.current;
  });

  // ============================================
  // LAYER LOADING
  // ============================================

  const loadLayerImage = useCallback((layer: Layer): Promise<HTMLImageElement | null> => {
    return new Promise((resolve) => {
      const cached = imageCache.current.get(layer.id);
      if (cached && cached.complete) {
        resolve(cached);
        return;
      }
      
      const dataUrl = layer.dataUrl || layer.imageUrl;
      if (!dataUrl) {
        resolve(null);
        return;
      }
      
      const img = new Image();
      
      if (!dataUrl.startsWith('data:')) {
        img.crossOrigin = 'anonymous';
      }
      
      img.onload = () => {
        imageCache.current.set(layer.id, img);
        resolve(img);
        renderPipelineRef.current?.markLayersDirty();
        magicWandHandlerRef.current?.markImageDataDirty();
      };
      
      img.onerror = () => {
        resolve(null);
      };
      
      imageCache.current.set(layer.id, img);
      img.src = dataUrl;
    });
  }, []);

  useEffect(() => {
    const loadAllImages = async () => {
      const loadedLayers: Layer[] = [];
      
      for (const layer of layers) {
        const image = await loadLayerImage(layer);
        loadedLayers.push({
          ...layer,
          image: image || layer.image,
        });
      }
      
      stateRef.current.layers = loadedLayers;
      renderPipelineRef.current?.markLayersDirty();
      
      if (magicWandHandlerRef.current) {
        magicWandHandlerRef.current.updateLayers(loadedLayers, imageCache.current);
      }
      
      if (lassoHandlerRef.current) {
        lassoHandlerRef.current.updateLayers(loadedLayers, imageCache.current);
      }
    };
    
    loadAllImages();
  }, [layers, loadLayerImage]);

  // ============================================
  // LASSO HANDLER INITIALIZATION
  // ============================================

  useEffect(() => {
    if (!coordSystemRef.current) return;
    
    const variant = lassoSettings?.variant ?? DEFAULT_LASSO_SETTINGS.variant;
    
    lassoHandlerRef.current = createLassoHandler(
      variant,
      coordSystemRef.current,
      stateRef.current.layers,
      imageCache.current
    );
    
    if (lassoSettings) {
      lassoHandlerRef.current.updateSettings(lassoSettings);
    }
    
    lassoHandlerRef.current.setOnPathChange((path) => {
      setLassoPath(path);
    });
    
    lassoHandlerRef.current.setOnSelectionComplete((mask) => {
      setCurrentSelection(mask);
      onSelectionChange?.(mask);
    });
    
    lassoHandlerRef.current.setOnMetricsUpdate((metrics) => {
      onLassoMetricsChange?.(metrics);
      const em = lassoHandlerRef.current?.['edgeEngine']?.getEdgeMap();
      if (em) setEdgeMap(em);
    });
    
    lassoHandlerRef.current.setOnError((msg) => {
      setError(msg);
      onError?.(msg);
    });
    
    return () => {
      lassoHandlerRef.current = null;
    };
  }, [lassoSettings?.variant, onSelectionChange, onLassoMetricsChange, onError]);

  useEffect(() => {
    if (lassoHandlerRef.current && lassoSettings) {
      lassoHandlerRef.current.updateSettings(lassoSettings);
    }
  }, [lassoSettings]);

  // ============================================
  // KEYBOARD SHORTCUTS FOR LASSO
  // ============================================

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      
      if (activeTool !== 'lasso' || !lassoHandlerRef.current) return;
      
      const state = lassoHandlerRef.current.getState();
      
      if (e.key === 'Escape') {
        e.preventDefault();
        lassoHandlerRef.current.cancel();
        setLassoPath(null);
      } else if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault();
        if (state === 'drawing' && 'undoLastAnchor' in lassoHandlerRef.current) {
          (lassoHandlerRef.current as any).undoLastAnchor();
        }
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (state === 'drawing') {
          lassoHandlerRef.current.complete();
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTool]);

  // ============================================
  // KEYBOARD SHORTCUTS FOR ADVANCED WARP
  // ============================================

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (activeTool !== 'warp' || !advancedWarpState) return;
      
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (advancedWarpState.selectedPinIds.length > 0 && onAdvancedWarpDeletePin) {
          e.preventDefault();
          for (const id of advancedWarpState.selectedPinIds) {
            onAdvancedWarpDeletePin(id);
          }
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        if (advancedWarpState.draggingPinId) {
          onAdvancedWarpEndDrag?.();
        } else if (connectFromPinId) {
          setConnectFromPinId(null);
        } else {
          onAdvancedWarpSelectPin?.(null);
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTool, advancedWarpState?.selectedPinIds, advancedWarpState?.draggingPinId, connectFromPinId, onAdvancedWarpDeletePin, onAdvancedWarpEndDrag, onAdvancedWarpSelectPin]);

  // ============================================
  // INITIALIZATION
  // ============================================

  useLayoutEffect(() => {
    const mainCanvas = mainCanvasRef.current;
    const interactionCanvas = interactionCanvasRef.current;
    const container = containerRef.current;
    
    if (!mainCanvas || !interactionCanvas || !container) return;
    
    initializeHighDPICanvas(mainCanvas);
    initializeHighDPICanvas(interactionCanvas);
    
    coordSystemRef.current = new CoordinateSystem(mainCanvas);
    coordSystemRef.current.setDocumentSize(documentWidth, documentHeight);
    
    renderPipelineRef.current = new RenderPipeline(documentWidth, documentHeight);
    renderPipelineRef.current.start(mainCanvas, coordSystemRef.current, stateRef);
    
    // Interaction render loop
    const interactionLoop = (time: number) => {
      const ctx = interactionCanvas.getContext('2d');
      if (ctx && coordSystemRef.current) {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, interactionCanvas.width, interactionCanvas.height);
        
        // Draw edge map overlay if enabled
        if (showEdgeMapOverlay && edgeMap) {
          ctx.save();
          coordSystemRef.current.applyTransform(ctx);
          drawEdgeMapOverlay(ctx, edgeMap, edgeMapColorScheme);
          ctx.restore();
        }
        
        // Draw selection overlay with marching ants
        const selection = currentSelectionRef.current;
        if (selection?.data) {
          ctx.save();
          coordSystemRef.current.applyTransform(ctx);
          drawSelectionOverlay(ctx, selection, SELECTION_COLOR, time);
          ctx.restore();
        }
        
        // Draw hover preview for magic wand
        const preview = hoverPreviewRef.current;
        const currentTool = activeToolRef.current;
        if (preview?.mask?.data && currentTool === 'magic-wand') {
          ctx.save();
          coordSystemRef.current.applyTransform(ctx);
          magicWandHandlerRef.current?.drawInstantSeed(ctx);
          drawSelectionOverlay(ctx, preview.mask, HOVER_PREVIEW_COLOR, time);
          ctx.restore();
        }
        
        // Draw lasso path
        const lassoHandler = lassoHandlerStateRef.current;
        if (lassoHandler && currentTool === 'lasso') {
          ctx.save();
          coordSystemRef.current.applyTransform(ctx);
          lassoHandler.draw(ctx);
          ctx.restore();
        }
        
        // Draw advanced warp overlay
        const warpData = advancedWarpStateRef.current;
        if (currentTool === 'warp' && warpData && warpData.pins.length > 0) {
          ctx.save();
          coordSystemRef.current.applyTransform(ctx);
          drawAdvancedWarpOverlay(ctx, warpData);
          ctx.restore();
        }
      }
      interactionRafIdRef.current = requestAnimationFrame(interactionLoop);
    };
    interactionRafIdRef.current = requestAnimationFrame(interactionLoop);
    
    panZoomHandlerRef.current = new PanZoomHandler(
      coordSystemRef.current,
      interactionCanvas,
      handlePanZoomUpdate
    );
    
    magicWandHandlerRef.current = new V3MagicWandHandler(
      coordSystemRef.current,
      stateRef.current.layers,
      imageCache.current
    );
    
    magicWandHandlerRef.current.setOnSelectionChange((mask) => {
      setCurrentSelection(mask);
      onSelectionChange?.(mask);
    });
    
    magicWandHandlerRef.current.setOnHoverPreviewChange(setHoverPreview);
    
    magicWandHandlerRef.current.setOnToleranceChange((tol) => {
      setCurrentTolerance(tol);
      onToleranceChange?.(tol);
    });
    
    magicWandHandlerRef.current.setOnError((msg) => {
      setError(msg);
      onError?.(msg);
    });
    
    // Resize observer
    const resizeObserver = new ResizeObserver(() => {
      initializeHighDPICanvas(mainCanvas);
      initializeHighDPICanvas(interactionCanvas);
      coordSystemRef.current?.updateBounds();
      renderPipelineRef.current?.markLayersDirty();
    });
    resizeObserver.observe(container);
    
    renderPipelineRef.current.markLayersDirty();
    
    return () => {
      renderPipelineRef.current?.stop();
      panZoomHandlerRef.current?.destroy();
      magicWandHandlerRef.current?.terminate();
      resizeObserver.disconnect();
      if (interactionRafIdRef.current !== null) {
        cancelAnimationFrame(interactionRafIdRef.current);
      }
    };
  }, [showEdgeMapOverlay, edgeMapColorScheme]);

  // Update wand options
  useEffect(() => {
    if (magicWandHandlerRef.current && wandOptions) {
      magicWandHandlerRef.current.tolerance = wandOptions.tolerance;
      magicWandHandlerRef.current.contiguous = wandOptions.contiguous;
      magicWandHandlerRef.current.setConnectivity(wandOptions.connectivity);
      magicWandHandlerRef.current.setFeather(wandOptions.feather);
      setCurrentTolerance(wandOptions.tolerance);
    }
  }, [wandOptions]);

  // Update expansion mode
  useEffect(() => {
    if (magicWandHandlerRef.current) {
      magicWandHandlerRef.current.setExpansionMode(expansionMode);
    }
  }, [expansionMode]);

  // Update pan mode based on tool
  useEffect(() => {
    if (panZoomHandlerRef.current) {
      panZoomHandlerRef.current.setPanMode(activeTool === 'pan');
    }
  }, [activeTool]);

  // Update document dimensions when they change
  useEffect(() => {
    if (coordSystemRef.current) {
      coordSystemRef.current.setDocumentSize(documentWidth, documentHeight);
    }
    if (renderPipelineRef.current) {
      renderPipelineRef.current.resizeCache(documentWidth, documentHeight);
      renderPipelineRef.current.markLayersDirty();
    }
    if (magicWandHandlerRef.current) {
      magicWandHandlerRef.current.markImageDataDirty();
    }
    if (lassoHandlerRef.current) {
      lassoHandlerRef.current.markImageDataDirty();
    }
  }, [documentWidth, documentHeight]);

  // Hide main canvas layers when warp is active to prevent double rendering
  useEffect(() => {
    if (renderPipelineRef.current) {
      const shouldHide = activeTool === 'warp' && advancedWarpState !== undefined && advancedWarpState.pins.length > 0;
      renderPipelineRef.current.setHideLayerContent(shouldHide);
    }
  }, [activeTool, advancedWarpState?.pins.length]);

  const handlePanZoomUpdate = useCallback(() => {
    if (!coordSystemRef.current) return;
    
    stateRef.current.panX = coordSystemRef.current.panX;
    stateRef.current.panY = coordSystemRef.current.panY;
    stateRef.current.zoom = coordSystemRef.current.zoom;
    
    const newZoom = Math.round(coordSystemRef.current.zoom * 100);
    setZoomPercent(newZoom);
    onZoomChange?.(coordSystemRef.current.zoom);
    
    renderPipelineRef.current?.markLayersDirty();
  }, [onZoomChange]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!coordSystemRef.current) return;
    
    if (panZoomHandlerRef.current?.isInteracting) return;
    
    const worldPoint = coordSystemRef.current.screenToWorld(e.clientX, e.clientY);
    setCursorPosition(worldPoint);
    
    if (activeTool === 'magic-wand' && magicWandHandlerRef.current) {
      magicWandHandlerRef.current.handleHover(e.clientX, e.clientY);
    }
    
    if (activeTool === 'lasso' && lassoHandlerRef.current) {
      lassoHandlerRef.current.handleMove(e.clientX, e.clientY);
    }
    
    // Handle advanced warp drag
    if (activeTool === 'warp' && advancedWarpState?.draggingPinId && onAdvancedWarpUpdateDrag) {
      onAdvancedWarpUpdateDrag({ x: worldPoint.x, y: worldPoint.y });
    }
  }, [activeTool, advancedWarpState?.draggingPinId, onAdvancedWarpUpdateDrag]);

  const handleClick = useCallback((e: React.MouseEvent) => {
    if (!coordSystemRef.current) return;
    if (panZoomHandlerRef.current?.isInteracting) return;
    
    if (activeTool === 'magic-wand' && magicWandHandlerRef.current) {
      let selectionMode: SelectionMode = 'replace';
      if (e.shiftKey) selectionMode = 'add';
      else if (e.altKey) selectionMode = 'subtract';
      magicWandHandlerRef.current.handleClick(e.clientX, e.clientY, selectionMode);
    }
    
    if (activeTool === 'lasso' && lassoHandlerRef.current) {
      lassoHandlerRef.current.handleClick(e.clientX, e.clientY);
    }
    
    // Handle advanced warp interactions
    if (activeTool === 'warp' && advancedWarpState) {
      const worldPoint = coordSystemRef.current.screenToWorld(e.clientX, e.clientY);
      const pos: Vec2 = { x: worldPoint.x, y: worldPoint.y };
      const zoom = coordSystemRef.current.zoom;
      const adjustedTolerance = 15 / zoom;
      
      // Check if clicking on existing pin
      const clickedPin = advancedWarpGetPinAtPoint?.(pos, adjustedTolerance);
      
      if (advancedWarpState.toolMode === 'connect') {
        // Connection mode: click first pin, then second to connect
        if (clickedPin) {
          if (connectFromPinId) {
            if (clickedPin.id !== connectFromPinId) {
              onAdvancedWarpAddConnection?.(connectFromPinId, clickedPin.id);
            }
            setConnectFromPinId(null);
          } else {
            setConnectFromPinId(clickedPin.id);
          }
        } else {
          setConnectFromPinId(null);
        }
      } else if (advancedWarpState.toolMode === 'disconnect') {
        // Disconnect mode - handled via panel
      } else if (clickedPin) {
        // Select existing pin
        onAdvancedWarpSelectPin?.(clickedPin.id, e.shiftKey);
      } else {
        // Add new pin based on tool mode
        switch (advancedWarpState.toolMode) {
          case 'cage':
            onAdvancedWarpAddCagePin?.(pos);
            break;
          case 'control':
            onAdvancedWarpAddControlPin?.(pos);
            break;
          case 'bone':
            const lastBone = advancedWarpState.selectedPinIds.length > 0
              ? advancedWarpState.pins.find(p => p.id === advancedWarpState.selectedPinIds[0] && p.kind === 'bone')
              : null;
            onAdvancedWarpAddBonePin?.(pos, 50, lastBone?.id);
            break;
          case 'select':
          case 'adjust':
            // Deselect
            onAdvancedWarpSelectPin?.(null);
            break;
        }
      }
    }
  }, [activeTool, advancedWarpState, connectFromPinId, advancedWarpGetPinAtPoint, onAdvancedWarpSelectPin, onAdvancedWarpAddCagePin, onAdvancedWarpAddControlPin, onAdvancedWarpAddBonePin, onAdvancedWarpAddConnection]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (!coordSystemRef.current) return;
    if (panZoomHandlerRef.current?.isInteracting) return;
    
    // Handle advanced warp pin drag start
    if (activeTool === 'warp' && advancedWarpState) {
      const worldPoint = coordSystemRef.current.screenToWorld(e.clientX, e.clientY);
      const pos: Vec2 = { x: worldPoint.x, y: worldPoint.y };
      const zoom = coordSystemRef.current.zoom;
      const adjustedTolerance = 15 / zoom;
      
      const clickedPin = advancedWarpGetPinAtPoint?.(pos, adjustedTolerance);
      
      if (clickedPin && (advancedWarpState.toolMode === 'select' || advancedWarpState.toolMode === 'adjust')) {
        onAdvancedWarpStartDrag?.(clickedPin.id);
        e.preventDefault();
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
      }
    }
  }, [activeTool, advancedWarpState, advancedWarpGetPinAtPoint, onAdvancedWarpStartDrag]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    // End advanced warp drag
    if (activeTool === 'warp' && advancedWarpState?.draggingPinId) {
      onAdvancedWarpEndDrag?.();
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    }
  }, [activeTool, advancedWarpState?.draggingPinId, onAdvancedWarpEndDrag]);

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    if (!coordSystemRef.current) return;
    if (panZoomHandlerRef.current?.isInteracting) return;
    
    if (activeTool === 'lasso' && lassoHandlerRef.current) {
      lassoHandlerRef.current.handleDoubleClick(e.clientX, e.clientY);
    }
  }, [activeTool]);

  const handlePointerLeave = useCallback(() => {
    setCursorPosition(null);
    if (magicWandHandlerRef.current) {
      magicWandHandlerRef.current.clearHoverPreview();
    }
    setHoverPreview(null);
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (activeTool === 'magic-wand' && magicWandHandlerRef.current) {
      const isHovering = hoverPreview !== null || cursorPosition !== null;
      
      if (isHovering && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        e.stopPropagation();
        magicWandHandlerRef.current.handleWheel(e.deltaY);
        return;
      }
    }
  }, [activeTool, hoverPreview, cursorPosition]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
  }, []);

  // Determine warp tool mode hint
  const getWarpHint = (): string => {
    if (!advancedWarpState) return '';
    switch (advancedWarpState.toolMode) {
      case 'cage': return 'Click to place cage pin (boundary lock)';
      case 'control': return 'Click to place control pin (push/pull/rotate)';
      case 'bone': return 'Click to place bone joint (IK chain)';
      case 'connect': return connectFromPinId ? 'Click another pin to connect' : 'Click first pin to start connection';
      case 'disconnect': return 'Click a connection to remove it';
      case 'select': return 'Click pins to select, drag to move';
      case 'adjust': return 'Drag pins to adjust, use panel for properties';
      default: return '';
    }
  };

  // ============================================
  // RENDER
  // ============================================

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full canvas-workspace overflow-hidden"
      onContextMenu={handleContextMenu}
    >
      {/* Main canvas (layers) */}
      <canvas
        ref={mainCanvasRef}
        className="absolute inset-0 w-full h-full"
        style={{ zIndex: 0 }}
      />
      
      {/* Interaction canvas (overlays, selections, warp pins) */}
      <canvas
        ref={interactionCanvasRef}
        className="absolute inset-0 w-full h-full"
        style={{ zIndex: 2, pointerEvents: 'auto' }}
        onPointerMove={handlePointerMove}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerLeave}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onWheelCapture={handleWheel}
      />
      
      {/* Status bar */}
      <div className="absolute bottom-3 right-3 flex items-center gap-3 px-3 py-1.5 bg-card/90 backdrop-blur-sm border border-border rounded-md text-xs font-mono">
        <span className="text-muted-foreground">
          {cursorPosition ? `${Math.floor(cursorPosition.x)}, ${Math.floor(cursorPosition.y)}` : '—'}
        </span>
        <span className="text-border">|</span>
        <span className="text-foreground">{zoomPercent}%</span>
        {activeTool === 'magic-wand' && (
          <>
            <span className="text-border">|</span>
            <span className="text-primary">Tol: {currentTolerance}</span>
          </>
        )}
        {activeTool === 'warp' && advancedWarpState && (
          <>
            <span className="text-border">|</span>
            <span className="text-primary">Pins: {advancedWarpState.pins.length}</span>
            <span className="text-border">|</span>
            <span className="text-muted-foreground capitalize">{advancedWarpState.toolMode}</span>
          </>
        )}
      </div>
      
      {/* Scroll hint for magic wand */}
      {activeTool === 'magic-wand' && hoverPreview && (
        <div className="absolute bottom-12 right-3 px-2 py-1 bg-card/80 backdrop-blur-sm border border-border rounded text-xs text-muted-foreground animate-fade-in">
          Scroll to adjust tolerance
        </div>
      )}
      
      {/* Warp tool hints */}
      {activeTool === 'warp' && advancedWarpState && (
        <div className="absolute bottom-12 right-3 px-2 py-1 bg-card/80 backdrop-blur-sm border border-border rounded text-xs text-muted-foreground animate-fade-in">
          {getWarpHint()}
        </div>
      )}
      
      {/* Error toast */}
      {error && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 px-4 py-2 bg-destructive/90 text-destructive-foreground rounded-md text-sm animate-fade-in">
          {error}
          <button
            onClick={() => setError(null)}
            className="ml-3 px-2 py-0.5 bg-destructive-foreground/20 rounded text-xs hover:bg-destructive-foreground/30"
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
};

// Helper to draw selection overlay with marching ants
function drawSelectionOverlay(
  ctx: CanvasRenderingContext2D,
  mask: SelectionMask,
  color: string,
  timestamp: number = 0
): void {
  const { data, width, height, bounds } = mask;
  
  const offscreen = new OffscreenCanvas(width, height);
  const offCtx = offscreen.getContext('2d');
  if (!offCtx) return;
  
  const imageData = offCtx.createImageData(width, height);
  const pixels = imageData.data;
  
  const fillR = 100, fillG = 200, fillB = 100, fillA = 80;
  const borderR = 255, borderG = 255, borderB = 255;
  
  const antOffset = Math.floor(timestamp / 100) % 8;
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      
      if (data[i] > 0) {
        const idx = i * 4;
        
        const isLeft = x > 0 && data[i - 1] === 0;
        const isRight = x < width - 1 && data[i + 1] === 0;
        const isTop = y > 0 && data[i - width] === 0;
        const isBottom = y < height - 1 && data[i + width] === 0;
        const isBorder = isLeft || isRight || isTop || isBottom;
        
        if (isBorder) {
          const antPhase = ((x + y + antOffset) % 8) < 4;
          if (antPhase) {
            pixels[idx] = borderR;
            pixels[idx + 1] = borderG;
            pixels[idx + 2] = borderB;
            pixels[idx + 3] = 220;
          } else {
            pixels[idx] = 0;
            pixels[idx + 1] = 0;
            pixels[idx + 2] = 0;
            pixels[idx + 3] = 220;
          }
        } else {
          pixels[idx] = fillR;
          pixels[idx + 1] = fillG;
          pixels[idx + 2] = fillB;
          pixels[idx + 3] = fillA;
        }
      }
    }
  }
  
  offCtx.putImageData(imageData, 0, 0);
  ctx.drawImage(offscreen, 0, 0);
}

/**
 * Draw edge map as a heatmap overlay
 */
function drawEdgeMapOverlay(
  ctx: CanvasRenderingContext2D,
  edgeMap: EdgeMap,
  colorScheme: 'heat' | 'grayscale' | 'direction' = 'heat'
): void {
  const { magnitude, direction, width, height } = edgeMap;
  
  const offscreen = new OffscreenCanvas(width, height);
  const offCtx = offscreen.getContext('2d');
  if (!offCtx) return;
  
  const imageData = offCtx.createImageData(width, height);
  const pixels = imageData.data;
  
  for (let i = 0; i < magnitude.length; i++) {
    const mag = magnitude[i];
    const dir = direction[i];
    const idx = i * 4;
    
    let r: number, g: number, b: number;
    
    if (colorScheme === 'heat') {
      const v = Math.max(0, Math.min(1, mag));
      if (v < 0.25) {
        const t = v / 0.25;
        r = 0; g = Math.floor(t * 255); b = 255;
      } else if (v < 0.5) {
        const t = (v - 0.25) / 0.25;
        r = 0; g = 255; b = Math.floor((1 - t) * 255);
      } else if (v < 0.75) {
        const t = (v - 0.5) / 0.25;
        r = Math.floor(t * 255); g = 255; b = 0;
      } else {
        const t = (v - 0.75) / 0.25;
        r = 255; g = Math.floor((1 - t) * 255); b = 0;
      }
    } else if (colorScheme === 'direction') {
      const hue = ((dir + Math.PI) / (2 * Math.PI)) * 360;
      const l = 0.2 + mag * 0.6;
      const c = (1 - Math.abs(2 * l - 1));
      const x = c * (1 - Math.abs((hue / 60) % 2 - 1));
      const m = l - c / 2;
      
      if (hue < 60) { r = c; g = x; b = 0; }
      else if (hue < 120) { r = x; g = c; b = 0; }
      else if (hue < 180) { r = 0; g = c; b = x; }
      else if (hue < 240) { r = 0; g = x; b = c; }
      else if (hue < 300) { r = x; g = 0; b = c; }
      else { r = c; g = 0; b = x; }
      
      r = Math.floor((r + m) * 255);
      g = Math.floor((g + m) * 255);
      b = Math.floor((b + m) * 255);
    } else {
      r = g = b = Math.floor(mag * 255);
    }
    
    pixels[idx] = r;
    pixels[idx + 1] = g;
    pixels[idx + 2] = b;
    pixels[idx + 3] = Math.floor(mag * 180);
  }
  
  offCtx.putImageData(imageData, 0, 0);
  
  ctx.save();
  ctx.globalAlpha = 0.6;
  ctx.globalCompositeOperation = 'screen';
  ctx.drawImage(offscreen, 0, 0);
  ctx.restore();
}

export default CanvasV3;
