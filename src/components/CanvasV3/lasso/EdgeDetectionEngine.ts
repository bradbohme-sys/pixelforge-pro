/**
 * Edge Detection Engine
 * 
 * Implements multiple edge detection algorithms:
 * - Sobel, Prewitt, Scharr, Roberts (gradient-based)
 * - Laplacian of Gaussian (zero-crossing)
 * - Full Canny pipeline
 */

import type { EdgeMap, EdgeDetectionSettings } from './types';

export class EdgeDetectionEngine {
  private width: number = 0;
  private height: number = 0;
  private grayscale: Float32Array | null = null;
  private edgeMap: EdgeMap | null = null;
  private settings: EdgeDetectionSettings;

  constructor(settings: EdgeDetectionSettings) {
    this.settings = settings;
  }

  updateSettings(settings: Partial<EdgeDetectionSettings>): void {
    this.settings = { ...this.settings, ...settings };
    this.edgeMap = null; // Invalidate cache
  }

  /**
   * Process image data and generate edge map
   */
  processImage(imageData: ImageData): EdgeMap {
    this.width = imageData.width;
    this.height = imageData.height;
    
    // Convert to grayscale
    this.grayscale = this.toGrayscale(imageData);
    
    // Apply Gaussian blur if enabled
    let blurred = this.grayscale;
    if (this.settings.blurRadius > 0) {
      blurred = this.gaussianBlur(this.grayscale, this.settings.blurRadius);
    }
    
    // Apply edge detection based on method
    switch (this.settings.method) {
      case 'sobel':
        this.edgeMap = this.sobelEdge(blurred);
        break;
      case 'prewitt':
        this.edgeMap = this.prewittEdge(blurred);
        break;
      case 'scharr':
        this.edgeMap = this.scharrEdge(blurred);
        break;
      case 'roberts':
        this.edgeMap = this.robertsEdge(blurred);
        break;
      case 'laplacian':
        this.edgeMap = this.laplacianOfGaussian(blurred);
        break;
      case 'canny':
        this.edgeMap = this.cannyEdge(blurred);
        break;
      default:
        this.edgeMap = this.sobelEdge(blurred);
    }
    
    return this.edgeMap;
  }

  /**
   * Get edge strength at a point
   */
  getEdgeStrength(x: number, y: number): number {
    if (!this.edgeMap) return 0;
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    if (ix < 0 || ix >= this.width || iy < 0 || iy >= this.height) return 0;
    return this.edgeMap.magnitude[iy * this.width + ix];
  }

  /**
   * Get gradient direction at a point (radians)
   */
  getGradientDirection(x: number, y: number): number {
    if (!this.edgeMap) return 0;
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    if (ix < 0 || ix >= this.width || iy < 0 || iy >= this.height) return 0;
    return this.edgeMap.direction[iy * this.width + ix];
  }

  /**
   * Calculate edge cost for pathfinding (inverse of edge strength)
   */
  getEdgeCost(x: number, y: number): number {
    const strength = this.getEdgeStrength(x, y);
    // Lower cost for stronger edges (edges are "cheaper" to follow)
    // Sensitivity affects how much edges reduce cost
    const sensitivity = this.settings.sensitivity / 100;
    return 1.0 - (strength * sensitivity);
  }

  /**
   * Get local edge quality (average strength in a radius)
   */
  getLocalEdgeQuality(x: number, y: number, radius: number = 5): number {
    if (!this.edgeMap) return 0;
    
    let sum = 0;
    let count = 0;
    
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (dx * dx + dy * dy <= radius * radius) {
          const strength = this.getEdgeStrength(x + dx, y + dy);
          sum += strength;
          count++;
        }
      }
    }
    
    return count > 0 ? sum / count : 0;
  }

  getEdgeMap(): EdgeMap | null {
    return this.edgeMap;
  }

  // ============================================
  // PRIVATE METHODS
  // ============================================

  private toGrayscale(imageData: ImageData): Float32Array {
    const { data, width, height } = imageData;
    const gray = new Float32Array(width * height);
    
    for (let i = 0; i < width * height; i++) {
      const r = data[i * 4];
      const g = data[i * 4 + 1];
      const b = data[i * 4 + 2];
      // Luminosity method
      gray[i] = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    }
    
    return gray;
  }

  private gaussianBlur(data: Float32Array, sigma: number): Float32Array {
    const kernelSize = Math.ceil(sigma * 3) * 2 + 1;
    const kernel = this.createGaussianKernel(kernelSize, sigma);
    
    // Separable convolution (horizontal then vertical)
    const temp = new Float32Array(data.length);
    const result = new Float32Array(data.length);
    const halfSize = Math.floor(kernelSize / 2);
    
    // Horizontal pass
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        let sum = 0;
        for (let k = -halfSize; k <= halfSize; k++) {
          const sx = Math.min(Math.max(x + k, 0), this.width - 1);
          sum += data[y * this.width + sx] * kernel[k + halfSize];
        }
        temp[y * this.width + x] = sum;
      }
    }
    
    // Vertical pass
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        let sum = 0;
        for (let k = -halfSize; k <= halfSize; k++) {
          const sy = Math.min(Math.max(y + k, 0), this.height - 1);
          sum += temp[sy * this.width + x] * kernel[k + halfSize];
        }
        result[y * this.width + x] = sum;
      }
    }
    
    return result;
  }

  private createGaussianKernel(size: number, sigma: number): Float32Array {
    const kernel = new Float32Array(size);
    const halfSize = Math.floor(size / 2);
    let sum = 0;
    
    for (let i = 0; i < size; i++) {
      const x = i - halfSize;
      kernel[i] = Math.exp(-(x * x) / (2 * sigma * sigma));
      sum += kernel[i];
    }
    
    // Normalize
    for (let i = 0; i < size; i++) {
      kernel[i] /= sum;
    }
    
    return kernel;
  }

  private sobelEdge(data: Float32Array): EdgeMap {
    const Gx = [[-1, 0, 1], [-2, 0, 2], [-1, 0, 1]];
    const Gy = [[-1, -2, -1], [0, 0, 0], [1, 2, 1]];
    return this.applyGradientOperator(data, Gx, Gy);
  }

  private prewittEdge(data: Float32Array): EdgeMap {
    const Gx = [[-1, 0, 1], [-1, 0, 1], [-1, 0, 1]];
    const Gy = [[-1, -1, -1], [0, 0, 0], [1, 1, 1]];
    return this.applyGradientOperator(data, Gx, Gy);
  }

  private scharrEdge(data: Float32Array): EdgeMap {
    const Gx = [[-3, 0, 3], [-10, 0, 10], [-3, 0, 3]];
    const Gy = [[-3, -10, -3], [0, 0, 0], [3, 10, 3]];
    return this.applyGradientOperator(data, Gx, Gy);
  }

  private robertsEdge(data: Float32Array): EdgeMap {
    const magnitude = new Float32Array(this.width * this.height);
    const direction = new Float32Array(this.width * this.height);
    
    for (let y = 0; y < this.height - 1; y++) {
      for (let x = 0; x < this.width - 1; x++) {
        const idx = y * this.width + x;
        const p00 = data[idx];
        const p01 = data[idx + 1];
        const p10 = data[(y + 1) * this.width + x];
        const p11 = data[(y + 1) * this.width + x + 1];
        
        const gx = p00 - p11;
        const gy = p01 - p10;
        
        magnitude[idx] = Math.min(Math.sqrt(gx * gx + gy * gy), 1);
        direction[idx] = Math.atan2(gy, gx);
      }
    }
    
    return { magnitude, direction, width: this.width, height: this.height };
  }

  private laplacianOfGaussian(data: Float32Array): EdgeMap {
    // 5x5 LoG kernel approximation
    const kernel = [
      [0, 0, -1, 0, 0],
      [0, -1, -2, -1, 0],
      [-1, -2, 16, -2, -1],
      [0, -1, -2, -1, 0],
      [0, 0, -1, 0, 0],
    ];
    
    const magnitude = new Float32Array(this.width * this.height);
    const direction = new Float32Array(this.width * this.height);
    
    for (let y = 2; y < this.height - 2; y++) {
      for (let x = 2; x < this.width - 2; x++) {
        let sum = 0;
        for (let ky = -2; ky <= 2; ky++) {
          for (let kx = -2; kx <= 2; kx++) {
            sum += data[(y + ky) * this.width + (x + kx)] * kernel[ky + 2][kx + 2];
          }
        }
        const idx = y * this.width + x;
        magnitude[idx] = Math.min(Math.abs(sum), 1);
        direction[idx] = 0; // LoG doesn't have direction
      }
    }
    
    return { magnitude, direction, width: this.width, height: this.height };
  }

  private cannyEdge(data: Float32Array): EdgeMap {
    // Step 1: Gradient magnitude and direction (using Sobel)
    const gradient = this.sobelEdge(data);
    
    // Step 2: Non-maximum suppression
    let magnitude = gradient.magnitude;
    if (this.settings.useNMS) {
      magnitude = this.nonMaxSuppression(gradient);
    }
    
    // Step 3: Double threshold and hysteresis
    const { hysteresisLow, hysteresisHigh } = this.settings;
    const lowThresh = hysteresisLow / 255;
    const highThresh = hysteresisHigh / 255;
    
    const result = this.hysteresis(magnitude, lowThresh, highThresh);
    
    return {
      magnitude: result,
      direction: gradient.direction,
      width: this.width,
      height: this.height,
    };
  }

  private applyGradientOperator(
    data: Float32Array,
    Gx: number[][],
    Gy: number[][]
  ): EdgeMap {
    const magnitude = new Float32Array(this.width * this.height);
    const direction = new Float32Array(this.width * this.height);
    
    for (let y = 1; y < this.height - 1; y++) {
      for (let x = 1; x < this.width - 1; x++) {
        let gx = 0, gy = 0;
        
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const val = data[(y + ky) * this.width + (x + kx)];
            gx += val * Gx[ky + 1][kx + 1];
            gy += val * Gy[ky + 1][kx + 1];
          }
        }
        
        const idx = y * this.width + x;
        magnitude[idx] = Math.min(Math.sqrt(gx * gx + gy * gy), 1);
        direction[idx] = Math.atan2(gy, gx);
      }
    }
    
    return { magnitude, direction, width: this.width, height: this.height };
  }

  private nonMaxSuppression(edge: EdgeMap): Float32Array {
    const result = new Float32Array(edge.magnitude.length);
    
    for (let y = 1; y < this.height - 1; y++) {
      for (let x = 1; x < this.width - 1; x++) {
        const idx = y * this.width + x;
        const mag = edge.magnitude[idx];
        const dir = edge.direction[idx];
        
        // Quantize direction to 4 angles
        const angle = ((dir + Math.PI) / Math.PI * 4) % 4;
        
        let mag1 = 0, mag2 = 0;
        
        if (angle < 1 || angle >= 3) {
          // Horizontal edge, check vertical neighbors
          mag1 = edge.magnitude[(y - 1) * this.width + x];
          mag2 = edge.magnitude[(y + 1) * this.width + x];
        } else if (angle >= 1 && angle < 2) {
          // Diagonal (45°)
          mag1 = edge.magnitude[(y - 1) * this.width + (x + 1)];
          mag2 = edge.magnitude[(y + 1) * this.width + (x - 1)];
        } else if (angle >= 2 && angle < 3) {
          // Vertical edge, check horizontal neighbors
          mag1 = edge.magnitude[y * this.width + (x - 1)];
          mag2 = edge.magnitude[y * this.width + (x + 1)];
        }
        
        // Keep only local maxima
        result[idx] = (mag >= mag1 && mag >= mag2) ? mag : 0;
      }
    }
    
    return result;
  }

  private hysteresis(magnitude: Float32Array, low: number, high: number): Float32Array {
    const result = new Float32Array(magnitude.length);
    const visited = new Uint8Array(magnitude.length);
    
    // Mark strong edges
    const stack: number[] = [];
    for (let i = 0; i < magnitude.length; i++) {
      if (magnitude[i] >= high) {
        result[i] = 1;
        visited[i] = 1;
        stack.push(i);
      }
    }
    
    // Trace connected weak edges
    while (stack.length > 0) {
      const idx = stack.pop()!;
      const x = idx % this.width;
      const y = Math.floor(idx / this.width);
      
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || nx >= this.width || ny < 0 || ny >= this.height) continue;
          
          const nidx = ny * this.width + nx;
          if (!visited[nidx] && magnitude[nidx] >= low) {
            result[nidx] = 1;
            visited[nidx] = 1;
            stack.push(nidx);
          }
        }
      }
    }
    
    return result;
  }
}
