/**
 * AI Segmentation Service - "Pin-and-Dye" Protocol
 * 
 * Uses Lovable AI (Nano Banana Pro) for:
 * 1. Object Discovery (Pinning) - Identifies objects using 10% threshold rule
 * 2. Dye Pass - Generates color-coded signal layer for algorithmic extraction
 */

import { supabase } from "@/integrations/supabase/client";

export interface DiscoveredPin {
  id: string;
  label: string;
  x: number;
  y: number;
  areaPercent: number;
}

export interface DiscoveryResult {
  success: boolean;
  pins?: DiscoveredPin[];
  error?: string;
}

export interface DyeResult {
  success: boolean;
  dyeImage?: string; // Base64 data URL
  message?: string;
  error?: string;
}

/**
 * Stage II: Discovery Pass (Pinning)
 * Analyzes image and returns pin locations for each detected object
 */
export async function discoverObjects(
  imageBase64: string,
  canvasWidth: number,
  canvasHeight: number
): Promise<DiscoveryResult> {
  try {
    const { data, error } = await supabase.functions.invoke('ai-segment', {
      body: {
        type: 'discover',
        imageBase64,
        canvasWidth,
        canvasHeight,
      }
    });

    if (error) {
      console.error('Discovery error:', error);
      return { success: false, error: error.message };
    }

    return {
      success: true,
      pins: data.pins || [],
    };
  } catch (err) {
    console.error('Discovery exception:', err);
    return { 
      success: false, 
      error: err instanceof Error ? err.message : 'Unknown error' 
    };
  }
}

/**
 * Stage III: Dye Pass (Signal Layer Generation)
 * Generates a color-coded overlay for precise algorithmic selection
 */
export async function generateDyeLayer(
  imageBase64: string,
  pins: Array<{ x: number; y: number; id: string }>,
  canvasWidth: number,
  canvasHeight: number
): Promise<DyeResult> {
  try {
    const { data, error } = await supabase.functions.invoke('ai-segment', {
      body: {
        type: 'dye',
        imageBase64,
        pins,
        canvasWidth,
        canvasHeight,
      }
    });

    if (error) {
      console.error('Dye pass error:', error);
      return { success: false, error: error.message };
    }

    return {
      success: true,
      dyeImage: data.dyeImage,
      message: data.message,
    };
  } catch (err) {
    console.error('Dye pass exception:', err);
    return { 
      success: false, 
      error: err instanceof Error ? err.message : 'Unknown error' 
    };
  }
}

/**
 * Stage IV: Extract selection from dye layer
 * Uses color sampling at pin location to create precise mask
 */
export function extractSelectionFromDye(
  dyeImageData: ImageData,
  pinX: number,
  pinY: number,
  tolerance: number = 30
): Uint8Array {
  const { width, height, data } = dyeImageData;
  const mask = new Uint8Array(width * height);
  
  // Sample color at pin location
  const pinIdx = (Math.floor(pinY) * width + Math.floor(pinX)) * 4;
  const targetR = data[pinIdx];
  const targetG = data[pinIdx + 1];
  const targetB = data[pinIdx + 2];
  
  const toleranceSq = tolerance * tolerance * 3;
  
  // Select all pixels matching the dye color
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      
      const dr = r - targetR;
      const dg = g - targetG;
      const db = b - targetB;
      const distSq = dr * dr + dg * dg + db * db;
      
      if (distSq <= toleranceSq) {
        mask[y * width + x] = 255;
      }
    }
  }
  
  return mask;
}

/**
 * Convert canvas to base64 for AI processing
 */
export function canvasToBase64(canvas: HTMLCanvasElement): string {
  return canvas.toDataURL('image/png');
}

/**
 * Load image from base64 string
 */
export function loadImageFromBase64(base64: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = base64;
  });
}
