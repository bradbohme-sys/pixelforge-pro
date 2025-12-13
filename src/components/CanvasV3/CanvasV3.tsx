/**
 * CanvasV3 - The Main V3 Canvas Component
 * 
 * V6 Features:
 * - Organic wave preview on hover
 * - Scroll wheel adjusts tolerance live
 * - Zero-latency seed feedback
 */

import React, { useRef, useLayoutEffect, useState, useCallback, useEffect } from 'react';
import { CoordinateSystem } from './CoordinateSystem';
import { RenderPipeline } from './RenderPipeline';
import { PanZoomHandler } from './PanZoomHandler';
import { V3MagicWandHandler } from './V3MagicWandHandler';
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  SELECTION_COLOR,
  HOVER_PREVIEW_COLOR,
} from './constants';
import type { CanvasState, Layer, ToolType, SelectionMask, HoverPreview, WandOptions, SelectionMode } from './types';
import type { ExpansionMode } from './preview';

// ============================================
// HIGH-DPI INITIALIZATION
// ============================================

function initializeHighDPICanvas(canvas: HTMLCanvasElement): void {
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  
  canvas.style.width = `${rect.width}px`;
  canvas.style.height = `${rect.height}px`;
  
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.scale(dpr, dpr);
  }
}

// ============================================
// PROPS
// ============================================

interface CanvasV3Props {
  layers: Layer[];
  activeTool: ToolType;
  wandOptions?: WandOptions;
  expansionMode?: ExpansionMode;
  onSelectionChange?: (mask: SelectionMask | null) => void;
  onZoomChange?: (zoom: number) => void;
  onToleranceChange?: (tolerance: number) => void;
  onError?: (message: string) => void;
}

// ============================================
// COMPONENT
// ============================================

export const CanvasV3: React.FC<CanvasV3Props> = ({
  layers,
  activeTool,
  wandOptions,
  expansionMode = 'fast',
  onSelectionChange,
  onZoomChange,
  onToleranceChange,
  onError,
}) => {
  const mainCanvasRef = useRef<HTMLCanvasElement>(null);
  const interactionCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const coordSystemRef = useRef<CoordinateSystem | null>(null);
  const renderPipelineRef = useRef<RenderPipeline | null>(null);
  const panZoomHandlerRef = useRef<PanZoomHandler | null>(null);
  const magicWandHandlerRef = useRef<V3MagicWandHandler | null>(null);
  const interactionRafIdRef = useRef<number | null>(null);
  
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

  // Refs for animation loop (to avoid stale closure)
  const hoverPreviewRef = useRef<HoverPreview | null>(null);
  const currentSelectionRef = useRef<SelectionMask | null>(null);
  const activeToolRef = useRef<ToolType>(activeTool);

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
    };
    
    loadAllImages();
  }, [layers, loadLayerImage]);

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
    
    renderPipelineRef.current = new RenderPipeline(CANVAS_WIDTH, CANVAS_HEIGHT);
    renderPipelineRef.current.start(mainCanvas, coordSystemRef.current, stateRef);
    
    // Interaction render loop with marching ants
    const interactionLoop = (time: number) => {
      const ctx = interactionCanvas.getContext('2d');
      if (ctx && coordSystemRef.current) {
        ctx.clearRect(0, 0, interactionCanvas.width, interactionCanvas.height);
        
        // Draw selection overlay with marching ants (use ref to avoid stale closure)
        const selection = currentSelectionRef.current;
        if (selection?.data) {
          ctx.save();
          coordSystemRef.current.applyTransform(ctx);
          drawSelectionOverlay(ctx, selection, SELECTION_COLOR, time);
          ctx.restore();
        }
        
        // Draw hover preview (use ref to avoid stale closure)
        const preview = hoverPreviewRef.current;
        const currentTool = activeToolRef.current;
        if (preview?.mask?.data && currentTool === 'magic-wand') {
          ctx.save();
          coordSystemRef.current.applyTransform(ctx);
          
          // Draw zero-latency seed highlight
          magicWandHandlerRef.current?.drawInstantSeed(ctx);
          
          // Draw wave preview
          drawSelectionOverlay(ctx, preview.mask, HOVER_PREVIEW_COLOR, time);
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
      renderPipelineRef.current?.resizeCache(CANVAS_WIDTH, CANVAS_HEIGHT);
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
  }, []);

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

  // ============================================
  // HANDLERS
  // ============================================

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
    
    const worldPoint = coordSystemRef.current.screenToWorld(e.clientX, e.clientY);
    setCursorPosition(worldPoint);
    
    if (activeTool === 'magic-wand' && magicWandHandlerRef.current) {
      magicWandHandlerRef.current.handleHover(e.clientX, e.clientY);
    }
  }, [activeTool]);

  const handleClick = useCallback((e: React.MouseEvent) => {
    if (!coordSystemRef.current) return;
    
    if (activeTool === 'magic-wand' && magicWandHandlerRef.current) {
      // Determine selection mode based on modifiers
      let selectionMode: SelectionMode = 'replace';
      if (e.shiftKey) {
        selectionMode = 'add';
      } else if (e.altKey) {
        selectionMode = 'subtract';
      }
      
      magicWandHandlerRef.current.handleClick(e.clientX, e.clientY, selectionMode);
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
    // If magic wand is active and hovering, use wheel for tolerance
    if (activeTool === 'magic-wand' && magicWandHandlerRef.current) {
      const isHovering = hoverPreview !== null || cursorPosition !== null;
      
      if (isHovering && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        e.stopPropagation();
        magicWandHandlerRef.current.handleWheel(e.deltaY);
        return;
      }
    }
    
    // Otherwise let PanZoomHandler handle it
  }, [activeTool, hoverPreview, cursorPosition]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
  }, []);

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
      
      {/* Interaction canvas (overlays, selections) */}
      <canvas
        ref={interactionCanvasRef}
        className="absolute inset-0 w-full h-full"
        style={{ zIndex: 1, pointerEvents: 'auto' }}
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
        onClick={handleClick}
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
      </div>
      
      {/* Scroll hint for magic wand */}
      {activeTool === 'magic-wand' && hoverPreview && (
        <div className="absolute bottom-12 right-3 px-2 py-1 bg-card/80 backdrop-blur-sm border border-border rounded text-xs text-muted-foreground animate-fade-in">
          Scroll to adjust tolerance
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
// Uses an offscreen canvas to create ImageData, then draws it with drawImage
// so canvas transforms are properly applied
function drawSelectionOverlay(
  ctx: CanvasRenderingContext2D,
  mask: SelectionMask,
  color: string,
  timestamp: number = 0
): void {
  const { data, width, height, bounds } = mask;
  
  // Create an offscreen canvas for the mask
  const offscreen = new OffscreenCanvas(width, height);
  const offCtx = offscreen.getContext('2d');
  if (!offCtx) return;
  
  const imageData = offCtx.createImageData(width, height);
  const pixels = imageData.data;
  
  // Fill colors
  const fillR = 100, fillG = 200, fillB = 100, fillA = 80;
  const borderR = 255, borderG = 255, borderB = 255;
  
  // Marching ants offset (animates the border)
  const antOffset = Math.floor(timestamp / 100) % 8;
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      
      if (data[i] > 0) {
        const idx = i * 4;
        
        // Check if this is a border pixel
        const isLeft = x > 0 && data[i - 1] === 0;
        const isRight = x < width - 1 && data[i + 1] === 0;
        const isTop = y > 0 && data[i - width] === 0;
        const isBottom = y < height - 1 && data[i + width] === 0;
        const isBorder = isLeft || isRight || isTop || isBottom;
        
        if (isBorder) {
          // Marching ants pattern
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
          // Interior fill
          pixels[idx] = fillR;
          pixels[idx + 1] = fillG;
          pixels[idx + 2] = fillB;
          pixels[idx + 3] = fillA;
        }
      }
    }
  }
  
  // Put image data on offscreen canvas
  offCtx.putImageData(imageData, 0, 0);
  
  // Draw at the correct position (bounds offset) so it aligns with the layer
  const offsetX = bounds?.x ?? 0;
  const offsetY = bounds?.y ?? 0;
  ctx.drawImage(offscreen, offsetX, offsetY);
}

export default CanvasV3;
