import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";

// Collect uncaught page errors in every test — a broken bundle should fail loudly.
test.beforeEach(async ({ page }) => {
  page.errors = [];
  page.on("pageerror", (err) => page.errors.push(err.message));
});

test("editor and toolbar mount on the add-post page", async ({ page }) => {
  await page.goto("/add/");

  await expect(page.locator("dj-tiptap-editor .tiptap")).toBeVisible();
  await expect(page.locator("[data-dj-tiptap-toolbar]")).toBeVisible();

  // Undo is disabled until something has been typed
  await expect(page.getByRole("button", { name: "Undo" })).toBeDisabled();

  expect(page.errors).toEqual([]);
});

// The Playwright equivalent of @pytest.mark.parametrize: register one test
// per case. Marks (inline formatting) need a text selection, so these cases
// type, select all, then click the toolbar button.
const markCases = [
  { button: "Bold", html: "<p><strong>Hello world</strong></p>" },
  { button: "Italic", html: "<p><em>Hello world</em></p>" },
  { button: "Strike", html: "<p><s>Hello world</s></p>" },
  { button: "Underline", html: "<p><u>Hello world</u></p>" },
  { button: "Code", html: "<p><code>Hello world</code></p>" },
];

for (const { button, html } of markCases) {
  test(`toolbar ${button} formats the selected text`, async ({ page }) => {
    await page.goto("/add/");

    await page.locator("dj-tiptap-editor .tiptap").click();
    await page.keyboard.type("Hello world");
    await page.keyboard.press("ControlOrMeta+a");

    const btn = page.getByRole("button", { name: button, exact: true });
    await btn.click();
    await expect(btn).toHaveClass(/is-active/);

    const actual = await page.evaluate(() => document.querySelector("dj-tiptap-editor").editor.getHTML());
    expect(actual).toBe(html);

    expect(page.errors).toEqual([]);
  });
}

// Node-level commands restructure the block that contains the cursor — no
// selection needed (and select-all would break the active check: StarterKit's
// TrailingNode keeps an empty trailing <p> after a non-paragraph last block,
// and a node only reports active if it covers the whole selection).
const nodeCases = [
  { button: "H1", html: "<h1>Hello world</h1><p></p>" },
  { button: "H2", html: "<h2>Hello world</h2><p></p>" },
  { button: "H3", html: "<h3>Hello world</h3><p></p>" },
  { button: "Blockquote", html: "<blockquote><p>Hello world</p></blockquote><p></p>" },
  { button: "BulletList", html: "<ul><li><p>Hello world</p></li></ul><p></p>" },
  { button: "OrderedList", html: "<ol><li><p>Hello world</p></li></ol><p></p>" },
  { button: "CodeBlock", html: "<pre><code>Hello world</code></pre><p></p>" },
];

for (const { button, html } of nodeCases) {
  test(`toolbar ${button} formats the current block`, async ({ page }) => {
    await page.goto("/add/");

    await page.locator("dj-tiptap-editor .tiptap").click();
    await page.keyboard.type("Hello world");

    const btn = page.getByRole("button", { name: button, exact: true });
    await btn.click();
    await expect(btn).toHaveClass(/is-active/);

    const actual = await page.evaluate(() => document.querySelector("dj-tiptap-editor").editor.getHTML());
    expect(actual).toBe(html);

    expect(page.errors).toEqual([]);
  });
}

test("code blocks get lowlight syntax highlighting", async ({ page }) => {
  await page.goto("/add/");

  await page.locator("dj-tiptap-editor .tiptap").click();
  // The ``` input rule converts the paragraph into a code block with language js
  await page.keyboard.type("```js ");
  await page.keyboard.type('const greeting = "hello";');

  // lowlight decorates tokens with hljs-* spans inside the editor view
  await expect(page.locator(".tiptap pre .hljs-keyword").first()).toHaveText("const");
  await expect(page.locator(".tiptap pre .hljs-string").first()).toHaveText('"hello"');

  // The stored HTML keeps the language but not the decoration spans
  const html = await page.evaluate(() => document.querySelector("dj-tiptap-editor").editor.getHTML());
  expect(html).toBe('<pre><code class="language-js">const greeting = "hello";</code></pre><p></p>');

  expect(page.errors).toEqual([]);
});

test("published code blocks are highlighted on the public post page", async ({ page }) => {
  const title = `pw-test hljs ${Date.now()}`;

  await page.goto("/add/");
  await page.fill("input[name=title]", title);
  await page.locator("dj-tiptap-editor .tiptap").click();
  await page.keyboard.type("```js ");
  await page.keyboard.type('const greeting = "hello";');

  await page.click("input[type=submit]");
  await page.waitForURL("/");
  await page.click(`text=${title}`);

  // highlight.js on the public page tokenises the stored language-js block
  const code = page.locator(".post-content pre code.language-js");
  await expect(code).toHaveClass(/hljs/);
  await expect(code.locator(".hljs-keyword").first()).toHaveText("const");
  await expect(code.locator(".hljs-string").first()).toHaveText('"hello"');

  expect(page.errors).toEqual([]);
});

test("image command inserts an image from the prompted URL", async ({ page }) => {
  // 1x1 transparent gif: keeps the test off the network entirely
  const src = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

  await page.goto("/add/");
  await page.locator("dj-tiptap-editor .tiptap").click();

  // window.prompt() blocks the page; answer it before triggering it
  page.on("dialog", (dialog) => dialog.accept(src));
  await page.getByRole("button", { name: "Image", exact: true }).click();

  await expect(page.locator(".tiptap img")).toHaveAttribute("src", src);

  const html = await page.evaluate(() => document.querySelector("dj-tiptap-editor").editor.getHTML());
  expect(html).toBe(`<img src="${src}"><p></p>`);

  expect(page.errors).toEqual([]);
});

test("upload button uploads the chosen file and inserts the served image", async ({ page }) => {
  await page.goto("/add/");
  await page.locator("dj-tiptap-editor .tiptap").click();

  // The dynamically created <input type=file> still fires filechooser
  const chooserPromise = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "UploadImage", exact: true }).click();
  await (await chooserPromise).setFiles("tests/fixtures/pixel.png");

  // src points at the Django-served attachment, alt falls back to the filename stem
  const img = page.locator(".tiptap img");
  await expect(img).toHaveAttribute("src", /\/media\/attachments\/\d{4}\/\d{2}\/pixel.*\.png/);
  await expect(img).toHaveAttribute("alt", "pixel");

  expect(page.errors).toEqual([]);
});

// Real drag-and-drop needs OS-level input, so these tests dispatch synthetic
// drop/paste events whose DataTransfer carries a File built from the fixture.
const pixelBase64 = readFileSync("tests/fixtures/pixel.png").toString("base64");

test("dropping an image file uploads it and inserts it", async ({ page }) => {
  await page.goto("/add/");

  const surface = page.locator("dj-tiptap-editor .tiptap");
  const box = await surface.boundingBox();
  await surface.evaluate(
    (el, { b64, x, y }) => {
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(new File([bytes], "dropped.png", { type: "image/png" }));
      el.dispatchEvent(
        new DragEvent("drop", { clientX: x, clientY: y, dataTransfer, bubbles: true, cancelable: true }),
      );
    },
    { b64: pixelBase64, x: box.x + 20, y: box.y + 20 },
  );

  const img = page.locator(".tiptap img");
  await expect(img).toHaveAttribute("src", /\/media\/attachments\/\d{4}\/\d{2}\/dropped.*\.png/);
  await expect(img).toHaveAttribute("alt", "dropped");

  expect(page.errors).toEqual([]);
});

test("pasting an image file uploads it and inserts it", async ({ page }) => {
  await page.goto("/add/");
  await page.locator("dj-tiptap-editor .tiptap").click();

  await page.locator("dj-tiptap-editor .tiptap").evaluate((el, b64) => {
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const clipboardData = new DataTransfer();
    clipboardData.items.add(new File([bytes], "pasted.png", { type: "image/png" }));
    el.dispatchEvent(
      new ClipboardEvent("paste", { clipboardData, bubbles: true, cancelable: true }),
    );
  }, pixelBase64);

  const img = page.locator(".tiptap img");
  await expect(img).toHaveAttribute("src", /\/media\/attachments\/\d{4}\/\d{2}\/pasted.*\.png/);
  await expect(img).toHaveAttribute("alt", "pasted");

  expect(page.errors).toEqual([]);
});

test("dragging a corner handle resizes the image and stores width/height", async ({ page }) => {
  await page.goto("/add/");
  await page.locator("dj-tiptap-editor .tiptap").click();

  // Insert a 300x200 image via the upload button
  const chooserPromise = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "UploadImage", exact: true }).click();
  await (await chooserPromise).setFiles("tests/fixtures/photo.png");
  const img = page.locator(".tiptap img");
  await expect(img).toHaveAttribute("src", /photo.*\.png/);

  // Select the image so the corner handles appear, then drag bottom-right
  await img.click();
  const handle = page.locator('.tiptap [data-resize-handle="bottom-right"]');
  const box = await handle.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + 60, box.y + 40, { steps: 5 });
  await page.mouse.up();

  // The new size is committed as width/height attributes in the stored HTML,
  // with the 300:200 aspect ratio preserved (alwaysPreserveAspectRatio).
  const html = await page.evaluate(() => document.querySelector("dj-tiptap-editor").editor.getHTML());
  const [, width, height] = html.match(/width="(\d+)" height="(\d+)"/).map(Number);
  expect(width).toBeGreaterThan(300);
  expect(height).toBe(Math.round(width * (200 / 300)));

  expect(page.errors).toEqual([]);
});

test("media library dialog inserts a previously uploaded image", async ({ page }) => {
  await page.goto("/add/");
  await page.locator("dj-tiptap-editor .tiptap").click();

  // Seed the library through the upload button
  const chooserPromise = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "UploadImage", exact: true }).click();
  await (await chooserPromise).setFiles("tests/fixtures/pixel.png");
  await expect(page.locator(".tiptap img")).toHaveCount(1);

  // On a fresh form, insert the same image from the library instead
  await page.goto("/add/");
  await page.locator("dj-tiptap-editor .tiptap").click();
  await page.getByRole("button", { name: "BrowseImages", exact: true }).click();

  const dialog = page.locator("dialog.dj-tiptap-browser");
  await expect(dialog.locator("h2")).toHaveText("Media library");
  await dialog.locator("[data-image-url]").first().click();

  await expect(page.locator(".tiptap img")).toHaveAttribute(
    "src",
    /\/media\/attachments\/\d{4}\/\d{2}\/pixel.*\.png/,
  );
  await expect(page.locator(".tiptap img")).toHaveAttribute("alt", "pixel");
  // Closing removes the dialog element entirely (fresh one per open)
  await expect(page.locator("dialog.dj-tiptap-browser")).toHaveCount(0);

  expect(page.errors).toEqual([]);
});

test("media library dialog closes without inserting anything", async ({ page }) => {
  await page.goto("/add/");
  await page.locator("dj-tiptap-editor .tiptap").click();
  await page.getByRole("button", { name: "BrowseImages", exact: true }).click();

  const dialog = page.locator("dialog.dj-tiptap-browser");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Close" }).click();

  await expect(page.locator("dialog.dj-tiptap-browser")).toHaveCount(0);
  await expect(page.locator(".tiptap img")).toHaveCount(0);

  expect(page.errors).toEqual([]);
});

test("insert table creates a 3x3 grid and enables the table commands", async ({ page }) => {
  await page.goto("/add/");

  // The table group is contextual: hidden until the cursor is inside a table
  const tableGroup = page.locator("[data-context-group]");
  await expect(tableGroup).toBeHidden();

  await page.locator("dj-tiptap-editor .tiptap").click();
  await page.getByRole("button", { name: "InsertTable", exact: true }).click();

  await expect(page.locator(".tiptap table")).toBeVisible();
  await expect(page.locator(".tiptap tr")).toHaveCount(3);
  await expect(page.locator(".tiptap th")).toHaveCount(3); // header row
  await expect(page.locator(".tiptap td")).toHaveCount(6); // 2 body rows

  // The cursor landed inside the new table, so the group appears ready to use
  await expect(tableGroup).toBeVisible();
  await expect(page.getByRole("button", { name: "DeleteRow", exact: true })).toBeEnabled();

  expect(page.errors).toEqual([]);
});

test("table rows and columns can be added and removed", async ({ page }) => {
  await page.goto("/add/");
  await page.locator("dj-tiptap-editor .tiptap").click();
  await page.getByRole("button", { name: "InsertTable", exact: true }).click();

  await page.getByRole("button", { name: "AddRowAfter", exact: true }).click();
  await expect(page.locator(".tiptap tr")).toHaveCount(4);

  await page.getByRole("button", { name: "AddColAfter", exact: true }).click();
  await expect(page.locator(".tiptap th")).toHaveCount(4);
  await expect(page.locator(".tiptap td")).toHaveCount(12);

  await page.getByRole("button", { name: "DeleteRow", exact: true }).click();
  await expect(page.locator(".tiptap tr")).toHaveCount(3);

  await page.getByRole("button", { name: "DeleteTable", exact: true }).click();
  await expect(page.locator(".tiptap table")).toHaveCount(0);

  expect(page.errors).toEqual([]);
});

test("table columns can be resized by dragging and the width persists", async ({ page }) => {
  await page.goto("/add/");
  await page.locator("dj-tiptap-editor .tiptap").click();
  await page.getByRole("button", { name: "InsertTable", exact: true }).click();

  // Drag the right border of the first header cell 60px to the right
  const cell = page.locator(".tiptap th").first();
  const box = await cell.boundingBox();
  const borderX = box.x + box.width;
  const borderY = box.y + box.height / 2;

  await page.mouse.move(borderX, borderY);
  await page.mouse.down();
  await page.mouse.move(borderX + 60, borderY, { steps: 5 });
  await page.mouse.up();

  // The dragged width is stored on the column's cells and survives serialization
  const html = await page.evaluate(() => document.querySelector("dj-tiptap-editor").editor.getHTML());
  expect(html).toMatch(/colwidth="\d+"/);

  expect(page.errors).toEqual([]);
});

test("tables survive the round trip to the public post page", async ({ page }) => {
  const title = `pw-test table ${Date.now()}`;

  await page.goto("/add/");
  await page.fill("input[name=title]", title);
  await page.locator("dj-tiptap-editor .tiptap").click();
  await page.getByRole("button", { name: "InsertTable", exact: true }).click();
  await page.keyboard.type("Header cell"); // cursor is in the first header cell

  await page.click("input[type=submit]");
  await page.waitForURL("/");
  await page.click(`text=${title}`);

  const table = page.locator(".post-content table");
  await expect(table).toBeVisible();
  await expect(table.locator("tr")).toHaveCount(3);
  await expect(table.locator("th").first()).toHaveText("Header cell");

  expect(page.errors).toEqual([]);
});

test("empty editor shows a placeholder that never reaches the stored HTML", async ({ page }) => {
  await page.goto("/add/");

  const placeholder = page.locator(".tiptap p.is-editor-empty");
  await expect(placeholder).toHaveAttribute("data-placeholder", "Write something…");

  await page.locator("dj-tiptap-editor .tiptap").click();
  await page.keyboard.type("Hello");
  await expect(placeholder).toHaveCount(0);

  const html = await page.evaluate(() => document.querySelector("dj-tiptap-editor").editor.getHTML());
  expect(html).toBe("<p>Hello</p>");

  expect(page.errors).toEqual([]);
});

test("editor and public page compute identical content typography", async ({ page }) => {
  const title = `pw-test parity ${Date.now()}`;
  const style = (locator, prop) => locator.evaluate((el, p) => getComputedStyle(el)[p], prop);

  await page.goto("/add/");
  await page.fill("input[name=title]", title);
  await page.evaluate(() => {
    document
      .querySelector("dj-tiptap-editor")
      .editor.commands.setContent("<blockquote><p>Wisdom</p></blockquote><p>Inline <code>chip</code> text</p>");
  });
  // setContent doesn't count as an update; one real keystroke syncs the form value
  await page.locator("dj-tiptap-editor .tiptap").click();
  await page.keyboard.press("End");
  await page.keyboard.type(".");

  const editorStyles = {
    quoteBorder: await style(page.locator(".tiptap blockquote"), "borderLeftWidth"),
    quoteColor: await style(page.locator(".tiptap blockquote"), "borderLeftColor"),
    codeBackground: await style(page.locator(".tiptap code"), "backgroundColor"),
  };
  expect(editorStyles.quoteBorder).toBe("3px"); // guard against comparing default-vs-default

  await page.click("input[type=submit]");
  await page.waitForURL("/");
  await page.click(`text=${title}`);

  expect(await style(page.locator(".post-content blockquote"), "borderLeftWidth")).toBe(editorStyles.quoteBorder);
  expect(await style(page.locator(".post-content blockquote"), "borderLeftColor")).toBe(editorStyles.quoteColor);
  expect(await style(page.locator(".post-content code"), "backgroundColor")).toBe(editorStyles.codeBackground);

  expect(page.errors).toEqual([]);
});

test("typography extension smartens punctuation as you type", async ({ page }) => {
  await page.goto("/add/");

  await page.locator("dj-tiptap-editor .tiptap").click();
  await page.keyboard.type('"Smart" -- yes... 1/2 (c) ->');

  const html = await page.evaluate(() => document.querySelector("dj-tiptap-editor").editor.getHTML());
  expect(html).toBe("<p>“Smart” — yes… ½ © →</p>");

  expect(page.errors).toEqual([]);
});

test("undo becomes available once something is typed", async ({ page }) => {
  await page.goto("/add/");

  const undo = page.getByRole("button", { name: "Undo" });
  await expect(undo).toBeDisabled();

  await page.locator("dj-tiptap-editor .tiptap").click();
  await page.keyboard.type("Hello");
  await expect(undo).toBeEnabled();

  await undo.click();
  const actual = await page.evaluate(() => document.querySelector("dj-tiptap-editor").editor.getHTML());
  expect(actual).toBe("<p></p>");

  expect(page.errors).toEqual([]);
});

test("form submits the editor's HTML and round-trips it", async ({ page }) => {
  const title = `pw-test ${Date.now()}`;

  await page.goto("/add/");
  await page.fill("input[name=title]", title);
  await page.locator("dj-tiptap-editor .tiptap").click();
  await page.keyboard.type("Round trip works");

  await page.click("input[type=submit]");
  await page.waitForURL("/");

  // Reopen the saved post in the edit form: the widget must restore the value
  await page.click(`text=${title}`);
  await expect(page.locator("h1")).toHaveText(title);
  await expect(page.getByText("Round trip works").first()).toBeVisible();

  expect(page.errors).toEqual([]);
});
