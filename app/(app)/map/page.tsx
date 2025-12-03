"use client";
import React from "react";
import { useLoadScript } from "@react-google-maps/api";
import MapView from "../../components/MapView";

const LIBRARIES: ("places")[] = ["places"];

const containerStyle = {
  width: "100vw",
  height: "calc(100vh - 56px)",
};
const defaultCenter = { lat: 15.3913, lng: 73.8782 };

export default function FullMapPage() {
  const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!;
  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries: LIBRARIES,
  });

  // Directions are already calculated in TripContext - MapView reads them directly
  // No need to recalculate here, just display

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

