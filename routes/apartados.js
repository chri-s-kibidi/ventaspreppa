const express = require('express');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// Rate limit para evitar spam de pedidos (fuerza bruta / bots)
const crearApartadoLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutos
  max: 8, // máximo 8 apartados por IP cada 10 min
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas solicitudes. Intenta de nuevo más tarde.' }
});

// POST /api/apartados -> crear un nuevo apartado (público)
router.post(
  '/',
  crearApartadoLimiter,
  [
    body('nombre')
      .trim()
      .notEmpty().withMessage('El nombre es obligatorio')
      .isLength({ min: 2, max: 100 }).withMessage('El nombre debe tener entre 2 y 100 caracteres')
      .matches(/^[a-zA-ZÀ-ÿ\u00f1\u00d1\s'.-]+$/).withMessage('El nombre contiene caracteres no permitidos')
      .escape(),
    body('sabor')
      .trim()
      .notEmpty().withMessage('El sabor es obligatorio')
      .isLength({ max: 100 }).withMessage('Sabor no válido')
      .escape(),
    body('cantidad')
      .notEmpty().withMessage('La cantidad es obligatoria')
      .isInt({ min: 1, max: 50 }).withMessage('La cantidad debe ser un número entero entre 1 y 50')
      .toInt()
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg, errors: errors.array() });
    }

    const { nombre, sabor, cantidad } = req.body;

    const client = await db.pool.connect();

    try {
      await client.query('BEGIN');

      const productoResult = await client.query(
        'SELECT id, stock FROM productos WHERE nombre = $1 AND activo = true FOR UPDATE',
        [sabor]
      );

      if (productoResult.rowCount === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Sabor no válido o no disponible' });
      }

      const producto = productoResult.rows[0];

      if (producto.stock < cantidad) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'No hay stock suficiente para ese sabor.' });
      }

      await client.query('UPDATE productos SET stock = stock - $1 WHERE id = $2', [cantidad, producto.id]);

      const result = await client.query(
        'INSERT INTO apartados (nombre, sabor, cantidad, estado) VALUES ($1, $2, $3, $4) RETURNING id',
        [nombre, sabor, cantidad, 'Pendiente']
      );

      await client.query('COMMIT');

      return res.status(201).json({
        message: '¡Apartado confirmado con éxito!',
        id: result.rows[0].id
      });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('Error al crear apartado:', err);
      return res.status(500).json({ error: 'Error interno al guardar el apartado.' });
    } finally {
      client.release();
    }
  }
);

// GET /api/apartados -> listar todos los apartados (protegido, solo admin)
router.get('/', requireAuth, async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM apartados ORDER BY fecha DESC');
    return res.json(result.rows);
  } catch (err) {
    console.error('Error al listar apartados:', err);
    return res.status(500).json({ error: 'Error interno al obtener los apartados.' });
  }
});

// PATCH /api/apartados/:id/estado -> actualizar estado (protegido, solo admin)
router.patch(
  '/:id/estado',
  requireAuth,
  [
    body('estado')
      .trim()
      .notEmpty().withMessage('El estado es obligatorio')
      .isIn(['Pendiente', 'Entregado/Pagado']).withMessage('Estado no válido')
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
      const result = await db.query('UPDATE apartados SET estado = $1 WHERE id = $2', [estado, id]);

      if (result.rowCount === 0) {
        return res.status(404).json({ error: 'Apartado no encontrado' });
      }

      return res.json({ message: 'Estado actualizado correctamente' });
    } catch (err) {
      console.error('Error al actualizar estado:', err);
      return res.status(500).json({ error: 'Error interno al actualizar el estado.' });
    }
  }
);

module.exports = router;
