import {
  db,
  auth,
  storage,
  doc,
  setDoc,
  getDoc
} from "./firebase.js";

import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import {
  ref,
  uploadBytes,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

let logoFile = null;
let bannerFile = null;

let existingLogo = "";
let existingBanner = "";

/* =========================================
   IMAGE PREVIEW
========================================= */

document
.getElementById("logo-input")
.addEventListener("change", (e) => {

  logoFile = e.target.files[0];

  if (logoFile) {

    document
    .getElementById("logo-preview")
    .src = URL.createObjectURL(logoFile);

  }

});

document
.getElementById("banner-input")
.addEventListener("change", (e) => {

  bannerFile = e.target.files[0];

  if (bannerFile) {

    document
    .getElementById("banner-preview")
    .src = URL.createObjectURL(bannerFile);

  }

});

/* =========================================
   LOAD EXISTING SHOP
========================================= */

onAuthStateChanged(auth, async (user) => {

  if (!user) return;

  try {

    const shopRef = doc(
      db,
      "business_profiles",
      user.uid
    );

    const snap = await getDoc(shopRef);

    if (!snap.exists()) return;

    const data = snap.data();

    document.getElementById(
      "business-name"
    ).value =
      data.businessName || "";

    document.getElementById(
      "business-description"
    ).value =
      data.businessDescription || "";

    existingLogo =
      data.logo || "";

    existingBanner =
      data.banner || "";

    if (existingLogo) {

      document.getElementById(
        "logo-preview"
      ).src = existingLogo;

    }

    if (existingBanner) {

      document.getElementById(
        "banner-preview"
      ).src = existingBanner;

    }

  } catch (err) {

    console.error(
      "Load shop error:",
      err
    );

  }

});

/* =========================================
   SAVE SHOP PROFILE
========================================= */

window.saveShopProfile =
async function () {

  if (!auth.currentUser) {

    alert("Login first");

    return;

  }

  try {

    const saveBtn =
      document.getElementById(
        "save-btn"
      );

    saveBtn.disabled = true;
    saveBtn.textContent =
      "Saving...";

    let logoUrl =
      existingLogo;

    let bannerUrl =
      existingBanner;

    /* Upload logo */
    if (logoFile) {

      const logoRef = ref(
        storage,
        `shop-logos/${auth.currentUser.uid}`
      );

      await uploadBytes(
        logoRef,
        logoFile
      );

      logoUrl =
        await getDownloadURL(
          logoRef
        );

    }

    /* Upload banner */
    if (bannerFile) {

      const bannerRef = ref(
        storage,
        `shop-banners/${auth.currentUser.uid}`
      );

      await uploadBytes(
        bannerRef,
        bannerFile
      );

      bannerUrl =
        await getDownloadURL(
          bannerRef
        );

    }

    const businessName =
      document.getElementById(
        "business-name"
      ).value.trim();

    const businessDescription =
      document.getElementById(
        "business-description"
      ).value.trim();

    await setDoc(
      doc(
        db,
        "business_profiles",
        auth.currentUser.uid
      ),
      {

        userId:
          auth.currentUser.uid,

        businessName,

        businessDescription,

        logo: logoUrl,

        banner: bannerUrl,

        updatedAt: new Date()

      },
      { merge: true }
    );

    alert(
      "✅ Business profile updated"
    );

  } catch (err) {

    console.error(err);

    alert(
      "Failed to update profile"
    );

  } finally {

    const saveBtn =
      document.getElementById(
        "save-btn"
      );

    saveBtn.disabled = false;
    saveBtn.textContent =
      "Save Business Profile";

  }

};