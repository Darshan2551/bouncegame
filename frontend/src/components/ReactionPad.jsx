import { EMOJIS, ROASTS } from "../lib/constants";

export default function ReactionPad({ onSend }) {
  return (
    <div className="neon-panel rounded-xl p-3">
      <div className="text-xs uppercase tracking-[0.18em] text-slate-300">Emoji Roasts</div>
      <div className="mt-2 grid grid-cols-6 gap-2">
        {EMOJIS.map((emoji) => (
          <button
            key={emoji}
            type="button"
            onClick={() => onSend("emoji", emoji)}
            className="rounded-md border border-cyan-300/30 bg-slate-900/80 py-1 text-lg hover:border-cyan-300/70"
          >
            {emoji}
          </button>
        ))}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {ROASTS.map((roast) => (
          <button
            key={roast}
            type="button"
            onClick={() => onSend("roast", roast)}
            className="rounded-md border border-amber-300/30 bg-slate-900/80 px-2 py-1 text-xs uppercase tracking-wide hover:border-amber-300/60"
          >
            {roast}
          </button>
        ))}
      </div>
    </div>
  );
}