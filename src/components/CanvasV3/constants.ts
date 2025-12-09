/**
 * V3 Canvas Constants
 * 
 * GOLDEN PATH RULE 5: No Magic Numbers
 * All constants centralized here. These are the ONLY places these numbers appear.
 */

// Virtual canvas dimensions (the "document" size)
export const CANVAS_WIDTH = 800;
export const CANVAS_HEIGHT = 600;

// Viewport center (camera's default look-at point)
export const VIEWPORT_CENTER_X = CANVAS_WIDTH / 2;
export const VIEWPORT_CENTER_Y = CANVAS_HEIGHT / 2;

// Colors - using CSS variables for theming
export const WORKSPACE_BG = '#1a1a1f';
export const CANVAS_BG = '#2a2a30';
export const CANVAS_BORDER = '#3a3a42';
export const SELECTION_COLOR = 'rgba(74, 222, 128, 0.35)';
export const HOVER_PREVIEW_COLOR = 'rgba(45, 212, 191, 0.3)';

// High-DPI
export const DPR_CACHE_TTL = 1000;

// Performance
export const HOVER_THROTTLE_MS = 50;
export const RAF_TARGET_FPS = 60;
export const FRAME_BUDGET_MS = 1000 / RAF_TARGET_FPS;

// Zoom constraints
export const ZOOM_MIN = 0.1;
export const ZOOM_MAX = 32;
export const ZOOM_STEP = 0.1;

// Pan constraints (allow 50% off-screen)
export const PAN_CONSTRAINT_RATIO = 0.5;

// Browser zoom check interval
export const BROWSER_ZOOM_CHECK_INTERVAL = 1000;

// Checkerboard pattern for transparency
export const CHECKERBOARD_SIZE = 8;
export const CHECKERBOARD_LIGHT = '#3a3a42';
export const CHECKERBOARD_DARK = '#2a2a30';
