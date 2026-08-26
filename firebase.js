// firebase.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.1.0/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, query, where, serverTimestamp, doc, updateDoc, orderBy, deleteDoc } from "https://www.gstatic.com/firebasejs/10.1.0/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.1.0/firebase-storage.js";

const firebaseConfig = {
    apiKey: "AIzaSyDoBVX4TOEloCulGHkw3S7ST4ct28Is1VE",
    authDomain: "apuntesapp-a3ad7.firebaseapp.com",
    projectId: "apuntesapp-a3ad7",
    storageBucket: "apuntesapp-a3ad7.firebasestorage.app",
    messagingSenderId: "686003243521",
    appId: "1:686003243521:web:4b09ac380cb8348db94e00"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);

// Exportamos las herramientas para que otros archivos puedan usarlas
export { db, storage, collection, addDoc, getDocs, query, where, serverTimestamp, doc, updateDoc, orderBy, deleteDoc, ref, uploadBytes, getDownloadURL };