import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Map as MapIcon, Maximize2, Minimize2 } from 'lucide-react';
import type { MapState } from '../types/map';
import type { BrushMode } from '../types/electron';

const DEFAULT_STATE: MapState = { imageUrl: null, zoom: 1 };

export const ViewOnlyMap: React.FC = () => {
  const [state, setState] = useState<MapState>(DEFAULT_STATE);
  const [pan, setPan] = useState<{ x: number; y: number } | null>(null);
  const [isFullScreen, setIsFullScreen] = useState(false);

  const imgRef = useRef<HTMLImageElement>(null);
  const fogCanvasRef = useRef<HTMLCanvasElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  // Fog snapshot that arrived before the image (and its canvas) was ready
  const pendingFogRef = useRef<string | null>(null);

  // ─── Fog helpers ────────────────────────────────────────────────────────────

  const paintFogSegment = (mode: BrushMode, x0: number, y0: number, x1: number, y1: number, radius: number) => {
    const canvas = fogCanvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || canvas.width === 0) return;
    if (mode === 'add') {
      // Paint fog back — solid black on the player view
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = '#000000';
    } else {
      // Erase fog to reveal the map
      ctx.globalCompositeOperation = 'destination-out';
    }
    ctx.lineWidth = radius * 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
  };

  const fillBlack = () => {
    const canvas = fogCanvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  };

  // Apply a full fog snapshot from the main window. The snapshot stores removed
  // areas as *transparent* holes, which cannot be composited onto a black fill
  // (transparent pixels don't erase the destination). Instead, process it into
  // a solid-black mask with truly transparent holes and draw that on a cleared
  // canvas — the result is completely black fog with real holes showing the map.
  const applyFogSnapshot = (dataUrl: string) => {
    const canvas = fogCanvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || canvas.width === 0) return;
    const img = new Image();
    img.onload = () => {
      const tmp = document.createElement('canvas');
      tmp.width = canvas.width;
      tmp.height = canvas.height;
      const tctx = tmp.getContext('2d');
      if (!tctx) return;
      tctx.drawImage(img, 0, 0);
      const imageData = tctx.getImageData(0, 0, tmp.width, tmp.height);
      const data = imageData.data;
      for (let i = 3; i < data.length; i += 4) {
        if (data[i] > 0) {
          // Fog pixel → solid black
          data[i - 3] = 0;
          data[i - 2] = 0;
          data[i - 1] = 0;
          data[i] = 255;
        } else {
          // Removed pixel → fully transparent hole
          data[i] = 0;
        }
      }
      tctx.putImageData(imageData, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.globalCompositeOperation = 'source-over';
      ctx.drawImage(tmp, 0, 0);
    };
    img.src = dataUrl;
  };

  // Size the fog canvas to the image's natural resolution, fill it black,
  // then apply any fog snapshot that arrived before the image was ready
  const resetFog = () => {
    const img = imgRef.current;
    const canvas = fogCanvasRef.current;
    if (!img || !canvas || !state.imageUrl) return;
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    fillBlack();
    if (pendingFogRef.current) {
      applyFogSnapshot(pendingFogRef.current);
      pendingFogRef.current = null;
    }
  };

  // ─── Subscriptions (registered before the first viewport report) ────────────

  useEffect(() => {
    // Request the latest map state immediately on mount
    window.electronAPI?.requestState().then((latest) => {
      if (latest) setState(latest);
    });

    // Request the current fog snapshot on mount — if the image hasn't loaded
    // yet (canvas not sized), queue it and apply it once the image is ready
    window.electronAPI?.requestFog().then((dataUrl) => {
      if (!dataUrl) return;
      const canvas = fogCanvasRef.current;
      if (canvas && canvas.width > 0) {
        applyFogSnapshot(dataUrl);
      } else {
        pendingFogRef.current = dataUrl;
      }
    });

    const unsubState = window.electronAPI?.onStateUpdate((latest) => {
      setState(latest);
    });
    const unsubStroke = window.electronAPI?.onFogStroke((mode, x0, y0, x1, y1, radius) => {
      paintFogSegment(mode, x0, y0, x1, y1, radius);
    });
    const unsubReset = window.electronAPI?.onFogReset(() => {
      fillBlack();
    });
    const unsubSync = window.electronAPI?.onFogSync((dataUrl) => {
      const canvas = fogCanvasRef.current;
      if (canvas && canvas.width > 0) {
        applyFogSnapshot(dataUrl);
      } else {
        // Image not loaded yet — queue the newest snapshot
        pendingFogRef.current = dataUrl;
      }
    });
    const unsubPan = window.electronAPI?.onViewportPan((x, y) => {
      setPan({ x, y });
    });

    return () => {
      unsubState?.();
      unsubStroke?.();
      unsubReset?.();
      unsubSync?.();
      unsubPan?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Viewport size reporting ────────────────────────────────────────────────

  // Report the viewport size to the main window (on mount and on resize) so it
  // can draw the view frame and compute the pan offset. This runs AFTER the
  // subscriptions above so the initial pan push is never missed.
  useEffect(() => {
    const el = mainRef.current;
    if (!el) return;
    const report = () => window.electronAPI?.sendViewportSize(el.clientWidth, el.clientHeight);
    report();
    const ro = new ResizeObserver(report);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ─── Full screen ────────────────────────────────────────────────────────────

  // Track full screen state so the floating button icon stays accurate even
  // when the user toggles full screen with F11.
  useEffect(() => {
    window.electronAPI?.isFullScreen().then(setIsFullScreen);
    const unsub = window.electronAPI?.onFullScreenChanged((full) => {
      setIsFullScreen(full);
      // Report the new viewport size to the main window
      const el = mainRef.current;
      if (el) {
        window.electronAPI?.sendViewportSize(el.clientWidth, el.clientHeight);
      }
    });
    return unsub;
  }, []);

  const toggleFullScreen = useCallback(async () => {
    await window.electronAPI?.toggleFullScreen();
  }, []);

  return (
    <div className="h-full flex flex-col bg-zinc-950 text-zinc-100 overflow-hidden">
      {/* Viewport — full window, not scrollable or draggable; the view is
          controlled entirely from the main window via the pan offset */}
      <main ref={mainRef} className="flex-1 relative overflow-hidden">
        {state.imageUrl && pan ? (
          <div
            className="absolute left-0 top-0"
            style={{
              // max-content makes the wrapper match the image's natural size
              // (shrink-to-fit would constrain it to the viewport width)
              width: 'max-content',
              height: 'max-content',
              transform: `translate(${-pan.x * state.zoom}px, ${-pan.y * state.zoom}px) scale(${state.zoom})`,
              transformOrigin: 'top left',
            }}
          >
            <img
              ref={imgRef}
              src={state.imageUrl}
              alt="Map"
              draggable={false}
              onLoad={resetFog}
              className="block select-none w-full h-full"
            />
            {/* Fog of war layer (completely black) — holes appear as the DM paints */}
            <canvas
              ref={fogCanvasRef}
              className="absolute inset-0 w-full h-full pointer-events-none"
            />
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center gap-3 text-zinc-600">
            <MapIcon className="w-12 h-12" />
            <p className="text-sm font-medium">Waiting for a map…</p>
            <p className="text-xs">Select an image from the main screen</p>
          </div>
        )}

        {/* Floating full screen toggle */}
        <button
          onClick={toggleFullScreen}
          title={isFullScreen ? 'Exit full screen (F11)' : 'Enter full screen (F11)'}
          aria-label={isFullScreen ? 'Exit full screen' : 'Enter full screen'}
          className="absolute bottom-3 right-3 z-20 p-2 rounded-md bg-black/50 hover:bg-black/75 text-zinc-200 hover:text-white transition-colors backdrop-blur-sm border border-zinc-700/60"
        >
          {isFullScreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </button>
      </main>
    </div>
  );
};
