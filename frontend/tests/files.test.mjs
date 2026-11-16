import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const require = createRequire(import.meta.url);
const source = readFileSync(new URL("../src/components.tsx", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
const context = vm.createContext({
  exports: {},
  require: (id) => {
    if (id === "./useI18n") return { useI18n: () => ({ t: (text) => text, locale: "es-CO" }) };
    if (id.startsWith("./")) return {};
    return require(id);
  },
});
vm.runInContext(compiled, context);

test("deliverables render as direct buttons, with selection and no internal folder structure", () => {
  const file = { name: "brief.md", path: "agents/private-id/workspace/brief.md", relative_path: "brief.md", size: 1400, media_type: "text" };
  const html = renderToStaticMarkup(createElement(context.exports.FileShortcuts, { files: [file], selected: file.path, select: () => {} }));
  assert.match(html, /<ul[^>]+aria-label="Archivos generados"/);
  assert.match(html, /<button[^>]+aria-pressed="true"/);
  assert.match(html, /<strong>brief.md<\/strong>/);
  assert.match(html, /1,4 KB/);
  assert.doesNotMatch(html, /private-id|workspace|hermes|tree-node|<details/);
});

test("same-name deliverables remain distinguishable and filenames are escaped", () => {
  const files = ["draft", "final"].map((folder) => ({ name: "brief<&>.md", path: `${folder}/brief.md`, relative_path: `${folder}/brief<&>.md`, size: 42, media_type: "text" }));
  const html = renderToStaticMarkup(createElement(context.exports.FileShortcuts, { files, select: () => {} }));
  assert.equal((html.match(/<button/g) || []).length, 2);
  assert.match(html, /draft\/brief&lt;&amp;&gt;\.md/);
  assert.match(html, /final\/brief&lt;&amp;&gt;\.md/);
  assert.doesNotMatch(html, /brief<&>/);
});
