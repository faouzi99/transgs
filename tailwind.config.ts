import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#1C2430",
        accent: { DEFAULT: "#E08A1E", dark: "#B86F12", light: "#FBEBD5" },
        muted: "#5A6676",
        line: "#DDE2E8",
        ok: "#1F8A4C",
        bad: "#C62828",
      },
      fontSize: { xs: ["0.75rem", "1rem"] },
    },
  },
  plugins: [],
};

export default config;
