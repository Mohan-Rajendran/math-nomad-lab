import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const page = (path: string) => new URL(path, import.meta.url).pathname;

export default defineConfig({
  plugins: [react()],
  base: "./",
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        landing: page("./index.html"),
        squareChallenge: page("./square-kolam-tile-challenge/index.html"),
        sandbox2: page("./sandbox-2/index.html"),
        sandbox3: page("./sandbox-3/index.html"),
        octahedron: page("./kolams-on-an-octahedron/index.html"),
        squareChallengeEmbed: page("./embed/square-kolam-tile-challenge/index.html"),
        octahedronEmbed: page("./embed/kolams-on-an-octahedron/index.html"),
        lawOfCosines: page("./law-of-cosines/index.html"),
        lawOfCosinesEmbed: page("./embed/law-of-cosines/index.html"),
      },
    },
  },
});
