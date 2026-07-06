import { db, auth } from "./Conexion.js";
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  query,
  where,
  getDoc,
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";
import {
  sendPasswordResetEmail,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";

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

// 1. Obtener datos de Firestore (Modificada para no requerir parámetros y evitar errores al actualizar)
async function cargarUsuarios() {
  if (!tabla) return;
  tabla.innerHTML = "<tr><td colspan='5'>Cargando usuarios...</td></tr>";

  // Obtenemos al usuario que inició sesión directamente de auth
  const usuarioActual = auth.currentUser;

  if (!usuarioActual) {
    tabla.innerHTML = "<tr><td colspan='5'>No hay sesión activa.</td></tr>";
    return;
  }

  try {
    // Buscamos el "expediente" del administrador que inició sesión
    const adminRef = doc(db, "usuarios", usuarioActual.uid);
    const adminSnap = await getDoc(adminRef);

    // Asignamos 'General' por si el usuario es antiguo y no tiene categoría
    let categoriaAdmin = "General";

    if (adminSnap.exists()) {
      const datosAdmin = adminSnap.data();
      if (datosAdmin.categoria) {
        categoriaAdmin = datosAdmin.categoria;
      }
    }

    // Preparamos la consulta (query) dependiendo de su categoría
    let q;
    if (categoriaAdmin === "General") {
      // Si es General, solicitamos toda la colección a Firebase
      q = query(collection(db, "usuarios"));
    } else {
      // Si es de un deporte, filtramos SOLO por categoría en Firebase
      q = query(
        collection(db, "usuarios"),
        where("categoria", "==", categoriaAdmin),
      );
    }

    // Ejecutamos la consulta
    const querySnapshot = await getDocs(q);
    todosLosUsuarios = []; // Vaciamos el arreglo

    querySnapshot.forEach((documento) => {
      const data = documento.data();

      // Filtramos el estatus "Eliminado" en JavaScript
      if (data.estatus !== "Eliminado") {
        todosLosUsuarios.push({
          id: documento.id,
          ...data,
        });
      }
    });

    renderizarTabla();
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

  const textoBusqueda = inputBusqueda ? inputBusqueda.value.toLowerCase() : "";
  const rolSeleccionado = selectRol ? selectRol.value.toLowerCase() : "todos";

  const usuariosFiltrados = todosLosUsuarios.filter((user) => {
    const nombreValido = user.nombre
      ? user.nombre.toLowerCase().includes(textoBusqueda)
      : false;

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

  usuariosFiltrados.forEach((user) => {
    const estatusActual = user.estatus || "Activo";
    const rolTecnico = user.rol;
    let rolVisual = rolTecnico;

    if (rolTecnico === "entrenador") {
      rolVisual = "Entrenador (a)";
    } else if (rolTecnico === "admin") {
      rolVisual = "Usuario";
    }

    const fila = document.createElement("tr");

    fila.innerHTML = `
      <td>${user.nombre}</td>
      <td>${user.correo}</td>
      <td>${rolVisual}</td> 
      <td><span class="badge ${estatusActual.toLowerCase()}">${estatusActual}</span></td>
      <td>
          <button class="btn btn-gestionar" data-id="${user.id}" data-nombre="${user.nombre}" data-correo="${user.correo}" data-estatus="${estatusActual}">
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
}

// 3. Listeners de búsqueda dinámica
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
      cargarUsuarios(); // Ahora funciona correctamente sin generar errores
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
      cargarUsuarios(); // Ahora funciona correctamente sin generar errores
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

// 4. Inicialización (Gatillo principal)
onAuthStateChanged(auth, (user) => {
  if (user) {
    cargarUsuarios();
  } else {
    // Si no hay usuario logueado, lo mandamos al login
    window.location.href = "login.html";
  }
});
