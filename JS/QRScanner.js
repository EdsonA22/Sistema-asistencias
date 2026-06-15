import { initializeApp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";
import {
  getFirestore,
  doc,
  getDoc,
  collection,
  addDoc,
  updateDoc,
  serverTimestamp,
  query, // NUEVO
  where, // NUEVO
  getDocs, // NUEVO
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCm93cp4p7dmepeN2RFUSKsz7ECZwGV9Ag",
  authDomain: "academia-uv.firebaseapp.com",
  projectId: "academia-uv",
  storageBucket: "academia-uv.firebasestorage.app",
  messagingSenderId: "213875281485",
  appId: "1:213875281485:web:a79f6d0ab389f521505604",
  measurementId: "G-YWP42R9EST",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const idEntrenadorActual = "entrenador_demo_01";
const nombreEntrenadorActual = "Prof. Alejandro Gómez";

// --- LÓGICA DE FIREBASE (VALIDACIÓN Y REGISTRO) ---
async function validarAsistencia(textoEscaneado) {
  try {
    const datosQR = JSON.parse(textoEscaneado);
    const ubicacionQR = datosQR.u;
    const tokenEscaneado = datosQR.t;

    const refMonitor = doc(db, "monitores", ubicacionQR);
    const docMonitor = await getDoc(refMonitor);

    if (docMonitor.exists()) {
      const datosMonitor = docMonitor.data();
      const tokenFirebase = datosMonitor.tokenActivo;

      // Obtenemos si la pantalla estaba en modo Entrada o Salida
      const tipoAsistencia = datosMonitor.tipo || "Entrada";

      if (tokenFirebase === tokenEscaneado) {
        // 1. Invalidamos el token visual en la pantalla principal
        await updateDoc(refMonitor, {
          status: "escaneado",
          quienEscaneo: nombreEntrenadorActual,
          tokenActivo: "CONSUMIDO_" + Date.now(),
        });

        // 2. Procesamos el guardado dependiendo del tipo
        const asistenciasRef = collection(db, "asistencias");
        // Guardamos la fecha como un string exacto (ej. "15/6/2026") para facilitar las búsquedas
        const fechaHoy = new Date().toLocaleDateString("es-MX");

        if (tipoAsistencia === "Entrada") {
          // Creamos un documento nuevo con la hora de entrada
          await addDoc(asistenciasRef, {
            id_usuario: idEntrenadorActual,
            nombre: nombreEntrenadorActual,
            ubicacion: ubicacionQR,
            fecha: fechaHoy,
            horaEntrada: serverTimestamp(),
            horaSalida: null, // Aún no ha salido
            estatus: "Presente",
          });
          alert("¡Entrada registrada con éxito!");
        } else if (tipoAsistencia === "Salida") {
          // Buscamos el documento que coincida con el entrenador y la fecha de hoy
          const q = query(
            asistenciasRef,
            where("id_usuario", "==", idEntrenadorActual),
            where("fecha", "==", fechaHoy),
          );

          const querySnapshot = await getDocs(q);

          if (!querySnapshot.empty) {
            // Si encontramos el registro, tomamos su ID y lo actualizamos
            const docAsistencia = querySnapshot.docs[0];
            await updateDoc(doc(db, "asistencias", docAsistencia.id), {
              horaSalida: serverTimestamp(),
            });
            alert("¡Salida registrada correctamente en tu asistencia de hoy!");
          } else {
            // Protección por si intenta registrar salida sin haber registrado entrada
            alert(
              "Error: No se encontró tu registro de Entrada para el día de hoy.",
            );
          }
        }
      } else {
        alert(
          "El código QR ha expirado. Por favor, escanea el de la pantalla.",
        );
      }
    } else {
      alert("Error: Ubicación no registrada en el sistema.");
    }
  } catch (error) {
    console.warn("El código escaneado no es válido.", error);
  }
}

// --- LÓGICA DE LA CÁMARA ---
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

// Inicializar la interfaz del escáner
let html5QrcodeScanner = new Html5QrcodeScanner(
  "reader", // El ID del div en tu HTML donde aparecerá la cámara
  { fps: 10, qrbox: { width: 250, height: 250 } },
  false,
);

// Renderizar el escáner
html5QrcodeScanner.render(onScanSuccess, onScanFailure);

if (tokenFirebase === tokenEscaneado) {
  // 1. Avisamos al monitor cambiando su estado a "escaneado" y enviando la identidad
  await updateDoc(refMonitor, {
    status: "escaneado",
    quienEscaneo: "Prof. Alejandro Gómez", // Aquí vincularás la variable del nombre del usuario logueado
    tokenActivo: "EXPIRADO_POR_USO", // Invalidamos el token inmediatamente
  });

  // 2. Guardamos de forma rutinaria el registro en la bitácora general de asistencias
  await addDoc(collection(db, "asistencias"), {
    id_usuario: idEntrenadorActual,
    ubicacion: ubicacionQR,
    tipo: "Entrada",
    fecha_hora: serverTimestamp(),
    estatus: "Presente",
  });

  alert("Asistencia procesada con éxito.");
}
