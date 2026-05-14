import {
    doc,
    getDoc
}
from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import { db } from "./firebase.js";

const params =
    new URLSearchParams(
        window.location.search
    );

const id = params.get("id");

async function loadProduct(){

    if(!id) return;

    const ref = doc(db, "products", id);

    const snap = await getDoc(ref);

    if(!snap.exists()) return;

    const product = snap.data();

    document.getElementById(
        "product-name"
    ).innerText = product.name;

    document.getElementById(
        "product-price"
    ).innerText =
        "UGX " +
        Number(product.price).toLocaleString();

    document.getElementById(
        "product-image"
    ).src = product.images[0];

}

loadProduct();