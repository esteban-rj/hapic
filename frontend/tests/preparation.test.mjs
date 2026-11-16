import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const require = createRequire(import.meta.url);
function load(file, modules = {}) {
  const source = readFileSync(new URL(file, import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const context = vm.createContext({ exports: {}, require: (id) => {
    if (id === "./useI18n") return { useI18n: () => ({ t: (text, values = {}) => text.replace(/\{(\w+)\}/g, (_, key) => values[key]), locale: "es-CO" }) };
    if (modules[id]) return modules[id];
    if (id.startsWith("./")) return {};
    return require(id);
  } });
  vm.runInContext(compiled, context);
  return context.exports;
}
const { PreparationFlow } = load("../src/PreparationFlow.tsx");
const api = load("../src/api.ts");
const { agentDisplayStatus, isPreparing, agentCanReceive } = api;
const { AgentConversation } = load("../src/AgentConversation.tsx", { "./api": api, "./PreparationFlow": { PreparationFlow } });
const stages = ["Perfil", "Requisitos", "Configuración", "Red", "Imagen", "Contenedor", "API"];
const preparation = {
  id: 1, status: "running", completed: 4, total: 7,
  steps: stages.map((label, index) => ({ id: String(index), label, description: `Descripción de ${label}`, status: index < 4 ? "completed" : index === 4 ? "running" : "pending", duration_seconds: index <= 4 ? 2 : null, logs: index <= 4 ? [{ created_at: "2026-11-16T12:00:00Z", message: `Registro <seguro> de ${label}` }] : [] })),
};
function render(props = {}) {
  return renderToStaticMarkup(createElement(PreparationFlow, { preparation, agent: { name: "Ana", status: "provisioning" }, runtime: { ready: false }, ...props }));
}

test("all stages render as accessible log selectors with the active stage selected", () => {
  const html = render();
  assert.equal((html.match(/aria-controls="preparation-logs"/g) || []).length, 7);
  assert.equal((html.match(/aria-pressed="true"/g) || []).length, 1);
  assert.match(html, /4 de 7 etapas/);
  assert.match(html, /Registro &lt;seguro&gt; de Imagen/);
  assert.match(html, /Para estar disponible/);
  assert.doesNotMatch(html, /El agente está disponible para conversar/);
});

test("an old healthy container cannot hide a preparation or a failed stage", () => {
  assert.equal(agentDisplayStatus({ status: "provisioning" }, { status: "running", ready: true }), "provisioning");
  assert.equal(agentDisplayStatus({ status: "blocked" }, { status: "running", ready: true }), "blocked");
  assert.equal(agentDisplayStatus({ status: "running" }, { status: "stopped", ready: false }), "stopped");
  assert.equal(isPreparing("pending"), true);
  assert.equal(isPreparing("provisioning"), true);
  assert.equal(isPreparing("blocked"), false);
  assert.doesNotMatch(render({ runtime: { ready: true } }), /El agente está disponible para conversar/);
});

test("legacy profiles and loading do not invent completed stages", () => {
  assert.match(render({ preparation: null }), /antes del registro de etapas/);
  assert.doesNotMatch(render({ preparation: null }), /preparation-node/);
  assert.match(render({ preparation: undefined }), /Cargando preparación/);
});

test("completed preparation is hidden instead of remaining above the conversation", () => {
  const completed = { ...preparation, status: "completed", completed: 7, steps: preparation.steps.map((step) => ({ ...step, status: "completed" })) };
  assert.equal(render({ preparation: completed, agent: { name: "Ana", status: "running" }, runtime: { ready: true } }), "");
  assert.equal(render({ preparation: completed, agent: { name: "Ana", status: "running" }, runtime: { ready: false } }), "");
});

function conversation(props = {}) {
  return renderToStaticMarkup(createElement(AgentConversation, {
    agent: { name: "Ana", status: "running" }, runtime: { status: "running", ready: true },
    preparation, configured: true, onSettings: () => {}, ...props,
  }, createElement("textarea", { "aria-label": "Mensaje para Ana" })));
}

test("chat mounts only with confirmed readiness and a configured connection", () => {
  assert.match(conversation(), /textarea/);
  assert.doesNotMatch(conversation(), /preparation-graph/);
  assert.equal(agentCanReceive({ status: "running" }, undefined, true), false);
  assert.equal(agentDisplayStatus({ status: "running" }), "checking");
  const completed = { ...preparation, status: "completed" };
  for (const props of [
    { runtime: undefined, preparation: undefined },
    { runtime: { status: "starting", ready: false } },
    { configured: false, preparation: completed },
    { runtime: { status: "stopped", ready: false }, preparation: completed },
    { agent: { name: "Ana", status: "provisioning" } },
  ]) assert.doesNotMatch(conversation(props), /textarea/);
});

test("preparing replaces chat, including restarts while the previous container responds", () => {
  const html = conversation({ agent: { name: "Ana", status: "provisioning" } });
  assert.match(html, /Ana se está preparando/);
  assert.match(html, /preparation-graph/);
  assert.doesNotMatch(html, /textarea/);
  const loading = conversation({ agent: { name: "Ana", status: "provisioning" }, preparation: { ...preparation, status: "completed" } });
  assert.match(loading, /Ana se está preparando/);
  assert.match(loading, /Cargando preparación/);
  assert.doesNotMatch(loading, /preparation-graph|textarea/);
});

test("stopped and unconfigured agents show availability guidance without a completed flow", () => {
  const completed = { ...preparation, status: "completed" };
  const stopped = conversation({ runtime: { status: "stopped", ready: false }, preparation: completed });
  assert.match(stopped, /Ana no está disponible/);
  assert.doesNotMatch(stopped, /preparation-graph|textarea/);
  const missingKey = conversation({ configured: false, preparation: completed });
  assert.match(missingKey, /Configura la conexión con OpenAI/);
  assert.match(missingKey, /Ir a configuración/);
  assert.doesNotMatch(missingKey, /preparation-graph|textarea/);
});
