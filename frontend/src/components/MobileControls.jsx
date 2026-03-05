import { useMemo, useState } from "react";

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

  return (
    <div className="grid gap-3 md:hidden" style={{ touchAction: "none" }}>
      <div
        className="neon-panel relative h-32 rounded-xl select-none"
        style={{ touchAction: "none" }}
        onPointerDown={updateTarget}
        onPointerMove={(event) => {
          if (event.buttons > 0) {
            updateTarget(event);
          }
        }}
        onPointerUp={() => onTargetY(null)}
        onPointerCancel={() => onTargetY(null)}
        onTouchStart={updateTarget}
        onTouchMove={updateTarget}
        onTouchEnd={() => onTargetY(null)}
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