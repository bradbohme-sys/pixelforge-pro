import React from 'react';
import {
  ZoomIn,
  ZoomOut,
  Maximize,
  RotateCcw,
  Download,
  Upload,
  Undo,
  Redo,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface TopBarProps {
  zoomPercent: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetView: () => void;
  onFitToScreen: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onExport: () => void;
  onImport: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
}

export const TopBar: React.FC<TopBarProps> = ({
  zoomPercent,
  onZoomIn,
  onZoomOut,
  onResetView,
  onFitToScreen,
  onUndo,
  onRedo,
  onExport,
  onImport,
  canUndo = false,
  canRedo = false,
}) => {
  return (
    <div className="flex items-center justify-between px-3 py-1.5 bg-card border-b border-border">
      {/* Left section - File actions */}
      <div className="flex items-center gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="sm" onClick={onImport}>
              <Upload size={14} className="mr-1.5" />
              Import
            </Button>
          </TooltipTrigger>
          <TooltipContent>Import image</TooltipContent>
        </Tooltip>
        
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="sm" onClick={onExport}>
              <Download size={14} className="mr-1.5" />
              Export
            </Button>
          </TooltipTrigger>
          <TooltipContent>Export image</TooltipContent>
        </Tooltip>
        
        <Separator orientation="vertical" className="h-5 mx-2" />
        
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={onUndo}
              disabled={!canUndo}
            >
              <Undo size={14} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Undo (Ctrl+Z)</TooltipContent>
        </Tooltip>
        
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={onRedo}
              disabled={!canRedo}
            >
              <Redo size={14} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Redo (Ctrl+Shift+Z)</TooltipContent>
        </Tooltip>
      </div>
      
      {/* Center - Title */}
      <div className="absolute left-1/2 -translate-x-1/2">
        <span className="text-sm font-medium text-muted-foreground">
          V3 Image Editor
        </span>
      </div>
      
      {/* Right section - Zoom controls */}
      <div className="flex items-center gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onZoomOut}>
              <ZoomOut size={14} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Zoom out</TooltipContent>
        </Tooltip>
        
        <span className="w-12 text-center text-xs font-mono text-muted-foreground">
          {zoomPercent}%
        </span>
        
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onZoomIn}>
              <ZoomIn size={14} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Zoom in</TooltipContent>
        </Tooltip>
        
        <Separator orientation="vertical" className="h-5 mx-2" />
        
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onResetView}>
              <RotateCcw size={14} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Reset view (100%)</TooltipContent>
        </Tooltip>
        
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onFitToScreen}>
              <Maximize size={14} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Fit to screen</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
};
