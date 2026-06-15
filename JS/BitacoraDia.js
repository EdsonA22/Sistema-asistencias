import { db } from "./Conexion.js";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  updateDoc,
  Timestamp,
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

// Referencia al cuerpo de la tabla en tu aTabla.html
const tbody = document.querySelector("tbody");

// Función principal para obtener y mostrar los datos
async function cargarAsistenciasHoy() {
  // 1. Mostrar mensaje de carga
  tbody.innerHTML =
    "<tr><td colspan='5' style='text-align:center;'>Cargando asistencias de hoy...</td></tr>";

  // 2. Obtener la fecha de hoy en el mismo formato que usa tu QRScanner.js (es-MX)
  const fechaHoy = new Date().toLocaleDateString("es-MX");

  // 3. Crear la consulta (query) para buscar solo los registros de HOY
  const q = query(
    collection(db, "asistencias"),
    where("fecha", "==", fechaHoy),
  );

  try {
    const querySnapshot = await getDocs(q);

    // Limpiamos la tabla de ejemplos
    tbody.innerHTML = "";

    if (querySnapshot.empty) {
      tbody.innerHTML =
        "<tr><td colspan='5' style='text-align:center;'>No hay registros de asistencia para el día de hoy.</td></tr>";
      return;
    }

    // 4. Recorrer cada documento encontrado en Firebase
    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      const idDoc = docSnap.id; // ID único del registro para poder editarlo después

      // Formatear Hora de Entrada
      let entradaTxt = "--:-- --";
      if (data.horaEntrada) {
        // Convertimos el Timestamp de Firebase a fecha de JavaScript y luego a formato texto (Ej: 03:30 PM)
        entradaTxt = data.horaEntrada
          .toDate()
          .toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
      }

      // Formatear Hora de Salida
      let salidaTxt = "--:-- --";
      if (data.horaSalida) {
        salidaTxt = data.horaSalida
          .toDate()
          .toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
      }

      // Definir los colores de la "placa" (badge) dependiendo del estatus
      let badgeClass = "badge";
      let badgeStyle = "";

      if (data.estatus === "Falta") {
        badgeClass = "badge warning";
        badgeStyle = "background: #ffe8e8; color: #ff1909;";
      } else if (data.estatus === "Ausente" || data.estatus === "Justificado") {
        badgeClass = "badge warning";
        badgeStyle = "background: #fff8e8; color: #c0992f;";
      }

      // 5. Crear la fila (tr) de la tabla y llenarla con HTML
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${data.nombre}</td>
        <td>${entradaTxt}</td>
        <td>${salidaTxt}</td>
        <td><span class="${badgeClass}" style="${badgeStyle}">${data.estatus}</span></td>
        <td>
          <button class="secondary-btn btn-editar" 
                  data-id="${idDoc}" 
                  data-nombre="${data.nombre}" 
                  data-estatus="${data.estatus}">
            <i class="bx bx-edit"></i>
          </button>
        </td>
      `;

      tbody.appendChild(tr);
    });

    // 6. Asignar el evento "click" a todos los nuevos botones de editar
    document.querySelectorAll(".btn-editar").forEach((btn) => {
      btn.addEventListener("click", manejarEdicion);
    });
  } catch (error) {
    console.error("Error al obtener las asistencias:", error);
    tbody.innerHTML =
      "<tr><td colspan='5' style='text-align:center;'>Ocurrió un error al cargar los datos.</td></tr>";
  }
}

// Función para manejar la edición cuando el admin da clic en el botón
async function manejarEdicion(e) {
  // Extraemos los datos ocultos en el botón que fue presionado
  const btn = e.currentTarget;
  const idDoc = btn.getAttribute("data-id");
  const nombre = btn.getAttribute("data-nombre");
  const estatusActual = btn.getAttribute("data-estatus");

  // Usamos prompt() para pedir datos al administrador de forma sencilla
  const nuevoEstatus = prompt(
    `Editando asistencia de: ${nombre}\n\nEstatus actual: ${estatusActual}\nEscribe el nuevo estatus (Ej: Presente, Falta, Retardo, Justificado):`,
    estatusActual,
  );
  if (nuevoEstatus === null) return; // Si el admin cancela, detenemos el proceso

  const nuevaEntrada = prompt(
    `Escribe la nueva hora de ENTRADA en formato militar de 24 hrs (Ej: 15:30).\nDeja en blanco si no deseas cambiarla:`,
  );
  if (nuevaEntrada === null) return;

  const nuevaSalida = prompt(
    `Escribe la nueva hora de SALIDA en formato militar de 24 hrs (Ej: 17:00).\nDeja en blanco si no deseas cambiarla:`,
  );
  if (nuevaSalida === null) return;

  // Objeto donde guardaremos únicamente lo que el admin decidió cambiar
  let actualizaciones = {};

  if (nuevoEstatus.trim() !== "") {
    actualizaciones.estatus = nuevoEstatus.trim();
  }

  // Lógica para convertir un texto "15:30" a un objeto Timestamp válido para Firebase
  const fechaHoyStr = new Date().toLocaleDateString("en-US"); // Tomamos la fecha base de hoy

  if (nuevaEntrada.trim() !== "") {
    const [horas, minutos] = nuevaEntrada.split(":");
    const fechaObjEntrada = new Date();
    fechaObjEntrada.setHours(parseInt(horas), parseInt(minutos), 0);
    actualizaciones.horaEntrada = Timestamp.fromDate(fechaObjEntrada);
  }

  if (nuevaSalida.trim() !== "") {
    const [horas, minutos] = nuevaSalida.split(":");
    const fechaObjSalida = new Date();
    fechaObjSalida.setHours(parseInt(horas), parseInt(minutos), 0);
    actualizaciones.horaSalida = Timestamp.fromDate(fechaObjSalida);
  }

  // Si hay cambios por enviar, procedemos con Firebase
  if (Object.keys(actualizaciones).length > 0) {
    try {
      const docRef = doc(db, "asistencias", idDoc);
      await updateDoc(docRef, actualizaciones);
      alert("¡Registro actualizado correctamente!");

      // Volvemos a cargar la tabla para reflejar los cambios visualmente
      cargarAsistenciasHoy();
    } catch (error) {
      console.error("Error al actualizar el registro:", error);
      alert("Hubo un problema al intentar guardar los cambios.");
    }
  }
}

// Iniciar la carga de datos en cuanto el script sea leído por el navegador
cargarAsistenciasHoy();
