import { useI18n } from "./useI18n";
import type { LiteLLMConnection } from "./api";

export const AUTOMATIC_MODEL = "auto";

// OpenAI's text/reasoning catalog: https://developers.openai.com/api/docs/models
const MODELS = [
  { id: "gpt-6.1-sol", name: "GPT-6.1 Sol" },
  { id: "gpt-6.1-terra", name: "GPT-6.1 Terra" },
  { id: "gpt-6-astra", name: "GPT-6 Astra" },
  { id: "gpt-6-luna", name: "GPT-6 Luna" },
  { id: "gpt-6-sol", name: "GPT-6 Sol" },
];

export function modelIsAvailable(model: string, gateway?: LiteLLMConnection | null) {
  return !gateway || gateway.models.includes(model === AUTOMATIC_MODEL ? gateway.best_model : model);
}

export function preferredModel(value: string, gateway?: LiteLLMConnection | null) {
  if (!gateway) return value;
  const model = value === gateway.best_model ? AUTOMATIC_MODEL : value;
  if (modelIsAvailable(model, gateway)) return model;
  return modelIsAvailable(AUTOMATIC_MODEL, gateway) ? AUTOMATIC_MODEL : "";
}

export function ModelSelect({
  id,
  value,
  savedValue,
  onChange,
  disabled = false,
  ariaLabel,
  gateway,
}: {
  id?: string;
  value: string;
  savedValue: string;
  onChange: (model: string) => void;
  disabled?: boolean;
  ariaLabel?: string;
  gateway?: LiteLLMConnection | null;
}) {
  const { t } = useI18n();
  const options = gateway
    ? gateway.models.filter((id) => id !== gateway.best_model && id !== AUTOMATIC_MODEL).map((id) => ({ id, name: id }))
    : MODELS;
  // Preserve saved custom IDs and snapshots so opening the form never resets them.
  const savedOptions = gateway ? [] : [...new Set([savedValue, value])].filter(
    (model) => model && model !== AUTOMATIC_MODEL && !options.some((option) => option.id === model),
  );
  return (
    <select
      id={id}
      className="model-select"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      disabled={disabled}
      aria-label={ariaLabel}
      required
    >
      {gateway && !value && <option value="" hidden>{t("Selecciona un modelo")}</option>}
      {modelIsAvailable(AUTOMATIC_MODEL, gateway) && (
        <option value={AUTOMATIC_MODEL}>{gateway ? t("Best model") : t("Automático")}</option>
      )}
      {options.map((model) => (
        <option key={model.id} value={model.id}>
          {model.name}
        </option>
      ))}
      {savedOptions.map((model) => (
        <option key={model} value={model}>
          {model} {t("(guardado)")}
        </option>
      ))}
    </select>
  );
}
