/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0F1417",        // app background
        panel: "#171D21",      // sidebar / header surface
        raised: "#1F262B",     // hover / cards / input fields
        line: "#262E33",       // borders, dividers
        signal: "#FFB454",     // primary accent — "transmission" amber
        "signal-dim": "#C98A3C",
        frost: "#E8EDEF",      // primary text
        mist: "#7C8B93",       // secondary text
        danger: "#E56B6B",
      },
      fontFamily: {
        display: ["'Space Grotesk'", "sans-serif"],
        body: ["Inter", "sans-serif"],
        mono: ["'JetBrains Mono'", "monospace"],
      },
      keyframes: {
        "ping-slow": {
          "0%": { transform: "scale(1)", opacity: "0.6" },
          "100%": { transform: "scale(2.2)", opacity: "0" },
        },
        blink: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.25" },
        },
      },
      animation: {
        "ping-slow": "ping-slow 1.8s cubic-bezier(0,0,0.2,1) infinite",
        blink: "blink 1.2s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
