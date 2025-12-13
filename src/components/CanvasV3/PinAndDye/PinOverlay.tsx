/**
 * PinOverlay - Visual representation of discovered pins on the canvas
 * 
 * Stage II: Users can review, add, remove, or adjust pins before the dye pass
 */

import React from 'react';
import { MapPin, X, Plus, Check } from 'lucide-react';
import type { DiscoveredPin } from './types';
import { getDyeColor } from './types';

interface PinOverlayProps {
  pins: DiscoveredPin[];
  selectedPinId: string | null;
  isEditing: boolean;
  canvasWidth: number;
  canvasHeight: number;
  containerRect: DOMRect | null;
  zoom: number;
  panX: number;
  panY: number;
  onPinSelect: (id: string) => void;
  onPinRemove: (id: string) => void;
  onPinAdd: (x: number, y: number, label: string) => void;
  onConfirmPins: () => void;
  onCancelPins: () => void;
}

export const PinOverlay: React.FC<PinOverlayProps> = ({
  pins,
  selectedPinId,
  isEditing,
  canvasWidth,
  canvasHeight,
  containerRect,
  zoom,
  panX,
  panY,
  onPinSelect,
  onPinRemove,
  onPinAdd,
  onConfirmPins,
  onCancelPins,
}) => {
  if (pins.length === 0 && !isEditing) return null;

  // Convert world coords to screen coords
  const worldToScreen = (worldX: number, worldY: number) => {
    if (!containerRect) return { x: 0, y: 0 };
    
    const dpr = window.devicePixelRatio || 1;
    const viewportCenterX = (containerRect.width * dpr) / 2;
    const viewportCenterY = (containerRect.height * dpr) / 2;
    const offsetX = viewportCenterX - (canvasWidth * zoom) / 2;
    const offsetY = viewportCenterY - (canvasHeight * zoom) / 2;
    
    const canvasX = worldX * zoom + offsetX + panX;
    const canvasY = worldY * zoom + offsetY + panY;
    
    return {
      x: canvasX / dpr,
      y: canvasY / dpr,
    };
  };

  return (
    <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 10 }}>
      {/* Pin markers */}
      {pins.map((pin, index) => {
        const screenPos = worldToScreen(pin.x, pin.y);
        const color = pin.color || getDyeColor(index);
        const isSelected = selectedPinId === pin.id;
        
        return (
          <div
            key={pin.id}
            className="absolute pointer-events-auto cursor-pointer transition-transform hover:scale-110"
            style={{
              left: screenPos.x,
              top: screenPos.y,
              transform: 'translate(-50%, -100%)',
            }}
            onClick={() => onPinSelect(pin.id)}
          >
            {/* Pin icon */}
            <div
              className={`relative flex flex-col items-center ${isSelected ? 'scale-125' : ''}`}
            >
              <MapPin
                className="w-6 h-6 drop-shadow-lg"
                style={{ color }}
                fill={color}
                fillOpacity={0.3}
              />
              
              {/* Label tooltip */}
              <div
                className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded text-[10px] font-medium whitespace-nowrap shadow-lg"
                style={{
                  backgroundColor: color,
                  color: '#fff',
                }}
              >
                {pin.label}
              </div>
              
              {/* Remove button (when selected) */}
              {isSelected && isEditing && (
                <button
                  className="absolute -top-2 -right-4 w-4 h-4 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center hover:scale-110 transition-transform"
                  onClick={(e) => {
                    e.stopPropagation();
                    onPinRemove(pin.id);
                  }}
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        );
      })}
      
      {/* Editing controls */}
      {isEditing && pins.length > 0 && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 flex gap-2 pointer-events-auto">
          <button
            className="px-3 py-1.5 bg-primary text-primary-foreground rounded-md text-xs font-medium flex items-center gap-1.5 hover:bg-primary/90 transition-colors shadow-lg"
            onClick={onConfirmPins}
          >
            <Check className="w-3 h-3" />
            Confirm Pins ({pins.length})
          </button>
          <button
            className="px-3 py-1.5 bg-secondary text-secondary-foreground rounded-md text-xs font-medium hover:bg-secondary/90 transition-colors shadow-lg"
            onClick={onCancelPins}
          >
            Cancel
          </button>
        </div>
      )}
      
      {/* Instructions */}
      {isEditing && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-card/90 backdrop-blur-sm border border-border rounded-md text-xs text-muted-foreground pointer-events-auto">
          Click a pin to select • Click on canvas to add a pin • Press Delete to remove
        </div>
      )}
    </div>
  );
};
