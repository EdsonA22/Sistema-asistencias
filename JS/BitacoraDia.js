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

const tbody = document.querySelector("tbody");

// === 1. CARGAR Y MOSTRAR DATOS ===
async function cargarAsistenciasHoy() {
  tbody.innerHTML =
    "<tr><td colspan='6' style='text-align:center;'>Cargando asistencias de hoy...</td></tr>";

  const fechaHoy = new Date().toLocaleDateString("es-MX");
  const q = query(
    collection(db, "asistencias"),
    where("fecha", "==", fechaHoy),
  );

  try {
    const querySnapshot = await getDocs(q);
    tbody.innerHTML = "";

    if (querySnapshot.empty) {
      tbody.innerHTML =
        "<tr><td colspan='6' style='text-align:center;'>No hay registros de asistencia para el día de hoy.</td></tr>";
      return;
    }

    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      const idDoc = docSnap.id;

      let entradaTxt = "--:-- --";
      if (data.horaEntrada) {
        entradaTxt = data.horaEntrada
          .toDate()
          .toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
      }

      let salidaTxt = "--:-- --";
      if (data.horaSalida) {
        salidaTxt = data.horaSalida
          .toDate()
          .toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
      }

      let badgeClass = "badge";
      let badgeStyle = "";

      if (data.estatus === "Falta") {
        badgeClass = "badge warning";
        badgeStyle = "background: #ffe8e8; color: #ff1909;";
      } else if (data.estatus === "Ausente" || data.estatus === "Justificado") {
        badgeClass = "badge warning";
        badgeStyle = "background: #fff8e8; color: #c0992f;";
      }

      // Validamos si existe un motivo guardado en la base de datos
      // Si no existe, mostramos un guion medio "-" por estética visual
      const motivoTxt = data.motivo ? data.motivo : "-";

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${data.nombre}</td>
        <td>${entradaTxt}</td>
        <td>${salidaTxt}</td>
        <td><span class="${badgeClass}" style="${badgeStyle}">${data.estatus}</span></td>
        <td style="font-size: 12px; color: #555; max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${motivoTxt}">
          ${motivoTxt}
        </td>
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

    document.querySelectorAll(".btn-editar").forEach((btn) => {
      btn.addEventListener("click", manejarEdicion);
    });
  } catch (error) {
    console.error("Error al obtener las asistencias:", error);
    tbody.innerHTML =
      "<tr><td colspan='6' style='text-align:center;'>Ocurrió un error al cargar los datos.</td></tr>";
  }
}

// === 2. MANEJAR LA EDICIÓN Y JUSTIFICACIÓN ===
async function manejarEdicion(e) {
  const btn = e.currentTarget;
  const idDoc = btn.getAttribute("data-id");
  const nombre = btn.getAttribute("data-nombre");
  const estatusActual = btn.getAttribute("data-estatus");

  const nuevoEstatus = prompt(
    `Editando asistencia de: ${nombre}\n\nEstatus actual: ${estatusActual}\nEscribe el nuevo estatus (Ej: Presente, Falta, Justificado):`,
    estatusActual,
  );
  if (nuevoEstatus === null) return;

  // Variable para almacenar el motivo de la justificación
  let nuevoMotivo = "";

  // Verificamos si el usuario escribió la palabra "Justificado"
  // .toLowerCase() asegura que funcione aunque el admin escriba "justificado", "JUSTIFICADO", etc.
  if (nuevoEstatus.trim().toLowerCase() === "justificado") {
    nuevoMotivo = prompt(
      `Has cambiado el estatus a "Justificado".\nPor favor, escribe el motivo o descripción detallada:`,
    );
    if (nuevoMotivo === null) return; // Si cancela este cuadro, se detiene todo el proceso
  }

  const nuevaEntrada = prompt(
    `Escribe la nueva hora de ENTRADA en formato militar de 24 hrs (Ej: 15:30).\nDeja en blanco si no deseas cambiarla:`,
  );
  if (nuevaEntrada === null) return;

  const nuevaSalida = prompt(
    `Escribe la nueva hora de SALIDA en formato militar de 24 hrs (Ej: 17:00).\nDeja en blanco si no deseas cambiarla:`,
  );
  if (nuevaSalida === null) return;

  let actualizaciones = {};

  if (nuevoEstatus.trim() !== "") {
    actualizaciones.estatus = nuevoEstatus.trim();

    // Si escribió un motivo, lo agregamos al paquete de actualización de Firebase
    if (nuevoMotivo.trim() !== "") {
      actualizaciones.motivo = nuevoMotivo.trim();
    }
    // Si cambia el estatus a otra cosa (como "Presente"), borramos el motivo anterior para evitar inconsistencias
    else if (nuevoEstatus.trim().toLowerCase() !== "justificado") {
      actualizaciones.motivo = "";
    }
  }

  const fechaHoyStr = new Date().toLocaleDateString("en-US");

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

  if (Object.keys(actualizaciones).length > 0) {
    try {
      const docRef = doc(db, "asistencias", idDoc);
      await updateDoc(docRef, actualizaciones);
      alert("¡Registro actualizado correctamente!");
      cargarAsistenciasHoy();
    } catch (error) {
      console.error("Error al actualizar el registro:", error);
      alert("Hubo un problema al intentar guardar los cambios.");
    }
  }
}

cargarAsistenciasHoy();
