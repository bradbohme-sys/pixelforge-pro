/**
 * Magic Wand Worker - Flood Fill Segmentation
 * 
 * GOLDEN PATH RULE 10: Heavy Pixel Algorithms Are Iterative and Worker-Compatible
 */

interface MagicWandRequest {
  type: 'segment';
  requestId: number;
  imageData: ImageData;
  seedX: number;
  seedY: number;
  tolerance: number;
  contiguous: boolean;
}

interface LayerBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface MagicWandResponse {
  type: 'result' | 'error';
  requestId: number;
  mask?: Uint8Array;
  bounds?: LayerBounds;
  pixelCount?: number;
  error?: string;
}

interface FloodFillResult {
  mask: Uint8Array;
  bounds: LayerBounds;
  pixelCount: number;
}

function floodFill(
  imageData: ImageData,
  seedX: number,
  seedY: number,
  tolerance: number,
  contiguous: boolean
): FloodFillResult {
  const { width, height, data } = imageData;
  const mask = new Uint8Array(width * height);
  
  const seedIndex = (seedY * width + seedX) * 4;
  const seedR = data[seedIndex];
  const seedG = data[seedIndex + 1];
  const seedB = data[seedIndex + 2];
  
  let minX = seedX, maxX = seedX;
  let minY = seedY, maxY = seedY;
  let pixelCount = 0;
  
  const toleranceSq = tolerance * tolerance * 3;
  
  const colorDistance = (r: number, g: number, b: number): number => {
    const dr = r - seedR;
    const dg = g - seedG;
    const db = b - seedB;
    return dr * dr + dg * dg + db * db;
  };
  
  if (contiguous) {
    const visited = new Uint8Array(width * height);
    const queue: number[] = [];
    
    const startIdx = seedY * width + seedX;
    queue.push(startIdx);
    visited[startIdx] = 1;
    
    while (queue.length > 0) {
      const currentIdx = queue.shift()!;
      const x = currentIdx % width;
      const y = Math.floor(currentIdx / width);
      const pixelIndex = currentIdx * 4;
      
      const r = data[pixelIndex];
      const g = data[pixelIndex + 1];
      const b = data[pixelIndex + 2];
      
      if (colorDistance(r, g, b) <= toleranceSq) {
        mask[currentIdx] = 255;
        pixelCount++;
        
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
        
        // 4-connectivity neighbors
        const neighbors = [
          currentIdx - 1,     // left
          currentIdx + 1,     // right
          currentIdx - width, // up
          currentIdx + width, // down
        ];
        
        for (const neighbor of neighbors) {
          const nx = neighbor % width;
          const ny = Math.floor(neighbor / width);
          
          if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
          if (visited[neighbor]) continue;
          
          visited[neighbor] = 1;
          queue.push(neighbor);
        }
      }
    }
  } else {
    // Non-contiguous: select all pixels within tolerance
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        const pixelIndex = idx * 4;
        
        const r = data[pixelIndex];
        const g = data[pixelIndex + 1];
        const b = data[pixelIndex + 2];
        
        if (colorDistance(r, g, b) <= toleranceSq) {
          mask[idx] = 255;
          pixelCount++;
          
          minX = Math.min(minX, x);
          maxX = Math.max(maxX, x);
          minY = Math.min(minY, y);
          maxY = Math.max(maxY, y);
        }
      }
    }
  }
  
  return {
    mask,
    bounds: {
      x: minX,
      y: minY,
      width: maxX - minX + 1,
      height: maxY - minY + 1,
    },
    pixelCount,
  };
}

self.onmessage = (e: MessageEvent<MagicWandRequest>) => {
  const request = e.data;
  
  if (request.type === 'segment') {
    try {
      const result = floodFill(
        request.imageData,
        request.seedX,
        request.seedY,
        request.tolerance,
        request.contiguous
      );
      
      const response: MagicWandResponse = {
        type: 'result',
        requestId: request.requestId,
        mask: result.mask,
        bounds: result.bounds,
        pixelCount: result.pixelCount,
      };
      
      self.postMessage(response, { transfer: [result.mask.buffer] });
    } catch (error) {
      console.error('[MagicWandWorker] Error:', error);
      self.postMessage({
        type: 'error',
        requestId: request.requestId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
};
