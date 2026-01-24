import { NextRequest, NextResponse } from "next/server";

type LatLng = { lat: number; lng: number };

function haversineMeters(a: LatLng, b: LatLng): number {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return R * c;
}

async function geocode(address: string): Promise<LatLng | null> {
  try {
    const key = process.env.GOOGLE_MAPS_BACKEND_API_KEY;
    if (!key) return null;
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${key}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const loc = data?.results?.[0]?.geometry?.location;
    if (!loc || typeof loc.lat !== "number" || typeof loc.lng !== "number") return null;
    return { lat: loc.lat, lng: loc.lng };
  } catch {
    return null;
  }
}

async function overpassWithRetry(query: string, retries = 3): Promise<any> {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch("https://overpass-api.de/api/interpreter", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ data: query }),
      });
      if (!res.ok) {
        if (i < retries - 1) {
          await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
          continue;
        }
        throw new Error("Overpass error");
      }
      const text = await res.text();
      if (text.includes("Error") || text.includes("runtime error")) {
        if (i < retries - 1) {
          await new Promise((r) => setTimeout(r, 2000 * (i + 1)));
          continue;
        }
        throw new Error("Overpass server busy");
      }
      return JSON.parse(text);
    } catch (e) {
      if (i < retries - 1) {
        await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
        continue;
      }
      throw e;
    }
  }
  throw new Error("Overpass failed after retries");
}

// Find bus stops near a specific point with expanding radius search (like ±15, ±30 min time offsets)
async function fetchBusStopsNearPoint(center: LatLng, radiusMeters: number = 2000): Promise<any[]> {
  const radiusKm = radiusMeters / 1000;
  const latDelta = radiusKm / 111;
  const lngDelta = radiusKm / (111 * Math.cos((center.lat * Math.PI) / 180));

  const q = `
    [out:json][timeout:30];
    (
      node["highway"="bus_stop"](${center.lat - latDelta},${center.lng - lngDelta},${center.lat + latDelta},${center.lng + lngDelta});
      node["public_transport"="platform"]["bus"="yes"](${center.lat - latDelta},${center.lng - lngDelta},${center.lat + latDelta},${center.lng + lngDelta});
      node["public_transport"="stop_position"]["bus"="yes"](${center.lat - latDelta},${center.lng - lngDelta},${center.lat + latDelta},${center.lng + lngDelta});
    );
    out body;
  `;

  const data = await overpassWithRetry(q).catch(() => ({ elements: [] }));
  const els = Array.isArray(data?.elements) ? data.elements : [];
  return els
    .filter((n: any) => n.type === "node" && typeof n.lat === "number" && typeof n.lon === "number")
    .map((n: any) => ({
      id: n.id,
      name: n.tags?.name || "Bus Stop",
      lat: n.lat,
      lng: n.lon,
      tags: n.tags || {},
      distance: haversineMeters(center, { lat: n.lat, lng: n.lon }),
    }))
    .filter((s: any) => s.distance <= radiusMeters)
    .sort((a: any, b: any) => a.distance - b.distance);
}

// Find bus stops in a bounding box between origin and destination
async function fetchBusStopsInCorridor(oLL: LatLng, dLL: LatLng, bufferKm: number = 3): Promise<any[]> {
  // Create a bounding box that encompasses the corridor with buffer
  const minLat = Math.min(oLL.lat, dLL.lat) - bufferKm / 111;
  const maxLat = Math.max(oLL.lat, dLL.lat) + bufferKm / 111;
  const minLng = Math.min(oLL.lng, dLL.lng) - bufferKm / (111 * Math.cos((oLL.lat * Math.PI) / 180));
  const maxLng = Math.max(oLL.lng, dLL.lng) + bufferKm / (111 * Math.cos((oLL.lat * Math.PI) / 180));

  const q = `
    [out:json][timeout:30];
    (
      node["highway"="bus_stop"](${minLat},${minLng},${maxLat},${maxLng});
      node["public_transport"="platform"]["bus"="yes"](${minLat},${minLng},${maxLat},${maxLng});
      node["public_transport"="stop_position"]["bus"="yes"](${minLat},${minLng},${maxLat},${maxLng});
    );
    out body;
  `;

  const data = await overpassWithRetry(q).catch(() => ({ elements: [] }));
  const els = Array.isArray(data?.elements) ? data.elements : [];
  return els
    .filter((n: any) => n.type === "node" && typeof n.lat === "number" && typeof n.lon === "number")
    .map((n: any) => ({
      id: n.id,
      name: n.tags?.name || "Bus Stop",
      lat: n.lat,
      lng: n.lon,
      tags: n.tags || {},
    }));
}

// Calculate progress of a point along the line from origin to destination (0 = at origin, 1 = at destination)
function progressAlongLine(p: LatLng, oLL: LatLng, dLL: LatLng): number {
  const totalDist = haversineMeters(oLL, dLL);
  if (totalDist === 0) return 0;
  
  // Project point onto line
  const dx = dLL.lng - oLL.lng;
  const dy = dLL.lat - oLL.lat;
  const px = p.lng - oLL.lng;
  const py = p.lat - oLL.lat;
  
  const t = Math.max(0, Math.min(1, (px * dx + py * dy) / (dx * dx + dy * dy || 1)));
  return t;
}

// Calculate perpendicular distance from point to line (origin to destination)
function perpendicularDistanceMeters(p: LatLng, oLL: LatLng, dLL: LatLng): number {
  const dx = dLL.lng - oLL.lng;
  const dy = dLL.lat - oLL.lat;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len === 0) return haversineMeters(p, oLL);
  
  // Cross product gives signed area, divide by length for distance
  const px = p.lng - oLL.lng;
  const py = p.lat - oLL.lat;
  const cross = Math.abs(px * dy - py * dx);
  
  // Convert to approximate meters
  const avgLat = (oLL.lat + dLL.lat) / 2;
  const latScale = 110540;
  const lngScale = 111320 * Math.cos((avgLat * Math.PI) / 180);
  
  return (cross / len) * Math.sqrt(latScale * latScale + lngScale * lngScale) / Math.sqrt(2);
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const origin = (searchParams.get("origin") || "").trim();
    const destination = (searchParams.get("destination") || "").trim();
    const corridorWidth = Math.min(Math.max(parseFloat(searchParams.get("corridor") || "5"), 2), 15);
    
    if (!origin || !destination) {
      return NextResponse.json({ found: false, message: "origin and destination required" }, { status: 400 });
    }
    
    const [oLL, dLL] = await Promise.all([geocode(origin), geocode(destination)]);
    if (!oLL || !dLL) {
      return NextResponse.json({ found: false, message: "geocode failed" }, { status: 400 });
    }

    // Distance-based incremental search radii (similar to ±15, ±30 min time offsets)
    // Start with smaller radius and expand: 500m, 1km, 2km, 3km, 5km
    const distanceOffsetsMeters = [500, 1000, 2000, 3000, 5000];

    // First, try to find bus stops near origin with expanding radius
    let originStops: any[] = [];
    for (const radius of distanceOffsetsMeters) {
      originStops = await fetchBusStopsNearPoint(oLL, radius);
      if (originStops.length > 0) break;
    }

    // Also find bus stops near destination with expanding radius
    let destStops: any[] = [];
    for (const radius of distanceOffsetsMeters) {
      destStops = await fetchBusStopsNearPoint(dLL, radius);
      if (destStops.length > 0) break;
    }

    // Fetch all bus stops in the corridor between origin and destination
    const allStops = await fetchBusStopsInCorridor(oLL, dLL, corridorWidth);
    
    // Merge all stops, removing duplicates by ID
    const seenIds = new Set<number>();
    const mergedStops: any[] = [];
    for (const s of [...originStops, ...destStops, ...allStops]) {
      if (!seenIds.has(s.id)) {
        seenIds.add(s.id);
        mergedStops.push(s);
      }
    }
    
    if (mergedStops.length === 0) {
      return NextResponse.json({ found: false, message: "no bus stops found in corridor" }, { status: 200 });
    }
    
    // Use merged stops for the rest of the logic
    const allStopsToUse = mergedStops;

    // Filter stops that are within the corridor (not too far off the direct path)
    const maxPerpendicularDist = corridorWidth * 1000; // km to meters
    const stopsInCorridor = allStopsToUse
      .map((s: any) => ({
        ...s,
        progress: progressAlongLine({ lat: s.lat, lng: s.lng }, oLL, dLL),
        perpDist: perpendicularDistanceMeters({ lat: s.lat, lng: s.lng }, oLL, dLL),
        distToOrigin: haversineMeters(oLL, { lat: s.lat, lng: s.lng }),
        distToDest: haversineMeters(dLL, { lat: s.lat, lng: s.lng }),
      }))
      .filter((s: any) => s.perpDist <= maxPerpendicularDist)
      .sort((a: any, b: any) => a.progress - b.progress);

    if (stopsInCorridor.length === 0) {
      return NextResponse.json({ found: false, message: "no bus stops found along route corridor" }, { status: 200 });
    }

    // Find origin stop: closest to origin with progress near 0
    let originStop = null;
    let bestOriginScore = Number.POSITIVE_INFINITY;
    for (const s of stopsInCorridor) {
      if (s.progress > 0.3) continue; // Must be in first 30% of route
      const score = s.distToOrigin;
      if (score < bestOriginScore) {
        bestOriginScore = score;
        originStop = s;
      }
    }

    // Find destination stop: closest to destination with progress near 1
    let destStop = null;
    let bestDestScore = Number.POSITIVE_INFINITY;
    for (const s of stopsInCorridor) {
      if (s.progress < 0.7) continue; // Must be in last 30% of route
      const score = s.distToDest;
      if (score < bestDestScore) {
        bestDestScore = score;
        destStop = s;
      }
    }

    // If no stop near destination, find the stop closest to destination overall
    if (!destStop) {
      for (const s of stopsInCorridor) {
        if (originStop && s.id === originStop.id) continue;
        const score = s.distToDest;
        if (score < bestDestScore) {
          bestDestScore = score;
          destStop = s;
        }
      }
    }

    // If no stop near origin, find the stop closest to origin overall
    if (!originStop) {
      for (const s of stopsInCorridor) {
        if (destStop && s.id === destStop.id) continue;
        const score = s.distToOrigin;
        if (score < bestOriginScore) {
          bestOriginScore = score;
          originStop = s;
        }
      }
    }

    if (!originStop || !destStop || originStop.id === destStop.id) {
      // Return the single best stop as a partial route
      const bestStop = originStop || destStop || stopsInCorridor[0];
      return NextResponse.json(
        {
          found: false,
          partial: true,
          message: "Only one usable bus stop found",
          route: { name: "Local Bus", operator: "Goa State Transport" },
          originStop: {
            name: bestStop.name,
            lat: bestStop.lat,
            lng: bestStop.lng,
            distance_m: Math.round(bestStop.distToOrigin),
          },
          midStop: {
            name: bestStop.name,
            lat: bestStop.lat,
            lng: bestStop.lng,
            distance_m: Math.round(bestStop.distToDest),
          },
          walkToDestination_m: Math.round(bestStop.distToDest),
          stopsInCorridor: stopsInCorridor.length,
        },
        { status: 200 }
      );
    }

    // Determine if this is a direct route (destination stop within 500m of destination)
    const isPartial = destStop.distToDest > 500;

    // Count intermediate stops
    const intermediateStops = stopsInCorridor.filter(
      (s: any) => s.progress > originStop.progress && s.progress < destStop.progress
    ).length;

    return NextResponse.json(
      {
        found: !isPartial,
        partial: isPartial,
        route: { name: "Local Bus", operator: "Goa State Transport" },
        originStop: {
          name: originStop.name,
          lat: originStop.lat,
          lng: originStop.lng,
          distance_m: Math.round(originStop.distToOrigin),
        },
        ...(isPartial
          ? {
              midStop: {
                name: destStop.name,
                lat: destStop.lat,
                lng: destStop.lng,
                distance_m: Math.round(destStop.distToDest),
              },
            }
          : {
              destinationStop: {
                name: destStop.name,
                lat: destStop.lat,
                lng: destStop.lng,
                distance_m: Math.round(destStop.distToDest),
              },
            }),
        walkToDestination_m: Math.round(destStop.distToDest),
        intermediateStops,
        stopsInCorridor: stopsInCorridor.length,
      },
      { status: 200 }
    );
  } catch (e: any) {
    console.error("OSM bus route error:", e);
    return NextResponse.json({ found: false, message: e.message || "error" }, { status: 500 });
  }
}
