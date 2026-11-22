(() => {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const steps = ['resumen', 'conversacion', 'plantillas', 'archivos', 'estructura', 'herramientas'];
  const labels = ['Tu flujo', 'Conversación', 'Equipo', 'Resultados', 'Contexto', 'Herramientas'];
  const content = {
    resumen: ['Un proyecto. Tu forma de colaborar.', 'Estudio Aurora / Flujos de ejemplo', [['01 · Define el resultado', 'Lanzar una marca', 'Objetivo → responsabilidades → contexto → entregables. El proyecto reúne al equipo y conserva el trabajo.'], ['02 · Conecta responsabilidades', 'UX → Diseño gráfico → Community Manager', 'Ejemplo de reparto: Lucía prepara el brief, Mateo las piezas visuales solicitadas y Sofía el calendario. Los agentes pueden delegarse tareas dentro del proyecto. El remitente consulta los resultados; no continúa automáticamente.'], ['03 · Revisa y continúa', 'Brief, imágenes y calendario', 'Abre los archivos de cada agente y decide el siguiente paso. Hoy se parte de plantillas; crear agentes desde cero y componer flujos con mayor flexibilidad forma parte de la visión. La interfaz y las nuevas respuestas admiten español e inglés; el historial y los archivos conservan su idioma original.']]],
    estructura: ['Todo tiene su lugar', 'Estudio Aurora / Lanzamiento de marca', [['▾ Sofía · Community Manager', 'hermes/ · Perfil y memoria', 'hermes/\n  memories/MEMORY.md\nworkspace/\n  calendario/editorial.md'], ['▾ Lucía · UX', 'Perfil y archivos independientes', 'hermes/\n  memories/MEMORY.md\nworkspace/\n  brief.md']]],
    plantillas: ['Prepara tu equipo', 'Cinco perfiles con método y entregables', [['UX · Diseño gráfico', 'Briefs, flujos y propuestas visuales', 'Ejemplo UX: brief → flujos → wireframes → revisión de accesibilidad.'], ['Arquitecto · Coder', 'Del plan compartido a la implementación', 'El arquitecto publica el plan y el coder consulta su versión antes de escribir.'], ['Community Manager', 'Estrategia y contenido', 'Prepara calendarios, copys y guiones con contexto y archivos propios.'], ['Modelo automático', 'Un solo ajuste por agente', 'Ejemplos de selección:\nTraducir una frase → GPT-6 Luna\nImplementar un formulario → GPT-6.1 Sol\nRefactorizar una arquitectura → GPT-6 Astra\nEn Hapic, elige Automático en Conversación o úsalo como predeterminado para agentes nuevos. El modo también ajusta el razonamiento y se aplica a las delegaciones. Consulta el modelo usado en Actividad.'], ['Colaboración directa · Datos de ejemplo', 'Lucía · UX → Mateo · Diseño gráfico · Finalizada', 'Tarea: revisar la jerarquía visual.\nContexto: un formulario con dos acciones principales.\nResultado esperado: recomendación priorizada y utilizable.\nRespuesta de Mateo: conserva una acción principal y deja la secundaria como enlace.\nEstado del trabajo: revisión completada; validación con usuarios pendiente.\nConsulta el historial por proyecto, participante o estado. La conversación del destinatario muestra la delegación en cola o en curso y carga el resultado cuando llega. Si el runtime está apagado, la delegación muestra ese motivo. Ejecutar delegaciones requiere una credencial de OpenAI o LiteLLM y el runtime Docker del destinatario, y puede generar consumo de API. El remitente consulta el resultado; no continúa automáticamente. Los workspaces y las memorias siguen siendo privados.']]],
    archivos: ['Resultados que permanecen', 'Sofía · Archivos generados · Accesos directos', [['editorial.md', 'Abrir calendario generado ↗', '# Calendario editorial\nLunes · Presentación de marca\nMiércoles · Detrás de cámaras\nViernes · Preguntas de la comunidad'], ['brief.md', 'Abrir brief generado ↗', '# Brief de ejemplo\nObjetivo: presentar la nueva marca.\nAudiencia: comunidad del estudio.\nTono: cercano y claro.']]],
    herramientas: ['Conecta tu contexto', 'Herramientas del proyecto', [['YouTube · Solo lectura', 'Vídeos, comentarios y métricas', 'Se configura OAuth en el servidor y el usuario autoriza su canal. Después puede asignarlo a los agentes del proyecto.'], ['LiteLLM · Modelo y costes', 'Catálogo de proveedores y Best model', 'Ejemplo de catálogo: un modelo de OpenAI, uno de Anthropic y Best model. El selector muestra los modelos autorizados. Usa Best model por defecto cuando el Auto Router está disponible. En Hapic, abre Configuración → LiteLLM para acceder al panel y consultar costes y tokens. La instalación requiere el gateway y una clave virtual.'], ['HeyGen · ElevenLabs', 'Integraciones previstas', 'Estas conexiones todavía no están disponibles.']]]
  };
  const english = {
    resumen: ['One project. Your way to collaborate.', 'Aurora Studio / Sample workflows', [['01 · Define the result', 'Launch a brand', 'Goal → responsibilities → context → deliverables. The project brings the team together and keeps its work.'], ['02 · Connect responsibilities', 'UX → Graphic design → Community Manager', 'Sample division of work: Lucía prepares the brief, Mateo the requested visuals and Sofía the calendar. Agents can delegate within the project. The sender retrieves results; it does not automatically continue.'], ['03 · Review and continue', 'Brief, images and calendar', 'Open each agent’s files and decide the next step. Today agents start from templates; agents from scratch and more flexible workflow composition are part of the vision. The UI and new responses support Spanish and English; history and existing files keep their original language.']]],
    estructura: ['Everything has a place', 'Aurora Studio / Brand launch', [['▾ Sofía · Community Manager', 'hermes/ · Profile and memory', 'hermes/\n  memories/MEMORY.md\nworkspace/\n  calendario/editorial.md'], ['▾ Lucía · UX', 'Independent profile and files', 'hermes/\n  memories/MEMORY.md\nworkspace/\n  brief.md']]],
    plantillas: ['Prepare your team', 'Five profiles with methods and deliverables', [['UX · Graphic design', 'Briefs, flows and visual proposals', 'UX example: brief → flows → wireframes → accessibility review.'], ['Architect · Coder', 'From a shared plan to implementation', 'The architect publishes the plan and the coder checks its version before writing.'], ['Community Manager', 'Strategy and content', 'Prepare calendars, copy and scripts with dedicated context and files.'], ['Automatic model selection', 'Set it once per agent', 'Sample choices:\nTranslate a sentence → GPT-6 Luna\nImplement a form → GPT-6.1 Sol\nRefactor an architecture → GPT-6 Astra\nIn Hapic, choose Automatic in Conversation or make it the default for new agents. Automatic mode also sets reasoning effort and applies to delegations. Check Activity for the model used.'], ['Direct collaboration · Sample data', 'Lucía · UX → Mateo · Graphic design · Completed', 'Task: review the visual hierarchy.\nContext: a form with two primary actions.\nExpected result: a prioritized, usable recommendation.\nMateo’s response: keep one primary action and make the secondary action a link.\nWork outcome: review completed; user validation pending.\nFilter history by project, participant or status. The recipient’s conversation shows the queued or active delegation and loads the result when it arrives. If the runtime is off, the delegation shows that reason. Execution requires an OpenAI or LiteLLM credential and the recipient’s running Docker runtime, and may incur API usage. The sender retrieves the result; there is no automatic continuation. Workspaces and memories remain private.']]],
    archivos: ['Results that last', 'Sofía · Generated files · Shortcuts', [['editorial.md', 'Open generated calendar ↗', '# Editorial calendar\nMonday · Brand introduction\nWednesday · Behind the scenes\nFriday · Community questions'], ['brief.md', 'Open generated brief ↗', '# Sample brief\nGoal: introduce the new brand.\nAudience: the studio community.\nTone: friendly and clear.']]],
    herramientas: ['Connect your context', 'Project tools', [['YouTube · Read-only', 'Videos, comments and metrics', 'OAuth is configured on the server and the user authorizes their channel. They can then assign it to project agents.'], ['LiteLLM · Models and spend', 'Provider catalog and Best model', 'Sample catalog: an OpenAI model, an Anthropic model, and Best model. The selector lists authorized models. It defaults to Best model when the Auto Router is available. Open Settings → LiteLLM in Hapic to access the dashboard and inspect spend and tokens. Setup requires the gateway and a virtual key.'], ['HeyGen · ElevenLabs', 'Planned integrations', 'These connections are not available yet.']]]
  };
  const isEnglish = () => document.documentElement.lang === 'en';
  let active = 'resumen';
  let playing = !reduced.matches;
  let timer;
  let chatStage = reduced.matches ? 4 : 0;
  let preparationStage = 4;
  let selectedPreparation;
  let preparationOpen = false;
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
  function renderPreparation(body) {
    const en = isEnglish();
    const names = en ? ['Profile and memory', 'Requirements', 'Configuration', 'Network', 'Hermes image', 'Container', 'API available'] : ['Perfil y memoria', 'Requisitos', 'Configuración', 'Red', 'Imagen de Hermes', 'Contenedor', 'API disponible'];
    const logs = en ? ['Profile, initial memory and workspace created.', 'Docker responds and an OpenAI credential is configured.', 'Model, tools and permissions prepared.', 'Docker network available.', 'Downloading the official Hermes image; this may take several minutes.', 'Container created. Waiting for the Hermes API.', 'Hermes responded with status: ok. The agent is available.'] : ['Perfil, memoria inicial y workspace creados.', 'Docker responde y hay una credencial de OpenAI configurada.', 'Modelo, herramientas y permisos preparados.', 'Red Docker disponible.', 'Descargando la imagen oficial de Hermes; puede tardar varios minutos.', 'Contenedor creado. Esperando la API de Hermes.', 'Hermes respondió con status: ok. El agente está disponible.'];
    const section = document.createElement('section'); section.className = 'demo-preparation';
    if (preparationStage >= 7) {
      section.className = 'demo-ready-chat';
      const heading = document.createElement('h4'); heading.textContent = 'Lucía · UX';
      const state = document.createElement('p'); state.setAttribute('role', 'status'); state.textContent = en ? 'Ready to receive messages' : 'Lista para recibir mensajes';
      const message = document.createElement('div'); message.className = 'demo-message'; message.textContent = en ? 'Hi, I’m Lucía. What experience would you like us to design?' : 'Hola, soy Lucía. ¿Qué experiencia quieres que diseñemos?';
      const input = document.createElement('textarea'); input.disabled = true; input.rows = 2; input.placeholder = en ? 'Write to Lucía…' : 'Escribe a Lucía…'; input.setAttribute('aria-label', en ? 'Sample message for Lucía' : 'Mensaje de ejemplo para Lucía');
      const replay = document.createElement('button'); replay.type = 'button'; replay.className = 'demo-replay'; replay.textContent = en ? 'Replay preparation' : 'Repetir preparación';
      replay.addEventListener('click', () => { preparationStage = 4; selectedPreparation = undefined; playing = false; select(active); });
      const note = document.createElement('p'); note.className = 'demo-chat-note'; note.textContent = en ? 'Illustrative chat. The preparation flow disappears when the agent is ready. No messages are sent.' : 'Chat ilustrativo. El flujo de preparación desaparece cuando el agente está listo. No se envían mensajes.';
      section.append(heading, state, message, input, replay, note); body.append(section); return;
    }
    const heading = document.createElement('h4'); heading.textContent = en ? 'Lucía is getting ready' : 'Lucía se está preparando';
    const state = document.createElement('p'); state.setAttribute('role', 'status');
    state.textContent = (preparationStage < 7 ? (en ? 'Preparing' : 'En preparación') : (en ? 'API available' : 'API disponible')) + ' · ' + preparationStage + '/7';
    const graph = document.createElement('ol'); graph.className = 'demo-preparation-graph'; graph.setAttribute('aria-label', en ? 'Sample preparation stages' : 'Etapas de preparación de ejemplo');
    const detail = document.createElement('div'); detail.className = 'demo-detail';
    const selected = selectedPreparation === undefined ? Math.min(preparationStage, 6) : selectedPreparation;
    names.forEach((name, index) => {
      const item = document.createElement('li');
      const button = document.createElement('button'); button.type = 'button';
      button.className = index < preparationStage ? 'complete' : index === preparationStage ? 'running' : 'pending';
      button.textContent = (index < preparationStage ? '✓ ' : index === preparationStage ? '◉ ' : '− ') + name;
      button.setAttribute('aria-pressed', String(index === selected));
      button.addEventListener('click', () => { selectedPreparation = index; playing = false; select(active); });
      item.append(button); graph.append(item);
    });
    detail.textContent = names[selected] + '\n' + (selected <= preparationStage ? logs[selected] : (en ? 'No logs yet. Waiting for previous stages.' : 'Aún no hay registros. Esperando las etapas anteriores.'));
    const pending = document.createElement('p'); pending.textContent = (en ? 'Before becoming available: ' : 'Para estar disponible: ') + (names.slice(preparationStage).join(' → ') || (en ? 'all stages complete.' : 'todas las etapas completas.'));
    const advance = document.createElement('button'); advance.type = 'button'; advance.className = 'demo-replay';
    advance.textContent = preparationStage < 7 ? (en ? 'Advance sample stage' : 'Avanzar etapa de ejemplo') : (en ? 'Replay preparation' : 'Repetir preparación');
    advance.addEventListener('click', () => { preparationStage = preparationStage < 7 ? preparationStage + 1 : 4; selectedPreparation = undefined; playing = false; select(active); });
    const note = document.createElement('p'); note.className = 'demo-chat-note'; note.textContent = en ? 'Illustrative stages and logs. No Docker, credentials or paid calls are used. Real progress refreshes every three seconds.' : 'Etapas y registros ilustrativos. No se usa Docker, credenciales ni llamadas de pago. El progreso real se actualiza cada tres segundos.';
    section.append(heading, state, graph, detail, pending, advance, note); body.append(section);
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
    if (key === 'plantillas') {
      const details = document.createElement('details'); details.className = 'demo-preparation-details'; details.open = preparationOpen;
      const summary = document.createElement('summary'); summary.textContent = isEnglish() ? 'Follow sample agent preparation' : 'Ver preparación de un agente de ejemplo';
      details.append(summary); renderPreparation(details);
      details.addEventListener('toggle', () => { preparationOpen = details.open; });
      body.append(details);
    }
    const tag = document.createElement('span'); tag.className = 'demo-tag'; tag.textContent = isEnglish() ? 'Sample data' : 'Datos de ejemplo'; body.append(tag);
    }
    demo.querySelectorAll('[data-demo-step]').forEach((button, index) => {
      button.setAttribute('aria-pressed', String(button.dataset.demoStep === key));
      button.textContent = isEnglish() ? ['Workflow', 'Conversation', 'Team', 'Results', 'Context', 'Tools'][index] : labels[index];
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
  window.hapicDemo = { select, pause() { playing = false; updatePause(); schedule(); } };
  updatePause(); select(active);
})();
