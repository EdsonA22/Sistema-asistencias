import { auth, db } from "./Conexion.js";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "login.html";
  } else {
    try {
      const docRef = doc(db, "usuarios", user.uid);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const datosUsuario = docSnap.data();

        // Permitir el acceso si es entrenador o si es un admin supervisando
        if (datosUsuario.rol !== "entrenador" && datosUsuario.rol !== "admin") {
          alert("Acceso denegado.");
          window.location.href = "login.html";
        }
      } else {
        window.location.href = "login.html";
      }
    } catch (error) {
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
