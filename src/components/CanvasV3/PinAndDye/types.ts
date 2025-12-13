/**
 * Pin-and-Dye System Types
 * 
 * A hybrid AI-algorithmic approach for high-fidelity image segmentation
 * using the "Visual Prominence" logic and 4-stage pipeline.
 */

export interface DiscoveredPin {
  id: string;
  label: string;
  x: number;
  y: number;
  areaPercent: number;
  color?: string; // Assigned dye color after Stage III
}

export interface PinState {
  pins: DiscoveredPin[];
  selectedPinId: string | null;
  isEditing: boolean;
}

export interface DyeLayerState {
  imageData: ImageData | null;
  base64: string | null;
  isGenerated: boolean;
  generatedAt: number | null;
}

export interface PinAndDyeState {
  stage: 'idle' | 'discovering' | 'pins-ready' | 'dyeing' | 'dye-ready' | 'extracting';
  pins: PinState;
  dyeLayer: DyeLayerState;
  error: string | null;
}

// Standard dye colors - high contrast categorical colors
export const DYE_COLORS = [
  '#FF0000', // Red
  '#00FF00', // Green
  '#0000FF', // Blue
  '#FF00FF', // Magenta
  '#FFFF00', // Yellow
  '#00FFFF', // Cyan
  '#FF8000', // Orange
  '#8000FF', // Purple
  '#00FF80', // Spring
  '#FF0080', // Pink
  '#80FF00', // Lime
  '#0080FF', // Sky
] as const;

export type DyeColor = typeof DYE_COLORS[number];

/**
 * Get a consistent dye color for a pin index
 */
export function getDyeColor(index: number): DyeColor {
  return DYE_COLORS[index % DYE_COLORS.length];
}

/**
 * Parse RGB from hex color
 */
export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : { r: 0, g: 0, b: 0 };
}
