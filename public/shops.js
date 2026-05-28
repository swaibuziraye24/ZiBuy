import {
  db,
  collection,
  getDocs
} from "./firebase.js";

import { getRankedShops } from "./ranking-service.js";

let allShops = [];

loadShops();

async function loadShops() {

  const container = document.getElementById("shops-container");

  try {

    const shops = await getRankedShops();

    if (shops.length === 0) {
      container.innerHTML = "<p>No shops found</p>";
      return;
    }

    container.innerHTML = shops.map((shop) => `
      <div class="shop-card"
        onclick="window.location.href='shop.html?seller=${shop.userId}'">

        <div class="shop-name">
          🏪 Shop ${shop.userId.slice(0,6)}
        </div>

        <div class="shop-meta">
          📦 ${shop.totalAds} listings
        </div>

        <div class="shop-meta">
          ⭐ Rank Score: ${shop.rankScore}
        </div>

        <button class="shop-btn">
          Visit Shop
        </button>

      </div>
    `).join("");

  } catch (err) {
    console.error(err);
    container.innerHTML = "<p>Failed to load shops</p>";
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

      <div class="shop-card"
        onclick="window.location.href='shop.html?seller=${shop.userId}'">

        <div class="shop-name">
          🏪 ${shop.userId || "ZiBuy Shop"}
          ${shop.seller.isVerified ? "✅" : ""}
        </div>

        <div class="shop-meta">
          📍 ${shop.totalAds || "Uganda"}
        </div>

        <div class="shop-meta">
          📦 ${shop.plan || 0} listings
        </div>

        <button class="shop-btn">
          Visit Shop
        </button>

      </div>

    `).join("");

}

window.searchShops = function () {

  const value =
    document.getElementById("shop-search")
      .value
      .toLowerCase();

  const filtered =
    allShops.filter((shop) => {

      const name =
        (shop.seller.name || "").toLowerCase();

      return name.includes(value);

    });

  renderShops(filtered);

};