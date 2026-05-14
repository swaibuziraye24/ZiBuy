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

import {
    signInWithEmailAndPassword,
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

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

    <div class="product-image-box"
        onclick="openProduct(
            '${product.name}',
            ${product.price},
            '${product.images[0]}'
        )">

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

        <button class="cart-btn"
            onclick="addToCart(
                '${product.name}',
                ${product.price}
            )">

            Add To Cart

        </button>

    </div>

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

    const files =
    document.getElementById("product-image").files;

const category = document.getElementById(
    "product-category"
).value;

     if (!name || !price || files.length === 0){

        alert("Fill all fields");

        return;
    }

    try {

        let imageUrls = [];

for (const file of files) {

    const storageRef = ref(
        storage,
        "products/" +
        Date.now() +
        "_" +
        file.name
    );

    await uploadBytes(storageRef, file);

    const url =
        await getDownloadURL(storageRef);

    imageUrls.push(url);

}
        await addDoc(collection(db, "products"), {

            name: name,
            price: Number(price),
            category: category,
            images: imageUrls
            
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


async function loadOrders() {

    const ordersContainer =
        document.getElementById(
            "admin-orders"
        );

    ordersContainer.innerHTML =
        "Loading orders...";

    try {

        const snapshot = await getDocs(
            collection(db, "orders")
        );

        ordersContainer.innerHTML = "";

        let totalOrders = 0;
        let totalRevenue = 0;

        snapshot.forEach(doc => {

            const order = doc.data();

            totalOrders++;

            totalRevenue += order.total;

            ordersContainer.innerHTML += `

                <div class="order-card">

                    <h4>
                        ${order.customerName}
                    </h4>

                    <p>
                        ${order.customerPhone}
                    </p>

                    <p>
                        ${order.customerLocation}
                    </p>

                    <p>
                        Total:
                        UGX ${order.total.toLocaleString()}
                    </p>

                </div>

            `;

        });

        document.getElementById(
            "total-orders"
        ).innerText = totalOrders;

        document.getElementById(
            "total-revenue"
        ).innerText =
            "UGX " +
            totalRevenue.toLocaleString();

    } catch (error) {

        console.error(error);

    }

}

window.openProduct = function(name, price, image) {

    document.getElementById("product-modal").style.display = "flex";

    document.getElementById("modal-name").innerText = name;

    document.getElementById("modal-price").innerText =
        "UGX " + Number(price).toLocaleString();

    document.getElementById("modal-image").src = image;

    document.getElementById("modal-add-btn").onclick = () => {

        addToCart(name, price);

    };
};

window.closeProductModal = function() {

    document.getElementById("product-modal").style.display = "none";

};

window.onclick = function(e) {

    const modal = document.getElementById("product-modal");

    if (e.target === modal) {

        modal.style.display = "none";

    }
};


window.openAdmin = function () {

    document.getElementById(
        "admin-panel"
    ).style.display = "flex";

    loadOrders();

};

window.closeAdmin = function () {

    document.getElementById(
        "admin-panel"
    ).style.display = "none";

};

let isAdmin = false;

window.openAdminLogin = function () {

    document.getElementById(
        "admin-login-modal"
    ).style.display = "flex";

};

window.closeAdminLogin = function () {

    document.getElementById(
        "admin-login-modal"
    ).style.display = "none";

};

window.adminLogin = async function () {

    const email =
        document.getElementById("admin-email").value;

    const password =
        document.getElementById("admin-password").value;

    try {

        const result =
            await signInWithEmailAndPassword(
                auth,
                email,
                password
            );

        // ONLY YOUR ADMIN EMAIL
        if (
            result.user.email !==
            "swaibuziraye22@gmail.com"
        ) {

            alert("Not authorized");

            await signOut(auth);

            return;
        }

        isAdmin = true;

        closeAdminLogin();

        openAdmin();

    } catch (error) {

        alert(error.message);

    }

};

onAuthStateChanged(auth, (user) => {

    if (
        user &&
        user.email ===
        "swaibuziraye22@gmail.com"
    ) {

        isAdmin = true;

    } else {

        isAdmin = false;

        const panel =
            document.getElementById("admin-panel");

        if(panel){

            panel.style.display = "none";

        }
    }

});

window.previewImages = function(event){

    const container =
        document.getElementById(
            "preview-container"
        );

    container.innerHTML = "";

    const files = event.target.files;

    for(const file of files){

        const reader = new FileReader();

        reader.onload = function(e){

            const img =
                document.createElement("img");

            img.src = e.target.result;

            img.className =
                "preview-image";

            container.appendChild(img);

        };

        reader.readAsDataURL(file);

    }
};