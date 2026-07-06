import { auth, db } from "./Conexion.js";
import { createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";
import {
  doc,
  setDoc,
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

const form = document.getElementById("formCrearUsuario");

if (form) {
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    // Ya no buscamos el ID "matricula"
    const nombre = document.getElementById("nombre").value.trim();
    const correo = document.getElementById("correo").value.trim();
    const rol = document.getElementById("rol").value.trim();
    const password = document.getElementById("password").value;
    const categoria = document.getElementById("categoria").value;

    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        correo,
        password,
      );
      const usuarioFirebase = userCredential.user;

      // Guardamos solo los datos relevantes en Firestore
      await setDoc(doc(db, "usuarios", usuarioFirebase.uid), {
        nombre: nombre,
        correo: correo,
        rol: rol,
        categoria: categoria,
        estatus: "Activo",
        fechaCreacion: new Date(),
      });

      alert("Usuario registrado exitosamente en el sistema.");
      form.reset();
    } catch (error) {
      console.error("Error en el registro:", error);
      if (error.code === "auth/email-already-in-use") {
        alert(
          "Ocurrió un error: Este correo ya está registrado en el sistema.",
        );
      } else if (error.code === "auth/weak-password") {
        alert(
          "Ocurrió un error: La contraseña debe tener al menos 6 caracteres.",
        );
      } else {
        alert("Ocurrió un error al registrar: " + error.message);
      }
    }
  });
}
