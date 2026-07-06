import { db, auth } from "./Conexion.js"; // Añadimos auth
import {
  collection,
  query,
  where,
  getDocs,
  getDoc, // Añadimos getDoc para leer perfil del admin
  doc,
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js"; // Añadimos el observador de sesión

// Referencias a los elementos de tu HTML
const tbody = document.querySelector("tbody");
// Asumimos que tienes un selector de mes en tu aTablaMens.html con este ID
const inputMes = document.getElementById("mesSeleccionado");

// 1. Mostrar la lista de entrenadores filtrada por la categoría del administrador
async function cargarEntrenadores() {
  if (!tbody) return;
  tbody.innerHTML =
    "<tr><td colspan='2' style='text-align:center;'>Cargando entrenadores...</td></tr>";

  // Obtenemos al usuario que inició sesión
  const usuarioActual = auth.currentUser;

  if (!usuarioActual) {
    tbody.innerHTML =
      "<tr><td colspan='2' style='text-align:center;'>No hay sesión activa.</td></tr>";
    return;
  }

  try {
    // A. Buscamos el "expediente" del administrador para saber su categoría
    const adminRef = doc(db, "usuarios", usuarioActual.uid);
    const adminSnap = await getDoc(adminRef);

    let categoriaAdmin = "General";

    if (adminSnap.exists()) {
      const datosAdmin = adminSnap.data();
      if (datosAdmin.categoria) {
        categoriaAdmin = datosAdmin.categoria;
      }
    }

    // B. Preparamos la consulta (query) dependiendo de su categoría
    let q;
    if (categoriaAdmin === "General") {
      // Si es General, solicitamos a todos los entrenadores
      q = query(collection(db, "usuarios"), where("rol", "==", "entrenador"));
    } else {
      // Si es de un deporte, filtramos por rol Y por su categoría
      q = query(
        collection(db, "usuarios"),
        where("rol", "==", "entrenador"),
        where("categoria", "==", categoriaAdmin),
      );
    }

    const querySnapshot = await getDocs(q);
    tbody.innerHTML = ""; // Limpiamos la tabla

    let entrenadoresMostrados = 0; // Contador para saber si hubo resultados

    // Dibujamos una fila por cada entrenador encontrado
    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      const idDoc = docSnap.id;

      // Filtramos a los eliminados directamente aquí para evitar errores de Firebase
      if (data.estatus !== "Eliminado") {
        entrenadoresMostrados++;
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${data.nombre}</td>
          <td>
            <button class="secondary-btn btn-descargar" 
                    data-id="${idDoc}" 
                    data-nombre="${data.nombre}">
              <i class="bx bx-download"></i> Descargar Bitácora
            </button>
          </td>
        `;
        tbody.appendChild(tr);
      }
    });

    // Si después de filtrar no quedó nadie
    if (entrenadoresMostrados === 0) {
      tbody.innerHTML =
        "<tr><td colspan='2' style='text-align:center;'>No hay entrenadores registrados en esta categoría.</td></tr>";
      return;
    }

    // Asignar el evento "click" a todos los nuevos botones generados
    document.querySelectorAll(".btn-descargar").forEach((btn) => {
      btn.addEventListener("click", generarYDescargarBitacora);
    });
  } catch (error) {
    console.error("Error al obtener los entrenadores:", error);
    tbody.innerHTML =
      "<tr><td colspan='2' style='text-align:center;'>Error de conexión. Intente más tarde.</td></tr>";
  }
}

// 2. Lógica para generar el archivo mensual
async function generarYDescargarBitacora(e) {
  if (!inputMes || !inputMes.value) {
    alert("Por favor, selecciona un mes antes de descargar la bitácora.");
    return;
  }

  const [anioSeleccionado, mesSeleccionado] = inputMes.value.split("-");

  const btn = e.currentTarget;
  const idEntrenador = btn.getAttribute("data-id");
  const nombre = btn.getAttribute("data-nombre");

  const textoOriginal = btn.innerHTML;
  btn.innerHTML = "<i class='bx bx-loader-alt bx-spin'></i> Generando...";
  btn.disabled = true;

  try {
    const q = query(
      collection(db, "asistencias"),
      where("id_usuario", "==", idEntrenador),
    );
    const querySnapshot = await getDocs(q);

    let totalAsistencias = 0;
    let totalFaltas = 0;
    let totalRetardos = 0;
    let detalleIncidencias = [];

    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      if (!data.fecha) return;

      const partesFecha = data.fecha.split("/");
      const diaBD = partesFecha[0];
      const mesBD = partesFecha[1].padStart(2, "0");
      const anioBD = partesFecha[2];

      if (anioBD === anioSeleccionado && mesBD === mesSeleccionado) {
        const estatus = data.estatus || "Desconocido";

        if (estatus === "Presente") {
          totalAsistencias++;
        } else if (
          estatus === "Falta" ||
          estatus === "Ausente" ||
          estatus === "Justificado"
        ) {
          totalFaltas++;
          detalleIncidencias.push(`Día ${diaBD},${estatus}`);
        } else if (estatus === "Retardo") {
          totalRetardos++;
          detalleIncidencias.push(`Día ${diaBD},Retardo`);
        }
      }
    });

    // 3. Construcción del archivo CSV
    let csvContent = "data:text/csv;charset=utf-8,\uFEFF";

    csvContent += `Reporte Mensual de Asistencia\n\n`;
    csvContent += `Entrenador:,${nombre}\n`;
    csvContent += `Periodo:,${mesSeleccionado}/${anioSeleccionado}\n\n`;

    csvContent += `--- RESUMEN ---\n`;
    csvContent += `Total de Asistencias:,${totalAsistencias}\n`;
    csvContent += `Total de Faltas:,${totalFaltas}\n`;
    csvContent += `Total de Retardos:,${totalRetardos}\n\n`;

    csvContent += `--- DETALLE DE INCIDENCIAS ---\n`;
    if (detalleIncidencias.length > 0) {
      csvContent += `Fecha,Estado\n`;
      detalleIncidencias.forEach((incidencia) => {
        csvContent += `${incidencia}\n`;
      });
    } else {
      csvContent += `Excelente,,Sin faltas ni retardos este mes.\n`;
    }

    // 4. Detonar la descarga automática
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);

    let nombreArchivo = nombre.replace(/ /g, "_");
    link.setAttribute(
      "download",
      `Bitacora_${nombreArchivo}_${mesSeleccionado}-${anioSeleccionado}.csv`,
    );

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (error) {
    console.error("Error al generar reporte:", error);
    alert("Hubo un problema al consultar la base de datos.");
  } finally {
    btn.innerHTML = textoOriginal;
    btn.disabled = false;
  }
}

// --- LÓGICA DEL BUSCADOR EN TIEMPO REAL ---
const inputBuscador = document.getElementById("buscadorEntrenadores");

if (inputBuscador) {
  inputBuscador.addEventListener("input", (e) => {
    const terminoBusqueda = e.target.value.toLowerCase();
    const filas = tbody.querySelectorAll("tr");

    filas.forEach((fila) => {
      const celdaNombre = fila.querySelector("td");
      if (celdaNombre && fila.querySelector(".btn-descargar")) {
        const nombreEntrenador = celdaNombre.textContent.toLowerCase();
        if (nombreEntrenador.includes(terminoBusqueda)) {
          fila.style.display = "";
        } else {
          fila.style.display = "none";
        }
      }
    });
  });
}

// 5. Inicialización Segura (Gatillo principal)
onAuthStateChanged(auth, (user) => {
  if (user) {
    cargarEntrenadores();
  } else {
    window.location.href = "login.html";
  }
});
