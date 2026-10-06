import React, { useEffect, useRef, useState } from 'react';
import { Info } from 'lucide-react';

const SEEN_KEY = 'dm_companion_shortcuts_seen';

const Kbd: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <kbd className="inline-flex items-center justify-center min-w-[1.4rem] px-1.5 py-0.5 mx-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-600 text-[10px] font-bold text-zinc-700 dark:text-zinc-200 font-mono">
    {children}
  </kbd>
);

export const KeyboardShortcutsInfo: React.FC = () => {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const markSeen = () => {
    try {
      localStorage.setItem(SEEN_KEY, '1');
    } catch {
      /* storage unavailable - the hint just shows again next launch */
    }
  };

  // Auto-open on first launch only.
  useEffect(() => {
    let seen: string | null = null;
    try {
      seen = localStorage.getItem(SEEN_KEY);
    } catch {
      /* ignore */
    }
    if (!seen) setOpen(true);
  }, []);

  const close = () => {
    setOpen(false);
    markSeen();
  };

  // Dismiss on outside click or Escape.
  useEffect(() => {
    if (!open) return;

    const onPointerDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) close();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        close();
      }
    };

    document.addEventListener('mousedown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className="relative shrink-0">
      <button
        onClick={() => (open ? close() : setOpen(true))}
        aria-label="Keyboard shortcuts"
        aria-expanded={open}
        title="Keyboard shortcuts"
        className="flex items-center justify-center w-[30px] h-[30px] rounded-xl border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200 transition-all active:scale-95"
      >
        <Info className="w-4 h-4" />
      </button>

      {open && (
        <div
          role="tooltip"
          className="absolute left-0 top-full mt-2 z-50 w-[19rem] rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 shadow-xl shadow-zinc-900/10 p-4 text-left animate-in fade-in duration-150"
        >
          <div className="flex items-center justify-between gap-3 mb-2.5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Keyboard Shortcuts
            </h4>
            <button
              onClick={close}
              className="text-[10px] font-bold text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
            >
              Dismiss
            </button>
          </div>

          <ul className="flex flex-col gap-2 text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed list-none">
            <li className="flex gap-1.5">
              <span className="text-amber-500 select-none">•</span>
              <span>For speed, you can always use the keyboard.</span>
            </li>
            <li className="flex gap-1.5">
              <span className="text-amber-500 select-none">•</span>
              <span>
                <Kbd>Enter</Kbd> adds a new combatant and always confirms the current
                modal/option.
              </span>
            </li>
            <li className="flex gap-1.5">
              <span className="text-amber-500 select-none">•</span>
              <span>
                <Kbd>Esc</Kbd> cancels the current modal/option.
              </span>
            </li>
            <li className="flex gap-1.5">
              <span className="text-amber-500 select-none">•</span>
              <span>
                <Kbd>Tab</Kbd> cycles the fields, and <Kbd>Shift</Kbd>
                <span className="mx-0.5">+</span>
                <Kbd>Tab</Kbd> does it in the reverse order.
              </span>
            </li>
            <li className="flex gap-1.5">
              <span className="text-amber-500 select-none">•</span>
              <span>
                <Kbd>Space</Kbd> advances the turn, and <Kbd>Shift</Kbd>
                <span className="mx-0.5">+</span>
                <Kbd>Space</Kbd> reverts it.
              </span>
            </li>
          </ul>
        </div>
      )}
    </div>
  );
};
