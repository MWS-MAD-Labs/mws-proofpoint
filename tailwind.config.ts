import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

const semanticScale = (soft: string, base: string, foreground: string) => ({
  50: soft,
  100: soft,
  200: soft,
  300: base,
  400: base,
  500: base,
  600: foreground,
  700: foreground,
  800: foreground,
  900: foreground,
  950: foreground,
});

export default {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
          soft: "hsl(var(--primary-soft))",
          hover: "hsl(var(--primary-hover))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
          soft: "hsl(var(--destructive-soft))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
          soft: "hsl(var(--success-soft))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
          soft: "hsl(var(--warning-soft))",
        },
        info: {
          DEFAULT: "hsl(var(--info))",
          foreground: "hsl(var(--info-foreground))",
          soft: "hsl(var(--info-soft))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
        evidence: {
          alert: {
            DEFAULT: "hsl(var(--evidence-alert))",
            foreground: "hsl(var(--evidence-alert-foreground))",
            bg: "hsl(var(--evidence-alert-bg))",
            border: "hsl(var(--evidence-alert-border))",
          },
          success: {
            DEFAULT: "hsl(var(--evidence-success))",
            foreground: "hsl(var(--evidence-success-foreground))",
            bg: "hsl(var(--evidence-success-bg))",
            border: "hsl(var(--evidence-success-border))",
          },
          neutral: {
            DEFAULT: "hsl(var(--evidence-neutral))",
            border: "hsl(var(--evidence-neutral-border))",
          },
        },
        score: {
          0: "hsl(var(--score-0))",
          1: "hsl(var(--score-1))",
          2: "hsl(var(--score-2))",
          3: "hsl(var(--score-3))",
          4: "hsl(var(--score-4))",
        },
        /* Legacy palette names resolve to MWS semantic roles during migration. */
        slate: semanticScale("hsl(var(--muted))", "hsl(var(--border-strong))", "hsl(var(--foreground))"),
        gray: semanticScale("hsl(var(--muted))", "hsl(var(--border-strong))", "hsl(var(--foreground))"),
        zinc: semanticScale("hsl(var(--muted))", "hsl(var(--border-strong))", "hsl(var(--foreground))"),
        neutral: semanticScale("hsl(var(--muted))", "hsl(var(--border-strong))", "hsl(var(--foreground))"),
        stone: semanticScale("hsl(var(--muted))", "hsl(var(--border-strong))", "hsl(var(--foreground))"),
        blue: semanticScale("hsl(var(--primary-soft))", "hsl(var(--primary))", "hsl(var(--primary))"),
        indigo: semanticScale("hsl(var(--primary-soft))", "hsl(var(--primary))", "hsl(var(--primary))"),
        violet: semanticScale("hsl(var(--primary-soft))", "hsl(var(--primary))", "hsl(var(--primary))"),
        purple: semanticScale("hsl(var(--primary-soft))", "hsl(var(--primary))", "hsl(var(--primary))"),
        cyan: semanticScale("hsl(var(--info-soft))", "hsl(var(--info))", "hsl(var(--info-foreground))"),
        sky: semanticScale("hsl(var(--info-soft))", "hsl(var(--info))", "hsl(var(--info-foreground))"),
        teal: semanticScale("hsl(var(--info-soft))", "hsl(var(--info))", "hsl(var(--info-foreground))"),
        green: semanticScale("hsl(var(--success-soft))", "hsl(var(--success))", "hsl(var(--success))"),
        emerald: semanticScale("hsl(var(--success-soft))", "hsl(var(--success))", "hsl(var(--success))"),
        lime: semanticScale("hsl(var(--success-soft))", "hsl(var(--success))", "hsl(var(--success))"),
        yellow: semanticScale("hsl(var(--warning-soft))", "hsl(var(--warning))", "hsl(var(--warning-foreground))"),
        amber: semanticScale("hsl(var(--warning-soft))", "hsl(var(--warning))", "hsl(var(--warning-foreground))"),
        orange: semanticScale("hsl(var(--warning-soft))", "hsl(var(--warning))", "hsl(var(--warning-foreground))"),
        red: semanticScale("hsl(var(--destructive-soft))", "hsl(var(--destructive))", "hsl(var(--destructive))"),
        rose: semanticScale("hsl(var(--destructive-soft))", "hsl(var(--destructive))", "hsl(var(--destructive))"),
        pink: semanticScale("hsl(var(--destructive-soft))", "hsl(var(--destructive))", "hsl(var(--destructive))"),
      },
      borderRadius: {
        "2xl": "2rem",
        xl: "1.5rem",
        lg: "1rem",
        md: "var(--radius)",
        sm: "0.5rem",
        xs: "0.25rem",
      },
      boxShadow: {
        xs: "var(--shadow-xs)",
        sm: "var(--shadow-sm)",
        md: "var(--shadow-md)",
        lg: "var(--shadow-lg)",
        xl: "var(--shadow-xl)",
        "2xl": "var(--shadow-xl)",
      },
      keyframes: {
        "accordion-down": {
          from: {
            height: "0",
          },
          to: {
            height: "var(--radix-accordion-content-height)",
          },
        },
        "accordion-up": {
          from: {
            height: "var(--radix-accordion-content-height)",
          },
          to: {
            height: "0",
          },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
      fontFamily: {
        sans: ["var(--font-nunito-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        heading: ["var(--font-plus-jakarta-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-jetbrains-mono)", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [tailwindcssAnimate],
} satisfies Config;
