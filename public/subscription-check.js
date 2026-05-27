import {
  db,
  collection,
  query,
  where,
  getDocs,
  updateDoc,
  doc
} from "./firebase.js";

import { PLANS } from "./business-plans.js";

/* =========================================
   GET ACTIVE SUBSCRIPTION
========================================= */

export async function getActiveSubscription(userId) {

  const snapshot = await getDocs(
    query(
      collection(db, "business_accounts"),
      where("userId", "==", userId),
      where("status", "==", "active")
    )
  );

  if (snapshot.empty) {

    return {
      plan: "free",
      details: PLANS.free
    };

  }

  const subscription =
    snapshot.docs[0];

  const data =
    subscription.data();

  /* CHECK EXPIRY */

  if (data.endDate) {

    const now =
      new Date();

    const end =
      data.endDate.toDate();

    if (now > end) {

      /* EXPIRE PLAN */

      await updateDoc(
        doc(
          db,
          "business_accounts",
          subscription.id
        ),
        {
          status: "expired"
        }
      );

      return {
        plan: "free",
        details: PLANS.free
      };

    }

  }

  return {
    id: subscription.id,
    plan: data.plan,
    details: PLANS[data.plan] || PLANS.free
  };

}

/* =========================================
   CHECK IF USER CAN POST
========================================= */

export async function canUserPost(userId) {

  const sub =
    await getActiveSubscription(userId);

  const plan =
    sub.details;

  /* COUNT ACTIVE ADS */

  const adsSnapshot =
    await getDocs(
      query(
        collection(db, "products"),
        where("userId", "==", userId),
        where("status", "==", "active")
      )
    );

  const totalAds =
    adsSnapshot.size;

  /* GOLD = UNLIMITED */

  if (plan.maxAds === Infinity) {

    return {
      allowed: true,
      remaining: Infinity,
      plan: plan.name
    };

  }

  /* LIMIT REACHED */

  if (totalAds >= plan.maxAds) {

    return {
      allowed: false,
      remaining: 0,
      plan: plan.name
    };

  }

  return {
    allowed: true,
    remaining:
      plan.maxAds - totalAds,
    plan: plan.name
  };

}