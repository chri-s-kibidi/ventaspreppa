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

// Inicializa la tabla de apartados si no existe
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
}

module.exports = {
  pool,
  query: (text, params) => pool.query(text, params),
  initDb
};

