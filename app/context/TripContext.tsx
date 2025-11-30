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
            const [gData, oData] = await Promise.all([
              fetch(`/api/explore?q=${encodeURIComponent(q)}`).then(r => r.json()).catch(() => ({ results: [] })),
              fetch(`/api/amenities?lat=${encodeURIComponent(leg.end_location.lat())}&lng=${encodeURIComponent(leg.end_location.lng())}&radius=1200`).then(r => r.json()).catch(() => ({ results: [] })),
            ]);
            const merged = [...(gData.results || []), ...(oData.results || [])];
            setRefreshmentItems(merged.slice(0, 8));
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
            const [gData, oData] = await Promise.all([
              fetch(`/api/explore?q=${encodeURIComponent(q)}`).then(r => r.json()).catch(() => ({ results: [] })),
              fetch(`/api/amenities?lat=${encodeURIComponent(leg.end_location.lat())}&lng=${encodeURIComponent(leg.end_location.lng())}&radius=1200`).then(r => r.json()).catch(() => ({ results: [] })),
            ]);
            const merged = [...(gData.results || []), ...(oData.results || [])];
            setRefreshmentItems(merged.slice(0, 8));
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
      let queryLabel = destination;
      let lat = 15.491997;
      let lng = 73.8278;
      if (travelMode === "TRANSIT" && directionsSegments.length > 0) {
        const seg = directionsSegments[0];
        const leg = seg.routes?.[0]?.legs?.[0];
        if (leg) {
          lat = leg.end_location.lat();
          lng = leg.end_location.lng();
          queryLabel = [origin, ...stops, destination][1] || destination;
        }
      } else if (directions) {
        const leg = directions.routes?.[0]?.legs?.[0];
        if (leg) {
          lat = leg.end_location.lat();
          lng = leg.end_location.lng();
          queryLabel = [origin, ...stops, destination][1] || destination;
        }
      }
      setRefreshmentInsertIndex(insertIdx);
      const q = `restaurants near ${queryLabel}`;
      const [gData, oData] = await Promise.all([
        fetch(`/api/explore?q=${encodeURIComponent(q)}`).then(r => r.json()).catch(() => ({ results: [] })),
        fetch(`/api/amenities?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}&radius=1200`).then(r => r.json()).catch(() => ({ results: [] })),
      ]);
      const merged = [...(gData.results || []), ...(oData.results || [])];
      setRefreshmentItems(merged.slice(0, 8));
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
        const departureDate = new Date(`${tripDate}T${originTime}:00`);
        const arrivalDate = new Date(`${tripDate}T${destinationTime}:00`);
        // Prefer WHOLE-TRIP transit first to avoid fragmented walking
        const tryWholeTripVariants = async (): Promise<google.maps.DirectionsResult | null> => {
          const variants: Array<google.maps.DirectionsRequest> = [];
          variants.push({
            origin,
            destination,
            travelMode: google.maps.TravelMode.TRANSIT,
            transitOptions: {
              modes: [google.maps.TransitMode.BUS],
              routingPreference: google.maps.TransitRoutePreference.LESS_WALKING,
              departureTime: departureDate,
            },
          });
          variants.push({
            origin,
            destination,
            travelMode: google.maps.TravelMode.TRANSIT,
            transitOptions: {
              routingPreference: google.maps.TransitRoutePreference.LESS_WALKING,
              departureTime: departureDate,
            },
          });
          variants.push({
            origin,
            destination,
            travelMode: google.maps.TravelMode.TRANSIT,
            transitOptions: {
              routingPreference: google.maps.TransitRoutePreference.LESS_WALKING,
            },
          });
          if (!Number.isNaN(arrivalDate.getTime())) {
            variants.push({
              origin,
              destination,
              travelMode: google.maps.TravelMode.TRANSIT,
              transitOptions: {
                routingPreference: google.maps.TransitRoutePreference.LESS_WALKING,
                arrivalTime: arrivalDate,
              },
            });
          }
          const plus30 = new Date(departureDate.getTime() + 30 * 60 * 1000);
          const plus60 = new Date(departureDate.getTime() + 60 * 60 * 1000);
          variants.push({
            origin,
            destination,
            travelMode: google.maps.TravelMode.TRANSIT,
            transitOptions: {
              routingPreference: google.maps.TransitRoutePreference.LESS_WALKING,
              departureTime: plus30,
            },
          });
          variants.push({
            origin,
            destination,
            travelMode: google.maps.TravelMode.TRANSIT,
            transitOptions: {
              routingPreference: google.maps.TransitRoutePreference.LESS_WALKING,
              departureTime: plus60,
            },
          });
          for (const req of variants) {
            // eslint-disable-next-line no-await-in-loop
            const result = await new Promise<google.maps.DirectionsResult | null>((resolve) => {
              svc.route(req, (whole, status) => {
                if (status === google.maps.DirectionsStatus.OK && whole) resolve(whole);
                else resolve(null);
              });
            });
            if (result) return result;
          }
          return null;
        };
        const whole = await tryWholeTripVariants();
        const wholeHasTransit =
          !!whole &&
          (whole.routes?.[0]?.legs?.[0]?.steps || []).some(
            (st: any) => st.travel_mode === google.maps.TravelMode.TRANSIT
          );
        if (whole && wholeHasTransit) {
          if (setDirectionsSegmentsOverride) {
            setDirectionsSegmentsOverride([whole]);
          } else {
            setDirectionsSegments([whole]);
          }
          // Minimal text; UI renders details from directionsSegments
          setItinerary([{ title: origin, description: "" }, { title: destination, description: "" }]);
          setSegmentInfos([]);
          setShowItinerary(true);
          setTimeout(() => setShowModal(false), 0);
          return;
        }
        // Fallback 2: Try via known South Goa hubs (helps Colva/Majorda/Margao routes)
        const tryHubChain = async (hub: string): Promise<google.maps.DirectionsResult[] | null> => {
          const legReq = (a: string, b: string, dep: Date) =>
            new Promise<google.maps.DirectionsResult | null>((resolve) => {
              svc.route(
                {
                  origin: a,
                  destination: b,
                  travelMode: google.maps.TravelMode.TRANSIT,
                  transitOptions: {
                    routingPreference: google.maps.TransitRoutePreference.LESS_WALKING,
                    departureTime: dep,
                  },
                },
                (res, status) => {
                  if (status === google.maps.DirectionsStatus.OK && res) resolve(res);
                  else resolve(null);
                }
              );
            });
          const first = await legReq(origin, hub, departureDate);
          if (!first) return null;
          // chain second with last arrival time as departure if present
          let nextDep = departureDate;
          try {
            const leg = (first.routes?.[0]?.legs?.[0] as any) || null;
            const arrVal = leg?.arrival_time?.value;
            if (arrVal) nextDep = arrVal instanceof Date ? arrVal : new Date(arrVal);
          } catch {}
          const second = await legReq(hub, destination, nextDep);
          if (!second) return null;
          const hasTransit =
            (first.routes?.[0]?.legs?.[0]?.steps || []).some((st: any) => st.travel_mode === google.maps.TravelMode.TRANSIT) ||
            (second.routes?.[0]?.legs?.[0]?.steps || []).some((st: any) => st.travel_mode === google.maps.TravelMode.TRANSIT);
          return hasTransit ? [first, second] : null;
        };
        const southGoaHubs = ["Margao Kadamba Bus Stand, Goa", "Majorda Bus Stand, Goa"];
        for (const hub of southGoaHubs) {
          // eslint-disable-next-line no-await-in-loop
          const chain = await tryHubChain(hub);
          if (chain) {
            if (setDirectionsSegmentsOverride) setDirectionsSegmentsOverride(chain);
            else setDirectionsSegments(chain);
            setItinerary([{ title: origin, description: "" }, { title: hub, description: "" }, { title: destination, description: "" }]);
            setSegmentInfos([]);
            setShowItinerary(true);
            setTimeout(() => setShowModal(false), 0);
            return;
          }
        }
        // Fallback 3: Find nearest bus stop to destination and chain via that stop
        const geocoder = new maps.Geocoder();
        const geocodeDest = await new Promise<google.maps.GeocoderResult | null>((resolve) => {
          geocoder.geocode({ address: destination }, (results, status) => {
            if (status === "OK" && results && results[0]) resolve(results[0]);
            else resolve(null);
          });
        });
        if (geocodeDest) {
          const dloc = geocodeDest.geometry?.location;
          const dlat = dloc?.lat();
          const dlng = dloc?.lng();
          if (typeof dlat === "number" && typeof dlng === "number") {
            try {
              const resp = await fetch(`/api/amenities?lat=${encodeURIComponent(dlat)}&lng=${encodeURIComponent(dlng)}&radius=2000&types=bus`);
              if (resp.ok) {
                const data = await resp.json();
                const stops = (data.results || []) as Array<{ name: string; location: { lat: number; lng: number } }>;
                // choose nearest by distance
                let best: any = null;
                let bestd = Number.POSITIVE_INFINITY;
                for (const s of stops) {
                  const dy = (s.location.lat - dlat) * 111_000;
                  const dx = (s.location.lng - dlng) * 111_000 * Math.cos((dlat * Math.PI) / 180);
                  const dist = Math.sqrt(dx * dx + dy * dy);
                  if (dist < bestd) {
                    bestd = dist;
                    best = s;
                  }
                }
                if (best) {
                  const stopLatLng = new maps.LatLng(best.location.lat, best.location.lng);
                  // chain origin -> stop (TRANSIT) -> destination (WALK)
                  const legTransit = (a: string | google.maps.LatLng, b: string | google.maps.LatLng, dep: Date) =>
                    new Promise<google.maps.DirectionsResult | null>((resolve) => {
                      svc.route(
                        {
                          origin: a,
                          destination: b,
                          travelMode: google.maps.TravelMode.TRANSIT,
                          transitOptions: {
                            routingPreference: google.maps.TransitRoutePreference.LESS_WALKING,
                            departureTime: dep,
                          },
                        },
                        (res, status) => {
                          if (status === google.maps.DirectionsStatus.OK && res) resolve(res);
                          else resolve(null);
                        }
                      );
                    });
                  const legWalk = (a: string | google.maps.LatLng, b: string | google.maps.LatLng) =>
                    new Promise<google.maps.DirectionsResult | null>((resolve) => {
                      svc.route(
                        {
                          origin: a,
                          destination: b,
                          travelMode: google.maps.TravelMode.WALKING,
                        },
                        (res, status) => {
                          if (status === google.maps.DirectionsStatus.OK && res) resolve(res);
                          else resolve(null);
                        }
                      );
                    });
                  const first = await legTransit(origin, stopLatLng, departureDate);
                  if (first) {
                    let nextDep = departureDate;
                    try {
                      const leg = (first.routes?.[0]?.legs?.[0] as any) || null;
                      const arrVal = leg?.arrival_time?.value;
                      if (arrVal) nextDep = arrVal instanceof Date ? arrVal : new Date(arrVal);
                    } catch {}
                    const walk2 = await legWalk(stopLatLng, destination);
                    if (walk2) {
                      const chain = [first, walk2];
                      if (setDirectionsSegmentsOverride) setDirectionsSegmentsOverride(chain);
                      else setDirectionsSegments(chain);
                      setItinerary([{ title: origin, description: "" }, { title: best.name || "Bus Stop", description: "" }, { title: destination, description: "" }]);
                      setSegmentInfos([]);
                      setShowItinerary(true);
                      setTimeout(() => setShowModal(false), 0);
                      return;
                    }
                  }
                }
              }
            } catch {
              // ignore bus stop fallback errors
            }
          }
        }
        // Fallback to slice-by-slice transit if whole-trip failed
        const { itinerary: raw, segmentInfos, directionsSegments: transitSegs } =
          await getTransitItinerary(
            [origin, ...stops, destination],
            svc,
            origin,
            departureDate,
            destination,
            arrivalDate,
            waypoints,
            stopTimes
          );
        const normalized = raw.map((r: any) => ({
          title: r.title,
          description: r.description ?? "",
        }));
        // Detect if no transit was found across all segments; if so, try whole-trip transit once more (already tried above),
        // otherwise render the slice result.
        const noTransitAcross = transitSegs.length > 0
          ? !transitSegs.some((seg) =>
              (seg.routes?.[0]?.legs?.[0]?.steps || []).some(
                (st: any) => st.travel_mode === google.maps.TravelMode.TRANSIT
              )
            )
          : true;
        if (noTransitAcross) {
          const whole = await tryWholeTripVariants();
          if (whole) {
            if (setDirectionsSegmentsOverride) {
              setDirectionsSegmentsOverride([whole]);
            } else {
              setDirectionsSegments([whole]);
            }
            // keep itinerary text minimal; UI renders details from directionsSegments
            setItinerary(
              normalized.length
                ? normalized
                : [{ title: origin, description: "" }, { title: destination, description: "" }]
            );
            setSegmentInfos(segmentInfos);
          } else {
            if (setDirectionsSegmentsOverride) {
              setDirectionsSegmentsOverride(transitSegs);
            } else {
              setDirectionsSegments(transitSegs);
            }
            setItinerary(normalized);
            setSegmentInfos(segmentInfos);
          }
        } else {
        setItinerary(normalized);
        setSegmentInfos(segmentInfos);
        if (setDirectionsSegmentsOverride) {
            setDirectionsSegmentsOverride(transitSegs);
        } else {
            setDirectionsSegments(transitSegs);
          }
        }
        setShowItinerary(true);
        setTimeout(() => setShowModal(false), 0);
      } catch (err) {
        console.error(err);
        alert("Transit error: " + err);
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
