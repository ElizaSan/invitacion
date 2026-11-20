// ==========================================================
// SECCIÓN: CARRUSEL DE FOTOS
//
// El deslizamiento con el dedo lo hace el CSS (scroll-snap).
// Este archivo solo hace funcionar las flechas.
// ==========================================================

function iniciarCarrusel() {
  const seccion = document.getElementById('carrusel');
  if (!seccion) return;

  const fotos = seccion.querySelector('.carrusel-fotos');
  const btnAnterior = seccion.querySelector('.carrusel-anterior');
  const btnSiguiente = seccion.querySelector('.carrusel-siguiente');

  // Mueve el carrusel el ancho de una foto (-1 = atrás, 1 = adelante)
  function mover(direccion) {
    const anchoFoto = fotos.querySelector('img').clientWidth;
    const alFinal = fotos.scrollLeft + fotos.clientWidth >= fotos.scrollWidth - 5;
    const alInicio = fotos.scrollLeft <= 5;

    // Si estamos en la última foto y piden "siguiente", volvemos a la primera
    if (direccion === 1 && alFinal) {
      fotos.scrollTo({ left: 0 });
    // Si estamos en la primera y piden "anterior", vamos a la última
    } else if (direccion === -1 && alInicio) {
      fotos.scrollTo({ left: fotos.scrollWidth });
    } else {
      fotos.scrollBy({ left: direccion * anchoFoto });
    }
  }

  btnAnterior.addEventListener('click', () => mover(-1));
  btnSiguiente.addEventListener('click', () => mover(1));
}

iniciarCarrusel();
