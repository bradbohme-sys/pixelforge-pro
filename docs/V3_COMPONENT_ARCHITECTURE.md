# V3 Component Architecture - Complete Hierarchy & Dependencies

**Date:** 2025-01-27  
**Status:** 📋 **SPECIFICATION**  
**Purpose:** Map all components, their hierarchy, and dependencies for V3 Image Editor  

---

## 🎯 **COMPONENT ARCHITECTURE PHILOSOPHY**

### **Core Principles:**
1. **Single Responsibility** — Each component has one clear purpose
2. **Composability** — Components compose into larger systems
3. **Reusability** — Components reusable across contexts
4. **Testability** — Components independently testable
5. **Documentation** — Every component fully documented

### **Dependency Rules:**
- **Acyclic** — No circular dependencies
- **Explicit** — All imports explicit
- **Minimal** — Depend on minimal set of modules
- **Interfaces** — Depend on interfaces, not implementations

---

## 🏗️ **COMPONENT HIERARCHY - COMPLETE TREE**

```
App
├── ThemeProvider
│   └── WorkspaceProvider
│       └── ProjectProvider
│           └── HistoryProvider
│               └── ToolProvider
│                   └── SegmentationProvider
│                       └── ImagesPage
│                           ├── LeftSettingsPanel
│                           │   ├── ToolSettings
│                           │   └── GlobalSettings
│                           │
│                           ├── LeftToolbar
│                           │   ├── ToolButton (×8)
│                           │   └── ToolTooltip
│                           │
│                           ├── Canvas Area
│                           │   └── CanvasV3Wrapper
│                           │       ├── CanvasV3 (Main)
│                           │       │   ├── CoordinateSystem
│                           │       │   ├── RenderPipeline
│                           │       │   ├── PanZoomHandler
│                           │       │   ├── V3MagicWandHandler
│                           │       │   │   ├── magicWand.worker.ts
│                           │       │   │   └── preview/ (V6 Organic Flow) ⭐
│                           │       │   │       ├── PreviewWaveEngine.ts
│                           │       │   │       ├── BreathingTolerance.ts
│                           │       │   │       ├── RequestCancellation.ts
│                           │       │   │       └── ZeroLatencyPreview.ts
│                           │       │   └── MagicWandBridge
│                           │       │
│                           │       └── useMagicWandWorkflow
│                           │           └── LocalFloodFill
│                           │
│                           ├── BottomBar
│                           │   ├── ToolIndicator
│                           │   ├── ZoomIndicator
│                           │   ├── LayerIndicator
│                           │   └── QuickActions
│                           │
│                           ├── LayerStripPanel (conditional)
│                           │   ├── LayerThumbnail (×N)
│                           │   └── LayerQuickActions
│                           │
│                           └── RightPanels (conditional)
│                               ├── LayersPanel
│                               │   ├── LayerItem (×N)
│                               │   │   ├── LayerThumbnail
│                               │   │   ├── LayerName
│                               │   │   ├── LayerVisibility
│                               │   │   ├── LayerOpacity
│                               │   │   └── LayerBlendMode
│                               │   │
│                               │   └── LayerControls
│                               │       ├── AddLayerButton
│                               │       ├── DeleteLayerButton
│                               │       ├── MergeLayersButton
│                               │       └── LayerOrderButtons
│                               │
│                               ├── AIChatPanel
│                               │   ├── MessageList
│                               │   │   └── Message (×N)
│                               │   ├── MessageInput
│                               │   └── QuickPrompts
│                               │
│                               ├── AIToolsPanel
│                               │   ├── AIToolGrid
│                               │   │   └── AIToolCard (×N)
│                               │   └── AIToolSettings
│                               │
│                               ├── EffectsPanel
│                               │   ├── EffectGrid
│                               │   │   └── EffectCard (×N)
│                               │   └── EffectSettings
│                               │
│                               ├── ColorSpherePanel
│                               │   ├── ColorSphere3D
│                               │   ├── ColorSliders
│                               │   └── ColorPresets
│                               │
│                               ├── FeatherPanel
│                               │   ├── SelectionPreview
│                               │   ├── FeatherSlider
│                               │   └── SelectionOperations
│                               │
│                               ├── AssetBrowserPanel
│                               │   ├── AssetGrid
│                               │   │   └── AssetCard (×N)
│                               │   └── AssetSearch
│                               │
│                               ├── CursorZoomPanel
│                               │   ├── ZoomSlider
│                               │   ├── ZoomPresets
│                               │   └── ZoomIndicator
│                               │
│                               ├── MicroscopePanel
│                               │   ├── PixelGrid
│                               │   ├── ColorInfo
│                               │   └── ZoomLevel
│                               │
│                               ├── PresetLibraryPanel
│                               │   ├── PresetGrid
│                               │   │   └── PresetCard (×N)
│                               │   └── PresetCategories
│                               │
│                               └── ICEPanel
│                                   ├── ICEControls
│                                   └── ICEPreview
```

---

## 📦 **MODULE DEPENDENCY GRAPH**

### **Core Modules:**

```
constants.ts (no dependencies)
  ↓
types.ts (no dependencies)
  ↓
DimensionValidator.ts
  ↓
CoordinateSystem.ts
  ├── constants.ts
  └── types.ts
  ↓
├── PanZoomHandler.ts
│   ├── CoordinateSystem.ts
│   └── types.ts
│
├── V3MagicWandHandler.ts
│   ├── CoordinateSystem.ts
│   ├── types.ts
│   ├── magicWand.worker.ts (separate thread)
│   └── preview/ (V6 Organic Flow) ⭐
│       ├── PreviewWaveEngine.ts
│       ├── BreathingTolerance.ts
│       ├── RequestCancellation.ts
│       └── ZeroLatencyPreview.ts
│
├── RenderPipeline.ts
│   ├── CoordinateSystem.ts
│   ├── types.ts
│   ├── ModifierStack.ts
│   └── layerAdapter.ts
│
└── compositeLayers.ts
    ├── constants.ts
    ├── types.ts
    ├── DimensionValidator.ts
    └── ModifierStack.ts
```

### **Component Dependencies:**

```
CanvasV3.tsx
  ├── CoordinateSystem.ts
  ├── RenderPipeline.ts
  ├── PanZoomHandler.ts
  ├── V3MagicWandHandler.ts
  ├── MagicWandBridge.ts
  ├── useCanvasStateSync.ts
  ├── compositeLayers.ts
  └── types.ts
  ↓
CanvasV3Wrapper.tsx
  ├── CanvasV3.tsx
  ├── useMagicWandWorkflow.ts
  ├── useProject() (ProjectContext)
  ├── useSegmentation() (SegmentationContext)
  └── useTool() (ToolContext)
  ↓
ImagesPage.tsx
  ├── CanvasV3Wrapper.tsx
  ├── LeftToolbar.tsx
  ├── LeftSettingsPanel.tsx
  ├── BottomBar.tsx
  ├── LayerStripPanel.tsx
  ├── RightPanelBar.tsx
  └── All Panel Components
```

---

## 🎨 **COMPONENT SPECIFICATIONS**

### **1. CanvasV3 Component**

```typescript
/**
 * Main V3 Canvas component
 * 
 * Responsibilities:
 * - Initialize and manage CoordinateSystem
 * - Initialize and manage RenderPipeline
 * - Initialize and manage input handlers
 * - Render main canvas layers
 * - Render interaction overlay
 * - Handle High-DPI displays
 * 
 * Does NOT:
 * - Manage layer state (ProjectContext)
 * - Manage tool state (ToolContext)
 * - Perform segmentation (delegates to worker)
 * - Handle layer creation (delegates to workflow)
 */
export interface CanvasV3Props {
  // State from contexts
  layers: Layer[];
  currentLayerId: string | null;
  wandOptions: WandOptions;
  selectionState: SelectionState;
  
  // Callbacks to contexts
  onLayerCreate?: (layer: Layer) => void;
  onLayerUpdate?: (layer: Layer) => void;
  onModifierCreate?: (layerId: string, modifierId: string, mask: Uint8ClampedArray) => void;
  onModifierUpdate?: (layerId: string, modifierId: string, mask: Uint8ClampedArray) => void;
  performSegmentation: (imageData: ImageData, x: number, y: number) => Promise<void>;
  
  // Optional
  magicWandActions?: MagicWandWorkflowActions;
}

/**
 * Component lifecycle:
 * 
 * 1. Mount:
 *    - Create CoordinateSystem
 *    - Create RenderPipeline
 *    - Create PanZoomHandler
 *    - Create V3MagicWandHandler
 *    - Initialize High-DPI canvas
 *    - Start render loop
 * 
 * 2. Update (layers change):
 *    - Update V3MagicWandHandler with new layers
 *    - Update stateRef with new layers
 *    - Trigger render
 * 
 * 3. Update (wandOptions change):
 *    - Update MagicWandBridge with new options
 *    - Trigger render (if preview active)
 * 
 * 4. Unmount:
 *    - Stop RenderPipeline
 *    - Destroy PanZoomHandler
 *    - Terminate V3MagicWandHandler worker
 *    - Cleanup event listeners
 */
```

---

### **2. LeftToolbar Component**

```typescript
/**
 * Left toolbar for tool selection
 * 
 * Responsibilities:
 * - Display all available tools
 * - Highlight current tool
 * - Handle tool selection
 * - Show tool shortcuts
 * 
 * Does NOT:
 * - Implement tool logic (delegates to tools)
 * - Manage tool state (uses ToolContext)
 */
export interface LeftToolbarProps {
  // No props needed - uses contexts
}

/**
 * Internal state:
 * - tools: Tool[] (from ToolRegistry)
 * - currentTool: Tool | null (from ToolContext)
 */

/**
 * Event handlers:
 * - onToolSelect(tool: Tool) → ToolContext.setTool
 * - onKeyDown(e) → Check shortcuts, call setTool
 */
```

---

### **3. LayersPanel Component**

```typescript
/**
 * Layers panel for layer management
 * 
 * Responsibilities:
 * - Display all layers in stack
 * - Show layer thumbnails
 * - Handle layer selection
 * - Handle layer visibility toggle
 * - Handle layer reordering (drag/drop)
 * - Show layer modifiers
 * 
 * Does NOT:
 * - Render layers (delegates to Canvas)
 * - Store layer state (uses ProjectContext)
 */
export interface LayersPanelProps {
  // No props needed - uses contexts
}

/**
 * Internal state:
 * - layers: Layer[] (from ProjectContext)
 * - selectedLayerId: string | null (from ProjectContext)
 * - draggedLayerId: string | null (local state)
 */

/**
 * Event handlers:
 * - onLayerSelect(layerId) → ProjectContext.selectLayer
 * - onLayerVisibilityToggle(layerId) → ProjectContext.setLayerVisibility
 * - onLayerDragStart(layerId) → Set local drag state
 * - onLayerDrop(layerId, targetIndex) → ProjectContext.moveLayer
 * - onLayerDelete(layerId) → ProjectContext.removeLayer
 */
```

---

### **4. MagicWandBridge Component**

```typescript
/**
 * Bridge between V3MagicWandHandler and useMagicWandWorkflow
 * 
 * Responsibilities:
 * - Forward hover previews from handler to workflow
 * - Forward click results from handler to workflow
 * - Update handler with workflow settings
 * - Synchronize state between handler and workflow
 * 
 * Does NOT:
 * - Perform segmentation (delegates to handler)
 * - Create layers (delegates to workflow)
 */
export interface MagicWandBridgeConfig {
  handler: V3MagicWandHandler;
  workflowActions: MagicWandWorkflowActions | null;
}

/**
 * Methods:
 * - setWorkflowActions(actions) - Update workflow actions
 * - setWandOptions(options) - Update wand options
 * - handleHoverResult(result) - Forward to workflow
 * - handleClickResult(result) - Forward to workflow
 */
```

---

## 📊 **DEPENDENCY GRAPH - VISUAL**

### **Core Canvas Dependencies:**

```
┌──────────────┐
│ constants.ts │ (no deps)
└──────┬───────┘
       │
       ├──→ CANVAS_WIDTH = 800
       ├──→ CANVAS_HEIGHT = 600
       └──→ VIEWPORT_CENTER_X/Y
              ↓
       ┌──────────────┐
       │   types.ts   │ (no deps)
       └──────┬───────┘
              │
              ├──→ Point
              ├──→ Rectangle
              ├──→ Layer
              └──→ SelectionMask
                     ↓
       ┌──────────────────────┐
       │ DimensionValidator   │
       └──────┬───────────────┘
              │
              └──→ validate()
                     ↓
       ┌──────────────────────┐
       │  CoordinateSystem    │
       └──────┬───────────────┘
              │
              ├──→ screenToWorld()
              ├──→ worldToScreen()
              ├──→ worldToImage()
              └──→ applyTransform()
                     ↓
       ┌──────────────────────┬────────────────────┬──────────────────┐
       │                      │                    │                  │
       ▼                      ▼                    ▼                  ▼
┌──────────────┐   ┌──────────────────┐   ┌──────────────┐   ┌──────────────┐
│ PanZoomHandler│   │V3MagicWandHandler│   │RenderPipeline│   │compositeLayers│
└──────────────┘   └──────────────────┘   └──────────────┘   └──────────────┘
       │                    │                     │                  │
       │                    ├──→ worker           ├──→ ModifierStack │
       │                    │                     │                  │
       │                    └──→ MagicWandBridge  └──→ layerAdapter  │
       │                                                              │
       └──────────────────────────────────────────────────────────────┘
                                      ↓
                           ┌──────────────────────┐
                           │      CanvasV3        │
                           └──────────────────────┘
```

---

## 🎯 **CRITICAL PATH COMPONENTS**

### **Hover → Preview Critical Path:**

```
1. PointerEvent (Browser)
   ↓
2. CanvasV3.handleMouseMove()
   ↓
3. CoordinateSystem.screenToWorld()
   ↓ (synchronous)
4. compositeLayers()
   ↓ (synchronous - generates ImageData)
5. V3MagicWandHandler.handleHover()
   ↓ (sends to worker)
6. magicWand.worker.ts
   ↓ (async - runs flood fill)
7. Worker postMessage (result)
   ↓ (async - returns to main thread)
8. V3MagicWandHandler (receives result)
   ↓ (updates state)
9. CanvasV3.renderInteraction()
   ↓ (draws preview)
10. Canvas Display (Browser)
   ↓
USER SEES PREVIEW

TOTAL TIME: 16-50ms (target < 60fps = 16.67ms)
```

### **Click → Layer Critical Path:**

```
1. PointerEvent (Browser)
   ↓
2. CanvasV3.handleClick()
   ↓
3. CoordinateSystem.screenToWorld()
   ↓ (synchronous)
4. compositeLayers()
   ↓ (synchronous)
5. V3MagicWandHandler.handleClick()
   ↓ (sends to worker)
6. magicWand.worker.ts
   ↓ (async - full segmentation, no limits)
7. Worker postMessage (result)
   ↓ (async)
8. MagicWandBridge (receives result)
   ↓
9. useMagicWandWorkflow.handleClick()
   ↓ (decides: normal/shift/alt)
10. createLayerFromSegment()
    ↓ (extracts pixels, creates layer)
11. ProjectContext.addLayer()
    ↓ (adds to layer stack)
12. React state update
    ↓
13. CanvasV3 re-render
    ↓ (renders all layers)
14. Canvas Display (Browser)
    ↓
USER SEES NEW LAYER

TOTAL TIME: 50-200ms (acceptable for user-initiated action)
```

---

## 🎨 **COMPONENT OWNERSHIP & RESPONSIBILITIES**

### **Canvas System (CoordinateSystem owns):**

```
CoordinateSystem
├── OWNS: Pan position (panX, panY)
├── OWNS: Zoom level (zoom)
├── OWNS: Canvas bounding rect (cached)
├── OWNS: Browser zoom factor
│
├── PROVIDES: screenToWorld()
├── PROVIDES: worldToScreen()
├── PROVIDES: applyTransform()
│
└── USED BY:
    ├── PanZoomHandler (for pan/zoom updates)
    ├── V3MagicWandHandler (for coordinate conversion)
    ├── RenderPipeline (for canvas transforms)
    └── CanvasV3 (for event handling)
```

### **Project System (ProjectContext owns):**

```
ProjectContext
├── OWNS: Project state
├── OWNS: Layer stack (layers[])
├── OWNS: Selected layer IDs
├── OWNS: Project metadata
│
├── PROVIDES: addLayer()
├── PROVIDES: removeLayer()
├── PROVIDES: updateLayer()
├── PROVIDES: moveLayer()
├── PROVIDES: selectLayer()
│
└── USED BY:
    ├── CanvasV3Wrapper (passes to CanvasV3)
    ├── LayersPanel (displays layers)
    ├── useMagicWandWorkflow (creates layers)
    └── All panels (read/update layers)
```

### **History System (HistoryContext owns):**

```
HistoryContext
├── OWNS: History stack (snapshots[])
├── OWNS: History index (current position)
├── OWNS: Undo/redo state
│
├── PROVIDES: undo()
├── PROVIDES: redo()
├── PROVIDES: push()
├── PROVIDES: canUndo
├── PROVIDES: canRedo
│
└── USED BY:
    ├── ProjectContext (pushes snapshots on actions)
    ├── CanvasV3 (keyboard shortcuts)
    └── BottomBar (undo/redo buttons)
```

### **Tool System (ToolContext owns):**

```
ToolContext
├── OWNS: Current tool
├── OWNS: Tool settings (per tool)
├── OWNS: Tool registry
│
├── PROVIDES: setTool()
├── PROVIDES: setToolSettings()
├── PROVIDES: getToolSettings()
├── PROVIDES: getCurrentTool()
│
└── USED BY:
    ├── LeftToolbar (displays tools, handles selection)
    ├── LeftSettingsPanel (displays/edits settings)
    ├── CanvasV3 (uses current tool for interactions)
    └── All tool-dependent components
```

---

## 🔄 **COMMUNICATION PATTERNS**

### **Pattern 1: Props Down, Events Up**

```typescript
// Parent Component
function ImagesPage() {
  const { layers } = useProject();
  
  const handleLayerCreate = (layer: Layer) => {
    // Handle layer creation
  };

  return (
    <CanvasV3Wrapper
      layers={layers}              // DATA DOWN ↓
      onLayerCreate={handleLayerCreate}  // EVENTS UP ↑
    />
  );
}

// Child Component
function CanvasV3Wrapper({ layers, onLayerCreate }) {
  const handleClick = async () => {
    const newLayer = await createLayer();
    onLayerCreate(newLayer);  // EVENT UP ↑
  };

  return <CanvasV3 layers={layers} />; // DATA DOWN ↓
}
```

### **Pattern 2: Context for Global State**

```typescript
// Provider
function ProjectProvider({ children }) {
  const [layers, setLayers] = useState<Layer[]>([]);

  const addLayer = useCallback((layer: Layer) => {
    setLayers(prev => [...prev, layer]);
  }, []);

  return (
    <ProjectContext.Provider value={{ layers, addLayer }}>
      {children}
    </ProjectContext.Provider>
  );
}

// Consumer 1
function CanvasV3Wrapper() {
  const { layers } = useProject();
  return <CanvasV3 layers={layers} />;
}

// Consumer 2
function LayersPanel() {
  const { layers, addLayer } = useProject();
  return <div>{layers.map(renderLayer)}</div>;
}
```

### **Pattern 3: Event Bus for Cross-Cutting**

```typescript
// Component A emits event
function CanvasV3() {
  const handleZoom = (zoom: number) => {
    setZoom(zoom);
    globalEvents.emit('canvas:zoom', { zoom });
  };
}

// Component B listens to event
function ZoomIndicator() {
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    return globalEvents.on('canvas:zoom', ({ zoom }) => {
      setZoom(zoom);
    });
  }, []);

  return <div>Zoom: {zoom}x</div>;
}
```

---

## 🎯 **COMPONENT TESTING STRATEGY**

### **Unit Tests (Isolated Components):**

```typescript
describe('CoordinateSystem', () => {
  let coordSystem: CoordinateSystem;
  let canvas: HTMLCanvasElement;

  beforeEach(() => {
    canvas = document.createElement('canvas');
    canvas.width = 1600;
    canvas.height = 1200;
    coordSystem = new CoordinateSystem(canvas);
  });

  it('should convert screen to world coordinates', () => {
    const world = coordSystem.screenToWorld(400, 300);
    expect(world).toEqual({ x: 0, y: 0 });
  });

  it('should roundtrip screen → world → screen', () => {
    const original = { x: 123, y: 456 };
    const world = coordSystem.screenToWorld(original.x, original.y);
    const screen = coordSystem.worldToScreen(world.x, world.y);
    expect(screen.x).toBeCloseTo(original.x, 1);
    expect(screen.y).toBeCloseTo(original.y, 1);
  });
});
```

### **Integration Tests (Component Interactions):**

```typescript
describe('Canvas + Workflow Integration', () => {
  it('should create layer when magic wand is clicked', async () => {
    const { result } = renderHook(() => useProject());
    const initialLayerCount = result.current.layers.length;

    // Render canvas
    const { getByTestId } = render(<CanvasV3Wrapper />);
    const canvas = getByTestId('canvas');

    // Click on canvas
    fireEvent.click(canvas, { clientX: 400, clientY: 300 });

    // Wait for layer creation
    await waitFor(() => {
      expect(result.current.layers.length).toBe(initialLayerCount + 1);
    });

    // Verify layer
    const newLayer = result.current.layers[result.current.layers.length - 1];
    expect(newLayer.type).toBe('raster');
    expect(newLayer.imageData).toBeTruthy();
  });
});
```

### **E2E Tests (Complete Workflows):**

```typescript
describe('Magic Wand E2E Workflow', () => {
  it('should complete full magic wand workflow', async () => {
    // 1. Load image
    await loadImage('test.png');

    // 2. Select magic wand tool
    await selectTool('magic-wand');

    // 3. Hover over canvas
    await hoverCanvas(400, 300);
    await waitForPreview();

    // 4. Verify preview appears
    expect(getPreview()).toBeTruthy();

    // 5. Click to create layer
    await clickCanvas(400, 300);
    await waitForLayer();

    // 6. Verify layer created
    expect(getLayers().length).toBe(2); // Original + new

    // 7. Verify layer has correct bounds
    const newLayer = getLayers()[1];
    expect(newLayer.bounds).toBeDefined();
    expect(newLayer.imageData).toBeTruthy();

    // 8. Shift-click to accumulate
    await holdShift();
    await clickCanvas(450, 350);
    await waitForLayerUpdate();

    // 9. Verify layer updated (not new layer)
    expect(getLayers().length).toBe(2); // Still 2 layers
    expect(getLayers()[1].bounds.width).toBeGreaterThan(newLayer.bounds.width);

    // 10. Release shift
    await releaseShift();

    // 11. Alt-click to create modifier
    await holdAlt();
    await clickCanvas(500, 400);
    await waitForModifier();

    // 12. Verify modifier created
    const layerWithModifier = getLayers()[1];
    expect(layerWithModifier.modifiers.length).toBe(1);
    expect(layerWithModifier.modifiers[0].type).toBe('transparency-mask');
  });
});
```

---

## 🎯 **COMPONENT DOCUMENTATION TEMPLATE**

### **Standard Component Doc:**

```typescript
/**
 * ComponentName
 * 
 * @description Brief description of component purpose
 * 
 * @responsibilities
 * - What this component is responsible for
 * - What operations it performs
 * - What state it owns
 * 
 * @does-not
 * - What this component does NOT do
 * - What it delegates to other components
 * 
 * @props ComponentProps interface
 * 
 * @state Internal state shape
 * 
 * @lifecycle
 * - Mount: What happens on mount
 * - Update: What happens on prop/state changes
 * - Unmount: What cleanup is performed
 * 
 * @events
 * - What events this component emits
 * - What events this component listens to
 * 
 * @context
 * - What contexts this component uses
 * - What contexts this component provides
 * 
 * @performance
 * - Performance characteristics
 * - Optimization strategies
 * - Expensive operations
 * 
 * @testing
 * - How to test this component
 * - Key test scenarios
 * - Mocking requirements
 * 
 * @example
 * ```tsx
 * <ComponentName prop1="value" onEvent={handler} />
 * ```
 */
export interface ComponentNameProps {
  // Props interface
}

export function ComponentName(props: ComponentNameProps) {
  // Implementation
}
```

---

## 🎯 **DEPENDENCY INJECTION PATTERN**

### **Injecting Dependencies:**

```typescript
/**
 * Instead of hard-coding dependencies, inject them
 */

// ❌ BAD: Hard-coded dependency
class PanZoomHandler {
  private coordSystem: CoordinateSystem;

  constructor(canvas: HTMLCanvasElement) {
    this.coordSystem = new CoordinateSystem(canvas); // HARD-CODED!
  }
}

// ✅ GOOD: Injected dependency
class PanZoomHandler {
  private coordSystem: CoordinateSystem;

  constructor(coordSystem: CoordinateSystem) {
    this.coordSystem = coordSystem; // INJECTED!
  }
}

// Usage
const coordSystem = new CoordinateSystem(canvas);
const panZoomHandler = new PanZoomHandler(coordSystem);
const magicWandHandler = new V3MagicWandHandler(coordSystem);

// Benefits:
// - Easy testing (inject mocks)
// - Flexible (swap implementations)
// - Clear dependencies (explicit in constructor)
```

---

## 🎯 **COMPONENT LAZY LOADING**

### **Code Splitting Strategy:**

```typescript
/**
 * Lazy load panels to reduce initial bundle size
 */

// Lazy load panel components
const LayersPanel = lazy(() => import('./panels/LayersPanel'));
const AIChatPanel = lazy(() => import('./panels/AIChatPanel'));
const EffectsPanel = lazy(() => import('./panels/EffectsPanel'));

// Use with Suspense
function ImagesPage() {
  return (
    <div>
      <CanvasV3Wrapper />
      
      <Suspense fallback={<PanelSkeleton />}>
        {openPanel === 'layers' && <LayersPanel />}
        {openPanel === 'aiChat' && <AIChatPanel />}
        {openPanel === 'effects' && <EffectsPanel />}
      </Suspense>
    </div>
  );
}
```

### **Bundle Analysis:**

```
CORE BUNDLE (always loaded):
├── CanvasV3.tsx (~500 lines)
├── CoordinateSystem.ts (~300 lines)
├── RenderPipeline.ts (~400 lines)
├── PanZoomHandler.ts (~250 lines)
├── V3MagicWandHandler.ts (~350 lines)
├── types.ts (~200 lines)
└── constants.ts (~50 lines)
TOTAL: ~2,050 lines (~80KB minified)

LAZY LOADED (on demand):
├── LayersPanel (~300 lines)
├── AIChatPanel (~400 lines)
├── EffectsPanel (~500 lines)
├── ColorSpherePanel (~600 lines)
└── Other panels (~2,000 lines total)
TOTAL: ~3,800 lines (~150KB minified)

WORKER (separate thread):
└── magicWand.worker.ts (~400 lines, ~15KB)
```

---

## 🎯 **SUCCESS CRITERIA**

✅ Complete component hierarchy mapped
✅ All dependencies explicitly documented
✅ Critical paths identified
✅ Component ownership clear
✅ Communication patterns defined
✅ Testing strategy documented
✅ Lazy loading strategy defined

---

**Next:** Create testing specifications and quality gates?
