# Changelog

Este archivo registra los cambios del proyecto. Las versiones siguen el esquema `MAJOR.MINOR.PATCH`.

## Sin publicar — 2026-11-05

### Añadido

- Selector de modelos en Configuración y en cada conversación, con nombres legibles y conservación de modelos personalizados ya guardados.
- Templates de diseñador gráfico, arquitecto/planner y coder, además del especialista UX existente.
- Perfil Community Manager para Instagram y YouTube, creable por interfaz y MCP, con estrategia, calendario, copys, guiones, respuestas propuestas y métricas aportadas.
- Propuesta documentada de conectores sociales mediante OAuth, permisos por cuenta/proyecto, tokens cifrados y cola de publicaciones; no hay conexiones sociales activas.
- Catálogo con creación desde la interfaz, selección de proyecto y recomendaciones de modelo.
- Herramientas de Hapic para consultar templates, listar agentes y crear especialistas.
- Vinculación de coder a arquitecto del mismo proyecto; publicación y lectura del plan compartido con revisión SHA-256.
- Escritura del coder condicionada a haber leído el plan vigente; extensiones de código y pruebas.
- Generación mediante OpenAI Images, PNG persistente, adjunto de chat, vista previa y descarga autenticada.
- Migración aditiva de `planner_id` y tabla de imágenes, conservando los datos existentes.

### Corregido

- El chat muestra imágenes adjuntas y referencias Markdown a imágenes locales del workspace.
- Se guarda el archivo antes de anunciar éxito; el adjunto persiste aunque falle después Hermes.
- El explorador reconoce PNG, JPEG, WebP y GIF válidos, además de documentos de texto.

### Verificación

- Pruebas de catálogo, permisos, planes vigentes, contrato Images API, persistencia, descarga y fallos posteriores con dobles locales. Sin llamadas facturables adicionales.
- Resultado automatizado: 17 pruebas aprobadas, 1 omitida por permisos de enlaces simbólicos en Windows; incluye creación idempotente de Community Manager mediante MCP, persistencia de borradores y denegación de herramientas ajenas al perfil.
- Build TypeScript/Vite correcto con el catálogo de cinco especialistas, incluido Community Manager.
- Verificación en navegador del catálogo, creación de coder vinculado y carga de imágenes en chat y Archivos con una imagen local de prueba.
- Actualización de Compose y de los dos runtimes existentes, con readiness comprobado y conservación de organizaciones, proyectos, agentes y mensajes.

## [0.1.0] - 2026-11-02

### Añadido

- Dashboard local en español con navegación por organizaciones, proyectos, agentes, plantillas y configuración.
- Alta de organizaciones y proyectos con metadatos SQLite y carpetas persistentes.
- Perfil Hapic propio por proyecto y plantilla UX versionada con instrucciones, método de trabajo y entregables.
- Creación de especialistas UX mediante herramientas MCP limitadas al proyecto y flujo guiado explícito cuando no hay IA disponible.
- Conversaciones y actividad persistentes, explorador del árbol real y vista previa de documentos de texto.
- Modelo `gpt-6.1-sol` y razonamiento `xhigh` por defecto, configurables globalmente y por agente.
- Integración con Hermes mediante `/v1/responses`, proveedor `openai-api` y transporte `codex_responses`.
- Provisionador Docker con un contenedor por agente, perfiles y workspaces separados, comprobación autenticada de readiness y límites de recursos.
- Imagen Docker del control de gestión, configuración Compose y scripts de arranque para Windows.
- Cinco bocetos de referencia conservados en `docs/mockups/`.
- Documentación de instalación, arquitectura, API y operación local.

### Seguridad

- Formulario dedicado para la API key de OpenAI, cifrado local con Fernet y respuestas sin valores de credenciales.
- Sesión local con cookie HttpOnly, control de origen, CSRF y validación de pertenencia de organización.
- Tokens MCP independientes por agente y autorización de herramientas en servidor.
- Validación de rutas, rechazo de enlaces y exclusión de secretos, logs y configuración sensible del explorador.
- Plantillas limpias: no se copian memorias privadas, sesiones ni credenciales de otros agentes.
- Datos operativos, claves, archivos de entorno y diagnósticos excluidos de Git.

### Verificado

- Build TypeScript/Vite y pruebas automatizadas de API, persistencia, secretos, alcance MCP y contratos de Docker/Hermes.
- Recorrido de onboarding, archivos y configuración en navegador, incluida una vista móvil sin desbordamiento horizontal.
- Ejecución real de `hello-world`, build y arranque de Hapic en Compose, montaje persistente de Windows y readiness de contenedores oficiales Hermes.
- Respuestas reales de Hermes registradas durante el uso local con la credencial configurada en servidor.

### Limitaciones

- Uso local con un operador; sin autenticación remota multiusuario ni roles empresariales completos.
- El historial de la interfaz y el historial interno de Hermes se almacenan por separado.
- Los agentes se administran dinámicamente y no forman parte del ciclo de vida de los servicios Compose.
- La comprobación adicional de creación conversacional con dos llamadas facturables en QA no se ejecutó.
- Una prueba de enlaces simbólicos puede omitirse si Windows no permite crearlos.
- Sin WhatsApp, llamadas, comunicación entre proyectos, Kubernetes ni publicación en hosting externo.
