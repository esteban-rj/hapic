import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";
import ts from "typescript";

const dictionary = JSON.parse(readFileSync(new URL("../src/locales/en.json", import.meta.url), "utf8"));
const source = readFileSync(new URL("../src/api.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

function client(responses, language = "es") {
  const calls = [];
  const context = vm.createContext({
    exports: {},
    fetch: async (...args) => {
      calls.push(args);
      assert.ok(responses.length, "Unexpected request");
      return responses.shift();
    },
    require: () => ({
      getLanguage: () => language,
      translate: (text, values = {}) => (language === "en" ? dictionary[text] || text : text)
        .replace(/\{(\w+)\}/g, (match, key) => String(values[key] ?? match)),
    }),
  });
  vm.runInContext(compiled, context);
  return { ...context.exports, calls };
}

test("successful JSON and structured API errors retain their meaning", async () => {
  const api = client([
    Response.json({ status: "ok" }),
    Response.json({ detail: "Sesión inválida. Recarga la página." }, { status: 403 }),
  ]).api;
  assert.equal((await api("/health")).status, "ok");
  await assert.rejects(api("/state"), { message: "Sesión inválida. Recarga la página." });
});

test("plain text and HTML failures show HTTP status without exposing the response body", async () => {
  for (const [status, body] of [[500, "Internal Server Error"], [502, "<html>private traceback</html>"]]) {
    const { api } = client([new Response(body, { status })]);
    await assert.rejects(api("/bootstrap"), (error) => {
      assert.match(error.message, new RegExp(`HTTP ${status}`));
      assert.match(error.message, /reinicia Hapic/);
      assert.doesNotMatch(error.message, /Unexpected token|Internal Server|private traceback|<html>/);
      return true;
    });
  }
});

test("malformed success responses also produce an actionable error", async () => {
  const { api } = client([new Response("{broken", { status: 200 })]);
  await assert.rejects(api("/state"), (error) => /respuesta no válida \(HTTP 200\)/.test(error.message));
});

test("unstructured JSON errors use the existing fallback instead of throwing a TypeError", async () => {
  for (const value of [null, { detail: [{ msg: "Invalid input" }] }]) {
    const { api } = client([Response.json(value, { status: 422 })]);
    await assert.rejects(api("/state"), { message: "No se pudo completar la solicitud. Revisa los campos." });
  }
});

test("invalid response errors follow the selected language", async () => {
  const { api } = client([new Response("Internal Server Error", { status: 500 })], "en");
  await assert.rejects(api("/state"), {
    message: "Hapic returned an invalid response (HTTP 500). Try again; if it persists, restart Hapic.",
  });
});

test("bootstrap can recover after a non-JSON failure and restores CSRF on later requests", async () => {
  const current = client([
    new Response("Internal Server Error", { status: 500 }),
    Response.json({ csrf: "test-csrf" }),
    Response.json({ saved: true }),
  ]);
  await assert.rejects(current.bootstrap());
  await current.bootstrap();
  await current.post("/organizations", { name: "Example" });
  assert.equal(current.calls[2][1].headers["X-Hapic-CSRF"], "test-csrf");
});
