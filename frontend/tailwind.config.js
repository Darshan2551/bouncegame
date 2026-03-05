export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        arena: {
          950: "#04070e",
          900: "#09111f",
          800: "#0f1d34",
          700: "#143257",
          cyan: "#3cf3ff",
          lime: "#8dff9b",
          ember: "#ff8d59",
        },
      },
      boxShadow: {
        neon: "0 0 24px rgba(60, 243, 255, 0.35)",
      },
      fontFamily: {
        display: ["Orbitron", "sans-serif"],
        body: ["Rajdhani", "sans-serif"],
      },
      backgroundImage: {
        "arena-grid":
          "linear-gradient(rgba(60,243,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(60,243,255,0.08) 1px, transparent 1px)",
      },
    },
  },
  plugins: [],
};