"use client";

import React from "react";
import { useTripContext } from "../../context/TripContext";

export default function ExplorePage() {
  // If you want to use context here, you can uncomment:
  // const ctx = useTripContext();
  return (
    <div className="p-6 bg-white min-h-screen">
      <h2 className="text-2xl font-bold mb-4 text-gray-900">Explore</h2>
      <p>Coming soon: Explore destinations and experiences here.</p>
    </div>
  );
}
