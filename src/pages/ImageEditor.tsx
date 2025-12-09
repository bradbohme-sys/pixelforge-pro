import React, { useState, useCallback, useRef } from 'react';
import { CanvasV3 } from '@/components/CanvasV3/CanvasV3';
import { LeftToolbar } from '@/components/editor/LeftToolbar';
import { LayersPanel } from '@/components/editor/LayersPanel';
import { ToolSettingsPanel } from '@/components/editor/ToolSettingsPanel';
import { TopBar } from '@/components/editor/TopBar';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '@/components/CanvasV3/constants';
import type { ToolType, Layer, WandOptions, SelectionMask } from '@/components/CanvasV3/types';
import type { ExpansionMode } from '@/components/CanvasV3/preview';
import { toast } from 'sonner';

const ImageEditor: React.FC = () => {
  // Tool state
  const [activeTool, setActiveTool] = useState<ToolType>('select');
  const [wandOptions, setWandOptions] = useState<WandOptions>({
    tolerance: 32,
    contiguous: true,
    antiAlias: true,
    feather: 0,
  });
  const [expansionMode, setExpansionMode] = useState<ExpansionMode>('fast');
  
  // Layer state
  const [layers, setLayers] = useState<Layer[]>([]);
  const [activeLayerId, setActiveLayerId] = useState<string | null>(null);
  
  // Canvas state
  const [zoomPercent, setZoomPercent] = useState(100);
  const [currentSelection, setCurrentSelection] = useState<SelectionMask | null>(null);
  
  // History (simplified)
  const [historyIndex, setHistoryIndex] = useState(-1);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ============================================
  // LAYER OPERATIONS
  // ============================================

  const handleImport = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      
      const img = new Image();
      img.onload = () => {
        const newLayer: Layer = {
          id: crypto.randomUUID(),
          name: file.name.replace(/\.[^/.]+$/, ''),
          visible: true,
          locked: false,
          opacity: 1,
          blendMode: 'source-over',
          bounds: {
            x: 0,
            y: 0,
            width: Math.min(img.width, CANVAS_WIDTH),
            height: Math.min(img.height, CANVAS_HEIGHT),
          },
          image: img,
          dataUrl,
          transform: { rotation: 0, scaleX: 1, scaleY: 1 },
        };
        
        setLayers(prev => [...prev, newLayer]);
        setActiveLayerId(newLayer.id);
        toast.success(`Imported "${newLayer.name}"`);
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
    
    // Reset input
    e.target.value = '';
  }, []);

  const handleExport = useCallback(() => {
    if (layers.length === 0) {
      toast.error('No layers to export');
      return;
    }
    
    // Create composite canvas
    const canvas = document.createElement('canvas');
    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Draw white background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    
    // Draw all visible layers
    for (const layer of layers) {
      if (!layer.visible || !layer.image) continue;
      
      ctx.save();
      ctx.globalAlpha = layer.opacity;
      ctx.globalCompositeOperation = layer.blendMode || 'source-over';
      
      const { x, y, width, height } = layer.bounds;
      const transform = layer.transform || { rotation: 0, scaleX: 1, scaleY: 1 };
      
      ctx.translate(x + width / 2, y + height / 2);
      ctx.rotate((transform.rotation * Math.PI) / 180);
      ctx.scale(transform.scaleX, transform.scaleY);
      ctx.translate(-(width / 2), -(height / 2));
      
      ctx.drawImage(layer.image, 0, 0, width, height);
      ctx.restore();
    }
    
    // Download
    const link = document.createElement('a');
    link.download = 'image-export.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
    
    toast.success('Image exported');
  }, [layers]);

  const handleAddLayer = useCallback(() => {
    handleImport();
  }, [handleImport]);

  const handleLayerSelect = useCallback((id: string) => {
    setActiveLayerId(id);
  }, []);

  const handleLayerVisibilityToggle = useCallback((id: string) => {
    setLayers(prev => prev.map(layer =>
      layer.id === id ? { ...layer, visible: !layer.visible } : layer
    ));
  }, []);

  const handleLayerLockToggle = useCallback((id: string) => {
    setLayers(prev => prev.map(layer =>
      layer.id === id ? { ...layer, locked: !layer.locked } : layer
    ));
  }, []);

  const handleLayerOpacityChange = useCallback((id: string, opacity: number) => {
    setLayers(prev => prev.map(layer =>
      layer.id === id ? { ...layer, opacity } : layer
    ));
  }, []);

  const handleLayerDelete = useCallback((id: string) => {
    setLayers(prev => prev.filter(layer => layer.id !== id));
    if (activeLayerId === id) {
      setActiveLayerId(layers.length > 1 ? layers[layers.length - 2]?.id : null);
    }
    toast.success('Layer deleted');
  }, [activeLayerId, layers]);

  // ============================================
  // CANVAS CALLBACKS
  // ============================================

  const handleZoomChange = useCallback((zoom: number) => {
    setZoomPercent(Math.round(zoom * 100));
  }, []);

  const handleSelectionChange = useCallback((mask: SelectionMask | null) => {
    setCurrentSelection(mask);
  }, []);

  const handleError = useCallback((message: string) => {
    toast.error(message);
  }, []);

  // ============================================
  // WAND OPTIONS
  // ============================================

  const handleWandOptionsChange = useCallback((options: Partial<WandOptions>) => {
    setWandOptions(prev => ({ ...prev, ...options }));
  }, []);

  // ============================================
  // VIEW CONTROLS
  // ============================================

  const handleZoomIn = useCallback(() => {
    // Will be connected to canvas
  }, []);

  const handleZoomOut = useCallback(() => {
    // Will be connected to canvas
  }, []);

  const handleResetView = useCallback(() => {
    setZoomPercent(100);
  }, []);

  const handleFitToScreen = useCallback(() => {
    // Will be connected to canvas
  }, []);

  const handleUndo = useCallback(() => {
    toast.info('Undo not yet implemented');
  }, []);

  const handleRedo = useCallback(() => {
    toast.info('Redo not yet implemented');
  }, []);

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />
      
      {/* Top bar */}
      <TopBar
        zoomPercent={zoomPercent}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onResetView={handleResetView}
        onFitToScreen={handleFitToScreen}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onExport={handleExport}
        onImport={handleImport}
        canUndo={historyIndex > 0}
        canRedo={false}
      />
      
      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left toolbar */}
        <LeftToolbar activeTool={activeTool} onToolChange={setActiveTool} />
        
        {/* Tool settings (shown for magic wand) */}
        {activeTool === 'magic-wand' && (
          <ToolSettingsPanel
            wandOptions={wandOptions}
            expansionMode={expansionMode}
            onWandOptionsChange={handleWandOptionsChange}
            onExpansionModeChange={setExpansionMode}
          />
        )}
        
        {/* Canvas area */}
        <div className="flex-1 relative">
          <CanvasV3
            layers={layers}
            activeTool={activeTool}
            wandOptions={wandOptions}
            expansionMode={expansionMode}
            onZoomChange={handleZoomChange}
            onSelectionChange={handleSelectionChange}
            onToleranceChange={(tol) => setWandOptions(prev => ({ ...prev, tolerance: tol }))}
            onError={handleError}
          />
        </div>
        
        {/* Right panel - Layers */}
        <div className="w-64">
          <LayersPanel
            layers={layers}
            activeLayerId={activeLayerId}
            onLayerSelect={handleLayerSelect}
            onLayerVisibilityToggle={handleLayerVisibilityToggle}
            onLayerLockToggle={handleLayerLockToggle}
            onLayerOpacityChange={handleLayerOpacityChange}
            onLayerDelete={handleLayerDelete}
            onAddLayer={handleAddLayer}
          />
        </div>
      </div>
    </div>
  );
};

export default ImageEditor;
