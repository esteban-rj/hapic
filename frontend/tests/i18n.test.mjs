import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";
import ts from "typescript";

const dictionary = JSON.parse(readFileSync(new URL("../src/locales/en.json", import.meta.url), "utf8"));
const source = readFileSync(new URL("../src/i18n.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;

function browser({ saved, languages = ["en-US"], blocked = false } = {}) {
  const storage = new Map(saved ? [["hapic-language", saved]] : []);
  const events = new Map();
  const description = {};
  const document = { documentElement: {}, querySelector: () => ({ setAttribute: (key, value) => { description[key] = value; } }) };
  const context = vm.createContext({
    exports: {}, document, navigator: { languages },
    require: () => dictionary,
    localStorage: {
      getItem: (key) => { if (blocked) throw new Error("Storage unavailable"); return storage.get(key); },
      setItem: (key, value) => { if (blocked) throw new Error("Storage unavailable"); storage.set(key, value); },
    },
    window: { addEventListener: (key, handler) => { events.set(key, handler); } },
  });
  vm.runInContext(compiled, context);
  return { ...context.exports, storage, events, document, description };
}

test("detects supported browser languages and uses Spanish for unsupported locales", () => {
  assert.equal(browser().getLanguage(), "en");
  assert.equal(browser({ languages: ["es-CO", "en-US"] }).getLanguage(), "es");
  assert.equal(browser({ languages: ["fr-FR", "en-GB"] }).getLanguage(), "en");
  assert.equal(browser({ languages: ["fr-FR"] }).getLanguage(), "es");
  assert.equal(browser({ saved: "es" }).getLanguage(), "es");
  assert.equal(browser({ saved: "invalid", languages: ["en-US"] }).getLanguage(), "en");
});

test("selection persists and updates document language, title, and subscribers", () => {
  const current = browser({ saved: "es" });
  let changes = 0;
  const unsubscribe = current.subscribeLanguage(() => { changes++; });
  current.setLanguage("en");
  assert.equal(current.storage.get("hapic-language"), "en");
  assert.equal(current.document.documentElement.lang, "en");
  assert.equal(current.document.title, "Hapic · Your team, expanded");
  assert.match(current.description.content, /^Organize projects/);
  assert.equal(changes, 1);
  current.setLanguage("en");
  assert.equal(changes, 1);
  assert.equal(browser({ saved: current.storage.get("hapic-language") }).getLanguage(), "en");
  unsubscribe();
  current.setLanguage("es");
  assert.equal(changes, 1);
});

test("switching works when browser storage is blocked", () => {
  const current = browser({ blocked: true, languages: ["es"] });
  current.setLanguage("en");
  assert.equal(current.getLanguage(), "en");
  assert.equal(current.translate("Configuración"), "Settings");
});

test("interpolation preserves names and supports translated notifications", () => {
  const current = browser();
  assert.equal(current.translate("Crear {name}", { name: "Diseño & Code" }), "Create Diseño & Code");
  assert.equal(current.translate("{count} agentes en este proyecto", { count: 2 }), "2 agents in this project");
  const notice = current.translate("Tu espacio está listo.");
  current.setLanguage("es");
  assert.equal(current.translate(notice), "Tu espacio está listo.");
  assert.equal(current.translate("An unknown message"), "An unknown message");
  assert.equal(current.translate("constructor", {}, "en"), "constructor");
});

test("language changes synchronize between browser tabs and reset after storage is cleared", () => {
  const current = browser({ saved: "es" });
  current.storage.set("hapic-language", "en");
  current.events.get("storage")({ key: "hapic-language" });
  assert.equal(current.getLanguage(), "en");
  current.storage.set("hapic-language", "es");
  current.events.get("storage")({ key: "another-setting" });
  assert.equal(current.getLanguage(), "en");
  current.storage.clear();
  current.events.get("storage")({ key: null });
  assert.equal(current.getLanguage(), "en");
});
