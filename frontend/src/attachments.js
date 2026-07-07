// Image attachments: upload to Django and insert into the editor.
//
// Everything here receives the `config` object built by element.js from the
// widget's data attributes:
//   config.uploadUrl  — POST endpoint returning {url, alt, ...} JSON
//   config.browseUrl  — GET endpoint returning the media-library HTML fragment
//   config.csrfToken  — function returning the current CSRF token
//   config.accept     — comma-separated mime types the server accepts;
//                       single source of truth is ALLOWED_IMAGE_TYPES in
//                       models.py, forwarded by the widget as data-accept

import { FileHandler } from "@tiptap/extension-file-handler";

async function uploadFile(file, config) {
  const body = new FormData();
  body.append("file", file);

  const response = await fetch(config.uploadUrl, {
    method: "POST",
    headers: { "X-CSRFToken": config.csrfToken() },
    body,
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error);
  return data; // {id, url, alt, width, height}
}

export function uploadImage(editor, config) {
  const input = document.createElement("input");
  input.type = "file";
  // The accept attribute takes the same comma-separated form, so the file
  // picker only offers what the server will actually take
  input.accept = config.accept || "image/*";

  input.addEventListener("change", async () => {
    const file = input.files[0];
    if (!file) return;

    let data;
    try {
      data = await uploadFile(file, config);
    } catch (error) {
      window.alert(`Upload failed: ${error.message}`);
      return;
    }

    editor.chain().focus().setImage({ src: data.url, alt: data.alt }).run();
  });

  // Never appended to the DOM; garbage-collected once the handler settles.
  input.click();
}

// Tiptap extension that uploads files dropped or pasted into the editor.
// Built per editor instance because the callbacks need this widget's config.
export function createFileHandler(config) {
  return FileHandler.configure({
    // Files with other mime types are ignored entirely (no callback fires);
    // the server would reject them anyway. If data-accept is ever missing,
    // undefined means "no filter" and the server remains the gatekeeper.
    allowedMimeTypes: config.accept ? config.accept.split(",") : undefined,

    onDrop: async (editor, files, pos) => {
      for (const file of files) {
        try {
          const data = await uploadFile(file, config);
          editor
            .chain()
            .focus()
            .insertContentAt(pos, {
              type: "image",
              attrs: { src: data.url, alt: data.alt },
            })
            .run();
          pos += 1; // an image node occupies one position; keep drop order
        } catch (error) {
          window.alert(`Upload failed: ${error.message}`);
        }
      }
    },

    onPaste: async (editor, files, pasteContent) => {
      // When the clipboard also carries HTML (e.g. an image copied from a
      // website), let the default paste insert that HTML instead of
      // re-uploading a copy of the file.
      if (pasteContent) return;

      for (const file of files) {
        try {
          const data = await uploadFile(file, config);
          editor
            .chain()
            .focus()
            .setImage({ src: data.url, alt: data.alt })
            .run();
        } catch (error) {
          window.alert(`Upload failed: ${error.message}`);
        }
      }
    },
  });
}

export async function browseImages(editor, config) {
  // A fresh dialog per open: nothing to cache, no stale state, and multiple
  // editors on one page can't interfere with each other.
  const dialog = document.createElement("dialog");
  dialog.className = "dj-tiptap-browser";
  document.body.append(dialog);
  dialog.addEventListener("close", () => dialog.remove());

  const load = async (url) => {
    // The fragment is server-rendered by Django; see attachment_browse.html
    dialog.innerHTML = await (await fetch(url)).text();
  };

  // One delegated listener covers selection, pagination, and closing.
  dialog.addEventListener("click", async (event) => {
    const pick = event.target.closest("[data-image-url]");
    const pager = event.target.closest("[data-fetch]");
    if (pick) {
      editor
        .chain()
        .focus()
        .setImage({ src: pick.dataset.imageUrl, alt: pick.dataset.imageAlt })
        .run();
      dialog.close();
    } else if (pager) {
      // The fragment says what to fetch next (e.g. "?page=2"); this side
      // knows nothing about pagination or filtering schemes.
      await load(config.browseUrl + pager.dataset.fetch);
    } else if (
      event.target.closest("[data-close]") ||
      event.target === dialog
    ) {
      dialog.close(); // backdrop click; Esc already closes natively
    }
  });

  await load(config.browseUrl);
  dialog.showModal();
}
