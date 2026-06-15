import { db, auth } from "./Conexion.js";
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  query,
  where,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";

const tabla = document.getElementById("tablaEntrenadores");
const modal = document.getElementById("modalGestion");

// Elementos del Modal
const modalNombre = document.getElementById("modalNombre");
const modalCorreo = document.getElementById("modalCorreo");
const modalEstatus = document.getElementById("modalEstatus");
const btnEnviarContrasena = document.getElementById("btnEnviarContrasena");
const btnGuardarCambios = document.getElementById("btnGuardarCambios");
const btnEliminarLogico = document.getElementById("btnEliminarLogico");
const btnCerrarModal = document.getElementById("btnCerrarModal");

let usuarioSeleccionadoId = null;
let usuarioSeleccionadoEmail = null;

// 1. Cargar usuarios desde Firestore (filtrando los que no estén eliminados)
async function cargarUsuarios() {
  tabla.innerHTML = "<tr><td colspan='6'>Cargando usuarios...</td></tr>";

  try {
    // Consulta para omitir usuarios con estatus 'Eliminado'
    const q = query(
      collection(db, "usuarios"),
      where("estatus", "!=", "Eliminado"),
    );
    const querySnapshot = await getDocs(q);

    tabla.innerHTML = ""; // Limpiar tabla

    if (querySnapshot.empty) {
      tabla.innerHTML =
        "<tr><td colspan='6'>No hay usuarios registrados.</td></tr>";
      return;
    }

    querySnapshot.forEach((documento) => {
      const user = documento.data();
      const id = documento.id;

      // Si por alguna razón un usuario antiguo no tiene el campo estatus, por defecto es Activo
      const estatusActual = user.estatus || "Activo";

      const fila = document.createElement("tr");
      fila.innerHTML = `
                <td>${user.nombre}</td>
                <td>${user.matricula}</td>
                <td>${user.correo}</td>
                <td>${user.rol}</td>
                <td><span class="badge ${estatusActual.toLowerCase()}">${estatusActual}</span></td>
                <td>
                    <button class="btn btn-gestionar" data-id="${id}" data-nombre="${user.nombre}" data-correo="${user.correo}" data-estatus="${estatusActual}">
                        Gestionar
                    </button>
                </td>
            `;
      tabla.appendChild(fila);
    });

    // Asignar eventos a los botones de Gestionar generados
    document.querySelectorAll(".btn-gestionar").forEach((boton) => {
      boton.addEventListener("click", (e) => {
        usuarioSeleccionadoId = e.target.getAttribute("data-id");
        usuarioSeleccionadoEmail = e.target.getAttribute("data-correo");

        modalNombre.textContent = e.target.getAttribute("data-nombre");
        modalCorreo.textContent = usuarioSeleccionadoEmail;
        modalEstatus.value = e.target.getAttribute("data-estatus");

        modal.style.display = "flex"; // Mostrar modal
      });
    });
  } catch (error) {
    console.error("Error al cargar usuarios:", error);
    tabla.innerHTML =
      "<tr><td colspan='6'>Error al cargar los datos.</td></tr>";
  }
}

// 2. Guardar cambios de estatus (Activo / Inactivo)
btnGuardarCambios.addEventListener("click", async () => {
  if (!usuarioSeleccionadoId) return;

  try {
    const userRef = doc(db, "usuarios", usuarioSeleccionadoId);
    await updateDoc(userRef, {
      estatus: modalEstatus.value,
    });

    alert("Estatus actualizado correctamente.");
    modal.style.display = "none";
    cargarUsuarios(); // Recargar tabla
  } catch (error) {
    alert("Error al actualizar: " + error.message);
  }
});

// 3. Enviar correo para restablecer/cambiar contraseña de forma segura
btnEnviarContrasena.addEventListener("click", async () => {
  if (!usuarioSeleccionadoEmail) return;

  try {
    await sendPasswordResetEmail(auth, usuarioSeleccionadoEmail);
    alert(
      `Se ha enviado un correo de seguridad a ${usuarioSeleccionadoEmail} para que genere su nueva contraseña.`,
    );
  } catch (error) {
    alert("Error al enviar el correo de restablecimiento: " + error.message);
  }
});

// 4. Eliminar usuario de forma lógica (Baja del sistema)
btnEliminarLogico.addEventListener("click", async () => {
  if (!usuarioSeleccionadoId) return;

  const confirmar = confirm(
    "¿Estás seguro de que deseas eliminar a este usuario del sistema de asistencias? No aparecerá en las listas activas.",
  );
  if (!confirmar) return;

  try {
    const userRef = doc(db, "usuarios", usuarioSeleccionadoId);
    await updateDoc(userRef, {
      estatus: "Eliminado",
    });

    alert("Usuario eliminado del sistema correctamente.");
    modal.style.display = "none";
    cargarUsuarios();
  } catch (error) {
    alert("Error al eliminar: " + error.message);
  }
});

// Cerrar Modal
btnCerrarModal.addEventListener("click", () => {
  modal.style.display = "none";
});

// Inicializar la carga al abrir la página
document.addEventListener("DOMContentLoaded", cargarUsuarios);
