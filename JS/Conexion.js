// Importa las funciones principales
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// Importa los módulos de Autenticación y Firestore
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCm93cp4p7dmepeN2RFUSKsz7ECZwGV9Ag",
  authDomain: "academia-uv.firebaseapp.com",
  projectId: "academia-uv",
  storageBucket: "academia-uv.firebasestorage.app",
  messagingSenderId: "213875281485",
  appId: "1:213875281485:web:a79f6d0ab389f521505604",
  measurementId: "G-YWP42R9EST",
};

// Inicializa Firebase
export const app = initializeApp(firebaseConfig);
export const analytics = getAnalytics(app);

// Inicializa y exporta Auth y la base de datos (Firestore)
export const auth = getAuth(app);
export const db = getFirestore(app);
