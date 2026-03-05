import { motion } from "framer-motion";

const ORBS = [
  { top: "8%", left: "8%", size: 280, color: "rgba(60,243,255,0.22)", duration: 18 },
  { top: "14%", right: "12%", size: 260, color: "rgba(141,255,155,0.18)", duration: 20 },
  { bottom: "12%", left: "20%", size: 320, color: "rgba(255,141,89,0.16)", duration: 23 },
];

export default function AnimatedBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 grid-overlay opacity-45" />
      {ORBS.map((orb, idx) => (
        <motion.div
          key={idx}
          className="absolute rounded-full blur-3xl"
          style={{
            width: orb.size,
            height: orb.size,
            background: orb.color,
            ...orb,
          }}
          animate={{
            y: [0, 22, -16, 0],
            x: [0, -18, 14, 0],
            scale: [1, 1.08, 0.95, 1],
          }}
          transition={{
            duration: orb.duration,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}