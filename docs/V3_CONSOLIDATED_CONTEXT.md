# V3 Image Editor - Consolidated Context

**Date:** 2025-01-27  
**Status:** ✅ **CONSOLIDATED** - Single source of truth for V3 team  
**Purpose:** Complete context for all V3 specialists working together  

---

## 🎯 **EXECUTIVE SUMMARY**

### **What is V3?**
V3 is a complete rebuild of the Lucid image editor canvas with **guaranteed 0px alignment**, solving 160+ failures from V2.

### **Current Status:**
- ✅ **Planning:** Complete (9 planning docs, ~43,000 words)
- ✅ **Core Implementation:** 15 files exist (~2,500 lines)
- 🚧 **Tests:** Only CoordinateSystem has tests (needs expansion)
- ❌ **V6 Organic Flow:** Not implemented (Phase 2B)
- 🚧 **Production Standards:** Needs completion

### **Goal:**
Build V3 to full production standards with comprehensive tests, V6 preview system, and production-ready code.

---

## 📚 **PLANNING DOCUMENTATION (9 Documents)**

### **1. Master Plan** (`V3_FULL_IMAGE_EDITOR_MASTER_PLAN.md`)
- Complete overview (723 lines)
- 5 process maps (runtime flow)
- 8-phase implementation roadmap
- Philosophy: Preserve V2, build V3 fresh, perfect before building

### **2. State Machines** (`V3_STATE_MACHINES.md`)
- 28 state machines (Canvas, Tool, Layer, Selection × 7 states)
- State transitions, entry/exit actions, guards
- Implementation base class

### **3. Integration Specs** (`V3_INTEGRATION_SPECIFICATIONS.md`)
- Component communication protocols
- Canvas ↔ Panel, Canvas ↔ Tool, Canvas ↔ Context
- Event bus architecture
- React context hierarchy

### **4. API Contracts** (`V3_API_CONTRACTS.md`)
- 100+ TypeScript interfaces
- Core types, Layer, Modifier, Tool, Selection, Project, Canvas
- V6 Preview System interfaces
- Validation & runtime checks

### **5. Data Flow Diagrams** (`V3_DATA_FLOW_DIAGRAMS.md`)
- 8 complete data flow pipelines
- ImageData, coordinate, modifier, selection, history, render, worker, compositing
- V6 Preview Flow (Ring BFS expansion)

### **6. Component Architecture** (`V3_COMPONENT_ARCHITECTURE.md`)
- Complete component hierarchy
- Module dependency graphs
- Critical paths
- Component ownership

### **7. Testing Specifications** (`V3_TESTING_SPECIFICATIONS.md`)
- Unit/integration/E2E tests
- Visual regression, performance, cross-browser
- Quality gates
- CI/CD pipeline

### **8. Implementation Checklist** (`V3_IMPLEMENTATION_CHECKLIST.md`)
- 5-phase build plan (11 days)
- Phase 1: Foundation (Days 1-2)
- Phase 2: Interaction (Days 3-4)
- Phase 2B: V6 Organic Flow (Days 5-6) ⭐
- Phase 3: Canvas Component (Days 7-8)
- Phase 4: Integration (Days 9-10)
- Phase 5: Validation (Day 11)

### **9. Planning Index** (`V3_PLANNING_DOCUMENTATION_INDEX.md`)
- Central index for all planning docs
- Reading guides
- Quick reference

---

## 🏗️ **CURRENT IMPLEMENTATION STATUS**

### **✅ Files Already Created (15 files):**

1. ✅ `constants.ts` - Canvas constants (CANVAS_WIDTH, CANVAS_HEIGHT, etc.)
2. ✅ `types.ts` - Core types (Point, Rectangle, Layer, etc.)
3. ✅ `DimensionValidator.ts` - Dimension validation
4. ✅ `CoordinateSystem.ts` - Coordinate conversion system
5. ✅ `compositeLayers.ts` - Layer compositing
6. ✅ `layerAdapter.ts` - Layer adaptation for rendering
7. ✅ `RenderPipeline.ts` - Rendering pipeline
8. ✅ `PanZoomHandler.ts` - Pan/zoom interaction
9. ✅ `V3MagicWandHandler.ts` - Magic wand tool handler
10. ✅ `MagicWandBridge.ts` - Bridge to workflow
11. ✅ `CanvasV3.tsx` - Main canvas component
12. ✅ `CanvasV3Wrapper.tsx` - Canvas wrapper
13. ✅ `magicWand.worker.ts` - Worker thread for segmentation
14. ✅ `useCanvasStateSync.ts` - State synchronization hook
15. ✅ `__tests__/CoordinateSystem.test.ts` - Coordinate system tests

### **❌ Missing/Incomplete:**

1. ❌ **Comprehensive test coverage** (only CoordinateSystem has tests)
2. ❌ **V6 Organic Flow** (PreviewWaveEngine, BreathingTolerance, etc.)
3. ❌ **Production-ready error handling**
4. ❌ **Performance optimizations**
5. ❌ **Integration tests**
6. ❌ **E2E tests**
7. ❌ **NL tags** on all functions (per protocol)

---

## 🎯 **V3 CORE ARCHITECTURE**

### **Golden Path Rules (16 Rules):**

1. **World Space is Truth** - All persistent data in World Space
2. **All Conversions Go Through CoordinateSystem** - No inline math
3. **CoordinateSystem is Matrix-Based** - DOMMatrix (future-proof)
4. **Inline Pan/Zoom Formulas Banned** - Use CoordinateSystem only
5. **No Magic Numbers** - All constants centralized
6. **Render Loop is rAF + Refs** - Not React state
7. **ImageData Entry Points Must Be Dimension-Validated** - Fail-fast
8. **Hover Uses TTL Caching** - Performance optimization
9. **UI/Grid/Handles Render with Integer Alignment** - Crisp rendering
10. **Heavy Pixel Algorithms Are Iterative and Worker-Compatible** - No stack overflow
11. **Three-Space Taxonomy Must Be Named** - Explicit coordinate spaces
12. **High-DPI Init is Mandatory** - Context scaling required
13. **Coordinate Conversions Before Await** - Prevent stale state
14. **Referenced State for Critical Values** - useRef for immediate access
15. **World Space Compositing** - Consistent ImageData generation
16. **High-Cost Operations Must Expose Perceptual Immediacy** - Progressive preview (V6)

### **Coordinate System:**
- **World Space:** Top-left origin (0,0), range [0, CANVAS_WIDTH] × [0, CANVAS_HEIGHT]
- **Screen Space:** Raw pointer coordinates (clientX, clientY)
- **Image Space:** = World Space in V3 (both top-left origin)
- **worldToImage:** Identity function (no conversion needed)

### **Key Innovations:**
1. **Single Unified Coordinate System** - Top-left everywhere
2. **Fixed Canvas Dimensions** - No dynamic sizing
3. **Correct Compositing** - No fallback errors
4. **Synchronous Conversions** - Before any await
5. **Mathematical Proof** - 0px alignment guaranteed

---

## 🌊 **V6 ORGANIC FLOW SPECIFICATION**

### **Core Concept:**
Turn compute into animation - Make latency a narrative, not a problem.

### **Two Phases:**
1. **Preview Phase (feel-first)** - Progressive expanding wave (4-8ms/frame)
2. **Commit Phase (truth-first)** - Worker does full segmentation

### **Key Features:**
- **Ring BFS Algorithm** - Natural wave expansion (not heap-based)
- **Time Budgeting** - 4-8ms per frame (respects 60fps)
- **3-State Pixel Tracking** - UNSEEN | ACCEPTED | REJECTED
- **Breathing Tolerance** - Frontier-resume model (smooth expansion)
- **Request Cancellation** - Request ID tracking (no visual glitches)
- **Zero-Latency Illusion** - Instant seed highlight (0ms perceived latency)

### **Files to Create:**
1. `preview/PreviewWaveEngine.ts` - Ring BFS algorithm
2. `preview/BreathingTolerance.ts` - Frontier-resume tolerance
3. `preview/RequestCancellation.ts` - Request ID model
4. `preview/ZeroLatencyPreview.ts` - Instant seed highlight

### **Integration:**
- Uses V3 CoordinateSystem
- Uses V3 compositeLayers
- Draws to V3 interaction canvas
- Works with V3 worker commit

---

## 📋 **IMPLEMENTATION CHECKLIST STATUS**

### **Phase 1: Foundation (Days 1-2)**
- [x] 1.1 Constants ✅
- [x] 1.2 Types ✅
- [x] 1.3 DimensionValidator ✅
- [x] 1.4 CoordinateSystem ✅
- [ ] 1.5 CoordinateSystem tests (partial - needs expansion)
- [x] 1.6 compositeLayers ✅
- [ ] 1.7 compositeLayers tests ❌
- [x] 1.8 layerAdapter ✅
- [x] 1.9 RenderPipeline ✅
- [ ] 1.10 RenderPipeline tests ❌

### **Phase 2: Interaction (Days 3-4)**
- [x] 2.1 PanZoomHandler ✅
- [ ] 2.2 PanZoomHandler tests ❌
- [x] 2.3 magicWand.worker.ts ✅
- [ ] 2.4 Worker tests ❌
- [x] 2.5 V3MagicWandHandler ✅
- [ ] 2.6 Handler tests ❌
- [x] 2.7 MagicWandBridge ✅
- [ ] 2.8 Bridge tests ❌

### **Phase 2B: V6 Organic Flow (Days 5-6)** ⭐
- [ ] 2B.1 PreviewWaveEngine ❌
- [ ] 2B.2 PreviewWaveEngine tests ❌
- [ ] 2B.3 BreathingTolerance ❌
- [ ] 2B.4 BreathingTolerance tests ❌
- [ ] 2B.5 RequestCancellation ❌
- [ ] 2B.6 ZeroLatencyPreview ❌
- [ ] 2B.7 Cancellation & preview tests ❌
- [ ] 2B.8 V6 Integration ❌
- [ ] 2B.9 CanvasV3 V6 rendering ❌
- [ ] 2B.10 V6 Integration tests ❌

### **Phase 3: Canvas Component (Days 7-8)**
- [x] CanvasV3.tsx exists ✅
- [ ] Integration tests ❌
- [ ] E2E tests ❌

### **Phase 4: Integration (Days 9-10)**
- [ ] ImagesPage integration ❌
- [ ] Full system tests ❌

### **Phase 5: Validation (Day 11)**
- [ ] Final validation ❌
- [ ] User acceptance ❌

---

## 🗺️ **SYSTEM MAPS & DOCUMENTATION**

### **V3 System Maps (8 documents):**
1. `V3_CANVAS_COMPLETE_SPECIFICATION.md` - Complete spec (9,179 lines)
2. `V3_CANVAS_COORDINATE_SYSTEM_MAP.json5` - Coordinate mapping
3. `V3_CANVAS_COMPLETE_SYSTEM_MAP.md` - Hierarchical map
4. `V3_CANVAS_SYSTEM_MAP_VALIDATION_PROTOCOL.md` - Validation
5. `V3_CANVAS_SYSTEM_MAP.json5` - Structure
6. `V3_CANVAS_MASTER_INDEX.md` - Master index (1,615 lines)
7. `V3_CANVAS_FILES_INDEX.md` - File index (19 files)
8. `V3_CANVAS_MONOLITH.md` - Complete code (4,574 lines)

### **V2 Analysis (13 documents):**
- Complete V2 failure analysis
- 20+ distinct mathematical errors identified
- V2 → V3 migration mapping

### **Validation (5 documents):**
- Composer AI review
- Opus 4.5 review
- O3 Pro review
- Exact misalignment analysis (mathematical proof)
- Complete explanation

---

## 🎯 **KEY TECHNICAL CONCEPTS**

### **Coordinate System:**
- **Screen → World:** `screenToWorld(screenX, screenY)` via CoordinateSystem
- **World → Image:** Identity function (no conversion)
- **World → Screen:** `worldToScreen(worldX, worldY)` via CoordinateSystem

### **Compositing:**
- **Function:** `compositeLayers(layers)` → World Space ImageData
- **Dimensions:** Always CANVAS_WIDTH × CANVAS_HEIGHT
- **Coordinate Conversion:** Center-based → top-left (for existing layers)

### **Rendering:**
- **Pipeline:** RenderPipeline (RAF-driven, 60fps)
- **Layer Cache:** OffscreenCanvas for performance
- **Dirty Flags:** Skip unchanged layers

### **Magic Wand:**
- **Hover:** Worker-based preview (throttled)
- **Click:** Worker-based full segmentation
- **V6 Preview:** Progressive wave expansion (Ring BFS)

---

## 🚀 **IMMEDIATE NEXT STEPS**

### **Priority 1: Complete Foundation Tests**
- Expand CoordinateSystem tests (100+ cases)
- Create compositeLayers tests
- Create RenderPipeline tests
- Create DimensionValidator tests

### **Priority 2: Implement V6 Organic Flow**
- Create PreviewWaveEngine (Ring BFS)
- Create BreathingTolerance (frontier-resume)
- Create RequestCancellation (request ID)
- Create ZeroLatencyPreview (seed highlight)
- Integrate into V3MagicWandHandler

### **Priority 3: Complete Interaction Tests**
- PanZoomHandler tests
- Worker tests
- Handler tests
- Bridge tests

### **Priority 4: Integration & Validation**
- ImagesPage integration
- E2E tests
- Performance testing
- User acceptance

---

## 📊 **STATISTICS**

### **Planning:**
- **Documents:** 9 planning docs
- **Lines:** ~6,900 lines
- **Words:** ~47,000 words
- **Status:** Complete ✅

### **Implementation:**
- **Files:** 15 core files
- **Lines:** ~2,500 lines
- **Tests:** 1 test file (needs expansion)
- **Status:** Foundation complete, tests & V6 needed

### **System Maps:**
- **Documents:** 21 system maps
- **Lines:** ~68,000 lines
- **Status:** Complete ✅

---

## 🎯 **TEAM COORDINATION**

### **MCP Tools for Team:**
- `store_memory` - Store insights (tagged with agent name)
- `retrieve_memory` - Retrieve context
- `send_ai_message` - Team communication
- `get_ai_messages` - Read messages
- `update_goal_progress` - Track progress (V3-IMAGE-EDITOR)
- `add_timeline_entry` - Track milestones
- `track_confidence` - Track confidence (Veritas)
- `validate_tags` - NL tag validation (Sentinel)
- `create_plan` - Execution plans (Nexus)

### **Shared Goal:**
- **Goal ID:** V3-IMAGE-EDITOR
- **Status:** in_progress
- **Progress:** 15% (team formation complete)
- **Target:** 100% (production-ready)

---

## 📚 **QUICK REFERENCE**

### **Need to understand...**
- **"What is V3?"** → `V3_EXECUTIVE_SUMMARY_COMPLETE.md`
- **"How does V3 work?"** → `V3_FULL_IMAGE_EDITOR_MASTER_PLAN.md` (process maps)
- **"What code exists?"** → `V3_CANVAS_MONOLITH.md`
- **"Why did V2 fail?"** → `V3_CANVAS_EXACT_MISALIGNMENT_ANALYSIS.md`
- **"How to build V3?"** → `V3_IMPLEMENTATION_CHECKLIST.md`
- **"What are the types?"** → `V3_API_CONTRACTS.md`
- **"What is V6?"** → `V6_ORGANIC_FLOW_SPECIFICATION.md`
- **"Team structure?"** → `V3_TEAM_STRUCTURE.md`

---

**Status:** ✅ **CONSOLIDATED** - Ready for team coordination  
**Next:** Specialists activate, begin implementation
