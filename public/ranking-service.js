import { db, collection, getDocs, query, where } from "./firebase.js";

/* =========================
   GET USER PLAN SCORE
========================= */
export const PLAN_SCORE = {
  free: 1,
  bronze: 2,
  silver: 3,
  gold: 4
};

/* =========================
   GET USER SUBSCRIPTION
========================= */
export async function getUserPlan(userId) {
  if (!userId) return "free"; // 🔥 BLOCK undefined BEFORE QUERY

  try {
    const snap = await getDocs(
      query(
        collection(db, "business_accounts"),
        where("userId", "==", userId),
        where("status", "==", "active")
      )
    );

    if (snap.empty) return "free";

    const data = snap.docs[0].data();
    return data.plan || "free";

  } catch (err) {
    console.error("getUserPlan error:", err);
    return "free";
  }
}

/* =========================
   CALCULATE SHOP RANK
========================= */
export async function calculateShopRank(userId) {
  if (!userId) {
    return {
      userId: null,
      plan: "free",
      totalAds: 0,
      rankScore: 0
    };
  }

  try {
    const plan = await getUserPlan(userId);

    const productsSnap = await getDocs(
      query(
        collection(db, "products"),
        where("userId", "==", userId),
        where("status", "==", "active")
      )
    );

    const totalAds = productsSnap.size;
    const planScore = PLAN_SCORE[plan] || 1;

    const rankScore =
      (planScore * 1000) +
      (totalAds * 10);

    return {
      userId,
      plan,
      totalAds,
      rankScore
    };

  } catch (err) {
    console.error(err);
    return {
      userId,
      plan: "free",
      totalAds: 0,
      rankScore: 0
    };
  }
}

/* =========================
   GET ALL SHOPS RANKED
========================= */
export async function getRankedShops() {
  try {
    const snap = await getDocs(collection(db, "products"));

    const shopsMap = {};

    snap.forEach(doc => {
      const p = doc.data();

      if (!p.userId) return;

      if (!shopsMap[p.userId]) {
        shopsMap[p.userId] = {
          userId: p.userId,
          totalAds: 0
        };
      }

      shopsMap[p.userId].totalAds++;
    });

    const shops = Object.values(shopsMap);

    const ranked = await Promise.all(

  shops.map(async(shop) => {

    const plan =
      await getUserPlan(shop.userId);

    const planScore =
      PLAN_SCORE[plan] || 1;

    return {
      ...shop,
      plan,
      rankScore:
        (planScore * 1000) +
        (shop.totalAds * 10)
    };

  })

);

    return ranked.sort((a, b) => b.rankScore - a.rankScore);

  } catch (err) {
    console.error(err);
    return [];
  }
}

/* =========================
   GET FEATURED PRODUCTS
========================= */
export async function getRankedProducts() {
  try {
    const snap = await getDocs(collection(db, "products"));

    const products = [];

    snap.forEach(doc => {
      const p = doc.data();

      if (p.status !== "active") return;

      let boostScore = 0;

      // BOOST PRIORITY
      if (p.boost?.active === true) {
  boostScore += 1000;
}

      const created = p.createdAt?.toDate?.() || new Date();
      const ageHours = (new Date() - created) / 36e5;

      // freshness boost
      const timeScore = Math.max(0, 100 - ageHours);

      products.push({
        ...p,
        boostScore,
        timeScore,
        finalScore: boostScore + timeScore
      });
    });

    return products.sort((a, b) => b.finalScore - a.finalScore);

  } catch (err) {
    console.error(err);
    return [];
  }
}