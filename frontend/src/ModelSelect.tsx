// OpenAI's text/reasoning catalog: https://developers.openai.com/api/docs/models
const MODELS = [
  { id: "gpt-6.1-sol", name: "GPT-6.1 Sol" },
  { id: "gpt-6.1-terra", name: "GPT-6.1 Terra" },
  { id: "gpt-6-astra", name: "GPT-6 Astra" },
  { id: "gpt-6-luna", name: "GPT-6 Luna" },
  { id: "gpt-6-sol", name: "GPT-6 Sol" },
];

export function ModelSelect({
  id,
  value,
  savedValue,
  onChange,
  disabled = false,
  ariaLabel,
}: {
  id?: string;
  value: string;
  savedValue: string;
  onChange: (model: string) => void;
  disabled?: boolean;
  ariaLabel?: string;
}) {
  // Preserve saved custom IDs and snapshots so opening the form never resets them.
  const savedOptions = [...new Set([savedValue, value])].filter(
    (model) => model && !MODELS.some((option) => option.id === model),
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
      {MODELS.map((model) => (
        <option key={model.id} value={model.id}>
          {model.name}
        </option>
      ))}
      {savedOptions.map((model) => (
        <option key={model} value={model}>
          {model} (guardado)
        </option>
      ))}
    </select>
  );
}
