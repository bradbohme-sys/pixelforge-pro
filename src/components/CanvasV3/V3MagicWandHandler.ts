/**
 * V3MagicWandHandler - Magic Wand Tool with Worker Offloading
 */

import { CoordinateSystem } from './CoordinateSystem';
import { HOVER_THROTTLE_MS, CANVAS_WIDTH, CANVAS_HEIGHT } from './constants';
import type { SelectionMask, HoverPreview, MagicWandRequest, MagicWandResponse, Layer, Point } from './types';

export class V3MagicWandHandler {
  private coordSystem: CoordinateSystem;
  private worker: Worker;
  private isTerminated: boolean = false;
  
  private layers: Layer[] = [];
  private imageCache: Map<string, HTMLImageElement> = new Map();
  
  private isWorkerBusy: boolean = false;
  private currentRequestId: number = 0;
  private lastRequestTime: number = 0;
  
  private currentMask: SelectionMask | null = null;
  private hoverPreview: HoverPreview | null = null;
  
  tolerance: number = 32;
  contiguous: boolean = true;
  
  private onSelectionChange: ((mask: SelectionMask | null) => void) | null = null;
  private onHoverPreviewChange: ((preview: HoverPreview | null) => void) | null = null;
  private onError: ((message: string) => void) | null = null;

  constructor(
    coordSystem: CoordinateSystem,
    layers: Layer[] = [],
    imageCache: Map<string, HTMLImageElement> = new Map()
  ) {
    this.coordSystem = coordSystem;
    this.layers = layers;
    this.imageCache = imageCache;
    
    this.worker = new Worker(
      new URL('./workers/magicWand.worker.ts', import.meta.url),
      { type: 'module' }
    );
    
    this.worker.onmessage = this.handleWorkerMessage;
    this.worker.onerror = this.handleWorkerError;
  }

  terminate(): void {
    if (!this.isTerminated) {
      this.worker.terminate();
      this.isTerminated = true;
    }
  }

  setOnSelectionChange(callback: (mask: SelectionMask | null) => void): void {
    this.onSelectionChange = callback;
  }

  setOnHoverPreviewChange(callback: (preview: HoverPreview | null) => void): void {
    this.onHoverPreviewChange = callback;
  }

  setOnError(callback: (message: string) => void): void {
    this.onError = callback;
  }

  updateLayers(layers: Layer[], imageCache: Map<string, HTMLImageElement>): void {
    this.layers = layers;
    this.imageCache = imageCache;
  }

  getCompositeImageData(): ImageData | null {
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = CANVAS_WIDTH;
    tempCanvas.height = CANVAS_HEIGHT;
    const ctx = tempCanvas.getContext('2d');
    
    if (!ctx) return null;
    
    // Fill with white background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    
    for (const layer of this.layers) {
      if (!layer.visible || !layer.image) continue;
      
      try {
        ctx.save();
        ctx.globalAlpha = layer.opacity;
        ctx.globalCompositeOperation = layer.blendMode || 'source-over';
        
        const { x, y, width, height } = layer.bounds;
        const transform = layer.transform || { rotation: 0, scaleX: 1, scaleY: 1 };
        
        ctx.translate(x + width / 2, y + height / 2);
        ctx.rotate((transform.rotation * Math.PI) / 180);
        ctx.scale(transform.scaleX, transform.scaleY);
        ctx.translate(-(width / 2), -(height / 2));
        
        ctx.drawImage(layer.image, 0, 0, width, height);
        ctx.restore();
      } catch {
        ctx.restore();
      }
    }
    
    try {
      return ctx.getImageData(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    } catch {
      return null;
    }
  }

  async handleClick(screenX: number, screenY: number): Promise<void> {
    if (this.isTerminated) return;
    
    const worldPoint = this.coordSystem.screenToWorld(screenX, screenY);
    
    if (!this.coordSystem.isInBounds(worldPoint.x, worldPoint.y)) {
      return;
    }
    
    const imageData = this.getCompositeImageData();
    if (!imageData) {
      this.onError?.('Cannot segment: Failed to get image data');
      return;
    }
    
    this.sendToWorker(imageData, worldPoint.x, worldPoint.y);
  }

  handleHover(screenX: number, screenY: number): void {
    if (this.isTerminated) return;
    
    const now = Date.now();
    if (now - this.lastRequestTime < HOVER_THROTTLE_MS) {
      return;
    }
    this.lastRequestTime = now;
    
    const worldPoint = this.coordSystem.screenToWorld(screenX, screenY);
    
    if (!this.coordSystem.isInBounds(worldPoint.x, worldPoint.y)) {
      this.hoverPreview = null;
      this.onHoverPreviewChange?.(null);
      return;
    }
    
    if (this.isWorkerBusy) {
      return;
    }
    
    const imageData = this.getCompositeImageData();
    if (!imageData) {
      return;
    }
    
    this.sendToWorker(imageData, worldPoint.x, worldPoint.y);
  }

  clearHoverPreview(): void {
    this.hoverPreview = null;
    this.onHoverPreviewChange?.(null);
  }

  private sendToWorker(imageData: ImageData, seedX: number, seedY: number): void {
    this.currentRequestId++;
    
    const request: MagicWandRequest = {
      type: 'segment',
      requestId: this.currentRequestId,
      imageData,
      seedX,
      seedY,
      tolerance: this.tolerance,
      contiguous: this.contiguous,
    };
    
    this.isWorkerBusy = true;
    this.worker.postMessage(request, { transfer: [imageData.data.buffer] });
  }

  private handleWorkerMessage = (e: MessageEvent<MagicWandResponse>): void => {
    this.isWorkerBusy = false;
    
    const response = e.data;
    
    if (response.requestId !== this.currentRequestId) {
      return;
    }
    
    if (response.type === 'error') {
      this.onError?.(response.error || 'Unknown error');
      return;
    }
    
    if (!response.mask || !response.bounds) return;
    
    const mask: SelectionMask = {
      data: response.mask,
      width: CANVAS_WIDTH,
      height: CANVAS_HEIGHT,
      bounds: response.bounds,
    };
    
    this.currentMask = mask;
    this.hoverPreview = {
      mask,
      worldPoint: { x: 0, y: 0, __space: 'world' },
      timestamp: Date.now(),
    };
    
    this.onSelectionChange?.(mask);
    this.onHoverPreviewChange?.(this.hoverPreview);
  };

  private handleWorkerError = (error: ErrorEvent): void => {
    this.isWorkerBusy = false;
    console.error('[V3MagicWand] Worker error:', error.message);
    this.onError?.(`Segmentation failed: ${error.message}`);
  };

  getCurrentMask(): SelectionMask | null {
    return this.currentMask;
  }

  clearSelection(): void {
    this.currentMask = null;
    this.onSelectionChange?.(null);
  }
}
