# Hapic

MVP local en español para organizar proyectos y trabajar con agentes Hermes persistentes. Interfaz React/Vite, control de gestión FastAPI, metadatos SQLite y un contenedor oficial Hermes por agente.

Los cinco bocetos previos están conservados en [docs/mockups](docs/mockups). La aplicación inicia vacía; los ejemplos de esos bocetos no se convierten en datos ni en estados de runtime.

## Documentación

- [Arquitectura](docs/architecture.md): componentes, datos, provisión y límites de acceso.
- [API y MCP](docs/api.md): rutas, sesión local, herramientas y errores.
- [Operación](docs/operations.md): arranque, credenciales, persistencia, copias y diagnóstico.
- [Changelog](CHANGELOG.md): cambios de la versión `0.1.0`.

## Ejecutar localmente en Windows

Requisitos: Python 3.14, Node 24 y pnpm 11. Docker Desktop con motor Linux se necesita para los agentes, pero no para usar la plataforma, crear organizaciones/proyectos o explorar perfiles.

```powershell
python -m venv --without-pip .venv
python -m pip --python .venv install -r requirements.lock
Set-Location frontend
pnpm install --frozen-lockfile
pnpm build
Set-Location ..
.\scripts\start.ps1
```

Abre http://127.0.0.1:8000. El script también acepta `-Port 8080`. Puedes iniciar directamente con `.\.venv\Scripts\python.exe -m uvicorn backend.app:app --host 127.0.0.1 --port 8000`.

Durante desarrollo: inicia el backend en 8000 y ejecuta `pnpm dev` dentro de `frontend`; Vite sirve en 5173 y reenvía `/api` al backend. El build de producción lo sirve FastAPI desde el mismo origen.

## Recorrido

1. Crea una organización y un proyecto desde la plataforma. Se guardan registros, pertenencia del operador local y carpetas reales. El proyecto recibe un perfil Hapic nuevo.
2. En Configuración, define la API key de OpenAI mediante el formulario dedicado. También puedes definir `OPENAI_API_KEY` en el entorno del servidor o en un archivo `.env` ignorado por Git. Nunca la pegues en el chat.
3. Inicia Docker Desktop. Abre Hapic y pulsa **Iniciar runtime**. Si ya hay key al crear un proyecto, se solicita su arranque automáticamente.
4. Pide crear un agente UX. Hapic usa la plantilla versionada, pregunta el nombre si falta y llama la herramienta MCP de provisión. El perfil nuevo y su contenedor tienen estado propio.
5. Abre el especialista, conversa y consulta archivos/actividad. Los entregables aparecen solo cuando se guardan de verdad.

Sin Docker o sin key, el chat de IA está deshabilitado. **Preparar un agente UX** abre un formulario guiado explícitamente identificado como «sin IA»; permite poner nombre y materializar la plantilla. No se simulan mensajes de Hermes ni contenedores activos.

El modelo inicial es `gpt-6.1-sol` y el esfuerzo `xhigh`. Ambos se pueden editar para agentes nuevos en Configuración y para un agente existente desde el compositor. Los cambios por agente se envían en el siguiente turno mediante `provider: openai-api` y `model_options.reasoning_effort`. No se usa la suscripción ni se importan credenciales de Codex.

## Ejecutar con Docker Compose

Con Docker Desktop activo:

```powershell
.\scripts\start-docker.ps1
```

El script fija `HAPIC_HOST_DATA_DIR` a la ruta absoluta de `.hapic` y ejecuta `docker compose up --build -d`. En Linux, exporta esa variable con una ruta absoluta y usa `docker compose up --build -d`. Solo se publica `127.0.0.1:8000`.

Compose ejecuta el control de gestión. Los contenedores de agentes se crean dinámicamente a partir de `nousresearch/hermes-agent:stable`, en la red `hapic-net`; cada uno recibe exclusivamente sus dos volúmenes persistentes y tokens propios. `HERMES_IMAGE` permite fijar una versión o digest tras validar esa imagen. El primer arranque puede tardar por la descarga de la imagen oficial.

El control de gestión tiene acceso al socket Docker para provisionar contenedores: es un componente de confianza con privilegios sobre el motor. Los agentes nunca reciben ese socket. No expongas este MVP local como SaaS público; requiere autenticación multiusuario y endurecimiento adicional antes de ese paso.

## Persistencia y límites de acceso

```text
.hapic/
  platform.db                          # organizaciones, pertenencia, proyectos, agentes, mensajes, actividad
  secrets/                             # clave de cifrado y credenciales/tokens cifrados; fuera del explorador
  organizations/<org-id>/
    organization.json
    projects/<project-id>/
      project.json
      workspace/
      agents/<agent-id>/
        hermes/                        # HERMES_HOME → /opt/data
          SOUL.md
          config.yaml
          memories/MEMORY.md
          memories/USER.md
          skills/
          state.db                     # aparece cuando lo crea el runtime Hermes
        workspace/                     # → /workspace; herramientas MCP limitadas a este espacio
```

La memoria resumida de Hermes y su historial completo no son lo mismo: `memories/` contiene contexto persistente y `state.db` conserva sesiones/historial de Hermes. La plataforma conserva además los mensajes visibles en su SQLite. No copia memorias, sesiones ni credenciales de agentes anteriores al aplicar una plantilla.

La pertenencia de organización se valida en servidor. Cada token MCP identifica un agente y su proyecto, sin aceptar un proyecto arbitrario del modelo. Las herramientas UX solo listan/leen/escriben documentos del workspace de ese agente; rutas absolutas, traversal, enlaces, secretos, configuración sensible y archivos binarios se rechazan. Las carpetas organizan datos; la autorización del servidor, las herramientas permitidas y los montajes del contenedor controlan el acceso.

La key se cifra con Fernet y una clave maestra local. Nunca se devuelve por API, ni se guarda en localStorage, ni se incluye en errores de validación. El maestro y los datos están ignorados por Git. Un administrador del equipo o del motor Docker puede acceder a secretos del proceso/contenedor; el cifrado local no sustituye un gestor de secretos multiusuario. Al rotar la key, reinicia los agentes; eliminarla del servidor no borra el entorno de contenedores ya creados.

Los datos y el estado se guardan localmente. Las consultas, memoria/contexto necesario y resultados de herramientas usados en cada turno se envían a OpenAI para inferencia. No se promete que todos los datos permanezcan en el equipo.

## Integración oficial

- [Hermes: integración programática](https://hermes-agent.nousresearch.com/docs/developer-guide/programmatic-integration): API HTTP, SSE y núcleo `AIAgent` real.
- [Hermes: API Server](https://hermes-agent.nousresearch.com/docs/user-guide/features/api-server): `/v1/responses`, conversaciones persistentes, idempotencia y selección de modelo por petición.
- [Hermes: proveedores](https://hermes-agent.nousresearch.com/docs/integrations/providers): `openai-api` con API key, separado de `openai-codex` OAuth.
- [Hermes: perfiles](https://hermes-agent.nousresearch.com/docs/user-guide/profiles): un `HERMES_HOME` por agente, independiente del directorio de trabajo.
- [Hermes: Docker](https://hermes-agent.nousresearch.com/docs/user-guide/docker): imagen oficial, `/opt/data` y supervisión del gateway.
- [OpenAI: GPT-6.1 Sol](https://developers.openai.com/api/docs/models/gpt-6.1-sol): `xhigh` admitido; function calling exige Responses API.

La configuración fija explícitamente `model.api_mode: codex_responses`, el nombre del transporte Responses de Hermes, hacia `https://api.openai.com/v1`. La UI no infiere compatibilidad por el nombre del endpoint público de Hermes. El cliente verifica `/health/detailed` autenticado y `status: ok` antes de marcar el runtime disponible. El acceso real al modelo se verifica en el primer turno, no mediante una simple comprobación de Docker.

## Pruebas y alcance verificado

```powershell
.\.venv\Scripts\python.exe -m pytest -q --basetemp .hapic/test-local
Set-Location frontend
pnpm build
```

En un sandbox Windows que bloquee sockets, las pruebas ASGI/TestClient y el servidor pueden requerir ejecución autorizada fuera de ese aislamiento. No se cambia el firewall ni las protecciones globales.

Las pruebas cubren persistencia al reabrir almacenamiento, valores por defecto, CSRF/origen, pertenencia, secretos cifrados y errores redactados, rutas, alcance MCP, protocolo MCP real, plantillas limpias, cambios de modelo, idempotencia de chat y contrato `/v1/responses`. Los dobles de Docker/Hermes solo existen en `tests/`; no son un modo de ejecución de producción. La prueba de enlace simbólico se omite cuando Windows no concede el permiso necesario.

**Verificación local de despliegue:** después de instalar Docker Desktop y WSL2 y reiniciar Windows, el motor Linux ejecutó un contenedor `hello-world` real. La imagen de Hapic se construyó y Compose la inició con estado `healthy` en `127.0.0.1:8000`, conservando el almacenamiento existente. Se comprobó un montaje real de Windows desde el provisionador y las APIs autenticadas de dos contenedores oficiales Hermes (Hapic y UX). Sus perfiles tienen `state.db` y directorios de memoria persistentes. La plataforma ya registra respuestas reales de Hermes usando la credencial configurada por el usuario, con `gpt-6.1-sol` y `xhigh`.

La creación conversacional se comprueba con dobles en los tests. No se ejecutó una prueba adicional de QA con dos llamadas facturables a OpenAI. Los diagnósticos locales se guardan en `artifacts/`, que está excluido de Git.

Fuera de este MVP: login remoto multiusuario, roles empresariales completos, comunicación entre proyectos, WhatsApp, llamadas, Kubernetes y hosting externo.
