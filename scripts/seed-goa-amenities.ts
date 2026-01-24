/**
 * Seed script for Goa local amenities database
 * 
 * Run with: npx ts-node scripts/seed-goa-amenities.ts
 * Or add to package.json: "seed:amenities": "ts-node scripts/seed-goa-amenities.ts"
 * 
 * This populates the database with hyper-local Goa amenities that aren't
 * in Google Maps or OpenStreetMap.
 */

import mongoose from "mongoose";

// Sample Goa amenities data - ADD YOUR OWN!
const GOA_AMENITIES = [
  // ============================================
  // PANJIM AREA
  // ============================================
  {
    name: "Panjim Municipal Garden Toilet",
    category: "toilet",
    subType: "public_toilet",
    location: {
      address: "Municipal Garden, Panjim",
      landmark: "Inside Municipal Garden near fountain",
      area: "Panjim",
      lat: 15.4989,
      lng: 73.8278,
    },
    description: "Clean public toilet inside the municipal garden. Free to use.",
    details: {
      isFree: true,
      isClean: true,
      hasWater: true,
      openTime: "06:00",
      closeTime: "22:00",
    },
    tags: ["toilet", "free", "clean", "panjim"],
    isVerified: true,
    contributedBy: "local_admin",
  },
  {
    name: "Ravi's Fruit Cart",
    category: "food_vendor",
    subType: "fruit_cart",
    location: {
      address: "Near Panjim Library",
      landmark: "Opposite Panjim Library main entrance",
      area: "Panjim",
      lat: 15.4957,
      lng: 73.8295,
    },
    description: "Fresh seasonal fruits. Famous for his cut fruit plates with masala.",
    details: {
      cuisine: ["fruit", "fresh_juice"],
      priceRange: "₹20-50",
      bestFor: ["snacks", "refreshment"],
      openTime: "08:00",
      closeTime: "20:00",
      openDays: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    },
    tags: ["fruit", "fresh", "cheap", "snacks", "street_food"],
    isVerified: true,
    contributedBy: "local_admin",
  },
  {
    name: "Beef Cutlet Aunty",
    category: "food_vendor",
    subType: "cutlet_seller",
    location: {
      address: "Fontainhas, Panjim",
      landmark: "Near 31st January Road junction",
      area: "Panjim",
      lat: 15.4932,
      lng: 73.8312,
    },
    description: "Famous beef cutlets. A Panjim institution. Cash only.",
    details: {
      cuisine: ["cutlets", "beef", "snacks"],
      priceRange: "₹15-30",
      bestFor: ["snacks", "evening"],
      openTime: "16:00",
      closeTime: "20:00",
      openDays: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    },
    tags: ["cutlets", "beef", "famous", "street_food", "evening_snack"],
    isVerified: true,
    contributedBy: "local_admin",
  },
  {
    name: "Miramar Beach Garden",
    category: "park",
    subType: "beach_garden",
    location: {
      address: "Miramar Beach Road",
      landmark: "Adjacent to Miramar Beach",
      area: "Miramar",
      lat: 15.4729,
      lng: 73.8068,
    },
    description: "Small garden with benches overlooking Miramar beach. Good for evening walks.",
    details: {
      hasBenches: true,
      hasShade: true,
      isFree: true,
      petFriendly: true,
    },
    tags: ["park", "beach", "evening", "free", "benches"],
    isVerified: true,
    contributedBy: "local_admin",
  },

  // ============================================
  // CALANGUTE / BAGA AREA
  // ============================================
  {
    name: "Calangute Market Public Toilet",
    category: "toilet",
    subType: "public_toilet",
    location: {
      address: "Calangute Market",
      landmark: "Behind the main market building",
      area: "Calangute",
      lat: 15.5438,
      lng: 73.7553,
    },
    description: "Public toilet near the market. ₹5 for use.",
    details: {
      isFree: false,
      priceRange: "₹5",
      isClean: true,
      hasWater: true,
      openTime: "07:00",
      closeTime: "21:00",
    },
    tags: ["toilet", "market", "calangute"],
    isVerified: true,
    contributedBy: "local_admin",
  },
  {
    name: "Tito's Lane Tea Stall",
    category: "food_vendor",
    subType: "tea_stall",
    location: {
      address: "Tito's Lane, Baga",
      landmark: "Start of Tito's Lane from main road",
      area: "Baga",
      lat: 15.5533,
      lng: 73.7512,
    },
    description: "24-hour chai and cigarettes. Popular with late-night partygoers.",
    details: {
      cuisine: ["tea", "coffee", "biscuits"],
      priceRange: "₹10-30",
      bestFor: ["tea", "late_night"],
      openTime: "00:00",
      closeTime: "23:59",
      openDays: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    },
    tags: ["tea", "chai", "24hours", "late_night", "baga"],
    isVerified: true,
    contributedBy: "local_admin",
  },

  // ============================================
  // MARGAO AREA
  // ============================================
  {
    name: "Margao Municipal Market Toilet",
    category: "toilet",
    subType: "public_toilet",
    location: {
      address: "Margao Municipal Market",
      landmark: "Ground floor, east entrance",
      area: "Margao",
      lat: 15.2832,
      lng: 73.9862,
    },
    description: "Clean public facility in the main market building.",
    details: {
      isFree: true,
      isClean: true,
      hasWater: true,
      openTime: "06:00",
      closeTime: "20:00",
    },
    tags: ["toilet", "free", "market", "margao"],
    isVerified: true,
    contributedBy: "local_admin",
  },
  {
    name: "Café Real",
    category: "dhaba",
    subType: "traditional_cafe",
    location: {
      address: "Near Margao Church",
      landmark: "Opposite Holy Spirit Church",
      area: "Margao",
      lat: 15.2793,
      lng: 73.9570,
    },
    description: "Old Goan café. Famous for pao, butter, and chai. Toilet available for customers.",
    details: {
      cuisine: ["pao", "tea", "coffee", "breakfast"],
      priceRange: "₹20-80",
      bestFor: ["breakfast", "tea"],
      openTime: "06:30",
      closeTime: "20:00",
      isFree: false, // toilet for customers only
    },
    tags: ["cafe", "breakfast", "pao", "traditional", "margao", "toilet_available"],
    isVerified: true,
    contributedBy: "local_admin",
  },

  // ============================================
  // MAPUSA AREA
  // ============================================
  {
    name: "Mapusa Friday Market Area",
    category: "market",
    subType: "weekly_market",
    location: {
      address: "Mapusa Market",
      landmark: "Main market square",
      area: "Mapusa",
      lat: 15.5937,
      lng: 73.8102,
    },
    description: "Famous Friday market. Multiple food stalls, fresh produce, local snacks. Public toilets nearby.",
    details: {
      openTime: "08:00",
      closeTime: "18:00",
      openDays: ["Fri"], // Friday only for the big market
      isFree: true, // entry free
    },
    tags: ["market", "friday", "local", "shopping", "food", "mapusa"],
    isVerified: true,
    contributedBy: "local_admin",
  },
  {
    name: "HP Petrol Pump Toilet",
    category: "petrol_pump",
    subType: "petrol_pump_toilet",
    location: {
      address: "NH66, near Mapusa bus stand",
      landmark: "HP Petrol Pump opposite KTC bus stand",
      area: "Mapusa",
      lat: 15.5912,
      lng: 73.8089,
    },
    description: "Clean toilet at HP petrol pump. Free for customers, ₹5 otherwise.",
    details: {
      isFree: false,
      priceRange: "₹5",
      isClean: true,
      hasWater: true,
      openTime: "06:00",
      closeTime: "23:00",
    },
    tags: ["toilet", "petrol_pump", "mapusa", "highway"],
    isVerified: true,
    contributedBy: "local_admin",
  },

  // ============================================
  // OLD GOA AREA
  // ============================================
  {
    name: "Basilica of Bom Jesus Garden",
    category: "park",
    subType: "church_garden",
    location: {
      address: "Old Goa",
      landmark: "Behind Basilica of Bom Jesus",
      area: "Old Goa",
      lat: 15.5008,
      lng: 73.9116,
    },
    description: "Shaded garden with benches. Good resting spot after church visit. Free entry.",
    details: {
      hasBenches: true,
      hasShade: true,
      isFree: true,
      wheelchairAccessible: true,
    },
    tags: ["park", "garden", "church", "heritage", "free", "rest_area"],
    isVerified: true,
    contributedBy: "local_admin",
  },
  {
    name: "ASI Toilet Complex",
    category: "toilet",
    subType: "government_toilet",
    location: {
      address: "Old Goa Heritage Site",
      landmark: "Near parking area",
      area: "Old Goa",
      lat: 15.5018,
      lng: 73.9108,
    },
    description: "Archaeological Survey of India maintained toilets. Clean and free.",
    details: {
      isFree: true,
      isClean: true,
      hasWater: true,
      wheelchairAccessible: true,
      openTime: "09:00",
      closeTime: "17:30",
    },
    tags: ["toilet", "free", "clean", "government", "heritage"],
    isVerified: true,
    contributedBy: "local_admin",
  },

  // ============================================
  // ANJUNA / VAGATOR AREA
  // ============================================
  {
    name: "Curlies Beach Shack Public Area",
    category: "beach_access",
    subType: "beach_shack",
    location: {
      address: "Anjuna Beach South",
      landmark: "Famous Curlies shack",
      area: "Anjuna",
      lat: 15.5739,
      lng: 73.7413,
    },
    description: "Beach access with shack. Toilets available for customers. Good sunset point.",
    details: {
      isFree: false, // toilet for customers
      openTime: "09:00",
      closeTime: "02:00",
    },
    tags: ["beach", "shack", "sunset", "anjuna", "toilet_available"],
    isVerified: true,
    contributedBy: "local_admin",
  },
  {
    name: "Wednesday Flea Market",
    category: "market",
    subType: "flea_market",
    location: {
      address: "Anjuna Beach Road",
      landmark: "Near Anjuna Beach",
      area: "Anjuna",
      lat: 15.5731,
      lng: 73.7429,
    },
    description: "Famous Wednesday flea market. Handicrafts, clothes, food stalls. Runs Nov-Apr.",
    details: {
      openTime: "09:00",
      closeTime: "18:00",
      openDays: ["Wed"],
      isFree: true,
    },
    tags: ["market", "flea_market", "wednesday", "shopping", "anjuna", "seasonal"],
    isVerified: true,
    contributedBy: "local_admin",
  },

  // ============================================
  // COLVA / BENAULIM AREA
  // ============================================
  {
    name: "Colva Beach Public Toilet",
    category: "toilet",
    subType: "beach_toilet",
    location: {
      address: "Colva Beach entrance",
      landmark: "Near the main beach entrance parking",
      area: "Colva",
      lat: 15.2789,
      lng: 73.9221,
    },
    description: "Government maintained beach toilet. ₹5 charge.",
    details: {
      isFree: false,
      priceRange: "₹5",
      isClean: true,
      hasWater: true,
      openTime: "07:00",
      closeTime: "19:00",
    },
    tags: ["toilet", "beach", "colva", "south_goa"],
    isVerified: true,
    contributedBy: "local_admin",
  },
  {
    name: "Martin's Corner Area Dhaba",
    category: "dhaba",
    subType: "roadside_dhaba",
    location: {
      address: "Binwaddo, Benaulim",
      landmark: "Before Martin's Corner restaurant",
      area: "Benaulim",
      lat: 15.2642,
      lng: 73.9312,
    },
    description: "Local dhaba serving thalis and Goan food. Toilet available. Very affordable.",
    details: {
      cuisine: ["thali", "goan", "fish"],
      priceRange: "₹80-150",
      bestFor: ["lunch", "dinner"],
      openTime: "11:00",
      closeTime: "22:00",
      isFree: false, // toilet for customers
    },
    tags: ["dhaba", "thali", "affordable", "toilet_available", "south_goa"],
    isVerified: true,
    contributedBy: "local_admin",
  },

  // ============================================
  // DRINKING WATER POINTS
  // ============================================
  {
    name: "Panjim Bus Stand Water Cooler",
    category: "drinking_water",
    subType: "water_cooler",
    location: {
      address: "Kadamba Bus Stand, Panjim",
      landmark: "Inside bus stand, platform 1 area",
      area: "Panjim",
      lat: 15.4963,
      lng: 73.8187,
    },
    description: "Free drinking water cooler inside the bus stand.",
    details: {
      isFree: true,
      openTime: "05:00",
      closeTime: "23:00",
    },
    tags: ["water", "free", "bus_stand", "panjim"],
    isVerified: true,
    contributedBy: "local_admin",
  },
];

async function seedDatabase() {
  const MONGO_URI = process.env.MONGO_URI;

  if (!MONGO_URI) {
    console.error("❌ MONGO_URI not set in environment variables");
    console.log("Set it with: export MONGO_URI='your-mongodb-uri'");
    process.exit(1);
  }

  try {
    console.log("🔌 Connecting to MongoDB...");
    await mongoose.connect(MONGO_URI);
    console.log("✅ Connected to MongoDB");

    // Define the schema inline for the script
    const GoaAmenitySchema = new mongoose.Schema({
      name: { type: String, required: true },
      category: { type: String, required: true },
      subType: { type: String },
      location: {
        address: { type: String },
        landmark: { type: String },
        area: { type: String },
        lat: { type: Number, required: true },
        lng: { type: Number, required: true },
      },
      description: { type: String },
      details: { type: mongoose.Schema.Types.Mixed },
      imageUrl: { type: String },
      images: [String],
      tags: [String],
      isVerified: { type: Boolean, default: false },
      verifiedAt: { type: Date },
      verifiedBy: { type: String },
      contributedBy: { type: String },
      upvotes: { type: Number, default: 0 },
      downvotes: { type: Number, default: 0 },
      isActive: { type: Boolean, default: true },
      lastConfirmedActive: { type: Date },
      createdAt: { type: Date, default: Date.now },
      updatedAt: { type: Date, default: Date.now },
    });

    const GoaAmenity = mongoose.models.GoaAmenity || mongoose.model("GoaAmenity", GoaAmenitySchema);

    console.log(`📦 Seeding ${GOA_AMENITIES.length} amenities...`);

    for (const amenity of GOA_AMENITIES) {
      // Upsert by name + location to avoid duplicates
      await GoaAmenity.findOneAndUpdate(
        { 
          name: amenity.name,
          "location.area": amenity.location.area,
        },
        { 
          ...amenity,
          updatedAt: new Date(),
          isActive: true,
        },
        { upsert: true, new: true }
      );
      console.log(`  ✓ ${amenity.name} (${amenity.category})`);
    }

    console.log("\n✅ Seeding complete!");
    
    // Show summary
    const counts = await GoaAmenity.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: "$category", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);
    
    console.log("\n📊 Database summary:");
    for (const c of counts) {
      console.log(`   ${c._id}: ${c.count}`);
    }

    await mongoose.disconnect();
    console.log("\n🔌 Disconnected from MongoDB");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

// Run if called directly
seedDatabase();

