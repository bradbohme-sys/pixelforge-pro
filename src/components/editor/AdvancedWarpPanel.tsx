/**
 * Advanced Warp Panel - Comprehensive UI for Pin-Based Deformation
 * 
 * Features:
 * - Pin type selection (cage, control, bone)
 * - Connection management
 * - 3D depth controls (push/pull)
 * - Falloff curve editor
 * - Pin property sliders
 * - Group management
 */

import React, { useState } from 'react';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Anchor,
  Move3D,
  Bone,
  Link,
  Unlink,
  Trash2,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Grid3X3,
  FlipHorizontal,
  FlipVertical,
  RotateCcw,
  Circle,
  Square,
  Spline,
  Layers,
  ChevronDown,
  ChevronRight,
  Crosshair,
  ArrowUpDown,
  Maximize2,
  RotateCw,
} from 'lucide-react';
import type {
  AdvancedWarpState,
  AdvancedWarpToolMode,
  AdvancedPin,
  CagePin,
  ControlPin,
  BonePin,
  PinConnection,
  FalloffType,
  ConnectionType,
  SymmetryMode,
  DepthSettings,
} from '@/components/CanvasV3/TesseraWarp/AdvancedPinTypes';

interface AdvancedWarpPanelProps {
  state: AdvancedWarpState;
  onToolModeChange: (mode: AdvancedWarpToolMode) => void;
  onPinSelect: (id: string | null, addToSelection?: boolean) => void;
  onPinDelete: (id: string) => void;
  onDeleteSelected: () => void;
  onClearAll: () => void;
  // Pin property updates
  onUpdatePinRadius: (id: string, radius: number) => void;
  onUpdatePinStrength: (id: string, strength: number) => void;
  onUpdatePinAngle: (id: string, angle: number) => void;
  onUpdatePinScale: (id: string, scale: number) => void;
  onUpdatePinDepth: (id: string, depth: number) => void;
  onUpdatePinFalloff: (id: string, falloff: { type: FalloffType }) => void;
  onLockPin: (id: string, locked: boolean) => void;
  // Connections
  onAutoConnect: (mode: 'nearest' | 'sequential' | 'mesh') => void;
  onUpdateConnectionStrength: (id: string, strength: number) => void;
  onUpdateConnectionType: (id: string, type: ConnectionType) => void;
  onRemoveConnection: (id: string) => void;
  // Settings
  onDepthSettingsChange: (settings: Partial<DepthSettings>) => void;
  onSymmetryChange: (mode: SymmetryMode) => void;
  onToggleConnections: () => void;
  onToggleInfluence: () => void;
  onToggleMesh: () => void;
}

export const AdvancedWarpPanel: React.FC<AdvancedWarpPanelProps> = ({
  state,
  onToolModeChange,
  onPinSelect,
  onPinDelete,
  onDeleteSelected,
  onClearAll,
  onUpdatePinRadius,
  onUpdatePinStrength,
  onUpdatePinAngle,
  onUpdatePinScale,
  onUpdatePinDepth,
  onUpdatePinFalloff,
  onLockPin,
  onAutoConnect,
  onUpdateConnectionStrength,
  onUpdateConnectionType,
  onRemoveConnection,
  onDepthSettingsChange,
  onSymmetryChange,
  onToggleConnections,
  onToggleInfluence,
  onToggleMesh,
}) => {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['tools', 'selected', 'depth'])
  );

  const toggleSection = (section: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  };

  const selectedPins = state.pins.filter(p => state.selectedPinIds.includes(p.id));
  const selectedPin = selectedPins.length === 1 ? selectedPins[0] : null;

  const cagePins = state.pins.filter(p => p.kind === 'cage');
  const controlPins = state.pins.filter(p => p.kind === 'control');
  const bonePins = state.pins.filter(p => p.kind === 'bone');

  return (
    <div className="w-72 bg-card border-l border-border flex flex-col h-full">
      <div className="p-3 border-b border-border">
        <h3 className="font-semibold text-sm flex items-center gap-2">
          <Spline className="w-4 h-4 text-primary" />
          Advanced Warp
        </h3>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-3 space-y-4">
          {/* Tool Mode Selection */}
          <Section
            title="Pin Tools"
            icon={<Crosshair className="w-4 h-4" />}
            expanded={expandedSections.has('tools')}
            onToggle={() => toggleSection('tools')}
          >
            <div className="grid grid-cols-4 gap-1.5">
              <ToolButton
                icon={<Move3D className="w-4 h-4" />}
                label="Select"
                active={state.toolMode === 'select'}
                onClick={() => onToolModeChange('select')}
              />
              <ToolButton
                icon={<Anchor className="w-4 h-4" />}
                label="Cage"
                active={state.toolMode === 'cage'}
                onClick={() => onToolModeChange('cage')}
                color="text-green-400"
              />
              <ToolButton
                icon={<Circle className="w-4 h-4" />}
                label="Control"
                active={state.toolMode === 'control'}
                onClick={() => onToolModeChange('control')}
                color="text-blue-400"
              />
              <ToolButton
                icon={<Bone className="w-4 h-4" />}
                label="Bone"
                active={state.toolMode === 'bone'}
                onClick={() => onToolModeChange('bone')}
                color="text-amber-400"
              />
            </div>

            <div className="grid grid-cols-3 gap-1.5 mt-2">
              <ToolButton
                icon={<Link className="w-4 h-4" />}
                label="Connect"
                active={state.toolMode === 'connect'}
                onClick={() => onToolModeChange('connect')}
              />
              <ToolButton
                icon={<Unlink className="w-4 h-4" />}
                label="Disconnect"
                active={state.toolMode === 'disconnect'}
                onClick={() => onToolModeChange('disconnect')}
              />
              <ToolButton
                icon={<Layers className="w-4 h-4" />}
                label="Group"
                active={state.toolMode === 'group'}
                onClick={() => onToolModeChange('group')}
              />
            </div>
          </Section>

          {/* Pin Stats */}
          <div className="flex gap-2 text-xs">
            <Badge variant="outline" className="text-green-400">
              <Anchor className="w-3 h-3 mr-1" />
              {cagePins.length}
            </Badge>
            <Badge variant="outline" className="text-blue-400">
              <Circle className="w-3 h-3 mr-1" />
              {controlPins.length}
            </Badge>
            <Badge variant="outline" className="text-amber-400">
              <Bone className="w-3 h-3 mr-1" />
              {bonePins.length}
            </Badge>
            <Badge variant="outline">
              <Link className="w-3 h-3 mr-1" />
              {state.connections.length}
            </Badge>
          </div>

          {/* Selected Pin Properties */}
          {selectedPin && (
            <Section
              title={`${selectedPin.kind.charAt(0).toUpperCase() + selectedPin.kind.slice(1)} Pin`}
              icon={getPinIcon(selectedPin.kind)}
              expanded={expandedSections.has('selected')}
              onToggle={() => toggleSection('selected')}
            >
              <div className="space-y-3">
                {/* Lock / Visibility */}
                <div className="flex gap-2">
                  <Button
                    variant={selectedPin.locked ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => onLockPin(selectedPin.id, !selectedPin.locked)}
                    className="flex-1"
                  >
                    {selectedPin.locked ? (
                      <Lock className="w-4 h-4 mr-1" />
                    ) : (
                      <Unlock className="w-4 h-4 mr-1" />
                    )}
                    {selectedPin.locked ? 'Locked' : 'Unlocked'}
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => onPinDelete(selectedPin.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>

                {/* Radius */}
                <SliderControl
                  label="Radius"
                  value={selectedPin.radius}
                  min={5}
                  max={200}
                  onChange={(v) => onUpdatePinRadius(selectedPin.id, v)}
                />

                {/* Strength */}
                <SliderControl
                  label="Strength"
                  value={selectedPin.kind === 'control' ? (selectedPin as ControlPin).strength : (selectedPin as CagePin | BonePin).stiffness}
                  min={0}
                  max={1}
                  step={0.01}
                  onChange={(v) => onUpdatePinStrength(selectedPin.id, v)}
                  format={(v) => `${Math.round(v * 100)}%`}
                />

                {/* Control Pin specific */}
                {selectedPin.kind === 'control' && (
                  <>
                    {/* Angle */}
                    <SliderControl
                      label="Rotation"
                      value={(selectedPin as ControlPin).angle}
                      min={-Math.PI}
                      max={Math.PI}
                      step={0.01}
                      onChange={(v) => onUpdatePinAngle(selectedPin.id, v)}
                      format={(v) => `${Math.round((v * 180) / Math.PI)}°`}
                    />

                    {/* Scale */}
                    <SliderControl
                      label="Scale"
                      value={(selectedPin as ControlPin).scale}
                      min={0.1}
                      max={3}
                      step={0.01}
                      onChange={(v) => onUpdatePinScale(selectedPin.id, v)}
                      format={(v) => `${Math.round(v * 100)}%`}
                    />

                    {/* Depth (Z) */}
                    <SliderControl
                      label="Depth (Push/Pull)"
                      value={(selectedPin as ControlPin).target.z}
                      min={-100}
                      max={100}
                      onChange={(v) => onUpdatePinDepth(selectedPin.id, v)}
                      format={(v) => v > 0 ? `+${v.toFixed(0)}` : v.toFixed(0)}
                      showZeroCenter
                    />

                    {/* Falloff */}
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Falloff Curve</Label>
                      <Select
                        value={(selectedPin as ControlPin).falloff.type}
                        onValueChange={(v) => onUpdatePinFalloff(selectedPin.id, { type: v as FalloffType })}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="linear">Linear</SelectItem>
                          <SelectItem value="smooth">Smooth (Hermite)</SelectItem>
                          <SelectItem value="gaussian">Gaussian (Natural)</SelectItem>
                          <SelectItem value="sharp">Sharp (Quick drop)</SelectItem>
                          <SelectItem value="flat">Flat (Hard edge)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}

                {/* Bone Pin specific */}
                {selectedPin.kind === 'bone' && (
                  <>
                    <SliderControl
                      label="Bone Length"
                      value={(selectedPin as BonePin).length}
                      min={10}
                      max={200}
                      onChange={(v) => {/* TODO */}}
                    />

                    <SliderControl
                      label="Rotation"
                      value={(selectedPin as BonePin).angle}
                      min={-Math.PI}
                      max={Math.PI}
                      step={0.01}
                      onChange={(v) => onUpdatePinAngle(selectedPin.id, v)}
                      format={(v) => `${Math.round((v * 180) / Math.PI)}°`}
                    />

                    <div className="flex items-center justify-between">
                      <Label className="text-xs">IK Enabled</Label>
                      <Switch checked={(selectedPin as BonePin).ikEnabled} />
                    </div>
                  </>
                )}
              </div>
            </Section>
          )}

          {/* Connections */}
          {cagePins.length >= 2 && (
            <Section
              title="Cage Connections"
              icon={<Link className="w-4 h-4" />}
              expanded={expandedSections.has('connections')}
              onToggle={() => toggleSection('connections')}
            >
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Auto-Connect Cage Pins</Label>
                <div className="grid grid-cols-3 gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onAutoConnect('nearest')}
                    className="text-xs"
                  >
                    Nearest
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onAutoConnect('sequential')}
                    className="text-xs"
                  >
                    Loop
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onAutoConnect('mesh')}
                    className="text-xs"
                  >
                    Mesh
                  </Button>
                </div>

                {state.connections.length > 0 && (
                  <div className="mt-3 space-y-1.5 max-h-32 overflow-y-auto">
                    {state.connections.slice(0, 10).map((conn) => (
                      <ConnectionRow
                        key={conn.id}
                        connection={conn}
                        pins={state.pins}
                        onStrengthChange={(s) => onUpdateConnectionStrength(conn.id, s)}
                        onTypeChange={(t) => onUpdateConnectionType(conn.id, t)}
                        onRemove={() => onRemoveConnection(conn.id)}
                      />
                    ))}
                    {state.connections.length > 10 && (
                      <div className="text-xs text-muted-foreground text-center">
                        +{state.connections.length - 10} more connections
                      </div>
                    )}
                  </div>
                )}
              </div>
            </Section>
          )}

          {/* 3D Depth Settings */}
          <Section
            title="3D Depth Effect"
            icon={<ArrowUpDown className="w-4 h-4" />}
            expanded={expandedSections.has('depth')}
            onToggle={() => toggleSection('depth')}
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Enable 3D Depth</Label>
                <Switch
                  checked={state.depthSettings.enabled}
                  onCheckedChange={(v) => onDepthSettingsChange({ enabled: v })}
                />
              </div>

              {state.depthSettings.enabled && (
                <>
                  <SliderControl
                    label="Perspective"
                    value={state.depthSettings.perspectiveStrength}
                    min={0}
                    max={1}
                    step={0.01}
                    onChange={(v) => onDepthSettingsChange({ perspectiveStrength: v })}
                    format={(v) => `${Math.round(v * 100)}%`}
                  />

                  <SliderControl
                    label="Max Depth"
                    value={state.depthSettings.maxDepth}
                    min={20}
                    max={200}
                    onChange={(v) => onDepthSettingsChange({ maxDepth: v })}
                    format={(v) => `${v}px`}
                  />

                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Ambient Occlusion</Label>
                    <Switch
                      checked={state.depthSettings.ambientOcclusion}
                      onCheckedChange={(v) => onDepthSettingsChange({ ambientOcclusion: v })}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Specular Highlights</Label>
                    <Switch
                      checked={state.depthSettings.specularHighlights}
                      onCheckedChange={(v) => onDepthSettingsChange({ specularHighlights: v })}
                    />
                  </div>
                </>
              )}
            </div>
          </Section>

          {/* View Options */}
          <Section
            title="View Options"
            icon={<Eye className="w-4 h-4" />}
            expanded={expandedSections.has('view')}
            onToggle={() => toggleSection('view')}
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Show Connections</Label>
                <Switch
                  checked={state.showConnections}
                  onCheckedChange={onToggleConnections}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-xs">Show Influence Radii</Label>
                <Switch
                  checked={state.showInfluence}
                  onCheckedChange={onToggleInfluence}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-xs">Show Mesh Wireframe</Label>
                <Switch
                  checked={state.showMesh}
                  onCheckedChange={onToggleMesh}
                />
              </div>
            </div>
          </Section>

          {/* Symmetry */}
          <Section
            title="Symmetry"
            icon={<FlipHorizontal className="w-4 h-4" />}
            expanded={expandedSections.has('symmetry')}
            onToggle={() => toggleSection('symmetry')}
          >
            <div className="grid grid-cols-4 gap-1">
              <SymmetryButton
                icon={<Square className="w-4 h-4" />}
                label="Off"
                active={state.symmetryMode === 'none'}
                onClick={() => onSymmetryChange('none')}
              />
              <SymmetryButton
                icon={<FlipHorizontal className="w-4 h-4" />}
                label="H"
                active={state.symmetryMode === 'horizontal'}
                onClick={() => onSymmetryChange('horizontal')}
              />
              <SymmetryButton
                icon={<FlipVertical className="w-4 h-4" />}
                label="V"
                active={state.symmetryMode === 'vertical'}
                onClick={() => onSymmetryChange('vertical')}
              />
              <SymmetryButton
                icon={<RotateCw className="w-4 h-4" />}
                label="Rad"
                active={state.symmetryMode === 'radial'}
                onClick={() => onSymmetryChange('radial')}
              />
            </div>
          </Section>

          {/* Actions */}
          <Separator />
          <div className="space-y-2">
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={onDeleteSelected}
              disabled={state.selectedPinIds.length === 0}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete Selected ({state.selectedPinIds.length})
            </Button>
            <Button
              variant="destructive"
              size="sm"
              className="w-full"
              onClick={onClearAll}
              disabled={state.pins.length === 0}
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Clear All Pins
            </Button>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
};

// ============================================
// HELPER COMPONENTS
// ============================================

interface SectionProps {
  title: string;
  icon: React.ReactNode;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

const Section: React.FC<SectionProps> = ({ title, icon, expanded, onToggle, children }) => (
  <div className="space-y-2">
    <button
      onClick={onToggle}
      className="flex items-center gap-2 w-full text-left text-sm font-medium hover:text-primary transition-colors"
    >
      {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
      {icon}
      {title}
    </button>
    {expanded && <div className="pl-6 space-y-2">{children}</div>}
  </div>
);

interface ToolButtonProps {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
  color?: string;
}

const ToolButton: React.FC<ToolButtonProps> = ({ icon, label, active, onClick, color }) => (
  <button
    onClick={onClick}
    className={`
      p-2 rounded-md flex flex-col items-center gap-0.5 text-xs transition-colors
      ${active ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80'}
      ${!active && color ? color : ''}
    `}
    title={label}
  >
    {icon}
    <span className="text-[10px]">{label}</span>
  </button>
);

interface SymmetryButtonProps {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}

const SymmetryButton: React.FC<SymmetryButtonProps> = ({ icon, label, active, onClick }) => (
  <button
    onClick={onClick}
    className={`
      p-2 rounded-md flex flex-col items-center gap-0.5 text-xs transition-colors
      ${active ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80'}
    `}
    title={label}
  >
    {icon}
    <span className="text-[10px]">{label}</span>
  </button>
);

interface SliderControlProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  format?: (value: number) => string;
  showZeroCenter?: boolean;
}

const SliderControl: React.FC<SliderControlProps> = ({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  format = (v) => v.toString(),
  showZeroCenter = false,
}) => (
  <div className="space-y-1.5">
    <div className="flex items-center justify-between">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <span className="text-xs font-mono">{format(value)}</span>
    </div>
    <Slider
      value={[value]}
      min={min}
      max={max}
      step={step}
      onValueChange={([v]) => onChange(v)}
    />
  </div>
);

interface ConnectionRowProps {
  connection: PinConnection;
  pins: AdvancedPin[];
  onStrengthChange: (strength: number) => void;
  onTypeChange: (type: ConnectionType) => void;
  onRemove: () => void;
}

const ConnectionRow: React.FC<ConnectionRowProps> = ({
  connection,
  pins,
  onStrengthChange,
  onTypeChange,
  onRemove,
}) => {
  const from = pins.find(p => p.id === connection.fromId);
  const to = pins.find(p => p.id === connection.toId);
  
  return (
    <div className="flex items-center gap-1 p-1.5 bg-muted/50 rounded text-xs">
      <div 
        className="w-2 h-2 rounded-full" 
        style={{ backgroundColor: connection.color }}
      />
      <span className="flex-1 truncate">
        {from?.name?.slice(0, 8) || '?'} → {to?.name?.slice(0, 8) || '?'}
      </span>
      <button
        onClick={onRemove}
        className="p-0.5 hover:bg-destructive/20 rounded"
      >
        <Trash2 className="w-3 h-3" />
      </button>
    </div>
  );
};

function getPinIcon(kind: string): React.ReactNode {
  switch (kind) {
    case 'cage': return <Anchor className="w-4 h-4 text-green-400" />;
    case 'control': return <Circle className="w-4 h-4 text-blue-400" />;
    case 'bone': return <Bone className="w-4 h-4 text-amber-400" />;
    default: return <Circle className="w-4 h-4" />;
  }
}

export default AdvancedWarpPanel;
