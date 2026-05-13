import {
    addDoc,
    collection,
    getDocs,
    doc,
    deleteDoc,
    updateDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import {
    ref,
    uploadBytes,
    getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

import { db, auth, storage } from "./firebase.js";

const products = [

  {
    id: 1,
    name: "Luxury Perfume",
    price: 80000,
    image: "https://picsum.photos/300/300?1"
  },

  {
    id: 2,
    name: "Smart Watch",
    price: 120000,
    image: "https://picsum.photos/300/300?2"
  },

  {
    id: 3,
    name: "Ladies Bag",
    price: 95000,
    image: "https://picsum.photos/300/300?3"
  }

];


async function addProduct() {

    // ✅ ONLY ADMIN CHECK
    if (!isAdmin) {
        alert("Admin only");
        return;
    }

    // 📍 1. GET INPUTS (FROM YOUR ADMIN PANEL)
    const name = document.getElementById("p-name").value;
    const price = document.getElementById("p-price").value;
    const category = document.getElementById("p-category").value;

    if (!name || !price) {
        alert("Fill all fields");
        return;
    }

    // 📍 2. IMAGE UPLOAD (YOU ALREADY USE selectedFiles)
    if (!window.selectedFiles || window.selectedFiles.length === 0) {
        alert("Select at least 1 image");
        return;
    }

    let imageUrls = [];

    for (let file of window.selectedFiles) {

        const storageRef = ref(storage, "products/" + Date.now() + "_" + file.name);

        await uploadBytes(storageRef, file);

        const url = await getDownloadURL(storageRef);

        imageUrls.push(url);
    }

    // 📍 3. SAVE TO FIRESTORE
    await addDoc(collection(db, "products"), {
        name: name,
        price: Number(price),
        category: category,
        images: imageUrls,
        createdAt: new Date()
    });

    // 📍 4. RESET FORM (IMPORTANT)
    document.getElementById("p-name").value = "";
    document.getElementById("p-price").value = "";
    window.selectedFiles = [];

    document.getElementById("preview-container").innerHTML = "";

    alert("Product added successfully");

    // 📍 5. REFRESH PRODUCTS
    loadProducts();
}



function renderProducts(){

  const container = document.getElementById("products");

  container.innerHTML = "";

  products.forEach(product => {

    container.innerHTML += `

      <div class="product-card">

        <img src="${product.image}" alt="${product.name}">

        <h3>${product.name}</h3>

        <p class="price">
          UGX ${product.price.toLocaleString()}
        </p>

        <button onclick="addToCart(${product.id})">
          Add To Cart
        </button>

      </div>

    `;

  });

}


window.addToCart = function(id){

  const product = products.find(p => p.id === id);

  if(!product) return;

  alert(product.name + " added to cart");

};


renderProducts();



async function loadProducts() {
    const container = document.getElementById("products");
    container.innerHTML = "";

    const snapshot = await getDocs(collection(db, "products"));

    snapshot.forEach((docSnap) => {
        const p = docSnap.data();

        container.innerHTML += `
            <div class="product-card">
                <img src="${p.image}" />
                <h3>${p.name}</h3>
                <p>UGX ${p.price}</p>
                <button onclick="addToCart('${p.name}', ${p.price})">
                    Add to Cart
                </button>
            </div>
        `;
    });
}

window.addEventListener("DOMContentLoaded", async () => {
    await loadProducts();
});
