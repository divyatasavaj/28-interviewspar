/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        // locked palette — docs/design.md
        brand: {
          violet: "#7C3AED",
          amber: "#F5A623",
          green: "#0F7A5C",
        },
        ink: {
          bg: "#0F0F13",
          sidebar: "#17171C",
          text: "#F4F4F5",
          muted: "#9CA3AF",
        },
        score: {
          good: "#22C55E",
          warn: "#F5A623",
          poor: "#EF4444",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      borderRadius: {
        card: "18px",
      },
    },
  },
  plugins: [],
};
