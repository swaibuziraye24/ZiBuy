import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";


import {
  getAuth
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import {
  getStorage
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";


import {
    getFirestore,
    collection,
    addDoc
} from
"https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";


export {
  db,
  auth,
  storage
};


const firebaseConfig = {
  apiKey: "AIzaSyDc7-XKk30DshUE-9PUoMF4VObt4UTIncM",
  authDomain: "zibuy-5deae.firebaseapp.com",
  databaseURL: "https://zibuy-5deae-default-rtdb.firebaseio.com",
  projectId: "zibuy-5deae",
  storageBucket: "zibuy-5deae.firebasestorage.app",
  messagingSenderId: "283997357155",
  appId: "1:283997357155:web:de76cef72c6b278afda456"
};




const app = initializeApp(firebaseConfig);

const db = getFirestore(app);

const auth = getAuth(app);

const storage = getStorage(app);



window.auth = auth;
window.storage = storage;

window.db = db;
window.collection = collection;
window.addDoc = addDoc;