import React, { useEffect, useRef, useState } from 'react';
import {
  ImagePlus,
  Trash2,
  Pencil,
  FolderOpen,
  Map as MapIcon,
} from 'lucide-react';
import type { MapEntryMeta } from '../types/map';

interface MapLibraryPanelProps {
  maps: MapEntryMeta[];
  currentMapId: string | null;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onRename: (id: string, name: string) => void;
  onRemove: (id: string) => void;
  onRevealFolder: () => void;
  loading: boolean;
}

export const MapLibraryPanel: React.FC<MapLibraryPanelProps> = ({
  maps,
  currentMapId,
  onSelect,
  onAdd,
  onRename,
  onRemove,
  onRevealFolder,
  loading,
}) => {
  // Per-id thumbnail cache, filled lazily as each row mounts. Keyed in a ref so
  // a re-render doesn't refetch what we already have.
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const requestedRef = useRef<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');

  // Fetch any thumbnail we don't have yet
  useEffect(() => {
    let cancelled = false;
    for (const map of maps) {
      if (requestedRef.current.has(map.id)) continue;
      requestedRef.current.add(map.id);
      window.electronAPI?.loadLibraryThumb(map.id).then((url) => {
        if (cancelled || !url) return;
        setThumbs((prev) => ({ ...prev, [map.id]: url }));
      });
    }
    return () => {
      cancelled = true;
    };
  }, [maps]);

  const startRename = (map: MapEntryMeta) => {
    setEditingId(map.id);
    setDraftName(map.name);
  };

  const commitRename = () => {
    if (editingId && draftName.trim() && draftName.trim() !== maps.find((m) => m.id === editingId)?.name) {
      onRename(editingId, draftName.trim());
    }
    setEditingId(null);
  };

  const cancelRename = () => {
    setEditingId(null);
    setDraftName('');
  };

  return (
    <aside className="shrink-0 w-64 sm:w-72 border-r border-zinc-200 dark:border-zinc-800 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md flex flex-col min-h-0">
      {/* Panel header */}
      <div className="shrink-0 px-3 py-3 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-2">
        <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          Maps
        </h2>
        <div className="flex items-center gap-1">
          <button
            onClick={onRevealFolder}
            title="Open the library folder on disk"
            aria-label="Open library folder"
            className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <FolderOpen className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onAdd}
            title="Add map images to the library"
            className="flex items-center gap-1 px-2 py-1.5 rounded-md text-[11px] font-bold bg-amber-500 hover:bg-amber-400 text-zinc-950 transition-colors"
          >
            <ImagePlus className="w-3.5 h-3.5" />
            Add
          </button>
        </div>
      </div>

      {/* Map list */}
      <div className="flex-1 overflow-y-auto min-h-0 p-2">
        {loading && maps.length === 0 ? (
          <div className="flex items-center justify-center gap-2 py-8 text-xs text-zinc-400">
            <span className="w-3 h-3 rounded-full border-2 border-zinc-300 dark:border-zinc-700 border-t-amber-500 animate-spin" />
            Loading library…
          </div>
        ) : maps.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 px-3 text-center">
            <MapIcon className="w-8 h-8 text-zinc-300 dark:text-zinc-700" />
            <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">No maps yet</p>
            <p className="text-[11px] text-zinc-400 dark:text-zinc-500 leading-relaxed">
              Add an image to load it here. Fog, zoom and position are saved per map and restored
              automatically.
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {maps.map((map) => {
              const isCurrent = map.id === currentMapId;
              const isEditing = editingId === map.id;
              return (
                <li key={map.id}>
                  <div
                    className={`group relative rounded-lg border transition-colors ${
                      isCurrent
                        ? 'border-amber-500 bg-amber-500/10'
                        : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
                    }`}
                  >
                    <button
                      onClick={() => !isEditing && onSelect(map.id)}
                      className="w-full text-left p-2 flex items-center gap-2.5 min-w-0"
                      title={isCurrent ? `${map.name} (currently loaded)` : `Load ${map.name}`}
                    >
                      {/* Thumbnail */}
                      <span className="shrink-0 w-12 h-12 rounded-md overflow-hidden bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center border border-zinc-200 dark:border-zinc-700/60">
                        {thumbs[map.id] ? (
                          <img
                            src={thumbs[map.id]}
                            alt=""
                            className="w-full h-full object-cover"
                            draggable={false}
                          />
                        ) : (
                          <MapIcon className="w-4 h-4 text-zinc-400" />
                        )}
                      </span>

                      {/* Name + details */}
                      <span className="min-w-0 flex-1 flex flex-col gap-0.5">
                        {isEditing ? (
                          <input
                            autoFocus
                            value={draftName}
                            onChange={(e) => setDraftName(e.target.value)}
                            onBlur={commitRename}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') commitRename();
                              if (e.key === 'Escape') cancelRename();
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className="w-full px-1 py-0.5 rounded bg-white dark:bg-zinc-950 border border-amber-500 text-xs font-semibold text-zinc-900 dark:text-zinc-100 focus:outline-none"
                          />
                        ) : (
                          <span
                            className={`text-xs font-bold truncate ${
                              isCurrent
                                ? 'text-amber-700 dark:text-amber-400'
                                : 'text-zinc-800 dark:text-zinc-100'
                            }`}
                          >
                            {map.name}
                          </span>
                        )}
                        <span className="text-[10px] font-mono text-zinc-400 dark:text-zinc-500 truncate">
                          {map.width}×{map.height} · {Math.round(map.zoom * 100)}%
                          {map.hasFog ? ' · fog' : ''}
                        </span>
                      </span>
                    </button>

                    {/* Hover actions */}
                    {!isEditing && (
                      <div className="absolute top-1.5 right-1.5 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            startRename(map);
                          }}
                          title="Rename map"
                          aria-label={`Rename ${map.name}`}
                          className="p-1 rounded bg-white/90 dark:bg-zinc-800/90 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 shadow-sm transition-colors"
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onRemove(map.id);
                          }}
                          title="Remove map from library (deletes its saved fog)"
                          aria-label={`Remove ${map.name}`}
                          className="p-1 rounded bg-white/90 dark:bg-zinc-800/90 text-zinc-400 hover:text-rose-500 transition-colors"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Footer hint */}
      <div className="shrink-0 px-3 py-2 border-t border-zinc-200 dark:border-zinc-800">
        <p className="text-[10px] text-zinc-400 dark:text-zinc-500 leading-relaxed">
          Maps are stored on disk, so your fog and view survive restarts.
        </p>
      </div>
    </aside>
  );
};
