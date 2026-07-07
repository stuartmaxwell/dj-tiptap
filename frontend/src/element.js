// <dj-tiptap-editor> — a form-associated custom element that hosts Tiptap.
//
// `static formAssociated = true` plus ElementInternals.setFormValue() make the
// browser treat this element as a native form control: its value is submitted
// under its `name` attribute with no hidden input needed, and it takes part in
// form reset and <fieldset disabled>.

import { Editor } from "@tiptap/core";
import { extensions } from "./extensions.js";
import { initToolbar } from "./toolbar.js";
import { createFileHandler } from "./attachments.js";

export default class DjTiptapEditor extends HTMLElement {
  static formAssociated = true;

  #internals;
  #editor = null;
  #initialContent = "";

  constructor() {
    super();
    this.#internals = this.attachInternals();
  }

  // Expose the Tiptap instance to collaborators (the Alpine toolbar).
  get editor() {
    return this.#editor;
  }

  connectedCallback() {
    if (this.#editor) return; // re-fires if the element is moved in the DOM

    // When the element is upgraded during the initial page parse, its children
    // (the initial value) haven't been parsed yet — wait for the full document.
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => this.#mount(), {
        once: true,
      });
    } else {
      this.#mount();
    }
  }

  disconnectedCallback() {
    this.#editor?.destroy();
    this.#editor = null;
  }

  // Called by the browser when the surrounding form is reset.
  formResetCallback() {
    this.#editor?.commands.setContent(this.#initialContent);
    this.#syncFormValue();
  }

  // Called by the browser when this element or an ancestor fieldset is disabled.
  formDisabledCallback(disabled) {
    this.#editor?.setEditable(!disabled);
  }

  #mount() {
    // The server renders the initial value HTML-escaped as this element's text
    // content; reading textContent decodes it, like a <textarea> does natively.
    this.#initialContent = this.textContent.trim();
    this.replaceChildren();

    // Django endpoint URLs arrive as data attributes on this element. The
    // CSRF token is read from the surrounding form's {% csrf_token %} input
    // (a function, so it's read fresh per request), which works even with
    // CSRF_COOKIE_HTTPONLY.
    const config = {
      // Note: dataset is the browser's built-in view of data-* attributes: data-upload-url="..." on the element becomes this.dataset.uploadUrl (kebab-case → camelCase is automatic).
      uploadUrl: this.dataset.uploadUrl,
      browseUrl: this.dataset.browseUrl,
      // Comma-separated mime types, e.g. "image/jpeg,image/png" — defined
      // once in models.py and forwarded by the widget as data-accept
      accept: this.dataset.accept,

      // Lambda function to read the csrf token fresh each time the upload happens
      csrfToken: () =>
        this.closest("form")?.querySelector('input[name="csrfmiddlewaretoken"]')
          ?.value ?? "",
    };

    this.#editor = new Editor({
      element: this,
      // Drag-drop/paste upload only makes sense when an upload endpoint was
      // configured on the element.
      // If config.uploadUrl is set, build a new list of extensions with the FileHandler added, or else just retunr the extensions.
      extensions: config.uploadUrl
        ? [...extensions, createFileHandler(config)]
        : extensions,

      content: this.#initialContent,
      onCreate: () => this.#syncFormValue(),
      onUpdate: () => this.#syncFormValue(),
    });

    const toolbar = this.parentElement?.querySelector(
      "[data-dj-tiptap-toolbar]",
    );
    if (toolbar) {
      initToolbar(toolbar, this.#editor, config);
    }
  }

  #syncFormValue() {
    this.#internals.setFormValue(this.#editor.getHTML());
  }
}
