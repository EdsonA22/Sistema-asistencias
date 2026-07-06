import { db, auth } from "./Conexion.js"; // Añadimos 'auth'
import {
  collection,
  query,
  where,
  getDocs,
  doc, // Añadido
  getDoc, // Añadido
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js"; // Añadido el "gatillo" seguro

// === 1. UTILIDADES DE FECHA ===
function obtenerDiasSemanaActual() {
  const fechas = [];
  const hoy = new Date();

  let diaSemana = hoy.getDay();
  if (diaSemana === 0) diaSemana = 7;

  const lunes = new Date(hoy);
  lunes.setDate(hoy.getDate() - diaSemana + 1);

  for (let i = 0; i < 6; i++) {
    const dia = new Date(lunes);
    dia.setDate(lunes.getDate() + i);
    fechas.push(dia.toLocaleDateString("es-MX"));
  }
  return fechas;
}

const fechaHoy = new Date().toLocaleDateString("es-MX");
const fechasSemanaStr = obtenerDiasSemanaActual();

// === 2. FUNCIÓN PRINCIPAL DE CARGA (Segmentada) ===
async function cargarDashboard(usuarioActual) {
  try {
    // PASO A: Averiguar la categoría del Administrador
    const adminRef = doc(db, "usuarios", usuarioActual.uid);
    const adminSnap = await getDoc(adminRef);

    let categoriaAdmin = "General";
    if (adminSnap.exists() && adminSnap.data().categoria) {
      categoriaAdmin = adminSnap.data().categoria;
    }

    // PASO B: Obtener SOLO a los entrenadores de esta categoría
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
    const snapUsuarios = await getDocs(qUsuarios);

    // Guardamos los accesos (ID y Nombre) para filtrar más adelante
    const entrenadoresPermitidosIds = new Set();
    const entrenadoresPermitidosNombres = new Set();

    snapUsuarios.forEach((u) => {
      if (u.data().estatus !== "Eliminado") {
        entrenadoresPermitidosIds.add(u.id);
        if (u.data().nombre) entrenadoresPermitidosNombres.add(u.data().nombre);
      }
    });

    // Actualizamos la tarjeta del TOTAL DE ENTRENADORES en pantalla
    const totalEntrenadores = entrenadoresPermitidosIds.size;
    document.getElementById("valUsuarios").textContent = totalEntrenadores;

    // PASO C: Obtener todas las asistencias de la semana actual
    const qAsistencias = query(
      collection(db, "asistencias"),
      where("fecha", "in", fechasSemanaStr),
    );
    const snapAsistencias = await getDocs(qAsistencias);

    let asistenciasHoy = 0;
    let contPresente = 0;
    let contJustificado = 0;
    let contRetardo = 0;
    let contFalta = 0;
    const concurrenciaPorDia = [0, 0, 0, 0, 0, 0]; // Lunes a Sábado

    // PASO D: Procesar datos (Ignorando a los que no son de tu deporte)
    snapAsistencias.forEach((docSnap) => {
      const data = docSnap.data();

      // Validación estricta: ¿Esta asistencia le pertenece a mi equipo?
      const esValido =
        entrenadoresPermitidosIds.has(data.id_usuario) ||
        entrenadoresPermitidosNombres.has(data.nombre);

      if (esValido) {
        const estatus = data.estatus || "Desconocido";

        // 1. Contar sesiones válidas de HOY
        if (
          data.fecha === fechaHoy &&
          (estatus === "Presente" || estatus === "Retardo")
        ) {
          asistenciasHoy++;
        }

        // 2. Acumular contadores para la dona (Toda la semana)
        if (estatus === "Presente") contPresente++;
        else if (estatus === "Justificado") contJustificado++;
        else if (estatus === "Retardo") contRetardo++;
        else if (estatus === "Falta" || estatus === "Ausente") contFalta++;

        // 3. Acumular para el gráfico de barras por día
        if (estatus === "Presente" || estatus === "Retardo") {
          const indiceDia = fechasSemanaStr.indexOf(data.fecha);
          if (indiceDia !== -1) {
            concurrenciaPorDia[indiceDia]++;
          }
        }
      }
    });

    document.getElementById("valSesiones").textContent = asistenciasHoy;

    // === 3. CALCULAR PORCENTAJE DE ASISTENCIA SEMANAL ===
    const totalRegistrosSemana =
      contPresente + contJustificado + contRetardo + contFalta;
    let porcentajeGlobal = 0;

    if (totalRegistrosSemana > 0) {
      porcentajeGlobal =
        ((contPresente + contRetardo) / totalRegistrosSemana) * 100;
    }
    document.getElementById("valAsistencia").textContent =
      porcentajeGlobal.toFixed(1) + "%";

    // === 4. DIBUJAR GRÁFICO DE DONA ===
    dibujarGraficoDona(
      contPresente,
      contJustificado,
      contRetardo,
      contFalta,
      totalRegistrosSemana,
    );

    // === 5. DIBUJAR GRÁFICO DE TENDENCIA ===
    dibujarGraficoBarras(concurrenciaPorDia, totalEntrenadores);
  } catch (error) {
    console.error("Error al cargar el dashboard:", error);
    document.getElementById("valAsistencia").textContent = "Err";
  }
}

// === FUNCIONES DE RENDERIZADO VISUAL ===

function dibujarGraficoDona(presente, justificado, retardo, falta, total) {
  const canvas = document.getElementById("graficoDonut");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  const centroX = canvas.width / 2;
  const centroY = canvas.height / 2;
  const radio = Math.min(centroX, centroY);

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (total === 0) {
    ctx.beginPath();
    ctx.arc(centroX, centroY, radio, 0, 2 * Math.PI);
    ctx.fillStyle = "#e0e0e0";
    ctx.fill();
  } else {
    const segmentos = [
      { valor: presente, color: "#4a90e2" },
      { valor: justificado, color: "#2ecc71" },
      { valor: retardo, color: "#f1c40f" },
      { valor: falta, color: "#e74c3c" },
    ];

    let anguloInicio = -Math.PI / 2;

    segmentos.forEach((segmento) => {
      if (segmento.valor === 0) return;
      const porcionAngulo = (segmento.valor / total) * 2 * Math.PI;

      ctx.beginPath();
      ctx.moveTo(centroX, centroY);
      ctx.arc(
        centroX,
        centroY,
        radio,
        anguloInicio,
        anguloInicio + porcionAngulo,
      );
      ctx.fillStyle = segmento.color;
      ctx.fill();

      anguloInicio += porcionAngulo;
    });
  }

  // Círculo interno para el efecto dona
  ctx.beginPath();
  ctx.arc(centroX, centroY, radio * 0.55, 0, 2 * Math.PI);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
}

function dibujarGraficoBarras(concurrencia, maxPosible) {
  const contenedor = document.getElementById("graficoTendencia");
  contenedor.innerHTML = "";

  const nombresDias = ["Lun", "Mar", "Mié", "Jue", "Vie"];
  const baseMaxima = maxPosible > 0 ? maxPosible : 1;

  for (let i = 0; i < 5; i++) {
    const porcentajeAltura = (concurrencia[i] / baseMaxima) * 100;

    const divDia = document.createElement("div");
    divDia.style.display = "flex";
    divDia.style.flexDirection = "column";
    divDia.style.justifyContent = "flex-end";
    divDia.style.alignItems = "center";
    divDia.style.width = "60px";
    divDia.style.height = "100%";

    const barra = document.createElement("div");
    barra.style.height = `${porcentajeAltura}%`;
    barra.style.width = "100%";
    barra.style.background = "#4a90e2";
    barra.style.borderRadius = "4px 4px 0 0";
    barra.style.transition = "height 1s ease";
    barra.title = `${concurrencia[i]} entrenadores asistieron`;

    const etiqueta = document.createElement("span");
    etiqueta.textContent = nombresDias[i];
    etiqueta.style.fontSize = "12px";
    etiqueta.style.color = "#666";
    etiqueta.style.marginTop = "5px";

    divDia.appendChild(barra);
    divDia.appendChild(etiqueta);
    contenedor.appendChild(divDia);
  }
}

// === 6. EXPORTAR DASHBOARD A PDF ===
const btnExportar = document.getElementById("btnExportar");

if (btnExportar) {
  btnExportar.addEventListener("click", () => {
    const elementoAExportar = document.querySelector(".main");

    const opciones = {
      margin: 12,
      filename: `Reporte_Semanal_Asistencias_${fechaHoy.replace(/\//g, "-")}.pdf`,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: "mm", format: "a4", orientation: "landscape" },
    };

    btnExportar.style.display = "none";

    html2pdf()
      .set(opciones)
      .from(elementoAExportar)
      .save()
      .then(() => {
        btnExportar.style.display = "";
      })
      .catch((error) => {
        console.error("Error al generar el PDF:", error);
        btnExportar.style.display = "";
        alert("No se pudo generar el PDF del reporte.");
      });
  });
}

// === 7. INICIALIZACIÓN SEGURA (Gatillo principal) ===
onAuthStateChanged(auth, (user) => {
  if (user) {
    cargarDashboard(user);
  } else {
    window.location.href = "login.html";
  }
});
