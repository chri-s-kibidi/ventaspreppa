const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// GET /api/config -> público
router.get('/', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT clave, valor FROM config WHERE clave = ANY($1::text[])',
      [['pedidos_abiertos', 'texto_entrega']]
    );
    const cfg = new Map(result.rows.map((r) => [r.clave, r.valor]));

    return res.json({
      pedidos_abiertos: cfg.has('pedidos_abiertos') ? cfg.get('pedidos_abiertos') !== 'false' : true,
      texto_entrega: cfg.get('texto_entrega') || ''
    });
  } catch (err) {
    console.error('Error al obtener configuración:', err);
    return res.status(500).json({ error: 'Error interno al obtener la configuración.' });
  }
});

// PATCH /api/config -> protegido
router.patch(
  '/',
  requireAuth,
  [
    body('pedidos_abiertos')
      .optional()
      .custom((value) => typeof value === 'boolean').withMessage('pedidos_abiertos debe ser booleano'),
    body('texto_entrega')
      .optional()
      .isString().withMessage('texto_entrega debe ser texto')
      .trim()
      .isLength({ max: 300 }).withMessage('texto_entrega debe tener máximo 300 caracteres')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }

    const { pedidos_abiertos, texto_entrega } = req.body;
    const cambios = [];
    if (pedidos_abiertos !== undefined) {
      cambios.push(['pedidos_abiertos', pedidos_abiertos ? 'true' : 'false']);
    }
    if (texto_entrega !== undefined) {
      cambios.push(['texto_entrega', texto_entrega]);
    }

    if (cambios.length === 0) {
      return res.status(400).json({ error: 'No hay datos para actualizar' });
    }

    const client = await db.pool.connect();

    try {
      await client.query('BEGIN');

      for (const [clave, valor] of cambios) {
        await client.query(
          'INSERT INTO config (clave, valor) VALUES ($1, $2) ON CONFLICT (clave) DO UPDATE SET valor = EXCLUDED.valor',
          [clave, valor]
        );
      }

      await client.query('COMMIT');
      return res.json({ message: 'Configuración actualizada correctamente' });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('Error al actualizar configuración:', err);
      return res.status(500).json({ error: 'Error interno al actualizar la configuración.' });
    } finally {
      client.release();
    }
  }
);

module.exports = router;
