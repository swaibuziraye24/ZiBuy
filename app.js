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