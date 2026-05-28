import {
  db,
  collection,
  getDocs
} from "./firebase.js";

let allProducts = [];

window.performSearch = async function () {

  const keyword =
    document.getElementById("search-keyword").value.toLowerCase();

  const category =
    document.getElementById("search-category").value;

  const min =
    Number(document.getElementById("search-price-min").value || 0);

  const max =
    Number(document.getElementById("search-price-max").value || Infinity);

  const location =
    document.getElementById("search-location").value;

  const resultsContainer =
    document.getElementById("search-results");

  try {

    if (allProducts.length === 0) {

      const snap =
        await getDocs(collection(db, "products"));

      allProducts =
        snap.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
    }

    let filtered = allProducts.filter(product => {

      const matchesKeyword =
        !keyword ||
        product.name?.toLowerCase().includes(keyword);

      const matchesCategory =
        !category ||
        product.category === category;

      const matchesPrice =
        Number(product.price || 0) >= min &&
        Number(product.price || 0) <= max;

      const matchesLocation =
        !location ||
        product.location === location;

      return (
        matchesKeyword &&
        matchesCategory &&
        matchesPrice &&
        matchesLocation
      );
    });

    if (filtered.length === 0) {

      resultsContainer.innerHTML = `
        <div style="padding:20px;text-align:center">
          No products found.
        </div>
      `;

      return;
    }

    resultsContainer.innerHTML =
      filtered.map(product => `

        <div class="product-card">

          <img
            src="${product.images?.[0] || ''}"
            style="width:100%;height:180px;object-fit:cover"
          >

          <h3>${product.name}</h3>

          <p>
            UGX ${Number(product.price).toLocaleString()}
          </p>

          <p>
            📍 ${product.location || "Uganda"}
          </p>

        </div>

      `).join("");

  } catch (err) {

    console.error(err);

    resultsContainer.innerHTML = `
      <div style="color:red;padding:20px">
        Failed to load search results
      </div>
    `;
  }
};

window.clearFilters = function () {

  document.getElementById("search-keyword").value = "";
  document.getElementById("search-category").value = "";
  document.getElementById("search-price-min").value = "";
  document.getElementById("search-price-max").value = "";
  document.getElementById("search-location").value = "";

  performSearch();
};

window.updateSuggestions = function () {};
window.saveSearch = function () {};

performSearch();