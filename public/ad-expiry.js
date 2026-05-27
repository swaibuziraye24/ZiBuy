import {
  db,
  collection,
  getDocs,
  query,
  where,
  updateDoc,
  doc
} from "./firebase.js";

export async function expireOldAds() {

  try {

    const snapshot =
      await getDocs(
        query(
          collection(db, "products"),
          where("status", "==", "active")
        )
      );

    const now =
      new Date();

    for (const product of snapshot.docs) {

      const data =
        product.data();

      if (!data.expiresAt) continue;

      const expiry =
        data.expiresAt.toDate();

      if (now > expiry) {

        await updateDoc(
          doc(
            db,
            "products",
            product.id
          ),
          {
            status: "expired"
          }
        );

        console.log(
          "Expired:",
          product.id
        );

      }

    }

  } catch (err) {

    console.error(
      "Expiry system error:",
      err
    );

  }

}