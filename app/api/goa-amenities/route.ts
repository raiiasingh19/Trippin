import { NextRequest, NextResponse } from "next/server";
import connectMongo from "@/lib/mongodb";
import GoaAmenity from "@/models/GoaAmenity";

// GET /api/goa-amenities?lat=..&lng=..&radius=..&category=..&area=..
// Query local Goa amenities database
export async function GET(req: NextRequest) {
  try {
    await connectMongo();

    const { searchParams } = new URL(req.url);
    const lat = parseFloat(searchParams.get("lat") || "");
    const lng = parseFloat(searchParams.get("lng") || "");
    const radius = parseInt(searchParams.get("radius") || "1200", 10); // meters
    const category = searchParams.get("category") || "";
    const area = searchParams.get("area") || "";
    const tags = searchParams.get("tags") || "";

    // Build query
    const query: any = { isActive: true };

    // Filter by category
    if (category) {
      query.category = category;
    }

    // Filter by area
    if (area) {
      query["location.area"] = { $regex: area, $options: "i" };
    }

    // Filter by tags
    if (tags) {
      const tagList = tags.split(",").map((t) => t.trim()).filter(Boolean);
      if (tagList.length) {
        query.tags = { $in: tagList };
      }
    }

    let results;

    // If lat/lng provided, do a distance-based query
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      // Convert radius from meters to approximate degrees (rough: 1 degree ≈ 111km)
      const radiusDegrees = radius / 111000;

      query["location.lat"] = { $gte: lat - radiusDegrees, $lte: lat + radiusDegrees };
      query["location.lng"] = { $gte: lng - radiusDegrees, $lte: lng + radiusDegrees };

      const docs = await GoaAmenity.find(query).limit(100).lean();

      // Calculate actual distance and filter
      results = docs
        .map((doc: any) => {
          const dLat = doc.location.lat - lat;
          const dLng = doc.location.lng - lng;
          // Haversine approximation for short distances
          const distance = Math.sqrt(dLat * dLat + dLng * dLng) * 111000;
          return { ...doc, distance };
        })
        .filter((doc: any) => doc.distance <= radius)
        .sort((a: any, b: any) => a.distance - b.distance);
    } else {
      // No location filter, just return by other criteria
      results = await GoaAmenity.find(query).limit(100).lean();
    }

    // Transform to match amenities API format
    const transformed = results.map((doc: any) => ({
      name: doc.name,
      type: doc.subType || doc.category,
      location: {
        address: doc.location.address || "",
        landmark: doc.location.landmark || "",
        area: doc.location.area || "",
        lat: doc.location.lat,
        lng: doc.location.lng,
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
      distance: doc.distance,
    }));

    return NextResponse.json({
      source: "goa_local",
      count: transformed.length,
      results: transformed,
    });
  } catch (e: any) {
    console.error("Goa amenities error:", e);
    return NextResponse.json({ error: e.message || "Failed to fetch" }, { status: 500 });
  }
}

// POST /api/goa-amenities - Add a new local amenity
export async function POST(req: NextRequest) {
  try {
    await connectMongo();

    const body = await req.json();

    // Validate required fields
    if (!body.name || !body.category || !body.location?.lat || !body.location?.lng) {
      return NextResponse.json(
        { error: "Required: name, category, location.lat, location.lng" },
        { status: 400 }
      );
    }

    // Validate category
    const validCategories = [
      "toilet", "drinking_water", "park", "food_vendor", "dhaba",
      "shop", "temple", "petrol_pump", "beach_access", "rest_area", "market", "other",
    ];
    if (!validCategories.includes(body.category)) {
      return NextResponse.json(
        { error: `Invalid category. Must be one of: ${validCategories.join(", ")}` },
        { status: 400 }
      );
    }

    const amenity = new GoaAmenity({
      name: body.name,
      category: body.category,
      subType: body.subType || "",
      location: {
        address: body.location.address || "",
        landmark: body.location.landmark || "",
        area: body.location.area || "",
        lat: body.location.lat,
        lng: body.location.lng,
      },
      description: body.description || "",
      details: body.details || {},
      imageUrl: body.imageUrl || "",
      images: body.images || [],
      tags: body.tags || [],
      contributedBy: body.contributedBy || "anonymous",
      isVerified: false,
      isActive: true,
    });

    const saved = await amenity.save();

    return NextResponse.json({
      message: "Amenity added successfully",
      amenity: saved,
    }, { status: 201 });
  } catch (e: any) {
    console.error("Add amenity error:", e);
    return NextResponse.json({ error: e.message || "Failed to add" }, { status: 500 });
  }
}

