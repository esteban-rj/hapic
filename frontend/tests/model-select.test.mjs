import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import vm from "node:vm";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const require = createRequire(import.meta.url);
const source = readFileSync(new URL("../src/ModelSelect.tsx", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
const context = vm.createContext({
  exports: {},
  require: (id) => id === "./useI18n" ? { useI18n: () => ({ t: (text) => text }) } : require(id),
});
vm.runInContext(compiled, context);
const { preferredModel, ModelSelect } = context.exports;

test("LiteLLM lists only authorized models and uses Best model for a retired selection", () => {
  const gateway = { best_model: "best-model", models: ["best-model", "gpt-6-luna", "claude-sonnet"] };
  const savedValue = "gpt-6.1-sol";
  const value = preferredModel(savedValue, gateway);
  assert.equal(value, "auto");
  assert.equal(preferredModel("claude-sonnet", gateway), "claude-sonnet");
  const html = renderToStaticMarkup(createElement(ModelSelect, { value, savedValue, gateway, onChange: () => {} }));
  assert.match(html, /<option value="auto" selected="">Best model<\/option>/);
  assert.match(html, /gpt-6-luna.*claude-sonnet/);
  assert.doesNotMatch(html, /gpt-6\.1-sol|disabled/);
});

test("a missing router stays out of the menu and a model can be chosen explicitly", () => {
  const gateway = { best_model: "best-model", models: ["gpt-6-luna"] };
  const value = preferredModel("auto", gateway);
  assert.equal(value, "");
  const html = renderToStaticMarkup(createElement(ModelSelect, { value, savedValue: "auto", gateway, onChange: () => {} }));
  assert.match(html, /Selecciona un modelo/);
  assert.match(html, /gpt-6-luna/);
  assert.doesNotMatch(html, /Best model|disabled/);
});
