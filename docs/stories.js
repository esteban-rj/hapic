(() => {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const isEnglish = () => document.documentElement.lang === 'en';
  const examples = {
    es: {
      brand: { nodes: [['UX', 'Define la experiencia', 'Brief y recorrido'], ['Diseño gráfico', 'Da forma a la marca', 'Piezas visuales solicitadas'], ['Community Manager', 'Prepara el lanzamiento', 'Calendario y copys']], result: 'Un lanzamiento con brief, piezas y contenido para revisar.' },
      web: { nodes: [['Arquitecto / Planner', 'Publica el plan', 'Tareas, archivos y contratos'], ['Coder', 'Consulta el plan vigente', 'Implementación y pruebas en archivos'], ['Tu revisión', 'Valida el resultado', 'Decisiones y siguiente paso']], result: 'Del plan compartido a una implementación que puedes revisar. El coder no ejecuta pruebas: no tiene terminal.' },
      content: { nodes: [['YouTube · Solo lectura', 'Aporta datos del canal autorizado', 'Vídeos, comentarios y métricas'], ['Community Manager', 'Convierte contexto en propuestas', 'Guiones, calendario y copys'], ['Diseño gráfico', 'Prepara las piezas solicitadas', 'Imágenes guardadas']], result: 'Contenido preparado para tu revisión. YouTube requiere OAuth del servidor y autorización del canal; no publica ni responde comentarios.' }
    },
    en: {
      brand: { nodes: [['UX', 'Define the experience', 'Brief and user journey'], ['Graphic design', 'Shape the brand', 'Requested visuals'], ['Community Manager', 'Prepare the launch', 'Calendar and copy']], result: 'A launch with a brief, visuals and content for review.' },
      web: { nodes: [['Architect / Planner', 'Publish the plan', 'Tasks, files and contracts'], ['Coder', 'Read the current plan', 'Implementation and tests in files'], ['Your review', 'Validate the result', 'Decisions and next step']], result: 'From a shared plan to implementation you can review. The coder cannot run tests: it has no terminal.' },
      content: { nodes: [['YouTube · Read-only', 'Bring authorized channel data', 'Videos, comments and metrics'], ['Community Manager', 'Turn context into proposals', 'Scripts, calendar and copy'], ['Graphic design', 'Prepare requested visuals', 'Saved images']], result: 'Content prepared for your review. YouTube needs server-side OAuth setup and channel authorization; it cannot publish or reply to comments.' }
    }
  };
  const buttons = Array.from(document.querySelectorAll('[data-workflow]'));
  const output = document.getElementById('workflow-example');
  let active = 'brand';
  function render() {
    const example = examples[isEnglish() ? 'en' : 'es'][active];
    const list = document.createElement('ol'); list.className = 'workflow-nodes';
    example.nodes.forEach(([role, action, deliverable], index) => {
      const item = document.createElement('li');
      const number = document.createElement('span'); number.className = 'workflow-number'; number.textContent = String(index + 1).padStart(2, '0');
      const title = document.createElement('h3'); title.textContent = role;
      const description = document.createElement('p'); description.textContent = action;
      const file = document.createElement('small'); file.textContent = deliverable;
      item.append(number, title, description, file); list.append(item);
    });
    const result = document.createElement('p'); result.className = 'workflow-result'; result.textContent = example.result;
    output.replaceChildren(list, result);
    buttons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.workflow === active)));
  }
  buttons.forEach(button => button.addEventListener('click', () => {
    active = button.dataset.workflow;
    window.hapicDemo?.pause();
    render();
  }));

  const toggles = Array.from(document.querySelectorAll('[data-capture-toggle]'));
  function label(button) {
    const playing = button.getAttribute('aria-pressed') === 'true';
    button.textContent = isEnglish() ? (playing ? 'Pause GIF' : 'Play GIF') : (playing ? 'Pausar GIF' : 'Reproducir GIF');
  }
  function stop(button) {
    const image = document.getElementById(button.dataset.captureToggle);
    image.src = image.dataset.poster;
    button.setAttribute('aria-pressed', 'false'); label(button);
  }
  toggles.forEach(button => button.addEventListener('click', () => {
    const playing = button.getAttribute('aria-pressed') === 'true';
    toggles.forEach(stop);
    window.hapicDemo?.pause();
    if (!playing) {
      const image = document.getElementById(button.dataset.captureToggle);
      image.src = image.dataset.gif;
      button.setAttribute('aria-pressed', 'true'); label(button);
    }
  }));
  document.addEventListener('visibilitychange', () => { if (document.hidden) toggles.forEach(stop); });
  window.addEventListener('pagehide', () => toggles.forEach(stop));
  reduced.addEventListener('change', () => { if (reduced.matches) toggles.forEach(stop); });
  document.addEventListener('hapic-language-change', () => { render(); toggles.forEach(label); });
  render(); toggles.forEach(label);
})();
