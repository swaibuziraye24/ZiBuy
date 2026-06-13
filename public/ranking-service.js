import { db, collection, getDocs, doc, getDoc, query, where } from "./firebase.js";

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
  if (!userId) return "free";
  try {
    const snap = await getDoc(doc(db, "users", userId));
    if (!snap.exists()) return "free";
    return snap.data().plan || "free";
  } catch (err) {
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

    const shopsSnap =
      await getDocs(collection(db, "shops"));

    const shops = await Promise.all(

      shopsSnap.docs.map(async (shopDoc) => {

        const shop = shopDoc.data();

        const productsSnap = await getDocs(
          query(
            collection(db, "products"),
            where("userId", "==", shop.ownerId),
            where("status", "==", "active")
          )
        );

        const totalAds =
          productsSnap.size;

        const plan =
          shop.plan || "free";

        const planScore =
          PLAN_SCORE[plan] || 1;

        return {

          userId:
            shop.ownerId,

          name:
            shop.name || "ZiBuy Shop",

          logoUrl:
            shop.logoUrl || "",

          bannerUrl:
            shop.bannerUrl || "",

          description:
            shop.description || "",

          location:
            shop.location || "Uganda",

          phone:
            shop.phone || "",

          whatsapp:
            shop.whatsapp || "",

          email:
            shop.email || "",

          categories:
            shop.categories || [],

          isVerified:
            shop.isVerified || false,

          plan,

          totalAds,

          rankScore:
            (planScore * 1000) +
            (totalAds * 10)

        };

      })

    );

    return shops.sort(
      (a, b) =>
        b.rankScore - a.rankScore
    );

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