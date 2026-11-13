(() => {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const steps = ['resumen', 'conversacion', 'estructura', 'plantillas', 'archivos', 'herramientas'];
  const labels = ['Proyectos', 'Conversación', 'Estructura', 'Especialistas', 'Archivos', 'Herramientas'];
  const content = {
    resumen: ['Tu espacio de trabajo', 'Estudio Aurora / Resumen', [['Lanzamiento de marca', 'Sofía · Community Manager / Lucía · UX', 'Un proyecto reúne el contexto, los especialistas y sus entregables.'], ['Sitio web corporativo', 'Arquitectura / Código', 'Cada equipo conserva su propio espacio de trabajo.'], ['Español · English', 'El idioma de tu equipo', 'El dashboard guarda tu elección de idioma para la interfaz y las nuevas respuestas. El historial y los archivos existentes conservan su contenido original.']]],
    estructura: ['Todo tiene su lugar', 'Estudio Aurora / Lanzamiento de marca', [['▾ Sofía · Community Manager', 'hermes/ · Perfil y memoria', 'hermes/\n  memories/MEMORY.md\nworkspace/\n  calendario/editorial.md'], ['▾ Lucía · UX', 'Perfil y archivos independientes', 'hermes/\n  memories/MEMORY.md\nworkspace/\n  brief.md']]],
    plantillas: ['Prepara tu equipo', 'Cinco perfiles con método y entregables', [['UX · Diseño gráfico', 'Briefs, flujos y propuestas visuales', 'Ejemplo UX: brief → flujos → wireframes → revisión de accesibilidad.'], ['Arquitecto · Coder', 'Del plan compartido a la implementación', 'El arquitecto publica el plan y el coder consulta su versión antes de escribir.'], ['Community Manager', 'Estrategia y contenido', 'Prepara calendarios, copys y guiones con contexto y archivos propios.']]],
    archivos: ['Resultados que permanecen', 'Sofía / workspace / calendario', [['editorial.md', 'Abrir un entregable de ejemplo ↗', '# Calendario editorial\nLunes · Presentación de marca\nMiércoles · Detrás de cámaras\nViernes · Preguntas de la comunidad'], ['brief.md', 'Contexto del proyecto ↗', '# Brief de ejemplo\nObjetivo: presentar la nueva marca.\nAudiencia: comunidad del estudio.\nTono: cercano y claro.']]],
    herramientas: ['Conecta tu contexto', 'Herramientas del proyecto', [['YouTube · Solo lectura', 'Vídeos, comentarios y métricas', 'Se configura OAuth en el servidor y el usuario autoriza su canal. Después puede asignarlo a los agentes del proyecto.'], ['HeyGen · ElevenLabs', 'Integraciones previstas', 'Estas conexiones todavía no están disponibles.']]]
  };
  const english = {
    resumen: ['Your workspace', 'Aurora Studio / Overview', [['Brand launch', 'Sofía · Community Manager / Lucía · UX', 'A project brings together context, specialists and their deliverables.'], ['Corporate website', 'Architecture / Code', 'Each team keeps its own workspace.'], ['Español · English', 'Your team’s language', 'The dashboard saves your language choice for its interface and new responses. Existing history and files keep their original content.']]],
    estructura: ['Everything has a place', 'Aurora Studio / Brand launch', [['▾ Sofía · Community Manager', 'hermes/ · Profile and memory', 'hermes/\n  memories/MEMORY.md\nworkspace/\n  calendario/editorial.md'], ['▾ Lucía · UX', 'Independent profile and files', 'hermes/\n  memories/MEMORY.md\nworkspace/\n  brief.md']]],
    plantillas: ['Prepare your team', 'Five profiles with methods and deliverables', [['UX · Graphic design', 'Briefs, flows and visual proposals', 'UX example: brief → flows → wireframes → accessibility review.'], ['Architect · Coder', 'From a shared plan to implementation', 'The architect publishes the plan and the coder checks its version before writing.'], ['Community Manager', 'Strategy and content', 'Prepare calendars, copy and scripts with dedicated context and files.']]],
    archivos: ['Results that last', 'Sofía / workspace / calendario', [['editorial.md', 'Open a sample deliverable ↗', '# Editorial calendar\nMonday · Brand introduction\nWednesday · Behind the scenes\nFriday · Community questions'], ['brief.md', 'Project context ↗', '# Sample brief\nGoal: introduce the new brand.\nAudience: the studio community.\nTone: friendly and clear.']]],
    herramientas: ['Connect your context', 'Project tools', [['YouTube · Read-only', 'Videos, comments and metrics', 'OAuth is configured on the server and the user authorizes their channel. They can then assign it to project agents.'], ['HeyGen · ElevenLabs', 'Planned integrations', 'These connections are not available yet.']]]
  };
  const isEnglish = () => document.documentElement.lang === 'en';
  let active = 'resumen';
  let playing = !reduced.matches;
  let timer;
  let chatStage = reduced.matches ? 4 : 0;
  const demo = document.createElement('div');
  demo.className = 'demo';
  demo.innerHTML = '<div class="demo-top"><strong>H / Hapic</strong><small>DEMO ILUSTRATIVA · SIN SERVICIOS</small></div><div class="demo-layout"><nav class="demo-sidebar" aria-label="Plataforma de demostración"></nav><div class="demo-content"></div></div><div class="demo-progress" aria-hidden="true"><span></span></div>';
  const controls = document.createElement('div');
  controls.className = 'demo-controls';
  controls.innerHTML = '<span>Explora las tarjetas y las secciones</span><button type="button" class="demo-control"></button>';
  const pause = controls.querySelector('button');
  function updatePause() { pause.textContent = isEnglish() ? (playing ? 'Pause tour' : 'Play tour') : (playing ? 'Pausar recorrido' : 'Reproducir recorrido'); }
  const conversation = {
    es: {
      title: 'Sofía · Community Manager', context: 'Lanzamiento de marca · Conversación de ejemplo',
      user: 'Tú', prompt: 'Prepara tres ideas de contenido para el lanzamiento de nuestra marca.',
      reply: 'Usaré el brief del proyecto para proponer un calendario con objetivo, formato y mensaje para cada publicación.',
      activity: 'Consultando workspace/brief.md…', working: 'Preparando el calendario editorial…',
      result: 'Aquí tienes la propuesta: presentación de marca, detrás de cámaras y preguntas de la comunidad. Dejé el calendario listo para que lo revises.',
      file: '# Calendario editorial\nLunes · Presentación de marca\nMiércoles · Detrás de cámaras\nViernes · Preguntas de la comunidad',
      ready: 'Propuesta lista para revisión', replay: 'Repetir conversación', open: 'Abrir entregable de ejemplo',
      note: 'Secuencia ilustrativa. No se ejecutan agentes ni se crean archivos reales.'
    },
    en: {
      title: 'Sofía · Community Manager', context: 'Brand launch · Sample conversation',
      user: 'You', prompt: 'Prepare three content ideas for our brand launch.',
      reply: 'I’ll use the project brief to propose a calendar with a goal, format and message for each post.',
      activity: 'Reading workspace/brief.md…', working: 'Preparing the editorial calendar…',
      result: 'Here’s the proposal: a brand introduction, behind the scenes and community questions. The calendar is ready for your review.',
      file: '# Editorial calendar\nMonday · Brand introduction\nWednesday · Behind the scenes\nFriday · Community questions',
      ready: 'Proposal ready for review', replay: 'Replay conversation', open: 'Open sample deliverable',
      note: 'Illustrative sequence. No agents run and no real files are created.'
    }
  };
  function renderConversation() {
    const body = demo.querySelector('.demo-content');
    const copy = conversation[isEnglish() ? 'en' : 'es'];
    body.replaceChildren();
    const heading = document.createElement('h3'); heading.textContent = copy.title;
    const context = document.createElement('p'); context.textContent = copy.context;
    const transcript = document.createElement('div'); transcript.className = 'demo-transcript';
    function message(who, text, user = false) {
      const bubble = document.createElement('div'); bubble.className = 'demo-message' + (user ? ' demo-message-user' : '');
      const author = document.createElement('strong'); author.textContent = who;
      const paragraph = document.createElement('p'); paragraph.textContent = text;
      bubble.append(author, paragraph); transcript.append(bubble);
    }
    message(copy.user, copy.prompt, true);
    if (chatStage >= 1) message('Sofía', copy.reply);
    const activity = document.createElement('p'); activity.className = 'demo-activity';
    activity.setAttribute('role', 'status');
    activity.textContent = chatStage < 2 ? copy.activity : chatStage < 4 ? copy.working : copy.ready;
    if (chatStage >= 3) message('Sofía', copy.result);
    body.append(heading, context, transcript, activity);
    if (chatStage >= 4) {
      const file = document.createElement('button'); file.type = 'button'; file.className = 'demo-card demo-deliverable';
      file.textContent = '↗ calendario/editorial.md';
      file.setAttribute('aria-label', copy.open + ': calendario/editorial.md'); file.setAttribute('aria-expanded', 'false');
      const preview = document.createElement('div'); preview.className = 'demo-detail'; preview.textContent = copy.file; preview.hidden = true;
      file.addEventListener('click', () => { playing = false; updatePause(); schedule(); preview.hidden = !preview.hidden; file.setAttribute('aria-expanded', String(!preview.hidden)); });
      body.append(file, preview);
    }
    const replay = document.createElement('button'); replay.type = 'button'; replay.className = 'demo-replay'; replay.textContent = copy.replay;
    replay.addEventListener('click', () => { chatStage = reduced.matches ? 4 : 0; playing = !reduced.matches; renderConversation(); updatePause(); schedule(); });
    const note = document.createElement('p'); note.className = 'demo-chat-note'; note.textContent = copy.note;
    body.append(replay, note);
  }
  function schedule() {
    clearTimeout(timer);
    if (!playing || document.hidden) return;
    timer = setTimeout(() => {
      if (active === 'conversacion' && chatStage < 4) {
        chatStage += 1;
        renderConversation();
        schedule();
      } else {
        document.querySelector('[data-scene="' + steps[(steps.indexOf(active) + 1) % steps.length] + '"]').click();
      }
    }, active === 'conversacion' && chatStage < 4 ? 2200 : 6500);
  }
  function select(key) {
    if (key === 'conversacion' && active !== key) chatStage = reduced.matches ? 4 : 0;
    active = key;
    const figure = document.querySelector('#scene-' + key + ' .screen-area');
    figure.prepend(demo);
    demo.after(controls);
    const body = demo.querySelector('.demo-content');
    body.replaceChildren();
    if (key === 'conversacion') {
      renderConversation();
    } else {
    const [title, subtitle, cards] = (isEnglish() ? english : content)[key];
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
    const tag = document.createElement('span'); tag.className = 'demo-tag'; tag.textContent = isEnglish() ? 'Sample data' : 'Datos de ejemplo'; body.append(tag);
    }
    demo.querySelectorAll('[data-demo-step]').forEach((button, index) => {
      button.setAttribute('aria-pressed', String(button.dataset.demoStep === key));
      button.textContent = isEnglish() ? ['Projects', 'Conversation', 'Structure', 'Specialists', 'Files', 'Tools'][index] : labels[index];
    });
    demo.querySelector('.demo-top small').textContent = isEnglish() ? 'ILLUSTRATIVE DEMO · NO SERVICES' : 'DEMO ILUSTRATIVA · SIN SERVICIOS';
    demo.querySelector('nav').setAttribute('aria-label', isEnglish() ? 'Platform demo' : 'Plataforma de demostración');
    controls.querySelector('span').textContent = isEnglish() ? 'Explore the cards and sections' : 'Explora las tarjetas y las secciones';
    updatePause();
    demo.style.setProperty('--progress', ((steps.indexOf(key) + 1) * 100 / steps.length) + '%');
    schedule();
  }
  steps.forEach((key, index) => {
    const button = document.createElement('button'); button.type = 'button'; button.dataset.demoStep = key; button.textContent = labels[index];
    button.addEventListener('click', () => { playing = false; updatePause(); document.querySelector('[data-scene="' + key + '"]').click(); });
    demo.querySelector('nav').append(button);
  });
  pause.addEventListener('click', () => { playing = !playing; updatePause(); schedule(); });
  document.addEventListener('visibilitychange', schedule);
  reduced.addEventListener('change', () => { if (reduced.matches) { playing = false; chatStage = 4; if (active === 'conversacion') renderConversation(); updatePause(); schedule(); } });
  document.querySelectorAll('[data-scene]').forEach(button => button.addEventListener('click', event => {
    if (event.isTrusted) { playing = false; updatePause(); schedule(); }
  }));
  document.addEventListener('hapic-language-change', () => select(active));
  window.hapicDemo = { select };
  updatePause(); select(active);
})();
