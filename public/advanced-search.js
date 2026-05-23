import { db, collection, getDocs, query, where } from "./firebase.js";

let allProducts = [];
let searchHistory = JSON.parse(localStorage.getItem("zibuy-search-history")) || [];
let savedSearches = JSON.parse(localStorage.getItem("zibuy-saved-searches")) || [];

async function loadProducts() {
  try {
    const snapshot = await getDocs(collection(db, "products"));
    allProducts = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    loadUI();
  } catch (err) {
    console.error(err);
  }
}

function loadUI() {
  renderSearchHistory();
  renderSavedSearches();
}

function renderSearchHistory() {
  const container = document.getElementById("search-history");
  if (searchHistory.length === 0) {
    container.innerHTML = "<p style='color:#adb5bd;font-size:12px'>No recent searches</p>";
    return;
  }

  container.innerHTML = searchHistory.slice(0, 5).map(search => `
    <button onclick="loadSearch('${search.keyword}', '${search.category}', ${search.priceMin}, ${search.priceMax}, '${search.location}')" 
            style="text-align:left;padding:8px;background:#f3f4f6;border:none;border-radius:6px;cursor:pointer;font-size:12px;color:#111827">
      🕒 ${search.keyword || 'All products'} ${search.category ? `• ${search.category}` : ''}
    </button>
  `).join("");
}

function renderSavedSearches() {
  const container = document.getElementById("saved-searches");
  if (savedSearches.length === 0) {
    container.innerHTML = "<p style='color:#adb5bd;font-size:12px'>No saved searches</p>";
    return;
  }

  container.innerHTML = savedSearches.map((search, i) => `
    <div style="background:#fff4ee;padding:8px;border-radius:6px;display:flex;justify-content:space-between;align-items:center;font-size:12px">
      <button onclick="loadSearch('${search.keyword}', '${search.category}', ${search.priceMin}, ${search.priceMax}, '${search.location}')" 
              style="border:none;background:none;cursor:pointer;color:#111827;text-align:left;flex:1">
        ⭐ ${search.keyword || 'All products'}
      </button>
      <button onclick="deleteSavedSearch(${i})" style="border:none;background:none;cursor:pointer;color:#ef4444;font-weight:700">×</button>
    </div>
  `).join("");
}

window.loadSearch = function(keyword, category, priceMin, priceMax, location) {
  document.getElementById("search-keyword").value = keyword;
  document.getElementById("search-category").value = category;
  document.getElementById("search-price-min").value = priceMin || "";
  document.getElementById("search-price-max").value = priceMax || "";
  document.getElementById("search-location").value = location;
  performSearch();
};

window.performSearch = function() {
  const keyword = document.getElementById("search-keyword").value.toLowerCase();
  const category = document.getElementById("search-category").value;
  const priceMin = Number(document.getElementById("search-price-min").value) || 0;
  const priceMax = Number(document.getElementById("search-price-max").value) || 999999999;
  const location = document.getElementById("search-location").value;
  const sort = document.getElementById("search-sort").value;

  // Add to search history
  if (keyword) {
    searchHistory.unshift({ keyword, category, priceMin, priceMax, location });
    searchHistory = searchHistory.slice(0, 20);
    localStorage.setItem("zibuy-search-history", JSON.stringify(searchHistory));
    renderSearchHistory();
  }

  // Filter products
  let results = allProducts.filter(p => {
    const matchKeyword = !keyword || p.name.toLowerCase().includes(keyword) || 
                         p.description?.toLowerCase().includes(keyword);
    const matchCategory = !category || p.category === category;
    const matchPrice = Number(p.price) >= priceMin && Number(p.price) <= priceMax;
    const matchLocation = !location || p.location === location;
    
    return matchKeyword && matchCategory && matchPrice && matchLocation;
  });

  // Sort
  if (sort === "price-low") {
    results.sort((a, b) => Number(a.price) - Number(b.price));
  } else if (sort === "price-high") {
    results.sort((a, b) => Number(b.price) - Number(a.price));
  } else if (sort === "trending") {
    results.sort((a, b) => (b.views || 0) - (a.views || 0));
  } else {
    results.sort((a, b) => b.createdAt.toDate() - a.createdAt.toDate());
  }

  // Show suggestions
  showSuggestions(keyword, category);

  // Render results
  renderResults(results);
};

function showSuggestions(keyword, category) {
  const suggestionsBox = document.getElementById("suggestions-box");
  const suggestionsList = document.getElementById("suggestions-list");

  if (!keyword && !category) {
    suggestionsBox.style.display = "none";
    return;
  }

  // Get related products
  let suggestions = allProducts.filter(p => 
    (!keyword || p.name.toLowerCase().includes(keyword)) && 
    (!category || p.category === category)
  ).slice(0, 4);

  if (suggestions.length === 0) {
    suggestionsBox.style.display = "none";
    return;
  }

  suggestionsBox.style.display = "block";
  suggestionsList.innerHTML = suggestions.map(p => `
    <div style="background:#f9fafb;padding:10px;border-radius:10px;cursor:pointer;text-align:center" 
         onclick="window.location.href='product.html?id=${p.id}'">
      <img src="${p.images?.[0] || ''}" style="width:100%;height:80px;object-fit:cover;border-radius:6px;margin-bottom:6px">
      <p style="margin:0;font-size:12px;font-weight:700;color:#111827">${p.name.substring(0, 20)}...</p>
      <p style="margin:4px 0 0;font-size:11px;color:#ff6600;font-weight:700">UGX ${Number(p.price).toLocaleString()}</p>
    </div>
  `).join("");
}

function renderResults(results) {
  const container = document.getElementById("search-results");

  if (results.length === 0) {
    container.innerHTML = `
      <div style="text-align:center;padding:40px 20px;color:#6b7280">
        <p style="font-size:32px;margin-bottom:12px">🔍</p>
        <p>No products found</p>
        <p style="font-size:13px;margin-top:6px">Try different keywords or filters</p>
      </div>
    `;
    return;
  }

  const grid = document.createElement("div");
  grid.style.cssText = "display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px";

  results.forEach(p => {
    const card = document.createElement("div");
    card.className = "product-card";
    card.innerHTML = `
      <div class="product-image-box" onclick="window.location.href='product.html?id=${p.id}'">
        <img src="${p.images?.[0] || ''}" alt="${p.name}" style="width:100%;height:150px;object-fit:cover;border-radius:8px">
        <button class="save-btn" onclick="event.stopPropagation(); this.textContent = this.textContent === '🤍' ? '❤️' : '🤍'">🤍</button>
      </div>
      <div style="padding:10px">
        <p style="margin:0;font-size:12px;color:#6b7280">${p.category}</p>
        <h3 style="margin:4px 0;font-size:14px;font-weight:700;color:#111827">${p.name}</h3>
        <p style="margin:4px 0;color:#ff6600;font-weight:700">UGX ${Number(p.price).toLocaleString()}</p>
        <p style="margin:4px 0;font-size:12px;color:#6b7280">📍 ${p.location || 'Uganda'}</p>
      </div>
    `;
    grid.appendChild(card);
  });

  container.innerHTML = `
    <div>
      <p style="font-weight:700;margin-bottom:12px">Found ${results.length} products</p>
      ${grid.outerHTML}
    </div>
  `;
}

window.saveSearch = function() {
  const keyword = document.getElementById("search-keyword").value;
  const category = document.getElementById("search-category").value;
  const priceMin = Number(document.getElementById("search-price-min").value) || 0;
  const priceMax = Number(document.getElementById("search-price-max").value) || 0;
  const location = document.getElementById("search-location").value;

  if (!keyword) {
    alert("Enter a keyword to save");
    return;
  }

  const searchObj = { keyword, category, priceMin, priceMax, location };
  
  if (!savedSearches.find(s => s.keyword === keyword && s.category === category)) {
    savedSearches.push(searchObj);
    localStorage.setItem("zibuy-saved-searches", JSON.stringify(savedSearches));
    renderSavedSearches();
    alert("✅ Search saved!");
  } else {
    alert("This search is already saved");
  }
};

window.deleteSavedSearch = function(index) {
  savedSearches.splice(index, 1);
  localStorage.setItem("zibuy-saved-searches", JSON.stringify(savedSearches));
  renderSavedSearches();
};

window.clearFilters = function() {
  document.getElementById("search-keyword").value = "";
  document.getElementById("search-category").value = "";
  document.getElementById("search-price-min").value = "";
  document.getElementById("search-price-max").value = "";
  document.getElementById("search-location").value = "";
  document.getElementById("search-sort").value = "newest";
  document.getElementById("suggestions-box").style.display = "none";
  document.getElementById("search-results").innerHTML = "";
};

window.updateSuggestions = function() {
  const keyword = document.getElementById("search-keyword").value.toLowerCase();
  const category = document.getElementById("search-category").value;
  showSuggestions(keyword, category);
};

loadProducts();