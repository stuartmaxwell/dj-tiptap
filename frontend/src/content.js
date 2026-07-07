// Syntax highlighting for rendered post content on public pages.
//
// The editor stores code blocks as <pre><code class="language-xx"> — the
// exact convention highlightAll() looks for. Importing from lib/common loads
// the same ~37 mainstream grammars the editor's lowlight `common` set uses,
// so authoring and rendering stay in sync. The theme import matches the one
// in editor.css for the same reason.

import hljs from "highlight.js/lib/common";
import "highlight.js/styles/github.css";
// The same content-typography contract the editor uses (see typography.css)
import "./typography.css";

// Safe to call while the page is still parsing: it defers itself to
// DOMContentLoaded (verified in highlight.js/lib/core.js).
hljs.highlightAll();
