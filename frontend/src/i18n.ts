import english from "./locales/en.json";

export type Language = "es" | "en";
type Values = Record<string, string | number>;
const storageKey = "hapic-language";
const translations: Record<string, string> = english;
const spanish = new Map(Object.entries(translations).map(([es, en]) => [en, es]));
const listeners = new Set<() => void>();

function initialLanguage(): Language {
  try {
    const saved = localStorage.getItem(storageKey);
    if (saved === "en" || saved === "es") return saved;
  } catch { /* Browser storage can be unavailable. */ }
  for (const locale of navigator.languages || [navigator.language]) {
    const code = locale.toLowerCase().split("-")[0];
    if (code === "en" || code === "es") return code;
  }
  return "es";
}

let language = initialLanguage();
export const getLanguage = () => language;
export const subscribeLanguage = (listener: () => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};

export function translate(message: string, values: Values = {}, target = language): string {
  // Notifications may already have been translated before the selector changed.
  const source = Object.hasOwn(translations, message) ? message : spanish.get(message) || message;
  const text = target === "en" && Object.hasOwn(translations, source) ? translations[source] : source;
  return text.replace(/\{(\w+)\}/g, (token, key: string) => String(values[key] ?? token));
}

function applyLanguage() {
  document.documentElement.lang = language;
  document.title = translate("Hapic · Tu equipo, ampliado");
  document.querySelector('meta[name="description"]')?.setAttribute("content", translate("Organiza proyectos y trabaja con agentes persistentes en tu propio entorno."));
}

function updateLanguage(next: Language) {
  if (next === language) return;
  language = next;
  applyLanguage();
  listeners.forEach((listener) => listener());
}

export function setLanguage(next: Language) {
  try { localStorage.setItem(storageKey, next); } catch { /* Keep the selection for this session. */ }
  updateLanguage(next);
}

window.addEventListener("storage", (event) => {
  if (event.key === storageKey || event.key === null) updateLanguage(initialLanguage());
});
applyLanguage();
