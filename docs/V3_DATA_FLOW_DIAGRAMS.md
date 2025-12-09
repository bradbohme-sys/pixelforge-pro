# V3 Data Flow Diagrams - Complete System Data Flows

**Date:** 2025-01-27  
**Status:** 📋 **SPECIFICATION**  
**Purpose:** Map all data transformations and flows through V3 Image Editor  

---

## 🎯 **DATA FLOW PHILOSOPHY**

### **Core Principles:**
1. **Trace Data** — Every data transformation documented
2. **No Black Boxes** — All intermediate steps visible
3. **Immutability** — Data flows without mutation where possible
4. **Type Preservation** — Types maintained through transformations
5. **Performance Awareness** — Expensive operations clearly marked

### **Data Flow Patterns:**
- **Pure Functions** — Input → Transform → Output (no side effects)
- **Pipelines** — Chain of transformations
- **Caching** — Memoization for expensive operations
- **Streaming** — Process data in chunks for large operations

---

## 🌊 **1. V6 PREVIEW FLOW - ORGANIC EXPANSION** ⭐ **NEW**

### **From Hover to Expanding Wave:**

```
USER ACTION: Hover over canvas
  ↓
EVENT: onMouseMove(screenX, screenY)
  ↓
COORDINATE: screenToWorld(screenX, screenY) → worldPoint
  ↓
IMAGEDATA: compositeLayers() → worldSpaceImageData
  ↓
REQUEST: RequestCancellation.startPreview() → requestId
  ↓
CANCEL: Cancel all previous requests
  ↓
INSTANT: ZeroLatencyPreview.drawInstantSeed()
  ↓
  ├──→ Draw 3×3 patch immediately
  └──→ [0ms perceived latency] ✅
  ↓
PREVIEW: PreviewWaveEngine.startWave()
  ↓
INITIALIZE: RingBFS(seedPoint)
  ↓
  ├──→ queue = [seedPoint]
  ├──→ nextRing = []
  ├──→ visited = Uint8Array (all 0 = unseen)
  ├──→ mask = Uint8ClampedArray (all 0)
  └──→ ringNumber = 0
  ↓
FRAME 1: processRing(timeBudget = 6ms)
  ↓
  ├──→ Process seed point
  ├──→ Check 4 neighbors (4-connectivity)
  ├──→ For each neighbor:
  │    ├──→ Get color from ImageData
  │    ├──→ Calculate similarity to seed color
  │    ├──→ If similarity <= tolerance:
  │    │    ├──→ visited[neighbor] = 1 (ACCEPTED)
  │    │    ├──→ mask[neighbor] = 255
  │    │    └──→ nextRing.push(neighbor)
  │    └──→ Else:
  │         └──→ visited[neighbor] = 2 (REJECTED)
  ├──→ ringRemaining = 0 (ring complete)
  ├──→ Move nextRing → queue
  └──→ ringNumber = 1
  ↓
DRAW: Draw partial mask (ring 1) to interaction canvas
  ↓
YIELD: requestAnimationFrame (next frame)
  ↓
FRAME 2: processRing(timeBudget = 6ms)
  ↓
  ├──→ Process ring 1 pixels (4 pixels typically)
  ├──→ Check neighbors of each
  ├──→ Accept/reject based on tolerance
  ├──→ Build ring 2
  └──→ ringNumber = 2
  ↓
DRAW: Draw expanded mask (ring 2) to interaction canvas
  ↓
REPEAT: Until complete OR time budget exhausted OR user moves
  ↓
DISPLAY: User sees expanding wave (feels "alive")

USER ACTION: Scroll (tolerance increases)
  ↓
EVENT: onWheel(deltaY)
  ↓
TOLERANCE: tolerance += deltaY * toleranceSpeed
  ↓
BREATHING: BreathingTolerance.increaseTolerance(newTolerance)
  ↓
  ├──→ Re-test rejectedFrontier pixels
  ├──→ Newly accepted pixels → expansionQueue
  ├──→ Expand from newly accepted
  └──→ Update rejectedFrontier
  ↓
DRAW: Draw expanded mask (smooth expansion, not snap)
  ↓
DISPLAY: User sees mask "inhale" and expand
```

### **Performance Characteristics:**

```
Ring BFS Memory:
- Queue: O(perimeter) not O(area)
- Visited: O(area) but single Uint8Array
- NextRing: O(perimeter)
- Total: O(area) but efficient

Ring BFS CPU:
- Per ring: O(perimeter)
- Time budget: 4-8ms per frame
- Natural wave expansion
- No heap allocations

Frame Budget (60fps = 16.67ms):
├── Preview Compute: 4-8ms (V6 Ring BFS)
├── Drawing: 2-4ms (interaction canvas)
├── UI Updates: 2-4ms (React state)
└── Browser Overhead: 2-4ms
─────────────────────────────────
Total: ~16ms (comfortable margin)
```

---

## 📊 **2. IMAGEDATA FLOW - COMPLETE PIPELINE**

### **From File Load to Canvas Display:**

```
┌─────────────────┐
│  FILE UPLOAD    │
│  (User Action)  │
└────────┬────────┘
         │
         ├─── File Validation (format, size, CORS)
         │
         ▼
┌─────────────────┐
│  FILE READER    │
│  (Browser API)  │
└────────┬────────┘
         │
         ├─── Read as Data URL
         │
         ▼
┌─────────────────┐
│  IMAGE ELEMENT  │
│  (HTMLImage)    │
└────────┬────────┘
         │
         ├─── Wait for load event
         │
         ▼
┌─────────────────┐
│ CANVAS CONTEXT  │
│  (Temporary)    │
└────────┬────────┘
         │
         ├─── drawImage(img, 0, 0)
         ├─── getImageData(0, 0, w, h)
         │
         ▼
┌─────────────────┐
│   IMAGEDATA     │
│  (Raw Pixels)   │
│  ✅ VALIDATED   │
└────────┬────────┘
         │
         ├─── Validate dimensions (CANVAS_WIDTH × CANVAS_HEIGHT)
         ├─── Validate format (Uint8ClampedArray)
         │
         ▼
┌─────────────────┐
│     LAYER       │
│  (World Space)  │
└────────┬────────┘
         │
         ├─── Create Layer object
         ├─── Assign bounds (top-left based)
         ├─── Set transform (identity initially)
         │
         ▼
┌─────────────────┐
│  LAYER STACK    │
│ (ProjectContext)│
└────────┬────────┘
         │
         ├─── Add to layers array
         ├─── Trigger render
         │
         ▼
┌─────────────────┐
│ RENDER PIPELINE │
│ (60fps loop)    │
└────────┬────────┘
         │
         ├─── For each visible layer:
         │    ├─── Get layer imageData
         │    ├─── Apply modifiers (ModifierStack)
         │    ├─── Apply transform (CoordinateSystem)
         │    └─── Composite to canvas
         │
         ▼
┌─────────────────┐
│ CANVAS ELEMENT  │
│  (Display)      │
└─────────────────┘
         │
         ▼
    USER SEES IMAGE
```

---

## 🎯 **3. COORDINATE FLOW - TRANSFORMATION PIPELINE**

### **From Screen Click to Pixel Selection:**

```
┌─────────────────┐
│  POINTER EVENT  │
│  (screenX, Y)   │
└────────┬────────┘
         │
         │ INPUT: Raw screen coordinates (CSS pixels)
         │
         ▼
┌─────────────────────────────────────────┐
│  STEP 1: SCREEN → CANVAS                │
│  (Account for canvas position + DPR)    │
└────────┬────────────────────────────────┘
         │
         │ FORMULA:
         │   rect = canvas.getBoundingClientRect()
         │   dpr = window.devicePixelRatio
         │   scaleX = canvas.width / rect.width
         │   scaleY = canvas.height / rect.height
         │   canvasX = (screenX - rect.left) * scaleX
         │   canvasY = (screenY - rect.top) * scaleY
         │
         │ OUTPUT: Canvas coordinates (physical pixels)
         │
         ▼
┌─────────────────────────────────────────┐
│  STEP 2: CANVAS → WORLD                 │
│  (Reverse pan/zoom transform)           │
└────────┬────────────────────────────────┘
         │
         │ FORMULA:
         │   worldX = (canvasX - VIEWPORT_CENTER_X - panX) / zoom
         │   worldY = (canvasY - VIEWPORT_CENTER_Y - panY) / zoom
         │
         │ WHERE:
         │   VIEWPORT_CENTER_X = canvas.width / (2 * dpr)
         │   VIEWPORT_CENTER_Y = canvas.height / (2 * dpr)
         │
         │ OUTPUT: World coordinates (top-left based, 0 to CANVAS_WIDTH/HEIGHT)
         │
         ▼
┌─────────────────────────────────────────┐
│  STEP 3: WORLD → IMAGE                  │
│  (Identity function in V3)              │
└────────┬────────────────────────────────┘
         │
         │ FORMULA:
         │   imageX = worldX  (identity)
         │   imageY = worldY  (identity)
         │
         │ REASON: World space IS image space in V3
         │
         │ OUTPUT: Image coordinates (pixel indices)
         │
         ▼
┌─────────────────────────────────────────┐
│  STEP 4: IMAGE → PIXEL INDEX            │
│  (Flatten 2D to 1D)                     │
└────────┬────────────────────────────────┘
         │
         │ FORMULA:
         │   pixelIndex = imageY * imageWidth + imageX
         │
         │ OUTPUT: Pixel index in ImageData.data array
         │
         ▼
┌─────────────────────────────────────────┐
│  STEP 5: PIXEL INDEX → RGBA             │
│  (Extract color values)                 │
└────────┬────────────────────────────────┘
         │
         │ FORMULA:
         │   dataIndex = pixelIndex * 4
         │   r = imageData.data[dataIndex + 0]
         │   g = imageData.data[dataIndex + 1]
         │   b = imageData.data[dataIndex + 2]
         │   a = imageData.data[dataIndex + 3]
         │
         │ OUTPUT: RGBA color at clicked pixel
         │
         ▼
┌─────────────────┐
│  FLOOD FILL     │
│  (Segmentation) │
└─────────────────┘
```

### **Reverse Flow (World → Screen for Rendering):**

```
┌─────────────────┐
│  WORLD POINT    │
│  (worldX, Y)    │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│  STEP 1: WORLD → CANVAS                 │
│  (Apply pan/zoom transform)             │
└────────┬────────────────────────────────┘
         │
         │ FORMULA:
         │   canvasX = worldX * zoom + panX + VIEWPORT_CENTER_X
         │   canvasY = worldY * zoom + panY + VIEWPORT_CENTER_Y
         │
         │ OUTPUT: Canvas coordinates (physical pixels)
         │
         ▼
┌─────────────────────────────────────────┐
│  STEP 2: CANVAS → SCREEN                │
│  (Account for canvas position + DPR)    │
└────────┬────────────────────────────────┘
         │
         │ FORMULA:
         │   rect = canvas.getBoundingClientRect()
         │   dpr = window.devicePixelRatio
         │   screenX = canvasX / (canvas.width / rect.width) + rect.left
         │   screenY = canvasY / (canvas.height / rect.height) + rect.top
         │
         │ OUTPUT: Screen coordinates (CSS pixels)
         │
         ▼
┌─────────────────┐
│  SCREEN POINT   │
│  (Display)      │
└─────────────────┘
```

---

## 🔄 **4. MODIFIER FLOW - NON-DESTRUCTIVE EDITING**

### **From Modifier Addition to Display:**

```
┌─────────────────┐
│ USER ADDS       │
│ MODIFIER        │
│ (Alt-click)     │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│ STEP 1: CREATE MODIFIER                 │
│ (useMagicWandWorkflow)                  │
└────────┬────────────────────────────────┘
         │
         │ DATA:
         │   modifier = {
         │     id: UUID,
         │     type: 'transparency-mask',
         │     enabled: true,
         │     opacity: 1,
         │     parameters: {
         │       mask: Uint8ClampedArray,
         │       bounds: Rectangle
         │     }
         │   }
         │
         ▼
┌─────────────────────────────────────────┐
│ STEP 2: ADD TO LAYER                    │
│ (Layer.modifiers.push)                  │
└────────┬────────────────────────────────┘
         │
         │ DATA:
         │   layer.modifiers = [...layer.modifiers, modifier]
         │
         ▼
┌─────────────────────────────────────────┐
│ STEP 3: TRIGGER RENDER                  │
│ (ProjectContext update)                 │
└────────┬────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│ STEP 4: RENDER LAYER                    │
│ (RenderPipeline.renderLayer)            │
└────────┬────────────────────────────────┘
         │
         │ PROCESS:
         │   1. Get layer.imageData (original)
         │   2. Apply modifiers via ModifierStack
         │
         ▼
┌─────────────────────────────────────────┐
│ STEP 5: APPLY MODIFIER STACK            │
│ (ModifierStack.applyStack)              │
└────────┬────────────────────────────────┘
         │
         │ LOOP: For each enabled modifier:
         │   1. Get modifier type
         │   2. Call applyModifier()
         │   3. Get result imageData
         │   4. Pass to next modifier
         │
         ▼
┌─────────────────────────────────────────┐
│ STEP 6: APPLY TRANSPARENCY MASK         │
│ (ModifierStack.applyTransparencyMask)   │
└────────┬────────────────────────────────┘
         │
         │ ALGORITHM:
         │   for each pixel in imageData:
         │     maskValue = mask[pixelIndex] / 255
         │     if maskValue > 0:
         │       alpha = alpha * (1 - maskValue * effectStrength)
         │
         │ OUTPUT: Modified imageData with transparency
         │
         ▼
┌─────────────────────────────────────────┐
│ STEP 7: COMPOSITE TO CANVAS             │
│ (RenderPipeline.composite)              │
└────────┬────────────────────────────────┘
         │
         │ PROCESS:
         │   1. Apply layer transform
         │   2. Apply layer opacity
         │   3. Apply blend mode
         │   4. Draw to canvas
         │
         ▼
┌─────────────────┐
│ CANVAS DISPLAY  │
└─────────────────┘
         │
         ▼
   USER SEES RESULT
```

---

## 🎨 **4. SELECTION MASK FLOW**

### **From Segmentation to Layer Extraction:**

```
┌─────────────────┐
│ USER CLICKS     │
│ (worldX, Y)     │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│ STEP 1: GET COMPOSITE IMAGEDATA         │
│ (compositeLayers.ts)                    │
└────────┬────────────────────────────────┘
         │
         │ PROCESS:
         │   1. Create temp canvas (CANVAS_WIDTH × CANVAS_HEIGHT)
         │   2. For each visible layer:
         │      a. Convert center-based coords to top-left
         │      b. Apply layer transforms
         │      c. Draw layer imageData
         │   3. getImageData(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
         │
         │ OUTPUT: Composite ImageData (world space)
         │
         ▼
┌─────────────────────────────────────────┐
│ STEP 2: SEND TO WORKER                  │
│ (V3MagicWandHandler)                    │
└────────┬────────────────────────────────┘
         │
         │ MESSAGE:
         │   {
         │     type: 'segment',
         │     imageData: composite,
         │     startPoint: {worldX, worldY},
         │     options: {tolerance, connectivity, ...}
         │   }
         │
         ▼
┌─────────────────────────────────────────┐
│ STEP 3: FLOOD FILL ALGORITHM            │
│ (magicWand.worker.ts)                   │
└────────┬────────────────────────────────┘
         │
         │ ALGORITHM:
         │   1. Get seed pixel color
         │   2. Initialize queue with seed
         │   3. While queue not empty:
         │      a. Pop pixel
         │      b. Check if similar color
         │      c. Mark as selected
         │      d. Add neighbors to queue
         │   4. Build mask from selected pixels
         │
         │ OUTPUT: {mask, bounds, pixels, metadata}
         │
         ▼
┌─────────────────────────────────────────┐
│ STEP 4: RETURN TO MAIN THREAD           │
│ (Worker postMessage)                    │
└────────┬────────────────────────────────┘
         │
         │ MESSAGE:
         │   {
         │     type: 'segment-result',
         │     mask: Uint8ClampedArray,
         │     bounds: Rectangle,
         │     pixels: number[],
         │     metadata: {...}
         │   }
         │
         ▼
┌─────────────────────────────────────────┐
│ STEP 5: CREATE SELECTION MASK           │
│ (V3MagicWandHandler)                    │
└────────┬────────────────────────────────┘
         │
         │ DATA:
         │   selectionMask = {
         │     id: UUID,
         │     mask: result.mask,
         │     bounds: result.bounds,
         │     width: CANVAS_WIDTH,
         │     height: CANVAS_HEIGHT,
         │     pixels: new Set(result.pixels),
         │     feathered: false,
         │     metadata: {...}
         │   }
         │
         ▼
┌─────────────────────────────────────────┐
│ STEP 6: EXTRACT PIXELS WITH MASK        │
│ (LayerUtils.extractPixelsWithMask)     │
└────────┬────────────────────────────────┘
         │
         │ ALGORITHM:
         │   1. Create new ImageData (bounds.width × bounds.height)
         │   2. For each pixel in bounds:
         │      if mask[pixel] > 0:
         │        newImageData[destIndex] = sourceImageData[srcIndex]
         │   3. Crop to non-empty bounds
         │
         │ OUTPUT: Cropped ImageData with only selected pixels
         │
         ▼
┌─────────────────────────────────────────┐
│ STEP 7: CREATE LAYER FROM SEGMENT       │
│ (LayerUtils.createLayerFromSegment)    │
└────────┬────────────────────────────────┘
         │
         │ DATA:
         │   newLayer = {
         │     id: UUID,
         │     name: 'Segment 1',
         │     type: 'raster',
         │     imageData: extractedImageData,
         │     bounds: extractedBounds,
         │     transform: identity,
         │     modifiers: [],
         │     ...
         │   }
         │
         ▼
┌─────────────────────────────────────────┐
│ STEP 8: ADD TO PROJECT                  │
│ (ProjectContext.addLayer)               │
└────────┬────────────────────────────────┘
         │
         │ UPDATE:
         │   project.layers.push(newLayer)
         │   project.selectedLayerIds = [newLayer.id]
         │
         ▼
┌─────────────────────────────────────────┐
│ STEP 9: TRIGGER RENDER                  │
│ (React state update)                    │
└────────┬────────────────────────────────┘
         │
         ▼
┌─────────────────┐
│ CANVAS RENDERS  │
│ WITH NEW LAYER  │
└─────────────────┘
         │
         ▼
   USER SEES LAYER
```

---

## 🔄 **6. HISTORY FLOW - UNDO/REDO PIPELINE**

### **From Action to History Snapshot:**

```
┌─────────────────┐
│  USER ACTION    │
│  (e.g., add     │
│   layer)        │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│ STEP 1: PERFORM ACTION                  │
│ (ProjectContext operation)              │
└────────┬────────────────────────────────┘
         │
         │ EXAMPLE:
         │   addLayer(newLayer)
         │   → project.layers.push(newLayer)
         │
         ▼
┌─────────────────────────────────────────┐
│ STEP 2: CREATE SNAPSHOT                 │
│ (Before action completes)               │
└────────┬────────────────────────────────┘
         │
         │ DATA:
         │   snapshot = {
         │     id: UUID,
         │     description: 'Add Layer: Segment 1',
         │     project: deepClone(project),
         │     canvasState: deepClone(canvasState),
         │     timestamp: Date.now()
         │   }
         │
         │ NOTE: Deep clone to prevent mutations
         │
         ▼
┌─────────────────────────────────────────┐
│ STEP 3: PUSH TO HISTORY STACK           │
│ (HistoryContext.push)                   │
└────────┬────────────────────────────────┘
         │
         │ UPDATE:
         │   1. If historyIndex < history.length - 1:
         │      → Discard all snapshots after current index
         │   2. history.push(snapshot)
         │   3. historyIndex++
         │   4. Limit history size (e.g., 50 snapshots)
         │
         ▼
┌─────────────────────────────────────────┐
│ STEP 4: UPDATE UI STATE                 │
│ (HistoryContext state update)           │
└────────┬────────────────────────────────┘
         │
         │ UPDATE:
         │   canUndo = historyIndex > 0
         │   canRedo = historyIndex < history.length - 1
         │
         ▼
┌─────────────────┐
│ HISTORY UPDATED │
└─────────────────┘
```

### **Undo Flow:**

```
┌─────────────────┐
│  USER PRESSES   │
│  Ctrl+Z         │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│ STEP 1: CHECK CAN UNDO                  │
│ (HistoryContext.canUndo)                │
└────────┬────────────────────────────────┘
         │
         │ CHECK: historyIndex > 0
         │ IF FALSE: return early
         │
         ▼
┌─────────────────────────────────────────┐
│ STEP 2: DECREMENT INDEX                 │
│ (historyIndex--)                        │
└────────┬────────────────────────────────┘
         │
         │ UPDATE: historyIndex = historyIndex - 1
         │
         ▼
┌─────────────────────────────────────────┐
│ STEP 3: GET SNAPSHOT                    │
│ (history[historyIndex])                 │
└────────┬────────────────────────────────┘
         │
         │ DATA: snapshot = history[historyIndex]
         │
         ▼
┌─────────────────────────────────────────┐
│ STEP 4: RESTORE PROJECT STATE           │
│ (ProjectContext.setProject)             │
└────────┬────────────────────────────────┘
         │
         │ RESTORE:
         │   project = deepClone(snapshot.project)
         │   layers = snapshot.project.layers
         │   selectedLayerIds = snapshot.project.selectedLayerIds
         │
         ▼
┌─────────────────────────────────────────┐
│ STEP 5: RESTORE CANVAS STATE            │
│ (CanvasV3 state update)                 │
└────────┬────────────────────────────────┘
         │
         │ RESTORE:
         │   canvasState = deepClone(snapshot.canvasState)
         │   panX = snapshot.canvasState.panX
         │   panY = snapshot.canvasState.panY
         │   zoom = snapshot.canvasState.zoom
         │
         ▼
┌─────────────────────────────────────────┐
│ STEP 6: TRIGGER RENDER                  │
│ (React state update)                    │
└────────┬────────────────────────────────┘
         │
         ▼
┌─────────────────┐
│ CANVAS RENDERS  │
│ PREVIOUS STATE  │
└─────────────────┘
         │
         ▼
   USER SEES UNDO
```

---

## 🎯 **6. RENDER PIPELINE FLOW**

### **60fps Render Loop:**

```
┌─────────────────┐
│ requestAnimationFrame
│ (Browser API)   │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│ STEP 1: CHECK IF NEEDS RENDER           │
│ (Dirty flag check)                      │
└────────┬────────────────────────────────┘
         │
         │ CHECK:
         │   if (!isDirty && !isAnimating) {
         │     return; // Skip frame
         │   }
         │
         ▼
┌─────────────────────────────────────────┐
│ STEP 2: CLEAR CANVAS                    │
│ (ctx.clearRect)                         │
└────────┬────────────────────────────────┘
         │
         │ CLEAR: ctx.clearRect(0, 0, width, height)
         │
         ▼
┌─────────────────────────────────────────┐
│ STEP 3: APPLY COORDINATE TRANSFORM      │
│ (CoordinateSystem.applyTransform)       │
└────────┬────────────────────────────────┘
         │
         │ TRANSFORM:
         │   ctx.setTransform(1, 0, 0, 1, 0, 0) // Reset
         │   ctx.translate(panX + centerX, panY + centerY)
         │   ctx.scale(zoom, zoom)
         │   ctx.translate(-centerX, -centerY)
         │
         ▼
┌─────────────────────────────────────────┐
│ STEP 4: RENDER BACKGROUND               │
│ (Checkerboard pattern)                  │
└────────┬────────────────────────────────┘
         │
         │ DRAW: Checkerboard for transparency
         │
         ▼
┌─────────────────────────────────────────┐
│ STEP 5: RENDER LAYERS                   │
│ (Loop through visible layers)           │
└────────┬────────────────────────────────┘
         │
         │ FOR EACH visible layer:
         │
         ├──→ Get layer imageData
         │    │
         │    ├──→ Apply modifiers (if any)
         │    │    │
         │    │    └──→ ModifierStack.applyStack()
         │    │
         │    ├──→ Apply layer transform
         │    │    │
         │    │    └──→ ctx.save()
         │    │         ctx.translate(bounds.x, bounds.y)
         │    │         ctx.rotate(rotation)
         │    │         ctx.scale(scale)
         │    │
         │    ├──→ Apply layer opacity
         │    │    │
         │    │    └──→ ctx.globalAlpha = layer.opacity
         │    │
         │    ├──→ Apply blend mode
         │    │    │
         │    │    └──→ ctx.globalCompositeOperation = layer.blendMode
         │    │
         │    ├──→ Draw imageData to canvas
         │    │    │
         │    │    └──→ ctx.putImageData(imageData, 0, 0)
         │    │
         │    └──→ ctx.restore()
         │
         ▼
┌─────────────────────────────────────────┐
│ STEP 6: RENDER SELECTION                │
│ (Marching ants)                         │
└────────┬────────────────────────────────┘
         │
         │ DRAW: Animated selection border
         │
         ▼
┌─────────────────────────────────────────┐
│ STEP 7: RENDER UI OVERLAYS              │
│ (Grid, guides, handles)                 │
└────────┬────────────────────────────────┘
         │
         │ DRAW: Grid, transform handles, etc.
         │
         ▼
┌─────────────────────────────────────────┐
│ STEP 8: MEASURE FRAME TIME              │
│ (Performance tracking)                  │
└────────┬────────────────────────────────┘
         │
         │ MEASURE:
         │   frameTime = performance.now() - frameStart
         │   fps = 1000 / frameTime
         │
         ▼
┌─────────────────────────────────────────┐
│ STEP 9: SCHEDULE NEXT FRAME             │
│ (requestAnimationFrame)                 │
└────────┬────────────────────────────────┘
         │
         ▼
    LOOP CONTINUES
```

---

## 🎯 **8. WORKER COMMUNICATION FLOW**

### **Main Thread ↔ Worker:**

```
┌─────────────────┐
│  MAIN THREAD    │
└────────┬────────┘
         │
         ├─── Create Worker
         │    new Worker('magicWand.worker.ts')
         │
         ▼
┌─────────────────────────────────────────┐
│ SEND MESSAGE TO WORKER                  │
└────────┬────────────────────────────────┘
         │
         │ MESSAGE:
         │   worker.postMessage({
         │     type: 'segment',
         │     id: requestId,
         │     imageData: {
         │       data: imageData.data.buffer, // Transfer
         │       width: imageData.width,
         │       height: imageData.height
         │     },
         │     startPoint: {x, y},
         │     options: {tolerance, ...}
         │   }, [imageData.data.buffer]) // Transferable
         │
         │ NOTE: Use transferable for zero-copy
         │
         ▼
┌─────────────────┐
│  WORKER THREAD  │
└────────┬────────┘
         │
         ├─── Receive message
         │
         ▼
┌─────────────────────────────────────────┐
│ RECONSTRUCT IMAGEDATA                   │
└────────┬────────────────────────────────┘
         │
         │ PROCESS:
         │   imageData = new ImageData(
         │     new Uint8ClampedArray(data),
         │     width,
         │     height
         │   )
         │
         ▼
┌─────────────────────────────────────────┐
│ PERFORM SEGMENTATION                    │
│ (Flood fill algorithm)                  │
└────────┬────────────────────────────────┘
         │
         │ OUTPUT: {mask, bounds, pixels}
         │
         ▼
┌─────────────────────────────────────────┐
│ SEND RESULT BACK TO MAIN                │
└────────┬────────────────────────────────┘
         │
         │ MESSAGE:
         │   self.postMessage({
         │     type: 'segment-result',
         │     id: requestId,
         │     mask: mask.buffer, // Transfer
         │     bounds: bounds,
         │     pixels: pixels,
         │     metadata: {...}
         │   }, [mask.buffer]) // Transferable
         │
         ▼
┌─────────────────┐
│  MAIN THREAD    │
└────────┬────────┘
         │
         ├─── Receive message
         │
         ▼
┌─────────────────────────────────────────┐
│ PROCESS RESULT                          │
│ (Update UI)                             │
└─────────────────────────────────────────┘
```

---

## 🎨 **8. LAYER COMPOSITING FLOW**

### **Multi-Layer to Single ImageData:**

```
┌─────────────────┐
│  LAYER STACK    │
│  (N layers)     │
└────────┬────────┘
         │
         ├─── Filter to visible layers only
         │
         ▼
┌─────────────────────────────────────────┐
│ STEP 1: CREATE TEMP CANVAS              │
│ (CANVAS_WIDTH × CANVAS_HEIGHT)          │
└────────┬────────────────────────────────┘
         │
         │ CREATE:
         │   tempCanvas = new OffscreenCanvas(
         │     CANVAS_WIDTH,
         │     CANVAS_HEIGHT
         │   )
         │   tempCtx = tempCanvas.getContext('2d')
         │
         ▼
┌─────────────────────────────────────────┐
│ STEP 2: LOOP THROUGH LAYERS             │
│ (Bottom to top)                         │
└────────┬────────────────────────────────┘
         │
         │ FOR EACH layer (bottom to top):
         │
         ├──→ STEP 2a: CONVERT COORDINATES
         │    │
         │    │ CONVERT:
         │    │   // Layer bounds are center-based
         │    │   topLeftX = layer.bounds.x + CANVAS_WIDTH / 2
         │    │   topLeftY = layer.bounds.y + CANVAS_HEIGHT / 2
         │    │
         │    ▼
         │    STEP 2b: APPLY LAYER TRANSFORM
         │    │
         │    │ TRANSFORM:
         │    │   tempCtx.save()
         │    │   tempCtx.translate(topLeftX + width/2, topLeftY + height/2)
         │    │   tempCtx.rotate(layer.transform.rotation)
         │    │   tempCtx.scale(layer.transform.sx, layer.transform.sy)
         │    │   tempCtx.translate(-width/2, -height/2)
         │    │
         │    ▼
         │    STEP 2c: APPLY LAYER MODIFIERS
         │    │
         │    │ PROCESS:
         │    │   modifiedImageData = layer.modifiers.reduce(
         │    │     (imgData, modifier) => applyModifier(imgData, modifier),
         │    │     layer.imageData
         │    │   )
         │    │
         │    ▼
         │    STEP 2d: APPLY OPACITY & BLEND MODE
         │    │
         │    │ SET:
         │    │   tempCtx.globalAlpha = layer.opacity
         │    │   tempCtx.globalCompositeOperation = layer.blendMode
         │    │
         │    ▼
         │    STEP 2e: DRAW LAYER
         │    │
         │    │ DRAW:
         │    │   tempCtx.putImageData(modifiedImageData, 0, 0)
         │    │
         │    └──→ tempCtx.restore()
         │
         ▼
┌─────────────────────────────────────────┐
│ STEP 3: EXTRACT COMPOSITE IMAGEDATA     │
│ (tempCtx.getImageData)                  │
└────────┬────────────────────────────────┘
         │
         │ EXTRACT:
         │   composite = tempCtx.getImageData(
         │     0, 0,
         │     CANVAS_WIDTH,
         │     CANVAS_HEIGHT
         │   )
         │
         ▼
┌─────────────────────────────────────────┐
│ STEP 4: VALIDATE DIMENSIONS             │
│ (DimensionValidator.validate)           │
└────────┬────────────────────────────────┘
         │
         │ VALIDATE:
         │   assert(composite.width === CANVAS_WIDTH)
         │   assert(composite.height === CANVAS_HEIGHT)
         │
         ▼
┌─────────────────┐
│ RETURN COMPOSITE│
│ IMAGEDATA       │
└─────────────────┘
```

---

## 🎯 **9. DATA TRANSFORMATION RULES**

### **Immutability Rules:**

```typescript
/**
 * RULE 1: Never mutate input data
 */
// ❌ BAD: Mutates input
function applyBrightness(imageData: ImageData, brightness: number): ImageData {
  for (let i = 0; i < imageData.data.length; i += 4) {
    imageData.data[i] += brightness; // MUTATES INPUT!
  }
  return imageData;
}

// ✅ GOOD: Creates new ImageData
function applyBrightness(imageData: ImageData, brightness: number): ImageData {
  const result = new ImageData(
    new Uint8ClampedArray(imageData.data), // COPY
    imageData.width,
    imageData.height
  );
  for (let i = 0; i < result.data.length; i += 4) {
    result.data[i] = Math.min(255, result.data[i] + brightness);
  }
  return result;
}
```

### **Coordinate Transformation Rules:**

```typescript
/**
 * RULE 2: Always go through CoordinateSystem
 */
// ❌ BAD: Inline coordinate math
function handleClick(screenX: number, screenY: number) {
  const worldX = (screenX - canvas.width/2 - panX) / zoom; // INLINE MATH!
  const worldY = (screenY - canvas.height/2 - panY) / zoom;
}

// ✅ GOOD: Use CoordinateSystem
function handleClick(screenX: number, screenY: number) {
  const worldPoint = coordSystem.screenToWorld(screenX, screenY);
  // Use worldPoint.x, worldPoint.y
}
```

### **ImageData Handling Rules:**

```typescript
/**
 * RULE 3: Validate ImageData dimensions
 */
// ❌ BAD: Assume dimensions are correct
function processImageData(imageData: ImageData) {
  // Assumes imageData.width === CANVAS_WIDTH (might not be!)
  for (let y = 0; y < CANVAS_HEIGHT; y++) {
    for (let x = 0; x < CANVAS_WIDTH; x++) {
      const index = (y * imageData.width + x) * 4; // MIGHT BE WRONG!
      // ...
    }
  }
}

// ✅ GOOD: Validate dimensions first
function processImageData(imageData: ImageData) {
  const validation = validateImageDataDimensions(
    imageData,
    CANVAS_WIDTH,
    CANVAS_HEIGHT
  );
  
  if (!validation.valid) {
    throw new Error(`Invalid ImageData: ${validation.errors.join(', ')}`);
  }
  
  // Now safe to process
  for (let y = 0; y < imageData.height; y++) {
    for (let x = 0; x < imageData.width; x++) {
      const index = (y * imageData.width + x) * 4;
      // ...
    }
  }
}
```

---

## 🎯 **10. PERFORMANCE OPTIMIZATION FLOWS**

### **Memoization Pattern:**

```typescript
/**
 * Memoize expensive operations
 */
class PerformanceOptimizedCanvas {
  private compositeCache: Map<string, ImageData> = new Map();

  /**
   * Get composite with caching
   */
  getComposite(layers: Layer[]): ImageData {
    // Create cache key
    const cacheKey = this.createCacheKey(layers);
    
    // Check cache
    const cached = this.compositeCache.get(cacheKey);
    if (cached) {
      return cached;
    }
    
    // Compute composite
    const composite = compositeLayers(layers);
    
    // Store in cache
    this.compositeCache.set(cacheKey, composite);
    
    // Limit cache size
    if (this.compositeCache.size > 10) {
      const firstKey = this.compositeCache.keys().next().value;
      this.compositeCache.delete(firstKey);
    }
    
    return composite;
  }

  /**
   * Create cache key from layers
   */
  private createCacheKey(layers: Layer[]): string {
    return layers
      .filter(l => l.visible)
      .map(l => `${l.id}:${l.modifiedAt}:${l.opacity}`)
      .join('|');
  }

  /**
   * Invalidate cache when layers change
   */
  invalidateCache(layerId?: string): void {
    if (layerId) {
      // Invalidate entries containing this layer
      for (const [key, _] of this.compositeCache) {
        if (key.includes(layerId)) {
          this.compositeCache.delete(key);
        }
      }
    } else {
      // Clear entire cache
      this.compositeCache.clear();
    }
  }
}
```

### **Debounce/Throttle Pattern:**

```typescript
/**
 * Throttle expensive operations
 */
class ThrottledOperations {
  private lastTime: number = 0;
  private timeoutId: number | null = null;

  /**
   * Throttle: Limit execution frequency
   */
  throttle<T extends (...args: any[]) => void>(
    fn: T,
    delay: number
  ): T {
    return ((...args: any[]) => {
      const now = performance.now();
      if (now - this.lastTime >= delay) {
        this.lastTime = now;
        fn(...args);
      }
    }) as T;
  }

  /**
   * Debounce: Delay execution until quiet period
   */
  debounce<T extends (...args: any[]) => void>(
    fn: T,
    delay: number
  ): T {
    return ((...args: any[]) => {
      if (this.timeoutId !== null) {
        clearTimeout(this.timeoutId);
      }
      this.timeoutId = window.setTimeout(() => {
        fn(...args);
      }, delay);
    }) as T;
  }
}

// Usage
const throttled = new ThrottledOperations();

const updateHoverPreview = throttled.throttle(
  (imageData: ImageData, point: Point) => {
    // This will only run every 16ms (60fps)
    performSegmentation(imageData, point);
  },
  16 // 60fps
);

const saveProject = throttled.debounce(
  (project: Project) => {
    // This will only run 500ms after last change
    saveProjectToBackend(project);
  },
  500
);
```

---

## 🎯 **SUCCESS CRITERIA**

✅ All data flows documented
✅ All transformations mapped
✅ All performance patterns documented
✅ All validation rules specified
✅ All caching strategies defined
✅ All worker communication flows mapped

---

**Next:** Create component hierarchy and dependency graphs?
