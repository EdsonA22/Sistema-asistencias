import { auth, db } from "./Conexion.js";
import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";
import {
  doc,
  getDoc,
  setDoc,
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

const formLogin = document.getElementById("formLogin");

if (formLogin) {
  formLogin.addEventListener("submit", async (e) => {
    e.preventDefault();

    const correo = document.getElementById("loginCorreo").value.trim();
    const password = document.getElementById("loginPassword").value;

    try {
      // 1. Iniciar sesión en Firebase Authentication
      const userCredential = await signInWithEmailAndPassword(
        auth,
        correo,
        password,
      );
      const usuario = userCredential.user;

      // 2. Consultar la información del perfil y rol en Firestore
      const docRef = doc(db, "usuarios", usuario.uid);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const datosUsuario = docSnap.data();

        // 3. Validar estatus de control administrativo
        const estatusActual = datosUsuario.estatus || "Activo";
        if (estatusActual !== "Activo") {
          alert(
            "Acceso denegado: Esta cuenta se encuentra Inactiva o dada de baja. Contacte al administrador.",
          );
          await signOut(auth);
          return;
        }

        // 4. Redirección relativa (asumiendo que las vistas están en la misma carpeta HTML)
        if (datosUsuario.rol === "admin") {
          window.location.href = "admin.html";
        } else if (datosUsuario.rol === "entrenador") {
          window.location.href = "user.html";
        } else {
          alert("El usuario no tiene un rol válido asignado en el sistema.");
          await signOut(auth);
        }
      } else {
        alert("No se encontraron registros administrativos para esta cuenta.");
        await signOut(auth);
      }
    } catch (error) {
      console.error("Error en el proceso de inicio de sesión:", error);
      // Mensajes descriptivos comunes de Firebase Auth
      if (
        error.code === "auth/wrong-password" ||
        error.code === "auth/user-not-found" ||
        error.code === "auth/invalid-credential"
      ) {
        alert("Correo electrónico o contraseña incorrectos.");
      } else {
        alert("Ocurrió un error al intentar ingresar: " + error.message);
      }
    }
  });
}
