import { auth, db } from "./Conexion.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";
import {
  doc,
  getDoc,
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    // Redirigir al inicio de sesión si se intenta acceder de forma directa por URL
    window.location.href = "login.html";
  } else {
    try {
      const docRef = doc(db, "usuarios", user.uid);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const datosUsuario = docSnap.data();
        const estatusActual = datosUsuario.estatus || "Activo";

        // Bloqueo inmediato si la cuenta fue desactivada administrativamente
        if (estatusActual !== "Activo") {
          alert("Esta cuenta se encuentra temporalmente inactiva.");
          await signOut(auth);
          window.location.href = "login.html";
          return;
        }

        // Restringir acceso si el rol no coincide con entrenador o administrador
        if (datosUsuario.rol !== "entrenador" && datosUsuario.rol !== "admin") {
          alert("Acceso restringido únicamente para personal autorizado.");
          await signOut(auth);
          window.location.href = "login.html";
        }
      } else {
        alert("Información de cuenta no válida.");
        await signOut(auth);
        window.location.href = "login.html";
      }
    } catch (error) {
      console.error("Error crítico en GuardiaEntrenador:", error);
      window.location.href = "login.html";
    }
  }
});
