ZiBuy — Uganda Classifieds Marketplace

A full-featured online classifieds marketplace for Uganda, built with vanilla JavaScript, HTML, CSS, and Firebase.

**Live Demo:** https://zibuy-5deae.web.app

---

## 📋 Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Installation](#installation)
- [Firebase Setup](#firebase-setup)
- [Admin Access](#admin-access)
- [Deployment](#deployment)
- [File Guide](#file-guide)
- [Database Schema](#database-schema)

---

## ✨ Features

### Core Marketplace
- ✅ Browse products by category (13 categories)
- ✅ Search & filter by price, location, date
- ✅ Product detail page with image gallery
- ✅ Shopping cart with checkout
- ✅ User authentication (register/login/logout)

### Seller Features
- ✅ Post ads (4-step form: category → details → images → review)
- ✅ Dashboard with seller stats
- ✅ View/manage my ads (edit, mark sold, delete)
- ✅ Seller profile page (public)
- ✅ Seller verification badge
- ✅ Premium/boosted ads with click tracking
- ✅ Monitor product views

### Buyer Features
- ✅ Add products to cart
- ✅ Checkout with delivery address
- ✅ 3 payment methods (Cash on Delivery, Mobile Money, Card)
- ✅ Order tracking
- ✅ Leave reviews & ratings
- ✅ View seller profiles
- ✅ Save favorite products

### Messaging
- ✅ Real-time messaging between buyers & sellers
- ✅ Message history
- ✅ Notification system
- ✅ SMS/Email notifications (ready for Twilio integration)

### Admin Panel
- ✅ Upload/manage products
- ✅ View orders & revenue
- ✅ Analytics dashboard (KPIs, top products, category distribution)
- ✅ Seller verification management
- ✅ Premium ads management & revenue tracking
- ✅ Delete inappropriate products

---

## 🛠 Tech Stack

**Frontend:**
- HTML5, CSS3, Vanilla JavaScript (ES6+)
- Responsive design (mobile-first)
- No framework dependencies

**Backend & Database:**
- Firebase Authentication
- Firestore (NoSQL database)
- Firebase Storage (image uploads)
- Firebase Hosting (deployment)

**Payment Ready:**
- Mobile Money integration (MTN/Airtel)
- Credit/Debit card support
- Flutterwave/Pesapal compatible

---

## 📁 Project Structure

```
ZiBuy/
├── index.html              ← Homepage
├── product.html            ← Product detail page
├── post-ad.html            ← Seller post ad form
├── dashboard.html          ← User dashboard
├── messages.html           ← Messaging page
├── notifications.html      ← Notifications page
├── payment.html            ← Checkout page
├── seller-verification.html ← Seller verification form
├── user-profile.html       ← Public seller profile
├── admin-analytics.html    ← Admin analytics dashboard
├── admin-verification.html ← Seller verification admin
├── admin-premium.html      ← Premium ads management
│
├── app.js                  ← Main app logic
├── product.js              ← Product page logic
├── post-ad.js              ← Post ad form logic
├── dashboard.js            ← Dashboard logic
├── messages.js             ← Messaging logic
├── notifications.js        ← Notifications logic
├── notifications-page.js   ← Notifications page logic
├── payment.js              ← Payment logic
├── reviews.js              ← Reviews system
├── seller-verification.js  ← Verification form logic
├── user-profile.js         ← Profile page logic
├── admin.js                ← Admin panel logic
├── admin-analytics.js      ← Admin analytics logic
├── admin-verification.js   ← Verification admin logic
├── admin-premium.js        ← Premium ads admin logic
├── auth.js                 ← Authentication logic
├── firebase.js             ← Firebase config
├── premium-ads.js          ← Premium ads logic
│
├── style.css               ← All styles (3000+ lines)
├── firebase.json           ← Firebase hosting config
├── .firebaserc             ← Firebase project ID
├── DEPLOYMENT.md           ← Deployment guide
├── PREMIUM_ADS_SETUP.txt   ← Premium ads integration guide
├── README.md               ← This file
```

---

## 🚀 Installation

### 1. Clone Repository
```bash
git clone https://github.com/yourusername/ZiBuy.git
cd ZiBuy
```

### 2. Install Firebase CLI
```bash
npm install -g firebase-tools
```

### 3. Login to Firebase
```bash
firebase login
```

### 4. Initialize Firebase (if not done)
```bash
firebase init hosting
```

### 5. Deploy
```bash
firebase deploy
```

**Live at:** `https://zibuy-5deae.web.app`

---

## 🔥 Firebase Setup

### Project ID
```
zibuy-5deae
```

### Required Collections in Firestore

1. **products** — Marketplace listings
   - name, price, category, description
   - images[], seller{name, phone, location}
   - userId, userEmail, isUserPost, status
   - views, createdAt, expiresAt, isPremium

2. **orders** — Customer orders
   - orderId, customerName, customerPhone
   - items[], total, status
   - paymentMethod, userEmail, createdAt

3. **reviews** — Product/seller reviews
   - rating, text, reviewerEmail
   - productId, sellerId, createdAt

4. **messages** — Direct messages
   - senderEmail, participants[]
   - text, timestamp, lastMessageTime

5. **notifications** — User notifications
   - type, title, message, read
   - userId, createdAt, relatedId

6. **seller_verifications** — Seller badge applications
   - userId, email, fullName, businessName
   - idDocument, businessLicense, status
   - createdAt, approvedAt, rejectionReason

7. **premium_ads** — Boosted/featured ads
   - productId, userId, days, price, status
   - createdAt, expiresAt, clicks

8. **transactions** — Payment records
   - orderId, amount, method, status
   - createdAt

9. **users** — User profiles
   - email, displayName, isSellerVerified
   - sellerVerificationStatus, createdAt

### Firestore Security Rules

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Products - public read, auth write
    match /products/{document=**} {
      allow read: if true;
      allow create: if request.auth != null;
      allow update, delete: if request.auth.uid == resource.data.userId;
    }

    // Orders - owner only
    match /orders/{document=**} {
      allow read, write: if request.auth.email == resource.data.userEmail;
    }

    // Reviews - public read, auth write
    match /reviews/{document=**} {
      allow read: if true;
      allow create: if request.auth != null;
      allow delete: if request.auth.uid == resource.data.userId;
    }

    // Messages - participants only
    match /messages/{document=**} {
      allow read: if request.auth.email in resource.data.participants;
      allow create: if request.auth != null && 
                       request.auth.email in request.resource.data.participants;
    }

    // Notifications - owner only
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

## 👤 Admin Access

**Admin Email:** `swaibuziraye22@gmail.com`

### Admin Features
1. Upload products
2. View/manage orders
3. Delete inappropriate products
4. View analytics (KPIs, revenue, top products)
5. Approve/reject seller verifications
6. Manage premium ads & revenue
7. View user activity

**Access:** Click "Admin" button on homepage → Login with admin email

---

## 📦 Deployment

### To Firebase Hosting

```bash
# Login
firebase login

# Deploy
firebase deploy

# View site
firebase open hosting
```

**Your site will be live at:** `https://zibuy-5deae.web.app`

### Custom Domain

1. Go to Firebase Console
2. Select Hosting
3. Click "Connect Domain"
4. Follow instructions

---

## 📖 File Guide

### HTML Files (12 pages)
| File | Purpose |
|------|---------|
| index.html | Homepage, product grid, admin panel |
| product.html | Single product detail page |
| post-ad.html | Seller post ad form (4 steps) |
| dashboard.html | User dashboard (5 tabs) |
| messages.html | Messaging page |
| notifications.html | Notifications center |
| payment.html | Checkout & payment |
| seller-verification.html | Get verified badge |
| user-profile.html | Public seller profile |
| admin-analytics.html | Admin analytics dashboard |
| admin-verification.html | Admin verification panel |
| admin-premium.html | Admin premium ads mgmt |

### JavaScript Files (19 modules)

**Core:**
- `app.js` — Main logic (products, cart, categories, filters)
- `firebase.js` — Firebase configuration & exports
- `auth.js` — Authentication (login/register)

**Pages:**
- `product.js` — Product detail, reviews, seller info
- `post-ad.js` — Post ad form logic
- `dashboard.js` — Dashboard tabs
- `messages.js` — Messaging logic
- `notifications-page.js` — Notifications center
- `payment.js` — Checkout & payment
- `user-profile.js` — Public profile page

**Admin:**
- `admin.js` — Admin panel (upload, orders, delete)
- `admin-analytics.js` — Analytics dashboard
- `admin-verification.js` — Seller verification admin
- `admin-premium.js` — Premium ads admin

**Features:**
- `reviews.js` — Reviews system
- `seller-verification.js` — Verification form
- `premium-ads.js` — Boost/premium ads logic
- `notifications.js` — Notifications helper

### Styles
- `style.css` — All styling (3000+ lines, organized by section)

---

## 💾 Database Schema

### Products Collection
```javascript
{
  id: "auto-generated",
  name: "iPhone 13 Pro",
  price: 2500000,
  category: "phones",
  description: "...",
  images: ["url1", "url2"],
  seller: {
    name: "John Kato",
    phone: "256701234567",
    location: "Kampala, Ntinda"
  },
  userId: "firebase-uid",
  userEmail: "seller@gmail.com",
  isUserPost: true,
  status: "active",
  views: 45,
  isPremium: true,
  premiumExpiresAt: Timestamp,
  createdAt: Timestamp,
  expiresAt: Timestamp  // 30 days from creation
}
```

### Orders Collection
```javascript
{
  orderId: "ZB-1234567890",
  userEmail: "buyer@gmail.com",
  customerName: "Jane Doe",
  customerPhone: "256701234567",
  customerLocation: "Kampala",
  deliveryAddress: "123 Main St",
  items: [
    { name: "iPhone", price: 2500000, qty: 1 }
  ],
  total: 2505000,  // includes delivery
  paymentMethod: "cod|mobile|card",
  status: "Pending|Processing|Shipped|Delivered",
  createdAt: Timestamp
}
```

### Reviews Collection
```javascript
{
  productId: "product-id",
  sellerId: "seller-uid",
  rating: 5,
  text: "Great product!",
  reviewerEmail: "buyer@gmail.com",
  createdAt: Timestamp,
  helpful: 0
}
```

### Messages Collection
```javascript
{
  participants: ["buyer@gmail.com", "seller@gmail.com"],
  senderEmail: "buyer@gmail.com",
  text: "Hi, is this still available?",
  productId: "product-id",
  timestamp: Timestamp,
  lastMessageTime: Timestamp
}
```

### Notifications Collection
```javascript
{
  userId: "user-uid",
  type: "message|order|review|ad_view|payment",
  title: "New message from John",
  message: "You have a new message",
  relatedId: "message-id|order-id",
  read: false,
  createdAt: Timestamp
}
```

### Premium Ads Collection
```javascript
{
  productId: "product-id",
  userId: "seller-uid",
  days: 7|14|30,
  price: 5000|8000|15000,
  status: "active|expired",
  createdAt: Timestamp,
  expiresAt: Timestamp,
  clicks: 142
}
```

---

## 🎨 Design & Colors

```css
Primary Orange: #ff6600
Dark: #111827
Gray: #6b7280
Light Gray: #f3f4f6
Success Green: #10b981
Error Red: #ef4444
```

---

## 📱 Responsive Design

- **Desktop:** Full layout with sidebar
- **Tablet:** 768px breakpoint
- **Mobile:** Single column, hamburger menus

---

## 🔐 Security

- Firebase Authentication (email/password)
- Firestore Security Rules (role-based)
- CORS enabled for Firebase Storage
- Admin-only features protected
- Seller verification system

---

## 💳 Payment Integration Ready

Current: Cash on Delivery

To add Mobile Money/Cards:
1. Integrate Flutterwave API
2. Integrate Pesapal API
3. Add payment gateway in `payment.js`
4. Test with test credentials

---

## 📧 Notifications Ready

Current: In-app notifications

To add Email/SMS:
1. Set up Firebase Cloud Functions
2. Integrate Twilio (SMS)
3. Integrate SendGrid (Email)
4. Trigger from `notifications.js`

---

## 🚀 Future Enhancements

- [ ] Real-time updates with WebSockets
- [ ] Video uploads for products
- [ ] Wishlist/favorites system
- [ ] Referral program
- [ ] In-app chat with typing indicators
- [ ] Bulk upload for sellers
- [ ] Advanced search filters
- [ ] Fraud detection system
- [ ] Mobile app (React Native)

---

## 📞 Support

For issues, bugs, or feature requests, please create an issue on GitHub.

---

## 📄 License

MIT License - Feel free to use for commercial projects

---

**Built with ❤️ for Uganda's e-commerce revolution**