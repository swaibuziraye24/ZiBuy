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