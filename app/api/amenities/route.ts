import { NextRequest, NextResponse } from "next/server";
import connectMongo from "@/lib/mongodb";
import GoaAmenity from "@/models/GoaAmenity";

// Disable Next.js caching for this route - always fetch fresh data
export const dynamic = "force-dynamic";
export const revalidate = 0;

// Helper: Generate a human-friendly description based on type/tags
function generateDescription(item: any): string {
  const type = item.type || "";
  const name = item.name || "";
  const tags = item.tags || [];
  const location = item.location || {};
  const details = item.details || {};
  
  // If already has description, enhance it with location
  if (item.description && item.description.length > 10) {
    return item.description;
  }
  
  const descriptions: Record<string, string> = {
    // Toilets & Facilities
    toilets: "Public restroom facility",
    toilet: "Public restroom facility",
    drinking_water: "Public drinking water tap",
    water_point: "Fresh water refill point",
    
    // Rest & Seating
    bench: "Public seating - take a break and enjoy the surroundings",
    shelter: "Covered rest area - shelter from sun or rain",
    picnic_site: "Picnic spot with seating area",
    
    // Food & Drinks - Local
    fast_food: "Quick bites and snacks",
    kiosk: "Small shop - snacks, drinks, essentials",
    convenience: "Kirana/convenience store - daily essentials, snacks, cold drinks",
    deli: "Local delicatessen - fresh cuts and prepared foods",
    butcher: "Fresh meat shop",
    greengrocer: "Fresh fruits and vegetables",
    bakery: "Fresh bread, pastries, and baked goods",
    confectionery: "Sweets and confections",
    pastry: "Fresh pastries and baked treats",
    
    // Food & Drinks - Restaurants
    restaurant: "Sit-down dining",
    cafe: "Coffee, tea, and light meals",
    bar: "Drinks and spirits",
    pub: "Local pub - drinks and food",
    ice_cream: "Ice cream and cold desserts",
    food_court: "Multiple food vendors in one place",
    
    // Shops
    supermarket: "Supermarket - groceries and household items",
    marketplace: "Local market - fresh produce, goods, and local finds",
    general: "General store - variety of everyday items",
    variety_store: "Variety store - assorted goods",
    
    // Leisure
    park: "Public park - green space to relax",
    garden: "Garden - peaceful greenery",
    playground: "Playground for children",
    beach: "Beach access",
    recreation_ground: "Open recreation area",
    
    // Other
    fuel: "Petrol pump / fuel station",
    atm: "ATM - cash withdrawal",
    pharmacy: "Pharmacy / medical store",
    
    // Tourism
    attraction: "Tourist attraction",
    viewpoint: "Scenic viewpoint",
    hotel: "Hotel accommodation",
    guest_house: "Guest house / homestay",
  };
  
  let desc = descriptions[type] || "";
  
  // Add cuisine info for restaurants/cafes
  if (details.cuisine && Array.isArray(details.cuisine)) {
    const cuisineStr = details.cuisine.slice(0, 3).join(", ");
    desc = desc ? `${desc}. ${cuisineStr} cuisine` : `${cuisineStr} cuisine`;
  }
  
  // Add features
  const features = [];
  if (details.takeaway) features.push("takeaway");
  if (details.outdoorSeating) features.push("outdoor seating");
  if (details.delivery) features.push("delivery");
  if (details.wheelchair) features.push("wheelchair accessible");
  if (details.isFree) features.push("free");
  
  if (features.length > 0) {
    desc = desc ? `${desc}. ${features.join(", ")}` : features.join(", ");
  }
  
  // If still no description, create from name and type
  if (!desc) {
    if (type && name && name.toLowerCase() !== type.toLowerCase()) {
      desc = `${type.replace(/_/g, " ")} - ${name}`;
    } else if (type) {
      desc = type.replace(/_/g, " ");
    }
  }
  
  return desc;
}

// Helper: Get location context string
function getLocationContext(location: any): string {
  const parts = [];
  if (location.landmark) parts.push(`Near ${location.landmark}`);
  if (location.area) parts.push(location.area);
  if (location.address && !parts.length) parts.push(location.address);
  return parts.join(", ") || "";
}

// GET /api/amenities?lat=..&lng=..&radius=..&types=comma,separated
// Uses 3 sources to bring local life alive:
// 1. Local Goa database (FREE) - curated hyper-local data (cutlet carts, local toilets, hidden gems)
// 2. Overpass API (FREE) - OpenStreetMap amenities (kirana shops, benches, parks, local eateries)
// 3. Google Places (PAID) - commercial establishments with photos/reviews (restaurants, cafes)
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const lat = parseFloat(searchParams.get("lat") || "");
    const lng = parseFloat(searchParams.get("lng") || "");
    const radius = parseInt(searchParams.get("radius") || "2000", 10); // Default 2km
    const typesParam = (searchParams.get("types") || "").trim();
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return NextResponse.json({ error: "lat/lng required" }, { status: 400 });
    }
    const userTypes = typesParam ? typesParam.split(",").map((t) => t.trim()).filter(Boolean) : [];
    const wantBus = userTypes.some((t) => ["bus", "bus_stop", "bus_station", "transit"].includes(t));

    // ============================================
    // SOURCE 1: Local Goa Database (FREE, curated)
    // The soul of local Goa - cutlet carts, hidden toilets, local favorites
    // ============================================
    async function fetchGoaLocal() {
      try {
        await connectMongo();
        
        // Use wider search for local data (5km minimum)
        const searchRadiusM = Math.max(radius, 5000);
        const radiusDegrees = searchRadiusM / 111000;
        
        let docs = await GoaAmenity.find({
          "location.lat": { $gte: lat - radiusDegrees, $lte: lat + radiusDegrees },
          "location.lng": { $gte: lng - radiusDegrees, $lte: lng + radiusDegrees },
        }).limit(200).lean();

        // Fallback: get any Goa amenities if none nearby
        if (!docs || docs.length === 0) {
          docs = await GoaAmenity.find({}).limit(100).lean();
        }

        console.log(`[fetchGoaLocal] Found ${docs?.length || 0} local amenities near ${lat},${lng}`);

        return (docs || [])
          .map((doc: any) => {
            const dLat = doc.location?.lat - lat;
            const dLng = doc.location?.lng - lng;
            const distance = Math.sqrt(dLat * dLat + dLng * dLng) * 111000;
            
            // Use 5km effective radius for local data
            if (distance > 5000) return null;
            
            return {
              name: doc.name,
              type: doc.subType || doc.category,
              location: {
                address: doc.location?.address || "",
                landmark: doc.location?.landmark || "",
                area: doc.location?.area || "",
                lat: doc.location?.lat,
                lng: doc.location?.lng,
              },
              description: doc.description || "",
              costLevel: doc.details?.isFree ? "Free" : doc.details?.priceRange || "Unknown",
              imageUrl: doc.imageUrl || "",
              tags: doc.tags || [],
              external_place_id: `goa:${doc._id}`,
              source: "goa_local",
              category: doc.category,
              details: doc.details || {},
              isVerified: doc.isVerified,
              distance,
            };
          })
          .filter(Boolean)
          .sort((a: any, b: any) => (a.distance || 0) - (b.distance || 0));
      } catch (e) {
        console.error("Goa local fetch error:", e);
        return [];
      }
    }

    // ============================================
    // SOURCE 2: Overpass API (FREE, OpenStreetMap)
    // Local life: kirana shops, chai stalls, benches, parks, local restaurants
    // ============================================
    
    // Expanded tags for authentic local experience
    const amenityTags = [
      // Essentials
      "toilets", "drinking_water", "water_point",
      // Rest spots
      "bench", "shelter",
      // Food - all kinds
      "fast_food", "cafe", "restaurant", "food_court", "ice_cream", "pub", "bar", "biergarten",
      // Services
      "fuel", "atm", "pharmacy", "bank",
      // Markets
      "marketplace", "vending_machine",
    ];
    
    const shopTags = [
      // Local shops (kirana, general stores)
      "convenience", "general", "variety_store", "department_store",
      "supermarket", "grocery",
      // Food shops
      "bakery", "butcher", "greengrocer", "deli", "kiosk", 
      "confectionery", "pastry", "seafood", "tea", "coffee",
      // Others
      "alcohol", "beverages", "dairy", "frozen_food",
    ];
    
    const leisureTags = [
      "park", "garden", "playground", "picnic_table",
      "recreation_ground", "beach_resort", "swimming_pool",
      "nature_reserve", "bird_hide",
    ];
    
    const tourismTags = [
      "picnic_site", "attraction", "viewpoint", "artwork",
      "hotel", "guest_house", "hostel", "motel", "resort",
      "camp_site", "information",
    ];

    const amenityRegex = amenityTags.join("|");
    const shopRegex = shopTags.join("|");
    const leisureRegex = leisureTags.join("|");
    const tourismRegex = tourismTags.join("|");

    const busFilter = wantBus
      ? `
        nwr(around:${radius},${lat},${lng})[amenity=bus_station];
        nwr(around:${radius},${lat},${lng})[highway=bus_stop];
        nwr(around:${radius},${lat},${lng})[public_transport=platform][bus=yes];
        nwr(around:${radius},${lat},${lng})[public_transport=stop_position][bus=yes];
      `
      : "";

    // Use larger radius for Overpass to capture more local spots
    const overpassRadius = Math.max(radius, 2500);
    
    const overpassQuery = `
      [out:json][timeout:60];
      (
        // Core amenities
        nwr(around:${overpassRadius},${lat},${lng})[amenity~"^(${amenityRegex})$"];
        // Shops - the heart of local life
        nwr(around:${overpassRadius},${lat},${lng})[shop~"^(${shopRegex})$"];
        // Leisure spots
        nwr(around:${overpassRadius},${lat},${lng})[leisure~"^(${leisureRegex})$"];
        // Tourism & accommodation
        nwr(around:${overpassRadius},${lat},${lng})[tourism~"^(${tourismRegex})$"];
        // Natural features
        nwr(around:${overpassRadius},${lat},${lng})[natural=beach];
        // Food vendors - street food culture
        nwr(around:${overpassRadius},${lat},${lng})[amenity=fast_food][takeaway=yes];
        nwr(around:${overpassRadius},${lat},${lng})[amenity=fast_food][outdoor_seating=yes];
        nwr(around:${overpassRadius},${lat},${lng})[shop=kiosk];
        nwr(around:${overpassRadius},${lat},${lng})[shop=newsagent];
        nwr(around:${overpassRadius},${lat},${lng})[amenity=vending_machine];
        // Seating and rest
        nwr(around:${overpassRadius},${lat},${lng})[amenity=bench];
        nwr(around:${overpassRadius},${lat},${lng})[leisure=picnic_table];
        ${busFilter}
      );
      out center;
    `;

    async function fetchOverpass() {
      const res = await fetch("https://overpass-api.de/api/interpreter", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ data: overpassQuery }),
      });
      if (!res.ok) {
        throw new Error("Overpass error");
      }
      const data = await res.json();
      const elements = Array.isArray(data?.elements) ? data.elements : [];
      
      const transformed = elements
        .map((el: any) => {
          const tags = el.tags || {};
          const name = tags.name || tags["ref"] || tags.brand || "";
          const type =
            tags.amenity ||
            tags.shop ||
            tags.leisure ||
            tags.tourism ||
            tags.natural ||
            "amenity";
          const centerLike = el.type === "node" ? el : el.center;
          const lat0 = centerLike?.lat;
          const lng0 = centerLike?.lon;
          if (!Number.isFinite(lat0) || !Number.isFinite(lng0)) return null;
          
          // Build address from OSM tags
          const addrParts = [
            tags["addr:housenumber"],
            tags["addr:street"],
            tags["addr:city"] || tags["addr:suburb"] || tags["addr:hamlet"],
            tags["addr:postcode"],
          ].filter(Boolean);
          const fullAddress = tags["addr:full"] || addrParts.join(", ") || "";
          
          // Get landmark/area info
          const landmark = tags["addr:place"] || tags["addr:suburb"] || tags["addr:hamlet"] || "";
          const area = tags["addr:city"] || tags["addr:district"] || tags["addr:state"] || "";
          
          // Parse opening hours
          const openingHours = tags["opening_hours"] || "";
          let openTime = "";
          let closeTime = "";
          const hoursMatch = openingHours.match(/(\d{1,2}:\d{2})-(\d{1,2}:\d{2})/);
          if (hoursMatch) {
            openTime = hoursMatch[1];
            closeTime = hoursMatch[2];
          }
          
          // Determine cost level
          let costLevel = "Unknown";
          if (tags.fee === "no" || tags.access === "yes" || ["park", "garden", "beach", "bench"].includes(type)) {
            costLevel = "Free";
          } else if (tags.fee === "yes") {
            costLevel = "Paid";
          }
          
          // Build details object
          const details: any = {};
          if (openTime) details.openTime = openTime;
          if (closeTime) details.closeTime = closeTime;
          if (tags.fee === "no") details.isFree = true;
          if (tags.fee === "yes") details.isFree = false;
          if (tags.cuisine) details.cuisine = tags.cuisine.split(";").map((c: string) => c.trim());
          if (tags.phone) details.phone = tags.phone;
          if (tags.website) details.website = tags.website;
          if (tags.wheelchair) details.wheelchair = tags.wheelchair === "yes";
          if (tags.outdoor_seating) details.outdoorSeating = tags.outdoor_seating === "yes";
          if (tags.takeaway) details.takeaway = tags.takeaway === "yes";
          if (tags.delivery) details.delivery = tags.delivery === "yes";
          if (openingHours) details.openingHoursRaw = openingHours;
          
          // Build tags array
          const usefulTags = [
            tags.amenity, tags.shop, tags.leisure, tags.tourism, tags.natural,
            tags.cuisine, tags.diet,
            tags.takeaway === "yes" ? "takeaway" : null,
            tags.delivery === "yes" ? "delivery" : null,
            tags.outdoor_seating === "yes" ? "outdoor_seating" : null,
            tags.wheelchair === "yes" ? "wheelchair_accessible" : null,
            tags.internet_access === "yes" || tags.internet_access === "wlan" ? "wifi" : null,
          ].filter(Boolean);
          
          // Generate display name for unnamed places
          const displayName = name || generateTypeName(type, tags);
          
          return {
            name: displayName,
            type,
            location: {
              address: fullAddress,
              landmark,
              area,
              lat: lat0,
              lng: lng0,
            },
            description: "", // Will be generated later
            costLevel,
            imageUrl: "",
            tags: usefulTags,
            external_place_id: `osm:${el.type}:${el.id}`,
            source: "overpass",
            category: type,
            details,
            isVerified: false,
          };
        })
        .filter(Boolean);
      return transformed;
    }
    
    // Generate a readable name for unnamed OSM features
    function generateTypeName(type: string, tags: any): string {
      const typeNames: Record<string, string> = {
        toilets: "Public Toilet",
        drinking_water: "Drinking Water",
        bench: "Public Bench",
        shelter: "Shelter",
        convenience: "Convenience Store",
        general: "General Store",
        kiosk: "Kiosk",
        fast_food: tags.cuisine ? `${tags.cuisine.split(";")[0]} Stall` : "Food Stall",
        cafe: "Café",
        restaurant: "Restaurant",
        bakery: "Bakery",
        supermarket: "Supermarket",
        park: "Park",
        garden: "Garden",
        beach: "Beach",
        fuel: "Petrol Pump",
        atm: "ATM",
        pharmacy: "Pharmacy",
        hotel: "Hotel",
        guest_house: "Guest House",
      };
      return typeNames[type] || type.replace(/_/g, " ");
    }

    // ============================================
    // SOURCE 3: Google Places (PAID, rich metadata)
    // Popular spots with reviews, photos - the commercial layer
    // ============================================
    async function fetchGooglePlaces() {
      const apiKey = process.env.GOOGLE_MAPS_BACKEND_API_KEY;
      if (!apiKey) return [] as any[];
      
      const nearbyTypes = [
        "park", "tourist_attraction",
        "cafe", "restaurant", "bar", "bakery",
        "meal_takeaway", "food_court",
        "convenience_store", "supermarket",
        "lodging", "spa", "night_club",
      ];
      
      const textQueries = [
        // Toilets
        "public toilet", "restroom",
        // Local food culture
        "street food", "food cart", "food truck",
        "dhaba", "local restaurant", "beach shack",
        // Specific Goa searches
        "garden restaurant Goa", "rooftop restaurant",
        "seafood restaurant", "fish thali",
        // Relaxation
        "beach", "garden", "park",
        "resort", "spa",
        // Quick bites
        "bakery", "chai", "coffee shop",
      ];
      
      const nearbyCalls = nearbyTypes.map((t) => {
        const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=${radius}&type=${encodeURIComponent(t)}&key=${apiKey}`;
        return fetch(url).then((r) => (r.ok ? r.json() : null)).catch(() => null);
      });
      
      const textCalls = textQueries.map((q) => {
        const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(q)}&location=${lat},${lng}&radius=${radius}&key=${apiKey}`;
        return fetch(url).then((r) => (r.ok ? r.json() : null)).catch(() => null);
      });
      
      const responses = await Promise.all([...nearbyCalls, ...textCalls]);
      const items = responses
        .flatMap((res) => (res && Array.isArray(res.results) ? res.results : []))
        .filter(Boolean);
      
      // Dedupe by place_id
      const byPlaceId = new Map<string, any>();
      for (const r of items) {
        if (!r.place_id) continue;
        if (!byPlaceId.has(r.place_id)) byPlaceId.set(r.place_id, r);
      }
      
      const list = Array.from(byPlaceId.values());
      return list
        .map((r: any) => {
          const loc = r.geometry?.location;
          const lat0 = loc?.lat;
          const lng0 = loc?.lng;
          if (!Number.isFinite(lat0) || !Number.isFinite(lng0)) return null;
          
          const priceLevel = r.price_level;
          const costLevel =
            priceLevel != null
              ? priceLevel === 0 ? "Free" : "$".repeat(Math.max(1, Math.min(4, priceLevel)))
              : "Unknown";
          
          // Determine category from types
          const types = r.types || [];
          let category = "place";
          if (types.includes("restaurant") || types.includes("food")) category = "restaurant";
          else if (types.includes("cafe")) category = "cafe";
          else if (types.includes("bar")) category = "bar";
          else if (types.includes("lodging") || types.includes("hotel")) category = "lodging";
          else if (types.includes("park")) category = "park";
          else if (types.includes("store") || types.includes("shopping")) category = "shop";
          
          return {
            name: r.name || (r.types && r.types[0]) || "Place",
            type: types[0] || "place",
            location: {
              address: r.formatted_address || r.vicinity || "",
              landmark: "",
              area: "",
              lat: lat0,
              lng: lng0,
            },
            description: "", // Will be generated
            costLevel,
            imageUrl: r.photos && r.photos.length
              ? `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photoreference=${r.photos[0].photo_reference}&key=${apiKey}`
              : "",
            tags: types,
            external_place_id: r.place_id,
            source: "google",
            category,
            details: {
              rating: r.rating,
              userRatingsTotal: r.user_ratings_total,
              priceLevel: r.price_level,
            },
            isVerified: true,
          };
        })
        .filter(Boolean);
    }

    // Execute all providers in parallel
    const [goaLocalResults, overpassResults, googleResults] = await Promise.all([
      fetchGoaLocal().catch((e) => { console.error('[amenities] Goa local error:', e); return []; }),
      fetchOverpass().catch((e) => { console.error('[amenities] Overpass error:', e); return []; }),
      fetchGooglePlaces().catch((e) => { console.error('[amenities] Google error:', e); return []; }),
    ]);
    
    console.log(`[amenities] Results: goaLocal=${goaLocalResults.length}, overpass=${overpassResults.length}, google=${googleResults.length}`);
    
    // Log category breakdown
    const logCategories = (results: any[], source: string) => {
      const cats: Record<string, number> = {};
      results.forEach(r => { cats[r.type] = (cats[r.type] || 0) + 1; });
      const top5 = Object.entries(cats).sort((a, b) => b[1] - a[1]).slice(0, 5);
      console.log(`[amenities] ${source} top types:`, top5.map(([k, v]) => `${k}:${v}`).join(", "));
    };
    if (overpassResults.length) logCategories(overpassResults, "Overpass");
    if (googleResults.length) logCategories(googleResults, "Google");

    // ============================================
    // MERGE & ENRICH: Combine all sources, add descriptions
    // ============================================
    const merged: any[] = [];
    const seenKeys = new Map<string, any>();
    
    function coordKey(lat0: number, lng0: number) {
      return `${lat0.toFixed(4)},${lng0.toFixed(4)}`;
    }
    function nameKey(name: string) {
      return (name || "").toLowerCase().trim().replace(/[^a-z0-9]/g, "");
    }
    
    // Process: local first (most valuable), then Google (has images), then OSM
    const allItems = [...goaLocalResults, ...googleResults, ...overpassResults];
    
    allItems.forEach((item) => {
      const nKey = nameKey(item.name);
      const cKey = coordKey(item.location?.lat || 0, item.location?.lng || 0);
      const key = `${nKey}|${cKey}`;
      
      if (!item.location?.lat) return;
      
      // Check for duplicates - only by exact key (name + coords), not just name
      const existing = seenKeys.get(key);
      if (existing) {
        // Replace if current has image and existing doesn't
        if (item.imageUrl && !existing.imageUrl) {
          const idx = merged.indexOf(existing);
          if (idx > -1) merged.splice(idx, 1);
          merged.push(item);
          seenKeys.set(key, item);
        }
        return;
      }
      
      seenKeys.set(key, item);
      merged.push(item);
    });
    
    // Enrich all items with descriptions and location context
    const enriched = merged.map((item) => {
      // Generate description if missing
      if (!item.description || item.description.length < 5) {
        item.description = generateDescription(item);
      }
      
      // Add location context to description if we have landmark info
      const locContext = getLocationContext(item.location);
      if (locContext && !item.description.includes(locContext)) {
        item.locationContext = locContext;
      }
      
      return item;
    });

    const usedSources = [];
    if (goaLocalResults.length) usedSources.push("goa_local");
    if (overpassResults.length) usedSources.push("overpass");
    if (googleResults.length) usedSources.push("google");

    console.log(`[amenities] Final merged results: ${enriched.length}`);

    return NextResponse.json(
      { source: usedSources.join("+") || "none", results: enriched },
      { status: 200 }
    );
  } catch (e: any) {
    console.error('[amenities] Error:', e);
    return NextResponse.json({ error: e.message || "Amenities lookup failed" }, { status: 500 });
  }
}
