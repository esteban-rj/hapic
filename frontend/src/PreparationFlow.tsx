import { useState } from "react";
import { Check, Circle, Clock3, LoaderCircle, Minus, Terminal, X } from "lucide-react";
import type { Agent, AgentPreparation, AgentRuntime, PreparationStatus } from "./api";
import { useI18n } from "./useI18n";

const icons = { pending: Minus, running: LoaderCircle, completed: Check, blocked: Circle, failed: X };
const labels: Record<PreparationStatus, string> = {
  pending: "Pendiente", running: "En curso", completed: "Completada", blocked: "Bloqueada", failed: "Fallida",
};

export function PreparationFlow({ preparation, agent, runtime }: {
  preparation: AgentPreparation | null | undefined;
  agent: Agent;
  runtime?: AgentRuntime;
}) {
  const { t, locale } = useI18n();
  const [selected, setSelected] = useState<string>();
  const title = t("{name} se está preparando", { name: agent.name });
  if ((agent.status === "running" && runtime?.ready) || preparation?.status === "completed") return null;
  if (preparation === undefined) return <section className="card preparation-loading" role="status"><h2>{title}</h2><p>{t("Cargando preparación…")}</p></section>;
  if (!preparation) return <section className="card preparation-legacy"><h2>{title}</h2><p>{t("Este perfil se creó antes del registro de etapas. Al iniciar o reiniciar su runtime se registrará el flujo completo.")}</p></section>;
  const { steps, completed, total } = preparation;
  const active = steps.find((step) => ["running", "blocked", "failed"].includes(step.status)) || steps.find((step) => step.status === "pending");
  const detail = steps.find((step) => step.id === selected) || active || steps[steps.length - 1];
  const remaining = steps.filter((step) => step.status !== "completed");
  return <section className="card preparation" aria-labelledby="preparation-title">
    <header className="preparation-heading">
      <div><span className="eyebrow">{t("DEL PERFIL AL PRIMER TURNO")}</span><h2 id="preparation-title">{title}</h2></div>
      <span className="preparation-count" role="status">{t("{completed} de {total} etapas", { completed, total })}</span>
    </header>
    <p className="preparation-summary" role="status">{active ? t("{stage} · {status}", { stage: active.label, status: t(labels[active.status]) }) : t("Preparación registrada. Consulta el estado actual del runtime.")}</p>
    <ol className="preparation-graph" aria-label={t("Etapas de preparación")}>
      {steps.map((step, index) => {
        const Icon = icons[step.status];
        return <li key={step.id} className={"preparation-node " + step.status}>
          <button type="button" aria-pressed={detail.id === step.id} aria-controls="preparation-logs" onClick={() => setSelected(step.id)}>
            <span className="preparation-icon"><Icon size={16} className={step.status === "running" ? "spin" : ""} aria-hidden="true" /></span>
            <span className="preparation-node-text"><strong>{step.label}</strong><small>{t(labels[step.status])}</small></span>
            <span className="preparation-timing">{step.duration_seconds === null ? `0${index + 1}` : `${Math.floor(step.duration_seconds)} s`}</span>
          </button>
        </li>;
      })}
    </ol>
    <div className="preparation-bottom">
      <aside className="preparation-remaining"><h3>{t("Para estar disponible")}</h3>
        {remaining.length ? <ul>{remaining.map((step) => <li key={step.id}><span className={"remaining-dot " + step.status} aria-hidden="true" /><span>{step.label}<small>{t(labels[step.status])}</small></span></li>)}</ul> : <p>{t("Las etapas del último arranque están completas. Inicia el runtime si está detenido.")}</p>}
        {agent.error ? <p className="preparation-error" role="alert">{agent.error}</p> : preparation.status === "pending" ? <p>{t("El perfil está preparado. Inicia el runtime para continuar; si faltan requisitos, configúralos primero.")}</p> : null}
      </aside>
      <section className="preparation-logs" id="preparation-logs" aria-label={t("Registros de la etapa")}>
        <div className="preparation-log-heading"><Terminal size={16} aria-hidden="true" /><h3>{detail.label}</h3><span>{t(labels[detail.status])}</span></div>
        <p>{detail.description}</p>
        <div className="preparation-log-lines">{detail.logs.length ? detail.logs.map((log, index) => <div key={index}><time dateTime={log.created_at}>{new Date(log.created_at).toLocaleTimeString(locale)}</time><span>{log.message}</span></div>) : <p><Clock3 size={14} aria-hidden="true" />{t("Aún no hay registros. Esta etapa comenzará cuando terminen las anteriores.")}</p>}</div>
        <p className="preparation-log-note">{t("Registros de preparación guardados por Hapic, sin credenciales. Se actualizan automáticamente.")}</p>
      </section>
    </div>
  </section>;
}
