import { useI18n } from "./useI18n";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ModelSelect } from "./ModelSelect";
import {
  ChevronDown,
  ChevronRight,
  FileText,
  Folder,
  X,
  ArrowUp,
  LoaderCircle,
  Sparkles,
  Copy,
  Check,
  LockKeyhole,
  Image as ImageIcon,
} from "lucide-react";
import {
  api,
  post,
  put,
  agentRoles,
  imageUrl,
  type Agent,
  type Message,
  type Project,
  type FileNode,
  type Template,
} from "./api";

export function Mark({ small = false }: { small?: boolean }) {
  return (
    <span className={"mark " + (small ? "small" : "")} aria-hidden="true">
      H
    </span>
  );
}
export function Badge({ status }: { status: string }) {
  const { t } = useI18n();
  const labels: Record<string, string> = {
    pending: t("Pendiente de iniciar"),
    provisioning: t("Preparando runtime"),
    running: t("API disponible"),
    blocked: t("Requiere configuración"),
    error: t("Error de provisión"),
    stopped: t("Detenido"),
    unavailable: t("Sin conexión"),
    starting: t("API iniciando"),
  };
  return (
    <span className={"status " + status}>
      <i />
      {labels[status] || status}
    </span>
  );
}
export function Empty({
  icon,
  title,
  children,
  action,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <span className="empty-icon">{icon}</span>
      <h3>{title}</h3>
      <p>{children}</p>
      {action}
    </div>
  );
}
export function Modal({
  title,
  children,
  close,
}: {
  title: string;
  children: ReactNode;
  close: () => void;
}) {
  const { t } = useI18n();
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    dialog?.querySelector("input")?.focus();
    return () => {
      dialog?.close();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="modal"
      onCancel={close}
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <header>
        <h2>{title}</h2>
        <button className="icon-button" aria-label={t("Cerrar")} onClick={close}>
          <X size={19} />
        </button>
      </header>
      {children}
    </dialog>
  );
}
export function Tree({
  node,
  select,
  selected,
  label,
  depth = 0,
}: {
  node: FileNode;
  select: (n: FileNode) => void;
  selected?: string;
  label?: string;
  depth?: number;
}) {
  const [open, setOpen] = useState(depth < 4);
  const directory = node.type === "directory";
  return (
    <div>
      <button
        className={"tree-node " + (node.path === selected ? "selected" : "")}
        style={{ paddingLeft: 12 + depth * 14 }}
        onClick={() => (directory ? setOpen(!open) : select(node))}
        title={node.path}
        disabled={!directory && !node.preview}
      >
        {directory ? (
          open ? (
            <ChevronDown size={13} />
          ) : (
            <ChevronRight size={13} />
          )
        ) : (
          <span className="tree-spacer" />
        )}
        {directory ? (
          <Folder size={15} />
        ) : node.preview ? (
          node.media_type === "image" ? <ImageIcon size={15} /> : <FileText size={15} />
        ) : (
          <LockKeyhole size={14} />
        )}
        <span>{label || node.name}</span>
      </button>
      {directory && open
        ? node.children?.map((child) => (
            <Tree
              key={child.path}
              node={child}
              select={select}
              selected={selected}
              depth={depth + 1}
            />
          ))
        : null}
    </div>
  );
}
export function TemplateCard({
  template,
  compact = false,
  onUse,
}: {
  template: Template;
  compact?: boolean;
  onUse?: () => void;
}) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  return (
    <section className="card template-card">
      <div className="card-heading">
        <span className="icon-tile">
          <Sparkles size={20} />
        </span>
        <div>
          <h3>{template.name}</h3>
          <span className="muted tiny">{t("Plantilla · v")}{template.version}</span>
        </div>
        <span className="tag">{template.role}</span>
      </div>
      <p>{template.description}</p>
      <div className="capability-list">
        {template.capabilities.map((item, i) => (
          <div key={item}>
            <span className="step-number">0{i + 1}</span>
            {item}
          </div>
        ))}
      </div>
      {!compact ? (
        <>
          <h4>{t("Antes de empezar")}</h4>
          <ul className="questions">
            {template.questions.map((q) => (
              <li key={q}>{q}</li>
            ))}
          </ul>
          <div className="evidence">
            <strong>{t("Forma de trabajo")}</strong>
            <p>{template.evidence_policy}</p>
          </div>
          {template.recommended_model ? <p className="model-recommendation"><strong>{t("Modelo recomendado")}</strong><br /><code>{template.recommended_model}</code> · {t(template.recommended_effort || "medium")}<br />{template.model_guidance}</p> : null}
          <h4>{t("Entregables")}</h4>
          <div className="file-tags">
            {template.deliverables.map((d) => (
              <code key={d}>{d}</code>
            ))}
          </div>
          <button
            className="secondary"
            onClick={async () => {
              await navigator.clipboard.writeText(template.instructions);
              setCopied(true);
            }}
          >
            {copied ? <Check size={15} /> : <Copy size={15} />}
            {copied ? t("Instrucciones copiadas") : t("Copiar instrucciones")}
          </button>
        </>
      ) : (
        <p className="tiny muted">
          {t("Memoria nueva y herramientas limitadas a su workspace.")}
        </p>
      )}
      {onUse ? <button className="primary template-use" onClick={onUse}>{t("Usar plantilla")} <ChevronRight size={15} /></button> : null}
    </section>
  );
}

export function ImagePreview({ src, alt, download }: { src: string; alt: string; download: string }) {
  const { t } = useI18n();
  const [failed, setFailed] = useState(false);
  return <figure className="image-preview">
    {failed ? <p role="alert">{t("No se pudo cargar esta imagen. Comprueba que el archivo siga en el workspace.")}</p> : <a href={src} target="_blank" rel="noreferrer"><img src={src} alt={alt} loading="lazy" onError={() => setFailed(true)} /></a>}
    <figcaption><span>{alt}</span><a href={download} download>{t("Descargar")}</a></figcaption>
  </figure>;
}

function MessageContent({ message, agent }: { message: Message; agent: Agent }) {
  const { t } = useI18n();
  // Render local workspace image references only; no HTML or arbitrary remote requests.
  const pieces = message.content.split(/(!\[[^\]]*\]\([^)]+\))/g);
  return <>
    {pieces.map((piece, index) => {
      const match = piece.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
      if (!match) return piece ? <p key={index}>{piece}</p> : null;
      const raw = match[2].replace(/^<|>$/g, "");
      if (/^(?:https?:|data:|javascript:|\/\/)/i.test(raw)) return <p key={index}>{match[1] || t("Referencia de imagen externa")}</p>;
      const relative = raw.replace(/^\/workspace\//, "").replace(/^\.\//, "");
      const path = relative.startsWith("agents/") || relative.startsWith("workspace/") ? relative : `agents/${agent.id}/workspace/${relative}`;
      return <ImagePreview key={path} src={imageUrl(agent.project_id, path)} alt={match[1] || relative} download={imageUrl(agent.project_id, path, true)} />;
    })}
    {message.attachments?.map((item) => <ImagePreview key={item.id} src={imageUrl(agent.project_id, item.path)} alt={item.name} download={imageUrl(agent.project_id, item.path, true)} />)}
  </>;
}

export function CreateAgentModal({ template, projects, agents, initialProjectId, close, created }: { template: Template; projects: Project[]; agents: Agent[]; initialProjectId: string; close: () => void; created: (agent: Agent) => Promise<void> }) {
  const { t, language } = useI18n();
  const [projectId, setProjectId] = useState(initialProjectId || projects[0]?.id || "");
  const [name, setName] = useState("");
  const [plannerId, setPlannerId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { setError(""); }, [language]);
  const planners = agents.filter((a) => a.project_id === projectId && a.kind === "architect");
  const selectedPlanner = planners.find((a) => a.id === plannerId)?.id || (planners.length === 1 ? planners[0].id : "");
  return <Modal title={t("Crear · ") + template.name} close={() => { if (!busy) close(); }}>
    <form onSubmit={async (event) => {
      event.preventDefault();
      setBusy(true); setError("");
      try { const agent = await post<Agent>(`/projects/${projectId}/agents`, { name, template: template.kind, planner_id: template.kind === "coder" ? selectedPlanner : null }); await created(agent); }
      catch (error) { setError((error as Error).message); }
      finally { setBusy(false); }
    }}>
      <p className="muted">{template.description} {t("El perfil tendrá memoria nueva y archivos persistentes.")}</p>
      <label htmlFor="agent-project">{t("Proyecto")}</label>
      <select id="agent-project" value={projectId} required disabled={busy} onChange={(e) => { setProjectId(e.target.value); setPlannerId(""); }}><option value="">{t("Selecciona un proyecto")}</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
      <label htmlFor="agent-name">{t("Nombre del agente")}</label>
      <input id="agent-name" value={name} maxLength={80} required disabled={busy} onChange={(e) => setName(e.target.value)} placeholder={t("Elige su nombre")} />
      {template.kind === "coder" ? <><label htmlFor="agent-planner">{t("Arquitecto / Planner")}</label><select id="agent-planner" value={selectedPlanner} onChange={(e) => setPlannerId(e.target.value)} required disabled={busy}><option value="">{t("Selecciona un arquitecto")}</option>{planners.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select><p className="field-help">{planners.length ? t("El coder leerá el plan publicado por este arquitecto antes de escribir código.") : t("Primero crea un arquitecto/planner en este proyecto.")}</p></> : null}
      {template.recommended_model ? <p className="field-help">{t("Recomendación: {model} · {effort}. Se aplicarán tus preferencias globales, ajustables en el chat.", { model: template.recommended_model, effort: t(template.recommended_effort || "medium") })} {template.model_guidance}</p> : null}
      {error ? <p className="inline-error" role="alert">{error}</p> : null}
      <div className="modal-actions"><button type="button" className="secondary" disabled={busy} onClick={close}>{t("Cancelar")}</button><button className="primary" disabled={busy || !projectId || (template.kind === "coder" && !selectedPlanner)}>{busy ? t("Preparando…") : t("Crear agente")}</button></div>
    </form>
  </Modal>;
}

export function Chat({
  agent,
  connected,
  changed,
  onSettings,
  onPrepare,
  templates,
}: {
  agent: Agent;
  connected: boolean;
  changed: () => Promise<void>;
  onSettings: () => void;
  onPrepare: (kind: Template["kind"]) => void;
  templates: Template[];
}) {
  const { t, language } = useI18n();
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const bottom = useRef<HTMLDivElement>(null);
  const [model, setModel] = useState(agent.model);
  const [effort, setEffort] = useState(agent.effort);
  useEffect(() => {
    let active = true;
    setError("");
    api<Message[]>("/agents/" + agent.id + "/messages")
      .then((m) => {
        if (active) setMessages(m);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [agent.id, language]);
  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages, busy]);
  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() || busy) return;
    setBusy(true);
    setError("");
    try {
      if (model !== agent.model || effort !== agent.effort)
        await put("/agents/" + agent.id + "/model", { model, effort });
      const input = text.trim();
      setText("");
      setMessages((m) => [
        ...m,
        { id: -Date.now(), role: "user", content: input, source: "user" },
      ]);
      await post("/agents/" + agent.id + "/chat", {
        content: input,
        request_id: crypto.randomUUID(),
      });
      setMessages(await api("/agents/" + agent.id + "/messages"));
      await changed();
    } catch (e) {
      setError((e as Error).message);
      setMessages(await api("/agents/" + agent.id + "/messages").catch(() => messages));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="chat-shell">
      <div className="chat-heading">
        <Mark small />
        <div>
          <strong>{agent.name}</strong>
          <span className="tiny muted">
            {t(agentRoles[agent.kind])}
          </span>
        </div>
      </div>
      <div className="messages" aria-live="polite">
        {messages.length === 0 ? (
          <div className="chat-welcome">
            <span className="welcome-symbol">
              {agent.kind === "hapic" ? <Mark /> : <Sparkles size={30} />}
            </span>
            <h2>
              {agent.kind === "hapic"
                ? t("¿Qué vamos a crear?")
                : t(agentRoles[agent.kind])}
            </h2>
            <p>
              {agent.kind === "hapic"
                ? t("Dale a tu proyecto un especialista con contexto, memoria y un espacio propio.")
                : templates.find((t) => t.kind === agent.kind)?.description}
            </p>
            {agent.kind === "hapic" ? (
              <div className="template-choices">{templates.map((template) => <button
                key={template.kind}
                className="secondary"
                disabled={busy}
                onClick={() => {
                  if (connected)
                    setText(t("Quiero crear un {name} para este proyecto.", { name: template.name }));
                  else onPrepare(template.kind);
                }}
              >
                <Sparkles size={16} />
                {t(connected ? "Crear {name}" : "Preparar {name}", { name: template.name })}
              </button>)}</div>
            ) : null}
            {!connected ? (
              <div className="offline-note">
                <span className="status">
                  <i />
                  {t("IA pendiente de conexión")}
                </span>
                <p>
                  {t("Puedes preparar perfiles y archivos. Para conversar, configura OpenAI e inicia el runtime Docker.")}
                </p>
                <button className="text-button" onClick={onSettings}>
                  {t("Ir a configuración")} <ChevronRight size={14} />
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
        {messages.map((m) => (
          <div className={"message " + m.role} key={m.id}>
            {m.role !== "user" ? <Mark small /> : null}
            <div className="message-body">
              <span className="message-label">
                {m.role === "user" ? t("Tú") : agent.name}
              </span>
              <MessageContent message={m} agent={agent} />
            </div>
          </div>
        ))}
        {busy ? (
          <div className="thinking">
            <LoaderCircle className="spin" size={16} />
            {t("{name} está trabajando…", { name: agent.name })}
          </div>
        ) : null}
        <div ref={bottom} />
      </div>
      {error ? (
        <div className="inline-error" role="alert">
          {error}
        </div>
      ) : null}
      <form className="composer" onSubmit={send}>
        <label className="sr-only" htmlFor="chat-input">
          {t("Mensaje para {name}", { name: agent.name })}
        </label>
        <textarea
          id="chat-input"
          rows={2}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={
            t("Escribe a {name}…", { name: agent.name })
          }
          disabled={busy || !connected}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              e.currentTarget.form?.requestSubmit();
            }
          }}
        />
        <div className="composer-bottom">
          <div className="composer-selects">
            <label>
              <span className="sr-only">{t("Modelo de la conversación")}</span>
              <ModelSelect
                value={model}
                savedValue={agent.model}
                onChange={setModel}
                ariaLabel={t("Modelo de la conversación")}
                disabled={busy}
              />
            </label>
            <label>
              <span className="sr-only">{t("Razonamiento")}</span>
              <select
                value={effort}
                onChange={(e) => setEffort(e.target.value)}
                aria-label={t("Razonamiento de la conversación")}
                disabled={busy}
              >
                {["low", "medium", "high", "xhigh", "max"].map((v) => (
                  <option key={v} value={v}>{t(v)}</option>
                ))}
              </select>
            </label>
          </div>
          <button
            className="send"
            aria-label={t("Enviar mensaje")}
            disabled={busy || !text.trim() || !connected}
          >
            {busy ? (
              <LoaderCircle className="spin" size={17} />
            ) : (
              <ArrowUp size={18} />
            )}
          </button>
        </div>
      </form>
      <p className="chat-footnote">
        {t("Estado y memoria locales. Las consultas y el contexto se envían a OpenAI.")}
      </p>
    </section>
  );
}
