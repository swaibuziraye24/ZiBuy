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
    createUserWithEmailAndPassword,
    onAuthStateChanged,
    signOut
}
from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

let activeCategory = "all";

async function loadProducts() {

    const productsContainer =
        document.getElementById("products");

    if (!productsContainer) return;

    productsContainer.innerHTML =
        "<p>Loading products...</p>";

    try {

        const querySnapshot =
            await getDocs(
                collection(db, "products")
            );

        productsContainer.innerHTML = "";

        const searchValue =
            document
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

            const card =
                document.createElement("div");

            card.className = "product-card";

            // SAFE IMAGES
            const images =
                Array.isArray(product.images)
                ? product.images
                : [];

            card.innerHTML = `

<div class="product-image-box"
    onclick="window.location.href='product.html?id=${docSnap.id}'">

    <div class="slider">

        ${images.map((img, index) => `

            <img
                src="${img}"
                class="product-image ${index === 0 ? 'active' : ''}"
            >

        `).join("")}

    </div>

</div>

<div class="product-info">

    <h3 class="product-title">
        ${product.name}
    </h3>

    <p class="product-price">
        UGX ${Number(product.price).toLocaleString()}
    </p>

    <button
        class="cart-btn"
        onclick="addToCart(
            '${product.name}',
            ${product.price}
        )"
    >

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

    renderCart();

});

window.addProduct = async function () {

    if (!isAdmin) {

        alert("Admin only");

        return;

    }

    const name =
        document.getElementById("product-name").value;

    const price =
        document.getElementById("product-price").value;

    const category =
        document.getElementById("product-category").value;

    const files =
        document.getElementById("product-image").files;

    if (
        !name ||
        !price ||
        files.length === 0
    ) {

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

            await uploadBytes(
                storageRef,
                file
            );

            const url =
                await getDownloadURL(
                    storageRef
                );

            imageUrls.push(url);

        }

        await addDoc(
            collection(db, "products"),
            {
                name: name,
                price: Number(price),
                category: category,
                images: imageUrls,
                createdAt: new Date()
            }
        );

        alert("Product uploaded");

        document.getElementById(
            "product-name"
        ).value = "";

        document.getElementById(
            "product-price"
        ).value = "";

        document.getElementById(
            "product-image"
        ).value = "";

        document.getElementById(
            "preview-container"
        ).innerHTML = "";

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


};

function renderCart() {

    const container = document.getElementById("cart-items");

    const totalBox = document.getElementById("cart-total");


    if (!container || !totalBox) return;

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

    document.getElementById("cart-count").innerText =
    cart.length;

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



window.filterCategory = function (category) {

    activeCategory = category;

    loadProducts();

};


window.checkout = async function () {

    if (cart.length === 0) {

        alert("Cart is empty");

        return;

    }

    const customerName =
        document.getElementById(
            "customer-name"
        ).value.trim();

    const customerPhone =
        document.getElementById(
            "customer-phone"
        ).value.trim();

    const customerLocation =
        document.getElementById(
            "customer-location"
        ).value.trim();

    if (
        !customerName ||
        !customerPhone ||
        !customerLocation
    ) {

        alert("Fill all customer details");

        return;

    }

    try {

        let total = 0;

        cart.forEach(item => {

            total += item.price * item.qty;

        });

        // PROFESSIONAL ORDER ID
        const orderId =
            "ZB-" +
            Date.now();

        await addDoc(
            collection(db, "orders"),
            {

                orderId: orderId,

                customerName:
                    customerName,

                customerPhone:
                    customerPhone,

                customerLocation:
                    customerLocation,

                items: cart,

                total: total,

                status: "Pending",

                paymentMethod:
                    "Cash On Delivery",

                createdAt:
                    new Date()

            }
        );

        alert(
            "Order placed successfully"
        );

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

        toggleCart();

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

        let totalOrders = 0;
        let totalRevenue = 0;
        ordersContainer.innerHTML = "";

        snapshot.forEach((doc) => {
            const order = doc.data();
            const orderId = order.orderId || doc.id;

            totalOrders += 1;
            totalRevenue += order.total || 0;

            ordersContainer.innerHTML += `

<div class="order-card">

    <h3>
        ${orderId}
    </h3>

    <p>
        <strong>Customer:</strong>
        ${order.customerName}
    </p>

    <p>
        <strong>Phone:</strong>
        ${order.customerPhone}
    </p>

    <p>
        <strong>Location:</strong>
        ${order.customerLocation}
    </p>

    <p>
        <strong>Total:</strong>
        UGX ${order.total ? order.total.toLocaleString() : "0"}
    </p>

    <p>
        <strong>Status:</strong>
        ${order.status}
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



window.openAdmin = function () {

    const panel =
        document.getElementById("admin-panel");

    panel.style.display = "flex";

    panel.style.justifyContent = "center";

    panel.style.alignItems = "center";

    loadOrders();

};

window.closeAdmin = function () {

    document.getElementById(
        "admin-panel"
    ).style.display = "none";

};

let isAdmin = false;

window.isAdmin = isAdmin;

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

        window.isAdmin = true;

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


window.previewImages = function (event) {

    // SAFE CHECK (prevents crash)
    if (!event || !event.target || !event.target.files) {
        console.error("previewImages: missing event or files");
        return;
    }

    const container = document.getElementById("preview-container");
    if (!container) return;

    container.innerHTML = "";

    const files = Array.from(event.target.files);

    files.forEach(file => {

        if (!file.type || !file.type.startsWith("image/")) return;

        const reader = new FileReader();

        reader.onload = function (e) {

            const img = document.createElement("img");
            img.src = e.target.result;
            img.className = "preview-image";

            container.appendChild(img);
        };

        reader.readAsDataURL(file);
    });
};


window.openProduct = function(name, price, image){

    document.getElementById("product-modal").style.display = "flex";

    document.getElementById("modal-name").innerText = name;

    document.getElementById("modal-price").innerText =
        "UGX " + Number(price).toLocaleString();

    document.getElementById("modal-image").src = image;

    document.getElementById("modal-cart-btn").onclick = () => {

        addToCart(name, price);

    };

}

window.closeProductModal = function(){

    document.getElementById(
        "product-modal"
    ).style.display = "none";

}

/* ================= CUSTOMER ACCOUNTS ================= */

window.openCustomerModal = function () {

    document.getElementById(
        "customer-modal"
    ).style.display = "flex";

};

window.closeCustomerModal = function () {

    document.getElementById(
        "customer-modal"
    ).style.display = "none";

};

window.customerRegister = async function () {

    const email =
        document.getElementById(
            "customer-email"
        ).value;

    const password =
        document.getElementById(
            "customer-password"
        ).value;

    try {

        await createUserWithEmailAndPassword(
            auth,
            email,
            password
        );

        alert("Account created");

        closeCustomerModal();

    } catch (error) {

        alert(error.message);

    }

};

window.customerLogin = async function () {

    const email =
        document.getElementById(
            "customer-email"
        ).value;

    const password =
        document.getElementById(
            "customer-password"
        ).value;

    try {

        await signInWithEmailAndPassword(
            auth,
            email,
            password
        );

        alert("Login successful");

        closeCustomerModal();

    } catch (error) {

        alert(error.message);

    }

};

window.customerLogout = async function () {

    await signOut(auth);

    alert("Logged out");

};

onAuthStateChanged(auth, (user) => {

    const accountBtn =
        document.querySelector(
            ".topbar-actions .admin-btn"
        );

    if (!accountBtn) return;

    if (user) {

        accountBtn.innerText =
            user.email;

    } else {

        accountBtn.innerText =
            "Account";

    }

});

window.openCustomerModal = function(){

    alert("Customer account system coming next");

};

