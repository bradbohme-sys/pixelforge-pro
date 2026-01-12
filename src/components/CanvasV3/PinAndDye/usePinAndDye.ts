/**
 * usePinAndDye - Hook for managing the Pin-and-Dye segmentation workflow
 * 
 * Implements the enhanced 4-stage pipeline:
 * Stage I: Visual Prominence logic (10% threshold)
 * Stage II: Discovery Pass (AI pinning)
 * Stage III: Dye Pass (AI signal layer generation)
 * Stage IV: Algorithmic extraction (wand on dye layer)
 */

import { useState, useCallback, useRef } from 'react';
import { discoverObjects, generateDyeLayer, extractSelectionFromDye, loadImageFromBase64 } from '@/services/aiSegmentationService';
import type { DiscoveredPin, PinAndDyeState, DyeLayerState } from './types';
import { getDyeColor } from './types';
import { toast } from 'sonner';

interface UsePinAndDyeOptions {
  canvasWidth: number;
  canvasHeight: number;
  onSelectionExtracted?: (mask: Uint8Array, pin: DiscoveredPin) => void;
}

export function usePinAndDye(options: UsePinAndDyeOptions) {
  const { canvasWidth, canvasHeight, onSelectionExtracted } = options;
  
  const [state, setState] = useState<PinAndDyeState>({
    stage: 'idle',
    pins: {
      pins: [],
      selectedPinId: null,
      isEditing: false,
    },
    dyeLayer: {
      imageData: null,
      base64: null,
      isGenerated: false,
      generatedAt: null,
    },
    error: null,
  });

  const dyeImageRef = useRef<HTMLImageElement | null>(null);
  const extractedMasksRef = useRef<Map<string, Uint8Array>>(new Map());

  /**
   * Stage II: Discover objects in the image
   */
  const discoverPins = useCallback(async (imageBase64: string): Promise<DiscoveredPin[] | null> => {
    setState(prev => ({ ...prev, stage: 'discovering', error: null }));
    toast.info('🔍 AI analyzing image for objects...');

    try {
      const result = await discoverObjects(imageBase64, canvasWidth, canvasHeight);
      
      if (!result.success || !result.pins) {
        throw new Error(result.error || 'Discovery failed');
      }

      // Assign colors to pins
      const pinsWithColors: DiscoveredPin[] = result.pins.map((pin, i) => ({
        ...pin,
        color: getDyeColor(i),
      }));

      setState(prev => ({
        ...prev,
        stage: 'pins-ready',
        pins: {
          pins: pinsWithColors,
          selectedPinId: null,
          isEditing: true,
        },
        dyeLayer: {
          imageData: null,
          base64: null,
          isGenerated: false,
          generatedAt: null,
        },
      }));

      // Clear previously extracted masks
      extractedMasksRef.current.clear();

      toast.success(`📍 Found ${pinsWithColors.length} objects`);
      return pinsWithColors;
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Discovery failed';
      setState(prev => ({ ...prev, stage: 'idle', error }));
      toast.error(`Discovery failed: ${error}`);
      return null;
    }
  }, [canvasWidth, canvasHeight]);

  /**
   * Stage III: Generate dye layer from confirmed pins
   */
  const generateDye = useCallback(async (imageBase64: string): Promise<ImageData | null> => {
    const pins = state.pins.pins;
    if (pins.length === 0) {
      toast.error('No pins to process');
      return null;
    }

    setState(prev => ({ ...prev, stage: 'dyeing', error: null }));
    toast.info('🎨 Generating dye layer with AI...');

    try {
      // Include labels in the request for better AI guidance
      const pinsWithLabels = pins.map(p => ({ 
        x: p.x, 
        y: p.y, 
        id: p.id,
        label: p.label 
      }));
      const result = await generateDyeLayer(imageBase64, pinsWithLabels, canvasWidth, canvasHeight);
      
      if (!result.success || !result.dyeImage) {
        throw new Error(result.error || 'Dye generation failed');
      }

      // Load the dye image
      const dyeImg = await loadImageFromBase64(result.dyeImage);
      dyeImageRef.current = dyeImg;

      // Create image data from dye layer
      const canvas = document.createElement('canvas');
      canvas.width = canvasWidth;
      canvas.height = canvasHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Failed to create canvas');
      
      ctx.drawImage(dyeImg, 0, 0, canvasWidth, canvasHeight);
      const imageData = ctx.getImageData(0, 0, canvasWidth, canvasHeight);

      setState(prev => ({
        ...prev,
        stage: 'dye-ready',
        pins: { ...prev.pins, isEditing: false },
        dyeLayer: {
          imageData,
          base64: result.dyeImage,
          isGenerated: true,
          generatedAt: Date.now(),
        },
      }));

      toast.success('🎨 Dye layer ready! Click objects to extract selections.');
      return imageData;
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Dye generation failed';
      setState(prev => ({ ...prev, stage: 'pins-ready', error }));
      toast.error(`Dye generation failed: ${error}`);
      return null;
    }
  }, [state.pins.pins, canvasWidth, canvasHeight]);

  /**
   * Stage IV: Extract selection from dye layer at a pin location
   */
  const extractSelection = useCallback((pinId: string): Uint8Array | null => {
    const { dyeLayer, pins } = state;
    if (!dyeLayer.imageData || state.stage !== 'dye-ready') {
      toast.error('Dye layer not ready');
      return null;
    }

    const pin = pins.pins.find(p => p.id === pinId);
    if (!pin) {
      toast.error('Pin not found');
      return null;
    }

    // Check cache first
    const cachedMask = extractedMasksRef.current.get(pinId);
    if (cachedMask) {
      onSelectionExtracted?.(cachedMask, pin);
      toast.success(`✂️ Extracted "${pin.label}"`);
      return cachedMask;
    }

    setState(prev => ({ ...prev, stage: 'extracting' }));

    try {
      // Use calibrated tolerance for dye colors (high contrast colors)
      const tolerance = 60; // Tuned for high-saturation dye colors
      const mask = extractSelectionFromDye(dyeLayer.imageData, pin.x, pin.y, tolerance);
      
      // Cache the result
      extractedMasksRef.current.set(pinId, mask);
      
      setState(prev => ({ ...prev, stage: 'dye-ready' }));
      
      onSelectionExtracted?.(mask, pin);
      toast.success(`✂️ Extracted "${pin.label}"`);
      
      return mask;
    } catch (err) {
      setState(prev => ({ ...prev, stage: 'dye-ready' }));
      toast.error('Extraction failed');
      return null;
    }
  }, [state, onSelectionExtracted]);

  /**
   * Extract all objects at once
   */
  const extractAllSelections = useCallback(() => {
    const { dyeLayer, pins } = state;
    if (!dyeLayer.imageData || state.stage !== 'dye-ready') {
      toast.error('Dye layer not ready');
      return;
    }

    const results: Array<{ pin: DiscoveredPin; mask: Uint8Array }> = [];
    
    for (const pin of pins.pins) {
      try {
        const tolerance = 60;
        const mask = extractSelectionFromDye(dyeLayer.imageData, pin.x, pin.y, tolerance);
        extractedMasksRef.current.set(pin.id, mask);
        results.push({ pin, mask });
        onSelectionExtracted?.(mask, pin);
      } catch (err) {
        console.error(`Failed to extract ${pin.label}:`, err);
      }
    }

    toast.success(`✂️ Extracted ${results.length} objects`);
    return results;
  }, [state, onSelectionExtracted]);

  /**
   * Pin management
   */
  const selectPin = useCallback((id: string) => {
    setState(prev => ({
      ...prev,
      pins: { ...prev.pins, selectedPinId: id },
    }));
  }, []);

  const addPin = useCallback((x: number, y: number, label: string) => {
    const newPin: DiscoveredPin = {
      id: `pin_${Date.now()}`,
      label,
      x,
      y,
      areaPercent: 0,
      color: getDyeColor(state.pins.pins.length),
    };

    setState(prev => ({
      ...prev,
      pins: {
        ...prev.pins,
        pins: [...prev.pins.pins, newPin],
        selectedPinId: newPin.id,
      },
      // Invalidate dye layer since pins changed
      dyeLayer: {
        ...prev.dyeLayer,
        isGenerated: false,
      },
    }));
    
    // Clear cached masks since dye layer is invalidated
    extractedMasksRef.current.clear();
  }, [state.pins.pins.length]);

  const removePin = useCallback((id: string) => {
    setState(prev => ({
      ...prev,
      pins: {
        ...prev.pins,
        pins: prev.pins.pins.filter(p => p.id !== id),
        selectedPinId: prev.pins.selectedPinId === id ? null : prev.pins.selectedPinId,
      },
      // Invalidate dye layer since pins changed
      dyeLayer: {
        ...prev.dyeLayer,
        isGenerated: false,
      },
    }));
    
    // Remove from cache
    extractedMasksRef.current.delete(id);
  }, []);

  const confirmPins = useCallback(() => {
    setState(prev => ({
      ...prev,
      pins: { ...prev.pins, isEditing: false },
    }));
  }, []);

  const cancelPins = useCallback(() => {
    setState(prev => ({
      ...prev,
      stage: 'idle',
      pins: { pins: [], selectedPinId: null, isEditing: false },
    }));
    extractedMasksRef.current.clear();
  }, []);

  const reset = useCallback(() => {
    dyeImageRef.current = null;
    extractedMasksRef.current.clear();
    setState({
      stage: 'idle',
      pins: { pins: [], selectedPinId: null, isEditing: false },
      dyeLayer: { imageData: null, base64: null, isGenerated: false, generatedAt: null },
      error: null,
    });
  }, []);

  return {
    state,
    discoverPins,
    generateDye,
    extractSelection,
    extractAllSelections,
    selectPin,
    addPin,
    removePin,
    confirmPins,
    cancelPins,
    reset,
    dyeImage: dyeImageRef.current,
  };
}
