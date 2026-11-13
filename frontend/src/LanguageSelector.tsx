import { useI18n } from "./useI18n";

export function LanguageSelector() {
  const { language, setLanguage, t } = useI18n();
  return (
    <select
      className="language-selector"
      aria-label={t("Seleccionar idioma")}
      title={t("Idioma")}
      value={language}
      onChange={(event) => setLanguage(event.target.value === "en" ? "en" : "es")}
    >
      <option value="es" lang="es" aria-label="Español">🇪🇸</option>
      <option value="en" lang="en" aria-label="English">🇺🇸</option>
    </select>
  );
}
