---
name: hapic-execution
description: Ejecuta o actualiza Hapic en el puerto 8000, limpia sus contenedores obsoletos y recrea únicamente los runtimes Hermes afectados por los cambios. Usar al iniciar, reiniciar o aplicar cambios a una ejecución de este repositorio.
---

# Ejecutar Hapic

Esta skill pertenece al repositorio. La URL de la plataforma es siempre `http://127.0.0.1:8000`; no abras otra instancia en 8002, 8080 u otro puerto para eludir una ejecución existente. Los puertos internos/asignados de Hermes son independientes.

## Elegir qué reiniciar

Inspecciona el diff y la ejecución actual antes de tocar procesos:

| Cambio | Acción |
| --- | --- |
| UI, CSS o textos del frontend | Compilar `frontend/` y verificar la interfaz. Conservar los contenedores Hermes. |
| Documentación/demo | Verificar esos archivos; no recrear Hermes ni reiniciar un backend ajeno al cambio. |
| API, servicio, almacenamiento o instrucciones que se inyectan en cada turno | Reiniciar el control de gestión si hace falta cargar el código. Conservar Hermes si su configuración efectiva sigue vigente. |
| Imagen, variables/credenciales del contenedor, montajes, red, conexión MCP o herramientas autorizadas | Comparar los runtimes y recrear únicamente los afectados. |

Los cambios de `SOUL.md` y contratos de plantilla se inyectan en cada turno mediante `platform_instructions`; no exigen por sí solos otra instancia. Inspecciona la implementación si cambia un archivo que se copia al perfil solo al crearlo. Revisa `backend/runtime.py`, `backend/templates.py` y `backend/tool_catalog.py` para decidir el impacto.

## Mantener una única ejecución

- Identifica el proceso que escucha en 8000, su comando, checkout y directorio de datos. No mates un proceso desconocido por ocupar el puerto. Si pertenece a Hapic y debe sustituirse, detenlo de forma ordenada y reutiliza sus datos cuando correspondan a la ejecución solicitada.
- No cambies silenciosamente de `.hapic`, no mezcles bases de instalaciones ni copies claves entre perfiles. Conserva la instalación donde el usuario está trabajando. Para trasladar datos desde un worktree desechable, detén sus escritores y respalda el directorio completo antes de una migración autorizada.
- `scripts/start.sh` usa por defecto el checkout principal. Si los cambios solicitados están solo en el worktree actual, utiliza `HAPIC_APP_DIR` explícitamente para ejecutar ese código; no presentes el checkout principal sin cambios como la nueva versión. Conserva explícitamente `HAPIC_DATA_DIR` y `HAPIC_HOST_DATA_DIR` de la instalación elegida.
- Verifica intérprete, dependencias y build. En macOS/Linux inicia con `HAPIC_PYTHON=<python> HAPIC_APP_DIR=<checkout> HAPIC_DATA_DIR=<datos> HAPIC_HOST_DATA_DIR=<datos-host> ./scripts/start.sh`. En Windows usa `scripts/start.ps1`. Ambos fijan 8000 y el MCP nativo en `http://host.docker.internal:8000/mcp/`; Compose usa `http://hapic:8000/mcp/` dentro de su red.
- Respeta el contexto Docker activo. El lanzador nativo traduce el contexto a `DOCKER_HOST`; no presupongas Docker Desktop ni cambies el contexto global del usuario.

## Conciliar contenedores

El auxiliar `scripts/reconcile.py` presenta un plan por defecto. Ejecútalo desde la raíz con el mismo Python, contexto Docker y variables de datos/MCP que usa el servidor:

```sh
python .agents/skills/hapic-execution/scripts/reconcile.py --impact runtime --data-dir /ruta/a/.hapic
```

Usa `--impact ui` para una actualización exclusiva de interfaz: no consulta ni modifica Docker. `--impact backend` conserva los runtimes actuales, salvo residuos de esa instalación que ya no correspondan a un agente/contenedor vigente. `--impact runtime` compara la firma de configuración, permisos, credenciales, imagen y montajes, además de la imagen local real. Si la actualización exige renovar un tag flotante, descarga primero la imagen solicitada y después compara; una etiqueta `stable` sin descargar no demuestra que tengas la versión nueva. Las instancias anteriores a las firmas se reemplazan una vez cuando procede actualizar el runtime.

- Revisa el plan y aplica las acciones autorizadas añadiendo `--apply`. El auxiliar usa la API de Hapic en 8000 para recrear y comprobar readiness; verifica que los IDs de agentes de esa API correspondan al directorio de datos indicado.
- `--agent-id <id>` permite arrancar un perfil concreto solicitado por el usuario. No arranques todas las plantillas ni todos los perfiles pendientes. No genera inferencia.
- Para una instalación anterior que estás retirando, demuestra primero que pertenece a este repositorio y ha dejado de ser la ejecución activa. Añade su ruta exacta con `--retire-installation /ruta/anterior/.hapic` para incluir sus contenedores en el plan. Conserva todos sus datos. No uses rutas de otros proyectos ni deduzcas propiedad solo del prefijo del nombre.
- La propiedad exige etiquetas `hapic.agent` y `hapic.installation`. La limpieza elimina solo los contenedores identificados; nunca ejecuta `docker system prune`, `docker volume prune`, borrado de `.hapic` ni eliminación de volúmenes.
- Si falla una recreación, detén la conciliación e informa del agente y la etapa. No repitas automáticamente acciones con resultado incierto. Una firma identifica configuración, no sustituye comprobar el runtime. Incrementa `DockerRuntime.spec_version` si cambian opciones de creación que no forman parte de la firma.

## Verificar el resultado

Comprueba `/api/health`, abre la UI en 8000 y revisa el agente afectado. Después de recrear, exige `/health/detailed` autenticado con `status: ok`. Confirma también la conexión MCP desde Hermes con su token y las herramientas de su rol: una API saludable no demuestra que pueda crear agentes. Si necesitas Python dentro del contenedor, usa el intérprete indicado por `HERMES_PYTHON`; el `python` del sistema puede carecer de las dependencias de Hermes. No imprimas tokens, claves ni `docker inspect` completo. Usa una consulta MCP de lectura; una inferencia solo cuando sea necesaria para la solicitud del usuario.

Informa qué ejecución quedó en 8000, qué contenedores conservaste/retiraste/recreaste y qué verificaste. Para un cambio exclusivo de UI, deja claro que Hermes se conservó. No declares el arranque exitoso si solo se encoló la provisión.
