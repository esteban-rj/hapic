# Changelog

Este archivo registra los cambios del proyecto. Las versiones siguen el esquema `MAJOR.MINOR.PATCH`.

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
