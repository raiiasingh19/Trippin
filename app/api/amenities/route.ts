import { NextRequest, NextResponse } from "next/server";

// GET /api/amenities?lat=..&lng=..&radius=..&types=comma,separated
// Uses Overpass API (OpenStreetMap) plus optional OpenTripMap to find refreshment-friendly amenities:
// - toilets, drinking water, benches, shelters, fountains
// - parks, gardens, playgrounds, picnic sites, beaches
// - fast_food, cafes, restaurants, pubs, bars, food courts, ice cream
// - stores: convenience, supermarket, bakery, butcher, greengrocer, deli, kiosk, confectionery, pastry
// - approximate "food carts/trucks" via fast_food + takeaway/outdoor_seating/mobile heuristics and kiosks
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const lat = parseFloat(searchParams.get("lat") || "");
    const lng = parseFloat(searchParams.get("lng") || "");
    const radius = parseInt(searchParams.get("radius") || "1200", 10);
    const typesParam = (searchParams.get("types") || "").trim();
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return NextResponse.json({ error: "lat/lng required" }, { status: 400 });
    }
    const userTypes = typesParam ? typesParam.split(",").map((t) => t.trim()).filter(Boolean) : [];
    const wantBus = userTypes.some((t) => ["bus", "bus_stop", "bus_station", "transit"].includes(t));

    // Build a broader Overpass query: nwr (node/way/relation) and out center to centerize areas/relations.
    const amenityTags = [
      "toilets",
      "drinking_water",
      "bench",
      "shelter",
      "fountain",
      "marketplace",
      "fast_food",
      "cafe",
      "restaurant",
      "food_court",
      "ice_cream",
      "pub",
      "bar",
      "fuel",
    ];
    const shopTags = [
      "convenience",
      "supermarket",
      "bakery",
      "butcher",
      "greengrocer",
      "deli",
      "kiosk",
      "confectionery",
      "pastry",
    ];
    const leisureTags = [
      "park",
      "garden",
      "playground",
      "picnic_site",
      "recreation_ground",
      "beach",
    ];
    const tourismTags = [
      "picnic_site",
      "attraction",
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

    const overpassQuery = `
      [out:json][timeout:50];
      (
        nwr(around:${radius},${lat},${lng})[amenity~"^(${amenityRegex})$"];
        nwr(around:${radius},${lat},${lng})[shop~"^(${shopRegex})$"];
        nwr(around:${radius},${lat},${lng})[leisure~"^(${leisureRegex})$"];
        nwr(around:${radius},${lat},${lng})[tourism~"^(${tourismRegex})$"];
        nwr(around:${radius},${lat},${lng})[natural=beach];
        // Food cart / truck heuristics
        nwr(around:${radius},${lat},${lng})[amenity=fast_food][takeaway=yes];
        nwr(around:${radius},${lat},${lng})[amenity=fast_food][outdoor_seating=yes];
        nwr(around:${radius},${lat},${lng})[amenity=fast_food][mobile=yes];
        nwr(around:${radius},${lat},${lng})[shop=kiosk][food=yes];
        nwr(around:${radius},${lat},${lng})[amenity=vending_machine][vending~"^(food|drinks|beverages|water)$"];
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
          const name = tags.name || tags["ref"] || "";
          const category =
            (tags.amenity ? "amenity" : "") ||
            (tags.shop ? "shop" : "") ||
            (tags.leisure ? "leisure" : "") ||
            (tags.tourism ? "tourism" : "") ||
            (tags.natural ? "natural" : "") ||
            "other";
          const type =
            tags.amenity ||
            tags.shop ||
            tags.leisure ||
            tags.tourism ||
            tags.natural ||
            (tags.cuisine ? "fast_food" : "") ||
            "amenity";
          const centerLike = el.type === "node" ? el : el.center;
          const lat0 = centerLike?.lat;
          const lng0 = centerLike?.lon;
          if (!Number.isFinite(lat0) || !Number.isFinite(lng0)) return null;
          return {
            name: name || type,
            type,
            location: {
              address: tags["addr:full"] || tags["addr:street"] || "",
              lat: lat0,
              lng: lng0,
            },
            description: tags["description"] || "",
            costLevel: "Unknown",
            imageUrl: "",
            tags: Object.keys(tags),
            external_place_id: `osm:${el.type}:${el.id}`,
            source: "overpass",
            category,
          };
        })
        .filter(Boolean);
      return transformed as Array<{
        name: string;
        type: string;
        location: { address: string; lat: number; lng: number };
        description: string;
        costLevel: string;
        imageUrl: string;
        tags: string[];
        external_place_id: string;
        source: string;
        category: string;
      }>;
    }

    // Optional enrichment via OpenTripMap (requires OPENTRIPMAP_API_KEY)
    async function fetchOpenTripMap() {
      const apiKey = process.env.OPENTRIPMAP_API_KEY;
      if (!apiKey) return [] as any[];
      // Choose broad kinds relevant to refreshment and parks
      const kinds = [
        "foods",
        "catering",
        "fast_foods",
        "cafes",
        "restaurants",
        "bars",
        "pubs",
        "supermarkets",
        "marketplaces",
        "parks",
        "gardens",
        "playgrounds",
        "beaches",
        "picnic_sites",
        "drinking_water",
        "toilets",
      ].join(",");
      const params = new URLSearchParams({
        radius: String(Math.min(Math.max(radius, 100), 5000)),
        lon: String(lng),
        lat: String(lat),
        kinds,
        limit: "120",
        format: "json",
        apikey: apiKey,
      });
      const url = `https://api.opentripmap.com/0.1/en/places/radius?${params.toString()}`;
      const res = await fetch(url);
      if (!res.ok) return [] as any[];
      const list = await res.json();
      if (!Array.isArray(list)) return [] as any[];
      // Normalize
      return list
        .map((p: any) => {
          const name = p.name || p.kinds || "Place";
          const lat0 = p.point?.lat;
          const lng0 = p.point?.lon;
          if (!Number.isFinite(lat0) || !Number.isFinite(lng0)) return null;
          return {
            name,
            type: (p.kinds || "").split(",")[0] || "place",
            location: {
              address: "",
              lat: lat0,
              lng: lng0,
            },
            description: p.wikidata ? `Wikidata: ${p.wikidata}` : "",
            costLevel: "Unknown",
            imageUrl: "",
            tags: (p.kinds || "").split(","),
            external_place_id: p.xid ? `otm:${p.xid}` : `otm:${lat0.toFixed(6)},${lng0.toFixed(6)}:${name}`,
            source: "opentripmap",
            category: "external",
          };
        })
        .filter(Boolean);
    }

    // Execute providers
    const [overpassResults, otmResults] = await Promise.all([
      fetchOverpass().catch(() => []),
      fetchOpenTripMap().catch(() => []),
    ]);

    // Optional Google Places Nearby + Text Search
    async function fetchGooglePlaces() {
      const apiKey = process.env.GOOGLE_MAPS_BACKEND_API_KEY || process.env.GOOGLE_MAPS_BACKEND_API_KEY;
      if (!apiKey) return [] as any[];
      const nearbyTypes = [
        "park",
        "tourist_attraction",
        "cafe",
        "restaurant",
        "bar",
        "meal_takeaway",
        "food_court",
        "bakery",
        "convenience_store",
        "supermarket",
      ];
      const textQueries = [
        "public toilet",
        "restroom",
        "food cart",
        "food truck",
        "street food",
        "beach",
        "garden",
        "playground",
        "picnic site",
      ];
      const nearbyCalls = nearbyTypes.map((t) => {
        const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=${radius}&type=${encodeURIComponent(
          t
        )}&key=${apiKey}`;
        return fetch(url)
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null);
      });
      const textCalls = textQueries.map((q) => {
        const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(
          q
        )}&location=${lat},${lng}&radius=${radius}&key=${apiKey}`;
        return fetch(url)
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null);
      });
      const responses = await Promise.all([...nearbyCalls, ...textCalls]);
      const items = responses
        .flatMap((res) => (res && Array.isArray(res.results) ? res.results : []))
        .filter(Boolean);
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
              ? priceLevel === 0
                ? "Free"
                : "$".repeat(Math.max(1, Math.min(4, priceLevel)))
              : "Unknown";
          return {
            name: r.name || (r.types && r.types[0]) || "Place",
            type: (r.types && r.types[0]) || "place",
            location: {
              address: r.formatted_address || r.vicinity || "",
              lat: lat0,
              lng: lng0,
            },
            description: r.vicinity || r.formatted_address || "",
            costLevel,
            imageUrl:
              r.photos && r.photos.length
                ? `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photoreference=${r.photos[0].photo_reference}&key=${apiKey}`
                : "",
            tags: r.types || [],
            external_place_id: r.place_id,
            source: "google",
            category: "google",
          };
        })
        .filter(Boolean);
    }

    const googleResults = await fetchGooglePlaces().catch(() => []);

    // Deduplicate by external_place_id or name+lat/lng proximity
    const merged: any[] = [];
    const seen = new Set<string>();
    function coordKey(lat0: number, lng0: number) {
      return `${lat0.toFixed(5)},${lng0.toFixed(5)}`;
    }
    [...overpassResults, ...otmResults, ...googleResults].forEach((item) => {
      const key =
        item.external_place_id ||
        `${item.name}|${coordKey(item.location.lat, item.location.lng)}`;
      if (seen.has(key)) return;
      seen.add(key);
      merged.push(item);
    });

    const usedSources = [];
    if (overpassResults.length) usedSources.push("overpass");
    if (otmResults.length) usedSources.push("opentripmap");
    if (googleResults.length) usedSources.push("google");

    return NextResponse.json(
      { source: usedSources.join("+") || "none", results: merged },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Amenities lookup failed" }, { status: 500 });
  }
}


