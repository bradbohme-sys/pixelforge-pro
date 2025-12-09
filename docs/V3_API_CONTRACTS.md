# V3 API Contracts - Complete Interface Definitions

**Date:** 2025-01-27  
**Status:** 📋 **SPECIFICATION**  
**Purpose:** Define all TypeScript interfaces and types for V3 Image Editor  

---

## 🎯 **API CONTRACT PHILOSOPHY**

### **Core Principles:**
1. **Type Safety** — Every interface fully typed in TypeScript
2. **Documentation** — Every property documented with JSDoc
3. **Immutability** — Prefer readonly properties where possible
4. **Versioning** — APIs versioned to allow evolution
5. **Validation** — Runtime validation for critical APIs

### **Contract Rules:**
- **Breaking Changes** — Major version bump required
- **Deprecation** — Min 2 versions before removal
- **Documentation** — Keep docs in sync with implementation
- **Testing** — Contract tests for all APIs

---

## 🎨 **1. CORE TYPES**

### **Geometry Types:**

```typescript
/**
 * 2D point in various coordinate spaces
 */
export interface Point {
  /** X coordinate */
  x: number;
  
  /** Y coordinate */
  y: number;
}

/**
 * Rectangle defined by position and size
 */
export interface Rectangle {
  /** X coordinate of top-left corner */
  x: number;
  
  /** Y coordinate of top-left corner */
  y: number;
  
  /** Width of rectangle */
  width: number;
  
  /** Height of rectangle */
  height: number;
}

/**
 * 2D transformation matrix
 */
export interface Transform {
  /** Translation X */
  tx: number;
  
  /** Translation Y */
  ty: number;
  
  /** Scale X */
  sx: number;
  
  /** Scale Y */
  sy: number;
  
  /** Rotation in radians */
  rotation: number;
  
  /** Skew X */
  skewX?: number;
  
  /** Skew Y */
  skewY?: number;
}

/**
 * Size dimensions
 */
export interface Size {
  /** Width */
  width: number;
  
  /** Height */
  height: number;
}

/**
 * RGBA color
 */
export interface Color {
  /** Red channel (0-255) */
  r: number;
  
  /** Green channel (0-255) */
  g: number;
  
  /** Blue channel (0-255) */
  b: number;
  
  /** Alpha channel (0-1) */
  a: number;
}
```

---

## 🖼️ **2. LAYER SYSTEM**

### **Layer Interface:**

```typescript
/**
 * Layer represents a single compositable image with transformations and modifiers
 */
export interface Layer {
  /** Unique identifier */
  readonly id: string;
  
  /** Human-readable name */
  name: string;
  
  /** Layer type */
  type: LayerType;
  
  /** Layer visibility */
  visible: boolean;
  
  /** Layer opacity (0-1) */
  opacity: number;
  
  /** Layer blend mode */
  blendMode: BlendMode;
  
  /** Layer bounds (center-based coordinates) */
  bounds: Rectangle;
  
  /** Layer transformation */
  transform: Transform;
  
  /** Layer image data */
  imageData: ImageData | null;
  
  /** Layer thumbnail (for performance) */
  thumbnail?: string; // data URL
  
  /** Layer modifiers stack */
  modifiers: Modifier[];
  
  /** Layer metadata */
  metadata: LayerMetadata;
  
  /** Creation timestamp */
  readonly createdAt: number;
  
  /** Last modified timestamp */
  modifiedAt: number;
  
  /** Layer locked (cannot be edited) */
  locked: boolean;
  
  /** Layer can be deleted */
  deletable: boolean;
}

/**
 * Layer types
 */
export type LayerType = 
  | 'raster'      // Pixel-based layer
  | 'vector'      // Vector-based layer
  | 'text'        // Text layer
  | 'adjustment'  // Adjustment layer (affects layers below)
  | 'group'       // Group of layers
  | 'smart';      // Smart object

/**
 * Blend modes for layer compositing
 */
export type BlendMode =
  | 'normal'
  | 'multiply'
  | 'screen'
  | 'overlay'
  | 'darken'
  | 'lighten'
  | 'color-dodge'
  | 'color-burn'
  | 'hard-light'
  | 'soft-light'
  | 'difference'
  | 'exclusion'
  | 'hue'
  | 'saturation'
  | 'color'
  | 'luminosity';

/**
 * Layer metadata
 */
export interface LayerMetadata {
  /** Source file (if imported) */
  sourceFile?: string;
  
  /** Source layer (if duplicated) */
  sourceLayerId?: string;
  
  /** Creation method */
  creationMethod: 'import' | 'create' | 'segment' | 'duplicate' | 'ai-generate';
  
  /** Custom metadata */
  custom?: Record<string, any>;
}
```

---

## 🎨 **3. MODIFIER SYSTEM**

### **Modifier Interface:**

```typescript
/**
 * Modifier represents a non-destructive edit to a layer
 */
export interface Modifier {
  /** Unique identifier */
  readonly id: string;
  
  /** Modifier type */
  type: ModifierType;
  
  /** Modifier enabled */
  enabled: boolean;
  
  /** Modifier opacity (0-1) */
  opacity: number;
  
  /** Modifier blend mode */
  blendMode: BlendMode;
  
  /** Modifier parameters (type-specific) */
  parameters: ModifierParameters;
  
  /** Modifier mask (optional) */
  mask?: Uint8ClampedArray;
  
  /** Modifier mask bounds (if mask present) */
  maskBounds?: Rectangle;
  
  /** Creation timestamp */
  readonly createdAt: number;
}

/**
 * Modifier types
 */
export type ModifierType =
  // Color adjustments
  | 'brightness-contrast'
  | 'hue-saturation'
  | 'color-balance'
  | 'levels'
  | 'curves'
  | 'exposure'
  | 'vibrance'
  // Style adjustments
  | 'black-white'
  | 'photo-filter'
  | 'channel-mixer'
  | 'selective-color'
  | 'threshold'
  | 'posterize'
  // Effects
  | 'blur'
  | 'sharpen'
  | 'noise'
  | 'transparency-mask';

/**
 * Modifier parameters (type-specific)
 */
export type ModifierParameters = Record<string, any>;

/**
 * Brightness/Contrast parameters
 */
export interface BrightnessContrastParameters {
  brightness: number; // -100 to 100
  contrast: number;   // -100 to 100
}

/**
 * Hue/Saturation parameters
 */
export interface HueSaturationParameters {
  hue: number;        // -180 to 180
  saturation: number; // -100 to 100
  lightness: number;  // -100 to 100
}

/**
 * Transparency mask parameters
 */
export interface TransparencyMaskParameters {
  mask: Uint8ClampedArray;
  bounds: Rectangle;
  invert?: boolean;
}
```

---

## 🛠️ **4. TOOL SYSTEM**

### **Tool Interface:**

```typescript
/**
 * Tool represents an interactive editing tool
 */
export interface Tool {
  /** Unique identifier */
  readonly id: string;
  
  /** Human-readable name */
  name: string;
  
  /** Tool icon (lucide icon name) */
  icon: string;
  
  /** Tool cursor */
  cursor: string;
  
  /** Tool category */
  category: ToolCategory;
  
  /** Tool description */
  description: string;
  
  /** Tool keyboard shortcut */
  shortcut?: string;
  
  /** Tool lifecycle hooks */
  lifecycle: ToolLifecycle;
  
  /** Tool event handlers */
  handlers: Partial<ToolEventHandlers>;
  
  /** Tool settings schema */
  settingsSchema: SettingsSchema;
  
  /** Tool default settings */
  defaultSettings: Record<string, any>;
  
  /** Tool capabilities */
  capabilities: ToolCapabilities;
}

/**
 * Tool categories
 */
export type ToolCategory =
  | 'selection'    // Selection tools (magic wand, lasso, etc.)
  | 'drawing'      // Drawing tools (brush, eraser, etc.)
  | 'transform'    // Transform tools (move, rotate, scale)
  | 'text'         // Text tools
  | 'vector'       // Vector tools (shape, pen)
  | 'effect'       // Effect tools
  | 'navigation'   // Navigation tools (pan, zoom)
  | 'ai';          // AI-powered tools

/**
 * Tool lifecycle hooks
 */
export interface ToolLifecycle {
  /** Called when tool is activated */
  onActivate(canvas: CanvasAPI): void;
  
  /** Called when tool is deactivated */
  onDeactivate(): void;
  
  /** Called when tool settings change */
  onSettingsChange(settings: Record<string, any>): void;
}

/**
 * Tool event handlers
 */
export interface ToolEventHandlers {
  // Pointer events
  onPointerDown(e: PointerEvent, worldPoint: Point): void;
  onPointerMove(e: PointerEvent, worldPoint: Point): void;
  onPointerUp(e: PointerEvent, worldPoint: Point): void;
  
  // Keyboard events
  onKeyDown(e: KeyboardEvent): void;
  onKeyUp(e: KeyboardEvent): void;
  
  // Wheel events
  onWheel(e: WheelEvent): void;
  
  // Render events
  onRender(ctx: CanvasRenderingContext2D): void;
  onRenderOverlay(ctx: CanvasRenderingContext2D): void;
}

/**
 * Tool capabilities
 */
export interface ToolCapabilities {
  /** Tool supports hover preview */
  supportsPreview: boolean;
  
  /** Tool supports accumulation (shift-click) */
  supportsAccumulation: boolean;
  
  /** Tool supports modifiers (alt-click) */
  supportsModifiers: boolean;
  
  /** Tool requires active selection */
  requiresSelection: boolean;
  
  /** Tool works on multiple layers */
  supportsMultipleLayers: boolean;
}

/**
 * Tool settings schema
 */
export interface SettingsSchema {
  [key: string]: SettingDefinition;
}

/**
 * Setting definition
 */
export interface SettingDefinition {
  type: 'number' | 'boolean' | 'string' | 'select' | 'color';
  label: string;
  description?: string;
  min?: number;
  max?: number;
  step?: number;
  options?: Array<{ label: string; value: any }>;
  default: any;
}
```

---

## 🌊 **4B. V6 PREVIEW SYSTEM** ⭐ **NEW**

### **PreviewWaveEngine Interface:**

```typescript
/**
 * Preview Wave Engine for progressive magic wand preview
 */
export interface PreviewWaveEngine {
  /**
   * Start preview wave expansion
   * @param imageData - World space ImageData (from compositeLayers)
   * @param seedPoint - Seed point in world coordinates
   * @param tolerance - Color tolerance (0-255)
   * @param requestId - Request ID for cancellation
   * @returns Promise that resolves when preview completes or is cancelled
   */
  startWave(
    imageData: ImageData,
    seedPoint: Point,
    tolerance: number,
    requestId: number
  ): Promise<PreviewResult>;
  
  /**
   * Update tolerance (breathing tolerance)
   * @param newTolerance - New tolerance value
   */
  updateTolerance(newTolerance: number): void;
  
  /**
   * Cancel preview request
   * @param requestId - Request ID to cancel
   */
  cancel(requestId: number): void;
  
  /**
   * Cancel all preview requests
   */
  cancelAll(): void;
  
  /**
   * Get current preview state
   */
  getCurrentPreview(): PreviewResult | null;
  
  /**
   * Check if preview is active
   */
  isActive(): boolean;
}

/**
 * Preview result
 */
export interface PreviewResult {
  /** Preview mask (partial or complete) */
  mask: Uint8ClampedArray;
  
  /** Preview bounds */
  bounds: Rectangle;
  
  /** Is preview complete? */
  complete: boolean;
  
  /** Current ring number */
  ringNumber: number;
  
  /** Seed point used */
  seedPoint: Point;
  
  /** Tolerance used */
  tolerance: number;
}

/**
 * Ring BFS algorithm for natural wave expansion
 */
export interface RingBFS {
  /**
   * Process one ring of expansion
   * @param imageData - ImageData to process
   * @param seedColor - Seed pixel color
   * @param tolerance - Color tolerance
   * @param timeBudget - Time budget in milliseconds (4-8ms)
   * @returns Processing result
   */
  processRing(
    imageData: ImageData,
    seedColor: Color,
    tolerance: number,
    timeBudget: number
  ): RingProcessResult;
  
  /**
   * Get current mask (partial or complete)
   */
  getCurrentMask(): Uint8ClampedArray;
  
  /**
   * Get current bounds
   */
  getCurrentBounds(): Rectangle;
  
  /**
   * Get current ring number
   */
  getRingNumber(): number;
  
  /**
   * Check if expansion is complete
   */
  isComplete(): boolean;
}

/**
 * Ring processing result
 */
export interface RingProcessResult {
  /** Processing completed (no more rings) */
  completed: boolean;
  
  /** Time used in milliseconds */
  timeUsed: number;
  
  /** Current mask */
  mask: Uint8ClampedArray;
  
  /** Current bounds */
  bounds: Rectangle;
}

/**
 * Breathing tolerance for smooth expansion
 */
export interface BreathingTolerance {
  /**
   * Increase tolerance (re-test rejected frontier)
   * @param newTolerance - New tolerance value
   * @param imageData - ImageData to process
   * @param seedColor - Seed pixel color
   */
  increaseTolerance(
    newTolerance: number,
    imageData: ImageData,
    seedColor: Color
  ): void;
  
  /**
   * Decrease tolerance (contract selection)
   * @param newTolerance - New tolerance value
   */
  decreaseTolerance(newTolerance: number): void;
  
  /**
   * Get accepted mask
   */
  getAcceptedMask(): Uint8ClampedArray;
  
  /**
   * Get rejected frontier (for re-testing)
   */
  getRejectedFrontier(): Point[];
}

/**
 * Request cancellation for preventing visual glitches
 */
export interface RequestCancellation {
  /**
   * Start new preview request
   * @param seedPoint - Seed point for request
   * @returns Request ID
   */
  startPreview(seedPoint: Point): number;
  
  /**
   * Check if request is still valid
   * @param requestId - Request ID to check
   * @returns True if request is still current
   */
  isValid(requestId: number): boolean;
  
  /**
   * Cancel all requests
   */
  cancelAll(): void;
  
  /**
   * Complete request
   * @param requestId - Request ID to complete
   */
  complete(requestId: number): void;
  
  /**
   * Get current request ID
   */
  getCurrentRequestId(): number;
}

/**
 * Zero-latency preview for instant feedback
 */
export interface ZeroLatencyPreview {
  /**
   * Draw instant seed highlight (0ms perceived latency)
   * @param ctx - Canvas rendering context
   * @param seedPoint - Seed point in world coordinates
   */
  drawInstantSeed(
    ctx: CanvasRenderingContext2D,
    seedPoint: Point
  ): void;
  
  /**
   * Draw expanding wave preview
   * @param ctx - Canvas rendering context
   * @param mask - Preview mask
   * @param bounds - Preview bounds
   */
  drawWave(
    ctx: CanvasRenderingContext2D,
    mask: Uint8ClampedArray,
    bounds: Rectangle
  ): void;
  
  /**
   * Calculate minimal dirty rect for efficient redraw
   * @param mask - Preview mask
   * @param bounds - Preview bounds
   * @returns Minimal dirty rectangle
   */
  calculateDirtyRect(
    mask: Uint8ClampedArray,
    bounds: Rectangle
  ): Rectangle;
}

/**
 * 3-state pixel tracking
 */
export type PixelState = 0 | 1 | 2; // UNSEEN | ACCEPTED | REJECTED
```

---

## 🎯 **5. SELECTION SYSTEM**

### **Selection Interface:**

```typescript
/**
 * Selection mask represents a selected region
 */
export interface SelectionMask {
  /** Unique identifier */
  readonly id: string;
  
  /** Mask data (0-255 alpha values) */
  mask: Uint8ClampedArray;
  
  /** Mask bounds */
  bounds: Rectangle;
  
  /** Mask dimensions */
  width: number;
  height: number;
  
  /** Selected pixel indices */
  pixels: Set<number>;
  
  /** Is mask feathered */
  feathered: boolean;
  
  /** Feather amount (if feathered) */
  featherAmount?: number;
  
  /** Selection metadata */
  metadata: SelectionMetadata;
  
  /** Creation timestamp */
  readonly createdAt: number;
}

/**
 * Selection metadata
 */
export interface SelectionMetadata {
  /** Selection tool used */
  tool: string;
  
  /** Selection mode */
  mode: 'new' | 'add' | 'subtract' | 'intersect';
  
  /** Number of segments (for accumulated selections) */
  segmentCount: number;
  
  /** Selection area (pixel count) */
  area: number;
  
  /** Selection perimeter (edge pixel count) */
  perimeter: number;
}

/**
 * Selection operation result
 */
export interface SelectionResult {
  /** Result mask */
  mask: Uint8ClampedArray;
  
  /** Result bounds */
  bounds: Rectangle;
  
  /** Selected pixels */
  pixels: number[];
  
  /** Operation metadata */
  metadata?: {
    /** Did hit pixel limit during generation */
    hitLimit?: boolean;
    
    /** Processing time */
    processingTime?: number;
    
    /** Worker used */
    worker?: boolean;
  };
}
```

---

## 📊 **6. PROJECT SYSTEM**

### **Project Interface:**

```typescript
/**
 * Project represents the entire editing session
 */
export interface Project {
  /** Unique identifier */
  readonly id: string;
  
  /** Project name */
  name: string;
  
  /** Project dimensions */
  width: number;
  height: number;
  
  /** Project color mode */
  colorMode: 'rgb' | 'rgba' | 'grayscale';
  
  /** Project color depth */
  colorDepth: 8 | 16 | 32;
  
  /** Project DPI */
  dpi: number;
  
  /** Project layers */
  layers: Layer[];
  
  /** Project history */
  history: Snapshot[];
  
  /** Current history index */
  historyIndex: number;
  
  /** Selected layer IDs */
  selectedLayerIds: string[];
  
  /** Project metadata */
  metadata: ProjectMetadata;
  
  /** Creation timestamp */
  readonly createdAt: number;
  
  /** Last modified timestamp */
  modifiedAt: number;
  
  /** Last saved timestamp */
  lastSavedAt?: number;
  
  /** Has unsaved changes */
  hasUnsavedChanges: boolean;
}

/**
 * Project metadata
 */
export interface ProjectMetadata {
  /** Author */
  author?: string;
  
  /** Description */
  description?: string;
  
  /** Tags */
  tags?: string[];
  
  /** Version */
  version: string;
  
  /** Application version */
  appVersion: string;
  
  /** Custom metadata */
  custom?: Record<string, any>;
}

/**
 * Project snapshot for history
 */
export interface Snapshot {
  /** Unique identifier */
  readonly id: string;
  
  /** Snapshot description */
  description: string;
  
  /** Project state */
  project: Project;
  
  /** Canvas state */
  canvasState: CanvasState;
  
  /** Timestamp */
  readonly timestamp: number;
}
```

---

## 🖼️ **7. CANVAS SYSTEM**

### **Canvas State:**

```typescript
/**
 * Canvas state
 */
export interface CanvasState {
  /** Canvas pan position */
  panX: number;
  panY: number;
  
  /** Canvas zoom level */
  zoom: number;
  
  /** Canvas rotation (future) */
  rotation?: number;
  
  /** Current tool */
  currentTool: Tool | null;
  
  /** Tool settings */
  toolSettings: Map<string, Record<string, any>>;
  
  /** Active selection */
  selection: SelectionMask | null;
  
  /** Hover preview */
  hoverPreview: HoverPreview | null;
  
  /** Canvas dimensions */
  width: number;
  height: number;
  
  /** Device pixel ratio */
  devicePixelRatio: number;
  
  /** Is rendering */
  isRendering: boolean;
  
  /** Is busy (processing) */
  isBusy: boolean;
}

/**
 * Hover preview state
 */
export interface HoverPreview {
  /** Preview mask */
  mask: Uint8ClampedArray;
  
  /** Preview bounds */
  bounds: Rectangle;
  
  /** Hover point */
  point: Point;
  
  /** Is processing */
  isProcessing: boolean;
  
  /** Hit limit flag */
  hitLimit: boolean;
}
```

### **Canvas API:**

```typescript
/**
 * Canvas API for external components
 */
export interface CanvasAPI {
  // Read API
  getState(): CanvasState;
  screenToWorld(point: Point): Point;
  worldToScreen(point: Point): Point;
  getViewport(): Rectangle;
  getZoom(): number;
  getPan(): Point;
  getCurrentTool(): Tool | null;
  getToolSettings(toolId: string): Record<string, any>;
  getVisibleLayers(): Layer[];
  getCurrentLayer(): Layer | null;
  getSelection(): SelectionMask | null;
  getSelectionBounds(): Rectangle | null;
  getCompositeImageData(): ImageData;
  getLayerImageData(layerId: string): ImageData;
  
  // Write API
  setTool(tool: Tool): void;
  setToolSettings(toolId: string, settings: Partial<Record<string, any>>): void;
  setZoom(zoom: number, center?: Point): void;
  setPan(pan: Point): void;
  fitToScreen(): void;
  zoomToSelection(): void;
  setCurrentLayer(layerId: string): void;
  setLayerVisibility(layerId: string, visible: boolean): void;
  setLayerOpacity(layerId: string, opacity: number): void;
  clearSelection(): void;
  invertSelection(): void;
  selectAll(): void;
  undo(): void;
  redo(): void;
  
  // Event API
  on<K extends keyof CanvasEvents>(
    event: K,
    listener: (data: CanvasEvents[K]) => void
  ): () => void;
  
  once<K extends keyof CanvasEvents>(
    event: K,
    listener: (data: CanvasEvents[K]) => void
  ): () => void;
  
  off<K extends keyof CanvasEvents>(event: K): void;
}

/**
 * Canvas events
 */
export interface CanvasEvents {
  'state-change': CanvasState;
  'zoom-change': { zoom: number };
  'pan-change': { pan: Point };
  'viewport-change': { viewport: Rectangle };
  'tool-change': { tool: Tool };
  'tool-settings-change': { toolId: string; settings: Record<string, any> };
  'layer-add': { layer: Layer };
  'layer-remove': { layerId: string };
  'layer-update': { layer: Layer };
  'layer-select': { layerId: string };
  'selection-change': { selection: SelectionMask | null };
  'selection-preview': { preview: SelectionMask | null };
  'history-change': { canUndo: boolean; canRedo: boolean };
  'render-start': {};
  'render-end': {};
}
```

---

## 🎨 **8. COORDINATE SYSTEM**

### **Coordinate System API:**

```typescript
/**
 * Coordinate system for transforming between spaces
 */
export interface CoordinateSystemAPI {
  /**
   * Convert screen coordinates to world coordinates
   * @param screenX - Screen X coordinate
   * @param screenY - Screen Y coordinate
   * @returns World point
   */
  screenToWorld(screenX: number, screenY: number): Point;
  
  /**
   * Convert world coordinates to screen coordinates
   * @param worldX - World X coordinate
   * @param worldY - World Y coordinate
   * @returns Screen point
   */
  worldToScreen(worldX: number, worldY: number): Point;
  
  /**
   * Convert world coordinates to image coordinates
   * (In V3, this is identity function)
   * @param worldX - World X coordinate
   * @param worldY - World Y coordinate
   * @returns Image point
   */
  worldToImage(worldX: number, worldY: number): Point;
  
  /**
   * Apply current transform to canvas context
   * @param ctx - Canvas rendering context
   */
  applyTransform(ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D): void;
  
  /**
   * Get current zoom level
   * @returns Zoom level (1 = 100%)
   */
  getZoom(): number;
  
  /**
   * Set zoom level
   * @param zoom - New zoom level
   * @param center - Optional center point (world coords)
   */
  setZoom(zoom: number, center?: Point): void;
  
  /**
   * Get current pan position
   * @returns Pan position (world coords)
   */
  getPan(): Point;
  
  /**
   * Set pan position
   * @param pan - New pan position (world coords)
   */
  setPan(pan: Point): void;
  
  /**
   * Get viewport bounds (world coords)
   * @returns Viewport rectangle
   */
  getViewportBounds(): Rectangle;
  
  /**
   * Get browser zoom factor
   * @returns Browser zoom (1 = 100%)
   */
  getBrowserZoom(): number;
}
```

---

## 🎯 **9. VALIDATION & RUNTIME CHECKS**

### **Type Guards:**

```typescript
/**
 * Type guard for Layer
 */
export function isLayer(value: any): value is Layer {
  return (
    typeof value === 'object' &&
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    typeof value.visible === 'boolean' &&
    typeof value.opacity === 'number' &&
    value.opacity >= 0 &&
    value.opacity <= 1
  );
}

/**
 * Type guard for Point
 */
export function isPoint(value: any): value is Point {
  return (
    typeof value === 'object' &&
    typeof value.x === 'number' &&
    typeof value.y === 'number'
  );
}

/**
 * Type guard for Rectangle
 */
export function isRectangle(value: any): value is Rectangle {
  return (
    typeof value === 'object' &&
    typeof value.x === 'number' &&
    typeof value.y === 'number' &&
    typeof value.width === 'number' &&
    typeof value.height === 'number' &&
    value.width >= 0 &&
    value.height >= 0
  );
}

/**
 * Type guard for SelectionMask
 */
export function isSelectionMask(value: any): value is SelectionMask {
  return (
    typeof value === 'object' &&
    typeof value.id === 'string' &&
    value.mask instanceof Uint8ClampedArray &&
    isRectangle(value.bounds) &&
    typeof value.width === 'number' &&
    typeof value.height === 'number'
  );
}
```

### **Validation Functions:**

```typescript
/**
 * Validate layer data
 */
export function validateLayer(layer: Layer): ValidationResult {
  const errors: string[] = [];

  if (!layer.id || typeof layer.id !== 'string') {
    errors.push('Layer ID must be a non-empty string');
  }

  if (layer.opacity < 0 || layer.opacity > 1) {
    errors.push('Layer opacity must be between 0 and 1');
  }

  if (!layer.bounds || !isRectangle(layer.bounds)) {
    errors.push('Layer bounds must be a valid Rectangle');
  }

  if (layer.imageData && !(layer.imageData instanceof ImageData)) {
    errors.push('Layer imageData must be an ImageData instance');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validate coordinate bounds
 */
export function validateCoordinates(point: Point, bounds: Rectangle): boolean {
  return (
    point.x >= bounds.x &&
    point.x <= bounds.x + bounds.width &&
    point.y >= bounds.y &&
    point.y <= bounds.y + bounds.height
  );
}

/**
 * Validate ImageData dimensions
 */
export function validateImageDataDimensions(
  imageData: ImageData,
  expectedWidth: number,
  expectedHeight: number
): ValidationResult {
  const errors: string[] = [];

  if (imageData.width !== expectedWidth) {
    errors.push(`ImageData width ${imageData.width} does not match expected ${expectedWidth}`);
  }

  if (imageData.height !== expectedHeight) {
    errors.push(`ImageData height ${imageData.height} does not match expected ${expectedHeight}`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
```

---

## 🎯 **10. VERSION & COMPATIBILITY**

### **API Version:**

```typescript
/**
 * API version information
 */
export const API_VERSION = {
  major: 3,
  minor: 0,
  patch: 0,
  prerelease: null,
  toString: () => '3.0.0',
};

/**
 * Check if API version is compatible
 */
export function isCompatibleVersion(version: string): boolean {
  const [major] = version.split('.').map(Number);
  return major === API_VERSION.major;
}

/**
 * Migrate data from previous version
 */
export function migrateFromV2(v2Data: any): Project {
  // Migration logic here
  throw new Error('Not implemented');
}
```

---

## 🎯 **SUCCESS CRITERIA**

✅ All interfaces fully typed
✅ All properties documented
✅ Type guards provided
✅ Validation functions provided
✅ Version information included
✅ Migration paths documented

---

**Status:** Complete API contract specification ready for implementation!
