import { db, auth } from "./Conexion.js";
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  query,
  where,
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";
import { sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";

// Elementos del DOM generales
const tabla = document.getElementById("tablaEntrenadores");
const modal = document.getElementById("modalGestion");

// Elementos del DOM para los filtros
const inputBusqueda = document.getElementById("busquedaNombre");
const selectRol = document.getElementById("rol");

// Elementos del DOM del Modal
const modalNombre = document.getElementById("modalNombre");
const modalCorreo = document.getElementById("modalCorreo");
const modalEstatus = document.getElementById("modalEstatus");
const btnEnviarContrasena = document.getElementById("btnEnviarContrasena");
const btnGuardarCambios = document.getElementById("btnGuardarCambios");
const btnEliminarLogico = document.getElementById("btnEliminarLogico");
const btnCerrarModal = document.getElementById("btnCerrarModal");

let usuarioSeleccionadoId = null;
let usuarioSeleccionadoEmail = null;

// Arreglo local para evitar consultar a Firebase en cada búsqueda
let todosLosUsuarios = [];

// 1. Obtener datos de Firestore (Solo se ejecuta al cargar la página)
async function cargarUsuarios() {
  if (!tabla) return;
  tabla.innerHTML = "<tr><td colspan='5'>Cargando usuarios...</td></tr>";

  try {
    const q = query(
      collection(db, "usuarios"),
      where("estatus", "!=", "Eliminado"),
    );
    const querySnapshot = await getDocs(q);

    todosLosUsuarios = []; // Vaciamos el arreglo por si hay recargas

    querySnapshot.forEach((documento) => {
      todosLosUsuarios.push({
        id: documento.id,
        ...documento.data(),
      });
    });

    renderizarTabla(); // Dibujamos la tabla con todos los datos
  } catch (error) {
    console.error("Error al cargar usuarios:", error);
    tabla.innerHTML =
      "<tr><td colspan='5'>Error al cargar los datos. Revisa la consola.</td></tr>";
  }
}

// 2. Función encargada de dibujar la tabla aplicando los filtros en tiempo real
function renderizarTabla() {
  if (!tabla) return;
  tabla.innerHTML = "";

  // Obtenemos los valores actuales (convertidos a minúsculas para comparaciones exactas)
  const textoBusqueda = inputBusqueda ? inputBusqueda.value.toLowerCase() : "";
  const rolSeleccionado = selectRol ? selectRol.value.toLowerCase() : "todos";

  // Filtramos el arreglo local
  const usuariosFiltrados = todosLosUsuarios.filter((user) => {
    // Verificamos si el nombre incluye lo que el usuario escribe
    const nombreValido = user.nombre
      ? user.nombre.toLowerCase().includes(textoBusqueda)
      : false;

    // Verificamos si coincide el rol (o si está seleccionada la opción "Todos")
    const rolValido =
      rolSeleccionado === "todos" ||
      (user.rol && user.rol.toLowerCase() === rolSeleccionado);

    return nombreValido && rolValido;
  });

  if (usuariosFiltrados.length === 0) {
    tabla.innerHTML =
      "<tr><td colspan='5' style='text-align:center;'>No se encontraron usuarios que coincidan con la búsqueda.</td></tr>";
    return;
  }

  // Iteramos sobre el arreglo ya filtrado y construimos las filas
  usuariosFiltrados.forEach((user) => {
    const estatusActual = user.estatus || "Activo";
    const fila = document.createElement("tr");

    fila.innerHTML = `
      <td>${user.nombre}</td>
      <td>${user.correo}</td>
      <td>${user.rol}</td>
      <td><span class="badge ${estatusActual.toLowerCase()}">${estatusActual}</span></td>
      <td>
          <button class="btn btn-gestionar" data-id="${user.id}" data-nombre="${user.nombre}" data-correo="${user.correo}" data-estatus="${estatusActual}">
              Gestionar
          </button>
      </td>
    `;
    tabla.appendChild(fila);
  });

  // Reasignamos los eventos a los botones de la tabla recién creada
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
}

// 3. Listeners de búsqueda dinámica (Disparan renderizarTabla sin ir a la base de datos)
if (inputBusqueda) {
  inputBusqueda.addEventListener("input", renderizarTabla);
}
if (selectRol) {
  selectRol.addEventListener("change", renderizarTabla);
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
      cargarUsuarios(); // Recargamos para actualizar datos desde el servidor
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
      cargarUsuarios(); // Recargamos para que desaparezca de la tabla
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

// Inicialización
document.addEventListener("DOMContentLoaded", cargarUsuarios);
