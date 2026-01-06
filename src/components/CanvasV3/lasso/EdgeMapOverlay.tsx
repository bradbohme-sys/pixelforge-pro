/**
 * Edge Map Debug Overlay
 * 
 * Visualizes detected edges as a heatmap on the canvas.
 * Helps understand why the lasso follows certain paths.
 */

import React, { useEffect, useRef, useMemo } from 'react';
import type { EdgeMap } from './types';

interface EdgeMapOverlayProps {
  edgeMap: EdgeMap | null;
  visible: boolean;
  opacity?: number;
  colorScheme?: 'heat' | 'grayscale' | 'direction';
}

/**
 * Convert edge magnitude to heatmap color (blue -> green -> yellow -> red)
 */
function magnitudeToHeatColor(value: number): [number, number, number] {
  // Clamp to 0-1
  const v = Math.max(0, Math.min(1, value));
  
  let r: number, g: number, b: number;
  
  if (v < 0.25) {
    // Blue to Cyan
    const t = v / 0.25;
    r = 0;
    g = Math.floor(t * 255);
    b = 255;
  } else if (v < 0.5) {
    // Cyan to Green
    const t = (v - 0.25) / 0.25;
    r = 0;
    g = 255;
    b = Math.floor((1 - t) * 255);
  } else if (v < 0.75) {
    // Green to Yellow
    const t = (v - 0.5) / 0.25;
    r = Math.floor(t * 255);
    g = 255;
    b = 0;
  } else {
    // Yellow to Red
    const t = (v - 0.75) / 0.25;
    r = 255;
    g = Math.floor((1 - t) * 255);
    b = 0;
  }
  
  return [r, g, b];
}

/**
 * Convert gradient direction to color (hue wheel)
 */
function directionToColor(radians: number, magnitude: number): [number, number, number] {
  // Map -PI..PI to 0..360
  const hue = ((radians + Math.PI) / (2 * Math.PI)) * 360;
  
  // HSL to RGB (saturation = 1, lightness based on magnitude)
  const s = 1;
  const l = 0.2 + magnitude * 0.6; // 0.2 to 0.8
  
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs((hue / 60) % 2 - 1));
  const m = l - c / 2;
  
  let r = 0, g = 0, b = 0;
  
  if (hue < 60) {
    r = c; g = x; b = 0;
  } else if (hue < 120) {
    r = x; g = c; b = 0;
  } else if (hue < 180) {
    r = 0; g = c; b = x;
  } else if (hue < 240) {
    r = 0; g = x; b = c;
  } else if (hue < 300) {
    r = x; g = 0; b = c;
  } else {
    r = c; g = 0; b = x;
  }
  
  return [
    Math.floor((r + m) * 255),
    Math.floor((g + m) * 255),
    Math.floor((b + m) * 255),
  ];
}

export const EdgeMapOverlay: React.FC<EdgeMapOverlayProps> = ({
  edgeMap,
  visible,
  opacity = 0.6,
  colorScheme = 'heat',
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Memoize the ImageData generation
  const imageData = useMemo(() => {
    if (!edgeMap) return null;
    
    const { magnitude, direction, width, height } = edgeMap;
    const data = new ImageData(width, height);
    const pixels = data.data;
    
    for (let i = 0; i < magnitude.length; i++) {
      const mag = magnitude[i];
      const dir = direction[i];
      
      let r: number, g: number, b: number;
      
      switch (colorScheme) {
        case 'heat':
          [r, g, b] = magnitudeToHeatColor(mag);
          break;
        case 'direction':
          [r, g, b] = directionToColor(dir, mag);
          break;
        case 'grayscale':
        default:
          r = g = b = Math.floor(mag * 255);
      }
      
      const idx = i * 4;
      pixels[idx] = r;
      pixels[idx + 1] = g;
      pixels[idx + 2] = b;
      // Alpha based on magnitude (transparent where no edges)
      pixels[idx + 3] = Math.floor(mag * 255);
    }
    
    return data;
  }, [edgeMap, colorScheme]);
  
  // Render to canvas when imageData changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !imageData) return;
    
    canvas.width = imageData.width;
    canvas.height = imageData.height;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.putImageData(imageData, 0, 0);
  }, [imageData]);
  
  if (!visible || !edgeMap) return null;
  
  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none"
      style={{
        opacity,
        mixBlendMode: 'screen',
        width: '100%',
        height: '100%',
        objectFit: 'contain',
      }}
    />
  );
};

/**
 * Hook to get edge map overlay as ImageBitmap for canvas rendering
 */
export function useEdgeMapBitmap(
  edgeMap: EdgeMap | null,
  colorScheme: 'heat' | 'grayscale' | 'direction' = 'heat'
): ImageBitmap | null {
  const [bitmap, setBitmap] = React.useState<ImageBitmap | null>(null);
  
  useEffect(() => {
    if (!edgeMap) {
      setBitmap(null);
      return;
    }
    
    const { magnitude, direction, width, height } = edgeMap;
    const imageData = new ImageData(width, height);
    const pixels = imageData.data;
    
    for (let i = 0; i < magnitude.length; i++) {
      const mag = magnitude[i];
      const dir = direction[i];
      
      let r: number, g: number, b: number;
      
      switch (colorScheme) {
        case 'heat':
          [r, g, b] = magnitudeToHeatColor(mag);
          break;
        case 'direction':
          [r, g, b] = directionToColor(dir, mag);
          break;
        case 'grayscale':
        default:
          r = g = b = Math.floor(mag * 255);
      }
      
      const idx = i * 4;
      pixels[idx] = r;
      pixels[idx + 1] = g;
      pixels[idx + 2] = b;
      pixels[idx + 3] = Math.floor(mag * 255);
    }
    
    createImageBitmap(imageData).then(setBitmap).catch(() => setBitmap(null));
    
    return () => {
      bitmap?.close();
    };
  }, [edgeMap, colorScheme]);
  
  return bitmap;
}

export default EdgeMapOverlay;
