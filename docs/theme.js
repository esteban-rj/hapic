(() => {
  const media = matchMedia('(prefers-color-scheme: dark)');
  function saved() { try { return localStorage.getItem('hapic-theme'); } catch { return null; } }
  function apply(theme) {
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#141b17' : '#f5f5ef');
    const button = document.getElementById('theme-toggle');
    if (button) {
      button.setAttribute('aria-pressed', String(theme === 'dark'));
      button.textContent = document.documentElement.lang === 'en' ? (theme === 'dark' ? 'Light mode' : 'Dark mode') : (theme === 'dark' ? 'Modo claro' : 'Modo oscuro');
    }
  }
  function sync() { const preference = saved(); apply(preference === 'dark' || (preference !== 'light' && media.matches) ? 'dark' : 'light'); }
  document.addEventListener('hapic-language-change', () => apply(document.documentElement.dataset.theme));
  sync();
  media.addEventListener('change', sync);
  window.addEventListener('storage', sync);
  document.addEventListener('DOMContentLoaded', () => {
    sync();
    document.getElementById('theme-toggle').addEventListener('click', () => {
      const theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem('hapic-theme', theme); } catch {}
      apply(theme);
    });
  });
})();
