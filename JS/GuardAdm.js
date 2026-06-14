import { auth, db } from "./Conexion.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";
import {
  doc,
  getDoc,
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

// Escuchar el estado de la autenticación en tiempo real
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    // Si no hay un usuario activo, mandarlo inmediatamente al login
    window.location.href = "login.html";
  } else {
    try {
      // Consultar los datos del usuario en Firestore utilizando su UID
      const docRef = doc(db, "usuarios", user.uid);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const datosUsuario = docSnap.data();

        // Validar si el rol NO es administrador
        if (datosUsuario.rol !== "admin") {
          alert("Acceso denegado. No tienes permisos de administrador.");
          // Redirigir a la vista correspondiente o al login
          window.location.href = "login.html";
        }
        // Si es admin, el script no hace nada y permite que se vea la página
      } else {
        alert("No se encontraron datos de perfil para esta cuenta.");
        window.location.href = "login.html";
      }
    } catch (error) {
      console.error("Error validando rol:", error);
      window.location.href = "login.html";
    }
  }
});

const btnCerrar = document.getElementById("btnCerrarSesion");
if (btnCerrar) {
  btnCerrar.addEventListener("click", (e) => {
    e.preventDefault();
    signOut(auth)
      .then(() => {
        // Una vez cerrada la sesión, redirige a login.html
        window.location.href = "login.html";
      })
      .catch((error) => {
        console.error("Error al cerrar sesión:", error);
      });
  });
}
