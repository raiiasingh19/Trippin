/**
 * Enhanced Goa Tourism Scraper v2
 * 
 * Features:
 * 1. Recursive BFS crawling - discovers all pages automatically
 * 2. Google Maps Geocoding - gets real coordinates for any place
 * 3. Deduplication - doesn't visit same URL twice
 * 
 * Run with: npm run scrape:goa-tourism-v2
 */

import axios from "axios";
import * as cheerio from "cheerio";
import mongoose from "mongoose";

const BASE_URL = "https://goa-tourism.com";
const MAX_PAGES = 100;  // Safety limit
const CRAWL_DELAY_MS = 1000;  // Be polite to the server

// Track visited URLs to avoid infinite loops
const visitedUrls = new Set<string>();
const urlQueue: string[] = [];  // BFS queue

// Cache geocoded results to avoid duplicate API calls
const geocodeCache = new Map<string, { lat: number; lng: number } | null>();

// ==========================================
// GOOGLE MAPS GEOCODING API
// ==========================================
async function geocode(placeName: string): Promise<{ lat: number; lng: number } | null> {
  // Check cache first
  const cacheKey = placeName.toLowerCase().trim();
  if (geocodeCache.has(cacheKey)) {
    return geocodeCache.get(cacheKey)!;
  }

  const apiKey = process.env.GOOGLE_MAPS_BACKEND_API_KEY;
  if (!apiKey) {
    console.log("   ⚠️ No GOOGLE_MAPS_BACKEND_API_KEY - using fallback coordinates");
    return null;
  }

  try {
    // Add "Goa, India" context for better accuracy
    const query = `${placeName}, Goa, India`;
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${apiKey}`;
    
    const response = await axios.get(url, { timeout: 10000 });
    const data = response.data;

    if (data.status === "OK" && data.results && data.results[0]) {
      const location = data.results[0].geometry.location;
      const result = { lat: location.lat, lng: location.lng };
      
      // Verify it's actually in Goa (roughly 14.5-16.0 lat, 73.5-74.5 lng)
      if (result.lat >= 14.5 && result.lat <= 16.0 && result.lng >= 73.5 && result.lng <= 74.5) {
        geocodeCache.set(cacheKey, result);
        console.log(`   📍 Geocoded "${placeName}" → ${result.lat.toFixed(4)}, ${result.lng.toFixed(4)}`);
        return result;
      } else {
        console.log(`   ⚠️ "${placeName}" geocoded outside Goa bounds, skipping`);
      }
    } else if (data.status === "ZERO_RESULTS") {
      console.log(`   ⚠️ No geocode results for "${placeName}"`);
    } else {
      console.log(`   ⚠️ Geocode API error: ${data.status}`);
    }
  } catch (error: any) {
    console.log(`   ⚠️ Geocode failed for "${placeName}": ${error.message}`);
  }

  geocodeCache.set(cacheKey, null);
  return null;
}

// Fallback coordinates for known locations (when API fails or no key)
const FALLBACK_COORDS: Record<string, { lat: number; lng: number; area: string }> = {
  "panaji": { lat: 15.4989, lng: 73.8278, area: "Panjim" },
  "panjim": { lat: 15.4989, lng: 73.8278, area: "Panjim" },
  "calangute": { lat: 15.5438, lng: 73.7553, area: "Calangute" },
  "baga": { lat: 15.5551, lng: 73.7514, area: "Baga" },
  "anjuna": { lat: 15.5739, lng: 73.7413, area: "Anjuna" },
  "vagator": { lat: 15.5969, lng: 73.7394, area: "Vagator" },
  "arambol": { lat: 15.6867, lng: 73.7042, area: "Arambol" },
  "palolem": { lat: 15.0100, lng: 74.0231, area: "Palolem" },
  "colva": { lat: 15.2789, lng: 73.9221, area: "Colva" },
  "margao": { lat: 15.2832, lng: 73.9862, area: "Margao" },
  "mapusa": { lat: 15.5937, lng: 73.8102, area: "Mapusa" },
  "old goa": { lat: 15.5008, lng: 73.9116, area: "Old Goa" },
  "dudhsagar": { lat: 15.3144, lng: 74.3147, area: "Dudhsagar" },
  "bondla": { lat: 15.4167, lng: 74.0167, area: "Bondla" },
};

function getFallbackCoords(name: string): { lat: number; lng: number; area: string } | null {
  const nameLower = name.toLowerCase();
  for (const [key, coords] of Object.entries(FALLBACK_COORDS)) {
    if (nameLower.includes(key)) {
      return coords;
    }
  }
  return null;
}

// ==========================================
// BFS RECURSIVE CRAWLER
// ==========================================

// Normalize URL to avoid duplicates like /beaches and /beaches/
function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url, BASE_URL);
    // Only crawl same domain
    if (!parsed.href.startsWith(BASE_URL)) return "";
    // Remove trailing slash, hash, query params
    let normalized = parsed.pathname.replace(/\/$/, "") || "/";
    return normalized.toLowerCase();
  } catch {
    return "";
  }
}

// Check if URL should be crawled
function shouldCrawl(url: string): boolean {
  const normalized = normalizeUrl(url);
  if (!normalized) return false;
  if (visitedUrls.has(normalized)) return false;
  
  // Skip non-content URLs
  const skipPatterns = [
    /\.(pdf|jpg|jpeg|png|gif|svg|css|js|ico|xml|json)$/i,
    /^\/api\//,
    /^\/admin/,
    /^\/login/,
    /^\/logout/,
    /^\/cart/,
    /^\/book/,
    /^\/payment/,
    /mailto:/,
    /tel:/,
    /javascript:/,
    /#$/,
  ];
  
  for (const pattern of skipPatterns) {
    if (pattern.test(url) || pattern.test(normalized)) {
      return false;
    }
  }
  
  return true;
}

// Extract all links from a page
function extractLinks($: cheerio.CheerioAPI): string[] {
  const links: string[] = [];
  
  $("a[href]").each((_, element) => {
    const href = $(element).attr("href");
    if (href && shouldCrawl(href)) {
      links.push(href);
    }
  });
  
  return links;
}

// Determine category based on URL or content
function determineCategory(url: string, $: cheerio.CheerioAPI): { category: string; subType: string } {
  const urlLower = url.toLowerCase();
  const pageText = $("body").text().toLowerCase();
  
  if (urlLower.includes("beach") || pageText.includes("beach")) {
    return { category: "beach_access", subType: "beach" };
  }
  if (urlLower.includes("temple") || pageText.includes("temple") || pageText.includes("mandir")) {
    return { category: "temple", subType: "hindu_temple" };
  }
  if (urlLower.includes("church") || pageText.includes("church") || pageText.includes("basilica")) {
    return { category: "temple", subType: "church" };
  }
  if (urlLower.includes("wildlife") || urlLower.includes("sanctuary") || pageText.includes("sanctuary")) {
    return { category: "park", subType: "wildlife_sanctuary" };
  }
  if (urlLower.includes("waterfall") || urlLower.includes("falls")) {
    return { category: "park", subType: "waterfall" };
  }
  if (urlLower.includes("fort") || pageText.includes("fort")) {
    return { category: "park", subType: "fort" };
  }
  if (urlLower.includes("museum")) {
    return { category: "park", subType: "museum" };
  }
  if (urlLower.includes("lake") || pageText.includes("lake")) {
    return { category: "park", subType: "lake" };
  }
  if (urlLower.includes("heritage") || pageText.includes("heritage") || pageText.includes("unesco")) {
    return { category: "park", subType: "heritage" };
  }
  
  return { category: "park", subType: "attraction" };
}

// Extract place data from a page
async function extractPlaces($: cheerio.CheerioAPI, url: string): Promise<any[]> {
  const places: any[] = [];
  const { category, subType } = determineCategory(url, $);
  
  // Try different selectors that tourism sites commonly use
  const cardSelectors = [
    ".card", ".place-card", ".destination-card", ".attraction-card",
    ".item", ".listing", ".entry",
    "article", ".content-block", ".grid-item",
    ".col-md-4", ".col-lg-4",  // Bootstrap grid items
  ];
  
  for (const selector of cardSelectors) {
    const elements = $(selector);
    if (elements.length === 0) continue;
    
    elements.each((_, element) => {
      const $el = $(element);
      
      // Extract name
      const name = (
        $el.find("h1, h2, h3, h4, h5, .title, .name, .heading").first().text().trim() ||
        $el.find("a").first().text().trim()
      ).replace(/\s+/g, " ");
      
      if (!name || name.length < 3 || name.length > 100) return;
      
      // Skip navigation/menu items
      if (["home", "about", "contact", "login", "book now", "read more", "view all"].includes(name.toLowerCase())) {
        return;
      }
      
      // Extract description
      const description = $el.find("p, .description, .excerpt, .summary").first().text().trim();
      
      // Extract image
      let imageUrl = $el.find("img").first().attr("src") || "";
      if (imageUrl && !imageUrl.startsWith("http")) {
        imageUrl = `${BASE_URL}${imageUrl.startsWith("/") ? "" : "/"}${imageUrl}`;
      }
      
      places.push({
        name,
        description: description || `${name} - from Goa Tourism`,
        imageUrl,
        category,
        subType,
        sourceUrl: url,
      });
    });
    
    if (places.length > 0) break;  // Found data, stop trying more selectors
  }
  
  // Also look for place names in headings and content
  $("h1, h2, h3").each((_, element) => {
    const text = $(element).text().trim().replace(/\s+/g, " ");
    
    // Check if it looks like a place name
    if (text.length >= 5 && text.length <= 60 && !places.find(p => p.name === text)) {
      const hasPlaceKeyword = /(beach|temple|church|fort|falls|waterfall|sanctuary|lake|museum|garden|palace)/i.test(text);
      
      if (hasPlaceKeyword) {
        places.push({
          name: text,
          description: `${text} - mentioned on Goa Tourism`,
          imageUrl: "",
          category,
          subType,
          sourceUrl: url,
        });
      }
    }
  });
  
  return places;
}

// Crawl a single page
async function crawlPage(url: string): Promise<{ places: any[]; newLinks: string[] }> {
  const fullUrl = url.startsWith("http") ? url : `${BASE_URL}${url.startsWith("/") ? "" : "/"}${url}`;
  
  try {
    console.log(`\n🔍 Crawling: ${url}`);
    
    const response = await axios.get(fullUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; GoaTrippin/1.0; Educational)",
        "Accept": "text/html",
      },
      timeout: 15000,
    });
    
    const $ = cheerio.load(response.data);
    
    // Extract places from this page
    const places = await extractPlaces($, url);
    console.log(`   Found ${places.length} potential places`);
    
    // Extract links to crawl next
    const newLinks = extractLinks($);
    console.log(`   Found ${newLinks.length} new links to explore`);
    
    return { places, newLinks };
    
  } catch (error: any) {
    console.log(`   ⚠️ Failed to crawl ${url}: ${error.message}`);
    return { places: [], newLinks: [] };
  }
}

// Main BFS crawl loop
async function crawlSite(): Promise<any[]> {
  const allPlaces: any[] = [];
  const seenPlaceNames = new Set<string>();
  
  // Start with homepage and key pages
  urlQueue.push(
    "/",
    "/beaches",
    "/nature",
    "/wildlife",
    "/history-heritage",
    "/temples",
    "/churches",
    "/museums",
    "/waterfalls",
    "/lakes-falls-springs-dams",
  );
  
  let pagesProcessed = 0;
  
  // BFS loop
  while (urlQueue.length > 0 && pagesProcessed < MAX_PAGES) {
    const url = urlQueue.shift()!;
    const normalized = normalizeUrl(url);
    
    if (!normalized || visitedUrls.has(normalized)) continue;
    visitedUrls.add(normalized);
    
    const { places, newLinks } = await crawlPage(url);
    pagesProcessed++;
    
    // Add unique places
    for (const place of places) {
      const key = place.name.toLowerCase();
      if (!seenPlaceNames.has(key)) {
        seenPlaceNames.add(key);
        allPlaces.push(place);
      }
    }
    
    // Add new links to queue (BFS)
    for (const link of newLinks) {
      const normalizedLink = normalizeUrl(link);
      if (normalizedLink && !visitedUrls.has(normalizedLink)) {
        urlQueue.push(link);
      }
    }
    
    // Be polite - don't hammer the server
    await new Promise(resolve => setTimeout(resolve, CRAWL_DELAY_MS));
  }
  
  console.log(`\n📊 Crawl complete: ${pagesProcessed} pages visited, ${allPlaces.length} places found`);
  return allPlaces;
}

// ==========================================
// MAIN FUNCTION
// ==========================================
async function main() {
  const MONGO_URI = process.env.MONGO_URI;

  if (!MONGO_URI) {
    console.error("❌ MONGO_URI not set");
    process.exit(1);
  }

  console.log("🌴 Goa Tourism Scraper v2 (with Geocoding & BFS Crawling)");
  console.log("=========================================================\n");

  // Check for Google API key
  if (process.env.GOOGLE_MAPS_BACKEND_API_KEY) {
    console.log("✅ Google Maps Geocoding API key found\n");
  } else {
    console.log("⚠️ No GOOGLE_MAPS_BACKEND_API_KEY - will use fallback coordinates\n");
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

    // Crawl the site
    console.log("🕷️ Starting BFS crawl of goa-tourism.com...");
    const rawPlaces = await crawlSite();

    // Geocode each place
    console.log("\n📍 Geocoding places...");
    const geocodedPlaces: any[] = [];
    
    for (const place of rawPlaces) {
      // Try Google Geocoding first
      let coords = await geocode(place.name);
      
      // Fall back to lookup table
      if (!coords) {
        const fallback = getFallbackCoords(place.name);
        if (fallback) {
          coords = { lat: fallback.lat, lng: fallback.lng };
          place.area = fallback.area;
          console.log(`   📍 Fallback for "${place.name}" → ${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`);
        }
      }
      
      if (coords) {
        geocodedPlaces.push({
          ...place,
          location: {
            address: "",
            landmark: "",
            area: place.area || "",
            lat: coords.lat,
            lng: coords.lng,
          },
          tags: [place.subType, "goa_tourism_official"],
          isVerified: true,
          contributedBy: "goa-tourism.com (scraped)",
        });
      } else {
        console.log(`   ⏭️ Skipping "${place.name}" - no coordinates found`);
      }
      
      // Rate limit geocoding
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    // Save to database
    console.log(`\n💾 Saving ${geocodedPlaces.length} places to database...`);
    
    let saved = 0;
    for (const place of geocodedPlaces) {
      try {
        await GoaAmenity.findOneAndUpdate(
          { name: place.name },
          { ...place, updatedAt: new Date(), isActive: true },
          { upsert: true, new: true }
        );
        saved++;
      } catch (e) {
        // Skip duplicates or errors
      }
    }
    
    console.log(`   ✅ Saved ${saved} places\n`);

    // Summary
    const counts = await GoaAmenity.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: "$category", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    console.log("📊 Database Summary:");
    let total = 0;
    for (const c of counts) {
      console.log(`   ${c._id}: ${c.count}`);
      total += c.count;
    }
    console.log(`   ────────────`);
    console.log(`   TOTAL: ${total}`);

    await mongoose.disconnect();
    console.log("\n✅ Done!");
    
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

main();

