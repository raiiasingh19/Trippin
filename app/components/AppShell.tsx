"use client";

import React from "react";
import Navbar from "./Navbar";
import TripPlannerModal from "./TripPlannerModal";
import { useTripContext } from "../context/TripContext";
import type { ReactNode } from "react";

export default function AppShell({ children }: { children: ReactNode }) {
  const {
    showModal,
    setShowModal,
    tripDate,
    setTripDate,
    origin,
    setOrigin,
    originTime,
    setOriginTime,
    destination,
    setDestination,
    destinationTime,
    setDestinationTime,
    waypoints,
    stopTimes,
    addStop,
    removeStop,
    updateStop,
    updateStopTime,
    travelMode,
    setTravelMode,
    filterOption,
    setFilterOption,
    getDirectionsHandler,
  } = useTripContext();

  // Provide a wrapper for getDirectionsHandler to match the expected signature
  const handleGetDirections = (e: React.FormEvent) => {
    if (typeof window !== "undefined" && window.google && window.google.maps) {
      getDirectionsHandler(
        e,
        window.google.maps,
        // These setters must be provided by the page using the modal, so here we use no-ops
        () => {},
        () => {},
        () => {}
      );
    }
  };
  return (
    <>
      <Navbar />
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
        onGetDirections={handleGetDirections}
      />
      {children}
    </>
  );
}
