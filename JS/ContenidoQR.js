import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getFirestore,
  doc,
  setDoc,
  onSnapshot,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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

const UBICACION_ID = "cancha_principal_uv";
let temporizadorRutinario; // Guardará el temporizador por si nadie escanea el QR

// Función encargada exclusivamente de emitir un nuevo Token Limpio
async function generarNuevoQR() {
  const nuevoToken =
    Math.random().toString(36).substring(2) + Date.now().toString(36);

  // Inicializamos la ubicación en modo de espera
  await setDoc(doc(db, "monitores", UBICACION_ID), {
    tokenActivo: nuevoToken,
    status: "esperando",
    quienEscaneo: "",
    ultimaActualizacion: serverTimestamp(),
  });

  // Si pasan 15 segundos y el estado sigue en "esperando", la función se revoca a sí misma para rotar el QR
  clearTimeout(temporizadorRutinario);
  temporizadorRutinario = setTimeout(generarNuevoQR, 15000);
}

// --- ESCUCHADOR EN TIEMPO REAL (onSnapshot) ---
// Esta función se ejecuta automáticamente cada vez que el documento cambia en Firebase
onSnapshot(doc(db, "monitores", UBICACION_ID), (snapshot) => {
  const datos = snapshot.data();
  if (!datos) return;

  const contenedorQR = document.getElementById("qrcode");

  // CASO A: El celular del entrenador cambió el estado a "escaneado"
  if (datos.status === "escaneado") {
    // Cancelamos el temporizador de rotación de 15 segundos para que no interfiera
    clearTimeout(temporizadorRutinario);

    // Inyectamos visualmente una confirmación en la pantalla del monitor público
    contenedorQR.innerHTML = `
            <div style="padding: 20px; text-align: center;">
                <i class='bx bx-check-circle' style='font-size: 90px; color: #237a3b;'></i>
                <h2 style="color: #0b2d73; margin-top: 15px;">¡Asistencia Exitosa!</h2>
                <p style="font-size: 18px; color: #5e6c84; margin-top: 5px;">Bienvenido: <strong>${datos.quienEscaneo}</strong></p>
            </div>
        `;

    // Esperamos 3.5 segundos para que el profesor vea su confirmación en el monitor y limpiamos la pantalla generando el siguiente QR
    setTimeout(() => {
      generarNuevoQR();
    }, 3500);
  }

  // CASO B: El monitor está en espera, dibujamos el código QR activo correspondiente
  else if (datos.status === "esperando") {
    contenedorQR.innerHTML = ""; // Limpiamos residuos de animaciones previas

    const datosParaQR = JSON.stringify({
      u: UBICACION_ID,
      t: datos.tokenActivo,
    });

    new QRCode(contenedorQR, {
      text: datosParaQR,
      width: 350,
      height: 350,
      colorDark: "#0b2d73",
      colorLight: "#ffffff",
      correctLevel: QRCode.CorrectLevel.H,
    });
  }
});

// Arrancamos el ciclo por primera vez al cargar la pantalla del monitor
generarNuevoQR();
