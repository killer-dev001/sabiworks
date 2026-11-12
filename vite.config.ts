import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import netlify from "@netlify/vite-plugin-tanstack-start";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import path from "node:path";

// Standalone Vite config for Netlify.
// is removed because it builds for Cloudflare via Nitro, which conflicts with Netlify.
export default defineConfig({
  plugins: [
    tsconfigPaths(),
    tailwindcss(),
    // Keeps your SSR error wrapper in src/server.ts
    tanstackStart({ server: { entry: "server" } }),
    viteReact(),
    netlify(),
  ],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
    dedupe: ["react", "react-dom", "@tanstack/react-router"],
  },
});
