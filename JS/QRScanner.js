import { auth, db } from "./Conexion.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";
import {
  doc,
  getDoc,
  collection,
  addDoc,
  updateDoc,
  serverTimestamp,
  query,
  where,
  getDocs,
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

// Variables globales que guardarán los datos reales del usuario logueado
let idEntrenadorActual = null;
let nombreEntrenadorActual = "Cargando...";

// --- 1. OBTENER EL USUARIO REAL (FIREBASE AUTH) ---
onAuthStateChanged(auth, async (user) => {
  if (user) {
    try {
      // Buscamos directamente el documento del usuario usando su UID
      const docRef = doc(db, "usuarios", user.uid);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        idEntrenadorActual = docSnap.id;
        nombreEntrenadorActual = docSnap.data().nombre;
      } else {
        console.error("El perfil del usuario no existe en la base de datos.");
      }
    } catch (error) {
      console.error("Error al consultar el usuario:", error);
    }
  } else {
    // Si intentan entrar a user.html sin iniciar sesión, por seguridad se bloquea
    alert("Debes iniciar sesión para escanear asistencias.");
    window.location.href = "login.html";
  }
});

// --- 2. LÓGICA DE FIREBASE (VALIDACIÓN Y REGISTRO) ---
async function validarAsistencia(textoEscaneado) {
  // Verificamos que Firebase ya haya terminado de cargar el nombre
  if (!idEntrenadorActual) {
    alert("Aún estamos cargando tu perfil. Intenta escanear en unos segundos.");
    return;
  }

  try {
    const datosQR = JSON.parse(textoEscaneado);
    const ubicacionQR = datosQR.u;
    const tokenEscaneado = datosQR.t;

    const refMonitor = doc(db, "monitores", ubicacionQR);
    const docMonitor = await getDoc(refMonitor);

    if (docMonitor.exists()) {
      const datosMonitor = docMonitor.data();
      const tokenFirebase = datosMonitor.tokenActivo;

      const tipoAsistencia = datosMonitor.tipo || "Entrada";

      if (tokenFirebase === tokenEscaneado) {
        // 1. Invalidamos el token visual y mandamos el nombre REAL a la pantalla
        await updateDoc(refMonitor, {
          status: "escaneado",
          quienEscaneo: nombreEntrenadorActual, // <--- AQUÍ SE ENVÍA EL NOMBRE REAL
          tokenActivo: "CONSUMIDO_" + Date.now(),
        });

        // 2. Procesamos el guardado en la colección general
        const asistenciasRef = collection(db, "asistencias");
        const fechaHoy = new Date().toLocaleDateString("es-MX");

        if (tipoAsistencia === "Entrada") {
          await addDoc(asistenciasRef, {
            id_usuario: idEntrenadorActual,
            nombre: nombreEntrenadorActual,
            ubicacion: ubicacionQR,
            fecha: fechaHoy,
            horaEntrada: serverTimestamp(),
            horaSalida: null, // Aún no ha salido
            estatus: "Presente",
          });
          alert(
            `¡Entrada registrada con éxito para ${nombreEntrenadorActual}!`,
          );
        } else if (tipoAsistencia === "Salida") {
          const q = query(
            asistenciasRef,
            where("id_usuario", "==", idEntrenadorActual),
            where("fecha", "==", fechaHoy),
          );

          const querySnapshot = await getDocs(q);

          if (!querySnapshot.empty) {
            const docAsistencia = querySnapshot.docs[0];
            await updateDoc(doc(db, "asistencias", docAsistencia.id), {
              horaSalida: serverTimestamp(),
            });
            alert(
              `¡Salida registrada correctamente para ${nombreEntrenadorActual}!`,
            );
          } else {
            alert(
              "Error: No se encontró tu registro de Entrada para el día de hoy.",
            );
          }
        }
      } else {
        alert(
          "El código QR ha expirado. Por favor, escanea el código de la pantalla.",
        );
      }
    } else {
      alert("Error: Ubicación no registrada en el sistema.");
    }
  } catch (error) {
    console.warn("El código escaneado no es válido para este sistema.", error);
  }
}

// --- 3. LÓGICA DE LA CÁMARA (HTML5-QRCODE) ---
function onScanSuccess(decodedText, decodedResult) {
  html5QrcodeScanner.pause(true);
  validarAsistencia(decodedText).then(() => {
    setTimeout(() => {
      html5QrcodeScanner.resume();
    }, 3000);
  });
}

function onScanFailure(error) {
  // Ignorar errores de enfoque silenciosamente
}

let html5QrcodeScanner = new Html5QrcodeScanner(
  "reader",
  { fps: 10, qrbox: { width: 250, height: 250 } },
  false,
);

html5QrcodeScanner.render(onScanSuccess, onScanFailure);
