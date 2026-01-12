/**
 * AI Segmentation Panel
 * 
 * Enhanced Pin-and-Dye system with saved object list, dye-based segmentation,
 * and automatic magic wand color extraction.
 */

import React from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Sparkles, 
  Loader2, 
  Eye, 
  EyeOff, 
  Trash2,
  Paintbrush,
  Wand2,
  Check,
  RefreshCw,
  Target
} from 'lucide-react';
import type { DiscoveredPin, PinAndDyeState } from '@/components/CanvasV3/PinAndDye/types';

interface AISegmentationPanelProps {
  state: PinAndDyeState;
  isProcessing: boolean;
  onDiscover: () => Promise<void>;
  onGenerateDye: () => Promise<void>;
  onExtractSelection: (pinId: string) => void;
  onAutoExtractAll: () => void;
  onSelectPin: (id: string) => void;
  onRemovePin: (id: string) => void;
  onReset: () => void;
  showDyeOverlay: boolean;
  onShowDyeOverlayChange: (show: boolean) => void;
}

const STAGE_LABELS: Record<PinAndDyeState['stage'], string> = {
  'idle': 'Ready',
  'discovering': 'Analyzing...',
  'pins-ready': 'Objects Found',
  'dyeing': 'Generating Dye...',
  'dye-ready': 'Ready to Extract',
  'extracting': 'Extracting...',
};

const STAGE_COLORS: Record<PinAndDyeState['stage'], string> = {
  'idle': 'bg-muted',
  'discovering': 'bg-primary animate-pulse',
  'pins-ready': 'bg-green-500',
  'dyeing': 'bg-primary animate-pulse',
  'dye-ready': 'bg-green-500',
  'extracting': 'bg-primary animate-pulse',
};

export const AISegmentationPanel: React.FC<AISegmentationPanelProps> = ({
  state,
  isProcessing,
  onDiscover,
  onGenerateDye,
  onExtractSelection,
  onAutoExtractAll,
  onSelectPin,
  onRemovePin,
  onReset,
  showDyeOverlay,
  onShowDyeOverlayChange,
}) => {
  const { stage, pins, dyeLayer, error } = state;
  const discoveredPins = pins.pins;
  const selectedPinId = pins.selectedPinId;
  const isDyeReady = dyeLayer.isGenerated && stage === 'dye-ready';
  
  return (
    <div className="p-3 space-y-4 bg-card border-r border-border w-64 overflow-hidden flex flex-col max-h-full">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
          <Sparkles className="w-3 h-3 text-primary" />
          AI Segmentation
        </h3>
        <Badge variant="secondary" className={`text-[10px] ${STAGE_COLORS[stage]}`}>
          {STAGE_LABELS[stage]}
        </Badge>
      </div>
      
      {/* Error Display */}
      {error && (
        <div className="p-2 bg-destructive/10 border border-destructive/30 rounded text-xs text-destructive">
          {error}
        </div>
      )}
      
      {/* Stage 1: Discovery */}
      <div className="space-y-2">
        <Label className="text-xs flex items-center gap-1.5">
          <Target className="w-3 h-3" />
          Step 1: Discover Objects
        </Label>
        <Button
          size="sm"
          variant={stage === 'idle' ? 'default' : 'outline'}
          className="w-full h-8 text-xs"
          onClick={onDiscover}
          disabled={isProcessing || stage === 'discovering'}
        >
          {stage === 'discovering' ? (
            <>
              <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />
              Analyzing Image...
            </>
          ) : discoveredPins.length > 0 ? (
            <>
              <RefreshCw className="w-3 h-3 mr-1.5" />
              Re-discover Objects
            </>
          ) : (
            <>
              <Sparkles className="w-3 h-3 mr-1.5" />
              Discover Objects
            </>
          )}
        </Button>
        <p className="text-[10px] text-muted-foreground">
          AI identifies all selectable objects using visual prominence rules.
        </p>
      </div>
      
      {/* Discovered Objects List */}
      {discoveredPins.length > 0 && (
        <div className="space-y-2 border-t border-border pt-3 flex-1 overflow-hidden flex flex-col">
          <div className="flex items-center justify-between">
            <Label className="text-xs">
              Discovered Objects ({discoveredPins.length})
            </Label>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 px-2 text-xs text-destructive hover:text-destructive"
              onClick={onReset}
            >
              <Trash2 className="w-3 h-3" />
            </Button>
          </div>
          
          <ScrollArea className="flex-1 -mx-1">
            <div className="space-y-1 px-1">
              {discoveredPins.map((pin, index) => (
                <div
                  key={pin.id}
                  className={`flex items-center gap-2 p-2 rounded text-xs cursor-pointer transition-colors ${
                    selectedPinId === pin.id 
                      ? 'bg-primary/10 border border-primary/30' 
                      : 'bg-muted/50 hover:bg-muted'
                  }`}
                  onClick={() => onSelectPin(pin.id)}
                >
                  {/* Color indicator */}
                  <div 
                    className="w-3 h-3 rounded-full border border-border/50 flex-shrink-0"
                    style={{ backgroundColor: pin.color || `hsl(${index * 137.5 % 360}, 70%, 50%)` }}
                  />
                  
                  {/* Label */}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{pin.label}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {pin.areaPercent.toFixed(1)}% of canvas
                    </p>
                  </div>
                  
                  {/* Extract button (when dye ready) */}
                  {isDyeReady && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 w-6 p-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        onExtractSelection(pin.id);
                      }}
                      title="Extract selection"
                    >
                      <Wand2 className="w-3 h-3" />
                    </Button>
                  )}
                  
                  {/* Remove button */}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
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
          </ScrollArea>
        </div>
      )}
      
      {/* Stage 2: Generate Dye Layer */}
      {discoveredPins.length > 0 && (
        <div className="space-y-2 border-t border-border pt-3">
          <Label className="text-xs flex items-center gap-1.5">
            <Paintbrush className="w-3 h-3" />
            Step 2: Generate Dye Layer
          </Label>
          <Button
            size="sm"
            variant={stage === 'pins-ready' ? 'default' : 'outline'}
            className="w-full h-8 text-xs"
            onClick={onGenerateDye}
            disabled={isProcessing || stage === 'dyeing' || discoveredPins.length === 0}
          >
            {stage === 'dyeing' ? (
              <>
                <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />
                Generating Dye...
              </>
            ) : dyeLayer.isGenerated ? (
              <>
                <RefreshCw className="w-3 h-3 mr-1.5" />
                Regenerate Dye
              </>
            ) : (
              <>
                <Paintbrush className="w-3 h-3 mr-1.5" />
                Generate Dye Layer
              </>
            )}
          </Button>
          <p className="text-[10px] text-muted-foreground">
            AI paints each object with a unique high-contrast color for precise selection.
          </p>
        </div>
      )}
      
      {/* Stage 3: Extract Selections */}
      {isDyeReady && (
        <div className="space-y-2 border-t border-border pt-3">
          <Label className="text-xs flex items-center gap-1.5">
            <Wand2 className="w-3 h-3" />
            Step 3: Extract Selections
          </Label>
          
          {/* Show Dye Overlay Toggle */}
          <div className="flex items-center justify-between">
            <Label className="text-xs flex items-center gap-1.5">
              {showDyeOverlay ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
              Show Dye Overlay
            </Label>
            <Switch
              checked={showDyeOverlay}
              onCheckedChange={onShowDyeOverlayChange}
            />
          </div>
          
          <Button
            size="sm"
            variant="default"
            className="w-full h-8 text-xs"
            onClick={onAutoExtractAll}
            disabled={isProcessing}
          >
            <Sparkles className="w-3 h-3 mr-1.5" />
            Auto-Extract All Objects
          </Button>
          <p className="text-[10px] text-muted-foreground">
            Click objects in the list to extract individual selections, or auto-extract all.
          </p>
        </div>
      )}
      
      {/* Instructions */}
      <div className="pt-2 border-t border-border space-y-1 mt-auto">
        <p className="text-[10px] text-muted-foreground font-medium">How it works:</p>
        <ol className="text-[10px] text-muted-foreground space-y-0.5 list-decimal list-inside">
          <li>AI discovers objects in your image</li>
          <li>AI generates a dye layer with unique colors</li>
          <li>Magic wand extracts based on dye colors</li>
          <li>Selection applies to original image</li>
        </ol>
      </div>
    </div>
  );
};
