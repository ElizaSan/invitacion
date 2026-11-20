// ==========================================================
// SERVIDOR DE INVITACIONES
//
// Hace dos cosas:
//  1. Entrega los archivos de la página (carpeta ../public)
//  2. Ofrece una API para el RSVP:
//       GET  /api/invitacion?c=CODIGO  → datos del invitado y sus niños
//       POST /api/confirmar            → guarda las respuestas
//
// Para correrlo:  npm run dev   (y abrir http://localhost:3000)
// ==========================================================

const path = require('node:path');
const express = require('express');
const { Pool } = require('pg');

const app = express();
const PUERTO = process.env.PUERTO || 3000;

// ---------- Conexión a PostgreSQL ----------
// Un "pool" mantiene varias conexiones abiertas y las reutiliza:
// mucho más rápido que abrir una conexión nueva en cada petición.
// Los datos vienen del archivo .env (nunca se escriben en el código).
const db = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PUERTO,
  database: process.env.DB_NOMBRE,
  user: process.env.DB_USUARIO,
  password: process.env.DB_CONTRASENA,
});

// ---------- Middlewares ----------
// Un middleware es una función que procesa cada petición antes de
// que llegue a su ruta.

// Convierte el cuerpo JSON de las peticiones en un objeto (req.body).
// El límite evita que alguien mande un cuerpo gigante.
app.use(express.json({ limit: '10kb' }));

// Entrega index.html, css/, js/, img/... desde la carpeta public
app.use(express.static(path.join(__dirname, '..', 'public')));


// ---------- Funciones auxiliares ----------

// Un código válido: solo letras, números y guiones, de 3 a 40 caracteres.
// Rechazar desde aquí lo que no tenga esa forma evita consultas inútiles.
function codigoValido(codigo) {
  return typeof codigo === 'string' && /^[A-Za-z0-9-]{3,40}$/.test(codigo);
}

// Busca al adulto dueño del código, junto con los datos de su boda.
// "cerrado" lo calcula PostgreSQL con SU reloj, no con el del celular
// del invitado (que podría estar mal o manipulado).
async function buscarAdulto(codigo) {
  const resultado = await db.query(
    `SELECT i.id, i.nombre, i.respuesta,
            b.fecha_limite_rsvp,
            now() > b.fecha_limite_rsvp AS cerrado
       FROM invitados i
       JOIN bodas b ON b.id = i.boda_id
      WHERE i.codigo = $1`,
    [codigo]   // $1 se reemplaza de forma SEGURA por este valor (ver nota abajo)
  );
  return resultado.rows[0];   // undefined si no existe
}

// NOTA DE SEGURIDAD — consultas parametrizadas:
// NUNCA armes una consulta pegando texto: `WHERE codigo = '${codigo}'`.
// Alguien podría mandar como código:  ' OR '1'='1
// y la consulta devolvería TODOS los invitados (inyección SQL).
// Con $1, PostgreSQL trata el valor siempre como dato, nunca como código.

async function buscarNinos(idAdulto) {
  const resultado = await db.query(
    `SELECT id, nombre, respuesta
       FROM invitados
      WHERE responsable_id = $1
      ORDER BY id`,
    [idAdulto]
  );
  return resultado.rows;
}


// ---------- RUTA: obtener una invitación ----------
app.get('/api/invitacion', async (req, res) => {
  const codigo = req.query.c;

  if (!codigoValido(codigo)) {
    return res.status(400).json({ error: 'Código inválido' });
  }

  const adulto = await buscarAdulto(codigo);
  if (!adulto) {
    return res.status(404).json({ error: 'Invitación no encontrada' });
  }

  const ninos = await buscarNinos(adulto.id);

  // Mandamos SOLO lo necesario: nunca el código de otros, ni la lista completa
  res.json({
    fechaLimite: adulto.fecha_limite_rsvp,
    cerrado: adulto.cerrado,
    personas: [
      { id: adulto.id, nombre: adulto.nombre, esNino: false, respuesta: adulto.respuesta },
      ...ninos.map((n) => ({ id: n.id, nombre: n.nombre, esNino: true, respuesta: n.respuesta })),
    ],
  });
});


// ---------- RUTA: guardar respuestas ----------
// Espera un cuerpo así:  { "codigo": "prueba123", "respuestas": { "1": "si", "3": "no" } }
app.post('/api/confirmar', async (req, res) => {
  const { codigo, respuestas } = req.body || {};

  // 1. Validar la forma de los datos
  if (!codigoValido(codigo) || typeof respuestas !== 'object' || respuestas === null) {
    return res.status(400).json({ error: 'Datos incompletos' });
  }

  // 2. Validar que el código exista
  const adulto = await buscarAdulto(codigo);
  if (!adulto) {
    return res.status(404).json({ error: 'Invitación no encontrada' });
  }

  // 3. Validar la fecha límite (con el reloj del servidor)
  if (adulto.cerrado) {
    return res.status(403).json({ error: 'El periodo de confirmación terminó' });
  }

  // 4. Validar que cada persona pertenezca a ESTE código.
  //    Así nadie puede responder por alguien ajeno cambiando un id.
  const ninos = await buscarNinos(adulto.id);
  const idsPermitidos = new Set([adulto.id, ...ninos.map((n) => n.id)]);

  const entradas = Object.entries(respuestas);   // [["1","si"], ["3","no"]]
  if (entradas.length === 0) {
    return res.status(400).json({ error: 'No hay respuestas' });
  }

  for (const [id, valor] of entradas) {
    if (!idsPermitidos.has(Number(id)) || !['si', 'no'].includes(valor)) {
      return res.status(400).json({ error: 'Respuesta no válida' });
    }
  }

  // 5. Guardar todo en una TRANSACCIÓN: o se guardan todas las
  //    respuestas, o ninguna (si algo falla a la mitad, se deshace).
  const cliente = await db.connect();
  try {
    await cliente.query('BEGIN');
    for (const [id, valor] of entradas) {
      await cliente.query(
        `UPDATE invitados
            SET respuesta = $1, fecha_respuesta = now()
          WHERE id = $2`,
        [valor, Number(id)]
      );
    }
    await cliente.query('COMMIT');
  } catch (error) {
    await cliente.query('ROLLBACK');
    throw error;              // lo atrapa el manejador de errores de abajo
  } finally {
    cliente.release();        // devuelve la conexión al pool, pase lo que pase
  }

  res.json({ ok: true });
});


// ---------- Manejador de errores ----------
// Si algo falla (por ejemplo, la base de datos está apagada), el
// detalle se escribe en la terminal y el invitado solo ve un
// mensaje genérico: nunca le mostramos información interna.
app.use((error, req, res, next) => {
  console.error(error);
  res.status(500).json({ error: 'Error del servidor' });
});


app.listen(PUERTO, () => {
  console.log(`Servidor listo en http://localhost:${PUERTO}`);
});