import { db, auth, collection, addDoc, getDocs, query, where } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

let currentUser = null;

onAuthStateChanged(auth, (user) => {
  currentUser = user;
});

export async function submitReview(sellerId, productId, rating, reviewText) {
  if (!currentUser) {
    alert("You must be logged in to review");
    return;
  }

  try {
    await addDoc(collection(db, "reviews"), {
      sellerId,
      productId,
      rating: Number(rating),
      text: reviewText.trim(),
      reviewerEmail: currentUser.email,
      createdAt: new Date(),
      helpful: 0
    });

    return true;
  } catch (err) {
    console.error(err);
    return false;
  }
}

export async function getSellerReviews(sellerId) {
  try {
    const snapshot = await getDocs(query(collection(db, "reviews"), where("sellerId", "==", sellerId)));
    const reviews = [];
    let totalRating = 0;

    snapshot.forEach((doc) => {
      const review = doc.data();
      reviews.push(review);
      totalRating += review.rating;
    });

    const avgRating = reviews.length > 0 ? (totalRating / reviews.length).toFixed(1) : 0;

    return { reviews, avgRating, count: reviews.length };
  } catch (err) {
    console.error(err);
    return { reviews: [], avgRating: 0, count: 0 };
  }
}

export async function getProductReviews(productId) {
  try {
    const snapshot = await getDocs(query(collection(db, "reviews"), where("productId", "==", productId)));
    const reviews = [];

    snapshot.forEach((doc) => {
      reviews.push(doc.data());
    });

    return reviews;
  } catch (err) {
    console.error(err);
    return [];
  }
}

export function renderStars(rating) {
  return "⭐".repeat(Math.floor(rating)) + (rating % 1 >= 0.5 ? "✨" : "");
}