"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash, MapPinned } from "lucide-react";
import { useTripContext } from "../../context/TripContext";
import MiniRouteMap from "../../components/MiniRouteMap";
import { useLoadScript } from "@react-google-maps/api";

export default function MyTripsPage() {
  const router = useRouter();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY as string;
  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries: ["places"],
  });
  const {
    savedJourneys,
    setOrigin,
    setDestination,
    setWaypoints,
    setStopTimes,
    setTravelMode,
    setFilterOption,
    setTripDate,
    setOriginTime,
    setDestinationTime,
    setItinerary,
    setShowModal,
    setShowItinerary,
    deleteTripHandler,
    setEditingJourneyId,
  } = useTripContext();

  return (
    <div className="p-6 bg-white min-h-screen">
      <h2 className="text-2xl font-bold mb-4 text-gray-900">My Trips</h2>
      {savedJourneys.length === 0 ? (
        <p>No saved trips yet.</p>
      ) : (
        savedJourneys.map((trip, idx) => (
          <div
            key={trip._id}
            className="mb-4 border p-4 rounded shadow bg-gray-50 space-y-2"
          >
            <h3 className="text-xl font-bold text-gray-900">{trip.start} → {trip.destination}</h3>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => {
                  setEditingJourneyId(trip._id);
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
                  setExpandedId((prev) => (prev === trip._id ? null : trip._id));
                }}
                className="flex items-center border border-gray-300 hover:bg-gray-50 text-gray-800 px-3 py-1 rounded"
              >
                {expandedId === trip._id ? "Hide" : "View"}
              </button>
            </div>
            {expandedId === trip._id && (
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <MiniRouteMap
                  start={trip.start}
                  destination={trip.destination}
                  waypoints={trip.waypoints || []}
                  travelMode={trip.travelMode}
                  width="100%"
                  height={220}
                  isLoaded={isLoaded}
                  loadError={loadError}
                  beforeNavigate={() => {
                    setOrigin(trip.start);
                    setDestination(trip.destination);
                    setWaypoints(trip.waypoints || []);
                    setStopTimes(trip.stopTimes || []);
                    setTravelMode(trip.travelMode);
                    setFilterOption(trip.filterOption);
                    setTripDate(new Date(trip.startTime).toISOString().split("T")[0]);
                    setOriginTime(new Date(trip.startTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false }));
                    setDestinationTime(new Date(trip.endTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false }));
                    setShowItinerary(false);
                  }}
                />
                <div className="bg-white border rounded p-3">
                  <div className="text-sm text-gray-500 mb-1">Itinerary</div>
                  <pre className="text-sm text-gray-800 whitespace-pre-wrap">
                    {trip.itinerary}
                  </pre>
                </div>
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}
