import {
  db,
  auth,
  storage,
  collection,
  addDoc,
  getDocs,
  query,
  where,
  ref,
  uploadBytes,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

let logoFile = null;
let bannerFile = null;

document
.getElementById("logo-input")
.addEventListener("change", (e) => {

  logoFile = e.target.files[0];

  document
  .getElementById("logo-preview")
  .src =
    URL.createObjectURL(logoFile);

});

document
.getElementById("banner-input")
.addEventListener("change", (e) => {

  bannerFile = e.target.files[0];

  document
  .getElementById("banner-preview")
  .src =
    URL.createObjectURL(bannerFile);

});

window.saveShopProfile =
async function() {

  if (!auth.currentUser) {

    alert("Login first");

    return;
  }

  try {

    let logoUrl = "";
    let bannerUrl = "";

    // Upload logo
    if (logoFile) {

      const logoRef = ref(
        storage,
        `shop-logos/${
          auth.currentUser.uid
        }`
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

    // Upload banner
    if (bannerFile) {

      const bannerRef = ref(
        storage,
        `shop-banners/${
          auth.currentUser.uid
        }`
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

    await addDoc(
      collection(
        db,
        "business_profiles"
      ),
      {

        userId:
          auth.currentUser.uid,

        businessName,

        businessDescription,

        logo: logoUrl,

        banner: bannerUrl,

        createdAt: new Date()

      }
    );

    alert("✅ Shop updated");

  } catch (err) {

    console.error(err);

    alert("Failed");

  }

};