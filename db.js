const path = require('path');
const fs = require('fs');
const { DatabaseSync } = require('node:sqlite');

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'xile_chile.db');
const db = new DatabaseSync(dbPath);

db.exec('PRAGMA journal_mode = WAL;');

// Inicializa la tabla de apartados si no existe
db.exec(`
  CREATE TABLE IF NOT EXISTS apartados (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    sabor TEXT NOT NULL,
    cantidad INTEGER NOT NULL,
    estado TEXT NOT NULL DEFAULT 'Pendiente',
    fecha TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
  )
`);

module.exports = db;
