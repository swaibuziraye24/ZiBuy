import {
  db,
  storage,
  auth,
  collection,
  addDoc
} from "./firebase.js";

import {
  ref,
  uploadBytes,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

import { showToast } from "./app.js";

window.submitVerification = async function () {

  const user = auth.currentUser;

  if (!user) {
    showToast("Login first", "error");
    return;
  }

  const name = document.getElementById("verify-name").value.trim();
  const phone = document.getElementById("verify-phone").value.trim();
  const nin = document.getElementById("verify-nin").value.trim();

  const idFile =
    document.getElementById("verify-id-image").files[0];

  const selfieFile =
    document.getElementById("verify-selfie").files[0];

  if (!name || !phone || !nin || !idFile || !selfieFile) {
    showToast("Fill all fields", "error");
    return;
  }

  try {

    // Upload ID
    const idRef = ref(
      storage,
      `verifications/${Date.now()}_${idFile.name}`
    );

    await uploadBytes(idRef, idFile);

    const idUrl = await getDownloadURL(idRef);

    // Upload selfie
    const selfieRef = ref(
      storage,
      `verifications/${Date.now()}_${selfieFile.name}`
    );

    await uploadBytes(selfieRef, selfieFile);

    const selfieUrl = await getDownloadURL(selfieRef);

    // Save request
    await addDoc(collection(db, "verificationRequests"), {
      uid: user.uid,
      sellerName: name,
      phone,
      nationalId: nin,
      idImage: idUrl,
      selfieImage: selfieUrl,
      status: "pending",
      createdAt: new Date()
    });

    showToast(
      "Verification submitted successfully ✅",
      "success"
    );

  } catch (err) {

    console.error(err);

    showToast(
      "Verification failed",
      "error"
    );

  }

};