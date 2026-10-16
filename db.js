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

