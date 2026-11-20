// ==========================================================
// Conexión a PostgreSQL, compartida por el servidor y los scripts.
// Así la configuración vive en un solo lugar.
// ==========================================================

const { Pool } = require('pg');

const db = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PUERTO,
  database: process.env.DB_NOMBRE,
  user: process.env.DB_USUARIO,
  password: process.env.DB_CONTRASENA,
});

module.exports = db;   // lo que otros archivos reciben al hacer require('./db')