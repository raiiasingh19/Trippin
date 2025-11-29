"use client";
import React, { useMemo } from "react";
import { useRouter } from "next/navigation";
import { useTripContext } from "../context/TripContext";
import { Bus, Car, Footprints, Bike, MapPin } from "lucide-react";
import MiniRouteMap from "./MiniRouteMap";

interface ItineraryItem {
  title: string;
  description: string;
}

interface ItineraryViewProps {
  showItinerary: boolean;
  itinerary: ItineraryItem[];
  onSaveTrip: () => void;
  onShowMap: () => void;
  isLoaded?: boolean;
  loadError?: unknown;
}

export default function ItineraryView({
  showItinerary,
  itinerary,
  onSaveTrip,
  onShowMap,
  isLoaded,
  loadError,
}: ItineraryViewProps) {
  const router = useRouter();
  const {
    travelMode,
    directions,
    directionsSegments,
    origin,
    destination,
    waypoints,
    editingJourneyId,
    setEditingJourneyId,
    updateTripHandler,
    originTime,
    destinationTime,
    stopTimes,
  } = useTripContext();

  const nodes = useMemo(() => {
    const points = [origin, ...waypoints, destination].filter(Boolean);
    return points;
  }, [origin, waypoints, destination]);

  const legItems = useMemo(() => {
    if (travelMode === "TRANSIT") {
      // One summary per segment (between nodes)
      return directionsSegments.map((seg) => {
        const leg = seg.routes?.[0]?.legs?.[0];
        if (!leg) return { mode: "WALK" as const, label: "Walk", subtext: "" };
        const hasTransit = (leg.steps || []).some(
          (s) => s.travel_mode === google.maps.TravelMode.TRANSIT
        );
        const d = leg.distance?.text || "";
        const t = leg.duration?.text || "";
        let subtext = "";
        // Try to find a boarding time from the first transit step
        const firstTransit = (leg.steps || []).find(
          (s) => s.travel_mode === google.maps.TravelMode.TRANSIT
        ) as google.maps.DirectionsStep | undefined;
        // @ts-ignore
        const tr = firstTransit?.transit;
        const boardStop = tr?.departure_stop?.name;
        const boardTime = tr?.departure_time?.text;
        if (boardStop || boardTime) {
          const parts: string[] = [];
          if (boardStop) parts.push(`Board @ ${boardStop}`);
          if (boardTime) parts.push(boardTime);
          subtext = parts.join(" • ");
        }
        if (hasTransit) {
          // Choose a representative bus label if present
          let busLabel = "Bus";
          for (const step of leg.steps || []) {
            if (step.travel_mode === google.maps.TravelMode.TRANSIT) {
              // @ts-ignore
              const tr = step.transit;
              const bus = tr?.line?.short_name || tr?.line?.name || "Bus";
              busLabel = `Bus ${bus}`;
              break;
            }
          }
          return { mode: "BUS" as const, label: `${busLabel} • ${d} • ${t}`, subtext };
        }
        return { mode: "WALK" as const, label: `Walk • ${d} • ${t}`, subtext };
      });
    } else if (directions) {
      const legs = directions.routes?.[0]?.legs || [];
      const mode =
        travelMode === "DRIVING"
          ? "Car"
          : travelMode === "BICYCLING"
          ? "Bike"
          : "Walk";
      return legs.map((leg) => {
        const d = leg.distance?.text || "";
        const t = leg.duration?.text || "";
        // For non-transit, generally no boarding; keep subtext blank
        return { mode: mode as "Car" | "Bike" | "Walk", label: `${mode} • ${d} • ${t}`, subtext: "" };
      });
    }
    return [];
  }, [travelMode, directions, directionsSegments]);

  if (!showItinerary) return null;

  const ModeIcon = (mode: string, label: string) => {
    if (mode === "BUS") return <Bus className="h-4 w-4 text-blue-600" />;
    if (mode === "Car") return <Car className="h-4 w-4 text-gray-800" />;
    if (mode === "Bike") return <Bike className="h-4 w-4 text-emerald-600" />;
    if (mode === "Walk" || label.startsWith("Walk")) return <Footprints className="h-4 w-4 text-orange-600" />;
    return <Car className="h-4 w-4 text-gray-800" />;
  };

  const handlePrimarySave = async () => {
    await onSaveTrip();
    router.push("/my-trips");
  };

  const handleUpdateSave = async () => {
    await updateTripHandler();
    router.push("/my-trips");
  };

  return (
    <div className="p-6 bg-white">
      <h2 className="text-2xl font-bold mb-4 text-gray-900">
        Your Itinerary
      </h2>

      {/* Timeline */}
      <div className="relative">

        {/* Starting point */}
        <div className="relative mb-4">
          <div className="bg-gray-50 border p-3 rounded">
            <div className="text-sm text-gray-500">Starting point</div>
            <div className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
              <MapPin className="h-4 w-4 text-rose-600" />
              <span>{nodes[0] || "—"}</span>
            </div>
            {(originTime && originTime.trim()) ? (
              <div className="text-xs text-gray-500 mt-1">
                Leave by {originTime}
              </div>
            ) : null}
          </div>
        </div>
       
        {/* Segments between nodes */}
        {nodes.slice(1).map((node, idx) => (
          <div key={idx} className="mb-4">
            {/* Segment summary (transit/drive/walk) without its own border */}
            {legItems[idx] ? (
              <div className="mb-2">
                <div className="bg-white px-3 py-2 pl-4">
                  <div className="flex items-center space-x-2 text-sm text-gray-800 bg-red">
                    {ModeIcon(legItems[idx].mode as string, legItems[idx].label)}
                    <span>{legItems[idx].label}</span>
                  </div>
                  {legItems[idx].subtext ? (
                    <div className="text-xs text-gray-500 mt-1 ml-6">
                      {legItems[idx].subtext}
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}
            

            {/* Next stop/destination */}
            <div className="relative">
              <div className="bg-gray-50 border p-3 rounded">
                <div className="text-sm text-gray-500">
                  {idx === nodes.length - 2 ? "Destination" : "Next stop"}
                </div>
                <div className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
                  <MapPin className="h-4 w-4 text-rose-600" />
                  <span>{node}</span>
                </div>
                {/* Subtext for stop times */}
                {idx === nodes.length - 2 ? (
                  (destinationTime && destinationTime.trim()) ? (
                    <div className="text-xs text-gray-500 mt-1">
                      Arrive by {destinationTime}
                    </div>
                  ) : null
                ) : (
                  (() => {
                    const wpIndex = idx - 1; // waypoint index mapping
                    const arrive = stopTimes?.[wpIndex]?.arriveBy || "";
                    const leave = stopTimes?.[wpIndex]?.leaveBy || "";
                    const parts: string[] = [];
                    if (arrive) parts.push(`Arrive by ${arrive}`);
                    if (leave) parts.push(`Leave by ${leave}`);
                    return parts.length ? (
                      <div className="text-xs text-gray-500 mt-1">
                        {parts.join(" • ")}
                      </div>
                    ) : null;
                  })()
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      

      {/* Small clickable map linked to full map view */}
      <div className="mt-6">
        <MiniRouteMap
          start={origin}
          destination={destination}
          waypoints={waypoints}
          travelMode={travelMode}
          width="100%"
          height={220}
          isLoaded={!!isLoaded}
          loadError={loadError}
        />
        <div className="text-xs text-gray-500 mt-1">
          Click the map to open full map view.
        </div>
      </div>

      <div className="mt-6 flex justify-end space-x-3">
        {editingJourneyId ? (
          <>
            <button
              onClick={() => {
                setEditingJourneyId(null);
                router.push("/my-trips");
              }}
              className="px-4 py-2 rounded border border-gray-300 text-gray-800 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleUpdateSave}
              className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded text-white"
            >
              Save Changes
            </button>
          </>
        ) : (
          <button
            onClick={handlePrimarySave}
            className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded text-white"
          >
            Save Trip
          </button>
        )}
      </div>
    </div>
  );
}
