/**
 * ZeroLatencyPreview - Instant visual feedback before expansion begins
 * 
 * V6 ORGANIC FLOW: 0ms perceived latency via instant seed highlight
 */

import type { Point, LayerBounds } from '../types';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../constants';

export class ZeroLatencyPreview {
  private seedHighlightColor = 'rgba(100, 200, 255, 0.8)';
  private waveColor = 'rgba(100, 200, 100, 0.4)';
  private borderColor = 'rgba(100, 200, 100, 0.8)';

  /**
   * Draw instant seed highlight (3x3 patch) - 0ms perceived latency
   */
  drawInstantSeed(
    ctx: CanvasRenderingContext2D,
    seedPoint: Point,
    zoom: number = 1
  ): void {
    const size = Math.max(3, Math.floor(5 / zoom));
    const halfSize = Math.floor(size / 2);
    
    ctx.save();
    ctx.fillStyle = this.seedHighlightColor;
    ctx.fillRect(
      seedPoint.x - halfSize,
      seedPoint.y - halfSize,
      size,
      size
    );
    ctx.restore();
  }

  /**
   * Draw expanding wave preview from mask
   */
  drawWave(
    ctx: CanvasRenderingContext2D,
    mask: Uint8ClampedArray,
    bounds: LayerBounds,
    width: number,
    height: number
  ): void {
    // Create ImageData for the visible portion
    const imageData = ctx.createImageData(width, height);
    const pixels = imageData.data;
    
    // Parse wave color
    const r = 100, g = 200, b = 100, a = 102; // rgba(100, 200, 100, 0.4)
    
    for (let i = 0; i < mask.length; i++) {
      if (mask[i] > 0) {
        const idx = i * 4;
        pixels[idx] = r;
        pixels[idx + 1] = g;
        pixels[idx + 2] = b;
        pixels[idx + 3] = a;
      }
    }
    
    ctx.putImageData(imageData, 0, 0);
  }

  /**
   * Draw wave with marching ants border
   */
  drawWaveWithBorder(
    ctx: CanvasRenderingContext2D,
    mask: Uint8ClampedArray,
    width: number,
    height: number,
    timestamp: number
  ): void {
    const imageData = ctx.createImageData(width, height);
    const pixels = imageData.data;
    
    // Fill color for accepted pixels
    const fillR = 100, fillG = 200, fillB = 100, fillA = 80;
    // Border color (marching ants)
    const borderR = 255, borderG = 255, borderB = 255;
    
    // Marching ants offset
    const antOffset = Math.floor(timestamp / 100) % 8;
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = y * width + x;
        
        if (mask[i] > 0) {
          const idx = i * 4;
          
          // Check if this is a border pixel (has non-selected neighbor)
          const isLeft = x > 0 && mask[i - 1] === 0;
          const isRight = x < width - 1 && mask[i + 1] === 0;
          const isTop = y > 0 && mask[i - width] === 0;
          const isBottom = y < height - 1 && mask[i + width] === 0;
          
          if (isLeft || isRight || isTop || isBottom) {
            // Border pixel - marching ants pattern
            const antPhase = ((x + y + antOffset) % 8) < 4;
            if (antPhase) {
              pixels[idx] = borderR;
              pixels[idx + 1] = borderG;
              pixels[idx + 2] = borderB;
              pixels[idx + 3] = 200;
            } else {
              pixels[idx] = 0;
              pixels[idx + 1] = 0;
              pixels[idx + 2] = 0;
              pixels[idx + 3] = 200;
            }
          } else {
            // Interior pixel - fill color
            pixels[idx] = fillR;
            pixels[idx + 1] = fillG;
            pixels[idx + 2] = fillB;
            pixels[idx + 3] = fillA;
          }
        }
      }
    }
    
    ctx.putImageData(imageData, 0, 0);
  }

  /**
   * Calculate minimal dirty rect for efficient redraw
   */
  calculateDirtyRect(
    mask: Uint8ClampedArray,
    bounds: LayerBounds
  ): LayerBounds {
    return bounds;
  }
}
