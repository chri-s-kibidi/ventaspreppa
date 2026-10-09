document.addEventListener('DOMContentLoaded', () => {
  const tbody = document.getElementById('apartados-tbody');
  const statsBar = document.getElementById('stats-bar');
  const logoutBtn = document.getElementById('logout-btn');

  function saborClass(sabor) {
    const s = sabor.toLowerCase();
    if (s.includes('cere')) return 'cereza';
    if (s.includes('arco')) return 'arcoiris';
    if (s.includes('sand')) return 'sandia';
    return '';
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function renderStats(apartados) {
    const total = apartados.length;
    const pendientes = apartados.filter(a => a.estado === 'Pendiente').length;
    const entregados = total - pendientes;
    const totalBolsas = apartados.reduce((sum, a) => sum + a.cantidad, 0);

    statsBar.innerHTML = `
      <div class="stat-pill"><strong>${total}</strong>Apartados</div>
      <div class="stat-pill"><strong>${pendientes}</strong>Pendientes</div>
      <div class="stat-pill"><strong>${entregados}</strong>Entregados</div>
      <div class="stat-pill"><strong>${totalBolsas}</strong>Bolsas totales</div>
    `;
  }

  function renderTable(apartados) {
    if (apartados.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" class="empty-row">Aún no hay apartados registrados.</td></tr>`;
      return;
    }

    tbody.innerHTML = apartados.map(a => {
      const isEntregado = a.estado === 'Entregado/Pagado';
      const badgeClass = isEntregado ? 'entregado' : 'pendiente';
      const nextEstado = isEntregado ? 'Pendiente' : 'Entregado/Pagado';
      const btnLabel = isEntregado ? 'Marcar Pendiente' : 'Marcar Entregado';
      const fecha = new Date(a.fecha.replace(' ', 'T')).toLocaleString('es-MX', {
        dateStyle: 'short',
        timeStyle: 'short'
      });

      return `
        <tr data-id="${a.id}">
          <td>${a.id}</td>
          <td>${escapeHtml(a.nombre)}</td>
          <td><span class="sabor-tag ${saborClass(a.sabor)}">${escapeHtml(a.sabor)}</span></td>
          <td>${a.cantidad}</td>
          <td>${fecha}</td>
          <td><span class="badge ${badgeClass}">${a.estado}</span></td>
          <td><button class="toggle-btn" data-next="${nextEstado}">${btnLabel}</button></td>
        </tr>
      `;
    }).join('');
  }

  async function cargarApartados() {
    try {
      const res = await fetch('/api/apartados');

      if (res.status === 401) {
        window.location.href = '/admin/login.html';
        return;
      }

      const data = await res.json();
      if (!res.ok) {
        tbody.innerHTML = `<tr><td colspan="7" class="empty-row">${data.error || 'Error al cargar apartados'}</td></tr>`;
        return;
      }

      renderStats(data);
      renderTable(data);
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="7" class="empty-row">Error de conexión con el servidor.</td></tr>`;
    }
  }

  tbody.addEventListener('click', async (e) => {
    const btn = e.target.closest('.toggle-btn');
    if (!btn) return;

    const row = btn.closest('tr');
    const id = row.getAttribute('data-id');
    const nextEstado = btn.getAttribute('data-next');

    btn.disabled = true;
    btn.textContent = 'Actualizando...';

    try {
      const res = await fetch(`/api/apartados/${id}/estado`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: nextEstado })
      });

      if (res.status === 401) {
        window.location.href = '/admin/login.html';
        return;
      }

      if (!res.ok) {
        throw new Error('No se pudo actualizar');
      }

      await cargarApartados();
    } catch (err) {
      btn.disabled = false;
      btn.textContent = 'Reintentar';
      alert('Ocurrió un error al actualizar el estado. Intenta de nuevo.');
    }
  });

  logoutBtn.addEventListener('click', async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } finally {
      window.location.href = '/admin/login.html';
    }
  });

  cargarApartados();
});
