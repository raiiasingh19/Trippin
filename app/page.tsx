"use client";

import React, { useState, useRef, useEffect, FormEvent } from "react";
import { useLoadScript } from "@react-google-maps/api";
import Navbar from "./components/Navbar";
import TripPlannerModal from "./components/TripPlannerModal";
import ItineraryView from "./components/ItineraryView";
import MapView from "./components/MapView";
import { getTransitItinerary } from "./utils/transitUtils";
import { Trash, Pencil, MapPinned } from "lucide-react";

// Map container style and default center
const containerStyle = {
  width: "100vw",
  height: "calc(100vh - 56px)",
};
const defaultCenter = { lat: 15.3913, lng: 73.8782 };

// Helper: Combine date + time into a JS Date
function makeDate(dateStr: string, timeStr: string): Date {
  return new Date(`${dateStr}T${timeStr}:00`);
}

export default function HomePage() {
  // --- 1) ALL hooks up front ---
  const [tripDate, setTripDate] = useState(
    () => new Date().toISOString().split("T")[0]
  );
  const [origin, setOrigin] = useState("kk birla goa campus");
  const [destination, setDestination] = useState("");
  const [waypoints, setWaypoints] = useState<string[]>([]);
  const [originTime, setOriginTime] = useState("");
  const [destinationTime, setDestinationTime] = useState("");
  const [stopTimes, setStopTimes] = useState<
    { arriveBy: string; leaveBy: string }[]
  >([]);
  const [directions, setDirections] = useState<
    google.maps.DirectionsResult | null
  >(null);
  const [directionsSegments, setDirectionsSegments] = useState<
    google.maps.DirectionsResult[]
  >([]);
  const [extraMarkers, setExtraMarkers] = useState<
    { position: google.maps.LatLngLiteral }[]
  >([]);
  const [filterOption, setFilterOption] = useState("BEST_ROUTE");
  const [travelMode, setTravelMode] = useState<google.maps.TravelMode>(
    "DRIVING" as google.maps.TravelMode
  );
  const [showModal, setShowModal] = useState(false);
  const [showItinerary, setShowItinerary] = useState(false);
  const [itinerary, setItinerary] = useState<
    { title: string; description: string }[]
  >([]);
  const [segmentInfos, setSegmentInfos] = useState<any[]>([]);
  const [savedJourneys, setSavedJourneys] = useState<any[]>([]);

  const originRef = useRef<google.maps.places.Autocomplete | null>(null);
  const destinationRef = useRef<google.maps.places.Autocomplete | null>(null);
  const waypointRefs = useRef<(google.maps.places.Autocomplete | null)[]>(
    []
  );

  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "",
    libraries: ["places"],
  });

  const [showTrips, setShowTrips] = useState(false); // ✅ new state

  // Load saved trips once
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

  // Bail out if Maps not ready
  if (!isLoaded || loadError || typeof window === "undefined") {
    return <p>{loadError ? "Error loading maps" : "Loading maps…"}</p>;
  }

  const maps = window.google.maps;

  const userStopIcon: google.maps.Symbol = {
    path: maps.SymbolPath.CIRCLE,
    scale: 6,
    fillColor: "#FF0000",
    fillOpacity: 1,
    strokeWeight: 1,
    strokeColor: "#FFFFFF",
  };

  // Handlers
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
  const updateStopTime = (
    i: number,
    f: "arriveBy" | "leaveBy",
    val: string
  ) => {
    setStopTimes((t) => {
      const c = [...t];
      c[i] = { ...c[i], [f]: val };
      return c;
    });
  };

  function updateUserStopMarkers() {
    const geocoder = new maps.Geocoder();
    setExtraMarkers([]);
    waypoints
      .filter((w) => w.trim())
      .forEach((addr) =>
        geocoder.geocode({ address: addr }, (results, status) => {
          if (status === maps.GeocoderStatus.OK && results?.[0]) {
            setExtraMarkers((m) => [
              ...m,
              {
                position: {
                  lat: results[0].geometry.location.lat(),
                  lng: results[0].geometry.location.lng(),
                },
              },
            ]);
          }
        })
      );
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
      startTime: makeDate(tripDate, originTime),
      endTime: makeDate(tripDate, destinationTime),
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
        alert("Trip saved.");
      } else {
        alert("Error saving trip.");
      }
    } catch {
      alert("Error saving trip.");
    }
  }

  function viewSavedTripHandler() {
    if (!savedJourneys.length) return alert("No saved trips.");
    const latest = savedJourneys[savedJourneys.length - 1];
    setItinerary([{ title: "Your Itinerary", description: latest.itinerary }]);
    setShowItinerary(true);
  }

  function editSavedTripHandler() {
    if (!savedJourneys.length) return alert("No saved trips.");
    const j = savedJourneys[savedJourneys.length - 1];
    setOrigin(j.start);
    setDestination(j.destination);
    setWaypoints(j.waypoints || []);
    setStopTimes(j.stopTimes || []);
    setTravelMode(j.travelMode);
    setFilterOption(j.filterOption);
    setTripDate(new Date(j.startTime).toISOString().split("T")[0]);
    setOriginTime(
      new Date(j.startTime).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      })
    );
    setDestinationTime(
      new Date(j.endTime).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      })
    );
    setItinerary([{ title: "Your Itinerary", description: j.itinerary }]);
    setShowModal(true);
  }

  function deleteTripHandler(id: string) {
    fetch(`/api/journeys/${id}`, {
      method: "DELETE",
    })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to delete trip");
        setSavedJourneys((prev) => prev.filter((j) => j._id !== id));
        alert("Trip deleted.");
      })
      .catch((err) => alert("Error deleting trip."));
  }

  async function getDirectionsHandler(e: FormEvent) {
    e.preventDefault();
    if (!origin || !destination) {
      return alert("Enter both origin and destination.");
    }

    const svc = new maps.DirectionsService();
    const stops = waypoints.filter((w) => w.trim());

    if (travelMode === "TRANSIT") {
      try {
        // ← NEW: combine date+time into actual Date objects
        const departureDate = makeDate(tripDate, originTime);
        const arrivalDate = makeDate(tripDate, destinationTime);

        const { itinerary: raw, segmentInfos, directionsSegments } =
          await getTransitItinerary(
            [origin, ...stops, destination],
            svc,
            origin,
            departureDate,       // ← Date instead of string
            destination,
            arrivalDate,         // ← Date instead of string
            waypoints,
            stopTimes
          );
        const normalized = raw.map((r) => ({
          title: r.title,
          description: r.description ?? "",
        }));
        setItinerary(normalized);
        setSegmentInfos(segmentInfos);
        setDirectionsSegments(directionsSegments);
        updateUserStopMarkers();
        setShowItinerary(true);
        setShowModal(false);
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
        (res, stat) => {
          if (stat !== "OK" || !res) {
            console.error("Drive error:", stat);
            return alert("Drive error: " + stat);
          }
          setDirections(res);
          setDirectionsSegments([]);
          setExtraMarkers([]);
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

  // --- 5) Render tree ---
  return (
    <div className="min-h-screen bg-gray-100">
      <Navbar
        savedJourneys={savedJourneys}
        onViewSavedTrip={viewSavedTripHandler}
        onEditSavedTrip={editSavedTripHandler}
        onOpenModal={() => setShowModal(true)}
        onShowTrips={() => setShowTrips(true)} // ✅ show My Trips
      />

      {/* ✅ My Trips View */}
      {showTrips && (
        <div className="p-6 bg-white">
          <h2 className="text-2xl font-bold mb-4 text-gray-900">My Trips</h2>
          {savedJourneys.map((trip, idx) => (
            <div
              key={trip._id}
              className="mb-4 border p-4 rounded shadow bg-gray-50 space-y-2"
            >
              <h3 className="text-xl font-bold text-gray-900">{trip.start} → {trip.destination}</h3>
              <p className="text-gray-800 whitespace-pre-line">{trip.itinerary}</p>
              <div className="flex space-x-4">
                <button
                  onClick={() => {
                    setShowTrips(false);
                    setOrigin(trip.start);
                    setDestination(trip.destination);
                    setWaypoints(trip.waypoints || []);
                    setStopTimes(trip.stopTimes || []);
                    setTravelMode(trip.travelMode);
                    setFilterOption(trip.filterOption);
                    setTripDate(new Date(trip.startTime).toISOString().split("T")[0]);
                    setOriginTime(new Date(trip.startTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false }));
                    setDestinationTime(new Date(trip.endTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false }));
                    setItinerary([{ title: "Your Itinerary", description: trip.itinerary }]);
                    setShowModal(true);
                  }}
                  className="flex items-center bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded"
                >
                  <Pencil className="h-4 w-4 mr-1" /> Edit
                </button>
                <button
                  onClick={() => deleteTripHandler(trip._id)}
                  className="flex items-center bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded"
                >
                  <Trash className="h-4 w-4 mr-1" /> Delete
                </button>
                <button
                  onClick={() => {
                    setShowTrips(false);
                    setShowItinerary(false);
                  }}
                  className="flex items-center bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded"
                >
                  <MapPinned className="h-4 w-4 mr-1" /> View Map
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <TripPlannerModal
          showModal={showModal}
          onClose={() => setShowModal(false)}
          tripDate={tripDate}
          setTripDate={setTripDate}
          origin={origin}
          setOrigin={setOrigin}
          originTime={originTime}
          setOriginTime={setOriginTime}
          destination={destination}
          setDestination={setDestination}
          destinationTime={destinationTime}
          setDestinationTime={setDestinationTime}
          waypoints={waypoints}
          stopTimes={stopTimes}
          onAddStop={addStop}
          onRemoveStop={removeStop}
          onUpdateStop={updateStop}
          onUpdateStopTime={updateStopTime}
          travelMode={travelMode}
          setTravelMode={setTravelMode}
          filterOption={filterOption}
          setFilterOption={setFilterOption}
          onGetDirections={getDirectionsHandler}
        />
      )}

      <ItineraryView
        showItinerary={showItinerary}
        itinerary={itinerary}
        onSaveTrip={saveTripHandler}
        onShowMap={() => setShowItinerary(false)}
      />

      {!showItinerary && (
        <MapView
          showItinerary={showItinerary}
          containerStyle={containerStyle}
          defaultCenter={defaultCenter}
          directionsSegments={directionsSegments}
          directions={directions}
          travelMode={travelMode}
          extraMarkers={extraMarkers}
          icon={userStopIcon}
        />
      )}
    </div>
  );
}
