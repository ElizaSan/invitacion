// ==========================================================
// SECCIÓN: CONFIRMAR ASISTENCIA (RSVP individual)
//
// Flujo:
//  1. Leemos el código del enlace:  /?c=prueba123
//  2. Sin código o código inválido → "abre tu enlace personal"
//  3. Pedimos al servidor los datos de esa persona
//  4. Periodo cerrado → mostramos sus respuestas, sin botones
//  5. Periodo abierto → dibujamos una tarjeta por persona
//  6. Al enviar → el servidor valida, guarda y respondemos "¡Gracias!"
// ==========================================================


// ---------- ACCESO A DATOS (habla con el servidor) ----------

// fetch() hace una petición HTTP y devuelve una promesa.
// Devuelve los datos, o null si el código no existe.
async function obtenerInvitacion(codigo) {
  // encodeURIComponent protege la URL si el código trae caracteres raros
  const respuesta = await fetch(`/api/invitacion?c=${encodeURIComponent(codigo)}`);

  if (respuesta.status === 400 || respuesta.status === 404) return null;
  if (!respuesta.ok) throw new Error('Error del servidor');

  return respuesta.json();
}

// Envía { codigo, respuestas } como JSON. Si el servidor rechaza,
// lanzamos un error con el mensaje que nos mandó.
async function enviarRespuestas(codigo, respuestas) {
  const respuesta = await fetch('/api/confirmar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ codigo, respuestas }),
  });

  const datos = await respuesta.json();
  if (!respuesta.ok) {
    const error = new Error(datos.error || 'No se pudo guardar');
    error.status = respuesta.status;   // guardamos el código (403 = cerrado)
    throw error;
  }
  return datos;
}


// ---------- INTERFAZ ----------

function iniciarConfirmar() {
  const seccion = document.getElementById('confirmar');
  if (!seccion) return;

  // Los 4 estados de la sección
  const estados = {
    personal: document.getElementById('confirmar-personal'),
    gracias: document.getElementById('confirmar-gracias'),
    cerrado: document.getElementById('confirmar-cerrado'),
    sinCodigo: document.getElementById('confirmar-sin-codigo'),
  };

  const formulario = document.getElementById('confirmar-form');
  const botonEnviar = formulario.querySelector('button[type="submit"]');

  // Muestra un estado y oculta los demás
  function mostrarEstado(nombre) {
    Object.entries(estados).forEach(([clave, elemento]) => {
      elemento.hidden = clave !== nombre;
    });
  }

  // "2028-02-01..." → "1 de febrero de 2028"
  function formatearFecha(fecha) {
    return fecha.toLocaleDateString('es-MX', {
      day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Mexico_City',
    });
  }

  // Crea la tarjeta (fieldset) de una persona con sus dos opciones
  function crearTarjeta(persona) {
    const tarjeta = document.createElement('fieldset');
    tarjeta.className = persona.esNino ? 'persona persona-nino' : 'persona';
    tarjeta.dataset.id = persona.id;

    const leyenda = document.createElement('legend');
    leyenda.className = 'persona-nombre';
    leyenda.textContent = persona.nombre;
    if (persona.esNino) {
      const etiqueta = document.createElement('span');
      etiqueta.className = 'persona-etiqueta';
      etiqueta.textContent = ' (niño/a)';
      leyenda.append(etiqueta);
    }
    tarjeta.append(leyenda);

    // Texto según si responde por sí mismo o por un niño
    const opciones = persona.esNino
      ? [['si', 'Asistirá'], ['no', 'No podrá ir']]
      : [['si', 'Asistiré'], ['no', 'No podré ir']];

    opciones.forEach(([valor, texto]) => {
      const label = document.createElement('label');
      label.className = 'persona-opcion';

      const radio = document.createElement('input');
      radio.type = 'radio';
      radio.name = `respuesta-${persona.id}`;
      radio.value = valor;
      radio.required = true;
      radio.checked = persona.respuesta === valor;   // marca la respuesta anterior

      label.append(radio, ` ${texto}`);
      tarjeta.append(label);
    });

    return tarjeta;
  }

  // Lista de solo lectura para cuando ya cerró el periodo
  function dibujarResumen(personas) {
    const lista = document.getElementById('confirmar-respuestas-finales');
    lista.innerHTML = '';
    personas.forEach((p) => {
      const item = document.createElement('li');
      const textos = { si: 'Asiste', no: 'No asiste' };
      item.textContent = `${p.nombre}: ${textos[p.respuesta] || 'Sin respuesta'}`;
      lista.append(item);
    });
  }

  // --- Programa principal ---

  // URLSearchParams lee lo que viene después del "?" en el enlace
  const codigo = new URLSearchParams(window.location.search).get('c');

  if (!codigo) {
    mostrarEstado('sinCodigo');
    return;
  }

  obtenerInvitacion(codigo).catch(() => null).then((datos) => {
    if (!datos) {                         // código inexistente o mal escrito
      mostrarEstado('sinCodigo');
      return;
    }

    const fechaLimite = new Date(datos.fechaLimite);

    if (datos.cerrado) {                  // el servidor dice que ya pasó la fecha límite
      dibujarResumen(datos.personas);
      mostrarEstado('cerrado');
      return;
    }

    // Saludo: la primera persona es el adulto dueño del enlace
    document.getElementById('confirmar-nombre').textContent = datos.personas[0].nombre;

    const elFecha = document.getElementById('confirmar-fecha-limite');
    elFecha.textContent = formatearFecha(fechaLimite);
    elFecha.dateTime = datos.fechaLimite;

    // Quitamos las tarjetas de ejemplo del HTML y ponemos las reales
    formulario.querySelectorAll('.persona').forEach((t) => t.remove());
    datos.personas.forEach((persona) => {
      formulario.insertBefore(crearTarjeta(persona), botonEnviar);
    });

    // Si ya había respondido antes, el botón lo indica
    if (datos.personas.some((p) => p.respuesta)) {
      botonEnviar.textContent = 'Actualizar respuesta';
    }

    mostrarEstado('personal');

    formulario.addEventListener('submit', (evento) => {
      evento.preventDefault();

      // Juntamos las respuestas: { 12: 'si', 13: 'no' }
      const respuestas = {};
      datos.personas.forEach((p) => {
        const marcado = formulario.querySelector(`input[name="respuesta-${p.id}"]:checked`);
        respuestas[p.id] = marcado.value;
      });

      botonEnviar.disabled = true;        // evita doble envío
      botonEnviar.textContent = 'Enviando…';

      enviarRespuestas(codigo, respuestas)
        .then(() => mostrarEstado('gracias'))
        .catch((error) => {
          if (error.status === 403) {       // se cerró mientras tenía la página abierta
            dibujarResumen(datos.personas);
            mostrarEstado('cerrado');
            return;
          }
          alert(`No pudimos guardar tu respuesta: ${error.message}. Intenta de nuevo.`);
          botonEnviar.disabled = false;
          botonEnviar.textContent = 'Enviar respuesta';
        });
    });
  });
}

iniciarConfirmar();