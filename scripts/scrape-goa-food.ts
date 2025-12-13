/**
 * Goa Street Food & Local Experience Scraper
 * 
 * Scrapes authentic local food spots from multiple trusted sources:
 * 1. Treebo Blog - Street food guide with specific restaurant names
 * 2. ResortRio - Foodie's guide to Goan street food
 * 3. Wanderlog - Community-curated food spots
 * 4. Goa Experience UK - Shopping & markets guide
 * 
 * Run with: npm run scrape:goa-food
 */

import axios from "axios";
import * as cheerio from "cheerio";
import mongoose from "mongoose";
import * as dotenv from "dotenv";

// Load environment variables
dotenv.config({ path: ".env.local" });

const CRAWL_DELAY_MS = 1500; // Be polite to servers

// Cache geocoded results
const geocodeCache = new Map<string, { lat: number; lng: number } | null>();

// ==========================================
// GEOCODING
// ==========================================
async function geocode(placeName: string, area?: string): Promise<{ lat: number; lng: number } | null> {
  const cacheKey = `${placeName}|${area || ""}`.toLowerCase().trim();
  if (geocodeCache.has(cacheKey)) {
    return geocodeCache.get(cacheKey)!;
  }

  const apiKey = process.env.GOOGLE_MAPS_BACKEND_API_KEY;
  if (!apiKey) {
    console.log("   ⚠️ No GOOGLE_MAPS_BACKEND_API_KEY");
    return null;
  }

  try {
    // Build query with area context
    const query = area 
      ? `${placeName}, ${area}, Goa, India`
      : `${placeName}, Goa, India`;
    
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${apiKey}`;
    const response = await axios.get(url, { timeout: 10000 });
    const data = response.data;

    if (data.status === "OK" && data.results?.[0]) {
      const location = data.results[0].geometry.location;
      const result = { lat: location.lat, lng: location.lng };
      
      // Verify it's in Goa bounds
      if (result.lat >= 14.5 && result.lat <= 16.0 && result.lng >= 73.5 && result.lng <= 74.5) {
        geocodeCache.set(cacheKey, result);
        console.log(`   📍 Geocoded "${placeName}" → ${result.lat.toFixed(4)}, ${result.lng.toFixed(4)}`);
        return result;
      }
    }
  } catch (error: any) {
    console.log(`   ⚠️ Geocode failed for "${placeName}": ${error.message}`);
  }

  geocodeCache.set(cacheKey, null);
  return null;
}

// Fallback coordinates for known areas
const AREA_COORDS: Record<string, { lat: number; lng: number }> = {
  "panjim": { lat: 15.4989, lng: 73.8278 },
  "panaji": { lat: 15.4989, lng: 73.8278 },
  "mapusa": { lat: 15.5937, lng: 73.8102 },
  "margao": { lat: 15.2832, lng: 73.9862 },
  "calangute": { lat: 15.5438, lng: 73.7553 },
  "baga": { lat: 15.5551, lng: 73.7514 },
  "anjuna": { lat: 15.5739, lng: 73.7413 },
  "candolim": { lat: 15.5178, lng: 73.7621 },
  "colva": { lat: 15.2789, lng: 73.9221 },
  "vasco": { lat: 15.3980, lng: 73.8113 },
  "miramar": { lat: 15.4729, lng: 73.8068 },
  "dona paula": { lat: 15.4588, lng: 73.8053 },
  "old goa": { lat: 15.5008, lng: 73.9116 },
  "palolem": { lat: 15.0100, lng: 74.0231 },
  "arambol": { lat: 15.6867, lng: 73.7042 },
};

function getAreaCoords(text: string): { lat: number; lng: number } | null {
  const textLower = text.toLowerCase();
  for (const [area, coords] of Object.entries(AREA_COORDS)) {
    if (textLower.includes(area)) {
      return coords;
    }
  }
  return null;
}

function extractArea(text: string): string {
  const textLower = text.toLowerCase();
  for (const area of Object.keys(AREA_COORDS)) {
    if (textLower.includes(area)) {
      return area.charAt(0).toUpperCase() + area.slice(1);
    }
  }
  return "";
}

// ==========================================
// SOURCE 1: TREEBO BLOG
// https://www.treebo.com/blog/street-food-in-goa/
// ==========================================
async function scrapeTreebo(): Promise<any[]> {
  console.log("\n📰 Scraping Treebo Blog...");
  const url = "https://www.treebo.com/blog/street-food-in-goa/";
  
  try {
    const response = await axios.get(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; GoaTrippin/1.0)" },
      timeout: 15000,
    });
    
    const $ = cheerio.load(response.data);
    const places: any[] = [];
    
    // Extract food items from headings and content
    $("h3").each((_, element) => {
      const heading = $(element).text().trim();
      
      // Skip numbered headings like "1. Croquettes..."
      const foodMatch = heading.match(/^\d+\.\s*(.+)/);
      const foodName = foodMatch ? foodMatch[1].trim() : null;
      
      if (foodName) {
        // Get the description from following paragraphs
        let description = "";
        let whereToEat = "";
        
        $(element).nextUntil("h3").each((_, el) => {
          const text = $(el).text().trim();
          if (text.toLowerCase().includes("where to eat")) {
            whereToEat = text.replace(/where to eat:?/i, "").trim();
          } else if (text.length > 20 && !description) {
            description = text;
          }
        });
        
        // Parse "Where to Eat" for specific places
        if (whereToEat) {
          // Split by "and" or ","
          const eateries = whereToEat.split(/,|\band\b/).map(s => s.trim()).filter(Boolean);
          
          for (const eatery of eateries) {
            // Extract place name and location (e.g., "Cafe S F Xavier in Mapusa")
            const match = eatery.match(/(.+?)\s+in\s+(.+)/i);
            const placeName = match ? match[1].trim() : eatery;
            const area = match ? match[2].trim() : "";
            
            if (placeName.length > 3 && !placeName.toLowerCase().includes("all over")) {
              places.push({
                name: placeName,
                category: "food_vendor",
                subType: "street_food",
                description: `${foodName}. ${description.slice(0, 200)}`,
                area: area || extractArea(description),
                cuisine: [foodName.toLowerCase().replace(/,?\s*(chops|and|samosas)/g, "").trim()],
                sourceUrl: url,
                source: "treebo_blog",
              });
            }
          }
        }
        
        // If "All over the city", create a general entry
        if (whereToEat.toLowerCase().includes("all over")) {
          places.push({
            name: foodName,
            category: "food_vendor",
            subType: "street_food",
            description: `${description.slice(0, 250)}. Found all over Goa.`,
            area: "Various",
            cuisine: [foodName.toLowerCase()],
            sourceUrl: url,
            source: "treebo_blog",
            isGeneric: true, // Mark as generic, not a specific location
          });
        }
      }
    });
    
    console.log(`   Found ${places.length} food spots from Treebo`);
    return places.filter(p => !p.isGeneric); // Only return specific places
    
  } catch (error: any) {
    console.log(`   ⚠️ Failed to scrape Treebo: ${error.message}`);
    return [];
  }
}

// ==========================================
// SOURCE 2: WANDERLOG
// https://wanderlog.com/list/geoCategory/572831/best-street-food-in-goa
// ==========================================
async function scrapeWanderlog(): Promise<any[]> {
  console.log("\n📰 Scraping Wanderlog...");
  const url = "https://wanderlog.com/list/geoCategory/572831/best-street-food-in-goa";
  
  try {
    const response = await axios.get(url, {
      headers: { 
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        "Accept": "text/html,application/xhtml+xml",
      },
      timeout: 15000,
    });
    
    const $ = cheerio.load(response.data);
    const places: any[] = [];
    
    // Wanderlog uses structured data - look for place cards
    $("[data-testid='place-card'], .place-card, article").each((_, element) => {
      const $el = $(element);
      const name = $el.find("h2, h3, .place-name, [data-testid='place-name']").first().text().trim();
      const description = $el.find("p, .description").first().text().trim();
      const address = $el.find(".address, [data-testid='address']").text().trim();
      
      if (name && name.length > 3 && name.length < 100) {
        places.push({
          name,
          category: "food_vendor",
          subType: "restaurant",
          description: description || `${name} - recommended on Wanderlog`,
          area: extractArea(address || name),
          address,
          sourceUrl: url,
          source: "wanderlog",
        });
      }
    });
    
    // Also try JSON-LD structured data
    $('script[type="application/ld+json"]').each((_, element) => {
      try {
        const json = JSON.parse($(element).html() || "{}");
        if (json["@type"] === "ItemList" && json.itemListElement) {
          for (const item of json.itemListElement) {
            if (item.item?.name) {
              places.push({
                name: item.item.name,
                category: "food_vendor",
                subType: "restaurant",
                description: item.item.description || `${item.item.name} - from Wanderlog`,
                area: extractArea(item.item.address || ""),
                address: item.item.address || "",
                sourceUrl: url,
                source: "wanderlog",
              });
            }
          }
        }
      } catch {}
    });
    
    console.log(`   Found ${places.length} food spots from Wanderlog`);
    return places;
    
  } catch (error: any) {
    console.log(`   ⚠️ Failed to scrape Wanderlog: ${error.message}`);
    return [];
  }
}

// ==========================================
// SOURCE 3: GOA EXPERIENCE UK
// https://www.goaexperience.co.uk/guide/shopping-and-markets
// ==========================================
async function scrapeGoaExperience(): Promise<any[]> {
  console.log("\n📰 Scraping Goa Experience UK...");
  const url = "https://www.goaexperience.co.uk/guide/shopping-and-markets";
  
  try {
    const response = await axios.get(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; GoaTrippin/1.0)" },
      timeout: 15000,
    });
    
    const $ = cheerio.load(response.data);
    const places: any[] = [];
    
    // Look for market and shop mentions
    $("h2, h3, h4, strong").each((_, element) => {
      const heading = $(element).text().trim();
      
      // Check if it's a market or shopping location
      if (/(market|bazaar|shop|store|mall)/i.test(heading) && heading.length < 80) {
        let description = "";
        
        // Get surrounding paragraph text
        $(element).parent().find("p").each((_, p) => {
          const text = $(p).text().trim();
          if (text.length > 30 && !description) {
            description = text.slice(0, 300);
          }
        });
        
        // Also check next sibling
        if (!description) {
          description = $(element).next("p").text().trim().slice(0, 300);
        }
        
        const area = extractArea(heading + " " + description);
        
        places.push({
          name: heading,
          category: "market",
          subType: "market",
          description: description || `${heading} - local shopping spot in Goa`,
          area,
          sourceUrl: url,
          source: "goa_experience_uk",
        });
      }
    });
    
    // Also look for specific market mentions in paragraphs
    $("p").each((_, element) => {
      const text = $(element).text();
      
      // Look for patterns like "the Mapusa Friday Market" or "Anjuna Flea Market"
      const marketMatches = text.match(/(?:the\s+)?([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s+(?:Market|Bazaar|Flea\s+Market))/g);
      
      if (marketMatches) {
        for (const match of marketMatches) {
          const name = match.replace(/^the\s+/i, "").trim();
          if (!places.find(p => p.name.toLowerCase() === name.toLowerCase())) {
            places.push({
              name,
              category: "market",
              subType: "market",
              description: text.slice(0, 300),
              area: extractArea(name),
              sourceUrl: url,
              source: "goa_experience_uk",
            });
          }
        }
      }
    });
    
    console.log(`   Found ${places.length} markets from Goa Experience`);
    return places;
    
  } catch (error: any) {
    console.log(`   ⚠️ Failed to scrape Goa Experience: ${error.message}`);
    return [];
  }
}

// ==========================================
// SOURCE 4: RESORTRIO
// https://www.resortrio.com/a-foodies-guide-to-street-food-in-goa-must-try-flavors/
// ==========================================
async function scrapeResortRio(): Promise<any[]> {
  console.log("\n📰 Scraping ResortRio...");
  const url = "https://www.resortrio.com/a-foodies-guide-to-street-food-in-goa-must-try-flavors/";
  
  try {
    const response = await axios.get(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; GoaTrippin/1.0)" },
      timeout: 15000,
    });
    
    const $ = cheerio.load(response.data);
    const places: any[] = [];
    
    // Look for food item headings
    $("h2, h3").each((_, element) => {
      const heading = $(element).text().trim();
      
      // Skip generic headings
      if (heading.toLowerCase().includes("introduction") || 
          heading.toLowerCase().includes("conclusion") ||
          heading.length > 100) {
        return;
      }
      
      // Check if it looks like a food item
      const foodKeywords = /pav|thali|curry|fish|prawn|crab|pork|beef|chicken|vindaloo|xacuti|sorpotel|bebinca|feni|cashew|samosa|croquette|chorizo|ros|cafreal/i;
      
      if (foodKeywords.test(heading)) {
        let description = "";
        
        // Get description from following paragraphs
        $(element).nextUntil("h2, h3").each((_, el) => {
          const text = $(el).text().trim();
          if (text.length > 30 && description.length < 400) {
            description += " " + text;
          }
        });
        
        places.push({
          name: heading.replace(/^\d+\.\s*/, "").trim(),
          category: "food_vendor",
          subType: "goan_cuisine",
          description: description.trim().slice(0, 350) || `${heading} - traditional Goan delicacy`,
          cuisine: [heading.toLowerCase()],
          sourceUrl: url,
          source: "resortrio",
          isGeneric: true, // These are food types, not specific places
        });
      }
    });
    
    console.log(`   Found ${places.length} food items from ResortRio`);
    // Return as reference data but mark as generic
    return places;
    
  } catch (error: any) {
    console.log(`   ⚠️ Failed to scrape ResortRio: ${error.message}`);
    return [];
  }
}

// ==========================================
// MAIN FUNCTION
// ==========================================
async function main() {
  const MONGO_URI = process.env.MONGO_URI;

  if (!MONGO_URI) {
    console.error("❌ MONGO_URI not set in .env.local");
    process.exit(1);
  }

  console.log("🍜 Goa Street Food & Local Experience Scraper");
  console.log("==============================================\n");

  if (process.env.GOOGLE_MAPS_BACKEND_API_KEY) {
    console.log("✅ Google Maps Geocoding API key found\n");
  } else {
    console.log("⚠️ No GOOGLE_MAPS_BACKEND_API_KEY - will use area fallbacks\n");
  }

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
      tags: [String],
      isVerified: { type: Boolean, default: false },
      contributedBy: { type: String },
      sourceUrl: { type: String },
      isActive: { type: Boolean, default: true },
      createdAt: { type: Date, default: Date.now },
      updatedAt: { type: Date, default: Date.now },
    });

    const GoaAmenity = mongoose.models.GoaAmenity || mongoose.model("GoaAmenity", GoaAmenitySchema);

    // Scrape all sources
    const allPlaces: any[] = [];
    
    const treeboPlaces = await scrapeTreebo();
    await new Promise(r => setTimeout(r, CRAWL_DELAY_MS));
    
    const wanderlogPlaces = await scrapeWanderlog();
    await new Promise(r => setTimeout(r, CRAWL_DELAY_MS));
    
    const goaExpPlaces = await scrapeGoaExperience();
    await new Promise(r => setTimeout(r, CRAWL_DELAY_MS));
    
    const resortRioPlaces = await scrapeResortRio();
    
    // Combine all (exclude generic food types)
    allPlaces.push(...treeboPlaces.filter(p => !p.isGeneric));
    allPlaces.push(...wanderlogPlaces.filter(p => !p.isGeneric));
    allPlaces.push(...goaExpPlaces.filter(p => !p.isGeneric));
    // ResortRio is mostly generic food types, include only if specific
    allPlaces.push(...resortRioPlaces.filter(p => !p.isGeneric));

    console.log(`\n📊 Total places found: ${allPlaces.length}`);

    // Deduplicate by name
    const seenNames = new Set<string>();
    const uniquePlaces = allPlaces.filter(p => {
      const key = p.name.toLowerCase().trim();
      if (seenNames.has(key)) return false;
      seenNames.add(key);
      return true;
    });

    console.log(`   After deduplication: ${uniquePlaces.length}`);

    // Geocode and save
    console.log("\n📍 Geocoding and saving...");
    let saved = 0;
    let skipped = 0;

    for (const place of uniquePlaces) {
      // Try geocoding
      let coords = await geocode(place.name, place.area);
      
      // Fallback to area coordinates
      if (!coords && place.area) {
        coords = getAreaCoords(place.area);
        if (coords) {
          console.log(`   📍 Using area coords for "${place.name}" (${place.area})`);
        }
      }
      
      if (coords) {
        try {
          await GoaAmenity.findOneAndUpdate(
            { name: place.name },
            {
              name: place.name,
              category: place.category,
              subType: place.subType,
              location: {
                address: place.address || "",
                landmark: "",
                area: place.area || "",
                lat: coords.lat,
                lng: coords.lng,
              },
              description: place.description,
              details: {
                cuisine: place.cuisine || [],
              },
              tags: [place.subType, place.source, "scraped"],
              isVerified: false,
              contributedBy: place.source,
              sourceUrl: place.sourceUrl,
              isActive: true,
              updatedAt: new Date(),
            },
            { upsert: true, new: true }
          );
          saved++;
          console.log(`   ✓ Saved: ${place.name}`);
        } catch (e: any) {
          console.log(`   ⚠️ Failed to save "${place.name}": ${e.message}`);
        }
      } else {
        skipped++;
        console.log(`   ⏭️ Skipped "${place.name}" - no coordinates`);
      }
      
      // Rate limit
      await new Promise(r => setTimeout(r, 300));
    }

    console.log(`\n✅ Scraping complete!`);
    console.log(`   Saved: ${saved}`);
    console.log(`   Skipped: ${skipped}`);

    // Summary
    const counts = await GoaAmenity.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: "$category", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    console.log("\n📊 Database Summary:");
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

