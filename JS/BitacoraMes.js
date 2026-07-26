import { db, auth } from "./Conexion.js";
import {
  collection,
  query,
  where,
  getDocs,
  getDoc,
  doc,
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";

// Referencias a los elementos de tu HTML
const tbody = document.querySelector("tbody");
const inputMes = document.getElementById("mesSeleccionado");

// === 1. CARGAR ENTRENADORES FILTRADOS ===
async function cargarEntrenadores() {
  if (!tbody) return;
  tbody.innerHTML =
    "<tr><td colspan='2' style='text-align:center;'>Cargando entrenadores...</td></tr>";

  const usuarioActual = auth.currentUser;
  if (!usuarioActual) {
    tbody.innerHTML =
      "<tr><td colspan='2' style='text-align:center;'>No hay sesión activa.</td></tr>";
    return;
  }

  try {
    const adminRef = doc(db, "usuarios", usuarioActual.uid);
    const adminSnap = await getDoc(adminRef);

    let categoriaAdmin = "General";
    if (adminSnap.exists() && adminSnap.data().categoria) {
      categoriaAdmin = adminSnap.data().categoria;
    }

    let q;
    if (categoriaAdmin === "General") {
      q = query(collection(db, "usuarios"), where("rol", "==", "entrenador"));
    } else {
      q = query(
        collection(db, "usuarios"),
        where("rol", "==", "entrenador"),
        where("categoria", "==", categoriaAdmin),
      );
    }

    const querySnapshot = await getDocs(q);
    tbody.innerHTML = "";

    let entrenadoresMostrados = 0;

    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      const idDoc = docSnap.id;

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

    if (entrenadoresMostrados === 0) {
      tbody.innerHTML =
        "<tr><td colspan='2' style='text-align:center;'>No hay entrenadores registrados en esta categoría.</td></tr>";
      return;
    }

    document.querySelectorAll(".btn-descargar").forEach((btn) => {
      btn.addEventListener("click", generarYDescargarBitacora);
    });
  } catch (error) {
    console.error("Error al obtener los entrenadores:", error);
    tbody.innerHTML =
      "<tr><td colspan='2' style='text-align:center;'>Error de conexión. Intente más tarde.</td></tr>";
  }
}

// === 2. LÓGICA ANALÍTICA PARA GENERAR REPORTE ===
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

    // Mapeamos (organizamos) los registros obtenidos por número de día
    const registrosPorDia = new Map();

    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      if (!data.fecha) return;

      const partesFecha = data.fecha.split("/");
      const diaBD = parseInt(partesFecha[0]);
      const mesBD = partesFecha[1].padStart(2, "0");
      const anioBD = partesFecha[2];

      if (anioBD === anioSeleccionado && mesBD === mesSeleccionado) {
        registrosPorDia.set(diaBD, data.estatus || "Desconocido");
      }
    });

    let totalAsistencias = 0;
    let totalFaltas = 0;
    let totalRetardos = 0;
    let detalleIncidencias = [];

    // Calcular el límite de días a evaluar en el mes
    const hoy = new Date();
    let limiteDias;

    if (
      hoy.getFullYear() === parseInt(anioSeleccionado) &&
      hoy.getMonth() + 1 === parseInt(mesSeleccionado)
    ) {
      // Si el mes seleccionado es el actual, solo evaluamos hasta el día de hoy
      limiteDias = hoy.getDate();
    } else {
      // Si es un mes pasado, obtenemos cuántos días tiene ese mes
      limiteDias = new Date(
        parseInt(anioSeleccionado),
        parseInt(mesSeleccionado),
        0,
      ).getDate();
    }

    // Análisis día por día
    for (let dia = 1; dia <= limiteDias; dia++) {
      // Determinar qué día de la semana es (0 = Domingo, 1 = Lunes, etc.)
      const fechaEvaluada = new Date(
        parseInt(anioSeleccionado),
        parseInt(mesSeleccionado) - 1,
        dia,
      );
      const diaSemana = fechaEvaluada.getDay();

      // EXCLUSIÓN DE DÍAS DE DESCANSO (0 es Domingo, si descansan sábados agrega: || diaSemana === 6)
      if (diaSemana === 0) continue;

      const diaFormateado = dia.toString().padStart(2, "0");

      if (registrosPorDia.has(dia)) {
        // Sí hubo un registro en Firebase para este día
        const estatus = registrosPorDia.get(dia);

        if (estatus === "Presente") {
          totalAsistencias++;
        } else if (
          estatus === "Falta" ||
          estatus === "Ausente" ||
          estatus === "Justificado"
        ) {
          totalFaltas++;
          detalleIncidencias.push(`Día ${diaFormateado},${estatus}`);
        } else if (estatus === "Retardo") {
          totalRetardos++;
          detalleIncidencias.push(`Día ${diaFormateado},Retardo`);
        }
      } else {
        // NO hubo registro en Firebase, lo detectamos como FALTA AUTOMÁTICA
        totalFaltas++;
        detalleIncidencias.push(`Día ${diaFormateado},Falta (No se registró)`);
      }
    }

    // === 3. CONSTRUCCIÓN DEL CSV ===
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

    // === 4. DESCARGA AUTOMÁTICA ===
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

// === BUSCADOR EN TIEMPO REAL ===
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

// === 5. INICIALIZACIÓN SEGURA ===
onAuthStateChanged(auth, (user) => {
  if (user) {
    cargarEntrenadores();
  } else {
    window.location.href = "login.html";
  }
});
