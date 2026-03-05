import { useMemo, useState } from "react";

function useTouchDevice() {
  return useMemo(() => {
    if (typeof window === "undefined") {
      return false;
    }
    return window.matchMedia("(pointer: coarse)").matches;
  }, []);
}

export default function MobileControls({ onDirection, onTargetY }) {
  const isTouchDevice = useTouchDevice();
  const [active, setActive] = useState(0);

  if (!isTouchDevice) {
    return null;
  }

  const handleTouch = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const touch = event.touches[0];
    if (!touch) {
      return;
    }
    const ratio = (touch.clientY - rect.top) / rect.height;
    onTargetY(Math.max(0, Math.min(1, ratio)));
  };

  return (
    <div className="grid gap-3 md:hidden">
      <div
        className="neon-panel relative h-32 rounded-xl"
        onTouchStart={handleTouch}
        onTouchMove={handleTouch}
        onTouchEnd={() => onTargetY(null)}
      >
        <div className="absolute inset-0 flex items-center justify-center text-xs uppercase tracking-[0.2em] text-slate-300">
          Slide to move
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          className={`neon-button rounded-xl py-3 text-sm font-semibold uppercase ${active === -1 ? "ring-2 ring-cyan-200" : ""}`}
          onTouchStart={() => {
            setActive(-1);
            onDirection(-1);
          }}
          onTouchEnd={() => {
            setActive(0);
            onDirection(0);
          }}
        >
          Up
        </button>
        <button
          type="button"
          className={`neon-button rounded-xl py-3 text-sm font-semibold uppercase ${active === 1 ? "ring-2 ring-cyan-200" : ""}`}
          onTouchStart={() => {
            setActive(1);
            onDirection(1);
          }}
          onTouchEnd={() => {
            setActive(0);
            onDirection(0);
          }}
        >
          Down
        </button>
      </div>
    </div>
  );
}