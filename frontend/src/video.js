// HTML5 <video> as a block node, for self-hosted uploads (mp4/webm).
//
// Tiptap has no official video extension (its YouTube extension is
// iframe-based), so this is a minimal custom node following the same shape
// as extension-image: one atom block with a src attribute, inserted via a
// setVideo command. The stored HTML is a plain <video controls src="...">
// element, playable on public pages with no JS.
import { Node, mergeAttributes } from "@tiptap/core";

export const Video = Node.create({
  name: "video",
  group: "block",
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      src: { default: null },
      title: { default: null },
    };
  },

  parseHTML() {
    return [
      {
        tag: "video",
        getAttrs: (element) => ({
          // Hand-written HTML often nests a <source> instead of using the
          // src attribute; accept both, emit the attribute form.
          src:
            element.getAttribute("src") ??
            element.querySelector("source")?.getAttribute("src"),
          title: element.getAttribute("title"),
        }),
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    // preload="metadata" fetches just enough for dimensions and duration, so
    // a post with several videos doesn't download them all on page load.
    return [
      "video",
      mergeAttributes(HTMLAttributes, {
        controls: "controls",
        preload: "metadata",
      }),
    ];
  },

  addCommands() {
    return {
      setVideo:
        (attrs) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs }),
    };
  },
});

export default Video;
