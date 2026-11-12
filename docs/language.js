(() => {
  const elements = Array.from(document.querySelectorAll('[data-en]'));
  const spanish = new Map(elements.map(element => [element, element.innerHTML]));
  const button = document.getElementById('language-toggle');
  const attributes = [
    [document.querySelector('.brand'), 'aria-label', 'Hapic, inicio', 'Hapic, home'],
    [document.querySelector('.tour-nav'), 'aria-label', 'Recorrido por Hapic', 'Hapic tour'],
    [document.querySelector('meta[name="description"]'), 'content', document.querySelector('meta[name="description"]').content, 'Discover Hapic: projects with context, AI specialists, persistent memory and files, and tools for your team.']
  ];
  function apply(language) {
    document.documentElement.lang = language;
    elements.forEach(element => { element.innerHTML = language === 'en' ? element.dataset.en : spanish.get(element); });
    attributes.forEach(([element, name, es, en]) => element.setAttribute(name, language === 'en' ? en : es));
    document.title = language === 'en' ? 'Hapic · Your idea already has a team' : 'Hapic · Tu idea ya tiene equipo';
    button.textContent = language === 'en' ? '🇪🇸 ES' : '🇬🇧 EN';
    button.setAttribute('aria-label', language === 'en' ? 'Cambiar a español' : 'Switch to English');
    button.lang = language === 'en' ? 'es' : 'en';
    const current = document.querySelector('[data-scene][aria-pressed="true"] strong');
    document.getElementById('tour-status').textContent = (language === 'en' ? 'Showing ' : 'Mostrando ') + current.textContent + '.';
    document.dispatchEvent(new Event('hapic-language-change'));
  }
  let language;
  try { language = localStorage.getItem('hapic-language'); } catch {}
  apply(language === 'en' ? 'en' : 'es');
  button.addEventListener('click', () => {
    const next = document.documentElement.lang === 'en' ? 'es' : 'en';
    try { localStorage.setItem('hapic-language', next); } catch {}
    apply(next);
  });
})();
