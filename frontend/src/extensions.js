// Extension list and configuration
//
import StarterKit from "@tiptap/starter-kit";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import { common, createLowlight } from "lowlight";
import Image from "@tiptap/extension-image";
import { TableKit } from "@tiptap/extension-table";
import { Placeholder } from "@tiptap/extensions";
import { Typography } from "@tiptap/extension-typography";

// The `common` set is ~37 mainstream languages; `all` (~190) triples the
// bundle. Individual grammars can also be registered one by one if even
// common proves too heavy.
const lowlight = createLowlight(common);

export const extensions = [
  StarterKit.configure({
    // Clicking a link inside the editor should select it for editing,
    // not navigate away from the form (openOnClick defaults to true).
    link: { openOnClick: false },
    dropcursor: { width: 2 },
    // Disable the built-in code block: CodeBlockLowlight below replaces it,
    // and both register under the same extension name ("codeBlock").
    codeBlock: false,
  }),
  CodeBlockLowlight.configure({
    lowlight,
  }),
  // resize wraps each image in a node view with draggable corner handles
  // (styled in editor.css) and stores the result as width/height attributes
  // on the <img>. Aspect ratio is always kept: free-form distortion is never
  // what you want for a photo.
  Image.configure({
    resize: {
      enabled: true,
      alwaysPreserveAspectRatio: true,
      minWidth: 50,
      minHeight: 50,
    },
  }),
  // Bundles the Table, TableRow, TableHeader, and TableCell nodes; configure
  // each via its key (e.g. { table: { resizable: true } }), StarterKit-style.
  TableKit.configure({
    table: { resizable: true },
  }),
  // Renders as a data-placeholder attribute + is-editor-empty class on the
  // first paragraph while the document is empty; styled in editor.css.
  Placeholder.configure({
    placeholder: "Write something…",
  }),
  // Smart punctuation as you type: -- → —, ... → …, straight → curly quotes,
  // (c) → ©, -> → →, 1/2 → ½, etc. Each rule can be disabled or overridden
  // via configure (e.g. { emDash: false }).
  Typography,
];
