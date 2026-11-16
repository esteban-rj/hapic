# API local y herramientas MCP

La URL predeterminada es `http://127.0.0.1:8000`. La API utiliza JSON y está diseñada para la interfaz local del MVP. No es una API pública multiusuario.

## Sesión

`GET /api/bootstrap` establece la cookie `hapic_session` (HttpOnly y SameSite Lax para permitir el retorno GET de Google OAuth) y devuelve un token `csrf`. Las operaciones que modifican datos requieren esa cookie y el encabezado `X-Hapic-CSRF`. Cuando se envía `Origin`, debe coincidir con el origen de la solicitud.

Los hosts de la interfaz y API se limitan a `localhost`, `127.0.0.1` y `::1`. Los endpoints MCP usan autenticación separada con Bearer token por agente y protección contra DNS rebinding.

## Endpoints

| Método | Ruta | Uso |
| --- | --- | --- |
| GET | `/api/health` | Salud del control de gestión; no comprueba inferencia |
| GET | `/api/bootstrap` | Establecer sesión local y obtener CSRF |
| GET | `/api/state` | Organizaciones, proyectos y agentes autorizados; ajustes globales |
| GET | `/api/capabilities` | Conexión Docker y presencia/origen de la credencial, sin su valor |
| POST | `/api/organizations` | Crear organización: `{"name":"Estudio"}` |
| POST | `/api/organizations/{org_id}/projects` | Crear proyecto y perfil Hapic: `{"name":"Producto"}` |
| GET | `/api/templates/ux` | Plantilla UX, capacidades, entregables e instrucciones |
| GET | `/api/templates` | Catálogo UX, diseñador, arquitecto, coder y community manager, con recomendaciones |
| POST | `/api/projects/{project_id}/agents` | Crear perfil: `{"name":"Nora","template":"ux"}`; coder exige `planner_id` |
| POST | `/api/agents/{agent_id}/start` | Solicitar inicio o recreación del runtime |
| GET | `/api/agents/{agent_id}/runtime` | Estado actual y readiness de Hermes |
| GET | `/api/agents/{agent_id}/messages` | Historial visible de la plataforma |
| GET | `/api/agents/{agent_id}/files` | Lista plana de entregables propios con nombre, ruta, tamaño y tipo |
| GET | `/api/agents/{agent_id}/events` | Hasta 100 eventos recientes |
| GET | `/api/projects/{project_id}/delegations` | Historial paginado de delegaciones, con nombres, roles y contadores por estado |
| GET | `/api/projects/{project_id}/delegations/{task_id}` | Detalle con tarea, contexto, resultado esperado, respuesta y error |
| POST | `/api/agents/{agent_id}/chat` | Enviar turno con `content` y `request_id` único |
| GET | `/api/projects/{project_id}/tree` | Árbol real filtrado; `agent_id` limita al agente seleccionado |
| GET | `/api/projects/{project_id}/file?path=…` | Vista previa de documento permitido; admite `agent_id` |
| GET | `/api/projects/{project_id}/image?path=…` | Imagen del workspace; `download=true` para descargar; admite `agent_id` |
| PUT | `/api/settings/model` | Modelo y esfuerzo predeterminados para nuevos agentes |
| PUT | `/api/agents/{agent_id}/model` | Modelo y esfuerzo de un agente existente |
| PUT | `/api/settings/openai` | Guardar o reemplazar `api_key` cifrada en el servidor con prioridad sobre `OPENAI_API_KEY`; nunca devuelve su valor |
| DELETE | `/api/settings/openai` | Eliminar la credencial guardada y volver a `OPENAI_API_KEY` si está definida; devuelve `configured` |
| GET | `/api/tools` | Catálogo de integraciones reutilizables |
| GET | `/api/settings/youtube` | Estado, origen (`file`, `server`, `none`), scopes y URI de retorno; sin secretos o ruta privada |
| PUT | `/api/settings/youtube` | Cargar el JSON OAuth web en `credentials` para el operador local; se rechaza cuando el servidor administra un archivo |
| GET | `/api/projects/{project_id}/tools` | Conexiones y asignaciones del proyecto autorizado |
| PUT | `/api/agents/{agent_id}/tools/{tool_id}` | Configurar `enabled` y `connection_id` para cualquier tipo de agente |
| POST | `/api/projects/{project_id}/connections/youtube/authorize` | Iniciar OAuth con estado por sesión/proyecto y PKCE |
| GET | `/api/connections/youtube/callback` | Consumir estado de un solo uso y verificar el canal en Google |
| DELETE | `/api/projects/{project_id}/connections/{connection_id}` | Revocar y desconectar el canal del proyecto |
| GET | `/api/projects/{project_id}/connections/{connection_id}/videos` | Página de vídeos real; `page_token` opcional |

El nivel de razonamiento admitido por la plataforma es `low`, `medium`, `high`, `xhigh` o `max`. La compatibilidad del modelo elegido también depende del proveedor.

Un turno puede incluir, por ejemplo:

```json
{
  "content": "Quiero crear un agente UX para este proyecto.",
  "request_id": "identificador-unico-del-turno"
}
```

Reutiliza un `request_id` solo para reintentar exactamente el mismo turno del mismo agente. Si cambia su identidad, la API devuelve `409`. Si hay un turno o provisión activos, también puede devolver `409`. Tras un fallo de transporte, la ejecución remota puede haber comenzado: revisa la actividad antes de repetir acciones con un identificador nuevo.

## Archivos

La ruta de vista previa es relativa al proyecto. Se rechazan rutas absolutas, traversal, enlaces simbólicos, uniones de Windows y nombres protegidos. No se previsualizan `config.yaml`, archivos de autenticación, secretos, logs ni bases de datos binarias.

La pestaña **Archivos** consulta `GET /api/agents/{agent_id}/files`: devuelve una lista plana de documentos e imágenes válidos del workspace propio y, para un arquitecto, su propio plan publicado. Cada entrada contiene `name`, `path` relativa al proyecto, `relative_path` corta, `size` y `media_type` (`text` o `image`). No recorre el perfil Hermes ni incluye memorias, carpetas técnicas, archivos sin vista previa o planes generados por otros agentes. Los archivos dentro de subcarpetas aparecen como accesos directos. Se valida la pertenencia del agente antes de enumerar sus entregables.

Las vistas previas y descargas envían `agent_id` y mantienen la comprobación de alcance. El endpoint `/tree` conserva el árbol técnico filtrado para compatibilidad: con `agent_id`, incluye el perfil y workspace propios, más el plan publicado por ese arquitecto o su arquitecto vinculado. Sin `agent_id`, conserva la vista de proyecto del operador local.

Se permiten documentos y extensiones habituales de código (`.py`, `.ts`, `.tsx`, `.js`, `.sql`, etc.), hasta 256 000 bytes. La interfaz muestra el contenido como texto, sin ejecutar HTML o SVG. La ruta de imágenes admite PNG, JPEG, WebP y GIF hasta 20 MiB, verifica su firma y extensión, exige sesión y solo acepta workspaces. Rechaza imágenes dentro de perfiles Hermes y cachés.

Los mensajes incluyen `attachments: []`. Cada imagen registrada incluye `id`, `path` relativa al proyecto, `name`, `mime_type` y `url` del endpoint autenticado. La generación produce un mensaje `source: artifact` independiente de la respuesta final de Hermes, de modo que un fallo posterior no oculta el archivo guardado.

`template` admite `ux` (predeterminado por compatibilidad), `graphic-designer`, `architect`, `coder` y `community-manager`. Ejemplo: `{"name":"Lin","template":"coder","planner_id":"agt_…"}`. El arquitecto debe existir en el mismo proyecto. Community Manager no requiere `planner_id`: `{"name":"Alma","template":"community-manager"}`.

Community Manager incluye herramientas de archivos y YouTube de solo lectura, pendiente de un canal autorizado. La integración se puede asignar a cualquier agente desde Herramientas. Consulta [YouTube](youtube.md) para su configuración y los límites actuales; Instagram, publicación y respuestas siguen pendientes.

## MCP

El servidor MCP se monta en `/mcp/` mediante el SDK oficial de Python. Los tokens se crean por agente y no se entregan al navegador. Su identidad determina el proyecto y el rol; el modelo no puede ampliar ese alcance con argumentos.

| Herramienta | Agente autorizado | Entrada |
| --- | --- | --- |
| `get_ux_template` | Hapic | Sin argumentos de negocio |
| `create_ux_agent` | Hapic | `name` |
| `list_agent_templates` | Hapic | Sin argumentos de negocio |
| `list_project_agents` | Todos | Sin argumentos; solo el proyecto autorizado, incluye `delegation_contract` |
| `delegate_task` | Todos | `agent_id`, `task`, `request_id`, `context` y `expected_result` opcionales |
| `get_task_status` | Emisor o destinatario | `task_id` de una delegación del mismo proyecto |
| `create_specialist_agent` | Hapic | `name`, `template`, `planner_id` para coder |
| `project_list_files` | Especialistas | Sin argumentos de negocio |
| `project_read_file` | Especialistas | `path` relativa a su workspace |
| `project_write_file` | Especialistas | `path` y `content`; coder exige lectura del plan vigente |
| `generate_project_image` | UX y diseñador gráfico | `prompt`, `size` opcional; una imagen facturable guardada y adjunta |
| `publish_architecture_plan` | Arquitecto | `content` Markdown, hasta 256 KB |
| `get_architecture_plan` | Coder | Plan del arquitecto vinculado y revisión, sin argumentos |
| `youtube_get_channel` | Cualquier agente con YouTube habilitado y canal asignado | Sin argumentos |
| `youtube_list_videos` | Misma autorización por agente/proyecto | `max_results` 1–50, `page_token` opcional |
| `youtube_list_comments` | Misma autorización; valida el vídeo del canal | `video_id` opcional, `max_results` 1–50, `page_token` |
| `youtube_get_analytics` | Misma autorización por agente/proyecto | `start_date`, `end_date` YYYY-MM-DD, hasta 366 días |

Las herramientas se filtran en la configuración Hermes y se autorizan de nuevo en el servidor. Que `create_ux_agent` devuelva un perfil y trabajo en cola no significa que su contenedor esté listo; consulta el runtime.

## Errores

- `400`: nombre, ruta, ajuste o contenido no permitido.
- `401`: sesión o token MCP ausentes o inválidos.
- `403`: origen, host o CSRF no autorizado.
- `404`: recurso inexistente o sin pertenencia autorizada.
- `409`: turno ocupado o identidad de reintento incompatible.
- `422`: datos que no cumplen el esquema de entrada.
- `503`: Docker, Hermes, credencial o inferencia no disponibles.

Los errores de validación se redactan para evitar devolver valores de credenciales. Las respuestas de la API llevan `Cache-Control: no-store`.

Un turno Hermes puede devolver HTTP 200 y `status: failed` aunque el proveedor haya rechazado la autenticación. El chat de Hapic responde `503` con un mensaje específico cuando identifica ese rechazo de OpenAI (401); nunca refleja el error bruto ni fragmentos de la credencial. La actividad guarda el mismo diagnóstico seguro. Un turno cancelado se informa por separado.


### Delegación directa

Todos los agentes pueden usar `list_project_agents` para consultar roles, capacidades, entregables y `delegation_contract` de sus colegas del proyecto, incluido Hapic. El contrato contiene cinco listas de texto: `owns` (responsabilidad), `delegate_when` (cuándo llamarlo), `required_inputs` (contexto necesario), `returns` (entrega esperada) y `limitations` (límites). Los mismos contratos aparecen en `/api/templates`, `/api/templates/ux` y `list_agent_templates` para los cinco especialistas. No incluyen instrucciones privadas ni dan acceso a archivos de otros agentes.

- `delegate_task(agent_id, task, request_id, context="", expected_result="")`: crea una tarea asíncrona directamente para otro agente del mismo proyecto. Usa el contrato del destinatario para aportar `required_inputs` en `context` y concretar entregables y criterios en `expected_result`. Reutiliza el mismo `request_id` (hasta 128 caracteres) para reintentar la misma solicitud sin duplicar ejecución. Cambiar sus argumentos con ese identificador se rechaza.
- `get_task_status(task_id)`: devuelve el registro y su `status` (`queued`, `running`, `completed`, `failed`), `result` y `error`; solo para emisor o destinatario.

La respuesta de creación no confirma finalización. Consulta el resultado antes de usarlo. Un fallo puede ocurrir después de que el runtime haya empezado a actuar: revisa la actividad del destinatario antes de crear otra solicitud. No hay llamada adicional al orquestador ni continuación automática del emisor. Reinicia los runtimes existentes después de actualizar para cargar las herramientas.

Las instrucciones piden al destinatario devolver en `result` una respuesta con **Estado del trabajo**, **Resultado**, **Artefactos**, **Validación** y **Pendientes para el remitente**. El contenido necesario se incluye en la respuesta, además de referencias reales de archivos, sin asumir acceso al workspace del colega. Si falta contexto esencial, las preguntas se devuelven al remitente con el estado del trabajo bloqueado. `result` sigue siendo texto libre y `status: completed` confirma el fin del turno, no el cumplimiento de los criterios de aceptación; el backend no valida esa convención de respuesta.

Las instrucciones de rol y contratos actualizados se envían en cada turno, también para perfiles persistentes existentes. Si las herramientas MCP de colaboración ya están cargadas, estas actualizaciones de instrucciones no requieren recrear el contenedor.

### Historial para el operador

El panel **Delegaciones** utiliza las rutas HTTP del proyecto con la sesión local y la pertenencia a su organización. El operador puede revisar todas las delegaciones de sus proyectos; el acceso MCP de un agente continúa limitado a las tareas en las que participa.

`GET /api/projects/{project_id}/delegations` admite `status` (`queued`, `running`, `completed`, `failed`), `agent_id` (emisor o destinatario), `limit` (1–100, predeterminado 20) y `offset` (mínimo 0). Devuelve `tasks`, `total` filtrado, `limit`, `offset` y `counts` de todo el proyecto. Las tareas se ordenan por fecha de creación descendente y por ID para desempatar. Cada fila incluye IDs, nombres y tipos de ambos agentes, estado, fechas, `parent_id` y `task_preview` de hasta 200 caracteres; los resultados completos solo se leen al abrir el detalle.

`GET /api/projects/{project_id}/delegations/{task_id}` devuelve el registro completo con nombres y roles. Una tarea de otro proyecto o sin pertenencia responde `404`. El historial y el detalle se consultan cada seis segundos mientras el panel está visible; los resultados se presentan como texto y pueden copiarse. Abrir el panel no inicia runtimes ni llamadas a modelos.
