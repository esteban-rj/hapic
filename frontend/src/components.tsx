import { useEffect, useRef, useState, type ReactNode } from "react";
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
} from "lucide-react";
import {
  api,
  post,
  put,
  type Agent,
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
  const labels: Record<string, string> = {
    pending: "Pendiente de iniciar",
    provisioning: "Preparando runtime",
    running: "API disponible",
    blocked: "Requiere configuración",
    error: "Error de provisión",
    stopped: "Detenido",
    unavailable: "Sin conexión",
    starting: "API iniciando",
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
        <button className="icon-button" aria-label="Cerrar" onClick={close}>
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
          <FileText size={15} />
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
}: {
  template: Template;
  compact?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <section className="card template-card">
      <div className="card-heading">
        <span className="icon-tile">
          <Sparkles size={20} />
        </span>
        <div>
          <h3>{template.name}</h3>
          <span className="muted tiny">Plantilla · v{template.version}</span>
        </div>
        <span className="tag">UX</span>
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
          <h4>Antes de empezar</h4>
          <ul className="questions">
            {template.questions.map((q) => (
              <li key={q}>{q}</li>
            ))}
          </ul>
          <div className="evidence">
            <strong>Diseño con evidencia.</strong>
            <p>{template.evidence_policy}</p>
          </div>
          <h4>Entregables</h4>
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
            {copied ? "Instrucciones copiadas" : "Copiar instrucciones"}
          </button>
        </>
      ) : (
        <p className="tiny muted">
          Memoria nueva y herramientas limitadas a su workspace.
        </p>
      )}
    </section>
  );
}
type Message = { id: number; role: string; content: string; source: string };
export function Chat({
  agent,
  connected,
  changed,
  onSettings,
  onCreated,
}: {
  agent: Agent;
  connected: boolean;
  changed: () => Promise<void>;
  onSettings: () => void;
  onCreated: (id: string) => void;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [guided, setGuided] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);
  const [model, setModel] = useState(agent.model);
  const [effort, setEffort] = useState(agent.effort);
  useEffect(() => {
    let active = true;
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
  }, [agent.id]);
  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages, guided, busy]);
  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() || busy) return;
    setBusy(true);
    setError("");
    try {
      if (guided) {
        const created = await post(
          "/projects/" + agent.project_id + "/agents",
          { name: text.trim() },
        );
        setText("");
        setGuided(false);
        await changed();
        onCreated(created.id);
      } else {
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
      }
    } catch (e) {
      setError((e as Error).message);
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
            {agent.kind === "hapic"
              ? "Orquestador de tu proyecto"
              : "Especialista en experiencia de usuario"}
          </span>
        </div>
        <span className="tag">Hermes</span>
      </div>
      <div className="messages" aria-live="polite">
        {messages.length === 0 && !guided ? (
          <div className="chat-welcome">
            <span className="welcome-symbol">
              {agent.kind === "hapic" ? <Mark /> : <Sparkles size={30} />}
            </span>
            <h2>
              {agent.kind === "hapic"
                ? "¿Qué vamos a crear?"
                : "Una buena experiencia empieza aquí."}
            </h2>
            <p>
              {agent.kind === "hapic"
                ? "Dale a tu proyecto un especialista con contexto, memoria y un espacio propio."
                : "Cuéntame sobre tu producto, tus usuarios y el problema que quieres resolver."}
            </p>
            {agent.kind === "hapic" ? (
              <button
                className="secondary"
                disabled={busy}
                onClick={() => {
                  if (connected)
                    setText("Quiero crear un agente UX para este proyecto.");
                  else setGuided(true);
                }}
              >
                <Sparkles size={16} />
                {connected ? "Crear agente UX" : "Preparar un agente UX"}
              </button>
            ) : null}
            {!connected ? (
              <div className="offline-note">
                <span className="status">
                  <i />
                  IA pendiente de conexión
                </span>
                <p>
                  Puedes preparar perfiles y archivos. Para conversar, configura
                  OpenAI e inicia el runtime Docker.
                </p>
                <button className="text-button" onClick={onSettings}>
                  Ir a configuración <ChevronRight size={14} />
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
                {m.role === "user" ? "Tú" : agent.name + " · Hermes"}
              </span>
              <p>{m.content}</p>
            </div>
          </div>
        ))}
        {guided ? (
          <div className="guided">
            <span className="tag">Configuración guiada · sin IA</span>
            <h3>¿Cómo quieres llamar a tu agente UX?</h3>
            <p>
              Prepararemos su perfil desde la plantilla UX v1. El contenedor se
              iniciará cuando Docker y OpenAI estén disponibles.
            </p>
          </div>
        ) : null}
        {busy ? (
          <div className="thinking">
            <LoaderCircle className="spin" size={16} />
            {guided ? "Preparando perfil…" : "Hermes está trabajando…"}
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
          {guided ? "Nombre del agente UX" : "Mensaje para " + agent.name}
        </label>
        <textarea
          id="chat-input"
          rows={2}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={
            guided ? "Por ejemplo, Nora" : "Escribe a " + agent.name + "…"
          }
          disabled={busy || (!connected && !guided)}
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
              <span className="sr-only">Modelo de la conversación</span>
              <input
                value={model}
                onChange={(e) => setModel(e.target.value)}
                aria-label="Modelo de la conversación"
                disabled={busy || guided}
              />
            </label>
            <label>
              <span className="sr-only">Razonamiento</span>
              <select
                value={effort}
                onChange={(e) => setEffort(e.target.value)}
                aria-label="Razonamiento de la conversación"
                disabled={busy || guided}
              >
                {["low", "medium", "high", "xhigh", "max"].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </label>
          </div>
          <button
            className="send"
            aria-label={guided ? "Preparar agente" : "Enviar mensaje"}
            disabled={busy || !text.trim() || (!connected && !guided)}
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
        Estado y memoria locales. Las consultas y el contexto se envían a
        OpenAI.
      </p>
    </section>
  );
}
