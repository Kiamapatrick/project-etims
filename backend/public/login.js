import { setToken, apiFetch } from './auth.js';

document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = document.getElementById('submitBtn');
  const msg = document.getElementById('message');
  btn.disabled = true;
  msg.style.display = 'none';
  msg.className = 'message';

  try {
    const formData = new FormData(e.target);
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: formData.get('email'),
        password: formData.get('password')
      })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Login failed');

    setToken(data.accessToken);
    msg.textContent = 'Login successful! Fetching profile...';
    msg.className = 'message success';
    msg.style.display = 'block';

    const meRes = await apiFetch('/api/auth/me');
    const me = await meRes.json();
    if (!meRes.ok) throw new Error(me.message || 'Profile fetch failed');

    msg.textContent = `Welcome, ${me.user.email} (${me.user.role})`;
    
    // Redirect accountants to review dashboard, others to home
    setTimeout(() => {
      if (me.user.role === 'accountant') {
        window.location.href = '/review.html';
      } else {
        window.location.href = '/index.html';
      }
    }, 1000);
  } catch (err) {
    msg.textContent = err.message;
    msg.className = 'message error';
    msg.style.display = 'block';
  } finally {
    btn.disabled = false;
  }
});