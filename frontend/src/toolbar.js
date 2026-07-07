// Wires a server-rendered toolbar to a Tiptap editor instance.
//
// Buttons declare behaviour with data attributes:
//   data-command — editor chain command to run, e.g. "toggleBold",
//                  or the name of a custom command below, e.g. "setLink"
//   data-args    — optional JSON arguments, e.g. '{"level": 1}'
//   data-active  — mark/node name to highlight via .is-active, e.g. "bold"
//   data-enable  — command whose availability drives the disabled state, e.g. "undo"
//   data-icon    — key into the icons registry; button text is replaced with an SVG

import icons from './icons.js'
import { uploadImage, browseImages } from './attachments.js'

const customCommands = {
  uploadImage,
  browseImages,
  setLink(editor) {
    // Pre-fill the prompt with the existing URL when editing a link
    const previousUrl = editor.getAttributes("link").href;
    const url = window.prompt("URL", previousUrl);

    if (url === null) {
      return; // prompt cancelled
    }

    if (url === "") {
      // Empty input removes the link. extendMarkRange grows the selection
      // to cover the whole link, so you don't need to select it precisely.
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }

    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  },
  setImage(editor) {
    const url = window.prompt("Image URL");

    if (!url) {
      return; // cancelled or empty
    }

    editor.chain().focus().setImage({ src: url }).run();
  },
};

export function initToolbar(menu, editor, config) {
  const buttons = [...menu.querySelectorAll("button[data-command]")];
  const argsOf = (btn) =>
    btn.dataset.args ? JSON.parse(btn.dataset.args) : undefined;

  for (const btn of buttons) {
    const iconFn = icons[btn.dataset.icon];
    if (iconFn) btn.replaceChildren(iconFn());
  }

  for (const btn of buttons) {
    // Never let a toolbar click move focus off the editor: a focused button
    // would swallow subsequent typing, and a Space keystroke would even
    // re-trigger it. Cancelling mousedown keeps focus (and the selection)
    // in the editor; keyboard activation via Tab+Enter still works.
    btn.addEventListener("mousedown", (event) => event.preventDefault());

    btn.addEventListener("click", () => {
      const command = btn.dataset.command;
      if (customCommands[command]) {
        customCommands[command](editor, config);
      } else {
        editor.chain().focus()[command](argsOf(btn)).run();
      }
    });
  }

  const refresh = () => {
    for (const btn of buttons) {
      if (btn.dataset.active) {
        btn.classList.toggle(
          "is-active",
          editor.isActive(btn.dataset.active, argsOf(btn)),
        );
      }
      if (btn.dataset.enable) {
        btn.disabled = !editor.can()[btn.dataset.enable]();
      }
    }
  };

  // A transaction fires on every content and selection change.
  editor.on("transaction", refresh);
  refresh();

  // The menu ships hidden so a broken bundle never shows dead buttons.
  menu.hidden = false;
}
