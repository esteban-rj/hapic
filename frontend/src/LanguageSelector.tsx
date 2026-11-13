import { useI18n } from "./useI18n";

export function LanguageSelector() {
  const { language, setLanguage, t } = useI18n();
  const nextLanguage = language === "es" ? "en" : "es";
  const label = t(nextLanguage === "en" ? "Cambiar a inglés" : "Cambiar a español");
  return (
    <button
      type="button"
      className="language-selector"
      aria-label={label}
      title={label}
      onClick={() => setLanguage(nextLanguage)}
    >
      <span aria-hidden="true">{language === "es" ? "🇪🇸" : "🇺🇸"}</span>
    </button>
  );
}
