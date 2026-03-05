export default function HowToPanel({ onClose }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center p-4">
      <div className="neon-panel w-full max-w-2xl rounded-2xl p-6">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-3xl uppercase tracking-[0.14em] text-white">How to Play</h2>
          <button type="button" className="neon-button rounded-lg px-3 py-1 text-xs uppercase" onClick={onClose}>
            Back
          </button>
        </div>

        <ul className="mt-4 space-y-3 text-lg text-slate-200">
          <li>Two teams face off across the arena. Bounce the ball using your paddle.</li>
          <li>Miss the ball and the opposite team scores.</li>
          <li>First team to the winning score takes the match.</li>
          <li>Controls: <span className="font-semibold text-arena-cyan">W/S</span> or <span className="font-semibold text-arena-cyan">Arrow Keys</span>. Mobile supports touch controls.</li>
          <li>Power-ups spawn every 20-30 seconds: speed, smash, shield, curve, and freeze.</li>
          <li>Use emoji and roast buttons during live play for instant reactions.</li>
        </ul>
      </div>
    </div>
  );
}