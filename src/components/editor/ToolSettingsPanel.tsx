import React, { useState } from 'react';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sparkles, Loader2 } from 'lucide-react';
import type { WandOptions } from '../CanvasV3/types';
import type { ExpansionMode } from '../CanvasV3/preview';

interface ToolSettingsPanelProps {
  wandOptions: WandOptions;
  expansionMode: ExpansionMode;
  onWandOptionsChange: (options: Partial<WandOptions>) => void;
  onExpansionModeChange: (mode: ExpansionMode) => void;
  onAIDiscover?: () => Promise<void>;
  isAIProcessing?: boolean;
}

export const ToolSettingsPanel: React.FC<ToolSettingsPanelProps> = ({
  wandOptions,
  expansionMode,
  onWandOptionsChange,
  onExpansionModeChange,
  onAIDiscover,
  isAIProcessing = false,
}) => {
  return (
    <div className="p-3 space-y-4 bg-card border-r border-border w-56">
      <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        Magic Wand Settings
      </h3>
      
      {/* AI Segmentation */}
      {onAIDiscover && (
        <div className="space-y-2 pb-3 border-b border-border">
          <Label className="text-xs flex items-center gap-1.5">
            <Sparkles className="w-3 h-3 text-primary" />
            AI Auto-Segment
          </Label>
          <Button
            size="sm"
            variant="outline"
            className="w-full h-8 text-xs"
            onClick={onAIDiscover}
            disabled={isAIProcessing}
          >
            {isAIProcessing ? (
              <>
                <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Sparkles className="w-3 h-3 mr-1.5" />
                Discover Objects
              </>
            )}
          </Button>
          <p className="text-[10px] text-muted-foreground">
            AI finds all selectable objects using Nano Banana Pro
          </p>
        </div>
      )}
      
      {/* Tolerance */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs">Tolerance</Label>
          <span className="text-xs font-mono text-muted-foreground">
            {wandOptions.tolerance}
          </span>
        </div>
        <Slider
          value={[wandOptions.tolerance]}
          min={0}
          max={255}
          step={1}
          onValueChange={([value]) => onWandOptionsChange({ tolerance: value })}
        />
        <p className="text-[10px] text-muted-foreground">Scroll on canvas to adjust live</p>
      </div>
      
      {/* Expansion Speed */}
      <div className="space-y-2">
        <Label className="text-xs">Preview Speed</Label>
        <Select value={expansionMode} onValueChange={(v) => onExpansionModeChange(v as ExpansionMode)}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="instant">Instant</SelectItem>
            <SelectItem value="fast">Fast</SelectItem>
            <SelectItem value="normal">Normal (Wave)</SelectItem>
            <SelectItem value="slow">Slow (Dramatic)</SelectItem>
          </SelectContent>
        </Select>
      </div>
      
      {/* Connectivity */}
      <div className="space-y-2">
        <Label className="text-xs">Connectivity</Label>
        <Select 
          value={String(wandOptions.connectivity)} 
          onValueChange={(v) => onWandOptionsChange({ connectivity: Number(v) as 4 | 8 })}
        >
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="4">4-way (Cardinal)</SelectItem>
            <SelectItem value="8">8-way (Diagonal)</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-[10px] text-muted-foreground">8-way includes diagonals</p>
      </div>
      
      {/* Contiguous */}
      <div className="flex items-center justify-between">
        <Label className="text-xs">Contiguous</Label>
        <Switch
          checked={wandOptions.contiguous}
          onCheckedChange={(checked) => onWandOptionsChange({ contiguous: checked })}
        />
      </div>
      
      {/* Anti-alias */}
      <div className="flex items-center justify-between">
        <Label className="text-xs">Anti-alias</Label>
        <Switch
          checked={wandOptions.antiAlias}
          onCheckedChange={(checked) => onWandOptionsChange({ antiAlias: checked })}
        />
      </div>
      
      {/* Feather */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs">Feather</Label>
          <span className="text-xs font-mono text-muted-foreground">
            {wandOptions.feather}px
          </span>
        </div>
        <Slider
          value={[wandOptions.feather]}
          min={0}
          max={50}
          step={1}
          onValueChange={([value]) => onWandOptionsChange({ feather: value })}
        />
        <p className="text-[10px] text-muted-foreground">Softens selection edges</p>
      </div>
      
      {/* Modifier hints */}
      <div className="pt-2 border-t border-border space-y-1">
        <p className="text-[10px] text-muted-foreground">
          <span className="font-medium text-foreground">Shift+Click</span> to add to selection
        </p>
        <p className="text-[10px] text-muted-foreground">
          <span className="font-medium text-foreground">Alt+Click</span> to subtract from selection
        </p>
      </div>
    </div>
  );
};
