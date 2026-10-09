document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('apartado-form');
  const submitBtn = document.getElementById('submit-btn');
  const feedback = document.getElementById('feedback');

  function showFeedback(message, type) {
    feedback.textContent = message;
    feedback.className = `feedback-msg show ${type}`;
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const nombre = document.getElementById('nombre').value.trim();
    const sabor = document.getElementById('sabor').value;
    const cantidad = document.getElementById('cantidad').value;

    if (!nombre || !sabor || !cantidad) {
      showFeedback('Por favor completa todos los campos.', 'error');
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Enviando...';

    try {
      const res = await fetch('/api/apartados', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre, sabor, cantidad: Number(cantidad) })
      });

      const data = await res.json();

      if (!res.ok) {
        showFeedback(data.error || 'Ocurrió un error al procesar tu apartado.', 'error');
      } else {
        showFeedback('¡Apartado confirmado con éxito! Te esperamos. 🌶️', 'success');
        form.reset();
        document.getElementById('cantidad').value = 1;
      }
    } catch (err) {
      showFeedback('Error de conexión. Intenta de nuevo.', 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Confirmar Apartado';
    }
  });
});
