// ==========================================================
// LISTAR LOS ENLACES PERSONALES DE UNA BODA
//
// Uso (desde la carpeta servidor/):
//   npm run enlaces -- <slug-de-la-boda>
//
// Muestra en pantalla cada adulto con su enlace y los niños a su
// cargo, y guarda lo mismo en datos/privado/enlaces-<slug>.csv
// para abrirlo en Excel y enviar los enlaces por WhatsApp.
// ==========================================================

const fs = require('node:fs');
const path = require('node:path');
const db = require('../db');

// En desarrollo: http://localhost:3000   En producción: https://tudominio.com
const URL_BASE = process.env.URL_BASE || 'http://localhost:3000';

async function principal() {
  const slug = process.argv[2];
  if (!slug) {
    console.log('Uso: npm run enlaces -- <slug-de-la-boda>');
    process.exit(1);
  }

  // Un adulto por fila, con sus niños juntos en un solo texto.
  // LEFT JOIN: incluye también a los adultos SIN niños.
  // string_agg: une varios nombres en uno, separados por ", "
  const { rows } = await db.query(
    `SELECT a.nombre, a.codigo, a.respuesta,
            string_agg(n.nombre, ', ' ORDER BY n.id) AS ninos
       FROM invitados a
       JOIN bodas b ON b.id = a.boda_id
       LEFT JOIN invitados n ON n.responsable_id = a.id
      WHERE b.slug = $1 AND a.es_nino = false
      GROUP BY a.id
      ORDER BY a.nombre`,
    [slug]
  );
  await db.end();

  if (rows.length === 0) {
    console.log(`No hay invitados para "${slug}"`);
    return;
  }

  const estado = { si: 'Asiste', no: 'No asiste' };
  const filas = rows.map((r) => ({
    nombre: r.nombre,
    ninos: r.ninos || '',
    respuesta: estado[r.respuesta] || 'Pendiente',
    enlace: `${URL_BASE}/?c=${r.codigo}`,
  }));

  console.table(filas);   // tabla bonita en la terminal

  // Guardamos un CSV para Excel. Las comillas protegen nombres con comas.
  const csv = ['nombre,ninos,respuesta,enlace']
    .concat(filas.map((f) => [f.nombre, f.ninos, f.respuesta, f.enlace]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')))
    .join('\n');

  const carpeta = path.join(__dirname, '..', 'datos', 'privado');
  fs.mkdirSync(carpeta, { recursive: true });   // crea la carpeta si no existe
  const archivo = path.join(carpeta, `enlaces-${slug}.csv`);
  fs.writeFileSync(archivo, '﻿' + csv);     // el BOM ayuda a Excel con los acentos

  console.log(`\nGuardado en ${archivo}`);
}

principal();