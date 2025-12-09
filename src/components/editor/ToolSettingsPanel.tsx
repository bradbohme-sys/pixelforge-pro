import React from 'react';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import type { WandOptions } from '../CanvasV3/types';

interface ToolSettingsPanelProps {
  wandOptions: WandOptions;
  onWandOptionsChange: (options: Partial<WandOptions>) => void;
}

export const ToolSettingsPanel: React.FC<ToolSettingsPanelProps> = ({
  wandOptions,
  onWandOptionsChange,
}) => {
  return (
    <div className="p-3 space-y-4 bg-card border-r border-border w-56">
      <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        Magic Wand Settings
      </h3>
      
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
      </div>
    </div>
  );
};
