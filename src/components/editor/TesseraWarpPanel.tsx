/**
 * Tessera Warp Settings Panel
 * 
 * UI component for material preset selection, solver options, and pin management.
 */

import React from 'react';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Anchor, 
  RotateCcw, 
  Trash2, 
  Play, 
  Pause,
  Grid3X3,
  Layers,
  Move,
  Circle
} from 'lucide-react';
import type { TesseraWarpState, WarpPin, MaterialPreset, ARAPSolverOptions } from '@/components/CanvasV3/TesseraWarp/types';

interface TesseraWarpPanelProps {
  state: TesseraWarpState;
  onAddAnchorPin: () => void;
  onAddPosePin: () => void;
  onRemovePin: (id: string) => void;
  onClearPins: () => void;
  onSelectPin: (id: string | null) => void;
  onSolverOptionsChange: (options: Partial<ARAPSolverOptions>) => void;
  onMaterialPresetChange: (preset: MaterialPreset) => void;
  onShowMeshChange: (show: boolean) => void;
  showMesh: boolean;
  isAnimating: boolean;
  onToggleAnimation: () => void;
}

const MATERIAL_PRESETS: { value: MaterialPreset; label: string; description: string }[] = [
  { value: 'rigid', label: 'Rigid', description: 'Stiff, shape-preserving' },
  { value: 'rubber', label: 'Rubber', description: 'Elastic stretching' },
  { value: 'cloth', label: 'Cloth', description: 'Soft, fabric-like' },
  { value: 'gel', label: 'Gel', description: 'Jelly-like wobble' },
];

export const TesseraWarpPanel: React.FC<TesseraWarpPanelProps> = ({
  state,
  onAddAnchorPin,
  onAddPosePin,
  onRemovePin,
  onClearPins,
  onSelectPin,
  onSolverOptionsChange,
  onMaterialPresetChange,
  onShowMeshChange,
  showMesh,
  isAnimating,
  onToggleAnimation,
}) => {
  const { pins, selectedPinId, solverOptions } = state;
  const selectedPin = pins.find(p => p.id === selectedPinId);
  
  return (
    <div className="p-3 space-y-4 bg-card border-r border-border w-56 overflow-y-auto max-h-full">
      <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        Tessera Warp
      </h3>
      
      {/* Quick Actions */}
      <div className="space-y-2">
        <Label className="text-xs">Add Pin</Label>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            className="flex-1 h-8 text-xs"
            onClick={onAddAnchorPin}
            title="Click on canvas to place anchor pin"
          >
            <Anchor className="w-3 h-3 mr-1" />
            Anchor
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="flex-1 h-8 text-xs"
            onClick={onAddPosePin}
            title="Click on canvas to place pose pin (with rotation)"
          >
            <RotateCcw className="w-3 h-3 mr-1" />
            Pose
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground">
          Click canvas to place pins. Drag to deform.
        </p>
      </div>
      
      {/* Material Preset */}
      <div className="space-y-2">
        <Label className="text-xs">Material</Label>
        <Select 
          value={solverOptions.materialPreset || 'rigid'} 
          onValueChange={(v) => onMaterialPresetChange(v as MaterialPreset)}
        >
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MATERIAL_PRESETS.map(preset => (
              <SelectItem key={preset.value} value={preset.value}>
                <div className="flex flex-col">
                  <span>{preset.label}</span>
                  <span className="text-[10px] text-muted-foreground">{preset.description}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      
      {/* Solver Options */}
      <div className="space-y-3 border-t border-border pt-3">
        <Label className="text-xs text-muted-foreground uppercase">Solver</Label>
        
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Iterations</Label>
            <span className="text-xs font-mono text-muted-foreground">
              {solverOptions.iterations}
            </span>
          </div>
          <Slider
            value={[solverOptions.iterations]}
            min={1}
            max={20}
            step={1}
            onValueChange={([value]) => onSolverOptionsChange({ iterations: value })}
          />
        </div>
        
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Stiffness</Label>
            <span className="text-xs font-mono text-muted-foreground">
              {solverOptions.stiffness.toFixed(2)}
            </span>
          </div>
          <Slider
            value={[solverOptions.stiffness * 100]}
            min={0}
            max={100}
            step={1}
            onValueChange={([value]) => onSolverOptionsChange({ stiffness: value / 100 })}
          />
        </div>
        
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Damping</Label>
            <span className="text-xs font-mono text-muted-foreground">
              {solverOptions.damping.toFixed(2)}
            </span>
          </div>
          <Slider
            value={[solverOptions.damping * 100]}
            min={0}
            max={100}
            step={1}
            onValueChange={([value]) => onSolverOptionsChange({ damping: value / 100 })}
          />
        </div>
      </div>
      
      {/* Display Options */}
      <div className="space-y-2 border-t border-border pt-3">
        <Label className="text-xs text-muted-foreground uppercase">Display</Label>
        
        <div className="flex items-center justify-between">
          <Label className="text-xs flex items-center gap-1.5">
            <Grid3X3 className="w-3 h-3" />
            Show Mesh
          </Label>
          <Switch
            checked={showMesh}
            onCheckedChange={onShowMeshChange}
          />
        </div>
        
        <Button
          size="sm"
          variant="outline"
          className="w-full h-8 text-xs"
          onClick={onToggleAnimation}
        >
          {isAnimating ? (
            <>
              <Pause className="w-3 h-3 mr-1" />
              Pause Preview
            </>
          ) : (
            <>
              <Play className="w-3 h-3 mr-1" />
              Animate Preview
            </>
          )}
        </Button>
      </div>
      
      {/* Pin List */}
      <div className="space-y-2 border-t border-border pt-3">
        <div className="flex items-center justify-between">
          <Label className="text-xs text-muted-foreground uppercase">
            Pins ({pins.length})
          </Label>
          {pins.length > 0 && (
            <Button
              size="sm"
              variant="ghost"
              className="h-6 px-2 text-xs text-destructive hover:text-destructive"
              onClick={onClearPins}
            >
              <Trash2 className="w-3 h-3 mr-1" />
              Clear
            </Button>
          )}
        </div>
        
        {pins.length === 0 ? (
          <p className="text-[10px] text-muted-foreground italic">
            No pins placed. Click canvas after selecting pin type.
          </p>
        ) : (
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {pins.map((pin, index) => (
              <div
                key={pin.id}
                className={`flex items-center justify-between p-2 rounded text-xs cursor-pointer transition-colors ${
                  selectedPinId === pin.id 
                    ? 'bg-primary/10 border border-primary/30' 
                    : 'bg-muted/50 hover:bg-muted'
                }`}
                onClick={() => onSelectPin(pin.id)}
              >
                <div className="flex items-center gap-2">
                  {pin.kind === 'anchor' ? (
                    <Anchor className="w-3 h-3 text-primary" />
                  ) : pin.kind === 'pose' ? (
                    <RotateCcw className="w-3 h-3 text-primary" />
                  ) : (
                    <Move className="w-3 h-3 text-primary" />
                  )}
                  <span>Pin {index + 1}</span>
                  <span className="text-[10px] text-muted-foreground capitalize">
                    ({pin.kind})
                  </span>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-5 w-5 p-0 text-muted-foreground hover:text-destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemovePin(pin.id);
                  }}
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
      
      {/* Selected Pin Details */}
      {selectedPin && (
        <div className="space-y-2 border-t border-border pt-3">
          <Label className="text-xs text-muted-foreground uppercase">Selected Pin</Label>
          
          <div className="space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Type:</span>
              <span className="capitalize">{selectedPin.kind}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Position:</span>
              <span className="font-mono">
                {Math.round(selectedPin.pos.x)}, {Math.round(selectedPin.pos.y)}
              </span>
            </div>
            {selectedPin.kind !== 'rail' && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Target:</span>
                <span className="font-mono">
                  {Math.round(selectedPin.target.x)}, {Math.round(selectedPin.target.y)}
                </span>
              </div>
            )}
            {selectedPin.kind === 'pose' && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Angle:</span>
                <span className="font-mono">{Math.round(selectedPin.angle * 180 / Math.PI)}°</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Radius:</span>
              <span className="font-mono">{selectedPin.radius}px</span>
            </div>
          </div>
        </div>
      )}
      
      {/* Keyboard Shortcuts */}
      <div className="pt-2 border-t border-border space-y-1">
        <p className="text-[10px] text-muted-foreground">
          <span className="font-medium text-foreground">Delete</span> Remove selected pin
        </p>
        <p className="text-[10px] text-muted-foreground">
          <span className="font-medium text-foreground">Escape</span> Deselect pin
        </p>
        <p className="text-[10px] text-muted-foreground">
          <span className="font-medium text-foreground">Scroll</span> Adjust pin radius
        </p>
      </div>
    </div>
  );
};
