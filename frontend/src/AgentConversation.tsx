import type { ReactNode } from "react";
import { LoaderCircle, MessageSquare } from "lucide-react";
import { agentCanReceive, agentIsPreparing, type Agent, type AgentPreparation, type AgentRuntime } from "./api";
import { PreparationFlow } from "./PreparationFlow";
import { useI18n } from "./useI18n";

export function AgentConversation({ agent, runtime, preparation, configured, gateway, onSettings, children }: {
  agent: Agent;
  runtime?: AgentRuntime;
  preparation?: AgentPreparation | null;
  configured: boolean;
  gateway?: boolean;
  onSettings: () => void;
  children: ReactNode;
}) {
  const { t } = useI18n();
  if (agentCanReceive(agent, runtime, configured)) return <>{children}</>;
  if (agentIsPreparing(agent, runtime, preparation)) {
    return <PreparationFlow agent={agent} runtime={runtime} preparation={preparation?.status === "completed" ? undefined : preparation} />;
  }
  const checking = !runtime;
  return <section className="card agent-unavailable" role="status" aria-labelledby="agent-availability-title">
    {checking ? <LoaderCircle className="spin" size={24} aria-hidden="true" /> : <MessageSquare size={24} aria-hidden="true" />}
    <h2 id="agent-availability-title">{checking ? t("Comprobando disponibilidad de {name}…", { name: agent.name }) : t("{name} no está disponible", { name: agent.name })}</h2>
    <p>{checking ? t("El chat aparecerá cuando se confirme que el agente está listo para recibir mensajes.") : !configured ? t(gateway ? "Configura una clave virtual de LiteLLM en Configuración." : "Configura la conexión con OpenAI para habilitar la conversación.") : t("Inicia el runtime para volver a conversar. El chat aparecerá cuando esté disponible.")}</p>
    {(agent.error || runtime?.message) && <p className="inline-error">{agent.error || runtime?.message}</p>}
    {!checking && !configured ? <button type="button" className="secondary" onClick={onSettings}>{t("Ir a configuración")}</button> : null}
  </section>;
}
