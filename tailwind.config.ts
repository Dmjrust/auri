import type { Config } from "tailwindcss";

/**
 * Auri — Tailwind v3 config
 * Paired with src/styles/auri-tokens.css and src/index.css.
 */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx,js,jsx}"],
  darkMode: ["class"],
  theme: {
    container: {
      center: true,
      padding: "1.5rem",
      screens: { "2xl": "1280px" },
    },
    extend: {
      colors: {
        // Brand
        primary: {
          DEFAULT: "hsl(var(--primary))",
          hover: "hsl(var(--primary-hover))",
          pressed: "hsl(var(--primary-pressed))",
          soft: "hsl(var(--primary-soft))",
          foreground: "hsl(var(--primary-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          hover: "hsl(var(--accent-hover))",
          soft: "hsl(var(--accent-soft))",
          foreground: "hsl(var(--accent-foreground))",
        },
        sage: { DEFAULT: "hsl(var(--sage))", soft: "hsl(var(--sage-soft))" },
        sand: { DEFAULT: "hsl(var(--sand))", soft: "hsl(var(--sand-soft))" },

        // Surfaces
        cream: "hsl(var(--cream))",
        background: "hsl(var(--cream))",
        surface: {
          DEFAULT: "hsl(var(--surface))",
          2: "hsl(var(--surface-2))",
          inset: "hsl(var(--surface-inset))",
        },

        // Ink (text)
        ink: {
          DEFAULT: "hsl(var(--ink))",
          2: "hsl(var(--ink-2))",
          3: "hsl(var(--ink-3))",
          4: "hsl(var(--ink-4))",
        },
        foreground: "hsl(var(--ink))",

        // Borders & rings
        border: "hsl(var(--border))",
        "border-strong": "hsl(var(--border-strong))",
        ring: "hsl(var(--primary))",
        input: "hsl(var(--border-strong))",

        // Semantic
        success: { DEFAULT: "hsl(var(--success))", soft: "hsl(var(--success-soft))" },
        warning: { DEFAULT: "hsl(var(--warning))", soft: "hsl(var(--warning-soft))" },
        danger:  { DEFAULT: "hsl(var(--danger))",  soft: "hsl(var(--danger-soft))" },
        info:    { DEFAULT: "hsl(var(--info))",    soft: "hsl(var(--info-soft))" },

        // shadcn aliases — keeps all existing shadcn primitives working
        card:        { DEFAULT: "hsl(var(--surface))",       foreground: "hsl(var(--ink))" },
        popover:     { DEFAULT: "hsl(var(--surface))",       foreground: "hsl(var(--ink))" },
        secondary:   { DEFAULT: "hsl(var(--surface-inset))", foreground: "hsl(var(--ink))" },
        muted:       { DEFAULT: "hsl(var(--surface-inset))", foreground: "hsl(var(--ink-2))" },
        destructive: { DEFAULT: "hsl(var(--danger))",        foreground: "#ffffff" },
      },
      fontFamily: {
        display: ['"Fraunces"', "Georgia", "serif"],
        sans:    ['"Inter"', "ui-sans-serif", "system-ui", "sans-serif"],
        mono:    ['"JetBrains Mono"', "ui-monospace", "Menlo", "monospace"],
      },
      fontSize: {
        "display-xl": ["clamp(56px, 7vw, 88px)", { lineHeight: "1.0",  letterSpacing: "-0.025em" }],
        "display-lg": ["clamp(40px, 5vw, 64px)",  { lineHeight: "1.05", letterSpacing: "-0.02em" }],
        "display-md": ["clamp(32px, 4vw, 48px)",  { lineHeight: "1.1",  letterSpacing: "-0.02em" }],
        "display-sm": ["clamp(24px, 3vw, 32px)",  { lineHeight: "1.15", letterSpacing: "-0.015em" }],
        h1:       ["32px", { lineHeight: "1.1",  letterSpacing: "-0.02em" }],
        h2:       ["24px", { lineHeight: "1.2",  letterSpacing: "-0.015em" }],
        h3:       ["20px", { lineHeight: "1.25" }],
        h4:       ["18px", { lineHeight: "1.3" }],
        "body-lg": ["17px", { lineHeight: "1.6" }],
        body:      ["15px", { lineHeight: "1.45" }],
        "body-sm": ["14px", { lineHeight: "1.45" }],
        caption:   ["13px", { lineHeight: "1.4" }],
        micro:     ["12px", { lineHeight: "1.3", letterSpacing: "0.02em" }],
      },
      borderRadius: {
        sm:   "6px",
        md:   "10px",
        lg:   "16px",
        xl:   "24px",
        pill: "999px",
      },
      boxShadow: {
        "auri-sm": "0 1px 2px hsl(195 30% 15% / 0.05), 0 1px 1px hsl(195 30% 15% / 0.03)",
        "auri-md": "0 4px 12px hsl(195 30% 15% / 0.08), 0 2px 4px hsl(195 30% 15% / 0.04)",
        "auri-lg": "0 16px 40px hsl(195 30% 15% / 0.10), 0 4px 12px hsl(195 30% 15% / 0.05)",
        "auri-xl": "0 32px 64px hsl(195 30% 15% / 0.12)",
      },
      spacing: {
        "1.5": "6px", "4.5": "18px", "5.5": "22px",
        "13": "52px", "18": "72px",  "22": "88px",  "26": "104px",
      },
      transitionTimingFunction: {
        "auri-out":      "cubic-bezier(0.32, 0.72, 0, 1)",
        "auri-standard": "cubic-bezier(0.4, 0, 0.2, 1)",
      },
      transitionDuration: {
        micro: "120ms",
        base:  "240ms",
        slow:  "400ms",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to:   { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to:   { height: "0" },
        },
        "auri-pulse": {
          "0%, 100%": { opacity: "1", transform: "scale(1)" },
          "50%":      { opacity: "0.5", transform: "scale(0.85)" },
        },
        "auri-wave": {
          "0%, 100%": { transform: "scaleY(0.4)" },
          "50%":      { transform: "scaleY(1)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up":   "accordion-up 0.2s ease-out",
        "auri-pulse":     "auri-pulse 2s ease-in-out infinite",
        "auri-wave":      "auri-wave 1.4s ease-in-out infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
