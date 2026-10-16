const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// POST /api/cierres -> cierre de ventas: guarda resumen, borra pedidos y deja stock en 0 (protegido)
router.post('/', requireAuth, async (req, res) => {
  if (!req.body || req.body.confirmacion !== 'RESETEAR') {
    return res.status(400).json({ error: 'Confirmación inválida. Envía confirmacion: "RESETEAR".' });
  }

  const client = await db.pool.connect();

  try {
    await client.query('BEGIN');

    await client.query('LOCK TABLE productos, pedidos, pedido_items IN SHARE ROW EXCLUSIVE MODE');

    // (a) Resumen por producto, excluyendo cancelados (incluye productos sin ventas)
    const resumen = await client.query(
      `SELECT
         pr.nombre,
         pr.stock::int AS stock_restante,
         COALESCE(v.vendidas, 0)::int AS vendidas,
         COALESCE(v.ingresos, 0) AS ingresos,
         COALESCE(v.costos, 0) AS costos,
         COALESCE(v.ganancia, 0) AS ganancia
       FROM productos pr
       LEFT JOIN (
         SELECT
           pi.producto_id,
           SUM(pi.cantidad) AS vendidas,
           SUM(pi.precio_unitario * pi.cantidad) AS ingresos,
           SUM(pi.costo_unitario * pi.cantidad) AS costos,
           SUM((pi.precio_unitario - pi.costo_unitario) * pi.cantidad) AS ganancia
         FROM pedido_items pi
         JOIN pedidos p ON p.id = pi.pedido_id
         WHERE p.estado <> $1 AND pi.producto_id IS NOT NULL
         GROUP BY pi.producto_id
       ) v ON v.producto_id = pr.id
       ORDER BY pr.id ASC`,
      ['Cancelado']
    );

    const pedidosResult = await client.query(
      'SELECT COUNT(*)::int AS total FROM pedidos WHERE estado <> $1',
      ['Cancelado']
    );

    const filas = resumen.rows.map((r) => ({
      nombre: r.nombre,
      stock_restante: r.stock_restante,
      vendidas: r.vendidas,
      ingresos: Number(r.ingresos),
      costos: Number(r.costos),
      ganancia: Number(r.ganancia)
    }));

    const totalPedidos = pedidosResult.rows[0].total;
    const bolsas = filas.reduce((acc, f) => acc + f.vendidas, 0);
    const ingresos = filas.reduce((acc, f) => acc + f.ingresos, 0);
    const costos = filas.reduce((acc, f) => acc + f.costos, 0);
    const ganancia = filas.reduce((acc, f) => acc + f.ganancia, 0);

    // (b) Insertar cierre y cierre_items
    const cierreResult = await client.query(
      `INSERT INTO cierres (total_pedidos, bolsas_vendidas, ingresos, costos, ganancia)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [totalPedidos, bolsas, ingresos, costos, ganancia]
    );
    const cierreId = cierreResult.rows[0].id;

    for (const f of filas) {
      await client.query(
        `INSERT INTO cierre_items (cierre_id, nombre_producto, stock_restante, vendidas, ingresos, ganancia)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [cierreId, f.nombre, f.stock_restante, f.vendidas, f.ingresos, f.ganancia]
      );
    }

    // (c) Solo después, borrar pedidos
    await client.query('DELETE FROM pedido_items');
    await client.query('DELETE FROM pedidos');

    // (d) Stock en 0
    await client.query('UPDATE productos SET stock = 0');

    await client.query('COMMIT');

    return res.status(201).json({
      message: 'Cierre realizado correctamente',
      id: cierreId,
      total_pedidos: totalPedidos,
      bolsas_vendidas: bolsas,
      ingresos,
      costos,
      ganancia
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error al realizar cierre:', err);
    return res.status(500).json({ error: 'Error interno al realizar el cierre.' });
  } finally {
    client.release();
  }
});

// GET /api/cierres -> listar cierres con sus items, del más reciente al más antiguo (protegido)
router.get('/', requireAuth, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT
        c.id,
        c.creado_en,
        c.total_pedidos,
        c.bolsas_vendidas,
        c.ingresos,
        c.costos,
        c.ganancia,
        COALESCE(
          JSON_AGG(
            JSON_BUILD_OBJECT(
              'id', ci.id,
              'nombre_producto', ci.nombre_producto,
              'stock_restante', ci.stock_restante,
              'vendidas', ci.vendidas,
              'ingresos', ci.ingresos,
              'ganancia', ci.ganancia,
              'conteo_fisico', ci.conteo_fisico
            ) ORDER BY ci.id
          ) FILTER (WHERE ci.id IS NOT NULL),
          '[]'
        ) AS items
      FROM cierres c
      LEFT JOIN cierre_items ci ON ci.cierre_id = c.id
      GROUP BY c.id
      ORDER BY c.creado_en DESC, c.id DESC
    `);
    return res.json(result.rows);
  } catch (err) {
    console.error('Error al listar cierres:', err);
    return res.status(500).json({ error: 'Error interno al obtener los cierres.' });
  }
});

// PATCH /api/cierres/items/:id -> actualizar conteo físico (protegido)
router.patch('/items/:id', requireAuth, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'ID inválido' });
  }

  const conteo = req.body ? req.body.conteo_fisico : undefined;
  if (conteo !== null && !(Number.isInteger(conteo) && conteo >= 0)) {
    return res.status(400).json({ error: 'conteo_fisico debe ser un entero >= 0 o null' });
  }

  try {
    const result = await db.query('UPDATE cierre_items SET conteo_fisico = $1 WHERE id = $2', [conteo, id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Item de cierre no encontrado' });
    }

    return res.json({ message: 'Conteo físico actualizado correctamente' });
  } catch (err) {
    console.error('Error al actualizar conteo físico:', err);
    return res.status(500).json({ error: 'Error interno al actualizar el conteo físico.' });
  }
});

module.exports = router;
