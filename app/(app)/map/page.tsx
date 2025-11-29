"use client";
import React, { FormEvent, useEffect } from "react";
import { useLoadScript } from "@react-google-maps/api";
import MapView from "../../components/MapView";
import { useTripContext } from "../../context/TripContext";

const containerStyle = {
  width: "100vw",
  height: "calc(100vh - 56px)",
};
const defaultCenter = { lat: 15.3913, lng: 73.8782 };

export default function FullMapPage() {
  const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!;
  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries: ["places"],
  });
  const {
    origin,
    destination,
    getDirectionsHandler,
    setDirections,
    setDirectionsSegments,
    setExtraMarkers,
  } = useTripContext();

  useEffect(() => {
    if (!isLoaded) return;
    if (!origin || !destination) return;
    const dummy = { preventDefault: () => {} } as unknown as FormEvent;
    getDirectionsHandler(dummy, window.google.maps, setDirections, setDirectionsSegments, setExtraMarkers)
      .catch((e) => console.error("Full map route calc error:", e));
  }, [isLoaded, origin, destination, getDirectionsHandler, setDirections, setDirectionsSegments, setExtraMarkers]);

  const userStopIcon = "";

  return (
    <div className="min-h-screen bg-gray-100">
      {loadError ? (
        <div className="p-6">Error loading maps</div>
      ) : !isLoaded ? (
        <div className="p-6">Loading map...</div>
      ) : (
        <MapView
          showItinerary={false}
          containerStyle={containerStyle}
          defaultCenter={defaultCenter}
          icon={userStopIcon}
        />
      )}
    </div>
  );
}

