// ==========================================================
// IMPORTAR INVITADOS DESDE UN CSV
//
// Uso (desde la carpeta servidor/):
//   npm run importar -- <slug-de-la-boda> <archivo.csv>
//   npm run importar -- prueba datos/ejemplo-invitados.csv
//
// Formato del CSV (se puede exportar desde Excel o Google Sheets):
//   nombre,es_nino,responsable
//   Juan Pérez,no,
//   Sofía Pérez,si,Juan Pérez
//
//  - Adultos: es_nino = no, responsable vacío. Reciben un código.
//  - Niños:   es_nino = si, responsable = nombre EXACTO de un adulto
//             del mismo archivo. No reciben código.
//
// Todo se guarda en una transacción: si hay un solo error,
// no se guarda nada y puedes corregir el archivo y reintentar.
// ==========================================================

const fs = require('node:fs');
const crypto = require('node:crypto');
const db = require('../db');


// ---------- Generar códigos ----------

// Sin letras ni números que se confunden al leerlos: 0/o, 1/l/i
const ALFABETO = 'abcdefghjkmnpqrstuvwxyz23456789';
const LARGO_CODIGO = 8;   // 31^8 ≈ 850 mil millones de combinaciones

function generarCodigo() {
  let codigo = '';
  for (let i = 0; i < LARGO_CODIGO; i++) {
    // crypto.randomInt es aleatorio de verdad (Math.random NO es seguro para esto)
    codigo += ALFABETO[crypto.randomInt(ALFABETO.length)];
  }
  return codigo;
}


// ---------- Leer el CSV ----------

function leerCsv(ruta) {
  let texto = fs.readFileSync(ruta, 'utf8');
  texto = texto.replace(/^﻿/, '');   // Excel a veces agrega un carácter invisible (BOM) al inicio

  const lineas = texto.split(/\r?\n/).filter((l) => l.trim() !== '');   // \r?\n: saltos de Windows y Linux

  // Excel en algunos idiomas separa con ";" en vez de ","
  const separador = lineas[0].includes(';') && !lineas[0].includes(',') ? ';' : ',';

  const encabezados = lineas[0].split(separador).map((e) => e.trim().toLowerCase());
  for (const campo of ['nombre', 'es_nino', 'responsable']) {
    if (!encabezados.includes(campo)) {
      throw new Error(`Falta la columna "${campo}" en la primera línea del CSV`);
    }
  }

  // Convierte cada línea en un objeto { nombre, es_nino, responsable, linea }
  return lineas.slice(1).map((linea, i) => {
    const valores = linea.split(separador).map((v) => v.trim());
    const fila = { linea: i + 2 };   // +2: la línea 1 son los encabezados
    encabezados.forEach((campo, j) => { fila[campo] = valores[j] || ''; });
    return fila;
  });
}


// ---------- Validar ----------

function validar(filas) {
  const errores = [];
  const adultos = new Set();

  const esSi = (valor) => ['si', 'sí', 's', 'x', '1', 'true'].includes(valor.toLowerCase());

  for (const fila of filas) {
    fila.esNino = esSi(fila.es_nino);
    if (!fila.nombre) errores.push(`Línea ${fila.linea}: falta el nombre`);

    if (!fila.esNino) {
      if (adultos.has(fila.nombre)) errores.push(`Línea ${fila.linea}: "${fila.nombre}" está repetido`);
      if (fila.responsable) errores.push(`Línea ${fila.linea}: un adulto no lleva responsable`);
      adultos.add(fila.nombre);
    }
  }

  // Los niños se revisan después, cuando ya conocemos a todos los adultos
  for (const fila of filas.filter((f) => f.esNino)) {
    if (!fila.responsable) {
      errores.push(`Línea ${fila.linea}: el niño "${fila.nombre}" necesita un responsable`);
    } else if (!adultos.has(fila.responsable)) {
      errores.push(`Línea ${fila.linea}: no existe el adulto "${fila.responsable}" en el archivo`);
    }
  }

  return errores;
}


// ---------- Programa principal ----------

async function principal() {
  const [slug, rutaCsv] = process.argv.slice(2);   // argumentos después del nombre del script
  if (!slug || !rutaCsv) {
    console.log('Uso: npm run importar -- <slug-de-la-boda> <archivo.csv>');
    process.exit(1);
  }

  const filas = leerCsv(rutaCsv);
  const errores = validar(filas);
  if (errores.length > 0) {
    console.error('No se importó nada. Corrige estos errores:\n- ' + errores.join('\n- '));
    process.exit(1);
  }

  const { rows } = await db.query('SELECT id FROM bodas WHERE slug = $1', [slug]);
  if (rows.length === 0) {
    console.error(`No existe una boda con el slug "${slug}"`);
    process.exit(1);
  }
  const bodaId = rows[0].id;

  const cliente = await db.connect();
  try {
    await cliente.query('BEGIN');

    // 1. Adultos primero, para conocer sus id
    const idPorNombre = new Map();
    for (const fila of filas.filter((f) => !f.esNino)) {
      const resultado = await cliente.query(
        `INSERT INTO invitados (boda_id, nombre, codigo)
         VALUES ($1, $2, $3)
         RETURNING id`,                       // nos devuelve el id recién creado
        [bodaId, fila.nombre, generarCodigo()]
      );
      idPorNombre.set(fila.nombre, resultado.rows[0].id);
    }

    // 2. Después los niños, ligados al id de su responsable
    for (const fila of filas.filter((f) => f.esNino)) {
      await cliente.query(
        `INSERT INTO invitados (boda_id, nombre, es_nino, responsable_id)
         VALUES ($1, $2, true, $3)`,
        [bodaId, fila.nombre, idPorNombre.get(fila.responsable)]
      );
    }

    await cliente.query('COMMIT');
    const ninos = filas.filter((f) => f.esNino).length;
    console.log(`Listo: ${idPorNombre.size} adultos y ${ninos} niños importados a "${slug}".`);
    console.log('Para ver los enlaces: npm run enlaces -- ' + slug);
  } catch (error) {
    await cliente.query('ROLLBACK');
    console.error('Error: no se importó nada.', error.message);
    process.exitCode = 1;
  } finally {
    cliente.release();
    await db.end();   // cierra las conexiones para que el script termine
  }
}

principal();