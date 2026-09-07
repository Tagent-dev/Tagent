import type { Config } from "tailwindcss";

const config: Config = {
    content: ["./src/**/*.{ts,tsx}"],
    theme: {
        extend: {
            colors: {
                navy: {
                    950: "#050a18",
                    900: "#0a1128",
                    800: "#0f1a35",
                    700: "#152244",
                    600: "#1e3055",
                    500: "#2a4070",
                },
                accent: {
                    purple: "#6531f7",
                    "purple-hover": "#ab6bff",
                    blue: "#4f8cff",
                    green: "#34c759",
                    cyan: "#22d3ee",
                    amber: "#ffd967",
                    orange: "#ff865e",
                    red: "#ff3b30",
                },
            },
            fontFamily: {
                sans: ["var(--font-sans)", "ui-sans-serif", "system-ui"],
                mono: ["var(--font-mono)", "ui-monospace", "Menlo", "Consolas"],
            },
            fontSize: {
                "2xs": ["0.625rem", { lineHeight: "0.875rem" }],
            },
            borderRadius: {
                xl: "12px",
                "2xl": "14px",
                "3xl": "16px",
            },
            boxShadow: {
                glass: "0 8px 24px -12px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.04)",
                "glow-sm": "0 0 12px -2px rgba(101, 49, 247, 0.25)",
                "glow-md": "0 0 20px -4px rgba(101, 49, 247, 0.35)",
                "glow-lg": "0 0 40px -8px rgba(101, 49, 247, 0.35)",
                "inner-glow": "inset 0 0 20px -8px rgba(101, 49, 247, 0.18)",
            },
            backgroundImage: {
                "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
                "gradient-card": "linear-gradient(135deg, rgba(101, 49, 247, 0.06), rgba(171, 107, 255, 0.03), transparent)",
            },
            animation: {
                "fade-in": "fade-in-up 0.3s ease-out",
                "slide-up": "fade-in-up 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
                "pulse-slow": "pulse 3s ease-in-out infinite",
            },
            keyframes: {
                "fade-in-up": {
                    "0%": { opacity: "0", transform: "translateY(6px)" },
                    "100%": { opacity: "1", transform: "translateY(0)" },
                },
            },
        },
    },
    plugins: [],
};

export default config;
