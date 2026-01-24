"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export function useShowItineraryRedirect(showItinerary: boolean) {
  const router = useRouter();
  useEffect(() => {
    if (showItinerary) {
      router.push("/"); // Always redirect to home where itinerary is shown
    }
  }, [showItinerary, router]);
}
