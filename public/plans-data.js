// ============================================
// ZiBuy — Shared Plan Data
// ============================================

export const PLANS = {

  free: {
    id: "free",
    name: "Free",
    maxAds: 3,
    boosts: 0,
    images: 3,
    adDays: 30,
    priority: 1
  },

  bronze: {
    id: "bronze",
    name: "Bronze",
    maxAds: 15,
    boosts: 2,
    images: 5,
    adDays: 60,
    priority: 2
  },

  silver: {
    id: "silver",
    name: "Silver",
    maxAds: 50,
    boosts: 8,
    images: 8,
    adDays: 90,
    priority: 3
  },

  gold: {
    id: "gold",
    name: "Gold",
    maxAds: Infinity,
    boosts: 25,
    images: 15,
    adDays: 180,
    priority: 4
  }

};