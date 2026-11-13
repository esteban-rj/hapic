import { useCallback, useSyncExternalStore } from "react";
import { getLanguage, setLanguage, subscribeLanguage, translate } from "./i18n";

export function useI18n() {
  const language = useSyncExternalStore(subscribeLanguage, getLanguage);
  const t = useCallback((message: string, values?: Record<string, string | number>) => translate(message, values, language), [language]);
  return { language, locale: language === "en" ? "en-US" : "es-CO", setLanguage, t };
}
