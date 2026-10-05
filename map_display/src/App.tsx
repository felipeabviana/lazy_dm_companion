import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ImagePlus, Monitor, Eraser, Brush, PaintBucket, Settings, X } from 'lucide-react';
import type { MapState } from './types/map';
import type { BrushMode } from './types/electron';

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 5;

// Brush size bounds (in image-natural pixels)
const MIN_BRUSH = 10;
const MAX_BRUSH = 300;
const BRUSH_STEP = 5;

// Fog appearance — the fog canvas stores a BINARY mask (opaque where fog
// exists, transparent where revealed); the semi-transparent shade comes from
// the canvas CSS opacity. This keeps add/remove brush strokes perfectly
// symmetric (an opaque source-over stroke restores the mask exactly, with no
// alpha accumulation). The player window uses the same mask at full opacity
// (completely black fog), see ViewOnlyMap.tsx.
const FOG_COLOR_MAIN = 'rgb(9, 9, 11)';

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const clampZoom = (zoom: number) => clamp(zoom, MIN_ZOOM, MAX_ZOOM);

// Zoom slider resolution (0 = MIN_ZOOM, 1000 = MAX_ZOOM)
const SLIDER_STEPS = 1000;

// The slider maps position → zoom logarithmically, so the low end (where zoom
// changes matter most) gets far more travel than the high end.
const LOG_MIN = Math.log(MIN_ZOOM);
const LOG_MAX = Math.log(MAX_ZOOM);

const sliderToZoom = (pos: number) => Math.exp(LOG_MIN + (pos / SLIDER_STEPS) * (LOG_MAX - LOG_MIN));
const zoomToSlider = (z: number) =>
  ((Math.log(clampZoom(z)) - LOG_MIN) / (LOG_MAX - LOG_MIN)) * SLIDER_STEPS;

interface Size {
  w: number;
  h: number;
}

export const App: React.FC = () => {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  // Editable text for the zoom % field; kept separate so typing isn't fought
  // by the numeric value snapping back on every keystroke
  const [zoomText, setZoomText] = useState('100');
  const [viewOpen, setViewOpen] = useState(false);
  const [brushSize, setBrushSize] = useState(80);
  // null = no brush selected (frame is movable); 'add'/'remove' = fog brush active
  const [brushMode, setBrushMode] = useState<BrushMode | null>(null);
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);
  const [viewportSize, setViewportSize] = useState<Size | null>(null);
  const [pan, setPan] = useState<{ x: number; y: number } | null>(null);
  // Player view physical diagonal (empty = no grid)
  const [playerViewDiagonal, setPlayerViewDiagonal] = useState('');
  // Grid cell size (defaults to 1)
  const [gridSize, setGridSize] = useState('1');
  // Player's View configuration modal visibility
  const [showPlayerConfig, setShowPlayerConfig] = useState(false);

  const imgRef = useRef<HTMLImageElement>(null);
  const fogCanvasRef = useRef<HTMLCanvasElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  // Explicit displayed size of the image (px) — set by JS so the wrapper,
  // img, and fog canvas are always identical and perfectly aligned
  const [displaySize, setDisplaySize] = useState<{ w: number; h: number } | null>(null);
  const paintingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const brushSizeRef = useRef(brushSize);
  brushSizeRef.current = brushSize;
  const brushModeRef = useRef<BrushMode | null>(brushMode);
  brushModeRef.current = brushMode;
  const panRef = useRef(pan);
  panRef.current = pan;
  const frameDragRef = useRef<{ startX: number; startY: number; startPan: { x: number; y: number } } | null>(null);

  // ─── Fog helpers ────────────────────────────────────────────────────────────

  const getFogCtx = useCallback(() => {
    const canvas = fogCanvasRef.current;
    return canvas ? canvas.getContext('2d') : null;
  }, []);

  const fillFog = useCallback(() => {
    const canvas = fogCanvasRef.current;
    const ctx = getFogCtx();
    if (!canvas || !ctx) return;
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = FOG_COLOR_MAIN;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }, [getFogCtx]);

  // Size the fog canvas to the image's natural resolution and fill it
  const resetFog = useCallback(() => {
    const img = imgRef.current;
    const canvas = fogCanvasRef.current;
    if (!img || !canvas || !imageUrl) return;
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    fillFog();
    // Sync to player view: reset + full snapshot
    window.electronAPI?.sendFogReset();
    window.electronAPI?.sendFogSync(canvas.toDataURL());
  }, [imageUrl, fillFog]);

  // Fill the whole canvas: add fog when the add brush is selected, clear it
  // completely when the remove brush is selected.
  const fillAllFog = useCallback(() => {
    const canvas = fogCanvasRef.current;
    const ctx = getFogCtx();
    if (!canvas || !ctx) return;
    if (brushModeRef.current === 'add') {
      fillFog();
    } else {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.globalCompositeOperation = 'source-over';
    }
    // Sync to player view: full snapshot (no reset, the image is unchanged)
    window.electronAPI?.sendFogSync(canvas.toDataURL());
  }, [fillFog, getFogCtx]);

  // ─── Viewport frame (what the player window currently shows) ─────────────────

  // Compute the pan offset (top-left of the player viewport in image-natural
  // coordinates), keeping the view centered on the same image point when possible
  const computePan = useCallback(
    (naturalW: number, naturalH: number, z: number, vp: Size, prev: { x: number; y: number } | null) => {
      const viewW = vp.w / z;
      const viewH = vp.h / z;
      const centerX = prev ? prev.x + viewW / 2 : naturalW / 2;
      const centerY = prev ? prev.y + viewH / 2 : naturalH / 2;
      return {
        x: clamp(centerX - viewW / 2, 0, Math.max(0, naturalW - viewW)),
        y: clamp(centerY - viewH / 2, 0, Math.max(0, naturalH - viewH)),
      };
    },
    [],
  );

  const updatePan = useCallback(
    (prevPan: { x: number; y: number } | null) => {
      const img = imgRef.current;
      if (!img || !img.naturalWidth || !viewportSize) return prevPan;
      const next = computePan(img.naturalWidth, img.naturalHeight, zoom, viewportSize, prevPan);
      panRef.current = next;
      setPan(next);
      window.electronAPI?.sendViewportPan(next.x, next.y);
      return next;
    },
    [zoom, viewportSize, computePan],
  );

  // Recompute and push the pan whenever the image, zoom, or player viewport changes
  useEffect(() => {
    updatePan(panRef.current);
  }, [imageUrl, zoom, viewportSize, updatePan]);

  // Listen for viewport size reports from the player window
  useEffect(() => {
    const unsub = window.electronAPI?.onViewportSize((w, h) => setViewportSize({ w, h }));
    return unsub;
  }, []);

  // Broadcast map state to the view-only window(s) whenever it changes
  useEffect(() => {
    const state: MapState = { imageUrl, zoom };
    window.electronAPI?.sendState(state);
  }, [imageUrl, zoom]);

  // ─── Image selection ────────────────────────────────────────────────────────

  const handleSelectImage = useCallback(async () => {
    const dataUrl = await window.electronAPI?.openImage();
    if (dataUrl) {
      setImageUrl(dataUrl);
    }
  }, []);

  // Compute the displayed size so the image fits the main viewport (no upscale)
  const updateDisplaySize = useCallback((natW: number, natH: number) => {
    const main = mainRef.current;
    if (!main || !natW || !natH) return;
    const rect = main.getBoundingClientRect();
    const availW = rect.width - 48; // p-6 padding (24px each side)
    const availH = rect.height - 48;
    if (availW <= 0 || availH <= 0) return;
    const scale = Math.min(1, availW / natW, availH / natH);
    setDisplaySize({
      w: Math.max(1, Math.round(natW * scale)),
      h: Math.max(1, Math.round(natH * scale)),
    });
  }, []);

  // Recompute the displayed size when the main viewport resizes
  useEffect(() => {
    const el = mainRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const img = imgRef.current;
      if (img && img.naturalWidth) updateDisplaySize(img.naturalWidth, img.naturalHeight);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [updateDisplaySize]);

  const handleImageLoad = useCallback(() => {
    const img = imgRef.current;
    if (img && img.naturalWidth) {
      updateDisplaySize(img.naturalWidth, img.naturalHeight);
    }
    resetFog();
    updatePan(panRef.current);
  }, [resetFog, updatePan, updateDisplaySize]);

  // ─── Fog painting ───────────────────────────────────────────────────────────

  // Convert a mouse event to image-natural coordinates
  const toImageCoords = useCallback((e: { clientX: number; clientY: number }) => {
    const img = imgRef.current;
    if (!img) return null;
    const rect = img.getBoundingClientRect();
    const scaleX = img.naturalWidth / rect.width;
    const scaleY = img.naturalHeight / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  }, []);

  const paintSegment = useCallback(
    (from: { x: number; y: number }, to: { x: number; y: number }) => {
      const ctx = getFogCtx();
      if (!ctx) return;
      const mode = brushModeRef.current;
      if (!mode) return;
      const radius = brushSizeRef.current;
      if (mode === 'add') {
        // Paint fog back over revealed areas
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = FOG_COLOR_MAIN;
      } else {
        // Erase fog to reveal the map
        ctx.globalCompositeOperation = 'destination-out';
      }
      ctx.lineWidth = radius * 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();
      // Forward the segment to the player view
      window.electronAPI?.sendFogStroke(mode, from.x, from.y, to.x, to.y, radius);
    },
    [getFogCtx],
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!imageUrl || brushModeRef.current === null) return;
      const point = toImageCoords(e);
      if (!point) return;
      paintingRef.current = true;
      lastPointRef.current = point;
      paintSegment(point, { x: point.x + 0.01, y: point.y + 0.01 }); // dot
    },
    [imageUrl, toImageCoords, paintSegment],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const img = imgRef.current;
      if (img) {
        const rect = img.getBoundingClientRect();
        setCursorPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      }
      if (!paintingRef.current) return;
      const point = toImageCoords(e);
      if (!point) return;
      const last = lastPointRef.current;
      if (last) {
        paintSegment(last, point);
      }
      lastPointRef.current = point;
    },
    [toImageCoords, paintSegment],
  );

  const stopPainting = useCallback(() => {
    if (!paintingRef.current) return;
    paintingRef.current = false;
    lastPointRef.current = null;
    // Send a full snapshot so the player view is guaranteed in sync
    const canvas = fogCanvasRef.current;
    if (canvas) {
      window.electronAPI?.sendFogSync(canvas.toDataURL());
    }
  }, []);

  // Mouse wheel adjusts the brush size while a fog brush is selected.
  // Uses a native non-passive listener: React delegates `wheel` to the root as a
  // passive listener, so e.preventDefault() in onWheel would be ignored and the
  // main viewport would scroll underneath.
  useEffect(() => {
    const canvas = fogCanvasRef.current;
    if (!canvas) return;
    const onWheel = (e: WheelEvent) => {
      if (brushModeRef.current === null) return;
      e.preventDefault();
      setBrushSize((size) => clamp(size - Math.sign(e.deltaY) * BRUSH_STEP, MIN_BRUSH, MAX_BRUSH));
    };
    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', onWheel);
  }, [imageUrl]);

  // ─── Viewport frame dragging ────────────────────────────────────────────────

  const handleFramePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    e.preventDefault();
    if (!panRef.current) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    frameDragRef.current = { startX: e.clientX, startY: e.clientY, startPan: panRef.current };
    setCursorPos(null);
  };

  const handleFramePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = frameDragRef.current;
    if (!drag) return;
    e.stopPropagation();
    const img = imgRef.current;
    if (!img || !img.naturalWidth || !viewportSize) return;
    const rect = img.getBoundingClientRect();
    const s = img.naturalWidth / rect.width;
    const dx = (e.clientX - drag.startX) * s;
    const dy = (e.clientY - drag.startY) * s;
    const viewW = viewportSize.w / zoom;
    const viewH = viewportSize.h / zoom;
    const next = {
      x: clamp(drag.startPan.x + dx, 0, Math.max(0, img.naturalWidth - viewW)),
      y: clamp(drag.startPan.y + dy, 0, Math.max(0, img.naturalHeight - viewH)),
    };
    panRef.current = next;
    setPan(next);
    window.electronAPI?.sendViewportPan(next.x, next.y);
  };

  const handleFramePointerUp = () => {
    frameDragRef.current = null;
  };

  const handleOpenView = useCallback(async () => {
    await window.electronAPI?.createViewOnly();
    setViewOpen(true);
  }, []);

  // Apply the typed zoom percentage (on blur or Enter)
  const commitZoomText = useCallback(() => {
    const parsed = parseFloat(zoomText);
    if (Number.isFinite(parsed) && parsed > 0) {
      setZoom(clampZoom(parsed / 100));
    } else {
      // Invalid/empty — fall back to the current zoom
      setZoomText(String(Math.round(zoom * 100)));
    }
  }, [zoomText, zoom]);

  // Keep the text field in sync when zoom changes from the slider or Reset,
  // unless the field is being edited
  const zoomTextFocusedRef = useRef(false);
  useEffect(() => {
    if (!zoomTextFocusedRef.current) {
      setZoomText(String(Math.round(zoom * 100)));
    }
  }, [zoom]);

  // Display scale of the image in the main window (displayed px per natural px)
  const img = imgRef.current;
  const displayScale =
    displaySize && img && img.naturalWidth > 0 ? displaySize.w / img.naturalWidth : 1;
  const cursorDiameter = Math.max(4, brushSize * 2 * displayScale);

  // ─── Frame physical size & grid ──────────────────────────────────────────────
  // The frame mirrors the player viewport, so its aspect ratio equals the
  // viewport's. From the entered diagonal we derive the width/height, then use
  // the grid size to compute the cell size in screen pixels for the grid overlay.
  // All values are in the same user-defined unit — only the ratio matters.
  const diagonalIn = parseFloat(playerViewDiagonal);
  const hasValidDiagonal = Number.isFinite(diagonalIn) && diagonalIn > 0;
  let gridSizeIn = parseFloat(gridSize);
  if (!Number.isFinite(gridSizeIn) || gridSizeIn <= 0) gridSizeIn = 1;
  let frameWidthIn = 0;
  let frameHeightIn = 0;
  let gridCellPx = 0;
  if (hasValidDiagonal && viewportSize && viewportSize.w > 0 && viewportSize.h > 0) {
    const aspect = viewportSize.w / viewportSize.h;
    const norm = Math.sqrt(aspect * aspect + 1);
    frameWidthIn = (diagonalIn * aspect) / norm;
    frameHeightIn = diagonalIn / norm;
    const frameWpx = (viewportSize.w / zoom) * displayScale;
    gridCellPx = frameWpx / (frameWidthIn / gridSizeIn); // screen px per grid cell
  }







  return (
    <div className="h-full flex flex-col bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-sans transition-colors selection:bg-amber-500 selection:text-white overflow-hidden">
      {/* Top Application Header */}
      <header className="shrink-0 border-b border-zinc-200 dark:border-zinc-800 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md px-4 sm:px-6 py-3 flex items-center justify-between gap-4 z-20">
        <div className="flex items-center gap-2 min-w-0">
          <Monitor className="w-5 h-5 text-amber-500 shrink-0" />
          <h1 className="text-sm font-bold truncate">Map Display</h1>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleSelectImage}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-zinc-950 transition-colors"
          >
            <ImagePlus className="w-3.5 h-3.5" />
            Select Image
          </button>
          <button
            onClick={handleOpenView}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-zinc-800 dark:bg-zinc-700 hover:bg-zinc-700 dark:hover:bg-zinc-600 text-zinc-100 transition-colors"
          >
            <Monitor className="w-3.5 h-3.5" />
            {viewOpen ? 'Player View Open' : 'Open Player View'}
          </button>

          {/* Opens the Player's View configuration modal */}
          <button
            onClick={() => setShowPlayerConfig(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-900 dark:text-zinc-100 transition-colors"
          >
            <Settings className="w-3.5 h-3.5" />
            Configure Player's View
          </button>
        </div>
      </header>

      {/* Zoom + Brush Controls */}
      <div className="shrink-0 border-b border-zinc-200 dark:border-zinc-800 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md px-4 sm:px-6 py-2 flex items-center justify-center gap-4 z-20 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 whitespace-nowrap">
            Player view zoom
          </span>
          {/* Editable zoom percentage (type a value, e.g. 150 → 150%) */}
          <div className="flex items-center gap-0.5">
            <input
              type="number"
              min={Math.round(MIN_ZOOM * 100)}
              max={Math.round(MAX_ZOOM * 100)}
              step={5}
              value={zoomText}
              onChange={(e) => setZoomText(e.target.value)}
              onFocus={(e) => {
                zoomTextFocusedRef.current = true;
                // Select the whole value so it can be retyped immediately
                e.currentTarget.select();
              }}
              onBlur={() => {
                zoomTextFocusedRef.current = false;
                commitZoomText();
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.currentTarget.blur();
              }}
              className="[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none w-14 px-1.5 py-1.5 rounded-md text-xs font-mono font-semibold text-right tabular-nums bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
            <span className="text-xs font-mono font-semibold text-zinc-500 dark:text-zinc-400">%</span>
          </div>
          {/* Logarithmic zoom slider */}
          <input
            type="range"
            min={0}
            max={SLIDER_STEPS}
            step={1}
            value={Math.round(zoomToSlider(zoom))}
            onChange={(e) => setZoom(clampZoom(sliderToZoom(Number(e.target.value))))}
            title="Logarithmic zoom slider"
            className="w-32 accent-amber-500"
          />
        </div>

        <div className="h-5 w-px bg-zinc-200 dark:bg-zinc-700" />

        {/* Brush mode toggle — click to activate, click again to deactivate.
            Disabled while no image is selected. */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setBrushMode((m) => (m === 'remove' ? null : 'remove'))}
            disabled={!imageUrl}
            title="Remove fog (reveal map)"
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
              brushMode === 'remove'
                ? 'bg-amber-500 text-zinc-950'
                : 'bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700'
            }`}
          >
            <Eraser className="w-3.5 h-3.5" />
            Remove Fog
          </button>
          <button
            onClick={() => setBrushMode((m) => (m === 'add' ? null : 'add'))}
            disabled={!imageUrl}
            title="Add fog (cover map)"
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
              brushMode === 'add'
                ? 'bg-amber-500 text-zinc-950'
                : 'bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700'
            }`}
          >
            <Brush className="w-3.5 h-3.5" />
            Add Fog
          </button>
        </div>

        <div className="h-5 w-px bg-zinc-200 dark:bg-zinc-700" />

        <div className="flex items-center gap-2">
          <span
            className="text-xs font-semibold text-zinc-500 dark:text-zinc-400"
            title={brushMode ? 'Scroll on the image to resize the brush' : 'Brush size'}
          >
            Brush
          </span>
          <input
            type="range"
            min={MIN_BRUSH}
            max={MAX_BRUSH}
            step={BRUSH_STEP}
            value={brushSize}
            onChange={(e) => setBrushSize(Number(e.target.value))}
            className="w-28 accent-amber-500"
          />
          <span className="text-xs font-mono font-semibold w-10 text-center tabular-nums text-zinc-500 dark:text-zinc-400">
            {brushSize}
          </span>
        </div>

        {/* Fill: adds fog everywhere when "Add Fog" is selected, clears it
            everywhere when "Remove Fog" is selected */}
        <button
          onClick={fillAllFog}
          disabled={!imageUrl || !brushMode}
          title={
            brushMode === 'add'
              ? 'Fill the entire map with fog'
              : brushMode === 'remove'
              ? 'Reveal the entire map (remove all fog)'
              : 'Select Add Fog or Remove Fog first'
          }
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-semibold bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <PaintBucket className="w-3.5 h-3.5" />
          Fill
        </button>
      </div>

      {/* Main Viewport — image always shown full (fit to window) */}
      <main ref={mainRef} className="flex-1 w-full overflow-auto min-h-0 flex items-center justify-center p-6">
        {imageUrl ? (
          <div
            className="relative inline-block overflow-hidden"
            style={{
              width: displaySize?.w ?? 0,
              height: displaySize?.h ?? 0,
            }}
          >
            <img
              ref={imgRef}
              src={imageUrl}
              alt="Selected map"
              draggable={false}
              onLoad={handleImageLoad}
              className="block select-none"
              style={{ width: displaySize?.w, height: displaySize?.h }}
            />
            {/* Fog of war layer (dark) — paint with the round brush to reveal */}
            <canvas
              ref={fogCanvasRef}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={stopPainting}
              onMouseLeave={() => {
                setCursorPos(null);
                stopPainting();
              }}
              className={`absolute inset-0 ${brushMode ? 'cursor-none' : 'cursor-default'}`}
              style={{ width: displaySize?.w, height: displaySize?.h, opacity: 0.85 }}
            />
            {/* Frame showing the current player window view — draggable to pan
                only when no fog brush is active */}
            {pan && viewportSize && (
              <div
                className={`absolute border-2 border-sky-400/90 bg-sky-400/10 z-10 ${
                  brushMode ? 'pointer-events-none' : 'cursor-move'
                }`}
                style={{
                  left: pan.x * displayScale,
                  top: pan.y * displayScale,
                  width: (viewportSize.w / zoom) * displayScale,
                  height: (viewportSize.h / zoom) * displayScale,
                }}
                onPointerDown={handleFramePointerDown}
                onPointerMove={handleFramePointerMove}
                onPointerUp={handleFramePointerUp}
                onPointerCancel={handleFramePointerUp}
              >
                {/* 1-inch grid overlay (only when a diagonal size is set) */}
                {gridCellPx > 0 && (
                  <div
                    className="absolute inset-0 pointer-events-none"
                    style={{
                      backgroundImage:
                        `repeating-linear-gradient(to right, rgba(56,189,248,0.4) 0 1px, transparent 1px ${gridCellPx}px), ` +
                        `repeating-linear-gradient(to bottom, rgba(56,189,248,0.4) 0 1px, transparent 1px ${gridCellPx}px)`,
                    }}
                  />
                )}
              </div>
            )}
            {/* Brush cursor (only when a fog brush is active) */}
            {cursorPos && brushMode && (
              <div
                className="absolute rounded-full border-2 border-amber-400/90 bg-amber-400/10 pointer-events-none"
                style={{
                  width: cursorDiameter,
                  height: cursorDiameter,
                  left: cursorPos.x - cursorDiameter / 2,
                  top: cursorPos.y - cursorDiameter / 2,
                }}
              />
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 text-zinc-400 dark:text-zinc-600">
            <ImagePlus className="w-12 h-12" />
            <p className="text-sm font-medium">No image selected</p>
            <p className="text-xs">Click "Select Image" to choose a map image from disk</p>
          </div>
        )}
      </main>

      {/* Player's View Configuration Modal */}
      {showPlayerConfig && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setShowPlayerConfig(false)}
        >
          <div
            data-modal
            className="w-96 max-w-[calc(100vw-2rem)] rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
              <h2 className="text-sm font-bold">Configure Player's View</h2>
              <button
                onClick={() => setShowPlayerConfig(false)}
                className="p-1 rounded-md text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal body */}
            <div className="px-4 py-4 flex flex-col gap-4">
              {/* Diagonal size */}
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="player-view-size"
                  className="text-xs font-semibold text-zinc-600 dark:text-zinc-300"
                >
                  Player's View Size
                </label>
                <input
                  id="player-view-size"
                  type="number"
                  min="0"
                  step="0.5"
                  value={playerViewDiagonal}
                  onChange={(e) => setPlayerViewDiagonal(e.target.value)}
                  placeholder=""
                  className="[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none px-2 py-1.5 rounded-md text-xs bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  Diagonal of the player's screen.
                </p>
              </div>

              {/* Grid size */}
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="grid-size"
                  className="text-xs font-semibold text-zinc-600 dark:text-zinc-300"
                >
                  Grid size
                </label>
                <input
                  id="grid-size"
                  type="number"
                  min="0"
                  step="0.5"
                  value={gridSize}
                  onChange={(e) => setGridSize(e.target.value)}
                  placeholder="1"
                  className="[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none px-2 py-1.5 rounded-md text-xs bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  Size of each grid square.
                </p>
              </div>

              {/* Derived dimensions readout */}
              {hasValidDiagonal && frameWidthIn > 0 && (
                <div className="px-3 py-2 rounded-md bg-zinc-100 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-zinc-600 dark:text-zinc-300">
                      Frame dimensions
                    </span>
                    <span className="text-[11px] font-mono text-zinc-700 dark:text-zinc-200 tabular-nums">
                      {frameWidthIn.toFixed(2)} × {frameHeightIn.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-[11px] font-semibold text-zinc-600 dark:text-zinc-300">
                      Grid squares
                    </span>
                    <span className="text-[11px] font-mono text-zinc-700 dark:text-zinc-200 tabular-nums">
                      {Math.floor(frameWidthIn / gridSizeIn)} ×{' '}
                      {Math.floor(frameHeightIn / gridSizeIn)}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Modal footer */}
            <div className="flex justify-end px-4 py-3 border-t border-zinc-200 dark:border-zinc-800">
              <button
                onClick={() => setShowPlayerConfig(false)}
                className="px-3 py-1.5 rounded-md text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-zinc-950 transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
