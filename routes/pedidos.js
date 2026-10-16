const express = require('express');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// Rate limit para evitar spam de pedidos (fuerza bruta / bots)
const crearPedidoLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutos
  max: 8, // máximo 8 pedidos por IP cada 10 min
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas solicitudes. Intenta de nuevo más tarde.' }
});

// POST /api/pedidos -> crear un nuevo pedido con varios sabores (público)
router.post(
  '/',
  crearPedidoLimiter,
  [
    body('nombre')
      .trim()
      .notEmpty().withMessage('El nombre es obligatorio')
      .isLength({ min: 2, max: 100 }).withMessage('El nombre debe tener entre 2 y 100 caracteres')
      .matches(/^[a-zA-ZÀ-ÿ\u00f1\u00d1\s'.-]+$/).withMessage('El nombre contiene caracteres no permitidos')
      .escape(),
    body('contacto')
      .optional({ checkFalsy: true })
      .trim()
      .isLength({ max: 60 }).withMessage('El contacto debe tener máximo 60 caracteres')
      .escape(),
    body('items')
      .isArray({ min: 1, max: 10 }).withMessage('Debes enviar entre 1 y 10 sabores distintos'),
    body('items.*.producto_id')
      .isInt({ gt: 0 }).withMessage('producto_id inválido')
      .toInt(),
    body('items.*.cantidad')
      .isInt({ min: 1, max: 20 }).withMessage('La cantidad debe ser un entero entre 1 y 20')
      .toInt()
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg, errors: errors.array() });
    }

    const { nombre, contacto, items } = req.body;

    const idsVistos = new Set();
    for (const item of items) {
      if (idsVistos.has(item.producto_id)) {
        return res.status(400).json({ error: 'No se permiten sabores repetidos en el mismo pedido.' });
      }
      idsVistos.add(item.producto_id);
    }

    const idsOrdenados = Array.from(idsVistos).sort((a, b) => a - b);

    const client = await db.pool.connect();

    try {
      await client.query('BEGIN');

      const productosResult = await client.query(
        'SELECT id, nombre, precio, stock, activo FROM productos WHERE id = ANY($1::int[]) ORDER BY id FOR UPDATE',
        [idsOrdenados]
      );

      if (productosResult.rowCount < idsOrdenados.length) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Uno de los sabores seleccionados no existe.' });
      }

      const productosPorId = new Map(productosResult.rows.map((p) => [p.id, p]));

      for (const item of items) {
        const producto = productosPorId.get(item.producto_id);
        if (!producto || !producto.activo) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: `El sabor "${producto ? producto.nombre : item.producto_id}" no está disponible.` });
        }
        if (producto.stock < item.cantidad) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: `No hay stock suficiente de "${producto.nombre}".` });
        }
      }

      let total = 0;
      for (const item of items) {
        const producto = productosPorId.get(item.producto_id);
        total += Number(producto.precio) * item.cantidad;
        await client.query('UPDATE productos SET stock = stock - $1 WHERE id = $2', [item.cantidad, producto.id]);
      }

      const pedidoResult = await client.query(
        'INSERT INTO pedidos (nombre_cliente, contacto, estado, pagado, total) VALUES ($1, $2, $3, $4, $5) RETURNING id',
        [nombre, contacto || null, 'Pendiente', false, total]
      );
      const pedidoId = pedidoResult.rows[0].id;

      for (const item of items) {
        const producto = productosPorId.get(item.producto_id);
        await client.query(
          'INSERT INTO pedido_items (pedido_id, producto_id, nombre_producto, precio_unitario, cantidad) VALUES ($1, $2, $3, $4, $5)',
          [pedidoId, producto.id, producto.nombre, producto.precio, item.cantidad]
        );
      }

      await client.query('COMMIT');

      return res.status(201).json({
        message: '¡Pedido confirmado con éxito!',
        id: pedidoId,
        total
      });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('Error al crear pedido:', err);
      return res.status(500).json({ error: 'Error interno al guardar el pedido.' });
    } finally {
      client.release();
    }
  }
);

// GET /api/pedidos -> listar todos los pedidos con sus items (protegido, solo admin)
router.get('/', requireAuth, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT
        p.id,
        p.nombre_cliente,
        p.contacto,
        p.estado,
        p.pagado,
        p.total,
        p.creado_en,
        COALESCE(
          JSON_AGG(
            JSON_BUILD_OBJECT(
              'id', pi.id,
              'producto_id', pi.producto_id,
              'nombre_producto', pi.nombre_producto,
              'precio_unitario', pi.precio_unitario,
              'cantidad', pi.cantidad
            ) ORDER BY pi.id
          ) FILTER (WHERE pi.id IS NOT NULL),
          '[]'
        ) AS items
      FROM pedidos p
      LEFT JOIN pedido_items pi ON pi.pedido_id = p.id
      GROUP BY p.id
      ORDER BY p.nombre_cliente ASC
    `);
    return res.json(result.rows);
  } catch (err) {
    console.error('Error al listar pedidos:', err);
    return res.status(500).json({ error: 'Error interno al obtener los pedidos.' });
  }
});

// PATCH /api/pedidos/:id/estado -> actualizar estado (protegido, solo admin)
router.patch(
  '/:id/estado',
  requireAuth,
  [
    body('estado')
      .trim()
      .notEmpty().withMessage('El estado es obligatorio')
      .isIn(['Pendiente', 'Entregado']).withMessage('Estado no válido')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }

    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'ID inválido' });
    }

    const { estado } = req.body;

    try {
      const result = await db.query('UPDATE pedidos SET estado = $1 WHERE id = $2', [estado, id]);

      if (result.rowCount === 0) {
        return res.status(404).json({ error: 'Pedido no encontrado' });
      }

      return res.json({ message: 'Estado actualizado correctamente' });
    } catch (err) {
      console.error('Error al actualizar estado:', err);
      return res.status(500).json({ error: 'Error interno al actualizar el estado.' });
    }
  }
);

module.exports = router;
