/**
 * V3 Canvas Types
 * 
 * GOLDEN PATH RULE 11: Three-Space Taxonomy Must Be Named
 * Explicitly typed coordinate spaces prevent mixing.
 */

// ============================================
// COORDINATE SPACE TYPES
// ============================================

export interface ScreenPoint {
  x: number;
  y: number;
  __space: 'screen';
}

export interface WorldPoint {
  x: number;
  y: number;
  __space: 'world';
}

export interface ImagePoint {
  x: number;
  y: number;
  __space: 'image';
}

export interface Point {
  x: number;
  y: number;
}

// ============================================
// VALIDATED TYPES
// ============================================

export type ValidatedImageData = ImageData & { __validated: true };

// ============================================
// LAYER TYPES
// ============================================

export interface LayerBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LayerTransform {
  rotation: number;
  scaleX: number;
  scaleY: number;
}

export interface Layer {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  opacity: number;
  blendMode: GlobalCompositeOperation;
  bounds: LayerBounds;
  image: HTMLImageElement | HTMLCanvasElement | ImageBitmap | null;
  dataUrl?: string;
  imageUrl?: string;
  transform?: LayerTransform;
  modifierStack?: Modifier[];
}

// ============================================
// MODIFIER TYPES
// ============================================

export type ModifierType =
  | 'brightness-contrast'
  | 'hue-saturation'
  | 'levels'
  | 'blur'
  | 'sharpen'
  | 'transparency-mask';

export interface ModifierParameters {
  [key: string]: number | boolean | string | number[] | Uint8ClampedArray | LayerBounds | undefined;
}

export interface Modifier {
  id: string;
  type: ModifierType;
  enabled: boolean;
  opacity: number;
  blendMode: string;
  parameters: ModifierParameters;
  createdAt: string;
}

// ============================================
// RENDER STATE
// ============================================

export interface CanvasState {
  panX: number;
  panY: number;
  zoom: number;
  layers: Layer[];
}

// ============================================
// TOOL TYPES
// ============================================

export type ToolType =
  | 'select'
  | 'move'
  | 'magic-wand'
  | 'lasso'
  | 'brush'
  | 'eraser'
  | 'pan'
  | 'zoom'
  | 'crop'
  | 'text';

export interface ToolContext {
  tool: ToolType;
  worldPoint: WorldPoint;
  screenPoint: ScreenPoint;
  shiftKey: boolean;
  altKey: boolean;
  ctrlKey: boolean;
  pressure?: number;
}

// ============================================
// SELECTION / MASK TYPES
// ============================================

export interface SelectionMask {
  data: Uint8Array;
  width: number;
  height: number;
  bounds: LayerBounds;
}

export interface HoverPreview {
  mask: SelectionMask | null;
  worldPoint: WorldPoint;
  timestamp: number;
}

// ============================================
// WORKER MESSAGES
// ============================================

export interface MagicWandRequest {
  type: 'segment';
  requestId: number;
  imageData: ImageData;
  seedX: number;
  seedY: number;
  tolerance: number;
  contiguous: boolean;
}

export interface MagicWandResponse {
  type: 'result' | 'error';
  requestId: number;
  mask?: Uint8Array;
  bounds?: LayerBounds;
  pixelCount?: number;
  error?: string;
}

// ============================================
// WAND OPTIONS
// ============================================

export interface WandOptions {
  tolerance: number;
  contiguous: boolean;
  antiAlias: boolean;
  feather: number;
}
