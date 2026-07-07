import { defineConfig } from "vite";
import { resolve } from "path";

// Second build target: the public-page content bundle (syntax highlighting
// for rendered posts). Kept separate from the editor bundle so post pages
// don't ship the whole editor. Run via `pnpm build` (see package.json).
export default defineConfig({
  build: {
    outDir: resolve(__dirname, "../src/dj_tiptap/static/dj-tiptap"),
    // The editor build owns cleaning this directory and runs first
    emptyOutDir: false,
    lib: {
      entry: resolve(__dirname, "src/content.js"),
      formats: ["es"],
      name: "DjTiptapContent",
      fileName: () => "content.bundle.js",
      cssFileName: "content",
    },
    sourcemap: true,
  },
});
