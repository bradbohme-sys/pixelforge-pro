import React from 'react';
import { cn } from '@/lib/utils';
import { Eye, EyeOff, Lock, Unlock, Trash2, Plus, ChevronDown } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import type { Layer } from '../CanvasV3/types';

interface LayersPanelProps {
  layers: Layer[];
  activeLayerId: string | null;
  onLayerSelect: (id: string) => void;
  onLayerVisibilityToggle: (id: string) => void;
  onLayerLockToggle: (id: string) => void;
  onLayerOpacityChange: (id: string, opacity: number) => void;
  onLayerDelete: (id: string) => void;
  onAddLayer: () => void;
}

const BLEND_MODES: { value: string; label: string }[] = [
  { value: 'source-over', label: 'Normal' },
  { value: 'multiply', label: 'Multiply' },
  { value: 'screen', label: 'Screen' },
  { value: 'overlay', label: 'Overlay' },
  { value: 'darken', label: 'Darken' },
  { value: 'lighten', label: 'Lighten' },
  { value: 'color-dodge', label: 'Color Dodge' },
  { value: 'color-burn', label: 'Color Burn' },
  { value: 'hard-light', label: 'Hard Light' },
  { value: 'soft-light', label: 'Soft Light' },
  { value: 'difference', label: 'Difference' },
  { value: 'exclusion', label: 'Exclusion' },
];

export const LayersPanel: React.FC<LayersPanelProps> = ({
  layers,
  activeLayerId,
  onLayerSelect,
  onLayerVisibilityToggle,
  onLayerLockToggle,
  onLayerOpacityChange,
  onLayerDelete,
  onAddLayer,
}) => {
  return (
    <div className="flex flex-col h-full bg-card border-l border-border">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <h3 className="text-sm font-medium">Layers</h3>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={onAddLayer}
        >
          <Plus size={14} />
        </Button>
      </div>
      
      {/* Layer list */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {layers.length === 0 ? (
          <div className="text-center text-muted-foreground text-xs py-8">
            No layers yet.<br />
            Upload an image to start.
          </div>
        ) : (
          [...layers].reverse().map((layer) => (
            <div
              key={layer.id}
              className={cn(
                'group flex items-center gap-2 p-2 rounded-md cursor-pointer transition-colors',
                'hover:bg-secondary/50',
                activeLayerId === layer.id && 'bg-secondary'
              )}
              onClick={() => onLayerSelect(layer.id)}
            >
              {/* Thumbnail */}
              <div className="w-10 h-10 rounded bg-muted flex-shrink-0 overflow-hidden border border-border">
                {layer.image ? (
                  <img
                    src={layer.dataUrl || layer.imageUrl}
                    alt={layer.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">
                    —
                  </div>
                )}
              </div>
              
              {/* Name & controls */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1">
                  <span className="text-xs font-medium truncate flex-1">
                    {layer.name}
                  </span>
                  
                  {/* Visibility */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onLayerVisibilityToggle(layer.id);
                    }}
                    className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                  >
                    {layer.visible ? <Eye size={12} /> : <EyeOff size={12} />}
                  </button>
                  
                  {/* Lock */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onLayerLockToggle(layer.id);
                    }}
                    className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                  >
                    {layer.locked ? <Lock size={12} /> : <Unlock size={12} />}
                  </button>
                  
                  {/* Delete */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onLayerDelete(layer.id);
                    }}
                    className="p-1 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
                
                {/* Opacity slider (shown when active) */}
                {activeLayerId === layer.id && (
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-[10px] text-muted-foreground w-8">
                      {Math.round(layer.opacity * 100)}%
                    </span>
                    <Slider
                      value={[layer.opacity * 100]}
                      min={0}
                      max={100}
                      step={1}
                      className="flex-1"
                      onValueChange={([value]) => onLayerOpacityChange(layer.id, value / 100)}
                    />
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
