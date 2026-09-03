import { useState, useEffect } from 'react';

function App() {
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function checkHealth() {
      try {
        const res = await fetch('/api/health');
        const data = await res.json();
        setHealth(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    checkHealth();
  }, []);

  return (
    <div className="app">
      <header>
        <h1>eTIMS</h1>
        <p>Electronic Tax Invoice Management System</p>
      </header>
      <main>
        <section className="card">
          <h2>Backend Health Check</h2>
          {loading && <p className="loading">Checking connection...</p>}
          {error && <p className="error">Error: {error}</p>}
          {health && (
            <div className={`status ${health.status}`}>
              <p><strong>Status:</strong> {health.status}</p>
              <p><strong>Timestamp:</strong> {health.timestamp}</p>
              <p><strong>Uptime:</strong> {health.uptime.toFixed(2)}s</p>
              <p><strong>Environment:</strong> {health.environment}</p>
              <p><strong>Database:</strong> {health.database.status} ({health.database.host})</p>
            </div>
          )}
        </section>
        <section className="card">
          <h2>Project Phases</h2>
          <ul className="phases">
            <li className="current"><strong>Phase 0:</strong> Foundation & Setup ✓</li>
            <li>Phase 1: Data Layer & Auth</li>
            <li>Phase 2: Upload & Extraction Pipeline</li>
            <li>Phase 3: Accountant Review Dashboard</li>
            <li>Phase 4: QuickBooks Integration</li>
            <li>Phase 5: POS App (Business Side)</li>
            <li>Phase 6: Hardening & Deployment</li>
          </ul>
        </section>
      </main>
    </div>
  );
}

export default App;