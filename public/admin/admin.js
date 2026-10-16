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

  // ===== PRODUCTOS =====
  const productosTbody = document.getElementById('productos-tbody');
  const productoForm = document.getElementById('producto-form');
  const productoSubmitBtn = document.getElementById('producto-submit-btn');
  const productoFeedback = document.getElementById('producto-feedback');

  function showProductoFeedback(message, type) {
    productoFeedback.textContent = message;
    productoFeedback.className = `feedback-msg show ${type}`;
  }

  function crearCeldaInput(valor, tipo, extra) {
    const input = document.createElement('input');
    input.type = tipo;
    input.value = valor;
    if (extra) Object.assign(input, extra);
    input.style.width = '100%';
    return input;
  }

  function renderProductos(productos) {
    productosTbody.innerHTML = '';

    if (productos.length === 0) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = 8;
      td.className = 'empty-row';
      td.textContent = 'No hay productos registrados.';
      tr.appendChild(td);
      productosTbody.appendChild(tr);
      return;
    }

    productos.forEach((p) => {
      const tr = document.createElement('tr');
      tr.setAttribute('data-id', p.id);

      const tdId = document.createElement('td');
      tdId.textContent = p.id;
      tr.appendChild(tdId);

      const tdNombre = document.createElement('td');
      const inputNombre = crearCeldaInput(p.nombre, 'text', { maxLength: 100 });
      inputNombre.className = 'edit-nombre';
      tdNombre.appendChild(inputNombre);
      tr.appendChild(tdNombre);

      const tdDesc = document.createElement('td');
      const inputDesc = crearCeldaInput(p.descripcion || '', 'text', { maxLength: 500 });
      inputDesc.className = 'edit-descripcion';
      tdDesc.appendChild(inputDesc);
      tr.appendChild(tdDesc);

      const tdColor = document.createElement('td');
      const inputColor = crearCeldaInput(p.estilo_color || '', 'text', { maxLength: 200 });
      inputColor.className = 'edit-color';
      tdColor.appendChild(inputColor);
      tr.appendChild(tdColor);

      const tdStock = document.createElement('td');
      const inputStock = crearCeldaInput(p.stock, 'number', { min: 0 });
      inputStock.className = 'edit-stock';
      tdStock.appendChild(inputStock);
      tr.appendChild(tdStock);

      const tdPrecio = document.createElement('td');
      const inputPrecio = crearCeldaInput(p.precio, 'number', { min: 0, step: '0.01' });
      inputPrecio.className = 'edit-precio';
      tdPrecio.appendChild(inputPrecio);
      tr.appendChild(tdPrecio);

      const tdEstado = document.createElement('td');
      const badge = document.createElement('span');
      badge.className = `badge ${p.activo ? 'entregado' : 'pendiente'}`;
      badge.textContent = p.activo ? 'Activo' : 'Inactivo';
      tdEstado.appendChild(badge);
      tr.appendChild(tdEstado);

      const tdAccion = document.createElement('td');
      const btnGuardar = document.createElement('button');
      btnGuardar.className = 'toggle-btn';
      btnGuardar.textContent = 'Guardar';
      btnGuardar.style.marginRight = '6px';
      btnGuardar.addEventListener('click', () => guardarProducto(p.id, tr));
      tdAccion.appendChild(btnGuardar);

      const btnEstado = document.createElement('button');
      btnEstado.className = 'toggle-btn';
      btnEstado.textContent = p.activo ? 'Desactivar' : 'Reactivar';
      btnEstado.addEventListener('click', () => cambiarActivoProducto(p.id, !p.activo));
      tdAccion.appendChild(btnEstado);

      tr.appendChild(tdAccion);

      productosTbody.appendChild(tr);
    });
  }

  async function cargarProductos() {
    try {
      const res = await fetch('/api/productos/admin');

      if (res.status === 401) {
        window.location.href = '/admin/login.html';
        return;
      }

      const data = await res.json();
      if (!res.ok) {
        productosTbody.innerHTML = '';
        const tr = document.createElement('tr');
        const td = document.createElement('td');
        td.colSpan = 8;
        td.className = 'empty-row';
        td.textContent = data.error || 'Error al cargar productos';
        tr.appendChild(td);
        productosTbody.appendChild(tr);
        return;
      }

      renderProductos(data);
    } catch (err) {
      productosTbody.innerHTML = '';
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = 8;
      td.className = 'empty-row';
      td.textContent = 'Error de conexión con el servidor.';
      tr.appendChild(td);
      productosTbody.appendChild(tr);
    }
  }

  async function guardarProducto(id, tr) {
    const nombre = tr.querySelector('.edit-nombre').value.trim();
    const descripcion = tr.querySelector('.edit-descripcion').value.trim();
    const estilo_color = tr.querySelector('.edit-color').value.trim();
    const stock = Number(tr.querySelector('.edit-stock').value);
    const precio = Number(tr.querySelector('.edit-precio').value);

    try {
      const res = await fetch(`/api/productos/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre, descripcion, estilo_color, stock, precio })
      });

      if (res.status === 401) {
        window.location.href = '/admin/login.html';
        return;
      }

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'No se pudo actualizar el producto.');
        return;
      }

      await cargarProductos();
    } catch (err) {
      alert('Error de conexión al guardar el producto.');
    }
  }

  async function cambiarActivoProducto(id, activo) {
    try {
      const res = activo
        ? await fetch(`/api/productos/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ activo: true })
          })
        : await fetch(`/api/productos/${id}`, { method: 'DELETE' });

      if (res.status === 401) {
        window.location.href = '/admin/login.html';
        return;
      }

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'No se pudo actualizar el estado del producto.');
        return;
      }

      await cargarProductos();
    } catch (err) {
      alert('Error de conexión al actualizar el producto.');
    }
  }

  productoForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const nombre = document.getElementById('p-nombre').value.trim();
    const descripcion = document.getElementById('p-descripcion').value.trim();
    const estilo_color = document.getElementById('p-color').value.trim();
    const stock = Number(document.getElementById('p-stock').value);
    const precio = Number(document.getElementById('p-precio').value);

    if (!nombre) {
      showProductoFeedback('El nombre es obligatorio.', 'error');
      return;
    }

    productoSubmitBtn.disabled = true;
    productoSubmitBtn.textContent = 'Guardando...';

    try {
      const res = await fetch('/api/productos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre, descripcion, estilo_color, stock, precio })
      });

      if (res.status === 401) {
        window.location.href = '/admin/login.html';
        return;
      }

      const data = await res.json();

      if (!res.ok) {
        showProductoFeedback(data.error || 'Ocurrió un error al crear el producto.', 'error');
      } else {
        showProductoFeedback('Producto creado correctamente.', 'success');
        productoForm.reset();
        await cargarProductos();
      }
    } catch (err) {
      showProductoFeedback('Error de conexión. Intenta de nuevo.', 'error');
    } finally {
      productoSubmitBtn.disabled = false;
      productoSubmitBtn.textContent = 'Agregar Producto';
    }
  });

  cargarProductos();
});
