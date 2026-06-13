import {
  db,
  collection,
  getDocs
} from "./firebase.js";

import { getRankedShops } from "./ranking-service.js";

let allShops = [];

loadShops();

/* ================= LOAD SHOPS ================= */

async function loadShops() {

  const container =
    document.getElementById("shops-container");

  try {

    const shops =
      await getRankedShops();

    allShops = shops;

    if (shops.length === 0) {

      container.innerHTML = `
        <div class="empty-state">
          No shops found
        </div>
      `;

      return;
    }

    renderShops(shops);

  } catch (err) {

    console.error(err);

    container.innerHTML = `
      <div class="empty-state">
        Failed to load shops
      </div>
    `;
  }
}

/* ================= RENDER SHOPS ================= */

function renderShops(shops) {

  const container =
    document.getElementById("shops-container");

  if (!container) return;

  container.innerHTML =
    shops.map((shop) => `

      <div
        class="shop-card"
        onclick="window.location.href='shop.html?seller=${shop.ownerId || shop.userId}'"
      >

        <div class="shop-top">

          ${
            shop.logoUrl
              ? `
                <img
                  src="${shop.logoUrl}"
                  class="shop-avatar"
                  style="
                    object-fit:cover;
                    border:2px solid #ff6600;
                  "
                >
              `
              : `
                <div class="shop-avatar">
                  ${
                    shop.name
                      ? shop.name.charAt(0).toUpperCase()
                      : "Z"
                  }
                </div>
              `
          }

          <div class="shop-info">

            <div class="shop-name">

              ${shop.name || "ZiBuy Shop"}

              ${
                shop.isVerified
                  ? " ✅"
                  : ""
              }

              ${
                shop.plan === "gold"
                  ? " 🥇"
                  : shop.plan === "silver"
                  ? " 🥈"
                  : shop.plan === "bronze"
                  ? " 🥉"
                  : ""
              }

            </div>

            <div class="shop-meta">
              📍 ${shop.location || "Uganda"}
            </div>

            <div class="shop-meta">
              📦 ${shop.totalAds || 0} Listings
            </div>

            <div class="shop-meta">
              🏷️ ${
                shop.categories?.length
                  ? shop.categories.slice(0,2).join(", ")
                  : "General"
              }
            </div>

          </div>

        </div>

        <button class="shop-btn">
          Visit Shop
        </button>

      </div>

    `).join("");
}

/* ================= SEARCH ================= */

window.searchShops = function () {

  const value =
    document.getElementById("shop-search")
      .value
      .toLowerCase();

  const filtered =
    allShops.filter((shop) => {

      const name =
        (shop.name || "")
          .toLowerCase();

      return name.includes(value);

    });

  renderShops(filtered);
};