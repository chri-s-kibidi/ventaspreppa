document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('login-form');
  const btn = document.getElementById('login-btn');
  const feedback = document.getElementById('login-feedback');

  function showFeedback(message, type) {
    feedback.textContent = message;
    feedback.className = `feedback-msg show ${type}`;
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const password = document.getElementById('password').value;

    if (!password) {
      showFeedback('Ingresa tu contraseña.', 'error');
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Verificando...';

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });

      const data = await res.json();

      if (!res.ok) {
        showFeedback(data.error || 'Error al iniciar sesión.', 'error');
      } else {
        showFeedback('¡Bienvenido! Redirigiendo...', 'success');
        window.location.href = '/admin';
      }
    } catch (err) {
      showFeedback('Error de conexión. Intenta de nuevo.', 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Ingresar';
    }
  });
});
