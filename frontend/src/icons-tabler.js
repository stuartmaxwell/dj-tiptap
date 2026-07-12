// Tabler ships raw SVG files, same approach as Phosphor.
// Icons live under icons/outline/; ?raw imports each as a string.

import undo from "@tabler/icons/outline/arrow-back-up.svg?raw";
import redo from "@tabler/icons/outline/arrow-forward-up.svg?raw";
import paragraph from "@tabler/icons/outline/pilcrow.svg?raw";
import h1 from "@tabler/icons/outline/h-1.svg?raw";
import h2 from "@tabler/icons/outline/h-2.svg?raw";
import h3 from "@tabler/icons/outline/h-3.svg?raw";
import bold from "@tabler/icons/outline/bold.svg?raw";
import italic from "@tabler/icons/outline/italic.svg?raw";
import strikethrough from "@tabler/icons/outline/strikethrough.svg?raw";
import underline from "@tabler/icons/outline/underline.svg?raw";
import code from "@tabler/icons/outline/code.svg?raw";
import blockquote from "@tabler/icons/outline/blockquote.svg?raw";
import listBullets from "@tabler/icons/outline/list.svg?raw";
import listNumbers from "@tabler/icons/outline/list-numbers.svg?raw";
import codeBlock from "@tabler/icons/outline/codeblock.svg?raw";
import link from "@tabler/icons/outline/link.svg?raw";
import image from "@tabler/icons/outline/photo.svg?raw";
import imageUpload from "@tabler/icons/outline/photo-up.svg?raw";
import imageLibrary from "@tabler/icons/outline/library-photo.svg?raw";
import table from "@tabler/icons/outline/table.svg?raw";
import horizontalRule from "@tabler/icons/outline/minus.svg?raw";
import readMore from "@tabler/icons/outline/page-break.svg?raw";
import hardBreak from "@tabler/icons/outline/corner-down-left.svg?raw";
import addRowBefore from "@tabler/icons/outline/row-insert-top.svg?raw";
import addRowAfter from "@tabler/icons/outline/row-insert-bottom.svg?raw";
import deleteRow from "@tabler/icons/outline/row-remove.svg?raw";
import addColumnBefore from "@tabler/icons/outline/column-insert-left.svg?raw";
import addColumnAfter from "@tabler/icons/outline/column-insert-right.svg?raw";
import deleteColumn from "@tabler/icons/outline/column-remove.svg?raw";
import mergeCells from "@tabler/icons/outline/columns-2.svg?raw";
import tableHeader from "@tabler/icons/outline/table-row.svg?raw";
import deleteTable from "@tabler/icons/outline/table-minus.svg?raw";

const fromSvg = (svgStr) => () => {
  const tpl = document.createElement("template");
  tpl.innerHTML = svgStr.trim();
  return tpl.content.firstElementChild;
};

export default {
  undo: fromSvg(undo),
  redo: fromSvg(redo),
  paragraph: fromSvg(paragraph),
  "heading-1": fromSvg(h1),
  "heading-2": fromSvg(h2),
  "heading-3": fromSvg(h3),
  bold: fromSvg(bold),
  italic: fromSvg(italic),
  strikethrough: fromSvg(strikethrough),
  underline: fromSvg(underline),
  code: fromSvg(code),
  blockquote: fromSvg(blockquote),
  "bullet-list": fromSvg(listBullets),
  "ordered-list": fromSvg(listNumbers),
  "code-block": fromSvg(codeBlock),
  link: fromSvg(link),
  image: fromSvg(image),
  "image-upload": fromSvg(imageUpload),
  "image-library": fromSvg(imageLibrary),
  "insert-table": fromSvg(table),
  hr: fromSvg(horizontalRule),
  more: fromSvg(readMore),
  "hard-break": fromSvg(hardBreak),
  "add-row-before": fromSvg(addRowBefore),
  "add-row-after": fromSvg(addRowAfter),
  "delete-row": fromSvg(deleteRow),
  "add-col-before": fromSvg(addColumnBefore),
  "add-col-after": fromSvg(addColumnAfter),
  "delete-col": fromSvg(deleteColumn),
  "merge-or-split": fromSvg(mergeCells),
  "header-row": fromSvg(tableHeader),
  "delete-table": fromSvg(deleteTable),
};
