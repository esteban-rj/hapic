import { useState, type FormEvent } from "react";
import { ArrowUpRight, RefreshCw, Sparkles } from "lucide-react";
import { put, type LiteLLMConnection } from "./api";
import { useI18n } from "./useI18n";

export function LiteLLMSettings({ gateway, busy, action, refresh, saved }: {
  gateway: LiteLLMConnection;
  busy: boolean;
  action: (task: () => Promise<void>) => Promise<void>;
  refresh: () => Promise<void>;
  saved: (message: string) => void;
}) {
  const { t } = useI18n();
  const [key, setKey] = useState("");

  function submit(event: FormEvent) {
    event.preventDefault();
    void action(async () => {
      await put("/settings/litellm", { api_key: key });
      setKey("");
      await refresh();
      saved(t("Clave de LiteLLM guardada. Inicia o reinicia los agentes para aplicarla."));
    });
  }

  return (
    <section className="card settings-card">
      <div className="card-title"><Sparkles size={17} /> LiteLLM</div>
      <div className="settings-body">
        <p>{t("Administra modelos, proveedores y costes en el panel de LiteLLM.")}</p>
        <div className="button-row">
          {gateway.dashboard_url && (
            <a className="secondary" href={gateway.dashboard_url} target="_blank" rel="noopener noreferrer">
              {t("Abrir panel de LiteLLM")} <ArrowUpRight size={15} />
            </a>
          )}
          <button className="secondary" type="button" disabled={busy} onClick={() => void action(refresh)}>
            <RefreshCw size={15} /> {t("Actualizar catálogo")}
          </button>
        </div>
        {gateway.error && <p role="status">{gateway.error}</p>}
        {gateway.configured && !gateway.error && !gateway.models.includes(gateway.best_model) && (
          <p role="status">{t("Crea un Auto Router con el alias {model} en LiteLLM y autorízalo para esta clave para habilitar Best model.", { model: gateway.best_model })}</p>
        )}
      </div>
      <form onSubmit={submit}>
        <div className="setting-status">
          <span className={"connection-dot " + (gateway.configured && !gateway.error ? "ok" : "")} />
          {t(gateway.configured ? "Clave virtual configurada" : "Clave virtual pendiente")}
        </div>
        <label htmlFor="litellm-key">{t("Clave virtual de LiteLLM")}</label>
        <input id="litellm-key" type="password" autoComplete="off" spellCheck={false} value={key}
          onChange={(event) => setKey(event.target.value)} minLength={20} maxLength={512} required disabled={busy} />
        <p className="field-help">{t("Crea una clave virtual para Hapic desde el panel y limita su acceso a los modelos que quieras ofrecer.")}</p>
        <button className="primary" disabled={busy || !key}>{t("Guardar credencial")}</button>
      </form>
    </section>
  );
}
