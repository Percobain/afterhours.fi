import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    container: { center: true, padding: { DEFAULT: "1rem", sm: "1.5rem" }, screens: { "2xl": "1200px" } },
    extend: {
      colors: {
        bg: "#05060A",
        surface: { DEFAULT: "#0C0E14", 2: "#12151D", 3: "#191D27", 4: "#222735" },
        line: { DEFAULT: "#1E2330", strong: "#2A3142", soft: "#161A24" },
        ink: { DEFAULT: "#F5F7FB", 2: "#A9B1C3", 3: "#6C7489", 4: "#474E60" },
        // Protect (buyers): warm amber -> orange
        floor: { DEFAULT: "#FFB547", 2: "#FF8A3D", soft: "#FFB5471A", line: "#FFB54740", deep: "#C9822A" },
        // Earn (keepers): cyan -> indigo
        keeper: { DEFAULT: "#5CC8FF", 2: "#7B83FF", soft: "#5CC8FF1A", line: "#5CC8FF40" },
        held: { DEFAULT: "#3DDC97", soft: "#3DDC971A", line: "#3DDC9740" },
        gap: { DEFAULT: "#FF6B6B", soft: "#FF6B6B1A", line: "#FF6B6B40" },
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "ui-monospace", "monospace"],
      },
      fontSize: {
        "display-1": ["clamp(2.4rem, 4.4vw, 4.1rem)", { lineHeight: "1.04", letterSpacing: "-0.04em", fontWeight: "600" }],
        "display-2": ["clamp(1.9rem, 3.4vw, 3rem)", { lineHeight: "1.06", letterSpacing: "-0.035em", fontWeight: "600" }],
        "display-3": ["clamp(1.5rem, 2.6vw, 2.1rem)", { lineHeight: "1.15", letterSpacing: "-0.025em", fontWeight: "600" }],
      },
      boxShadow: {
        card: "0 1px 0 0 rgba(255,255,255,0.04) inset, 0 24px 60px -32px rgba(0,0,0,0.9)",
        glow: "0 0 0 1px rgba(255,181,71,0.25), 0 10px 40px -8px rgba(255,138,61,0.45)",
        "glow-keeper": "0 0 0 1px rgba(92,200,255,0.25), 0 10px 40px -8px rgba(123,131,255,0.45)",
        pop: "0 30px 80px -20px rgba(0,0,0,0.85), 0 0 0 1px rgba(255,255,255,0.06)",
      },
      borderRadius: { "4xl": "2rem" },
      keyframes: {
        aurora: { "0%,100%": { transform: "translate3d(0,0,0) rotate(0deg) scale(1)" }, "50%": { transform: "translate3d(3%,-4%,0) rotate(8deg) scale(1.1)" } },
        aurora2: { "0%,100%": { transform: "translate3d(0,0,0) scale(1)" }, "50%": { transform: "translate3d(-4%,3%,0) scale(1.08)" } },
        shimmer: { "0%": { backgroundPosition: "200% 0" }, "100%": { backgroundPosition: "-200% 0" } },
        marquee: { "0%": { transform: "translateX(0)" }, "100%": { transform: "translateX(-50%)" } },
        pulseRing: { "0%": { transform: "scale(0.8)", opacity: "0.7" }, "100%": { transform: "scale(2.2)", opacity: "0" } },
        float: { "0%,100%": { transform: "translateY(0)" }, "50%": { transform: "translateY(-8px)" } },
        spinSlow: { to: { transform: "rotate(360deg)" } },
        drawerIn: { "0%": { transform: "translateX(100%)" }, "100%": { transform: "translateX(0)" } },
        fadeIn: { "0%": { opacity: "0" }, "100%": { opacity: "1" } },
        stepIn: { "0%": { opacity: "0", transform: "translateX(14px)" }, "100%": { opacity: "1", transform: "translateX(0)" } },
      },
      animation: {
        aurora: "aurora 22s ease-in-out infinite",
        aurora2: "aurora2 28s ease-in-out infinite",
        shimmer: "shimmer 2.4s linear infinite",
        marquee: "marquee 48s linear infinite",
        "pulse-ring": "pulseRing 2s cubic-bezier(0.2,0.6,0.4,1) infinite",
        float: "float 6s ease-in-out infinite",
        "spin-slow": "spinSlow 18s linear infinite",
        "step-in": "stepIn 0.22s ease-out both",
        "drawer-in": "drawerIn 0.28s cubic-bezier(0.22,1,0.36,1) both",
        "fade-in": "fadeIn 0.2s ease-out both",
      },
    },
  },
  plugins: [],
};
export default config;
