import React from 'react';
import { cn } from '@/lib/utils';
import {
  MousePointer2,
  Move,
  Wand2,
  Lasso,
  Paintbrush,
  Eraser,
  Hand,
  ZoomIn,
  Crop,
  Type,
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { ToolType } from '../CanvasV3/types';

interface ToolbarProps {
  activeTool: ToolType;
  onToolChange: (tool: ToolType) => void;
}

interface ToolDefinition {
  id: ToolType;
  icon: React.ReactNode;
  label: string;
  shortcut: string;
}

const tools: ToolDefinition[] = [
  { id: 'select', icon: <MousePointer2 size={18} />, label: 'Select', shortcut: 'V' },
  { id: 'move', icon: <Move size={18} />, label: 'Move', shortcut: 'M' },
  { id: 'magic-wand', icon: <Wand2 size={18} />, label: 'Magic Wand', shortcut: 'W' },
  { id: 'lasso', icon: <Lasso size={18} />, label: 'Lasso', shortcut: 'L' },
  { id: 'brush', icon: <Paintbrush size={18} />, label: 'Brush', shortcut: 'B' },
  { id: 'eraser', icon: <Eraser size={18} />, label: 'Eraser', shortcut: 'E' },
  { id: 'crop', icon: <Crop size={18} />, label: 'Crop', shortcut: 'C' },
  { id: 'text', icon: <Type size={18} />, label: 'Text', shortcut: 'T' },
  { id: 'pan', icon: <Hand size={18} />, label: 'Pan', shortcut: 'H' },
  { id: 'zoom', icon: <ZoomIn size={18} />, label: 'Zoom', shortcut: 'Z' },
];

export const LeftToolbar: React.FC<ToolbarProps> = ({ activeTool, onToolChange }) => {
  // Keyboard shortcuts
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      
      const tool = tools.find(t => t.shortcut.toLowerCase() === e.key.toLowerCase());
      if (tool) {
        e.preventDefault();
        onToolChange(tool.id);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onToolChange]);

  return (
    <div className="flex flex-col gap-1 p-2 bg-card border-r border-border">
      {tools.map((tool) => (
        <Tooltip key={tool.id}>
          <TooltipTrigger asChild>
            <button
              onClick={() => onToolChange(tool.id)}
              className={cn(
                'tool-button',
                activeTool === tool.id && 'active'
              )}
            >
              {tool.icon}
            </button>
          </TooltipTrigger>
          <TooltipContent side="right" className="flex items-center gap-2">
            <span>{tool.label}</span>
            <kbd className="px-1.5 py-0.5 text-xs bg-muted rounded font-mono">
              {tool.shortcut}
            </kbd>
          </TooltipContent>
        </Tooltip>
      ))}
    </div>
  );
};
