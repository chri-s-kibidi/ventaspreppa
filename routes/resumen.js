const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// GET /api/resumen -> métricas sobre pedidos no cancelados (protegido, solo admin)
router.get('/', requireAuth, async (req, res) => {
  try {
    const [totales, pendientes, productos] = await Promise.all([
      db.query(
        `SELECT
           COUNT(DISTINCT p.id)::int AS pedidos,
           COALESCE(SUM(pi.cantidad), 0)::int AS bolsas,
           COALESCE(SUM(pi.precio_unitario * pi.cantidad), 0) AS ingresos,
           COALESCE(SUM(pi.costo_unitario * pi.cantidad), 0) AS costos,
           COALESCE(SUM((pi.precio_unitario - pi.costo_unitario) * pi.cantidad), 0) AS ganancia_esperada,
           COALESCE(SUM(
             CASE WHEN p.estado = $2 AND p.pagado = true
               THEN (pi.precio_unitario - pi.costo_unitario) * pi.cantidad
               ELSE 0 END
           ), 0) AS ganancia_realizada
         FROM pedidos p
         LEFT JOIN pedido_items pi ON pi.pedido_id = p.id
         WHERE p.estado <> $1`,
        ['Cancelado', 'Entregado']
      ),
      db.query('SELECT COUNT(*)::int AS pendientes FROM pedidos WHERE estado = $1', ['Pendiente']),
      db.query(
        `SELECT
           pi.nombre_producto AS nombre,
           SUM(pi.cantidad)::int AS vendidas,
           COALESCE(MAX(pr.stock), 0)::int AS stock_actual,
           SUM((pi.precio_unitario - pi.costo_unitario) * pi.cantidad) AS ganancia
         FROM pedido_items pi
         JOIN pedidos p ON p.id = pi.pedido_id
         LEFT JOIN productos pr ON pr.id = pi.producto_id
         WHERE p.estado <> $1
         GROUP BY pi.nombre_producto
         ORDER BY pi.nombre_producto ASC`,
        ['Cancelado']
      )
    ]);

    const t = totales.rows[0];

    return res.json({
      pedidos: t.pedidos,
      bolsas: t.bolsas,
      ingresos: Number(t.ingresos),
      costos: Number(t.costos),
      ganancia_esperada: Number(t.ganancia_esperada),
      ganancia_realizada: Number(t.ganancia_realizada),
      pedidos_pendientes: pendientes.rows[0].pendientes,
      productos: productos.rows.map((r) => ({
        nombre: r.nombre,
        vendidas: r.vendidas,
        stock_actual: r.stock_actual,
        ganancia: Number(r.ganancia)
      }))
    });
  } catch (err) {
    console.error('Error al obtener resumen:', err);
    return res.status(500).json({ error: 'Error interno al obtener el resumen.' });
  }
});

module.exports = router;
