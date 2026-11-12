---
name: hapic-feature-docs
description: Actualiza el README y GitHub Pages de Hapic al incorporar nuevas características visibles para el usuario. No se activa para refactors, parches o mantenimiento sin nuevas capacidades.
---

# Documentar nuevas características de Hapic

Actualiza la documentación en el mismo cambio que incorpora una capacidad nueva, antes de darla por terminada. Para cambios mixtos, documenta las capacidades nuevas. Un refactor o parche por sí solo no requiere este flujo.

- Comprueba el comportamiento implementado, sus requisitos y límites en el código. Distingue lo disponible de lo previsto.
- Actualiza las secciones pertinentes de `README.md`: beneficio para el usuario, forma de uso y requisitos si cambiaron. Conserva los detalles operativos relevantes.
- Actualiza `docs/presentacion.html` y el recorrido de `docs/demo.js` para representar la capacidad con interacción o animación ilustrativa. Mantén alineados texto, navegación y estados; identifica datos de ejemplo e integraciones previstas. Las capturas son apoyo, no la experiencia principal.
- Conserva ambos temas (`docs/theme.js`, `docs/demo.css`), navegación por teclado, pausa, movimiento reducido y diseño móvil. La demo estática no debe requerir backend, credenciales ni llamadas de pago.
- Enlaza guías específicas afectadas desde el README. Actualiza capturas cuando aporten información y puedas obtenerlas de una instalación de demostración sin secretos.
- Sirve `docs/` con un servidor estático y verifica el recorrido modificado en escritorio y móvil, ambos temas, enlaces y consola. Ejecuta comprobaciones relevantes del código modificado e informa si alguna verificación no pudo realizarse.

GitHub Pages sirve `docs/`; `docs/index.html` redirige a `presentacion.html`. Usa rutas relativas para funcionar bajo `/hapic/`. Preparar estos archivos no autoriza hacer push ni desplegar por separado.
