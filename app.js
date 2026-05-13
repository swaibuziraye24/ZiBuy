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
window.addProduct = async function () {
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

    const productsContainer = document.getElementById("products");

    if (!productsContainer) return;

    productsContainer.innerHTML = "<p>Loading products...</p>";

    try {

        const querySnapshot = await getDocs(collection(db, "products"));

        productsContainer.innerHTML = "";

        const searchValue = document
    .getElementById("search-input")
    .value
    .toLowerCase();

        querySnapshot.forEach((docSnap) => {

            const product = docSnap.data();

            if (
    activeCategory !== "all" &&
    product.category !== activeCategory
) {
    return;
}

            if (
    !product.name
        .toLowerCase()
        .includes(searchValue)
) {
    return;
}

            const card = document.createElement("div");

            card.className = "product-card";

           card.innerHTML = `

    <div
        onclick="openProduct(
            '${product.name}',
            ${product.price},
            '${product.images[0]}'
        )"
    >

        <div class="product-image-box">

            <img
                src="${product.images[0]}"
                class="product-image"
            >

        </div>

        <div class="product-info">

            <h3 class="product-title">
                ${product.name}
            </h3>

            <p class="product-price">
                UGX ${product.price.toLocaleString()}
            </p>

        </div>

    </div>

    <button
        class="cart-btn"
        onclick="event.stopPropagation(); addToCart(
            '${product.name}',
            ${product.price}
        )"
    >

        Add To Cart

    </button>

`;
            productsContainer.appendChild(card);

        });

    } catch (error) {

        console.error(error);

        productsContainer.innerHTML = `
            <p>Failed to load products</p>
        `;
    }
}

window.addEventListener("DOMContentLoaded", () => {

    loadProducts();

});

window.addProduct = async function () {

    const name = document.getElementById("product-name").value;

    const price = document.getElementById("product-price").value;

    const file = document.getElementById("product-image").files[0];

const category = document.getElementById(
    "product-category"
).value;

    if (!name || !price || !file) {

        alert("Fill all fields");

        return;
    }

    try {

        const storageRef = ref(
            storage,
            "products/" + Date.now() + "_" + file.name
        );

        await uploadBytes(storageRef, file);

        const imageUrl = await getDownloadURL(storageRef);

        await addDoc(collection(db, "products"), {

            name: name,
            price: Number(price),
            category: category,
            images: [imageUrl]
            
        });

        alert("Product uploaded successfully");

        loadProducts();

    } catch (error) {

        console.error(error);

        alert(error.message);

    }

};

/* ================= CART SYSTEM ================= */

let cart = JSON.parse(localStorage.getItem("zibuy-cart")) || [];

function saveCart() {

    localStorage.setItem(
        "zibuy-cart",
        JSON.stringify(cart)
    );

}

window.toggleCart = function () {

    document
        .getElementById("cart-sidebar")
        .classList.toggle("active");

};

window.addToCart = function (name, price) {

    const existing = cart.find(item => item.name === name);

    if (existing) {

        existing.qty += 1;

    } else {

        cart.push({
            name,
            price,
            qty: 1
        });

    }

    saveCart();

    renderCart();

};

function renderCart() {

    const container = document.getElementById("cart-items");

    const totalBox = document.getElementById("cart-total");

    if (!container) return;

    container.innerHTML = "";

    let total = 0;

    cart.forEach((item, index) => {

        total += item.price * item.qty;

        container.innerHTML += `

            <div class="cart-item">

                <div class="cart-item-info">

                    <h4>${item.name}</h4>

                    <p>
                        UGX ${item.price.toLocaleString()}
                    </p>

                    <div class="qty-controls">

                        <button onclick="changeQty(${index}, -1)">
                            -
                        </button>

                        <span>${item.qty}</span>

                        <button onclick="changeQty(${index}, 1)">
                            +
                        </button>

                    </div>

                    <button class="remove-btn"
                        onclick="removeCartItem(${index})">

                        Remove

                    </button>

                </div>

            </div>

        `;

    });

    totalBox.innerText = total.toLocaleString();

}

window.changeQty = function (index, change) {

    cart[index].qty += change;

    if (cart[index].qty <= 0) {

        cart.splice(index, 1);

    }

    saveCart();

    renderCart();

};

window.removeCartItem = function (index) {

    cart.splice(index, 1);

    saveCart();

    renderCart();

};

renderCart();

window.searchProducts = function () {

    loadProducts();

};

let activeCategory = "all";

window.filterCategory = function (category) {

    activeCategory = category;

    loadProducts();

};


window.openProduct = function (name, price, image) {

    document.getElementById("product-modal").style.display = "flex";

    document.getElementById("modal-name").innerText = name;

    document.getElementById("modal-price").innerText =
        "UGX " + price.toLocaleString();

    document.getElementById("modal-image").src = image;

    document.getElementById("modal-add-btn").onclick = function () {

        addToCart(name, price);

    };

};

window.closeProductModal = function () {

    document.getElementById("product-modal").style.display = "none";

};


window.checkout = async function () {

    if (cart.length === 0) {

        alert("Cart is empty");

        return;

    }

    const name = document
        .getElementById("customer-name")
        .value;

    const phone = document
        .getElementById("customer-phone")
        .value;

    const location = document
        .getElementById("customer-location")
        .value;

    if (!name || !phone || !location) {

        alert("Fill all customer details");

        return;

    }

    try {

        let total = 0;

        cart.forEach(item => {

            total += item.price * item.qty;

        });

        await addDoc(
            collection(db, "orders"),
            {
                customerName: name,
                customerPhone: phone,
                customerLocation: location,

                items: cart,

                total: total,

                createdAt: new Date()
            }
        );

        alert("Order placed successfully");

        cart = [];

        saveCart();

        renderCart();

        document.getElementById(
            "customer-name"
        ).value = "";

        document.getElementById(
            "customer-phone"
        ).value = "";

        document.getElementById(
            "customer-location"
        ).value = "";

    } catch (error) {

        console.error(error);

        alert("Checkout failed");

    }

};