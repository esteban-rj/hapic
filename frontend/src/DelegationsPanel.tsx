import { useEffect, useState } from "react";
import { ArrowRight, ArrowRightLeft, Check, ChevronLeft, ChevronRight, Copy, Folder, LoaderCircle, RefreshCw } from "lucide-react";
import { api, agentRoles, type Agent, type Delegation, type DelegationStatus, type Project, type ProjectDelegations } from "./api";
import { Empty } from "./components";

const PAGE_SIZE = 20;
const statuses: Record<DelegationStatus, string> = {
  queued: "En cola", running: "En curso", completed: "Finalizada", failed: "Fallida",
};
const dateFormat = new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeStyle: "short" });

function TaskStatus({ status }: { status: DelegationStatus }) {
  return <span className={`delegation-status ${status}`}><i aria-hidden="true" />{statuses[status]}</span>;
}

function usePolling<T>(path: string | null, refreshToken: number) {
  const [snapshot, setSnapshot] = useState<{ path: string; data: T; updatedAt: string }>();
  const [failure, setFailure] = useState<{ path: string; message: string }>();
  const [loadingPath, setLoadingPath] = useState<string | null>(null);
  useEffect(() => {
    if (!path) return;
    let active = true;
    let inFlight = false;
    const controller = new AbortController();
    const load = async () => {
      if (inFlight) return;
      inFlight = true;
      setLoadingPath(path);
      try {
        const data = await api<T>(path, { signal: controller.signal });
        if (active) {
          setSnapshot({ path, data, updatedAt: new Date().toISOString() });
          setFailure(undefined);
        }
      } catch (reason) {
        if (active) setFailure({ path, message: reason instanceof Error ? reason.message : "No se pudieron leer las delegaciones." });
      } finally {
        inFlight = false;
        if (active) setLoadingPath(null);
      }
    };
    void load();
    const timer = window.setInterval(() => { if (!document.hidden) void load(); }, 6000);
    return () => { active = false; controller.abort(); window.clearInterval(timer); };
  }, [path, refreshToken]);
  return {
    data: snapshot?.path === path ? snapshot.data : undefined,
    updatedAt: snapshot?.path === path ? snapshot.updatedAt : undefined,
    error: failure?.path === path ? failure.message : "",
    loading: path !== null && loadingPath === path,
  };
}

type Props = {
  projects: Project[];
  agents: Agent[];
  selectedProjectId: string;
  onSelectProject: (id: string) => void;
  onOpenAgent: (id: string) => void;
};

export function DelegationsPanel({ projects, agents, selectedProjectId, onSelectProject, onOpenAgent }: Props) {
  const project = projects.find((item) => item.id === selectedProjectId) || projects[0];
  if (!project) return <Empty icon={<Folder size={28} />} title="Un proyecto para tu equipo">Crea un proyecto para reunir agentes y consultar sus delegaciones aquí.</Empty>;
  return <ProjectTasks key={project.id} project={project} projects={projects} agents={agents.filter((item) => item.project_id === project.id)} onSelectProject={onSelectProject} onOpenAgent={onOpenAgent} />;
}

function ProjectTasks({ project, projects, agents, onSelectProject, onOpenAgent }: {
  project: Project;
  projects: Project[];
  agents: Agent[];
  onSelectProject: (id: string) => void;
  onOpenAgent: (id: string) => void;
}) {
  const [status, setStatus] = useState<DelegationStatus | "">("");
  const [agentId, setAgentId] = useState("");
  const [offset, setOffset] = useState(0);
  const [selectedId, setSelectedId] = useState("");
  const [refreshToken, setRefreshToken] = useState(0);
  const query = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(offset) });
  if (status) query.set("status", status);
  if (agentId) query.set("agent_id", agentId);
  const { data, error, loading, updatedAt } = usePolling<ProjectDelegations>(`/projects/${project.id}/delegations?${query}`, refreshToken);
  const taskId = data?.tasks.find((task) => task.id === selectedId)?.id || data?.tasks[0]?.id || "";
  const hasTasks = data ? Object.values(data.counts).some((count) => count > 0) : false;

  return <div className="delegations-panel">
    <div className="delegations-workspace card">
      <div><h2>Trabajo entre agentes</h2><p className="muted">Consulta quién encarga cada tarea y la respuesta que recibe.</p></div>
      <label>Proyecto<select value={project.id} onChange={(event) => onSelectProject(event.target.value)}>{projects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
    </div>
    <div className="delegation-metrics" aria-label="Estado de las delegaciones del proyecto">
      {(Object.entries(statuses) as [DelegationStatus, string][]).map(([value, label]) => <div className="card" key={value}><TaskStatus status={value} /><strong aria-label={`${label}: ${data?.counts[value] ?? "cargando"}`}>{data?.counts[value] ?? "—"}</strong></div>)}
    </div>
    <div className="delegations-toolbar">
      <div className="delegation-filters">
        <label>Estado<select value={status} onChange={(event) => { setStatus(event.target.value as DelegationStatus | ""); setOffset(0); setSelectedId(""); }}><option value="">Todos los estados</option>{Object.entries(statuses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label>Agente<select value={agentId} onChange={(event) => { setAgentId(event.target.value); setOffset(0); setSelectedId(""); }}><option value="">Todo el equipo</option>{agents.map((agent) => <option key={agent.id} value={agent.id}>{agent.name} · {agentRoles[agent.kind]}</option>)}</select></label>
      </div>
      <button className="secondary" disabled={loading} onClick={() => setRefreshToken((value) => value + 1)}><RefreshCw size={14} className={loading ? "spin" : undefined} />Actualizar</button>
    </div>
    {error ? <div className="error-banner" role="alert">{error} Se volverá a intentar automáticamente.</div> : null}
    {!data ? (!error ? <div className="delegation-loading" role="status"><LoaderCircle size={18} className="spin" />Cargando delegaciones…</div> : null) : <div className="delegations-layout">
      <section className="card delegation-list" aria-label="Tareas delegadas">
        <div className="card-title"><ArrowRightLeft size={16} />Tareas delegadas<span className="count">{data.total}</span></div>
        {data.tasks.length ? <div className="delegation-table-scroll"><table className="delegation-table">
          <thead><tr><th scope="col">Tarea</th><th scope="col">Emisor</th><th scope="col">Destinatario</th><th scope="col">Estado</th></tr></thead>
          <tbody>{data.tasks.map((task) => <tr key={task.id} className={task.id === taskId ? "selected" : undefined}>
            <td><button className="delegation-task-button" aria-pressed={task.id === taskId} onClick={() => setSelectedId(task.id)}><span>{task.task_preview}</span><time dateTime={task.created_at}>{dateFormat.format(new Date(task.created_at))}</time></button></td>
            <td><strong>{task.sender_name}</strong><small>{agentRoles[task.sender_kind]}</small></td>
            <td><strong>{task.recipient_name}</strong><small>{agentRoles[task.recipient_kind]}</small></td>
            <td><TaskStatus status={task.status} /></td>
          </tr>)}</tbody>
        </table></div> : <Empty icon={<ArrowRightLeft size={25} />} title={hasTasks ? "Sin tareas para estos filtros" : "Aún no hay delegaciones"}>{hasTasks ? "Prueba otro agente o estado para consultar más tareas." : "Cuando un agente encargue trabajo a un colega de este proyecto, la tarea y su respuesta aparecerán aquí."}</Empty>}
        <nav className="delegation-pagination" aria-label="Páginas de delegaciones">
          <span>{data.total && data.tasks.length ? `${offset + 1}–${offset + data.tasks.length} de ${data.total}` : "0 tareas en esta página"}</span>
          <div><button className="icon-button" aria-label="Página anterior de delegaciones" disabled={offset === 0} onClick={() => { setOffset((value) => Math.max(0, value - PAGE_SIZE)); setSelectedId(""); }}><ChevronLeft size={17} /></button><button className="icon-button" aria-label="Página siguiente de delegaciones" disabled={offset + PAGE_SIZE >= data.total} onClick={() => { setOffset((value) => value + PAGE_SIZE); setSelectedId(""); }}><ChevronRight size={17} /></button></div>
        </nav>
      </section>
      {taskId ? <TaskDetail key={taskId} projectId={project.id} taskId={taskId} refreshToken={refreshToken} onOpenAgent={onOpenAgent} /> : null}
    </div>}
    <p className="delegation-update-note">Actualización automática cada 6 segundos mientras esta vista esté visible.{updatedAt ? ` Última consulta: ${dateFormat.format(new Date(updatedAt))}.` : ""}</p>
  </div>;
}

function TaskDetail({ projectId, taskId, refreshToken, onOpenAgent }: { projectId: string; taskId: string; refreshToken: number; onOpenAgent: (id: string) => void }) {
  const { data: task, error } = usePolling<Delegation>(`/projects/${projectId}/delegations/${taskId}`, refreshToken);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState("");
  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(timer);
  }, [copied]);
  const copyResult = async () => {
    if (!task?.result) return;
    try { await navigator.clipboard.writeText(task.result); setCopied(true); setCopyError(""); }
    catch { setCopyError("No se pudo copiar. Puedes seleccionar y copiar el texto del resultado."); }
  };
  return <section className="card delegation-detail" aria-label="Detalle de la delegación">
    <div className="card-title">Detalle de la tarea{task ? <TaskStatus status={task.status} /> : null}</div>
    {error ? <div className="error-banner" role="alert">{error}</div> : null}
    {!task ? (!error ? <div className="delegation-loading" role="status"><LoaderCircle size={18} className="spin" />Cargando detalle…</div> : null) : <div className="delegation-detail-body">
      <code className="delegation-id">{task.id}</code>
      <div className="delegation-participants">
        <div><span>Envía</span><button className="text-button" onClick={() => onOpenAgent(task.sender_id)}>{task.sender_name}</button><small>{agentRoles[task.sender_kind]}</small></div>
        <ArrowRight size={17} aria-hidden="true" />
        <div><span>Recibe</span><button className="text-button" onClick={() => onOpenAgent(task.recipient_id)}>{task.recipient_name}</button><small>{agentRoles[task.recipient_kind]}</small></div>
      </div>
      <dl className="delegation-dates"><div><dt>Creada</dt><dd><time dateTime={task.created_at}>{dateFormat.format(new Date(task.created_at))}</time></dd></div><div><dt>Último cambio</dt><dd><time dateTime={task.updated_at}>{dateFormat.format(new Date(task.updated_at))}</time></dd></div></dl>
      <TaskText title="Tarea" content={task.task} />
      <TaskText title="Contexto" content={task.context || "No se adjuntó contexto adicional."} />
      <TaskText title="Resultado esperado" content={task.expected_result || "No se indicó un resultado esperado adicional."} />
      {task.parent_id ? <div className="delegation-parent"><span>Tarea de origen</span><code>{task.parent_id}</code></div> : null}
      {task.error ? <div className="delegation-task-error"><h3>La tarea no pudo completarse</h3><p>{task.error}</p></div> : null}
      <div className="delegation-result-heading"><h3>Resultado</h3>{task.result ? <button className="secondary" onClick={() => void copyResult()}>{copied ? <Check size={14} /> : <Copy size={14} />}{copied ? "Copiado" : "Copiar resultado"}</button> : null}</div>
      {copyError ? <p role="alert" className="delegation-copy-error">{copyError}</p> : null}
      {task.result ? <pre className="delegation-result">{task.result}</pre> : <p className="delegation-result-empty">{task.status === "queued" ? "La tarea está en cola. La respuesta aparecerá aquí cuando el agente termine." : task.status === "running" ? "El agente está trabajando. La respuesta aparecerá aquí cuando termine." : task.status === "failed" ? "No hay un resultado disponible para esta tarea." : "El agente terminó sin un resultado de texto disponible."}</p>}
      {task.status === "completed" ? <p className="delegation-result-note">Revisa la respuesta para confirmar los entregables y los pendientes que haya indicado el agente.</p> : null}
    </div>}
  </section>;
}

function TaskText({ title, content }: { title: string; content: string }) {
  return <div className="delegation-text"><h3>{title}</h3><p>{content}</p></div>;
}
