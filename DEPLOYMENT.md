## ZiBuy Deployment Guide

### STEP 1: Install Firebase CLI
```bash
npm install -g firebase-tools
```

### STEP 2: Login to Firebase
```bash
firebase login
```

### STEP 3: Initialize Firebase in ZiBuy Folder
```bash
cd ZiBuy
firebase init hosting
```
When prompted:
- Select: **zibuy-5deae** (your project)
- Public directory: **.**  (current folder)
- Configure as SPA: **Yes**
- Overwrite index.html: **No**

### STEP 4: Create firebase.json
```json
{
  "hosting": {
    "public": ".",
    "ignore": [
      "firebase.json",
      "**/.*",
      "**/node_modules/**"
    ],
    "rewrites": [
      {
        "source": "**",
        "destination": "/index.html"
      }
    ]
  }
}
```

### STEP 5: Create .firebaserc
```json
{
  "projects": {
    "default": "zibuy-5deae"
  }
}
```

### STEP 6: Deploy
```bash
firebase deploy
```

Your site will be live at: **https://zibuy-5deae.web.app**

### STEP 7: Custom Domain (Optional)
```bash
firebase hosting:channel:deploy live
```

---

## Post-Deployment Checklist

✅ Test all pages load (index, product, post-ad, dashboard, payment, messages, notifications)
✅ Test auth (register, login, logout)
✅ Test post ad & save to Firestore
✅ Test cart & checkout
✅ Test messaging
✅ Test reviews
✅ Check Firestore rules (public read, authenticated write)
✅ Test on mobile

---

## Firestore Security Rules

Paste this in Firestore → Rules:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Products - anyone can read, only auth can write
    match /products/{document=**} {
      allow read: if true;
      allow create: if request.auth != null;
      allow update, delete: if request.auth.uid == resource.data.userId;
    }

    // Orders - only owner can read/write
    match /orders/{document=**} {
      allow read, write: if request.auth.uid == resource.data.userId || 
                            request.auth.email == resource.data.userEmail;
    }

    // Reviews - anyone can read, auth can write
    match /reviews/{document=**} {
      allow read: if true;
      allow create: if request.auth != null;
      allow delete: if request.auth.uid == resource.data.userId;
    }

    // Messages - only participants can read
    match /messages/{document=**} {
      allow read: if request.auth.email in resource.data.participants;
      allow create: if request.auth != null && 
                       request.auth.email in request.resource.data.participants;
    }

    // Notifications - only owner can read
    match /notifications/{document=**} {
      allow read, write: if request.auth.uid == resource.data.userId;
    }

    // Admin access
    match /{document=**} {
      allow read, write: if request.auth.email == 'swaibuziraye22@gmail.com';
    }
  }
}
```

---

## Environment Variables

Create `.env` (don't commit):
```
VITE_FIREBASE_API_KEY=your_key
VITE_FIREBASE_PROJECT_ID=zibuy-5deae
```

---

## Done! 🎉

Visit: https://zibuy-5deae.web.app