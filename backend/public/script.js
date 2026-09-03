async function checkHealth() {
  const statusEl = document.getElementById('status');
  const loadingEl = document.getElementById('loading');
  const errorEl = document.getElementById('error');

  try {
    const res = await fetch('/api/health');
    const data = await res.json();

    loadingEl.style.display = 'none';
    statusEl.style.display = 'block';
    renderHealth(data, statusEl);
  } catch (err) {
    loadingEl.style.display = 'none';
    errorEl.textContent = `Error: ${err.message}`;
    errorEl.style.display = 'block';
  }
}

function renderHealth(data, container) {
  const statusClass = data.status === 'ok' ? 'ok' : 'degraded';
  container.className = `status ${statusClass}`;

  container.innerHTML = `
    <p><strong>Status:</strong> ${data.status}</p>
    <p><strong>Timestamp:</strong> ${data.timestamp}</p>
    <p><strong>Uptime:</strong> ${data.uptime.toFixed(2)}s</p>
    <p><strong>Environment:</strong> ${data.environment}</p>
    <p><strong>Database:</strong> ${data.database.status} (${data.database.host})</p>
  `;
}

checkHealth();