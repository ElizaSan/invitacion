// ==========================================================
// SECCIÓN: LIBRO DE MENSAJES
//
// VERSIÓN DE PRUEBA: los mensajes se guardan en localStorage,
// es decir, solo en el navegador de quien los escribe.
// Cuando tengamos el servidor, solo cambiaremos las funciones
// leerMensajes() y guardarMensaje(); el resto queda igual.
// ==========================================================

function iniciarLibro() {
  const seccion = document.getElementById('libro');
  if (!seccion) return;

  const CLAVE = 'libro-mensajes';
  const formulario = document.getElementById('libro-form');
  const contenedor = document.getElementById('libro-mensajes');

  // --- Acceso a datos (lo único que cambiará con el servidor) ---

  function leerMensajes() {
    // JSON.parse convierte el texto guardado de vuelta en un arreglo
    return JSON.parse(localStorage.getItem(CLAVE) || '[]');
  }

  function guardarMensaje(mensaje) {
    const mensajes = leerMensajes();
    mensajes.push(mensaje);
    localStorage.setItem(CLAVE, JSON.stringify(mensajes));
  }

  // --- Interfaz ---

  function dibujarMensajes() {
    contenedor.innerHTML = '';   // vaciamos antes de volver a dibujar

    // Del más nuevo al más viejo (slice hace una copia para no alterar el original)
    leerMensajes().slice().reverse().forEach((m) => {
      const tarjeta = document.createElement('article');
      tarjeta.className = 'libro-mensaje';

      const texto = document.createElement('p');
      texto.className = 'libro-texto';
      texto.textContent = m.mensaje;   // textContent, NUNCA innerHTML con texto del usuario

      const autor = document.createElement('p');
      autor.className = 'libro-autor';
      autor.textContent = `— ${m.nombre}`;

      tarjeta.append(texto, autor);
      contenedor.append(tarjeta);
    });
  }

  // SEGURIDAD: con innerHTML, alguien podría escribir <script>...</script>
  // como mensaje y el navegador lo ejecutaría. textContent siempre lo
  // muestra como texto normal.

  formulario.addEventListener('submit', (evento) => {
    evento.preventDefault();   // evita que la página se recargue

    const nombre = formulario.nombre.value.trim();
    const mensaje = formulario.mensaje.value.trim();
    if (!nombre || !mensaje) return;

    guardarMensaje({ nombre, mensaje, fecha: new Date().toISOString() });
    formulario.reset();
    dibujarMensajes();
  });

  dibujarMensajes();
}

iniciarLibro();
