// ==========================================================
// SECCIÓN: CONTADOR
//
// Todo el código va dentro de una función. Así:
//  1. Si el cliente no eligió esta sección (no existe en el HTML),
//     salimos con "return" y no hay errores.
//  2. Las variables de este archivo no chocan con las de otros
//     archivos (por ejemplo, dos archivos con "const intervalo").
// ==========================================================

function iniciarContador() {
  const seccion = document.getElementById('contador');
  if (!seccion) return;   // la sección no está en esta invitación

  // Fecha y hora de la boda, con zona horaria de México (-06:00)
  const fechaBoda = new Date('2028-03-03T15:00:00-06:00');
  const UN_DIA = 1000 * 60 * 60 * 24;

  const cajas = seccion.querySelector('.contador-cajas');
  const elDias = document.getElementById('contador-dias');
  const elHoras = document.getElementById('contador-horas');
  const elMinutos = document.getElementById('contador-minutos');
  const elSegundos = document.getElementById('contador-segundos');

  // Convierte 5 en "05"
  function dosDigitos(numero) {
    return String(numero).padStart(2, '0');
  }

  // Reemplaza las cajas por un mensaje y detiene el reloj
  function mostrarMensaje(texto) {
    cajas.innerHTML = `<p class="contador-mensaje">${texto}</p>`;
    clearInterval(intervalo);
  }

  function actualizar() {
    const diferencia = fechaBoda - new Date();   // milisegundos que faltan

    if (diferencia <= -UN_DIA) return mostrarMensaje('¡Gracias por acompañarnos!');
    if (diferencia <= 0) return mostrarMensaje('¡Hoy es el gran día!');

    const totalSegundos = Math.floor(diferencia / 1000);

    // % (módulo) = lo que sobra después de quitar las unidades completas
    elDias.textContent = Math.floor(totalSegundos / 86400);
    elHoras.textContent = dosDigitos(Math.floor((totalSegundos % 86400) / 3600));
    elMinutos.textContent = dosDigitos(Math.floor((totalSegundos % 3600) / 60));
    elSegundos.textContent = dosDigitos(totalSegundos % 60);
  }

  // Primero el intervalo (debe existir antes de que mostrarMensaje lo detenga)
  const intervalo = setInterval(actualizar, 1000);
  actualizar();
}

iniciarContador();
