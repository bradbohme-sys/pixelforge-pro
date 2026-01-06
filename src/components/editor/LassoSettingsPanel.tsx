import React from 'react';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Wand2, Target, Sparkles, TrendingUp, Eye, Settings2 } from 'lucide-react';
import type { 
  LassoSettings, 
  LassoVariant, 
  EdgeMethod, 
  AnchorMode,
  LassoMetrics 
} from '@/components/CanvasV3/lasso/types';

interface LassoSettingsPanelProps {
  settings: LassoSettings;
  metrics: LassoMetrics;
  showEdgeMapOverlay?: boolean;
  edgeMapColorScheme?: 'heat' | 'grayscale' | 'direction';
  onSettingsChange: (settings: Partial<LassoSettings>) => void;
  onVariantChange: (variant: LassoVariant) => void;
  onShowEdgeMapOverlayChange?: (show: boolean) => void;
  onEdgeMapColorSchemeChange?: (scheme: 'heat' | 'grayscale' | 'direction') => void;
}

export const LassoSettingsPanel: React.FC<LassoSettingsPanelProps> = ({
  settings,
  metrics,
  showEdgeMapOverlay = false,
  edgeMapColorScheme = 'heat',
  onSettingsChange,
  onVariantChange,
  onShowEdgeMapOverlayChange,
  onEdgeMapColorSchemeChange,
}) => {
  const variantDescriptions: Record<LassoVariant, string> = {
    'classic-dijkstra': 'Pure edge following with manual anchors',
    'photoshop-auto': 'Auto-anchoring based on distance/time',
    'elastic-progressive': 'Progressive anchor strength with rubber-banding',
    'predictive-directional': 'Movement prediction with directional search',
  };

  return (
    <div className="p-3 space-y-4 bg-card border-r border-border w-64 overflow-y-auto max-h-full">
      <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
        <Wand2 className="w-3 h-3" />
        Magnetic Lasso
      </h3>
      
      {/* Variant Selection */}
      <div className="space-y-2">
        <Label className="text-xs">Lasso Mode</Label>
        <Select 
          value={settings.variant} 
          onValueChange={(v) => onVariantChange(v as LassoVariant)}
        >
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="classic-dijkstra">Classic (Intelligent Scissors)</SelectItem>
            <SelectItem value="photoshop-auto">Photoshop-Style Auto</SelectItem>
            <SelectItem value="elastic-progressive">Elastic Progressive</SelectItem>
            <SelectItem value="predictive-directional">Predictive Directional</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-[10px] text-muted-foreground">
          {variantDescriptions[settings.variant]}
        </p>
      </div>

      <Tabs defaultValue="edge" className="w-full">
        <TabsList className="grid grid-cols-4 h-7">
          <TabsTrigger value="edge" className="text-[10px] px-1">
            <Eye className="w-3 h-3" />
          </TabsTrigger>
          <TabsTrigger value="anchor" className="text-[10px] px-1">
            <Target className="w-3 h-3" />
          </TabsTrigger>
          <TabsTrigger value="cursor" className="text-[10px] px-1">
            <Sparkles className="w-3 h-3" />
          </TabsTrigger>
          <TabsTrigger value="visual" className="text-[10px] px-1">
            <Settings2 className="w-3 h-3" />
          </TabsTrigger>
        </TabsList>

        {/* Edge Detection Tab */}
        <TabsContent value="edge" className="space-y-3 mt-3">
          <div className="space-y-2">
            <Label className="text-xs">Edge Method</Label>
            <Select 
              value={settings.edge.method} 
              onValueChange={(v) => onSettingsChange({ 
                edge: { ...settings.edge, method: v as EdgeMethod } 
              })}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sobel">Sobel</SelectItem>
                <SelectItem value="prewitt">Prewitt</SelectItem>
                <SelectItem value="scharr">Scharr</SelectItem>
                <SelectItem value="roberts">Roberts Cross</SelectItem>
                <SelectItem value="laplacian">Laplacian (LoG)</SelectItem>
                <SelectItem value="canny">Canny (Full)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Sensitivity</Label>
              <span className="text-xs font-mono text-muted-foreground">
                {settings.edge.sensitivity}
              </span>
            </div>
            <Slider
              value={[settings.edge.sensitivity]}
              min={0}
              max={100}
              step={1}
              onValueChange={([v]) => onSettingsChange({
                edge: { ...settings.edge, sensitivity: v }
              })}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Blur Radius</Label>
              <span className="text-xs font-mono text-muted-foreground">
                {settings.edge.blurRadius.toFixed(1)}
              </span>
            </div>
            <Slider
              value={[settings.edge.blurRadius]}
              min={0}
              max={5}
              step={0.1}
              onValueChange={([v]) => onSettingsChange({
                edge: { ...settings.edge, blurRadius: v }
              })}
            />
          </div>

          {settings.edge.method === 'canny' && (
            <>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Hysteresis Low</Label>
                  <span className="text-xs font-mono text-muted-foreground">
                    {settings.edge.hysteresisLow}
                  </span>
                </div>
                <Slider
                  value={[settings.edge.hysteresisLow]}
                  min={0}
                  max={100}
                  step={1}
                  onValueChange={([v]) => onSettingsChange({
                    edge: { ...settings.edge, hysteresisLow: v }
                  })}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Hysteresis High</Label>
                  <span className="text-xs font-mono text-muted-foreground">
                    {settings.edge.hysteresisHigh}
                  </span>
                </div>
                <Slider
                  value={[settings.edge.hysteresisHigh]}
                  min={50}
                  max={255}
                  step={1}
                  onValueChange={([v]) => onSettingsChange({
                    edge: { ...settings.edge, hysteresisHigh: v }
                  })}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label className="text-xs">Non-Max Suppression</Label>
                <Switch
                  checked={settings.edge.useNMS}
                  onCheckedChange={(v) => onSettingsChange({
                    edge: { ...settings.edge, useNMS: v }
                  })}
                />
              </div>
            </>
          )}
        </TabsContent>

        {/* Anchor Tab */}
        <TabsContent value="anchor" className="space-y-3 mt-3">
          <div className="space-y-2">
            <Label className="text-xs">Anchor Mode</Label>
            <Select 
              value={settings.anchor.mode} 
              onValueChange={(v) => onSettingsChange({ 
                anchor: { ...settings.anchor, mode: v as AnchorMode } 
              })}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="manual">Manual (Click)</SelectItem>
                <SelectItem value="distance">Distance-Based</SelectItem>
                <SelectItem value="time">Time-Based</SelectItem>
                <SelectItem value="hybrid">Hybrid (Distance + Time)</SelectItem>
                <SelectItem value="elastic">Elastic Progressive</SelectItem>
                <SelectItem value="edge-quality">Edge Quality</SelectItem>
                <SelectItem value="predictive">Predictive</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {settings.anchor.mode !== 'manual' && (
            <>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Distance Threshold</Label>
                  <span className="text-xs font-mono text-muted-foreground">
                    {settings.anchor.distanceThreshold}px
                  </span>
                </div>
                <Slider
                  value={[settings.anchor.distanceThreshold]}
                  min={10}
                  max={100}
                  step={5}
                  onValueChange={([v]) => onSettingsChange({
                    anchor: { ...settings.anchor, distanceThreshold: v }
                  })}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Time Interval</Label>
                  <span className="text-xs font-mono text-muted-foreground">
                    {settings.anchor.timeInterval}ms
                  </span>
                </div>
                <Slider
                  value={[settings.anchor.timeInterval]}
                  min={100}
                  max={1000}
                  step={50}
                  onValueChange={([v]) => onSettingsChange({
                    anchor: { ...settings.anchor, timeInterval: v }
                  })}
                />
              </div>
            </>
          )}

          {settings.anchor.mode === 'elastic' && (
            <>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Elastic Zone</Label>
                  <span className="text-xs font-mono text-muted-foreground">
                    {settings.anchor.elasticZoneLength}px
                  </span>
                </div>
                <Slider
                  value={[settings.anchor.elasticZoneLength]}
                  min={20}
                  max={150}
                  step={10}
                  onValueChange={([v]) => onSettingsChange({
                    anchor: { ...settings.anchor, elasticZoneLength: v }
                  })}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Strength Curve</Label>
                <Select 
                  value={settings.anchor.strengthCurve} 
                  onValueChange={(v) => onSettingsChange({ 
                    anchor: { ...settings.anchor, strengthCurve: v as 'linear' | 'exponential' | 'ease-in-out' } 
                  })}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="linear">Linear</SelectItem>
                    <SelectItem value="exponential">Exponential</SelectItem>
                    <SelectItem value="ease-in-out">Ease In-Out</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
        </TabsContent>

        {/* Cursor Tab */}
        <TabsContent value="cursor" className="space-y-3 mt-3">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Dead Zone Radius</Label>
              <span className="text-xs font-mono text-muted-foreground">
                {settings.cursor.radius}px
              </span>
            </div>
            <Slider
              value={[settings.cursor.radius]}
              min={5}
              max={50}
              step={1}
              onValueChange={([v]) => onSettingsChange({
                cursor: { ...settings.cursor, radius: v }
              })}
            />
            <p className="text-[10px] text-muted-foreground">
              Larger = more stabilization
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Search Radius</Label>
              <span className="text-xs font-mono text-muted-foreground">
                {settings.cursor.searchRadius}px
              </span>
            </div>
            <Slider
              value={[settings.cursor.searchRadius]}
              min={5}
              max={50}
              step={1}
              onValueChange={([v]) => onSettingsChange({
                cursor: { ...settings.cursor, searchRadius: v }
              })}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Smoothing</Label>
              <span className="text-xs font-mono text-muted-foreground">
                {(settings.cursor.smoothingFactor * 100).toFixed(0)}%
              </span>
            </div>
            <Slider
              value={[settings.cursor.smoothingFactor * 100]}
              min={10}
              max={100}
              step={5}
              onValueChange={([v]) => onSettingsChange({
                cursor: { ...settings.cursor, smoothingFactor: v / 100 }
              })}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Trajectory Lookback</Label>
              <span className="text-xs font-mono text-muted-foreground">
                {settings.cursor.trajectoryLookback}
              </span>
            </div>
            <Slider
              value={[settings.cursor.trajectoryLookback]}
              min={2}
              max={20}
              step={1}
              onValueChange={([v]) => onSettingsChange({
                cursor: { ...settings.cursor, trajectoryLookback: v }
              })}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Cursor Influence</Label>
              <span className="text-xs font-mono text-muted-foreground">
                {(settings.pathfinding.cursorInfluence * 100).toFixed(0)}%
              </span>
            </div>
            <Slider
              value={[settings.pathfinding.cursorInfluence * 100]}
              min={0}
              max={100}
              step={5}
              onValueChange={([v]) => onSettingsChange({
                pathfinding: { ...settings.pathfinding, cursorInfluence: v / 100 }
              })}
            />
            <p className="text-[10px] text-muted-foreground">
              Higher = follows cursor more, Lower = follows edges more
            </p>
          </div>
        </TabsContent>

        {/* Visualization Tab */}
        <TabsContent value="visual" className="space-y-3 mt-3">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Node Size</Label>
              <span className="text-xs font-mono text-muted-foreground">
                {settings.visualization.nodeSize}px
              </span>
            </div>
            <Slider
              value={[settings.visualization.nodeSize]}
              min={3}
              max={12}
              step={1}
              onValueChange={([v]) => onSettingsChange({
                visualization: { ...settings.visualization, nodeSize: v }
              })}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label className="text-xs">Show Metrics</Label>
            <Switch
              checked={settings.visualization.showMetrics}
              onCheckedChange={(v) => onSettingsChange({
                visualization: { ...settings.visualization, showMetrics: v }
              })}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label className="text-xs">Elastic Gradient</Label>
            <Switch
              checked={settings.visualization.showElasticGradient}
              onCheckedChange={(v) => onSettingsChange({
                visualization: { ...settings.visualization, showElasticGradient: v }
              })}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label className="text-xs">Edge Trail</Label>
            <Switch
              checked={settings.visualization.showEdgeTrail}
              onCheckedChange={(v) => onSettingsChange({
                visualization: { ...settings.visualization, showEdgeTrail: v }
              })}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label className="text-xs">Prediction Zone</Label>
            <Switch
              checked={settings.visualization.showPredictionZone}
              onCheckedChange={(v) => onSettingsChange({
                visualization: { ...settings.visualization, showPredictionZone: v }
              })}
            />
          </div>

          {/* Edge Map Overlay */}
          <div className="pt-2 border-t border-border/50 space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Edge Map Overlay</Label>
              <Switch
                checked={showEdgeMapOverlay}
                onCheckedChange={onShowEdgeMapOverlayChange}
              />
            </div>
            
            {showEdgeMapOverlay && (
              <div className="space-y-2">
                <Label className="text-xs">Color Scheme</Label>
                <Select 
                  value={edgeMapColorScheme} 
                  onValueChange={(v) => onEdgeMapColorSchemeChange?.(v as 'heat' | 'grayscale' | 'direction')}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="heat">Heatmap (Blue→Red)</SelectItem>
                    <SelectItem value="grayscale">Grayscale</SelectItem>
                    <SelectItem value="direction">Direction (Hue Wheel)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Metrics Display */}
      {settings.visualization.showMetrics && (
        <div className="pt-3 border-t border-border space-y-1">
          <h4 className="text-[10px] font-medium text-muted-foreground uppercase flex items-center gap-1">
            <TrendingUp className="w-3 h-3" />
            Live Metrics
          </h4>
          <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[10px] font-mono">
            <span className="text-muted-foreground">FPS:</span>
            <span className="text-foreground">{metrics.fps.toFixed(0)}</span>
            <span className="text-muted-foreground">Path:</span>
            <span className="text-foreground">{metrics.pathComputeMs.toFixed(1)}ms</span>
            <span className="text-muted-foreground">Points:</span>
            <span className="text-foreground">{metrics.totalPoints}</span>
            <span className="text-muted-foreground">Anchors:</span>
            <span className="text-foreground">{metrics.anchorCount}</span>
            <span className="text-muted-foreground">Edge:</span>
            <span className="text-foreground">{(metrics.edgeQuality * 100).toFixed(0)}%</span>
            <span className="text-muted-foreground">Speed:</span>
            <span className="text-foreground">{metrics.cursorSpeed.toFixed(0)}px/s</span>
          </div>
        </div>
      )}

      {/* Modifier hints */}
      <div className="pt-2 border-t border-border space-y-1">
        <p className="text-[10px] text-muted-foreground">
          <span className="font-medium text-foreground">Click</span> to place anchor
        </p>
        <p className="text-[10px] text-muted-foreground">
          <span className="font-medium text-foreground">Double-click</span> to complete
        </p>
        <p className="text-[10px] text-muted-foreground">
          <span className="font-medium text-foreground">Escape</span> to cancel
        </p>
        <p className="text-[10px] text-muted-foreground">
          <span className="font-medium text-foreground">Backspace</span> to undo anchor
        </p>
      </div>
    </div>
  );
};
