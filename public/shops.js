import {
  db,
  collection,
  getDocs
} from "./firebase.js";

let allShops = [];

loadShops();

async function loadShops() {

  const container =
    document.getElementById("shops-container");

  try {

    const snapshot =
      await getDocs(
        collection(db, "products")
      );

    const uniqueShops = {};

    snapshot.forEach((docSnap) => {

      const product = docSnap.data();

      if (!product.userId) return;

      if (!uniqueShops[product.userId]) {

        uniqueShops[product.userId] = {

          userId: product.userId,

          seller:
            product.seller || {},

          totalProducts: 1

        };

      } else {

        uniqueShops[
          product.userId
        ].totalProducts++;

      }

    });

    allShops =
      Object.values(uniqueShops);

    renderShops(allShops);

  } catch (err) {

    console.error(err);

    container.innerHTML =
      "<p>Failed to load shops</p>";

  }

}

function renderShops(shops) {

  const container =
    document.getElementById("shops-container");

  if (shops.length === 0) {

    container.innerHTML =
      "<p>No shops found</p>";

    return;
  }

  container.innerHTML =
    shops.map((shop) => `

      <div
        class="shop-card"
        onclick="
          window.location.href=
          'shop.html?seller=${shop.userId}'
        "
      >

        <div class="shop-name">

          🏪
          ${shop.seller.name || "ZiBuy Shop"}

          ${
            shop.seller.isVerified
            ? "✅"
            : ""
          }

        </div>

        <div class="shop-meta">

          📍
          ${shop.seller.location || "Uganda"}

        </div>

        <div class="shop-meta">

          📦
          ${shop.totalProducts}
          listings

        </div>

        <button class="shop-btn">
          Visit Shop
        </button>

      </div>

    `).join("");

}

window.searchShops = function() {

  const value =
    document.getElementById("shop-search")
    .value
    .toLowerCase();

  const filtered =
    allShops.filter((shop) => {

      const name =
        (
          shop.seller.name || ""
        ).toLowerCase();

      return name.includes(value);

    });

  renderShops(filtered);

};