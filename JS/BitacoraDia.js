import { db, auth } from "./Conexion.js"; // Añadido 'auth'
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc, // Añadido para leer perfil del admin
  updateDoc,
  Timestamp,
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js"; // Añadido el "gatillo" seguro

const tbody = document.querySelector("tbody");

// === 1. CARGAR Y MOSTRAR DATOS (FILTRADOS POR CATEGORÍA) ===
async function cargarAsistenciasHoy() {
  if (!tbody) return;
  tbody.innerHTML =
    "<tr><td colspan='6' style='text-align:center;'>Cargando asistencias de hoy...</td></tr>";

  // Verificamos quién inició sesión
  const usuarioActual = auth.currentUser;
  if (!usuarioActual) {
    tbody.innerHTML =
      "<tr><td colspan='6' style='text-align:center;'>No hay sesión activa.</td></tr>";
    return;
  }

  try {
    // PASO A: Obtener la categoría del administrador actual
    const adminRef = doc(db, "usuarios", usuarioActual.uid);
    const adminSnap = await getDoc(adminRef);

    let categoriaAdmin = "General";
    if (adminSnap.exists() && adminSnap.data().categoria) {
      categoriaAdmin = adminSnap.data().categoria;
    }

    // PASO B: Averiguar quiénes son los entrenadores permitidos para esta categoría
    let qUsuarios;
    if (categoriaAdmin === "General") {
      qUsuarios = query(
        collection(db, "usuarios"),
        where("rol", "==", "entrenador"),
      );
    } else {
      qUsuarios = query(
        collection(db, "usuarios"),
        where("rol", "==", "entrenador"),
        where("categoria", "==", categoriaAdmin),
      );
    }

    const usuariosSnap = await getDocs(qUsuarios);

    // Guardamos las credenciales (ID y Nombre) de los entrenadores que sí podemos ver
    const entrenadoresPermitidosIds = new Set();
    const entrenadoresPermitidosNombres = new Set();

    usuariosSnap.forEach((u) => {
      entrenadoresPermitidosIds.add(u.id);
      if (u.data().nombre) entrenadoresPermitidosNombres.add(u.data().nombre);
    });

    // PASO C: Buscar todas las asistencias del día de hoy
    const fechaHoy = new Date().toLocaleDateString("es-MX");
    const qAsistencias = query(
      collection(db, "asistencias"),
      where("fecha", "==", fechaHoy),
    );

    const querySnapshot = await getDocs(qAsistencias);
    tbody.innerHTML = "";

    let registrosMostrados = 0; // Contador para saber si hubo resultados válidos

    // PASO D: Dibujar solo las asistencias que hagan "match" con nuestros entrenadores
    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      const idDoc = docSnap.id;

      // Verificamos si la asistencia de esta fila le pertenece a un entrenador de nuestro deporte
      const esEntrenadorValido =
        entrenadoresPermitidosIds.has(data.id_usuario) ||
        entrenadoresPermitidosNombres.has(data.nombre);

      if (esEntrenadorValido) {
        registrosMostrados++;

        let entradaTxt = "--:-- --";
        if (data.horaEntrada) {
          entradaTxt = data.horaEntrada
            .toDate()
            .toLocaleTimeString("en-US", {
              hour: "2-digit",
              minute: "2-digit",
            });
        }

        let salidaTxt = "--:-- --";
        if (data.horaSalida) {
          salidaTxt = data.horaSalida
            .toDate()
            .toLocaleTimeString("en-US", {
              hour: "2-digit",
              minute: "2-digit",
            });
        }

        let badgeClass = "badge";
        let badgeStyle = "";

        if (data.estatus === "Falta") {
          badgeClass = "badge warning";
          badgeStyle = "background: #ffe8e8; color: #ff1909;";
        } else if (
          data.estatus === "Ausente" ||
          data.estatus === "Justificado"
        ) {
          badgeClass = "badge warning";
          badgeStyle = "background: #fff8e8; color: #c0992f;";
        }

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
      }
    });

    if (registrosMostrados === 0) {
      tbody.innerHTML =
        "<tr><td colspan='6' style='text-align:center;'>No hay registros de asistencia en tu categoría para el día de hoy.</td></tr>";
    }

    // Reactivar los botones de edición para las filas recién creadas
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

  let nuevoMotivo = "";

  if (nuevoEstatus.trim().toLowerCase() === "justificado") {
    nuevoMotivo = prompt(
      `Has cambiado el estatus a "Justificado".\nPor favor, escribe el motivo o descripción detallada:`,
    );
    if (nuevoMotivo === null) return;
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

    if (nuevoMotivo.trim() !== "") {
      actualizaciones.motivo = nuevoMotivo.trim();
    } else if (nuevoEstatus.trim().toLowerCase() !== "justificado") {
      actualizaciones.motivo = "";
    }
  }

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
      cargarAsistenciasHoy(); // Recarga la tabla con los filtros aplicados
    } catch (error) {
      console.error("Error al actualizar el registro:", error);
      alert("Hubo un problema al intentar guardar los cambios.");
    }
  }
}

// === 3. INICIALIZACIÓN SEGURA ===
onAuthStateChanged(auth, (user) => {
  if (user) {
    cargarAsistenciasHoy();
  } else {
    // Si no hay usuario logueado, lo mandamos al login
    window.location.href = "login.html";
  }
});
