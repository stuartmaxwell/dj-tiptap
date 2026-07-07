import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  build: {
    // Compile directly into the Django static directory
    outDir: resolve(__dirname, "../src/dj_tiptap/static/dj-tiptap"),
    // Clear out the target folder before building fresh assets
    emptyOutDir: true,
    // Build as a standalone library configuration
    // SM Note: To keep deployment simple, this configuration targets a self-invoking format (iife) and outputs a
    // fixed filename. This eliminates the need to parse dynamic asset manifests inside Python templates.
    lib: {
      entry: resolve(__dirname, "src/main.js"),
      formats: ["es"],
      name: "DjTipTapEditor",
      fileName: () => "djtiptap.bundle.js",
      cssFileName: "djtiptap",
    },
    // Source maps assist in debugging modular JS files in browser tools
    sourcemap: true,
  },
});
