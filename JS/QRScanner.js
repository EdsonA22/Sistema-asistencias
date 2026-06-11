// Importaciones de Firebase (SDK Modular)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getFirestore,
  doc,
  getDoc,
  collection,
  addDoc,
  updateDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Tu configuración de Firebase
const firebaseConfig = {
  apiKey: "AIzaSyCm93cp4p7dmepeN2RFUSKsz7ECZwGV9Ag",
  authDomain: "academia-uv.firebaseapp.com",
  projectId: "academia-uv",
  storageBucket: "academia-uv.firebasestorage.app",
  messagingSenderId: "213875281485",
  appId: "1:213875281485:web:a79f6d0ab389f521505604",
  measurementId: "G-YWP42R9EST",
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Simulación de ID del entrenador (Deberá venir de tu sistema de Login más adelante)
const idEntrenadorActual = "entrenador_demo_01";

// --- 1. LÓGICA DE FIREBASE (VALIDACIÓN) ---
async function validarAsistencia(textoEscaneado) {
  try {
    const datosQR = JSON.parse(textoEscaneado);
    const ubicacionQR = datosQR.u;
    const tokenEscaneado = datosQR.t;

    const refMonitor = doc(db, "monitores", ubicacionQR);
    const docMonitor = await getDoc(refMonitor);

    if (docMonitor.exists()) {
      const tokenFirebase = docMonitor.data().tokenActivo;

      if (tokenFirebase === tokenEscaneado) {
        // Invalida el token para que no se reutilice
        await updateDoc(refMonitor, {
          tokenActivo: "CONSUMIDO_" + Date.now(),
        });

        // Guarda la asistencia
        await addDoc(collection(db, "asistencias"), {
          id_usuario: idEntrenadorActual,
          ubicacion: ubicacionQR,
          tipo: "Entrada",
          fecha_hora: serverTimestamp(),
          estatus: "Presente",
        });

        alert("¡Registro exitoso! Asistencia guardada correctamente.");
      } else {
        alert(
          "El código QR ha expirado. Por favor, escanea el código más reciente de la pantalla.",
        );
      }
    } else {
      alert("Error: Ubicación no registrada en el sistema.");
    }
  } catch (error) {
    console.warn(
      "El código escaneado no tiene el formato JSON correcto del sistema.",
      error,
    );
  }
}

// --- 2. LÓGICA DE LA CÁMARA (HTML5-QRCODE) ---
function onScanSuccess(decodedText, decodedResult) {
  console.log(`Código detectado: ${decodedText}`);

  // Pausar el escáner para no saturar la base de datos con lecturas repetidas
  html5QrcodeScanner.pause(true);

  // Ejecutar la validación de Firebase
  validarAsistencia(decodedText).then(() => {
    // Reanudar el escáner después de 3 segundos por si necesita escanear otra cosa
    setTimeout(() => {
      html5QrcodeScanner.resume();
    }, 3000);
  });
}

function onScanFailure(error) {
  // Es normal que falle repetidamente mientras intenta enfocar, se ignora en silencio
}

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
