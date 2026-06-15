import { db } from "./Conexion.js";
import {
  collection,
  query,
  where,
  getDocs,
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

// Referencias a los elementos de tu HTML
const tbody = document.querySelector("tbody");
// Asumimos que tienes un selector de mes en tu aTablaMens.html con este ID
const inputMes = document.getElementById("mesSeleccionado");

// 1. Mostrar la lista de entrenadores
async function cargarEntrenadores() {
  tbody.innerHTML =
    "<tr><td colspan='2' style='text-align:center;'>Cargando entrenadores...</td></tr>";

  try {
    // Consultamos solo a los usuarios que tengan el rol de "entrenador"
    const q = query(
      collection(db, "usuarios"),
      where("rol", "==", "entrenador"),
    );
    const querySnapshot = await getDocs(q);

    tbody.innerHTML = ""; // Limpiamos la tabla

    if (querySnapshot.empty) {
      tbody.innerHTML =
        "<tr><td colspan='2' style='text-align:center;'>No hay entrenadores registrados en el sistema.</td></tr>";
      return;
    }

    // Dibujamos una fila por cada entrenador encontrado
    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      const idDoc = docSnap.id;

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
    });

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
  // Verificamos que el administrador haya elegido un mes
  if (!inputMes || !inputMes.value) {
    alert("Por favor, selecciona un mes antes de descargar la bitácora.");
    return;
  }

  // El input type="month" devuelve el valor en formato "YYYY-MM" (Ej: "2026-06")
  const [anioSeleccionado, mesSeleccionado] = inputMes.value.split("-");

  const btn = e.currentTarget;
  const idEntrenador = btn.getAttribute("data-id");
  const nombre = btn.getAttribute("data-nombre");

  // Efecto visual de carga en el botón
  const textoOriginal = btn.innerHTML;
  btn.innerHTML = "<i class='bx bx-loader-alt bx-spin'></i> Generando...";
  btn.disabled = true;

  try {
    // Obtenemos TODO el historial de asistencia de este entrenador
    const q = query(
      collection(db, "asistencias"),
      where("id_usuario", "==", idEntrenador),
    );
    const querySnapshot = await getDocs(q);

    // Contadores estadísticos
    let totalAsistencias = 0;
    let totalFaltas = 0;
    let totalRetardos = 0;
    let detalleIncidencias = [];

    // Recorremos los registros para filtrar los del mes elegido
    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      if (!data.fecha) return;

      // Tu archivo QRScanner.js guarda la fecha como "D/M/YYYY" o "DD/MM/YYYY" (Ej: "15/6/2026")
      // Debemos separar esos números para compararlos
      const partesFecha = data.fecha.split("/");
      const diaBD = partesFecha[0];
      const mesBD = partesFecha[1].padStart(2, "0"); // padStart convierte un "6" en "06" para igualar formatos
      const anioBD = partesFecha[2];

      // Verificamos si este registro pertenece al año y mes solicitados
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
          detalleIncidencias.push(`Día ${diaBD},${estatus}`); // Formato CSV
        } else if (estatus === "Retardo") {
          totalRetardos++;
          detalleIncidencias.push(`Día ${diaBD},Retardo`);
        }
      }
    });

    // 3. Construcción del archivo CSV
    // El código "\uFEFF" (Byte Order Mark) le indica a Excel que use codificación UTF-8, previniendo que los acentos salgan rotos.
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
        csvContent += `${incidencia}\n`; // Agregamos "Día 15,Retardo"
      });
    } else {
      csvContent += `Excelente,,Sin faltas ni retardos este mes.\n`;
    }

    // 4. Detonar la descarga automática
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);

    // Nombre del archivo a descargar (Ej: Bitacora_Juan_Perez_06-2026.csv)
    let nombreArchivo = nombre.replace(/ /g, "_"); // Reemplazamos espacios por guiones bajos
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
    // Pase lo que pase, regresamos el botón a la normalidad
    btn.innerHTML = textoOriginal;
    btn.disabled = false;
  }
}

// Ejecutar la función inicial al cargar la página
cargarEntrenadores();

// --- LÓGICA DEL BUSCADOR EN TIEMPO REAL ---
const inputBuscador = document.getElementById("buscadorEntrenadores");

if (inputBuscador) {
  // El evento "input" se dispara cada vez que el usuario escribe o borra una letra
  inputBuscador.addEventListener("input", (e) => {
    // Convertimos el texto buscado a minúsculas para que la búsqueda no sea sensible a mayúsculas
    const terminoBusqueda = e.target.value.toLowerCase();

    // Obtenemos todas las filas (tr) que están actualmente dentro del cuerpo de la tabla
    const filas = tbody.querySelectorAll("tr");

    filas.forEach((fila) => {
      // Obtenemos la primera celda (td) de la fila, que es donde está el nombre del entrenador
      const celdaNombre = fila.querySelector("td");

      // Verificamos que la celda exista y que la fila contenga un botón de descarga
      // (esto evita que el buscador intente ocultar el mensaje de "Cargando..." o "No hay registros")
      if (celdaNombre && fila.querySelector(".btn-descargar")) {
        const nombreEntrenador = celdaNombre.textContent.toLowerCase();

        // Si el nombre del entrenador incluye el texto que estamos buscando, mostramos la fila
        if (nombreEntrenador.includes(terminoBusqueda)) {
          fila.style.display = "";
        } else {
          // Si no coincide, ocultamos la fila por completo
          fila.style.display = "none";
        }
      }
    });
  });
}
