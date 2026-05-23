(function() {
  console.log("=== NOTE-IT-DOWN DIAGNOSTIC CONTENT SCRIPT ACTIVE ===");
  try {
    const containerId = 'note-it-down-diagnostic-element';
    let container = document.getElementById(containerId);
    if (!container) {
      container = document.createElement('div');
      container.id = containerId;
      container.style.position = 'fixed';
      container.style.bottom = '20px';
      container.style.right = '20px';
      container.style.zIndex = '2147483647';
      container.style.background = '#FFD166';
      container.style.border = '4px solid #1A1A1A';
      container.style.borderRadius = '12px';
      container.style.padding = '12px';
      container.style.fontFamily = 'monospace';
      container.style.boxShadow = '4px 4px 0px #1A1A1A';
      container.innerHTML = `
        <h4 style="margin:0 0 8px 0;font-size:14px;color:#1A1A1A;">📝 Injection Diagnostic</h4>
        <p style="margin:0 0 6px 0;font-size:11px;color:#1A1A1A;">Content script successfully executed inside Google Chrome!</p>
        <button id="diagnostic-close-btn" style="background:#FFFFFF;border:2px solid #1A1A1A;border-radius:4px;padding:3px 6px;font-size:10px;cursor:pointer;">OK, Clear</button>
      `;
      document.body.appendChild(container);
      document.getElementById('diagnostic-close-btn').addEventListener('click', () => {
        container.remove();
      });
      console.log("Diagnostic DOM element successfully appended to page body.");
    }
  } catch (e) {
    console.error("Diagnostic execution error:", e);
  }
})();
