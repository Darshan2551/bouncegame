import { useMemo, useRef, useState } from "react";

function useTouchDevice() {
  return useMemo(() => {
    if (typeof window === "undefined") {
      return false;
    }
    const coarse = window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
    const touchCapable = navigator.maxTouchPoints > 0 || "ontouchstart" in window;
    const mobileWidth = window.innerWidth <= 1024;
    return coarse || touchCapable || mobileWidth;
  }, []);
}

export default function MobileControls({ onDirection, onTargetY }) {
  const isTouchDevice = useTouchDevice();
  const [active, setActive] = useState(0);
  const draggingRef = useRef(false);

  if (!isTouchDevice) {
    return null;
  }

  const updateTarget = (event) => {
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    const source = event.touches?.[0] || event.changedTouches?.[0] || event;
    if (!source || typeof source.clientY !== "number") {
      return;
    }
    const ratio = (source.clientY - rect.top) / rect.height;
    onTargetY(Math.max(0, Math.min(1, ratio)));
  };

  const handlePointerDown = (event) => {
    draggingRef.current = true;
    if (event.currentTarget.setPointerCapture) {
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    updateTarget(event);
  };

  const handlePointerMove = (event) => {
    if (!draggingRef.current) {
      return;
    }
    updateTarget(event);
  };

  const handlePointerEnd = (event) => {
    if (event.currentTarget.releasePointerCapture && event.pointerId !== undefined) {
      try {
        event.currentTarget.releasePointerCapture(event.pointerId);
      } catch (_error) {
        // ignore if pointer already released
      }
    }
    draggingRef.current = false;
    onTargetY(null);
  };

  return (
    <div className="grid gap-3 md:hidden" style={{ touchAction: "none" }}>
      <div
        className="neon-panel relative h-32 rounded-xl select-none"
        style={{ touchAction: "none" }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        onTouchStart={updateTarget}
        onTouchMove={updateTarget}
        onTouchEnd={handlePointerEnd}
      >
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs uppercase tracking-[0.2em] text-slate-300">
          Slide to move
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          className={`neon-button rounded-xl py-3 text-sm font-semibold uppercase ${
            active === -1 ? "ring-2 ring-cyan-200" : ""
          }`}
          style={{ touchAction: "none" }}
          onPointerDown={(event) => {
            event.preventDefault();
            setActive(-1);
            onDirection(-1);
          }}
          onPointerUp={(event) => {
            event.preventDefault();
            setActive(0);
            onDirection(0);
          }}
          onPointerCancel={() => {
            setActive(0);
            onDirection(0);
          }}
          onPointerLeave={() => {
            setActive(0);
            onDirection(0);
          }}
        >
          Up
        </button>
        <button
          type="button"
          className={`neon-button rounded-xl py-3 text-sm font-semibold uppercase ${
            active === 1 ? "ring-2 ring-cyan-200" : ""
          }`}
          style={{ touchAction: "none" }}
          onPointerDown={(event) => {
            event.preventDefault();
            setActive(1);
            onDirection(1);
          }}
          onPointerUp={(event) => {
            event.preventDefault();
            setActive(0);
            onDirection(0);
          }}
          onPointerCancel={() => {
            setActive(0);
            onDirection(0);
          }}
          onPointerLeave={() => {
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
