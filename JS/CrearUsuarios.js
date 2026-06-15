import { auth, db } from "./Conexion.js";
import { createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";
import {
  doc,
  setDoc,
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

console.log("CrearUsuarios.js cargado");

const form = document.getElementById("formCrearUsuario");
console.log(form);

form.addEventListener("submit", async (e) => {
  e.preventDefault(); // Evita que la página se recargue

  // Obtener los valores de los inputs
  const nombre = document.getElementById("nombre").value;
  const correo = document.getElementById("correo").value;
  const rol = document.getElementById("rol").value;
  const password = document.getElementById("password").value;

  try {
    // 1. Registrar al usuario en el sistema de autenticación
    const userCredential = await createUserWithEmailAndPassword(
      auth,
      correo,
      password,
    );
    const usuarioFirebase = userCredential.user;

    // 2. Guardar los datos administrativos en la base de datos Firestore
    // Se crea un documento en la colección "usuarios" usando el ID único (uid) del usuario
    await setDoc(doc(db, "usuarios", usuarioFirebase.uid), {
      nombre: nombre,
      matricula: matricula,
      correo: correo,
      rol: rol,
      estatus: "Activo", // <-- Asegura esta línea
      fechaCreacion: new Date(),
    });

    alert("Usuario creado exitosamente en el sistema.");
    form.reset(); // Limpia los campos del formulario
  } catch (error) {
    console.error("Error en el registro:", error);
    alert("Ocurrió un error: " + error.message);
  }
});
