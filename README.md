# ZiBuy Uganda — Admin Reference Guide

**A ZiTechnologies Company**
Live site: `https://zibuy.ziteche.com` (custom domain pending)
Admin panel: `https://zibuy.ziteche.com/admin.html`

This document is your complete reference for everything ZiBuy can do — as a buyer, a seller, and as the admin who runs the platform.

---

## 1. What ZiBuy Is

ZiBuy is a mobile-first classifieds marketplace for Uganda — buyers and sellers connect across 24+ categories (Phones, Electronics, Vehicles, Property, Fashion, Jobs, Services, Agriculture, and more), pay via MTN and Airtel Mobile Money, and communicate through real-time in-app chat. It's built as an installable Progressive Web App (PWA), so it works like a native app without needing the Play Store or App Store.

---

## 2. Signing Up & Logging In

**Registration is always email + phone number + password.** This is intentional — every account has a real email and phone on file from day one, which powers verification, notifications, and support.

Once registered, a person can log back in **three ways**:
- Email + password
- Phone number (SMS code)
- Google account

Google and phone login are **login-only** — they will never create a new account. If someone tries either method without having registered first, they're told to sign up properly with email + phone + password.

---

## 3. Buyer Features

| Feature | What it does |
|---|---|
| **Search & Filters** | Full-screen instant search, filter by price, location, category, date posted |
| **Category Browsing** | 24+ categories, each with tailored fields (e.g. mileage for cars, RAM for phones) |
| **Recently Viewed** | Automatically remembers products you've looked at, shown on the homepage |
| **Wishlist / Likes** | Heart any product from anywhere — homepage, search, shop pages, product pages — saved to your Wishlist tab |
| **Saved Search Alerts** | Save a search once, get notified the moment a new matching product is posted |
| **Price Drop Alerts** | If you liked a product and the seller drops the price, you're notified automatically — everyone browsing also sees a red "-X%" badge on it |
| **Product Comparison** | Select up to 3 similar products from "You Might Also Like" and compare them side by side |
| **Real-Time Chat** | Message any seller directly — messages appear instantly, with read receipts |
| **Buy Now + ZiBuy Protect** | Pay via MTN/Airtel, optionally add a small protection fee — you confirm receipt (or raise a dispute) from your dashboard before the order is considered complete |
| **Cart Checkout** | Add multiple items, checkout with delivery details in one flow |
| **Two-Way Ratings** | Rate sellers after a purchase; sellers can also rate you as a buyer |
| **Report a Seller** | Flag a problem seller directly from any product — instantly escalated to admin via WhatsApp |

---

## 4. Seller Features

### Posting Ads
- **Single ad posting** — step-by-step wizard with category-specific fields, draft auto-save, photo compression and retry for slow connections
- **Bulk posting** — post many products in one batch, each row tracked with live status, auto-saved as a draft so a refresh never loses your work

### Growth Tools
| Feature | What it does |
|---|---|
| **Boost** | Feature an ad for 7, 14, or 30 days |
| **Pin to Top** | Short, cheap visibility burst (24–48 hours), sits above even boosted ads |
| **Auto-Renew** | Ad never expires — automatically renews every 30 days for a small fee |
| **CV Boost** | Job seekers can pin their listing to the top of "Seeking Work" |
| **Seller Storefront** | Branded shop page — logo, banner, description, business hours, live product grid |
| **Referral Program** | Earn free boosts by referring new users who post their first ad |

### Business Plans

| Plan | Ad Limit | Boosts/mo | Images | Ad Duration | Auto-Verified? |
|---|---|---|---|---|---|
| Free | 3 | 0 | 3 | 30 days | No |
| Bronze | 15 | 2 | 5 | 60 days | No |
| Silver | 50 | 8 | 8 | 90 days | Yes |
| Gold | Unlimited | 25 | 15 | 180 days | Yes |

*(Admin can edit these live — see Section 6, Plan Settings.)*

### Analytics (Silver & Gold)
- Views, revenue, top-performing ads
- **Category Benchmarking** (Silver & Gold): compares your average views and price directly against the platform-wide average for your category — tells you if you're overpriced or underperforming
- Full performance table + CSV export (Gold)

### Ad Lifecycle
Ads clearly show one of three states in **My Ads**:
- ✅ **Active** — visible to buyers
- ⏰ **Expired** — hidden from everyone except you and admin; one tap to **Reactivate**
- ❌ **Sold** — marked complete

Expired ads are automatically hidden from search, browsing, shop pages, and profiles the moment they expire — reactivating instantly brings them back.

---

## 5. Trust & Safety System

| System | How it works |
|---|---|
| **Phone Verification** | Real SMS OTP code required — earns a "📱 Phone Verified" badge |
| **Trust Score (0–100)** | Calculated from verification, reviews, and account age — shown as a tier: 🌱 New → 🥉 Bronze → 🥈 Silver → 🥇 Gold → 💎 Elite |
| **Earned "Trusted Seller" Badge** | Cannot be purchased — earned only through a genuine track record, and automatically lost if standards slip |
| **Response Time Badge** | "Usually replies within X" + reply-rate % shown on seller profiles |
| **Two-Way Ratings** | Buyers rate sellers, sellers rate buyers |
| **Reports** | Any user can report a seller — logged and sent to admin's WhatsApp instantly |
| **ZiBuy Protect** | Optional buyer-protection fee at checkout; buyer must confirm receipt or raise a dispute before the order closes; unconfirmed orders auto-complete after 7 days |
| **Dispute Resolution** | Admin reviews and resolves disputes from a dedicated panel |

---

## 6. Admin Panel — Full Walkthrough

Access at `/admin.html`. Every section below is a tab in the sidebar.

### Overview
- Live KPIs: users, paid plans, active ads, pending boosts, orders, revenue
- **Weekly Growth Snapshot** — new users & orders this week vs. last, top 3 categories
- **System Health** — live Firestore check, Cloud Functions activity check
- **Fraud Alerts** — flags sellers with 3+ open reports, disputes open 48+ hours, banned users with still-active ads

### Users & Plans
- View every user, their plan, ad count, verification, buyer rating, trust score
- Change anyone's plan manually
- Ban / Unban, full account **Delete** (removes data *and* login — one click)
- View a user's ads or orders directly
- Private **Admin Notes** per user (never shown to the user)
- **WhatsApp** any user directly

### Ads
- Filter by **All / Active / Expired / Sold**
- Edit, mark sold, restore, delete any ad
- **Reactivate** any expired ad for a custom number of days
- Grant a **free Boost or Pin** instantly, bypassing payment

### Shops
- See every shop on the platform
- Manually **Feature** any shop on the homepage regardless of plan
- **Suspend** (hides shop + its products, fully reversible) or **Delete** permanently

### Orders
- Full order detail view, WhatsApp the customer directly
- Update order status

### Boosts / Pin Requests / Auto-Renew
- Approve or reject each, tied to real payment references submitted by sellers

### Verifications
- Review and approve/reject seller ID verification submissions

### Reviews / Buyer Ratings
- View and delete any review or buyer rating (auto-recalculates the affected average)

### Reports
- View every report filed, resolve or dismiss

### Disputes
- Review ZiBuy Protect disputes, resolve in buyer's favor or dismiss

### Messages
- Search and view conversations by user email (for investigating a report/dispute only)
- Delete any message

### Plan Settings
- **Live-editable** — change Max Ads, Boosts, Images, or Ad Duration for any plan tier
- Takes effect instantly across the whole platform, no code or redeploy needed

### System
- **Maintenance Mode** — put the entire site into a controlled offline state in one click, with a custom message
- **Export Data** — download Users or Orders as CSV

### Live Alerts
- Real-time feed of every order, payment, and notification event as it happens

### Activity Log
- Full history of every significant platform event: ads posted, shops created, reviews, boosts requested, verifications, subscriptions, reports, job ads — filterable by type

### Dev Console
- Real JavaScript errors from real users' devices, captured automatically and grouped by frequency — the fastest way to know something broke without waiting for a complaint

### Banners / Category Sponsors / Broadcasts / Blog
- Manage homepage banner ads, category sponsorships, push announcements to all users, and publish blog posts

---

## 7. Revenue Streams

| Stream | Description |
|---|---|
| Subscriptions | Bronze / Silver / Gold monthly plans |
| Boosts & Pins | Sellers pay to feature or pin listings |
| Auto-Renew | Recurring fee to keep an ad permanently active |
| ZiBuy Protect Fee | Optional buyer-protection fee at checkout |
| Banner Ads | Homepage banner rotation sold to advertisers |
| Category Sponsorship | Exclusive brand sponsorship of an entire category |

---

## 8. Technical Notes (for future reference)

- **Stack:** Firebase (Firestore, Auth, Storage, Cloud Functions, Hosting, FCM), vanilla JavaScript modules
- **Payments:** MTN & Airtel Mobile Money — manual reference confirmation via WhatsApp, admin approves in-panel
- **SMS:** Africa's Talking (OTP, reminders)
- **Email:** Gmail via Nodemailer — sender identity set in `functions/.env` (`GMAIL_EMAIL` / `GMAIL_PASSWORD`)
- **Admin access:** currently gated by a fixed admin email in `admin.js` and Firestore rules — a UID-based `admins` collection system was discussed as a future upgrade to make changing admin credentials safer, but has not yet been fully migrated
- **Deploy command:** `firebase deploy` (or scoped: `--only hosting`, `--only functions`, `--only firestore:rules`)

### Known Cleanup Pending
A set of legacy admin pages (`admin-subscriptions`, `admin-verification`, `admin-reports`, `admin-boost-requests`, `admin-premium`, `admin-dashboard`, and conditionally `admin-business-requests`) predate the current consolidated `admin.html` and are safe to remove — their functionality is fully covered by the current admin panel. See ongoing cleanup notes for status.

---

*Last updated for the ZiBuy platform state as of this document's generation. For anything not covered here, ask your development partner — this file should be updated as new features ship.*







rules_version = '2';

service cloud.firestore {

  match /databases/{database}/documents {

    // ── Multi-admin check: super-admin email OR listed in /admins/{uid} ──
    function isAdmin() {
      return request.auth != null &&
        (
          request.auth.token.email == "swaibuziraye22@gmail.com"
          ||
          exists(/databases/$(database)/documents/admins/$(request.auth.uid))
        );
    }

    // Full admins can write. Viewers (role == "viewer") can only read.
    function isFullAdmin() {
      return request.auth != null &&
        (
          request.auth.token.email == "swaibuziraye22@gmail.com"
          ||
          (
            exists(/databases/$(database)/documents/admins/$(request.auth.uid))
            &&
            get(/databases/$(database)/documents/admins/$(request.auth.uid)).data.get("role", "full") != "viewer"
          )
        );
    }

    match /admins/{adminId} {
      allow get: if request.auth != null && (request.auth.uid == adminId || request.auth.token.email == "swaibuziraye22@gmail.com");
      allow list: if request.auth != null && request.auth.token.email == "swaibuziraye22@gmail.com";
      allow write: if request.auth != null && request.auth.token.email == "swaibuziraye22@gmail.com";
    }

    match /admin_action_logs/{logId} {
      allow create: if isAdmin();
      allow read: if request.auth != null && request.auth.token.email == "swaibuziraye22@gmail.com";
    }

    match /admin_sessions/{sid} {
      allow read: if request.auth != null && request.auth.token.email == "swaibuziraye22@gmail.com";
      allow get: if request.auth != null && request.auth.uid == sid;
      allow create, update: if isAdmin() && request.auth.uid == sid;
      allow delete: if request.auth != null && request.auth.token.email == "swaibuziraye22@gmail.com";
    }

    /* ======================================================
       PRODUCTS
    ====================================================== */

      match /products/{document=**} {

  allow read: if true;

  allow create: if request.auth != null;

  allow update: if
    (
      request.auth != null &&
      (
        isFullAdmin()
        ||
        resource.data.userId == request.auth.uid
      )
    )
    ||
    request.resource.data.diff(resource.data)
      .affectedKeys()
      .hasOnly(["likes", "views", "orders"]);

  allow delete: if request.auth != null &&
    (
      isFullAdmin()
      ||
      resource.data.userId == request.auth.uid
    );
}

match /category_stats/{document=**} {
  allow read: if true;
  allow write: if false; // Admin SDK (Cloud Functions) bypasses this — client can never write
}

match /similar_item_alerts/{document=**} {
  allow read: if false;
  allow create: if request.auth != null && request.resource.data.userId == request.auth.uid;
}

match /client_errors/{document=**} {
  allow read: if isAdmin();
  allow create: if true;  // any user's browser can log, even logged out
  allow delete: if isFullAdmin();
}

       match /job_ads/{jobId} {
  allow read: if true;
  allow create: if request.auth != null;
  allow update, delete: if request.auth != null
    && isFullAdmin();
}

match /whatsapp_reminders/{remId} {
  allow read: if request.auth != null
    && isAdmin();
  allow write: if request.auth != null
    && isFullAdmin();
}


       match /category_sponsors/{id} {
  allow read: if true;
  allow write: if request.auth != null
    && isFullAdmin();
}

match /cv_boosts/{id} {
  allow read: if request.auth != null
    && isAdmin();
  allow create: if request.auth != null;
}

        match /blog_posts/{postId} {
  allow read: if resource.data.status == "published" || 
              (request.auth != null && isAdmin());
  allow write: if request.auth != null && isFullAdmin();
}


     match /referrals/{id} {
  allow read: if request.auth != null
    && (request.auth.uid == resource.data.referrerId
     || request.auth.uid == resource.data.referredId);
  allow create: if request.auth != null;
}

match /boost_credits/{id} {
  allow read: if request.auth != null
    && request.auth.uid == resource.data.userId;
  allow update: if request.auth != null
    && request.auth.uid == resource.data.userId;
  allow create: if request.auth != null;
}
     
     
     match /auto_renewals/{document=**} {
  allow read: if request.auth != null;
  allow create: if request.auth != null;
  allow update: if isFullAdmin();
}

         match /pin_requests/{id} {
  allow read: if request.auth != null
    && (request.auth.uid == resource.data.userId
     || isAdmin());
  allow create: if request.auth != null;
  allow update: if request.auth != null
    && isFullAdmin();
}

    /* ======================================================
       PREMIUM ADS
    ====================================================== */

    match /premium_ads/{document=**} {

      allow read: if true;

      allow create: if request.auth != null;

      allow update: if request.auth != null
        && (
          request.auth.uid == resource.data.userId
          || isFullAdmin()
        );

      allow delete: if request.auth != null
        && isFullAdmin();
    }

    /* ======================================================
       USER PLANS / PLANS / SUBSCRIPTIONS
    ====================================================== */

    match /user_plans/{document=**} {
      allow read: if request.auth != null;
      allow write: if request.auth != null
        && request.auth.uid == request.resource.data.userId
        || isFullAdmin();
    }

    match /plans/{document=**} {
      allow read: if request.auth != null;
      allow write: if request.auth != null
        && request.auth.uid == request.resource.data.userId
        || isFullAdmin();
    }

    match /subscriptions/{document=**} {
      allow read: if request.auth != null;
      allow write: if isFullAdmin();
    }
     
    match /shops/{shopId}/products/{productId} {
  allow read: if true;
  allow write: if request.auth != null && request.auth.uid == shopId;
  } 
     match /plan_config/{document} {
  allow read: if true;
  allow write: if isFullAdmin();
}
    
     match /broadcasts/{id} {
  allow read: if true;
  allow write: if request.auth != null
    && isFullAdmin();
}
     match /system_config/{document=**} {
  allow read: if true;
  allow write: if isFullAdmin();
}
   
     
     match /saved_searches/{document=**} {
  allow read: if false; // Cloud Functions (admin SDK) bypass this — client never needs to read others' searches directly except via query
  allow read: if resource.data.userId == request.auth.uid;
  allow create: if request.auth != null && request.resource.data.userId == request.auth.uid;
  allow delete: if request.auth != null && resource.data.userId == request.auth.uid;
}
     
    /* ======================================================
       BUSINESS ACCOUNTS
    ====================================================== */

    match /business_accounts/{accountId} {

      allow read: if request.auth != null
        && (
          request.auth.uid == resource.data.userId
          || isAdmin()
        );

      allow create: if request.auth != null
        && request.auth.uid == request.resource.data.userId;

      allow update: if request.auth != null
        && (
          request.auth.uid == resource.data.userId
          || isFullAdmin()
        );

      allow delete: if request.auth != null
        && request.auth.uid == resource.data.userId;
    }


    /* ======================================================
       SELLER VERIFICATIONS
    ====================================================== */

    match /seller_verifications/{document=**} {

      allow read: if true;

      allow create: if request.auth != null;

      allow update: if request.auth != null
        && (
          request.auth.uid == resource.data.userId
          || isFullAdmin()
        );

      allow delete: if isFullAdmin();
    }

    /* ======================================================
       BUSINESS PROFILES
    ====================================================== */

    match /business_profiles/{profileId} {

      allow read: if true;

      allow create: if request.auth != null
        && request.auth.uid == request.resource.data.userId;

      allow update: if request.auth != null
        && (
          request.auth.uid == resource.data.userId
          || isFullAdmin()
        );

      allow delete: if request.auth != null
        && (
          request.auth.uid == resource.data.userId
          || isFullAdmin()
        );
    }

    /* ======================================================
       SHOPS
    ====================================================== */

   match /shops/{shopId} {

  allow read: if true;

  allow create: if request.auth != null
    && request.auth.uid == request.resource.data.ownerId;

  allow update: if request.auth != null
    && (
      request.auth.uid == resource.data.ownerId
      || isFullAdmin()
    );

  allow delete: if request.auth != null
    && (
      request.auth.uid == resource.data.ownerId
      || isFullAdmin()
    );

  }


    /* ======================================================
       USERS
    ====================================================== */

    match /users/{userId} {
  allow read: if true;

  allow create: if request.auth != null && request.auth.uid == userId;

  allow update: if request.auth != null
    && (
      request.auth.uid == userId
      || isFullAdmin()
      || request.resource.data.diff(resource.data).affectedKeys()
           .hasOnly(['buyerRating', 'buyerRatingCount', 'phoneVerified', 'phone', 'phoneVerifiedAt'])
    );

  allow delete: if request.auth != null
    && (
      request.auth.uid == userId
      || isFullAdmin()
    );
}



        match /phone_otps/{userId} {
  allow read, write: if false; // Cloud Functions only — admin SDK bypasses rules
}


         match /buyer_ratings/{document=**} {
  allow read: if true;
  allow create: if request.auth != null;
}




    /* ======================================================
       ORDERS
    ====================================================== */
       match /orders/{orderId} {
  allow read: if request.auth != null;

  allow create: if true; // guest checkout via Buy Now is allowed

  allow update: if request.auth != null
    && (
      isFullAdmin()
      ||
      (
        resource.data.userEmail == request.auth.token.email &&
        request.resource.data.diff(resource.data).affectedKeys()
          .hasOnly(['deliveryConfirmed','confirmedAt','autoConfirmed','disputeStatus','disputeReason','disputedAt','status','cancelledAt'])
      )
    );

  allow delete: if request.auth != null
    && isFullAdmin();
}

       match /disputes/{document=**} {
  allow read: if request.auth != null;
  allow create: if request.auth != null && request.resource.data.buyerUid == request.auth.uid;
  allow update: if isFullAdmin();
}


    /* ======================================================
       REVIEWS
    ====================================================== */

    match /reviews/{document=**} {

      allow read: if true;

      allow create: if request.auth != null;

      allow delete: if request.auth.uid == resource.data.userId;
    }
    
    
    
    match /likes/{likeId} {
  allow read: if request.auth != null
              && request.auth.uid == resource.data.userId;

  allow create: if request.auth != null
                && request.auth.uid == request.resource.data.userId;

  allow delete: if request.auth != null
                && request.auth.uid == resource.data.userId;
}

    /* ======================================================
       MESSAGES
    ====================================================== */

match /messages/{messageId} {

  allow read: if request.auth != null &&
               request.auth.token.email in resource.data.participants;

  allow create: if request.auth != null &&
                 request.auth.token.email in request.resource.data.participants;

  allow update: if request.auth != null &&
                 request.auth.token.email in resource.data.participants &&
                 request.resource.data.diff(resource.data)
                   .affectedKeys()
                   .hasOnly(["read","readAt"]);

}

    /* ======================================================
       NOTIFICATIONS
    ====================================================== */

    match /notifications/{document=**} {

      allow read: if request.auth != null && request.auth.uid == resource.data.userId;

      allow create: if request.auth != null;

      allow update, delete: if request.auth != null && request.auth.uid == resource.data.userId;
    }

    /* ======================================================
       BOOST REQUESTS
    ====================================================== */

       match /boost_requests/{id} {

  allow read: if request.auth != null
    && (
      request.auth.uid == resource.data.userId
      || isAdmin()
    );

  allow create: if request.auth != null;

  allow update: if request.auth != null
    && (
      request.auth.uid == resource.data.userId
      || isFullAdmin()
    );

  allow delete: if request.auth != null
    && (
      request.auth.uid == resource.data.userId
      || isFullAdmin()
    );
}

    /* ======================================================
       ADS
    ====================================================== */

    match /ads/{adId} {
      allow read: if true;
      allow write: if request.auth != null;
    }

    /* ======================================================
       VERIFICATIONS / ANALYTICS
    ====================================================== */

    match /verificationRequests/{docId} {
      allow create: if request.auth != null;
      allow read: if isAdmin();
      allow update, delete: if isFullAdmin();
    }

    match /analytics/{docId} {
      allow read: if isAdmin();
      allow write: if isFullAdmin();
    }

    /* ======================================================
       FEATURED ADS
    ====================================================== */

    match /featured_ads/{document=**} {
      allow read: if request.auth != null;
      allow write: if isFullAdmin();
    }
    
    
    
    match /shop_followers/{followId} {

  allow read: if true;

  allow create: if request.auth != null
    && request.resource.data.userId == request.auth.uid;

  allow delete: if request.auth != null
    && request.auth.uid == resource.data.userId;

  allow update: if false;
}


     match /banner_ads/{bannerId} {
  allow read: if true;
  allow create, delete: if request.auth != null
    && isFullAdmin();
  allow update: if (request.auth != null
    && isFullAdmin())
    || request.resource.data.diff(resource.data).affectedKeys()
       .hasOnly(["impressions", "clicks"]);
}

match /reports/{document=**} {
  allow read: if true;
  allow create: if request.auth != null;
  allow update: if isFullAdmin();
  allow delete: if isFullAdmin();
}

match /response_stats/{userId} {
  allow read: if true;
  allow write: if request.auth != null;
}


    /* ======================================================
       FINAL ADMIN OVERRIDE (KEEP LAST)
    ====================================================== */

    match /{document=**} {
      allow read:
        if request.auth != null
        && isAdmin();
      allow write:
        if request.auth != null
        && isFullAdmin();
    }

  }
}