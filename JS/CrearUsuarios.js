import { auth, db } from "./Conexion.js";
import {
  createUserWithEmailAndPassword,
  sendEmailVerification, // NUEVO: Importamos la herramienta para enviar el correo
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";
import {
  doc,
  setDoc,
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

const form = document.getElementById("formCrearUsuario");

if (form) {
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const nombre = document.getElementById("nombre").value.trim();
    const correo = document.getElementById("correo").value.trim();
    const rol = document.getElementById("rol").value.trim();
    const categoria = document.getElementById("categoria").value;
    const password = document.getElementById("password").value;

    try {
      // 1. Firebase crea la cuenta
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        correo,
        password,
      );
      const usuarioFirebase = userCredential.user;

      // 2. NUEVO: Le pedimos a Firebase que envíe el correo de verificación a esa cuenta
      await sendEmailVerification(usuarioFirebase);

      // 3. Guardamos los datos en Firestore
      await setDoc(doc(db, "usuarios", usuarioFirebase.uid), {
        nombre: nombre,
        correo: correo,
        rol: rol,
        categoria: categoria,
        estatus: "Activo",
        fechaCreacion: new Date(),
      });

      alert(
        "Usuario registrado exitosamente. Se ha enviado un correo de verificación.",
      );
      form.reset();
    } catch (error) {
      console.error("Error al registrar:", error);
      alert("Ocurrió un error: " + error.message);
    }
  });
}
