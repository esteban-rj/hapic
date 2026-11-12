---
name: hapic-feature-docs
description: Actualiza el README y mantiene sincronizadas la presentación y la demo de GitHub Pages de Hapic en español e inglés al incorporar nuevas características visibles para el usuario. No se activa para refactors, parches o mantenimiento sin nuevas capacidades.
---

# Documentar nuevas características de Hapic

Actualiza la documentación en el mismo cambio que incorpora una capacidad nueva, antes de darla por terminada. Para cambios mixtos, documenta las capacidades nuevas. Un refactor o parche por sí solo no requiere este flujo.

- Comprueba el comportamiento implementado, sus requisitos y límites en el código. Distingue lo disponible de lo previsto.
- Actualiza las secciones pertinentes de `README.md`: beneficio para el usuario, forma de uso y requisitos si cambiaron. Conserva los detalles operativos relevantes.
- Actualiza `docs/presentacion.html` y el recorrido de `docs/demo.js` para representar la capacidad con interacción o animación ilustrativa. Mantén alineados texto, navegación y estados; identifica datos de ejemplo e integraciones previstas. Las capturas son apoyo, no la experiencia principal.
- Mantén equivalencia funcional y de contenido entre español e inglés en el mismo cambio: beneficios, requisitos, límites y estados disponibles o previstos deben coincidir en presentación y demo. Una característica no está documentada por completo si falta en alguno de los dos idiomas.
- En `docs/presentacion.html`, conserva el texto español y actualiza su traducción `data-en`; en `docs/language.js`, cubre también los atributos accesibles, metadatos y mensajes de estado. Evita anidar elementos traducibles que puedan reemplazarse entre sí al cambiar de idioma.
- En `docs/demo.js`, actualiza las mismas secciones y tarjetas en `content` (español) y `english` (inglés), incluidos detalles de entregables, etiquetas, navegación y controles. Revisa también las etiquetas de tema de `docs/theme.js`. Conserva los identificadores de secciones y las rutas reales de archivos entre idiomas.
- Conserva el selector con bandera, `html[lang]`, la preferencia `hapic-language` y su persistencia al recargar. Cambiar idioma debe actualizar la sección activa sin reiniciar el recorrido ni perder su estado de pausa.
- Conserva ambos temas (`docs/theme.js`, `docs/demo.css`), navegación por teclado, pausa, movimiento reducido y diseño móvil. La demo estática no debe requerir backend, credenciales ni llamadas de pago.
- Enlaza guías específicas afectadas desde el README. Actualiza capturas cuando aporten información y puedas obtenerlas de una instalación de demostración sin secretos.
- Sirve `docs/` con un servidor estático y verifica el recorrido modificado en escritorio y móvil, ambos temas y ambos idiomas, enlaces y consola. Alterna español → inglés → español, abre las tarjetas afectadas y recarga para comprobar la preferencia guardada. Comprueba que no queden textos de interfaz sin traducir, salvo nombres propios, identificadores o rutas reales. Ejecuta comprobaciones relevantes del código modificado e informa si alguna verificación no pudo realizarse.

GitHub Pages sirve `docs/`; `docs/index.html` redirige a `presentacion.html`. Usa rutas relativas para funcionar bajo `/hapic/`. Si cambian los recursos JS/CSS, actualiza su versión en las referencias de `docs/presentacion.html` para evitar mezclar HTML nuevo con scripts anteriores en caché. Cuando la publicación esté autorizada, verifica también ambos idiomas en la URL pública tras finalizar el despliegue. Preparar estos archivos no autoriza hacer push ni desplegar por separado.
