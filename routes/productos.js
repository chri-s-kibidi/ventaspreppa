const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const productoValidators = [
  body('nombre')
    .trim()
    .notEmpty().withMessage('El nombre es obligatorio')
    .isLength({ min: 1, max: 100 }).withMessage('El nombre debe tener máximo 100 caracteres'),
  body('descripcion')
    .optional()
    .trim()
    .isLength({ max: 500 }).withMessage('La descripción debe tener máximo 500 caracteres'),
  body('estilo_color')
    .optional()
    .trim()
    .isLength({ max: 200 }).withMessage('El color/estilo debe tener máximo 200 caracteres'),
  body('stock')
    .notEmpty().withMessage('El stock es obligatorio')
    .isInt({ min: 0 }).withMessage('El stock debe ser un entero >= 0')
    .toInt(),
  body('precio')
    .notEmpty().withMessage('El precio es obligatorio')
    .isFloat({ min: 0 }).withMessage('El precio debe ser un número >= 0')
    .toFloat()
];

// GET /api/productos -> público, solo activos
router.get('/', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT id, nombre, descripcion, estilo_color, stock, precio FROM productos WHERE activo = true ORDER BY id ASC'
    );
    return res.json(result.rows);
  } catch (err) {
    console.error('Error al listar productos:', err);
    return res.status(500).json({ error: 'Error interno al obtener los productos.' });
  }
});

// GET /api/productos/admin -> protegido, todos (activos e inactivos)
router.get('/admin', requireAuth, async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM productos ORDER BY id ASC');
    return res.json(result.rows);
  } catch (err) {
    console.error('Error al listar productos (admin):', err);
    return res.status(500).json({ error: 'Error interno al obtener los productos.' });
  }
});

// POST /api/productos -> protegido, crear producto
router.post('/', requireAuth, productoValidators, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg, errors: errors.array() });
  }

  const { nombre, descripcion = '', estilo_color = '', stock, precio } = req.body;

  try {
    const result = await db.query(
      `INSERT INTO productos (nombre, descripcion, estilo_color, stock, precio, activo)
       VALUES ($1, $2, $3, $4, $5, true) RETURNING id`,
      [nombre, descripcion, estilo_color, stock, precio]
    );
    return res.status(201).json({ message: 'Producto creado correctamente', id: result.rows[0].id });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Ya existe un producto con ese nombre.' });
    }
    console.error('Error al crear producto:', err);
    return res.status(500).json({ error: 'Error interno al crear el producto.' });
  }
});

// PATCH /api/productos/:id -> protegido, editar datos/stock/activo
router.patch(
  '/:id',
  requireAuth,
  [
    body('nombre')
      .optional()
      .trim()
      .notEmpty().withMessage('El nombre no puede estar vacío')
      .isLength({ max: 100 }).withMessage('El nombre debe tener máximo 100 caracteres'),
    body('descripcion')
      .optional()
      .trim()
      .isLength({ max: 500 }).withMessage('La descripción debe tener máximo 500 caracteres'),
    body('estilo_color')
      .optional()
      .trim()
      .isLength({ max: 200 }).withMessage('El color/estilo debe tener máximo 200 caracteres'),
    body('stock')
      .optional()
      .isInt({ min: 0 }).withMessage('El stock debe ser un entero >= 0')
      .toInt(),
    body('precio')
      .optional()
      .isFloat({ min: 0 }).withMessage('El precio debe ser un número >= 0')
      .toFloat(),
    body('activo')
      .optional()
      .isBoolean().withMessage('Activo debe ser booleano')
      .toBoolean()
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

    const campos = ['nombre', 'descripcion', 'estilo_color', 'stock', 'precio', 'activo'];
    const sets = [];
    const values = [];
    let idx = 1;

    for (const campo of campos) {
      if (req.body[campo] !== undefined) {
        sets.push(`${campo} = $${idx}`);
        values.push(req.body[campo]);
        idx += 1;
      }
    }

    if (sets.length === 0) {
      return res.status(400).json({ error: 'No hay datos para actualizar' });
    }

    values.push(id);

    try {
      const result = await db.query(
        `UPDATE productos SET ${sets.join(', ')} WHERE id = $${idx}`,
        values
      );

      if (result.rowCount === 0) {
        return res.status(404).json({ error: 'Producto no encontrado' });
      }

      return res.json({ message: 'Producto actualizado correctamente' });
    } catch (err) {
      if (err.code === '23505') {
        return res.status(409).json({ error: 'Ya existe un producto con ese nombre.' });
      }
      console.error('Error al actualizar producto:', err);
      return res.status(500).json({ error: 'Error interno al actualizar el producto.' });
    }
  }
);

// DELETE /api/productos/:id -> protegido, desactivar (no borrar)
router.delete('/:id', requireAuth, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'ID inválido' });
  }

  try {
    const result = await db.query('UPDATE productos SET activo = false WHERE id = $1', [id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }

    return res.json({ message: 'Producto desactivado correctamente' });
  } catch (err) {
    console.error('Error al desactivar producto:', err);
    return res.status(500).json({ error: 'Error interno al desactivar el producto.' });
  }
});

module.exports = router;
