/**
 * Seed Goa amenities from JSON file
 * 
 * Run with: npm run seed:amenities
 * 
 * Data source: data/goa-amenities-seed.json
 * 
 * To add new places:
 * 1. Edit data/goa-amenities-seed.json
 * 2. Run: npm run seed:amenities
 */

import mongoose from "mongoose";
import * as fs from "fs";
import * as path from "path";

// Load .env.local file (same as Next.js uses)
function loadEnvFile() {
  const envPaths = [
    path.join(__dirname, "..", ".env.local"),
    path.join(__dirname, "..", ".env"),
  ];
  
  for (const envPath of envPaths) {
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, "utf-8");
      content.split("\n").forEach((line) => {
        const match = line.match(/^([^=]+)=(.*)$/);
        if (match && !process.env[match[1]]) {
          process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
        }
      });
      console.log(`📂 Loaded env from ${path.basename(envPath)}`);
      break;
    }
  }
}

async function main() {
  loadEnvFile();
  
  const MONGO_URI = process.env.MONGO_URI;

  if (!MONGO_URI) {
    console.error("❌ MONGO_URI not set");
    console.log("Options:");
    console.log("  1. Create .env.local with: MONGO_URI='your-mongodb-uri'");
    console.log("  2. Or run: export MONGO_URI='your-uri' && npm run seed:amenities");
    process.exit(1);
  }

  // Load seed data from JSON
  const seedFilePath = path.join(__dirname, "..", "data", "goa-amenities-seed.json");
  
  if (!fs.existsSync(seedFilePath)) {
    console.error(`❌ Seed file not found: ${seedFilePath}`);
    process.exit(1);
  }

  console.log("📂 Loading seed data from JSON...");
  const seedData = JSON.parse(fs.readFileSync(seedFilePath, "utf-8"));
  const amenities = seedData.amenities || [];
  
  console.log(`   Found ${amenities.length} amenities in seed file\n`);

  try {
    console.log("🔌 Connecting to MongoDB...");
    await mongoose.connect(MONGO_URI);
    console.log("✅ Connected\n");

    // Define schema
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

    console.log(`📦 Seeding ${amenities.length} amenities...`);

    let created = 0;
    let updated = 0;

    for (const amenity of amenities) {
      // Upsert by name + area to avoid duplicates
      const result = await GoaAmenity.findOneAndUpdate(
        { 
          name: amenity.name,
          "location.area": amenity.location?.area,
        },
        { 
          ...amenity,
          contributedBy: amenity.contributedBy || "seed_data",
          updatedAt: new Date(),
          isActive: true,
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      // Check if created or updated
      const isNew = result.createdAt?.getTime() === result.updatedAt?.getTime();
      if (isNew) {
        created++;
        console.log(`  ✓ Created: ${amenity.name}`);
      } else {
        updated++;
        console.log(`  ↻ Updated: ${amenity.name}`);
      }
    }

    console.log(`\n✅ Seeding complete!`);
    console.log(`   Created: ${created}`);
    console.log(`   Updated: ${updated}`);
    
    // Show summary by category
    const counts = await GoaAmenity.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: "$category", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);
    
    console.log("\n📊 Database summary:");
    let total = 0;
    for (const c of counts) {
      console.log(`   ${c._id}: ${c.count}`);
      total += c.count;
    }
    console.log(`   ────────────`);
    console.log(`   TOTAL: ${total}`);

    await mongoose.disconnect();
    console.log("\n🔌 Disconnected from MongoDB");
    
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

main();

