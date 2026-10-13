/**
 * PUBLICADOR DE MENSAJES ASÍNCRONO
 * Demostración de Fetch API, async/await, manipulación avanzada del DOM,
 * gestión de estados, aborto de peticiones por timeout y seguridad XSS.
 */

// -----------------------------------------------------------------------------
// 1. CONSTANTES DE CONFIGURACIÓN Y REFERENCIAS AL DOM
// -----------------------------------------------------------------------------

const CONFIG = {
  API_URL: 'https://jsonplaceholder.typicode.com/posts',
  TIMEOUT_MS: 6000, // Tiempo límite de respuesta (6 segundos)
  MIN_TITLE_LENGTH: 3,
  MIN_BODY_LENGTH: 10
};

// Captura de elementos de entrada del formulario
const postForm = document.getElementById('postForm');
const titleInput = document.getElementById('titleInput');
const bodyInput = document.getElementById('bodyInput');

// Captura de elementos interactivos de la interfaz
const submitBtn = document.getElementById('submitBtn');
const btnText = submitBtn.querySelector('.btn-text');
const btnSpinner = document.getElementById('btnSpinner');
const resetBtn = document.getElementById('resetBtn');

// Elementos para retroalimentación visual y contadores
const titleError = document.getElementById('titleError');
const bodyError = document.getElementById('bodyError');
const titleCounter = document.getElementById('titleCounter');
const bodyCounter = document.getElementById('bodyCounter');
const statusMessage = document.getElementById('statusMessage');

// Elementos del historial dinámico
const postsFeed = document.getElementById('postsFeed');
const postCount = document.getElementById('postCount');
const clearHistoryBtn = document.getElementById('clearHistoryBtn');

// Array local para rastrear las publicaciones realizadas en la sesión
let localPostsHistory = [];


// -----------------------------------------------------------------------------
// 2. INICIALIZACIÓN Y EVENT LISTENERS
// -----------------------------------------------------------------------------

document.addEventListener('DOMContentLoaded', () => {
  // Evento de envío del formulario
  postForm.addEventListener('submit', handleFormSubmit);

  // Contadores de caracteres en tiempo real
  titleInput.addEventListener('input', () => updateCharCounter(titleInput, titleCounter, titleError));
  bodyInput.addEventListener('input', () => updateCharCounter(bodyInput, bodyCounter, bodyError));

  // Botón para reiniciar formulario y alertas
  resetBtn.addEventListener('click', resetFormCompletely);

  // Botón para limpiar el historial local
  clearHistoryBtn.addEventListener('click', clearHistory);
});


// -----------------------------------------------------------------------------
// 3. CONTROLADOR PRINCIPAL DE ENVÍO (HANDLER ASÍNCRONO)
// -----------------------------------------------------------------------------

/**
 * Maneja el evento submit del formulario
 * @param {Event} event Evento nativo del formulario
 */
async function handleFormSubmit(event) {
  // Previene el comportamiento predeterminado del navegador (evita la recarga de la página)
  event.preventDefault();

  // Ocultar mensajes de alerta anteriores
  hideStatus();

  // Validar datos antes de enviar
  const { isValid, title, body } = validateInputs();
  if (!isValid) return;

  // Habilitar indicador de carga e inhabilitar controles
  setFormLoadingState(true);

  // Instancia de AbortController para cancelar la petición si excede el tiempo límite
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), CONFIG.TIMEOUT_MS);

  try {
    // Estructura de datos requerida por el backend/API
    const payload = {
      title: title,
      body: body,
      userId: 1
    };

    // Petición HTTP POST utilizando Fetch API
    const response = await fetch(CONFIG.API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=UTF-8'
      },
      body: JSON.stringify(payload), // Convierte el objeto JavaScript a formato JSON string
      signal: controller.signal       // Asocia el controlador de cancelación por timeout
    });

    // Limpiar el temporizador si la respuesta llegó a tiempo
    clearTimeout(timeoutId);

    // Verificación explícita del estado de la respuesta HTTP (Rango 200-299)
    if (!response.ok) {
      throw new Error(`Error en el servidor. Código HTTP: ${response.status}`);
    }

    // Deserialización de la respuesta recibida a un objeto JavaScript
    const responseData = await response.json();

    // Actualizar interfaz con el éxito
    renderNewPost(responseData);
    showStatus('¡Publicación enviada y procesada exitosamente por la API!', 'success');
    
    // Limpiar los datos ingresados
    resetFormCompletely();

  } catch (error) {
    // Manejo diferenciado según el tipo de error
    if (error.name === 'AbortError') {
      showStatus('La solicitud superó el tiempo máximo de espera. Comprueba tu conexión.', 'error');
    } else if (error instanceof TypeError) {
      showStatus('Error de red: No fue posible conectar con el servidor.', 'error');
    } else {
      showStatus(`Fallo en la operación: ${error.message}`, 'error');
    }
  } finally {
    // Restablece los controles independientemente de si hubo éxito o fallo
    setFormLoadingState(false);
  }
}


// -----------------------------------------------------------------------------
// 4. LÓGICA DE VALIDACIÓN DE DATOS
// -----------------------------------------------------------------------------

/**
 * Valida los campos de entrada eliminando espacios innecesarios
 * @returns {Object} Estado de validación y valores saneados
 */
function validateInputs() {
  let isValid = true;

  // trim() elimina los espacios en blanco al inicio y al final
  const title = titleInput.value.trim();
  const body = bodyInput.value.trim();

  // Validación del campo Título
  if (!title) {
    showInputError(titleError, 'El título no puede estar vacío.');
    isValid = false;
  } else if (title.length < CONFIG.MIN_TITLE_LENGTH) {
    showInputError(titleError, `El título debe tener al menos ${CONFIG.MIN_TITLE_LENGTH} caracteres.`);
    isValid = false;
  } else {
    clearInputError(titleError);
  }

  // Validación del campo Contenido
  if (!body) {
    showInputError(bodyError, 'El contenido del mensaje no puede estar vacío.');
    isValid = false;
  } else if (body.length < CONFIG.MIN_BODY_LENGTH) {
    showInputError(bodyError, `El mensaje debe tener al menos ${CONFIG.MIN_BODY_LENGTH} caracteres.`);
    isValid = false;
  } else {
    clearInputError(bodyError);
  }

  return { isValid, title, body };
}


// -----------------------------------------------------------------------------
// 5. MANIPULACIÓN DEL DOM Y ACTUALIZACIÓN DINÁMICA DE LA INTERFAZ
// -----------------------------------------------------------------------------

/**
 * Agrega un nuevo elemento al historial DOM sin usar innerHTML de forma insegura
 * @param {Object} postData Objeto devuelto por la API
 */
function renderNewPost(postData) {
  // Si es la primera publicación, limpiar el texto por defecto
  if (localPostsHistory.length === 0) {
    postsFeed.innerHTML = '';
    clearHistoryBtn.style.display = 'inline-block';
  }

  // Crear elementos del DOM de forma segura
  const card = document.createElement('article');
  card.className = 'post-card';

  const cardHeader = document.createElement('div');
  cardHeader.className = 'post-card-header';

  const idSpan = document.createElement('span');
  // Uso seguro de textContent para prevenir inyección de código malicioso (XSS)
  idSpan.textContent = `ID Asignado: #${postData.id || 'N/A'}`;

  const timeSpan = document.createElement('span');
  timeSpan.textContent = new Date().toLocaleTimeString();

  cardHeader.appendChild(idSpan);
  cardHeader.appendChild(timeSpan);

  const cardTitle = document.createElement('h3');
  cardTitle.className = 'post-card-title';
  cardTitle.textContent = postData.title;

  const cardBody = document.createElement('p');
  cardBody.className = 'post-card-body';
  cardBody.textContent = postData.body;

  // Ensamblar la estructura de la tarjeta
  card.appendChild(cardHeader);
  card.appendChild(cardTitle);
  card.appendChild(cardBody);

  // Insertar la tarjeta al inicio del contenedor (orden cronológico inverso)
  postsFeed.prepend(card);

  // Guardar en el arreglo local e incrementar contador
  localPostsHistory.push(postData);
  postCount.textContent = localPostsHistory.length;
}

/**
 * Actualiza el contador de caracteres de los inputs
 */
function updateCharCounter(inputElement, counterElement, errorElement) {
  const currentLength = inputElement.value.length;
  counterElement.textContent = currentLength;
  
  if (currentLength > 0) {
    clearInputError(errorElement);
  }
}

/**
 * Controla el estado visual del botón durante el proceso asíncrono
 * @param {boolean} isLoading Indica si la petición está en curso
 */
function setFormLoadingState(isLoading) {
  if (isLoading) {
    submitBtn.disabled = true;
    resetBtn.disabled = true;
    btnText.textContent = 'Enviando petición...';
    btnSpinner.hidden = false;
    showStatus('Enviando datos al servidor, por favor espera...', 'info');
  } else {
    submitBtn.disabled = false;
    resetBtn.disabled = false;
    btnText.textContent = 'Publicar Mensaje';
    btnSpinner.hidden = true;
  }
}

/**
 * Muestra alertas en la pantalla
 * @param {string} message Mensaje a desplegar
 * @param {string} type Categoría de alerta ('info', 'success', 'error')
 */
function showStatus(message, type) {
  statusMessage.textContent = message;
  statusMessage.className = `status-alert ${type}`;
  statusMessage.hidden = false;
}

function hideStatus() {
  statusMessage.hidden = true;
  statusMessage.textContent = '';
}

function showInputError(element, message) {
  element.textContent = message;
}

function clearInputError(element) {
  element.textContent = '';
}

/**
 * Restablece el formulario a su estado original
 */
function resetFormCompletely() {
  postForm.reset();
  titleCounter.textContent = '0';
  bodyCounter.textContent = '0';
  clearInputError(titleError);
  clearInputError(bodyError);
}

/**
 * Limpia el feed de publicaciones locales
 */
function clearHistory() {
  localPostsHistory = [];
  postsFeed.innerHTML = '<p class="empty-feed">No hay publicaciones enviadas en esta sesión.</p>';
  postCount.textContent = '0';
  clearHistoryBtn.style.display = 'none';
}