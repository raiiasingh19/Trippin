"use client";
import React from "react";
import { GoogleMap, DirectionsRenderer, Marker } from "@react-google-maps/api";


import { useTripContext } from "../context/TripContext";

interface MapViewProps {
  showItinerary: boolean;
  containerStyle: React.CSSProperties;
  defaultCenter: google.maps.LatLngLiteral;
  icon: google.maps.Symbol | google.maps.Icon | string;
}

export default function MapView({ showItinerary, containerStyle, defaultCenter, icon }: MapViewProps) {
  const { directions, directionsSegments, extraMarkers, travelMode } = useTripContext();
  if (showItinerary) return null;
  return (
    <div className="mt-4">
      <GoogleMap mapContainerStyle={containerStyle} center={defaultCenter} zoom={14}>
        {travelMode === "TRANSIT" && directionsSegments.length > 0
          ? directionsSegments.map((seg, idx) => (
              <DirectionsRenderer
                key={idx}
                directions={seg}
                options={{ suppressMarkers: false, preserveViewport: false }}
              />
            ))
          : directions && (
              <DirectionsRenderer
                directions={directions}
                options={{ suppressMarkers: false, preserveViewport: false }}
              />
            )}
        {travelMode !== "TRANSIT" &&
          extraMarkers.map((marker, idx) => (
            <Marker key={idx} position={marker.position} icon={icon} />
          ))}
      </GoogleMap>
    </div>
  );
}
