document.addEventListener('DOMContentLoaded', () => {
  const INTERVALO_ACTUALIZACION = 30000;
  const TEXTO_RESETEO = 'RESETEAR';

  // ===== UTILIDADES =====
  class SesionExpirada extends Error {}

  async function api(url, options = {}) {
    const res = await fetch(url, options);

    if (res.status === 401) {
      window.location.href = '/admin/login.html';
      throw new SesionExpirada();
    }

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || 'Ocurrió un error en la solicitud.');
    }
    return data;
  }

  function jsonOptions(method, body) {
    return {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    };
  }

  function mensajeError(err) {
    return err instanceof TypeError ? 'Error de conexión con el servidor.' : err.message;
  }

  function mostrarErrorAlerta(err) {
    if (!(err instanceof SesionExpirada)) alert(mensajeError(err));
  }

  function formatoMoneda(valor) {
    return `$${Number(valor).toFixed(2)}`;
  }

  function formatoFecha(fecha) {
    return new Date(fecha).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' });
  }

  function crearTd(contenido) {
    const td = document.createElement('td');
    if (contenido instanceof Node) {
      td.appendChild(contenido);
    } else {
      td.textContent = contenido;
    }
    return td;
  }

  function crearBadge(texto, clase) {
    const badge = document.createElement('span');
    badge.className = `badge ${clase}`;
    badge.textContent = texto;
    return badge;
  }

  function crearEncabezado(etiquetas) {
    const thead = document.createElement('thead');
    const tr = document.createElement('tr');
    etiquetas.forEach((texto) => {
      const th = document.createElement('th');
      th.textContent = texto;
      tr.appendChild(th);
    });
    thead.appendChild(tr);
    return thead;
  }

  function mostrarMensaje(tbody, colspan, mensaje) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = colspan;
    td.className = 'empty-row';
    td.textContent = mensaje;
    tr.appendChild(td);
    tbody.replaceChildren(tr);
  }

  function hayCampoEnEdicion() {
    const el = document.activeElement;
    return Boolean(el) && el.matches('input:not([type="checkbox"]), textarea, select');
  }

  function hayModalAbierto() {
    return !resetModal.hidden;
  }

  // ===== REFERENCIAS =====
  const statsBar = document.getElementById('stats-bar');
  const pedidosTbody = document.getElementById('pedidos-tbody');
  const resumenCards = document.getElementById('resumen-cards');
  const resumenTbody = document.getElementById('resumen-tbody');
  const productosTbody = document.getElementById('productos-tbody');
  const productoForm = document.getElementById('producto-form');
  const productoSubmitBtn = document.getElementById('producto-submit-btn');
  const productoFeedback = document.getElementById('producto-feedback');
  const configForm = document.getElementById('config-form');
  const configAbiertos = document.getElementById('config-abiertos');
  const configEstado = document.getElementById('config-estado');
  const configTexto = document.getElementById('config-texto');
  const configSubmitBtn = document.getElementById('config-submit-btn');
  const configFeedback = document.getElementById('config-feedback');
  const cierresList = document.getElementById('cierres-list');
  const resetOpenBtn = document.getElementById('reset-open-btn');
  const resetModal = document.getElementById('reset-modal');
  const resetPendientes = document.getElementById('reset-pendientes');
  const resetConfirm = document.getElementById('reset-confirm');
  const resetCancelBtn = document.getElementById('reset-cancel-btn');
  const resetSubmitBtn = document.getElementById('reset-submit-btn');
  const csvBtn = document.getElementById('csv-btn');
  const logoutBtn = document.getElementById('logout-btn');

  // ===== PEDIDOS =====
  function renderStats(pedidos) {
    const vigentes = pedidos.filter((p) => p.estado !== 'Cancelado');
    const pendientes = vigentes.filter((p) => p.estado === 'Pendiente').length;
    const entregados = vigentes.filter((p) => p.estado === 'Entregado').length;
    const bolsas = vigentes.reduce(
      (sum, p) => sum + p.items.reduce((s, item) => s + item.cantidad, 0),
      0
    );

    const pills = [
      [vigentes.length, 'Pedidos'],
      [pendientes, 'Pendientes'],
      [entregados, 'Entregados'],
      [bolsas, 'Bolsas totales']
    ];

    statsBar.replaceChildren(...pills.map(([valor, etiqueta]) => {
      const pill = document.createElement('div');
      pill.className = 'stat-pill';
      const strong = document.createElement('strong');
      strong.textContent = valor;
      pill.append(strong, etiqueta);
      return pill;
    }));
  }

  function crearCeldaItems(items) {
    const td = document.createElement('td');
    items.forEach((item) => {
      const span = document.createElement('span');
      span.className = 'sabor-tag';
      span.textContent = `${item.nombre_producto} x${item.cantidad}`;
      td.append(span, document.createElement('br'));
    });
    return td;
  }

  function crearCeldaPagado(p) {
    if (p.estado === 'Cancelado') return crearTd('-');

    const input = document.createElement('input');
    input.type = 'checkbox';
    input.className = 'switch';
    input.checked = Boolean(p.pagado);
    input.dataset.accion = 'pagado';
    input.setAttribute('aria-label', 'Pagado');
    return crearTd(input);
  }

  function crearCeldaAcciones(p) {
    const td = crearTd('');
    if (p.estado === 'Cancelado') return td;

    if (p.estado === 'Pendiente') {
      const btnCancelar = document.createElement('button');
      btnCancelar.className = 'toggle-btn btn-cancelar';
      btnCancelar.dataset.accion = 'cancelar';
      btnCancelar.textContent = 'Cancelar';
      td.appendChild(btnCancelar);
    }

    const isEntregado = p.estado === 'Entregado';
    const btnEstado = document.createElement('button');
    btnEstado.className = 'toggle-btn';
    btnEstado.dataset.accion = 'estado';
    btnEstado.dataset.next = isEntregado ? 'Pendiente' : 'Entregado';
    btnEstado.textContent = isEntregado ? 'Marcar Pendiente' : 'Marcar Entregado';
    td.appendChild(btnEstado);

    return td;
  }

  function renderPedidos(pedidos) {
    if (pedidos.length === 0) {
      mostrarMensaje(pedidosTbody, 9, 'Aún no hay pedidos registrados.');
      return;
    }

    const badgeClases = { Entregado: 'entregado', Pendiente: 'pendiente', Cancelado: 'cancelado' };

    const filas = pedidos.map((p) => {
      const tr = document.createElement('tr');
      tr.setAttribute('data-id', p.id);
      if (p.estado === 'Cancelado') tr.classList.add('fila-cancelada');

      tr.append(
        crearTd(String(p.id)),
        crearTd(p.nombre_cliente),
        crearTd(p.contacto || '-'),
        crearCeldaItems(p.items),
        crearTd(formatoMoneda(p.total)),
        crearTd(formatoFecha(p.creado_en)),
        crearTd(crearBadge(p.estado, badgeClases[p.estado] || 'pendiente')),
        crearCeldaPagado(p),
        crearCeldaAcciones(p)
      );
      return tr;
    });

    pedidosTbody.replaceChildren(...filas);
  }

  async function cargarPedidos() {
    try {
      const pedidos = await api('/api/pedidos');
      renderStats(pedidos);
      renderPedidos(pedidos);
    } catch (err) {
      if (!(err instanceof SesionExpirada)) mostrarMensaje(pedidosTbody, 9, mensajeError(err));
    }
  }

  pedidosTbody.addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-accion]');
    if (!btn) return;

    const id = btn.closest('tr').getAttribute('data-id');

    try {
      if (btn.dataset.accion === 'cancelar') {
        if (!confirm('¿Cancelar este pedido?')) return;
        await api(`/api/pedidos/${id}/cancelar`, { method: 'PATCH' });
      } else {
        await api(`/api/pedidos/${id}/estado`, jsonOptions('PATCH', { estado: btn.dataset.next }));
      }
      await cargarTodo();
    } catch (err) {
      mostrarErrorAlerta(err);
    }
  });

  pedidosTbody.addEventListener('change', async (e) => {
    const input = e.target.closest('input[data-accion="pagado"]');
    if (!input) return;

    const id = input.closest('tr').getAttribute('data-id');

    try {
      await api(`/api/pedidos/${id}/pagado`, jsonOptions('PATCH', { pagado: input.checked }));
      await cargarTodo();
    } catch (err) {
      input.checked = !input.checked;
      mostrarErrorAlerta(err);
    }
  });

  // ===== RESUMEN =====
  function crearTarjetaResumen(etiqueta, valor) {
    const card = document.createElement('div');
    card.className = 'resumen-card';
    const label = document.createElement('span');
    label.className = 'resumen-label';
    label.textContent = etiqueta;
    const value = document.createElement('span');
    value.className = 'resumen-valor';
    value.textContent = valor;
    card.append(label, value);
    return card;
  }

  function renderResumen(resumen) {
    resumenCards.replaceChildren(
      crearTarjetaResumen('Ganancia esperada', formatoMoneda(resumen.ganancia_esperada)),
      crearTarjetaResumen('Ganancia realizada', formatoMoneda(resumen.ganancia_realizada)),
      crearTarjetaResumen('Ingresos', formatoMoneda(resumen.ingresos)),
      crearTarjetaResumen('Costos', formatoMoneda(resumen.costos))
    );

    if (resumen.productos.length === 0) {
      mostrarMensaje(resumenTbody, 4, 'Aún no hay productos con ventas.');
      return;
    }

    resumenTbody.replaceChildren(...resumen.productos.map((p) => {
      const tr = document.createElement('tr');
      tr.append(
        crearTd(p.nombre),
        crearTd(p.vendidas),
        crearTd(p.stock_actual),
        crearTd(formatoMoneda(p.ganancia))
      );
      return tr;
    }));
  }

  async function cargarResumen() {
    try {
      renderResumen(await api('/api/resumen'));
    } catch (err) {
      if (!(err instanceof SesionExpirada)) mostrarMensaje(resumenTbody, 4, mensajeError(err));
    }
  }

  // ===== PRODUCTOS =====
  function showProductoFeedback(message, type) {
    productoFeedback.textContent = message;
    productoFeedback.className = `feedback-msg show ${type}`;
  }

  function crearCeldaInput(valor, tipo, claseEdicion, extra) {
    const input = document.createElement('input');
    input.type = tipo;
    input.value = valor;
    input.className = claseEdicion;
    if (extra) Object.assign(input, extra);
    input.style.width = '100%';
    return crearTd(input);
  }

  function crearCeldaAccionesProducto(p, tr) {
    const td = crearTd('');

    const btnGuardar = document.createElement('button');
    btnGuardar.className = 'toggle-btn';
    btnGuardar.textContent = 'Guardar';
    btnGuardar.style.marginRight = '6px';
    btnGuardar.addEventListener('click', () => guardarProducto(p.id, tr));

    const btnEstado = document.createElement('button');
    btnEstado.className = 'toggle-btn';
    btnEstado.textContent = p.activo ? 'Desactivar' : 'Reactivar';
    btnEstado.addEventListener('click', () => cambiarActivoProducto(p.id, !p.activo));

    td.append(btnGuardar, btnEstado);
    return td;
  }

  function renderProductos(productos) {
    if (productos.length === 0) {
      mostrarMensaje(productosTbody, 9, 'No hay productos registrados.');
      return;
    }

    const filas = productos.map((p) => {
      const tr = document.createElement('tr');
      tr.setAttribute('data-id', p.id);

      tr.append(
        crearTd(String(p.id)),
        crearCeldaInput(p.nombre, 'text', 'edit-nombre', { maxLength: 100 }),
        crearCeldaInput(p.descripcion || '', 'text', 'edit-descripcion', { maxLength: 500 }),
        crearCeldaInput(p.estilo_color || '', 'text', 'edit-color', { maxLength: 200 }),
        crearCeldaInput(p.stock, 'number', 'edit-stock', { min: 0 }),
        crearCeldaInput(p.precio, 'number', 'edit-precio', { min: 0, step: '0.01' }),
        crearCeldaInput(p.costo, 'number', 'edit-costo', { min: 0, step: '0.01' }),
        crearTd(crearBadge(p.activo ? 'Activo' : 'Inactivo', p.activo ? 'entregado' : 'pendiente')),
        crearCeldaAccionesProducto(p, tr)
      );
      return tr;
    });

    productosTbody.replaceChildren(...filas);
  }

  async function cargarProductos() {
    try {
      renderProductos(await api('/api/productos/admin'));
    } catch (err) {
      if (!(err instanceof SesionExpirada)) mostrarMensaje(productosTbody, 9, mensajeError(err));
    }
  }

  async function guardarProducto(id, tr) {
    const body = {
      nombre: tr.querySelector('.edit-nombre').value.trim(),
      descripcion: tr.querySelector('.edit-descripcion').value.trim(),
      estilo_color: tr.querySelector('.edit-color').value.trim(),
      stock: Number(tr.querySelector('.edit-stock').value),
      precio: Number(tr.querySelector('.edit-precio').value),
      costo: Number(tr.querySelector('.edit-costo').value)
    };

    try {
      await api(`/api/productos/${id}`, jsonOptions('PATCH', body));
      await cargarTodo();
    } catch (err) {
      mostrarErrorAlerta(err);
    }
  }

  async function cambiarActivoProducto(id, activo) {
    try {
      if (activo) {
        await api(`/api/productos/${id}`, jsonOptions('PATCH', { activo: true }));
      } else {
        await api(`/api/productos/${id}`, { method: 'DELETE' });
      }
      await cargarTodo();
    } catch (err) {
      mostrarErrorAlerta(err);
    }
  }

  productoForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const body = {
      nombre: document.getElementById('p-nombre').value.trim(),
      descripcion: document.getElementById('p-descripcion').value.trim(),
      estilo_color: document.getElementById('p-color').value.trim(),
      stock: Number(document.getElementById('p-stock').value),
      precio: Number(document.getElementById('p-precio').value),
      costo: Number(document.getElementById('p-costo').value)
    };

    if (!body.nombre) {
      showProductoFeedback('El nombre es obligatorio.', 'error');
      return;
    }

    productoSubmitBtn.disabled = true;
    productoSubmitBtn.textContent = 'Guardando...';

    try {
      await api('/api/productos', jsonOptions('POST', body));
      showProductoFeedback('Producto creado correctamente.', 'success');
      productoForm.reset();
      await cargarTodo();
    } catch (err) {
      if (!(err instanceof SesionExpirada)) showProductoFeedback(mensajeError(err), 'error');
    } finally {
      productoSubmitBtn.disabled = false;
      productoSubmitBtn.textContent = 'Agregar Producto';
    }
  });

  // ===== CONFIG =====
  function showConfigFeedback(message, type) {
    configFeedback.textContent = message;
    configFeedback.className = `feedback-msg show ${type}`;
  }

  function actualizarEstadoConfig() {
    configEstado.textContent = configAbiertos.checked ? 'Abiertos' : 'Cerrados';
  }

  async function cargarConfig() {
    try {
      const config = await api('/api/config');
      configAbiertos.checked = Boolean(config.pedidos_abiertos);
      configTexto.value = config.texto_entrega || '';
      actualizarEstadoConfig();
    } catch (err) {
      if (!(err instanceof SesionExpirada)) showConfigFeedback(mensajeError(err), 'error');
    }
  }

  configAbiertos.addEventListener('change', actualizarEstadoConfig);

  configForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    configSubmitBtn.disabled = true;
    configSubmitBtn.textContent = 'Guardando...';

    try {
      await api('/api/config', jsonOptions('PATCH', {
        pedidos_abiertos: configAbiertos.checked,
        texto_entrega: configTexto.value.trim()
      }));
      showConfigFeedback('Configuración guardada.', 'success');
    } catch (err) {
      if (!(err instanceof SesionExpirada)) showConfigFeedback(mensajeError(err), 'error');
    } finally {
      configSubmitBtn.disabled = false;
      configSubmitBtn.textContent = 'Guardar';
    }
  });

  // ===== CIERRES =====
  function pintarDiferencia(td, conteo, stockRestante) {
    td.className = '';
    if (conteo === '' || conteo === null || conteo === undefined) {
      td.textContent = '-';
      return;
    }
    const diff = Number(conteo) - stockRestante;
    td.textContent = diff > 0 ? `+${diff}` : String(diff);
    if (diff < 0) td.className = 'diferencia-neg';
    if (diff > 0) td.className = 'diferencia-pos';
  }

  function crearFilaCierreItem(item) {
    const tr = document.createElement('tr');
    tr.setAttribute('data-id', item.id);

    const input = document.createElement('input');
    input.type = 'number';
    input.min = '0';
    input.step = '1';
    input.className = 'edit-conteo';
    input.value = item.conteo_fisico ?? '';
    input.style.width = '100%';

    const tdDiferencia = crearTd('');
    pintarDiferencia(tdDiferencia, input.value, item.stock_restante);
    input.addEventListener('input', () => pintarDiferencia(tdDiferencia, input.value, item.stock_restante));

    const btnGuardar = document.createElement('button');
    btnGuardar.type = 'button';
    btnGuardar.className = 'toggle-btn';
    btnGuardar.dataset.accion = 'guardar-conteo';
    btnGuardar.textContent = 'Guardar';

    tr.append(
      crearTd(item.nombre_producto),
      crearTd(item.stock_restante),
      crearTd(item.vendidas),
      crearTd(input),
      tdDiferencia,
      crearTd(btnGuardar)
    );
    return tr;
  }

  function crearCierreCard(cierre) {
    const card = document.createElement('div');
    card.className = 'cierre-card';

    const titulo = document.createElement('h3');
    titulo.textContent = formatoFecha(cierre.creado_en);

    const resumen = document.createElement('p');
    resumen.className = 'resumen-label';
    resumen.textContent = `Pedidos: ${cierre.total_pedidos} · Bolsas: ${cierre.bolsas_vendidas} · Ingresos: ${formatoMoneda(cierre.ingresos)} · Ganancia: ${formatoMoneda(cierre.ganancia)}`;

    const table = document.createElement('table');
    table.className = 'admin-table';
    const tbody = document.createElement('tbody');
    table.append(crearEncabezado(['Producto', 'Stock restante', 'Vendidas', 'Conteo físico', 'Diferencia', 'Acción']), tbody);

    if (cierre.items.length === 0) {
      mostrarMensaje(tbody, 6, 'Sin productos en este cierre.');
    } else {
      tbody.replaceChildren(...cierre.items.map(crearFilaCierreItem));
    }

    card.append(titulo, resumen, table);
    return card;
  }

  function renderCierres(cierres) {
    if (cierres.length === 0) {
      const vacio = document.createElement('div');
      vacio.className = 'empty-row';
      vacio.textContent = 'Aún no hay cierres semanales.';
      cierresList.replaceChildren(vacio);
      return;
    }
    cierresList.replaceChildren(...cierres.map(crearCierreCard));
  }

  async function cargarCierres() {
    try {
      renderCierres(await api('/api/cierres'));
    } catch (err) {
      if (!(err instanceof SesionExpirada)) {
        const msg = document.createElement('div');
        msg.className = 'empty-row';
        msg.textContent = mensajeError(err);
        cierresList.replaceChildren(msg);
      }
    }
  }

  cierresList.addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-accion="guardar-conteo"]');
    if (!btn) return;

    const tr = btn.closest('tr');
    const valor = tr.querySelector('.edit-conteo').value.trim();

    let conteo = null;
    if (valor !== '') {
      conteo = Number(valor);
      if (!Number.isInteger(conteo) || conteo < 0) {
        alert('El conteo físico debe ser un entero mayor o igual a 0.');
        return;
      }
    }

    btn.disabled = true;
    try {
      await api(`/api/cierres/items/${tr.getAttribute('data-id')}`, jsonOptions('PATCH', { conteo_fisico: conteo }));
      await cargarCierres();
    } catch (err) {
      mostrarErrorAlerta(err);
    } finally {
      btn.disabled = false;
    }
  });

  // ===== RESETEO =====
  function cerrarModal() {
    resetModal.hidden = true;
  }

  async function abrirModalReseteo() {
    resetConfirm.value = '';
    resetSubmitBtn.disabled = true;

    try {
      const resumen = await api('/api/resumen');
      resetPendientes.textContent = resumen.pedidos_pendientes;
    } catch (err) {
      mostrarErrorAlerta(err);
      return;
    }

    resetModal.hidden = false;
    resetConfirm.focus();
  }

  resetOpenBtn.addEventListener('click', abrirModalReseteo);
  resetCancelBtn.addEventListener('click', cerrarModal);

  resetModal.addEventListener('click', (e) => {
    if (e.target === resetModal) cerrarModal();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && hayModalAbierto()) cerrarModal();
  });

  resetConfirm.addEventListener('input', () => {
    resetSubmitBtn.disabled = resetConfirm.value !== TEXTO_RESETEO;
  });

  resetSubmitBtn.addEventListener('click', async () => {
    if (resetConfirm.value !== TEXTO_RESETEO) return;

    resetSubmitBtn.disabled = true;
    resetSubmitBtn.textContent = 'Procesando...';

    try {
      await api('/api/cierres', jsonOptions('POST', { confirmacion: TEXTO_RESETEO }));
      cerrarModal();
      alert('Cierre realizado correctamente.');
      await cargarTodo();
    } catch (err) {
      mostrarErrorAlerta(err);
    } finally {
      resetSubmitBtn.textContent = 'Confirmar reseteo';
      resetSubmitBtn.disabled = resetConfirm.value !== TEXTO_RESETEO;
    }
  });

  // ===== CSV =====
  function csvCelda(valor) {
    let texto = valor === null || valor === undefined ? '' : String(valor);
    if (/^[=+\-@]/.test(texto)) texto = `'${texto}`;
    return `"${texto.replace(/"/g, '""')}"`;
  }

  function construirCsv(encabezados, filas) {
    return [encabezados, ...filas]
      .map((fila) => fila.map(csvCelda).join(','))
      .join('\r\n');
  }

  function csvPedidos(pedidos) {
    const filas = pedidos.map((p) => [
      p.id,
      p.nombre_cliente,
      p.contacto ?? '',
      p.items.map((i) => `${i.nombre_producto} x${i.cantidad}`).join('; '),
      p.total,
      formatoFecha(p.creado_en),
      p.estado,
      p.pagado ? 'Sí' : 'No'
    ]);
    return construirCsv(['ID', 'Nombre', 'Contacto', 'Items', 'Total', 'Fecha', 'Estado', 'Pagado'], filas);
  }

  function csvCierres(cierres) {
    const filas = [];
    cierres.forEach((c) => {
      const items = c.items.length ? c.items : [{}];
      items.forEach((item) => {
        filas.push([
          c.id,
          formatoFecha(c.creado_en),
          c.total_pedidos,
          c.bolsas_vendidas,
          c.ingresos,
          c.costos,
          c.ganancia,
          item.nombre_producto ?? '',
          item.stock_restante ?? '',
          item.vendidas ?? '',
          item.conteo_fisico ?? ''
        ]);
      });
    });
    return construirCsv(
      ['Cierre ID', 'Fecha', 'Pedidos', 'Bolsas', 'Ingresos', 'Costos', 'Ganancia', 'Producto', 'Stock restante', 'Vendidas', 'Conteo físico'],
      filas
    );
  }

  function descargarArchivo(nombre, contenido) {
    const blob = new Blob(['\uFEFF', contenido], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nombre;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  csvBtn.addEventListener('click', async () => {
    csvBtn.disabled = true;
    try {
      const [pedidos, cierres] = await Promise.all([api('/api/pedidos'), api('/api/cierres')]);
      descargarArchivo('pedidos.csv', csvPedidos(pedidos));
      descargarArchivo('cierres.csv', csvCierres(cierres));
    } catch (err) {
      mostrarErrorAlerta(err);
    } finally {
      csvBtn.disabled = false;
    }
  });

  // ===== CARGA GLOBAL, LOGOUT Y AUTO-ACTUALIZACIÓN =====
  async function cargarTodo() {
    await Promise.all([cargarPedidos(), cargarResumen(), cargarProductos(), cargarCierres()]);
  }

  logoutBtn.addEventListener('click', async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } finally {
      window.location.href = '/admin/login.html';
    }
  });

  cargarTodo();
  cargarConfig();

  setInterval(() => {
    if (hayCampoEnEdicion() || hayModalAbierto()) return;
    cargarTodo();
  }, INTERVALO_ACTUALIZACION);
});
