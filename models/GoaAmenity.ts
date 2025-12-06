import mongoose from "mongoose";

// Goa-specific local amenities database
// For hyper-local data not found in Google/OSM: dhabas, street vendors, small parks, free toilets, etc.

const GoaAmenitySchema = new mongoose.Schema({
  name: { type: String, required: true },
  // Detailed categorization
  category: {
    type: String,
    enum: [
      "toilet",           // Public toilets, free restrooms
      "drinking_water",   // Water fountains, taps
      "park",             // Small parks, gardens, green spaces
      "food_vendor",      // Street food, carts, fruit sellers
      "dhaba",            // Traditional roadside eateries
      "shop",             // Small shops, kirana stores
      "temple",           // Temples with facilities
      "petrol_pump",      // Petrol pumps (often have toilets)
      "beach_access",     // Beach entry points, shacks
      "rest_area",        // Benches, shelters, shaded spots
      "market",           // Local markets, bazaars
      "other",
    ],
    required: true,
  },
  // More specific type within category
  subType: { type: String }, // e.g., "fruit_cart", "cutlet_seller", "paan_shop", "feni_shop"
  
  location: {
    address: { type: String },
    landmark: { type: String }, // "Near Panjim Library", "Opposite Church"
    area: { type: String },     // "Panjim", "Calangute", "Margao"
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
  },
  
  description: { type: String },
  
  // Amenity-specific details
  details: {
    // For toilets
    isFree: { type: Boolean, default: true },
    isClean: { type: Boolean },
    hasWater: { type: Boolean },
    
    // For food vendors
    cuisine: [String],        // ["cutlets", "fruit", "tea", "snacks"]
    priceRange: { type: String }, // "₹10-50", "₹50-100"
    bestFor: [String],        // ["breakfast", "snacks", "lunch"]
    
    // For parks
    hasBenches: { type: Boolean },
    hasShade: { type: Boolean },
    hasPlayground: { type: Boolean },
    
    // Operating hours
    openTime: { type: String },  // "06:00"
    closeTime: { type: String }, // "22:00"
    openDays: [String],          // ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    
    // General
    wheelchairAccessible: { type: Boolean },
    petFriendly: { type: Boolean },
  },
  
  // Media
  imageUrl: { type: String },
  images: [String],
  
  // Metadata
  tags: [String],
  
  // Verification & quality
  isVerified: { type: Boolean, default: false },
  verifiedAt: { type: Date },
  verifiedBy: { type: String },
  
  // Community contributions
  contributedBy: { type: String }, // Name or "anonymous"
  upvotes: { type: Number, default: 0 },
  downvotes: { type: Number, default: 0 },
  
  // Status
  isActive: { type: Boolean, default: true },
  lastConfirmedActive: { type: Date },
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

// Geospatial index for location queries
GoaAmenitySchema.index({ "location.lat": 1, "location.lng": 1 });
GoaAmenitySchema.index({ category: 1 });
GoaAmenitySchema.index({ "location.area": 1 });
GoaAmenitySchema.index({ tags: 1 });

export default mongoose.models.GoaAmenity || mongoose.model("GoaAmenity", GoaAmenitySchema);

