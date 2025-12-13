/**
 * usePinAndDye - Hook for managing the Pin-and-Dye segmentation workflow
 * 
 * Implements the 4-stage pipeline:
 * Stage I: Visual Prominence logic (10% threshold)
 * Stage II: Discovery Pass (AI pinning)
 * Stage III: Dye Pass (AI signal layer generation)
 * Stage IV: Algorithmic extraction (wand on dye layer)
 */

import { useState, useCallback, useRef } from 'react';
import { discoverObjects, generateDyeLayer, extractSelectionFromDye, loadImageFromBase64 } from '@/services/aiSegmentationService';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../constants';
import type { DiscoveredPin, PinAndDyeState, DyeLayerState } from './types';
import { getDyeColor } from './types';
import { toast } from 'sonner';

interface UsePinAndDyeOptions {
  onSelectionExtracted?: (mask: Uint8Array, pin: DiscoveredPin) => void;
}

export function usePinAndDye(options: UsePinAndDyeOptions = {}) {
  const { onSelectionExtracted } = options;
  
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

  /**
   * Stage II: Discover objects in the image
   */
  const discoverPins = useCallback(async (imageBase64: string) => {
    setState(prev => ({ ...prev, stage: 'discovering', error: null }));
    toast.info('🔍 AI analyzing image for objects...');

    try {
      const result = await discoverObjects(imageBase64, CANVAS_WIDTH, CANVAS_HEIGHT);
      
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
      }));

      toast.success(`📍 Found ${pinsWithColors.length} objects`);
      return pinsWithColors;
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Discovery failed';
      setState(prev => ({ ...prev, stage: 'idle', error }));
      toast.error(`Discovery failed: ${error}`);
      return null;
    }
  }, []);

  /**
   * Stage III: Generate dye layer from confirmed pins
   */
  const generateDye = useCallback(async (imageBase64: string) => {
    const pins = state.pins.pins;
    if (pins.length === 0) {
      toast.error('No pins to process');
      return null;
    }

    setState(prev => ({ ...prev, stage: 'dyeing', error: null }));
    toast.info('🎨 Generating dye layer with Nano Banana Pro...');

    try {
      const simplePins = pins.map(p => ({ x: p.x, y: p.y, id: p.id }));
      const result = await generateDyeLayer(imageBase64, simplePins, CANVAS_WIDTH, CANVAS_HEIGHT);
      
      if (!result.success || !result.dyeImage) {
        throw new Error(result.error || 'Dye generation failed');
      }

      // Load the dye image
      const dyeImg = await loadImageFromBase64(result.dyeImage);
      dyeImageRef.current = dyeImg;

      // Create image data from dye layer
      const canvas = document.createElement('canvas');
      canvas.width = CANVAS_WIDTH;
      canvas.height = CANVAS_HEIGHT;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Failed to create canvas');
      
      ctx.drawImage(dyeImg, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      const imageData = ctx.getImageData(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

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

      toast.success('🎨 Dye layer ready! Click pins to extract selections.');
      return imageData;
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Dye generation failed';
      setState(prev => ({ ...prev, stage: 'pins-ready', error }));
      toast.error(`Dye generation failed: ${error}`);
      return null;
    }
  }, [state.pins.pins]);

  /**
   * Stage IV: Extract selection from dye layer at a pin location
   */
  const extractSelection = useCallback((pinId: string) => {
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

    setState(prev => ({ ...prev, stage: 'extracting' }));

    try {
      // Use calibrated tolerance for dye colors (75% opacity dye)
      const tolerance = 50; // Tuned for known dye color ranges
      const mask = extractSelectionFromDye(dyeLayer.imageData, pin.x, pin.y, tolerance);
      
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
  }, []);

  const reset = useCallback(() => {
    dyeImageRef.current = null;
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
    selectPin,
    addPin,
    removePin,
    confirmPins,
    cancelPins,
    reset,
    dyeImage: dyeImageRef.current,
  };
}
