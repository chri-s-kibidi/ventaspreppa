if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  console.error('ERROR: La variable de entorno DATABASE_URL es obligatoria. Define DATABASE_URL (Neon/Postgres).');
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Evita que un error de conexión ociosa en el pool tumbe el proceso
pool.on('error', (err) => {
  console.error('Error inesperado en el pool de Postgres:', err);
});

// Inicializa las tablas si no existen
async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS apartados (
      id SERIAL PRIMARY KEY,
      nombre TEXT NOT NULL,
      sabor TEXT NOT NULL,
      cantidad INTEGER NOT NULL,
      estado TEXT NOT NULL DEFAULT 'Pendiente',
      fecha TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS productos (
      id SERIAL PRIMARY KEY,
      nombre TEXT NOT NULL UNIQUE,
      descripcion TEXT NOT NULL DEFAULT '',
      estilo_color TEXT NOT NULL DEFAULT '',
      stock INTEGER NOT NULL DEFAULT 0,
      precio NUMERIC NOT NULL DEFAULT 0,
      activo BOOLEAN NOT NULL DEFAULT true
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS pedidos (
      id SERIAL PRIMARY KEY,
      nombre_cliente TEXT NOT NULL,
      contacto TEXT,
      estado TEXT NOT NULL DEFAULT 'Pendiente',
      pagado BOOLEAN NOT NULL DEFAULT false,
      total NUMERIC NOT NULL DEFAULT 0,
      creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS pedido_items (
      id SERIAL PRIMARY KEY,
      pedido_id INTEGER NOT NULL REFERENCES pedidos(id),
      producto_id INTEGER REFERENCES productos(id),
      nombre_producto TEXT NOT NULL,
      precio_unitario NUMERIC NOT NULL,
      cantidad INTEGER NOT NULL
    )
  `);

  await pool.query('ALTER TABLE productos ADD COLUMN IF NOT EXISTS costo NUMERIC NOT NULL DEFAULT 0');
  await pool.query('ALTER TABLE pedido_items ADD COLUMN IF NOT EXISTS costo_unitario NUMERIC NOT NULL DEFAULT 0');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS cierres (
      id SERIAL PRIMARY KEY,
      creado_en TIMESTAMPTZ DEFAULT NOW(),
      total_pedidos INT,
      bolsas_vendidas INT,
      ingresos NUMERIC,
      costos NUMERIC,
      ganancia NUMERIC
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS cierre_items (
      id SERIAL PRIMARY KEY,
      cierre_id INT REFERENCES cierres(id) ON DELETE CASCADE,
      nombre_producto TEXT,
      stock_restante INT,
      vendidas INT,
      ingresos NUMERIC,
      ganancia NUMERIC,
      conteo_fisico INT NULL
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS config (
      clave TEXT PRIMARY KEY,
      valor TEXT
    )
  `);

  const configCount = await pool.query('SELECT COUNT(*)::int AS count FROM config');
  if (configCount.rows[0].count === 0) {
    await pool.query(
      'INSERT INTO config (clave, valor) VALUES ($1, $2), ($3, $4) ON CONFLICT (clave) DO NOTHING',
      ['pedidos_abiertos', 'true', 'texto_entrega', '']
    );
  }

  const { rows } = await pool.query('SELECT COUNT(*)::int AS count FROM productos');
  if (rows[0].count === 0) {
    await pool.query(
      `INSERT INTO productos (nombre, descripcion, estilo_color, stock, precio, activo) VALUES
        ($1, $2, $3, $4, $5, true),
        ($6, $7, $8, $9, $10, true),
        ($11, $12, $13, $14, $15, true)`,
      [
        'Cereza', 'Rojo carmesí intenso. Dulce, ácido y con un toque de chile que pega directo.', 'linear-gradient(135deg, #c8102e, #8b0000)', 12, 0,
        'Arcoiris', 'Explosión de sabores frutales con un degradado de los 3 colores primarios.', 'linear-gradient(135deg, #ff0000, #ffff00, #0000ff)', 12, 0,
        'Sandía', 'Fresca, neón y enchilada. El contraste perfecto entre dulce y picante.', 'linear-gradient(135deg, #ff007f, #39ff14)', 12, 0
      ]
    );
  }
}

module.exports = {
  pool,
  query: (text, params) => pool.query(text, params),
  initDb
};

