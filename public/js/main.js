document.addEventListener('DOMContentLoaded', () => {
  const MAX_SABORES = 10;
  const MAX_CANTIDAD = 20;

  const saboresSection = document.getElementById('sabores');
  const apartadoSection = document.getElementById('apartado');
  const confirmacionSection = document.getElementById('confirmacion');
  const form = document.getElementById('apartado-form');
  const submitBtn = document.getElementById('submit-btn');
  const feedback = document.getElementById('feedback');
  const saboresGrid = document.getElementById('sabores-grid');
  const carritoVacio = document.getElementById('carrito-vacio');
  const carritoLista = document.getElementById('carrito-lista');
  const carritoTotal = document.getElementById('carrito-total');
  const modal = document.getElementById('modal-contacto');
  const modalVolver = document.getElementById('modal-volver');
  const modalApartar = document.getElementById('modal-apartar');
  const confirmacionNumero = document.getElementById('confirmacion-numero');
  const confirmacionLista = document.getElementById('confirmacion-lista');
  const confirmacionTotal = document.getElementById('confirmacion-total');
  const btnNuevo = document.getElementById('btn-nuevo');
  const nombreInput = document.getElementById('nombre');
  const contactoInput = document.getElementById('contacto');
  const avisoCerrados = document.getElementById('aviso-cerrados');
  const entregaBloque = document.getElementById('entrega-bloque');
  const entregaTexto = document.getElementById('entrega-texto');
  const confirmacionEntrega = document.getElementById('confirmacion-entrega');
  const confirmacionEntregaTexto = document.getElementById('confirmacion-entrega-texto');

  let productos = [];
  const carrito = new Map(); // producto_id -> cantidad
  const tarjetas = new Map(); // producto_id -> { producto, valor, menos, mas }
  let enviando = false;
  let pedidosAbiertos = true; // si la config no carga, la página se comporta como abierta
  let textoEntrega = '';
  let actualizando = false;

  function showFeedback(message, type) {
    feedback.textContent = message;
    feedback.className = `feedback-msg show ${type}`;
  }

  function ocultarFeedback() {
    feedback.textContent = '';
    feedback.className = 'feedback-msg';
  }

  function saborClass(nombre) {
    const s = nombre.toLowerCase();
    if (s.includes('cere')) return 'cereza';
    if (s.includes('arco')) return 'arcoiris';
    if (s.includes('sand')) return 'sandia';
    return '';
  }

  function formatoPrecio(n) {
    return `$${Number(n).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  function maxPorProducto(producto) {
    if (Number(producto.stock) <= 0) return 0;
    return Math.min(Number(producto.stock), MAX_CANTIDAD);
  }

  function obtenerLineas() {
    const lineas = [];
    for (const [id, cantidad] of carrito) {
      const producto = productos.find((p) => p.id === id);
      if (!producto || cantidad <= 0) continue;
      lineas.push({
        nombre: producto.nombre,
        cantidad,
        subtotal: Number(producto.precio) * cantidad
      });
    }
    return lineas;
  }

  function llenarLista(ul, lineas) {
    ul.textContent = '';
    lineas.forEach((linea) => {
      const li = document.createElement('li');
      li.className = 'carrito-item';

      const nombre = document.createElement('span');
      nombre.textContent = `${linea.nombre} x ${linea.cantidad}`;

      const precio = document.createElement('span');
      precio.textContent = formatoPrecio(linea.subtotal);

      li.append(nombre, precio);
      ul.appendChild(li);
    });
    return lineas.reduce((suma, linea) => suma + linea.subtotal, 0);
  }

  function renderResumen() {
    const lineas = obtenerLineas();
    const total = llenarLista(carritoLista, lineas);
    carritoVacio.hidden = lineas.length > 0;
    carritoTotal.textContent = formatoPrecio(total);
  }

  function actualizarControles() {
    tarjetas.forEach((ref, id) => {
      const cantidad = carrito.get(id) || 0;
      const max = maxPorProducto(ref.producto);
      ref.valor.textContent = String(cantidad);
      ref.menos.disabled = !pedidosAbiertos || max === 0 || cantidad === 0;
      ref.mas.disabled = !pedidosAbiertos
        || max === 0
        || cantidad >= max
        || (cantidad === 0 && carrito.size >= MAX_SABORES);
    });
  }

  function cambiarCantidad(producto, delta) {
    const actual = carrito.get(producto.id) || 0;
    if (delta > 0 && actual === 0 && carrito.size >= MAX_SABORES) return;

    const nueva = Math.min(Math.max(actual + delta, 0), maxPorProducto(producto));
    if (nueva === 0) {
      carrito.delete(producto.id);
    } else {
      carrito.set(producto.id, nueva);
    }

    actualizarControles();
    renderResumen();
  }

  function renderSabores() {
    saboresGrid.textContent = '';
    tarjetas.clear();

    productos.forEach((producto) => {
      const agotado = Number(producto.stock) <= 0;

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

      const controles = document.createElement('div');
      controles.className = 'qty-controls';

      const menos = document.createElement('button');
      menos.type = 'button';
      menos.className = 'qty-btn';
      menos.textContent = '−';
      menos.setAttribute('aria-label', `Quitar una bolsa de ${producto.nombre}`);

      const valor = document.createElement('span');
      valor.className = 'qty-value';
      valor.textContent = '0';

      const mas = document.createElement('button');
      mas.type = 'button';
      mas.className = 'qty-btn';
      mas.textContent = '+';
      mas.setAttribute('aria-label', `Agregar una bolsa de ${producto.nombre}`);

      menos.addEventListener('click', () => cambiarCantidad(producto, -1));
      mas.addEventListener('click', () => cambiarCantidad(producto, 1));

      controles.append(menos, valor, mas);
      card.appendChild(controles);

      tarjetas.set(producto.id, { producto, valor, menos, mas });
      saboresGrid.appendChild(card);
    });

    actualizarControles();
  }

  function ajustarCarritoAStock() {
    for (const [id, cantidad] of carrito) {
      const producto = productos.find((p) => p.id === id);
      const max = producto ? maxPorProducto(producto) : 0;
      if (max === 0) {
        carrito.delete(id);
      } else if (cantidad > max) {
        carrito.set(id, max);
      }
    }
  }

  async function consultarConfig() {
    try {
      const res = await fetch('/api/config');
      if (!res.ok) return;
      const data = await res.json();
      pedidosAbiertos = data.pedidos_abiertos !== false;
      textoEntrega = typeof data.texto_entrega === 'string' ? data.texto_entrega.trim() : '';
    } catch (err) {
      // Se conserva el estado anterior; se reintenta en el siguiente ciclo.
    }
  }

  function aplicarEstadoPedidos() {
    const cerrado = !pedidosAbiertos;
    avisoCerrados.hidden = !cerrado;
    entregaTexto.textContent = textoEntrega;
    entregaBloque.hidden = textoEntrega === '';
    nombreInput.disabled = cerrado;
    contactoInput.disabled = cerrado;
    submitBtn.disabled = cerrado || enviando;
    actualizarControles();
  }

  async function refrescarProductos() {
    try {
      const res = await fetch('/api/productos');
      if (!res.ok) return;
      productos = await res.json();
      ajustarCarritoAStock();
      renderSabores();
      renderResumen();
    } catch (err) {
      // Se conservan los datos actuales; se reintenta en el siguiente ciclo.
    }
  }

  async function actualizarCadaMinuto() {
    if (actualizando || enviando || !modal.hidden) return;
    actualizando = true;
    try {
      await consultarConfig();
      aplicarEstadoPedidos();
      await refrescarProductos();
    } finally {
      actualizando = false;
    }
  }

  async function cargarSabores() {
    try {
      const res = await fetch('/api/productos');
      const data = await res.json();

      if (!res.ok) {
        saboresGrid.textContent = 'No se pudieron cargar los sabores.';
        return;
      }

      productos = data;
      ajustarCarritoAStock();
      renderSabores();
      renderResumen();
    } catch (err) {
      saboresGrid.textContent = 'Error de conexión al cargar los sabores.';
    }
  }

  function setEnviando(activo) {
    enviando = activo;
    submitBtn.disabled = activo || !pedidosAbiertos;
    modalApartar.disabled = activo;
    modalVolver.disabled = activo;
    submitBtn.textContent = activo ? 'Enviando...' : 'Confirmar apartado';
    modalApartar.textContent = activo ? 'Enviando...' : 'Apartar así';
  }

  function abrirModal() {
    modal.hidden = false;
    modalVolver.focus();
  }

  function cerrarModal() {
    modal.hidden = true;
  }

  function mostrarConfirmacion(data, lineas) {
    confirmacionNumero.textContent = `Número de pedido: #${data.id}`;
    llenarLista(confirmacionLista, lineas);
    confirmacionTotal.textContent = formatoPrecio(data.total);

    carrito.clear();
    actualizarControles();
    renderResumen();
    cerrarModal();
    ocultarFeedback();

    confirmacionEntregaTexto.textContent = textoEntrega;
    confirmacionEntrega.hidden = textoEntrega === '';

    saboresSection.hidden = true;
    apartadoSection.hidden = true;
    confirmacionSection.hidden = false;
    window.scrollTo(0, 0);
  }

  async function enviarPedido() {
    if (enviando) return;

    const nombre = document.getElementById('nombre').value.trim();
    const contacto = document.getElementById('contacto').value.trim();
    const lineas = obtenerLineas();

    const items = [];
    for (const [producto_id, cantidad] of carrito) {
      if (cantidad > 0) items.push({ producto_id, cantidad });
    }

    setEnviando(true);

    try {
      const res = await fetch('/api/pedidos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre, contacto, items })
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (res.status === 403) {
          pedidosAbiertos = false;
          aplicarEstadoPedidos();
          showFeedback(data.error || 'Los apartados están cerrados por ahora', 'error');
          return;
        }
        showFeedback(data.error || 'No se pudo confirmar tu apartado. Intenta de nuevo.', 'error');
        await cargarSabores();
        return;
      }

      mostrarConfirmacion(data, lineas);
    } catch (err) {
      showFeedback('Error de conexión. Intenta de nuevo.', 'error');
    } finally {
      setEnviando(false);
    }
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (enviando || !pedidosAbiertos) return;

    if (obtenerLineas().length === 0) {
      showFeedback('Agrega al menos un sabor a tu carrito.', 'error');
      return;
    }

    const nombre = document.getElementById('nombre').value.trim();
    if (!nombre) {
      showFeedback('Escribe tu nombre completo.', 'error');
      return;
    }

    const contacto = document.getElementById('contacto').value.trim();
    if (!contacto) {
      abrirModal();
      return;
    }

    ocultarFeedback();
    enviarPedido();
  });

  modalVolver.addEventListener('click', cerrarModal);

  modalApartar.addEventListener('click', () => {
    cerrarModal();
    enviarPedido();
  });

  btnNuevo.addEventListener('click', () => location.reload());

  renderResumen();
  aplicarEstadoPedidos();
  consultarConfig().then(aplicarEstadoPedidos);
  cargarSabores();
  setInterval(actualizarCadaMinuto, 60000);
});
