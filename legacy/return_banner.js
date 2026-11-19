// Shared Return-to-Latest Banner for Playable Legacy Update Builds
(() => {
  const scriptEl = document.currentScript;
  const versionLabel = scriptEl?.getAttribute('data-legacy-version') || 'Old Update';
  const params = new URLSearchParams(window.location.search);
  const from3D = params.get('from') === '3d';
  const latestPrimaryHref = from3D ? '../../3d/index.html' : '../../index.html';
  const latestPrimaryLabel = from3D ? '⏩ BACK TO LATEST 3D' : '⏩ BACK TO LATEST UPDATE';

  function mountReturnUI() {
    if (document.getElementById('legacy-return-bar')) return;

    const style = document.createElement('style');
    style.textContent = `
      #legacy-return-bar {
        position: fixed;
        top: 8px;
        right: 10px;
        z-index: 9999;
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 5px 10px;
        border-radius: 999px;
        background: rgba(15, 23, 42, 0.92);
        border: 1.5px solid #c084fc;
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.55);
        font-family: system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
        font-size: 11px;
        font-weight: 800;
        color: #f3e8ff;
        pointer-events: auto;
      }
      #legacy-return-bar .legacy-pill-tag {
        color: #facc15;
        letter-spacing: 0.4px;
      }
      #legacy-return-bar a {
        color: #ffffff;
        text-decoration: none;
        padding: 3px 9px;
        border-radius: 999px;
        background: linear-gradient(135deg, #9333ea, #0ea5e9);
        border: 1px solid #e9d5ff;
        transition: filter 0.12s ease;
        white-space: nowrap;
      }
      #legacy-return-bar a.secondary-link {
        background: rgba(30, 41, 59, 0.95);
        border-color: #38bdf8;
        color: #bae6fd;
      }
      #legacy-return-bar a:hover {
        filter: brightness(1.15);
      }
      .legacy-title-return-btn {
        display: inline-block;
        text-decoration: none;
        padding: 10px 18px;
        border-radius: 10px;
        background: linear-gradient(135deg, #9333ea, #0ea5e9) !important;
        border: 2px solid #f3e8ff !important;
        color: #ffffff !important;
        font-weight: 900;
        box-shadow: 0 0 18px rgba(168, 85, 247, 0.55);
      }
    `;
    document.head.appendChild(style);

    const bar = document.createElement('div');
    bar.id = 'legacy-return-bar';
    bar.innerHTML = `
      <span class="legacy-pill-tag">⏪ ${versionLabel}</span>
      <a href="${latestPrimaryHref}" id="btn-legacy-return-latest">${latestPrimaryLabel}</a>
      <a href="${from3D ? '../../index.html' : '../../3d/index.html'}" class="secondary-link">${from3D ? '🕹️ Latest 2D' : '🧊 Latest 3D'}</a>
    `;
    document.body.appendChild(bar);

    const titleActions = document.querySelector('#title-screen .title-actions');
    if (titleActions && !document.getElementById('btn-title-return-latest')) {
      const btn = document.createElement('a');
      btn.id = 'btn-title-return-latest';
      btn.href = latestPrimaryHref;
      btn.className = 'secondary-btn legacy-title-return-btn';
      btn.textContent = latestPrimaryLabel;
      titleActions.appendChild(btn);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountReturnUI);
  } else {
    mountReturnUI();
  }
})();
