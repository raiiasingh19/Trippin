"use client";
import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { GoogleMap, DirectionsRenderer } from "@react-google-maps/api";

interface MiniRouteMapProps {
  start: string;
  destination: string;
  waypoints?: string[];
  travelMode: google.maps.TravelMode;
  width?: number | string;
  height?: number | string;
  beforeNavigate?: () => void;
  isLoaded: boolean;
  loadError?: unknown;
}

export default function MiniRouteMap({
  start,
  destination,
  waypoints = [],
  travelMode,
  width = 360,
  height = 220,
  beforeNavigate,
  isLoaded,
  loadError,
}: MiniRouteMapProps) {
  const router = useRouter();
  const [directions, setDirections] = useState<google.maps.DirectionsResult | null>(null);

  const containerStyle = useMemo(
    () => ({
      width: typeof width === "number" ? `${width}px` : width,
      height: typeof height === "number" ? `${height}px` : height,
    }),
    [width, height]
  );

  useEffect(() => {
    if (!isLoaded || !start || !destination) return;
    const svc = new google.maps.DirectionsService();
    svc.route(
      {
        origin: start,
        destination,
        travelMode,
        waypoints: (waypoints || []).filter(Boolean).map((w) => ({ location: w })),
        ...(travelMode === "TRANSIT"
          ? {
              transitOptions: {
                modes: [google.maps.TransitMode.BUS],
                routingPreference: google.maps.TransitRoutePreference.LESS_WALKING,
              },
            }
          : {}),
      },
      (res, status) => {
        if (status === "OK" && res) {
          setDirections(res);
        } else {
          setDirections(null);
        }
      }
    );
  }, [isLoaded, start, destination, waypoints, travelMode]);

  // Rough default center for Goa to avoid blank map before directions load
  const defaultCenter = { lat: 15.491997, lng: 73.8278 };

  if (loadError) return <div className="text-sm text-red-600">Map failed to load.</div>;
  if (!isLoaded) return <div className="text-sm text-gray-600">Loading map...</div>;

  return (
    <div className="rounded overflow-hidden border relative" style={containerStyle as React.CSSProperties}>
      {/* Click overlay to navigate to full map */}
      <div
        className="absolute inset-0 z-10 cursor-pointer"
        onClick={() => {
          try {
            beforeNavigate?.();
          } finally {
            router.push("/map");
          }
        }}
        aria-label="Open full map"
        role="button"
      />
      <GoogleMap mapContainerStyle={{ width: "100%", height: "100%" }} center={defaultCenter} zoom={11}>
        {directions && (
          <DirectionsRenderer
            directions={directions}
            options={{ suppressMarkers: false, preserveViewport: false }}
          />
        )}
      </GoogleMap>
    </div>
  );
}


