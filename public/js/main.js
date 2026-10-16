document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('apartado-form');
  const submitBtn = document.getElementById('submit-btn');
  const feedback = document.getElementById('feedback');
  const saboresGrid = document.getElementById('sabores-grid');
  const saborSelect = document.getElementById('sabor');

  function showFeedback(message, type) {
    feedback.textContent = message;
    feedback.className = `feedback-msg show ${type}`;
  }

  function saborClass(nombre) {
    const s = nombre.toLowerCase();
    if (s.includes('cere')) return 'cereza';
    if (s.includes('arco')) return 'arcoiris';
    if (s.includes('sand')) return 'sandia';
    return '';
  }

  function renderSabores(productos) {
    saboresGrid.innerHTML = '';
    saborSelect.innerHTML = '';

    const placeholderOption = document.createElement('option');
    placeholderOption.value = '';
    placeholderOption.textContent = 'Selecciona un sabor';
    placeholderOption.disabled = true;
    placeholderOption.selected = true;
    saborSelect.appendChild(placeholderOption);

    productos.forEach((producto) => {
      const agotado = producto.stock <= 0;

      const card = document.createElement('div');
      card.className = `sabor-card ${saborClass(producto.nombre)}`;

      const placeholder = document.createElement('div');
      placeholder.className = 'sabor-placeholder';
      if (producto.estilo_color) {
        placeholder.style.background = producto.estilo_color;
      }
      placeholder.textContent = agotado ? 'Agotado' : producto.nombre.toUpperCase();
      card.appendChild(placeholder);

      const h3 = document.createElement('h3');
      h3.textContent = producto.nombre;
      card.appendChild(h3);

      const p = document.createElement('p');
      p.textContent = producto.descripcion;
      card.appendChild(p);

      if (agotado) {
        const agotadoTag = document.createElement('p');
        agotadoTag.textContent = 'Agotado';
        agotadoTag.style.color = '#ff6b6b';
        agotadoTag.style.fontWeight = '700';
        card.appendChild(agotadoTag);
      }

      saboresGrid.appendChild(card);

      const option = document.createElement('option');
      option.value = producto.nombre;
      option.textContent = agotado ? `${producto.nombre} (Agotado)` : producto.nombre;
      option.disabled = agotado;
      saborSelect.appendChild(option);
    });
  }

  async function cargarSabores() {
    try {
      const res = await fetch('/api/productos');
      const data = await res.json();

      if (!res.ok) {
        saboresGrid.textContent = 'No se pudieron cargar los sabores.';
        return;
      }

      renderSabores(data);
    } catch (err) {
      saboresGrid.textContent = 'Error de conexión al cargar los sabores.';
    }
  }

  cargarSabores();

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
