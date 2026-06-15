import { db } from "./Conexion.js";
import {
  collection,
  query,
  where,
  getDocs,
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

// === 1. UTILIDADES DE FECHA ===
// Función para obtener un arreglo con las fechas de la semana actual (Lunes a Sábado)
function obtenerDiasSemanaActual() {
  const fechas = [];
  const hoy = new Date();

  // getDay() devuelve 0 para Domingo, 1 para Lunes, etc.
  // Ajustamos para que la semana empiece en Lunes
  let diaSemana = hoy.getDay();
  if (diaSemana === 0) diaSemana = 7;

  const lunes = new Date(hoy);
  lunes.setDate(hoy.getDate() - diaSemana + 1);

  // Generamos de Lunes (0) a Sábado (5)
  for (let i = 0; i < 6; i++) {
    const dia = new Date(lunes);
    dia.setDate(lunes.getDate() + i);
    // Formateamos idéntico a cómo lo guarda tu código del lector QR
    fechas.push(dia.toLocaleDateString("es-MX"));
  }
  return fechas;
}

const fechaHoy = new Date().toLocaleDateString("es-MX");
const fechasSemanaStr = obtenerDiasSemanaActual();

// === 2. FUNCIÓN PRINCIPAL DE CARGA ===
async function cargarDashboard() {
  try {
    // A. OBTENER TOTAL DE ENTRENADORES
    const qUsuarios = query(
      collection(db, "usuarios"),
      where("rol", "==", "entrenador"),
    );
    const snapUsuarios = await getDocs(qUsuarios);
    const totalEntrenadores = snapUsuarios.size; // .size nos da el conteo directo
    document.getElementById("valUsuarios").textContent = totalEntrenadores;

    // B. OBTENER ASISTENCIAS DE LA SEMANA
    // Usamos el operador "in" para buscar múltiples fechas de golpe (limitado a 10 elementos por Firebase, ideal para una semana)
    const qAsistencias = query(
      collection(db, "asistencias"),
      where("fecha", "in", fechasSemanaStr),
    );
    const snapAsistencias = await getDocs(qAsistencias);

    // Variables para las métricas estadísticas
    let asistenciasHoy = 0;

    // Contadores para el Gráfico de Dona
    let contPresente = 0;
    let contJustificado = 0;
    let contRetardo = 0;
    let contFalta = 0;

    // Contadores para el Gráfico de Barras (Tendencia de Lunes a Sábado)
    // Índice 0 = Lunes, Índice 5 = Sábado
    const concurrenciaPorDia = [0, 0, 0, 0, 0, 0];

    // C. PROCESAMIENTO DE LOS DATOS
    snapAsistencias.forEach((docSnap) => {
      const data = docSnap.data();
      const estatus = data.estatus || "Desconocido";

      // 1. Contar sesiones válidas de HOY (que asistió de alguna forma)
      if (
        data.fecha === fechaHoy &&
        (estatus === "Presente" || estatus === "Retardo")
      ) {
        asistenciasHoy++;
      }

      // 2. Acumular contadores para la dona de toda la semana
      if (estatus === "Presente") contPresente++;
      else if (estatus === "Justificado") contJustificado++;
      else if (estatus === "Retardo") contRetardo++;
      else if (estatus === "Falta" || estatus === "Ausente") contFalta++;

      // 3. Acumular para el gráfico de barras por día (solo sesiones en las que asistió)
      if (estatus === "Presente" || estatus === "Retardo") {
        const indiceDia = fechasSemanaStr.indexOf(data.fecha);
        if (indiceDia !== -1) {
          concurrenciaPorDia[indiceDia]++;
        }
      }
    });

    document.getElementById("valSesiones").textContent = asistenciasHoy;

    // === 3. CALCULAR PORCENTAJE DE ASISTENCIA SEMANAL ===
    const totalRegistrosSemana =
      contPresente + contJustificado + contRetardo + contFalta;
    let porcentajeGlobal = 0;

    if (totalRegistrosSemana > 0) {
      // Consideramos "Asistencia positiva" a estar Presente o tener Retardo
      porcentajeGlobal =
        ((contPresente + contRetardo) / totalRegistrosSemana) * 100;
    }
    // Formateamos a 1 decimal (Ej. 94.2%)
    document.getElementById("valAsistencia").textContent =
      porcentajeGlobal.toFixed(1) + "%";

    // === 4. DIBUJAR GRÁFICO DE DONA (CSS Puro) ===
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
    // Mostrar estado de error en la interfaz
    document.getElementById("valAsistencia").textContent = "Err";
  }
}

// === FUNCIONES DE RENDERIZADO VISUAL ===

function dibujarGraficoDona(presente, justificado, retardo, falta, total) {
  const canvas = document.getElementById("graficoDonut");
  if (!canvas) return;

  // Obtenemos el contexto "2d" para usar las herramientas de dibujo nativas
  const ctx = canvas.getContext("2d");

  // Encontramos el centro exacto del lienzo y definimos el radio
  const centroX = canvas.width / 2;
  const centroY = canvas.height / 2;
  const radio = Math.min(centroX, centroY);

  // Limpiamos el lienzo por si se está redibujando al cambiar datos
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (total === 0) {
    // Si no hay asistencias en la semana, dibujamos un círculo gris
    ctx.beginPath();
    ctx.arc(centroX, centroY, radio, 0, 2 * Math.PI);
    ctx.fillStyle = "#e0e0e0";
    ctx.fill();
  } else {
    // Arreglo con la lógica de negocio para los segmentos y colores correspondientes
    const segmentos = [
      { valor: presente, color: "#4a90e2" }, // Azul
      { valor: justificado, color: "#2ecc71" }, // Verde
      { valor: retardo, color: "#f1c40f" }, // Amarillo
      { valor: falta, color: "#e74c3c" }, // Rojo
    ];

    // Iniciamos en -90 grados (en radianes) para que el primer color empiece arriba como un reloj (las 12:00)
    let anguloInicio = -Math.PI / 2;

    // Dibujamos cada rebanada del pastel basada en su porcentaje matemático
    segmentos.forEach((segmento) => {
      if (segmento.valor === 0) return; // Omitimos si no hay datos de este estatus

      const porcionAngulo = (segmento.valor / total) * 2 * Math.PI;

      ctx.beginPath();
      ctx.moveTo(centroX, centroY); // Llevamos el pincel al centro
      ctx.arc(
        centroX,
        centroY,
        radio,
        anguloInicio,
        anguloInicio + porcionAngulo,
      );
      ctx.fillStyle = segmento.color;
      ctx.fill();

      anguloInicio += porcionAngulo; // Avanzamos el ángulo para el siguiente color
    });
  }

  // === El truco de la Dona ===
  // Independientemente de los colores, dibujamos un círculo más pequeño de color blanco
  // exactamente en el centro para crear la ilusión del "agujero" central.
  ctx.beginPath();
  ctx.arc(centroX, centroY, radio * 0.55, 0, 2 * Math.PI); // 0.55 define el grosor de la dona
  ctx.fillStyle = "#ffffff";
  ctx.fill();
}

function dibujarGraficoBarras(concurrencia, maxPosible) {
  const contenedor = document.getElementById("graficoTendencia");
  contenedor.innerHTML = ""; // Limpiamos ejemplos

  const nombresDias = ["Lun", "Mar", "Mié", "Jue", "Vie"];

  // Evitamos divisiones entre cero si no hay entrenadores registrados
  const baseMaxima = maxPosible > 0 ? maxPosible : 1;

  for (let i = 0; i < 5; i++) {
    // Calculamos qué porcentaje de la altura total debe ocupar la barra
    // Ej: Si vinieron 5 de 10 entrenadores, la altura es 50%
    const porcentajeAltura = (concurrencia[i] / baseMaxima) * 100;

    // Creamos la columna
    const divDia = document.createElement("div");
    divDia.style.display = "flex";
    divDia.style.flexDirection = "column";
    divDia.style.justifyContent = "flex-end";
    divDia.style.alignItems = "center";
    divDia.style.width = "60px";
    divDia.style.height = "100%"; // Ocupa todo el contenedor

    // Creamos la barra visual de color
    const barra = document.createElement("div");
    barra.style.height = `${porcentajeAltura}%`; // Altura dinámica
    barra.style.width = "100%";
    barra.style.background = "#4a90e2";
    barra.style.borderRadius = "4px 4px 0 0";
    barra.style.transition = "height 1s ease"; // Animación fluida
    // Opcional: mostrar la cantidad exacta al pasar el ratón (tooltip nativo)
    barra.title = `${concurrencia[i]} entrenadores asistieron`;

    // Texto de la etiqueta del día
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

// Ejecutamos la carga en cuanto el navegador lee el script
cargarDashboard();
// === 6. EXPORTAR DASHBOARD A PDF ===
const btnExportar = document.getElementById("btnExportar");

if (btnExportar) {
  btnExportar.addEventListener("click", () => {
    // 1. Seleccionamos el contenedor principal de tu HTML que queremos guardar
    const elementoAExportar = document.querySelector(".main");

    // 2. Definimos los parámetros de personalización del documento administrativo
    const opciones = {
      margin: 12, // Margen en milímetros a los lados del papel
      filename: `Reporte_Semanal_Asistencias_${fechaHoy.replace(/\//g, "-")}.pdf`,
      image: { type: "jpeg", quality: 0.98 },
      // html2canvas con escala 2 duplica los píxeles para que los textos y las gráficas no se vean borrosos al hacer zoom
      html2canvas: { scale: 2, useCORS: true },
      // Usamos orientación horizontal ('landscape') porque tus métricas y gráficas están acomodadas de lado a lado
      jsPDF: { unit: "mm", format: "a4", orientation: "landscape" },
    };

    // 3. Efecto visual: Ocultamos temporalmente el botón antes de la captura
    // Esto evita que el propio botón de "Exportar datos" salga impreso dentro del PDF
    btnExportar.style.display = "none";

    // 4. Ejecutamos la librería html2pdf
    html2pdf()
      .set(opciones)
      .from(elementoAExportar)
      .save()
      .then(() => {
        // 5. Una vez que el archivo se descargó en el celular o PC, volvemos a mostrar el botón
        btnExportar.style.display = "";
      })
      .catch((error) => {
        console.error("Error al generar el PDF:", error);
        btnExportar.style.display = ""; // En caso de fallo, restauramos el botón de todos modos
        alert("No se pudo generar el PDF del reporte.");
      });
  });
}
