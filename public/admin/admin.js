document.addEventListener('DOMContentLoaded', () => {
  const tbody = document.getElementById('pedidos-tbody');
  const statsBar = document.getElementById('stats-bar');
  const logoutBtn = document.getElementById('logout-btn');

  function mostrarMensajeTabla(mensaje) {
    tbody.innerHTML = '';
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 8;
    td.className = 'empty-row';
    td.textContent = mensaje;
    tr.appendChild(td);
    tbody.appendChild(tr);
  }

  function agregarCelda(tr, contenido) {
    const td = document.createElement('td');
    if (contenido instanceof Node) {
      td.appendChild(contenido);
    } else {
      td.textContent = contenido;
    }
    tr.appendChild(td);
    return td;
  }

  function renderStats(pedidos) {
    const total = pedidos.length;
    const pendientes = pedidos.filter(p => p.estado === 'Pendiente').length;
    const entregados = pedidos.filter(p => p.estado === 'Entregado').length;
    const totalBolsas = pedidos.reduce(
      (sum, p) => sum + p.items.reduce((s, item) => s + item.cantidad, 0),
      0
    );

    statsBar.innerHTML = `
      <div class="stat-pill"><strong>${total}</strong>Pedidos</div>
      <div class="stat-pill"><strong>${pendientes}</strong>Pendientes</div>
      <div class="stat-pill"><strong>${entregados}</strong>Entregados</div>
      <div class="stat-pill"><strong>${totalBolsas}</strong>Bolsas totales</div>
    `;
  }

  function renderTable(pedidos) {
    if (pedidos.length === 0) {
      mostrarMensajeTabla('Aún no hay pedidos registrados.');
      return;
    }

    tbody.innerHTML = '';

    pedidos.forEach((p) => {
      const isEntregado = p.estado === 'Entregado';
      const badgeClass = isEntregado ? 'entregado' : 'pendiente';
      const nextEstado = isEntregado ? 'Pendiente' : 'Entregado';
      const btnLabel = isEntregado ? 'Marcar Pendiente' : 'Marcar Entregado';

      const tr = document.createElement('tr');
      tr.setAttribute('data-id', p.id);

      agregarCelda(tr, String(p.id));
      agregarCelda(tr, p.nombre_cliente);
      agregarCelda(tr, p.contacto || '');

      const tdItems = agregarCelda(tr, '');
      p.items.forEach((item) => {
        const span = document.createElement('span');
        span.className = 'sabor-tag';
        span.textContent = `${item.nombre_producto} x${item.cantidad}`;
        tdItems.appendChild(span);
        tdItems.appendChild(document.createElement('br'));
      });

      agregarCelda(tr, `$${Number(p.total).toFixed(2)}`);
      agregarCelda(tr, new Date(p.creado_en).toLocaleString('es-MX', {
        dateStyle: 'short',
        timeStyle: 'short'
      }));

      const badge = document.createElement('span');
      badge.className = `badge ${badgeClass}`;
      badge.textContent = p.estado;
      agregarCelda(tr, badge);

      const btn = document.createElement('button');
      btn.className = 'toggle-btn';
      btn.setAttribute('data-next', nextEstado);
      btn.textContent = btnLabel;
      agregarCelda(tr, btn);

      tbody.appendChild(tr);
    });
  }

  async function cargarPedidos() {
    try {
      const res = await fetch('/api/pedidos');

      if (res.status === 401) {
        window.location.href = '/admin/login.html';
        return;
      }

      const data = await res.json();
      if (!res.ok) {
        mostrarMensajeTabla(data.error || 'Error al cargar pedidos');
        return;
      }

      renderStats(data);
      renderTable(data);
    } catch (err) {
      mostrarMensajeTabla('Error de conexión con el servidor.');
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
      const res = await fetch(`/api/pedidos/${id}/estado`, {
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

      await cargarPedidos();
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

  cargarPedidos();

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
