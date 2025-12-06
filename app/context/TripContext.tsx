"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode, FormEvent } from "react";
import { getTransitItinerary } from "../utils/transitUtils";

interface StopTimes {
  arriveBy: string;
  leaveBy: string;
}

interface TripContextType {
  editingJourneyId: string | null;
  setEditingJourneyId: (val: string | null) => void;
  postSaveRedirectToTrips: boolean;
  setPostSaveRedirectToTrips: (v: boolean) => void;
  showRefreshmentModal: boolean;
  setShowRefreshmentModal: (v: boolean) => void;
  refreshmentItems: any[];
  setRefreshmentItems: (v: any[]) => void;
  refreshmentNote: string | null;
  setRefreshmentNote: (v: string | null) => void;
  refreshmentInsertIndex: number | null;
  setRefreshmentInsertIndex: (v: number | null) => void;
  pendingShowAmenities: boolean;
  setPendingShowAmenities: (v: boolean) => void;
  suggestRefreshments: () => Promise<void>;
  forceShowAmenities: () => Promise<void>;
  tripDate: string;
  setTripDate: (val: string) => void;
  origin: string;
  setOrigin: (val: string) => void;
  destination: string;
  setDestination: (val: string) => void;
  waypoints: string[];
  setWaypoints: (val: string[]) => void;
  originTime: string;
  setOriginTime: (val: string) => void;
  destinationTime: string;
  setDestinationTime: (val: string) => void;
  stopTimes: StopTimes[];
  setStopTimes: (val: StopTimes[]) => void;
  filterOption: string;
  setFilterOption: (val: string) => void;
  travelMode: google.maps.TravelMode;
  setTravelMode: (val: google.maps.TravelMode) => void;
  showModal: boolean;
  setShowModal: (val: boolean) => void;
  showItinerary: boolean;
  setShowItinerary: (val: boolean) => void;
  itinerary: { title: string; description: string }[];
  setItinerary: (val: { title: string; description: string }[]) => void;
  segmentInfos: any[];
  setSegmentInfos: (val: any[]) => void;
  savedJourneys: any[];
  setSavedJourneys: (val: any[]) => void;
  showTrips: boolean;
  setShowTrips: (val: boolean) => void;
  directions: google.maps.DirectionsResult | null;
  setDirections: (val: google.maps.DirectionsResult | null) => void;
  directionsSegments: google.maps.DirectionsResult[];
  setDirectionsSegments: (val: google.maps.DirectionsResult[]) => void;
  extraMarkers: { position: google.maps.LatLngLiteral }[];
  setExtraMarkers: (val: { position: google.maps.LatLngLiteral }[]) => void;
  pendingPlace: any | null;
  setPendingPlace: (val: any | null) => void;
  pendingRecalc: boolean;
  setPendingRecalc: (val: boolean) => void;
  addStop: () => void;
  removeStop: (i: number) => void;
  updateStop: (i: number, val: string) => void;
  updateStopTime: (i: number, f: "arriveBy" | "leaveBy", val: string) => void;
  viewSavedTripHandler: () => void;
  editSavedTripHandler: () => void;
  deleteTripHandler: (id: string) => void;
  saveTripHandler: () => Promise<any>;
  updateTripHandler: () => Promise<void>;
  getDirectionsHandler: (e: FormEvent, maps: typeof google.maps, setDirections?: any, setDirectionsSegments?: any, setExtraMarkers?: any) => Promise<void>;
}

const TripContext = createContext<TripContextType | undefined>(undefined);

export function useTripContext() {
  const ctx = useContext(TripContext);
  if (!ctx) throw new Error("useTripContext must be used within TripProvider");
  return ctx;
}

export function TripProvider({ children }: { children: ReactNode }) {
  // ...all state and handlers from GlobalNavbarWrapper go here...
  const [tripDate, setTripDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [origin, setOrigin] = useState("kk birla goa campus");
  const [destination, setDestination] = useState("");
  const [editingJourneyId, setEditingJourneyId] = useState<string | null>(null);
  const [waypoints, setWaypoints] = useState<string[]>([]);
  const [originTime, setOriginTime] = useState("");
  const [destinationTime, setDestinationTime] = useState("");
  const [stopTimes, setStopTimes] = useState<StopTimes[]>([]);
  const [filterOption, setFilterOption] = useState("BEST_ROUTE");
  const [travelMode, setTravelMode] = useState<google.maps.TravelMode>("DRIVING" as google.maps.TravelMode);
  const [showModal, setShowModal] = useState(false);
  const [showItinerary, setShowItinerary] = useState(false);
  const [showRefreshmentModal, setShowRefreshmentModal] = useState(false);
  const [refreshmentItems, setRefreshmentItems] = useState<any[]>([]);
  const [refreshmentNote, setRefreshmentNote] = useState<string | null>(null);
  const [refreshmentInsertIndex, setRefreshmentInsertIndex] = useState<number | null>(null);
  const [pendingShowAmenities, setPendingShowAmenities] = useState(false);
  const [postSaveRedirectToTrips, setPostSaveRedirectToTrips] = useState(false);
  const [itinerary, setItinerary] = useState<{ title: string; description: string }[]>([]);
  const [segmentInfos, setSegmentInfos] = useState<any[]>([]);
  const [savedJourneys, setSavedJourneys] = useState<any[]>([]);

  // temporary place being added from Explore -> Add-to-Trip flow
  const [pendingPlace, setPendingPlace] = useState<any | null>(null);
  // flag to trigger a directions recalculation after client-side updates
  const [pendingRecalc, setPendingRecalc] = useState(false);

  const [showTrips, setShowTrips] = useState(false);
  const [directions, setDirections] = useState<google.maps.DirectionsResult | null>(null);
  const [directionsSegments, setDirectionsSegments] = useState<google.maps.DirectionsResult[]>([]);
  const [extraMarkers, setExtraMarkers] = useState<{ position: google.maps.LatLngLiteral }[]>([]);

  const REFRESHMENT_THRESHOLD_SECS = 2 * 60 * 60; // 2 hours
  const hasRefreshmentKeyword = (s: string) => {
    const q = (s || "").toLowerCase();
    return ["restaurant","cafe","hotel","resort","restroom","toilet","washroom","park","store","supermarket"].some(k => q.includes(k));
  };
  async function suggestRefreshmentsWith(options?: {
    transitSegments?: google.maps.DirectionsResult[];
    driving?: google.maps.DirectionsResult | null;
  }) {
    try {
      setShowRefreshmentModal(false);
      setRefreshmentItems([]);
      setRefreshmentNote(null);
      setRefreshmentInsertIndex(null);
      const stops = waypoints.filter((w) => (w || "").trim());
      let longLegLabel = "";
      const segs = options?.transitSegments && options.transitSegments.length ? options.transitSegments : directionsSegments;
      if (travelMode === "TRANSIT" && segs.length > 0) {
        for (let i = 0; i < segs.length; i++) {
          const seg = segs[i];
          const leg = seg.routes?.[0]?.legs?.[0];
          if (!leg) continue;
          const dur = leg.duration?.value || 0;
          const a = [origin, ...stops, destination][i];
          const b = [origin, ...stops, destination][i+1];
          const hasRefresh = [a, b].some(x => x && hasRefreshmentKeyword(x));
          if (dur > REFRESHMENT_THRESHOLD_SECS && !hasRefresh) {
            longLegLabel = `${a} → ${b}`;
            setRefreshmentInsertIndex(i);
            const q = `restaurants near ${b}`;
            const endLat = leg.end_location.lat();
            const endLng = leg.end_location.lng();
            const [gData, oData, goaData] = await Promise.all([
              fetch(`/api/explore?q=${encodeURIComponent(q)}`).then(r => r.json()).catch(() => ({ results: [] })),
              fetch(`/api/amenities?lat=${encodeURIComponent(endLat)}&lng=${encodeURIComponent(endLng)}&radius=3000`).then(r => r.json()).catch(() => ({ results: [] })),
              fetch(`/api/goa-amenities?lat=${encodeURIComponent(endLat)}&lng=${encodeURIComponent(endLng)}&radius=5000`).then(r => r.json()).catch(() => ({ results: [] })),
            ]);
            const merged = [...(goaData.results || []), ...(oData.results || []), ...(gData.results || [])];
            setRefreshmentItems(merged.slice(0, 12));
            setRefreshmentNote(`Long leg detected (${longLegLabel}). Consider a refreshment stop.`);
            setShowRefreshmentModal(true);
            break;
          }
        }
      } else {
        const drv = options?.driving || directions;
        if (!drv) return;
        const legs = drv.routes?.[0]?.legs || [];
        const nodes = [origin, ...stops, destination];
        for (let i = 0; i < legs.length; i++) {
          const leg = legs[i];
          const dur = leg.duration?.value || 0;
          const a = nodes[i];
          const b = nodes[i+1];
          const hasRefresh = [a, b].some(x => x && hasRefreshmentKeyword(x));
          if (dur > REFRESHMENT_THRESHOLD_SECS && !hasRefresh) {
            longLegLabel = `${a} → ${b}`;
            setRefreshmentInsertIndex(i);
            const q = `restaurants near ${b}`;
            const endLat = leg.end_location.lat();
            const endLng = leg.end_location.lng();
            const [gData, oData, goaData] = await Promise.all([
              fetch(`/api/explore?q=${encodeURIComponent(q)}`).then(r => r.json()).catch(() => ({ results: [] })),
              fetch(`/api/amenities?lat=${encodeURIComponent(endLat)}&lng=${encodeURIComponent(endLng)}&radius=3000`).then(r => r.json()).catch(() => ({ results: [] })),
              fetch(`/api/goa-amenities?lat=${encodeURIComponent(endLat)}&lng=${encodeURIComponent(endLng)}&radius=5000`).then(r => r.json()).catch(() => ({ results: [] })),
            ]);
            const merged = [...(goaData.results || []), ...(oData.results || []), ...(gData.results || [])];
            setRefreshmentItems(merged.slice(0, 12));
            setRefreshmentNote(`Long leg detected (${longLegLabel}). Consider a refreshment stop.`);
            setShowRefreshmentModal(true);
            break;
          }
        }
      }
    } catch {
      // ignore
    }
  }
  const suggestRefreshments = async () => suggestRefreshmentsWith();

  async function forceShowAmenities() {
    try {
      // Do not toggle modal off to avoid render loops; just overwrite contents and show
      setRefreshmentItems([]);
      setRefreshmentNote(null);
      const stops = waypoints.filter((w) => (w || "").trim());
      let insertIdx = 0;
      let queryLabel = destination || origin || "Goa";
      // Default to central Goa (Panjim area) as fallback
      let lat = 15.4989;
      let lng = 73.8278;
      if (travelMode === "TRANSIT" && directionsSegments.length > 0) {
        const seg = directionsSegments[0];
        const leg = seg.routes?.[0]?.legs?.[0];
        if (leg) {
          lat = leg.end_location.lat();
          lng = leg.end_location.lng();
          queryLabel = [origin, ...stops, destination][1] || destination || origin || "Goa";
        }
      } else if (directions) {
        const leg = directions.routes?.[0]?.legs?.[0];
        if (leg) {
          lat = leg.end_location.lat();
          lng = leg.end_location.lng();
          queryLabel = [origin, ...stops, destination][1] || destination || origin || "Goa";
        }
      }
      setRefreshmentInsertIndex(insertIdx);
      const q = `restaurants near ${queryLabel}`;
      // Use larger radius (3km) for better results and include both amenities endpoints
      const [gData, oData, goaData] = await Promise.all([
        fetch(`/api/explore?q=${encodeURIComponent(q)}`).then(r => r.json()).catch(() => ({ results: [] })),
        fetch(`/api/amenities?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}&radius=3000`).then(r => r.json()).catch(() => ({ results: [] })),
        fetch(`/api/goa-amenities?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}&radius=5000`).then(r => r.json()).catch(() => ({ results: [] })),
      ]);
      // Merge all results, prioritizing local Goa data
      const merged = [
        ...(goaData.results || []),
        ...(oData.results || []),
        ...(gData.results || []),
      ];
      // Deduplicate by name (case-insensitive)
      const seen = new Set<string>();
      const deduped = merged.filter((item: any) => {
        const key = (item.name || "").toLowerCase().trim();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      setRefreshmentItems(deduped.slice(0, 12));
      setRefreshmentNote(`Nearby options around ${queryLabel}`);
      setShowRefreshmentModal(true);
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/journeys");
        if (res.ok) setSavedJourneys(await res.json());
      } catch (e) {
        console.error(e);
      }
    })();
  }, []);

  const addStop = () => {
    setWaypoints((w) => [...w, ""]);
    setStopTimes((t) => [...t, { arriveBy: "", leaveBy: "" }]);
  };
  const removeStop = (i: number) => {
    setWaypoints((w) => w.filter((_, idx) => idx !== i));
    setStopTimes((t) => t.filter((_, idx) => idx !== i));
  };
  const updateStop = (i: number, val: string) => {
    setWaypoints((w) => {
      const c = [...w];
      c[i] = val;
      return c;
    });
  };
  const updateStopTime = (i: number, f: "arriveBy" | "leaveBy", val: string) => {
    setStopTimes((t) => {
      const c = [...t];
      c[i] = { ...c[i], [f]: val };
      return c;
    });
  };
  function viewSavedTripHandler() {
    if (!savedJourneys.length) return alert("No saved trips.");
    const latest = savedJourneys[savedJourneys.length - 1];
    setItinerary([{ title: "Your Itinerary", description: latest.itinerary }]);
    setShowItinerary(true);
  }
  function editSavedTripHandler() {
    if (!savedJourneys.length) return alert("No saved trips.");
    const j = savedJourneys[savedJourneys.length - 1];
    setEditingJourneyId(j._id?.toString?.() || j._id);
    setOrigin(j.start);
    setDestination(j.destination);
    setWaypoints(j.waypoints || []);
    setStopTimes(j.stopTimes || []);
    setTravelMode(j.travelMode);
    setFilterOption(j.filterOption);
    setTripDate(new Date(j.startTime).toISOString().split("T")[0]);
    setOriginTime(new Date(j.startTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false }));
    setDestinationTime(new Date(j.endTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false }));
    setItinerary([{ title: "Your Itinerary", description: j.itinerary }]);
    setShowModal(true);
  }
  function deleteTripHandler(id: string) {
    fetch(`/api/journeys/${id}`, {
      method: "DELETE",
    })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to delete trip");
        setSavedJourneys((prev: any[]) => prev.filter((j) => j._id !== id));
        alert("Trip deleted.");
      })
      .catch((err) => alert("Error deleting trip."));
  }
  async function saveTripHandler() {
    const journey = {
      userId: "placeholder_user_id",
      start: origin,
      destination,
      waypoints,
      stopTimes,
      travelMode,
      filterOption,
      startTime: new Date(`${tripDate}T${originTime}:00`),
      endTime: new Date(`${tripDate}T${destinationTime}:00`),
      itinerary: itinerary.map((r) => `${r.title}: ${r.description}`).join("\n"),
    };
    try {
      const res = await fetch("/api/journeys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(journey),
      });
      if (res.ok) {
        const saved = await res.json();
        setSavedJourneys((j) => [...j, saved]);
        // set editing id so subsequent Save updates the same journey
        if (saved && saved._id) {
          setEditingJourneyId(saved._id as string);
        }
        alert("Trip saved.");
        return saved;
      } else {
        alert("Error saving trip.");
      }
    } catch {
      alert("Error saving trip.");
    }
    return null;
  }
  async function updateTripHandler() {
    if (!editingJourneyId) {
      alert("No trip selected for editing.");
      return;
    }
    const payload = {
      start: origin,
      destination,
      waypoints,
      stopTimes,
      travelMode,
      filterOption,
      startTime: new Date(`${tripDate}T${originTime}:00`),
      endTime: new Date(`${tripDate}T${destinationTime}:00`),
      itinerary: itinerary.map((r) => `${r.title}: ${r.description}`).join("\n"),
    };
    try {
      const res = await fetch(`/api/journeys/${editingJourneyId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Failed to update trip");
      }
      const updated = await res.json();
      setSavedJourneys((prev: any[]) =>
        prev.map((j) => (j._id === updated._id ? updated : j))
      );
      alert("Trip updated.");
      setEditingJourneyId(null);
    } catch (e: any) {
      console.error(e);
      alert(e.message || "Error updating trip.");
    }
  }
  async function getDirectionsHandler(
    e: FormEvent,
    maps: typeof google.maps,
    setDirectionsOverride?: any,
    setDirectionsSegmentsOverride?: any,
    setExtraMarkersOverride?: any
  ) {
    e.preventDefault();
    // If launched from the planner modal, this is a fresh plan; ensure we are not in edit mode
    if (showModal) {
      try {
        // clear any stale editing id so subsequent Save performs a POST (new trip)
        setEditingJourneyId(null);
      } catch {}
    }
    if (!origin || !destination) {
      return alert("Enter both origin and destination.");
    }
    const svc = new maps.DirectionsService();
    const stops = waypoints.filter((w) => w.trim());
    if (travelMode === "TRANSIT") {
      try {
        // Parse departure time - use current time if not specified
        let departureDate: Date;
        if (originTime) {
          departureDate = new Date(`${tripDate}T${originTime}:00`);
        } else {
          departureDate = new Date();
        }
        console.log("[TRANSIT] Starting route search, departure:", departureDate.toISOString());
        
        const transitPreference =
          filterOption === "FEWER_TRANSFERS"
            ? google.maps.TransitRoutePreference.FEWER_TRANSFERS
            : google.maps.TransitRoutePreference.LESS_WALKING;

        // Goa transit hubs for fallback routing - includes North, Central, and South Goa
        const HUBS = [
          // North/Central Goa hubs
          "Panaji Kadamba Bus Stand, Goa",    // Main hub in Panaji
          "Vasco da Gama Bus Stand, Goa",     // Near KK Birla campus
          "Ponda Bus Stand, Goa",             // Central Goa hub
          "Mapusa Bus Stand, Goa",            // North Goa hub
          "Old Goa Bus Stop, Goa",            // Between Panaji and Ponda
          // South Goa hubs
          "Margao Kadamba Bus Stand, Goa",    // Major South Goa hub
          "Colva Circle, Goa",
          "Majorda Bus Stand, Goa",
          "Verna Industrial Estate Bus Stop, Goa",
          "Cortalim Bus Stand, Goa",
        ];
        
        const MAX_WALK_DISTANCE_M = 6500; // 6.5km max walking - allows Majorda (5119m) and Colva Circle (6420m) to Colva Beach
        
        // Helper: make a directions request with timeout
        const routeRequest = (req: google.maps.DirectionsRequest): Promise<google.maps.DirectionsResult | null> =>
          new Promise((resolve) => {
            const timer = setTimeout(() => resolve(null), 10000);
            svc.route(req, (res, status) => {
              clearTimeout(timer);
              if (status === google.maps.DirectionsStatus.OK && res) {
                resolve(res);
              } else {
                console.log(`[routeRequest] status: ${status}`);
                resolve(null);
              }
            });
          });
        
        // Helper: check if a result has transit legs
        const hasTransitLeg = (r: google.maps.DirectionsResult | null): boolean => {
          if (!r) return false;
          const steps = r.routes?.[0]?.legs?.[0]?.steps || [];
          return steps.some((st: any) => 
            st.travel_mode === google.maps.TravelMode.TRANSIT || 
            st.travel_mode === "TRANSIT"
          );
        };
        
        // Helper: get walking distance from a DirectionsResult
        const getWalkDistance = (r: google.maps.DirectionsResult | null): number => {
          if (!r) return Infinity;
          return r.routes?.[0]?.legs?.[0]?.distance?.value || Infinity;
        };
        
        // Helper: get duration from a DirectionsResult
        const getDuration = (r: google.maps.DirectionsResult | null): number => {
          if (!r) return 0;
          return r.routes?.[0]?.legs?.[0]?.duration?.value || 0;
        };

        // Helper function to find route for a single segment (with fallback via hubs)
        const findSegmentRoute = async (
          segOrigin: string, 
          segDest: string, 
          segDeparture: Date
        ): Promise<{ segments: google.maps.DirectionsResult[], itineraryItems: { title: string; description: string }[], totalDuration: number }> => {
          // Try direct transit first
          const directTransit = await routeRequest({
            origin: segOrigin,
            destination: segDest,
            travelMode: google.maps.TravelMode.TRANSIT,
            transitOptions: {
              routingPreference: transitPreference,
              departureTime: segDeparture,
            },
          });
          
          if (directTransit && hasTransitLeg(directTransit)) {
            return {
              segments: [directTransit],
              itineraryItems: [],
              totalDuration: getDuration(directTransit),
            };
          }

          // Try walking if distance is short (<=3km)
          const walkRoute = await routeRequest({
            origin: segOrigin,
            destination: segDest,
            travelMode: google.maps.TravelMode.WALKING,
          });
          
          if (walkRoute) {
            const walkDist = getWalkDistance(walkRoute);
            if (walkDist <= 3000) {
              return {
                segments: [walkRoute],
                itineraryItems: [{ title: "", description: `Walk ${Math.round(walkDist)}m` }],
                totalDuration: getDuration(walkRoute),
              };
            }
          }

          // Try via hubs
          for (const hub of HUBS) {
            // Try transit from origin to hub, then walk to destination
            const originToHub = await routeRequest({
              origin: segOrigin,
              destination: hub,
              travelMode: google.maps.TravelMode.TRANSIT,
              transitOptions: {
                routingPreference: transitPreference,
                departureTime: segDeparture,
              },
            });
            
            if (originToHub && hasTransitLeg(originToHub)) {
              const hubToDest = await routeRequest({
                origin: hub,
                destination: segDest,
                travelMode: google.maps.TravelMode.WALKING,
              });
              
              if (hubToDest && getWalkDistance(hubToDest) <= MAX_WALK_DISTANCE_M) {
                return {
                  segments: [originToHub, hubToDest],
                  itineraryItems: [{ title: hub, description: `Walk ${Math.round(getWalkDistance(hubToDest))}m` }],
                  totalDuration: getDuration(originToHub) + getDuration(hubToDest),
                };
              }
            }

            // Try walk from origin to hub, then transit to destination
            const walkToHub = await routeRequest({
              origin: segOrigin,
              destination: hub,
              travelMode: google.maps.TravelMode.WALKING,
            });
            
            if (walkToHub && getWalkDistance(walkToHub) <= MAX_WALK_DISTANCE_M) {
              const walkDuration = getDuration(walkToHub);
              const transitTime = new Date(segDeparture.getTime() + walkDuration * 1000);
              
              const hubToDest = await routeRequest({
                origin: hub,
                destination: segDest,
                travelMode: google.maps.TravelMode.TRANSIT,
                transitOptions: {
                  routingPreference: transitPreference,
                  departureTime: transitTime,
                },
              });
              
              if (hubToDest && hasTransitLeg(hubToDest)) {
                return {
                  segments: [walkToHub, hubToDest],
                  itineraryItems: [{ title: hub, description: `Walk ${Math.round(getWalkDistance(walkToHub))}m to hub` }],
                  totalDuration: walkDuration + getDuration(hubToDest),
                };
              }
            }
          }

          // Fallback to walking
          if (walkRoute) {
            return {
              segments: [walkRoute],
              itineraryItems: [{ title: "", description: `Walk ${Math.round(getWalkDistance(walkRoute))}m (no transit available)` }],
              totalDuration: getDuration(walkRoute),
            };
          }

          return { segments: [], itineraryItems: [], totalDuration: 0 };
        };

        // Build list of all route points: origin, waypoints, destination
        const allPoints = [origin, ...stops, destination];
        const allSegments: google.maps.DirectionsResult[] = [];
        const allItineraryItems: { title: string; description: string }[] = [{ title: origin, description: "" }];
        let currentDeparture = departureDate;

        console.log(`[TRANSIT] Routing through ${allPoints.length} points: ${allPoints.join(" → ")}`);

        // Route each segment
        for (let i = 0; i < allPoints.length - 1; i++) {
          const segOrigin = allPoints[i];
          const segDest = allPoints[i + 1];
          console.log(`[TRANSIT] Routing segment ${i + 1}: ${segOrigin} → ${segDest}`);
          
          const result = await findSegmentRoute(segOrigin, segDest, currentDeparture);
          
          if (result.segments.length > 0) {
            allSegments.push(...result.segments);
            // Add intermediate itinerary items (like hub stops)
            result.itineraryItems.forEach(item => {
              if (item.title) {
                allItineraryItems.push(item);
              }
            });
            // Update departure time for next segment
            currentDeparture = new Date(currentDeparture.getTime() + result.totalDuration * 1000);
          }
          
          // Add the destination of this segment to itinerary
          if (i < allPoints.length - 2) {
            // This is a waypoint
            const wpIdx = i;
            const arrive = stopTimes?.[wpIdx]?.arriveBy || "";
            const leave = stopTimes?.[wpIdx]?.leaveBy || "";
            const parts: string[] = [];
            if (arrive) parts.push(`Arrive by ${arrive}`);
            if (leave) parts.push(`Leave by ${leave}`);
            allItineraryItems.push({ title: segDest, description: parts.join(" • ") });
          } else {
            // This is the final destination
            allItineraryItems.push({ title: destination, description: "" });
          }
        }

        // Set results
        if (allSegments.length > 0) {
          if (setDirectionsSegmentsOverride) setDirectionsSegmentsOverride(allSegments);
          else setDirectionsSegments(allSegments);
        } else {
          if (setDirectionsSegmentsOverride) setDirectionsSegmentsOverride([]);
          else setDirectionsSegments([]);
        }
        
        setItinerary(allItineraryItems);
        setSegmentInfos([]);
        setShowItinerary(true);
        setTimeout(() => setShowModal(false), 0);
        
      } catch (err) {
        console.error("[TRANSIT] Error:", err);
        // Render minimal itinerary on error
        if (setDirectionsSegmentsOverride) setDirectionsSegmentsOverride([]);
        else setDirectionsSegments([]);
        setItinerary([
          { title: origin, description: "" },
          { title: destination, description: "" },
        ]);
        setSegmentInfos([]);
        setShowItinerary(true);
        setTimeout(() => setShowModal(false), 0);
      }
    } else {
      svc.route(
        {
          origin,
          destination,
          travelMode,
          waypoints: stops.map((loc) => ({ location: loc })),
          ...(travelMode === "DRIVING" && {
            avoidTolls: filterOption === "NO_TOLL",
          }),
        },
        (res: any, stat: any) => {
          if (stat !== "OK" || !res) {
            console.error("Drive error:", stat);
            return alert("Drive error: " + stat);
          }
          if (setDirectionsOverride) {
            setDirectionsOverride(res);
          } else {
            setDirections(res);
          }
          if (setDirectionsSegmentsOverride) {
            setDirectionsSegmentsOverride([]);
          } else {
            setDirectionsSegments([]);
          }
          if (setExtraMarkersOverride) {
            setExtraMarkersOverride([]);
          } else {
            setExtraMarkers([]);
          }
          const leg = res.routes[0].legs[0];
          const items = [
            {
              title: origin,
              description: `Leave by ${originTime || "N/A"}. Depart at ${
                leg.departure_time?.text || "N/A"
              }.`,
            },
            ...waypoints.map((wp, i) => ({
              title: wp,
              description: `Arrive by ${
                stopTimes[i].arriveBy || "N/A"
              }, leave by ${stopTimes[i].leaveBy || "N/A"}.`,
            })),
            {
              title: destination,
              description: `Arrive by ${destinationTime || "N/A"}. Arrives at ${
                leg.arrival_time?.text || "N/A"
              }.`,
            },
          ];
          setItinerary(items);
          setShowItinerary(true);
          // Close the modal after showing itinerary
          setTimeout(() => setShowModal(false), 0);
        }
      );
    }
  }

  return (
    <TripContext.Provider
      value={{
        editingJourneyId,
        setEditingJourneyId,
        showRefreshmentModal,
        setShowRefreshmentModal,
        refreshmentItems,
        setRefreshmentItems,
        refreshmentNote,
        setRefreshmentNote,
        refreshmentInsertIndex,
        setRefreshmentInsertIndex,
        pendingShowAmenities,
        setPendingShowAmenities,
        suggestRefreshments: suggestRefreshments,
        forceShowAmenities,
        postSaveRedirectToTrips,
        setPostSaveRedirectToTrips,
  pendingPlace,
  setPendingPlace,
  pendingRecalc,
  setPendingRecalc,
        tripDate,
        setTripDate,
        origin,
        setOrigin,
        destination,
        setDestination,
        waypoints,
        setWaypoints,
        originTime,
        setOriginTime,
        destinationTime,
        setDestinationTime,
        stopTimes,
        setStopTimes,
        filterOption,
        setFilterOption,
        travelMode,
        setTravelMode,
        showModal,
        setShowModal,
        showItinerary,
        setShowItinerary,
        itinerary,
        setItinerary,
        segmentInfos,
        setSegmentInfos,
        savedJourneys,
        setSavedJourneys,
        showTrips,
        setShowTrips,
        directions,
        setDirections,
        directionsSegments,
        setDirectionsSegments,
        extraMarkers,
        setExtraMarkers,
        addStop,
        removeStop,
        updateStop,
        updateStopTime,
        viewSavedTripHandler,
        editSavedTripHandler,
        deleteTripHandler,
        saveTripHandler,
        updateTripHandler,
        getDirectionsHandler,
      }}
    >
      {children}
    </TripContext.Provider>
  );
}
