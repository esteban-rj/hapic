# API local y herramientas MCP

La URL predeterminada es `http://127.0.0.1:8000`. La API utiliza JSON y está diseñada para la interfaz local del MVP. No es una API pública multiusuario.

## Sesión

`GET /api/bootstrap` establece la cookie `hapic_session` (HttpOnly y SameSite Strict) y devuelve un token `csrf`. Las operaciones que modifican datos requieren esa cookie y el encabezado `X-Hapic-CSRF`. Cuando se envía `Origin`, debe coincidir con el origen de la solicitud.

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
| POST | `/api/projects/{project_id}/agents` | Preparar especialista UX y solicitar provisión: `{"name":"Nora"}` |
| POST | `/api/agents/{agent_id}/start` | Solicitar inicio o recreación del runtime |
| GET | `/api/agents/{agent_id}/runtime` | Estado actual y readiness de Hermes |
| GET | `/api/agents/{agent_id}/messages` | Historial visible de la plataforma |
| GET | `/api/agents/{agent_id}/events` | Hasta 100 eventos recientes |
| POST | `/api/agents/{agent_id}/chat` | Enviar turno con `content` y `request_id` único |
| GET | `/api/projects/{project_id}/tree` | Árbol real filtrado del proyecto |
| GET | `/api/projects/{project_id}/file?path=…` | Vista previa de documento permitido |
| PUT | `/api/settings/model` | Modelo y esfuerzo predeterminados para nuevos agentes |
| PUT | `/api/agents/{agent_id}/model` | Modelo y esfuerzo de un agente existente |
| PUT | `/api/settings/openai` | Guardar `api_key` en el servidor; nunca devuelve su valor |
| DELETE | `/api/settings/openai` | Eliminar la credencial guardada en archivo del servidor |

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

Los tipos de texto permitidos son Markdown, texto, JSON, YAML, CSV, HTML, CSS y SVG, hasta 256 000 bytes. La interfaz muestra su contenido como texto, sin ejecutar HTML o SVG.

## MCP

El servidor MCP se monta en `/mcp/` mediante el SDK oficial de Python. Los tokens se crean por agente y no se entregan al navegador. Su identidad determina el proyecto y el rol; el modelo no puede ampliar ese alcance con argumentos.

| Herramienta | Agente autorizado | Entrada |
| --- | --- | --- |
| `get_ux_template` | Hapic | Sin argumentos de negocio |
| `create_ux_agent` | Hapic | `name` |
| `project_list_files` | UX | Sin argumentos de negocio |
| `project_read_file` | UX | `path` relativa a su workspace |
| `project_write_file` | UX | `path` y `content` de texto |

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
