(() => {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const steps = ['resumen', 'estructura', 'plantillas', 'archivos', 'herramientas'];
  const labels = ['Proyectos', 'Estructura', 'Especialistas', 'Archivos', 'Herramientas'];
  const content = {
    resumen: ['Tu espacio de trabajo', 'Estudio Aurora / Resumen', [['Lanzamiento de marca', 'Sofía · Community Manager / Lucía · UX', 'Un proyecto reúne el contexto, los especialistas y sus entregables.'], ['Sitio web corporativo', 'Arquitectura / Código', 'Cada equipo conserva su propio espacio de trabajo.']]],
    estructura: ['Todo tiene su lugar', 'Estudio Aurora / Lanzamiento de marca', [['▾ Sofía · Community Manager', 'hermes/ · Perfil y memoria', 'hermes/\n  memories/MEMORY.md\nworkspace/\n  calendario/editorial.md'], ['▾ Lucía · UX', 'Perfil y archivos independientes', 'hermes/\n  memories/MEMORY.md\nworkspace/\n  brief.md']]],
    plantillas: ['Prepara tu equipo', 'Cinco perfiles con método y entregables', [['UX · Diseño gráfico', 'Briefs, flujos y propuestas visuales', 'Ejemplo UX: brief → flujos → wireframes → revisión de accesibilidad.'], ['Arquitecto · Coder', 'Del plan compartido a la implementación', 'El arquitecto publica el plan y el coder consulta su versión antes de escribir.'], ['Community Manager', 'Estrategia y contenido', 'Prepara calendarios, copys y guiones con contexto y archivos propios.']]],
    archivos: ['Resultados que permanecen', 'Sofía / workspace / calendario', [['editorial.md', 'Abrir un entregable de ejemplo ↗', '# Calendario editorial\nLunes · Presentación de marca\nMiércoles · Detrás de cámaras\nViernes · Preguntas de la comunidad'], ['brief.md', 'Contexto del proyecto ↗', '# Brief de ejemplo\nObjetivo: presentar la nueva marca.\nAudiencia: comunidad del estudio.\nTono: cercano y claro.']]],
    herramientas: ['Conecta tu contexto', 'Herramientas del proyecto', [['YouTube · Solo lectura', 'Vídeos, comentarios y métricas', 'Se configura OAuth en el servidor y el usuario autoriza su canal. Después puede asignarlo a los agentes del proyecto.'], ['HeyGen · ElevenLabs', 'Integraciones previstas', 'Estas conexiones todavía no están disponibles.']]]
  };
  let active = 'resumen';
  let playing = !reduced.matches;
  let timer;
  const demo = document.createElement('div');
  demo.className = 'demo';
  demo.innerHTML = '<div class="demo-top"><strong>H / Hapic</strong><small>DEMO ILUSTRATIVA · SIN SERVICIOS</small></div><div class="demo-layout"><nav class="demo-sidebar" aria-label="Plataforma de demostración"></nav><div class="demo-content"></div></div><div class="demo-progress" aria-hidden="true"><span></span></div>';
  const controls = document.createElement('div');
  controls.className = 'demo-controls';
  controls.innerHTML = '<span>Explora las tarjetas y las secciones</span><button type="button" class="demo-control"></button>';
  const pause = controls.querySelector('button');
  function updatePause() { pause.textContent = playing ? 'Pausar recorrido' : 'Reproducir recorrido'; }
  function schedule() {
    clearTimeout(timer);
    if (playing && !document.hidden) timer = setTimeout(() => {
      document.querySelector('[data-scene="' + steps[(steps.indexOf(active) + 1) % steps.length] + '"]').click();
    }, 6500);
  }
  function select(key) {
    active = key;
    const figure = document.querySelector('#scene-' + key + ' .screen-area');
    figure.prepend(demo);
    demo.after(controls);
    const body = demo.querySelector('.demo-content');
    body.replaceChildren();
    const [title, subtitle, cards] = content[key];
    const heading = document.createElement('h3'); heading.textContent = title;
    const description = document.createElement('p'); description.textContent = subtitle;
    body.append(heading, description);
    cards.forEach(([name, summary, detail]) => {
      const card = document.createElement('button'); card.type = 'button'; card.className = 'demo-card';
      card.textContent = name;
      const small = document.createElement('small'); small.textContent = summary; card.append(small);
      card.setAttribute('aria-expanded', 'false');
      const panel = document.createElement('div'); panel.className = 'demo-detail'; panel.textContent = detail; panel.hidden = true;
      card.addEventListener('click', () => { playing = false; updatePause(); schedule(); panel.hidden = !panel.hidden; card.setAttribute('aria-expanded', String(!panel.hidden)); });
      body.append(card, panel);
    });
    const tag = document.createElement('span'); tag.className = 'demo-tag'; tag.textContent = 'Datos de ejemplo'; body.append(tag);
    demo.querySelectorAll('[data-demo-step]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.demoStep === key)));
    demo.style.setProperty('--progress', ((steps.indexOf(key) + 1) * 20) + '%');
    schedule();
  }
  steps.forEach((key, index) => {
    const button = document.createElement('button'); button.type = 'button'; button.dataset.demoStep = key; button.textContent = labels[index];
    button.addEventListener('click', () => { playing = false; updatePause(); document.querySelector('[data-scene="' + key + '"]').click(); });
    demo.querySelector('nav').append(button);
  });
  // Keep original screenshots available through the full-image dialog.
  document.querySelectorAll('.screen-area > .screen-frame, .screen-area > .structure').forEach(element => { element.hidden = true; });
  document.querySelectorAll('.screen-note').forEach(note => { note.textContent = 'Demostración ilustrativa. Explora la plataforma o consulta la captura real.'; });
  pause.addEventListener('click', () => { playing = !playing; updatePause(); schedule(); });
  document.addEventListener('visibilitychange', schedule);
  reduced.addEventListener('change', () => { if (reduced.matches) { playing = false; updatePause(); schedule(); } });
  document.querySelectorAll('[data-scene]').forEach(button => button.addEventListener('click', event => {
    if (event.isTrusted) { playing = false; updatePause(); schedule(); }
  }));
  window.hapicDemo = { select };
  updatePause(); select(active);
})();
