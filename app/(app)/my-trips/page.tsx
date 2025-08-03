"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash, MapPinned } from "lucide-react";
import { useTripContext } from "../../context/TripContext";

export default function MyTripsPage() {
  const router = useRouter();
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
            <p className="text-gray-800 whitespace-pre-line">{trip.itinerary}</p>
            <div className="flex space-x-4">
              <button
                onClick={() => {
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
                  setShowItinerary(false);
                  router.push("/");
                }}
                className="flex items-center bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded"
              >
                <MapPinned className="h-4 w-4 mr-1" /> View Map
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
