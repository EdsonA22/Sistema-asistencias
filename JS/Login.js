import { auth, db } from "./Conexion.js";
import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";
import {
  doc,
  getDoc,
  setDoc,
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

const formLogin = document.getElementById("formLogin");

formLogin.addEventListener("submit", async (e) => {
  e.preventDefault();

  const correo = document.getElementById("loginCorreo").value;
  const password = document.getElementById("loginPassword").value;

  try {
    // 1. Iniciar sesión en Firebase Auth
    const userCredential = await signInWithEmailAndPassword(
      auth,
      correo,
      password,
    );
    const usuario = userCredential.user;

    // 2. Consultar el rol del usuario en la base de datos Firestore
    const docRef = doc(db, "usuarios", usuario.uid);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const datosUsuario = docSnap.data();

      // 3. Redireccionar según el rol (Control de Acceso Basado en Roles)
      // Dentro de JS/Login.js (ejecutándose en el contexto de HTML/login.html)
      if (datosUsuario.rol === "admin") {
        // Ambos están en la carpeta HTML, la redirección es directa
        window.location.href = "admin.html";
      } else if (datosUsuario.rol === "entrenador") {
        window.location.href = "user.html";
      } else {
        alert("El usuario no tiene un rol válido asignado.");
      }
    } else {
      alert("No se encontraron registros administrativos para este usuario.");
    }
  } catch (error) {
    console.error("Error de acceso:", error);
    alert("Credenciales incorrectas o el usuario no existe.");
  }
});
