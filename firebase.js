import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";

import { getFirestore }
from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import { getAuth }
from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import { getStorage }
from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";



    // Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDc7-XKk30DshUE-9PUoMF4VObt4UTIncM",
  authDomain: "zibuy-5deae.firebaseapp.com",
  projectId: "zibuy-5deae",
  storageBucket: "zibuy-5deae.firebasestorage.app",
  messagingSenderId: "283997357155",
  appId: "1:283997357155:web:de76cef72c6b278afda456"


};

const app = initializeApp(firebaseConfig);

const db = getFirestore(app);

const auth = getAuth(app);

const storage = getStorage(app);

export {
    db,
    auth,
    storage
};