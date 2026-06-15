// 1. Importación correcta de tu conexión local con la extensión .js
import { db, auth } from "./Conexion.js";

// 2. Importaciones de Firestore y Auth utilizando exactamente el mismo CDN (v10.8.1)
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  query,
  where,
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

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

// Cargar usuarios desde Firestore
async function cargarUsuarios() {
  if (!tabla) return;

  tabla.innerHTML = "<tr><td colspan='5'>Cargando usuarios...</td></tr>";

  try {
    const q = query(
      collection(db, "usuarios"),
      where("estatus", "!=", "Eliminado"),
    );
    const querySnapshot = await getDocs(q);

    tabla.innerHTML = "";

    if (querySnapshot.empty) {
      tabla.innerHTML =
        "<tr><td colspan='5'>No hay usuarios registrados en el sistema.</td></tr>";
      return;
    }

    querySnapshot.forEach((documento) => {
      const user = documento.data();
      const id = documento.id;

      const estatusActual = user.estatus || "Activo";

      const fila = document.createElement("tr");
      // Se ha eliminado la línea de la matrícula para reflejar tus cambios
      fila.innerHTML = `
                <td>${user.nombre}</td>
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

    document.querySelectorAll(".btn-gestionar").forEach((boton) => {
      boton.addEventListener("click", (e) => {
        usuarioSeleccionadoId = e.target.getAttribute("data-id");
        usuarioSeleccionadoEmail = e.target.getAttribute("data-correo");

        modalNombre.textContent = e.target.getAttribute("data-nombre");
        modalCorreo.textContent = usuarioSeleccionadoEmail;
        modalEstatus.value = e.target.getAttribute("data-estatus");

        if (modal) modal.style.display = "flex";
      });
    });
  } catch (error) {
    console.error("Error al cargar usuarios:", error);
    tabla.innerHTML =
      "<tr><td colspan='5'>Error al cargar los datos. Revisa la consola.</td></tr>";
  }
}

// Guardar cambios de estatus
if (btnGuardarCambios) {
  btnGuardarCambios.addEventListener("click", async () => {
    if (!usuarioSeleccionadoId) return;

    try {
      const userRef = doc(db, "usuarios", usuarioSeleccionadoId);
      await updateDoc(userRef, {
        estatus: modalEstatus.value,
      });

      alert("Estatus actualizado correctamente.");
      modal.style.display = "none";
      cargarUsuarios();
    } catch (error) {
      alert("Error al actualizar: " + error.message);
    }
  });
}

// Enviar correo de nueva contraseña
if (btnEnviarContrasena) {
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
}

// Eliminar usuario
if (btnEliminarLogico) {
  btnEliminarLogico.addEventListener("click", async () => {
    if (!usuarioSeleccionadoId) return;

    const confirmar = confirm(
      "¿Estás seguro de que deseas eliminar a este usuario del sistema? No aparecerá en las listas activas ni podrá iniciar sesión.",
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
}

if (btnCerrarModal) {
  btnCerrarModal.addEventListener("click", () => {
    modal.style.display = "none";
  });
}

document.addEventListener("DOMContentLoaded", cargarUsuarios);
