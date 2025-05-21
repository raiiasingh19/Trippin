"use client";

import React from "react";
import { signIn, signOut, useSession } from "next-auth/react";

interface NavbarProps {
  savedJourneys: any[];
  onViewSavedTrip: () => void;
  onEditSavedTrip: () => void;
  onOpenModal: () => void;
}

export default function Navbar({
  savedJourneys,
  onViewSavedTrip,
  onEditSavedTrip,
  onOpenModal,
}: NavbarProps) {
  const { data: session, status } = useSession();

  return (
    <nav className="bg-black text-white flex items-center justify-between px-4 py-2">
      <div className="flex-shrink-0">
        <h1 className="text-2xl font-bold">TRIPPIN&apos;</h1>
      </div>
      <div className="flex space-x-4">
        {savedJourneys.length > 0 ? (
          <>
            <button
              onClick={onViewSavedTrip}
              className="bg-green-500 hover:bg-green-600 px-3 py-1 rounded"
            >
              View Saved Trip
            </button>
            <button
              onClick={onEditSavedTrip}
              className="bg-blue-500 hover:bg-blue-600 px-3 py-1 rounded"
            >
              Edit Saved Trip
            </button>
          </>
        ) : (
          <button
            onClick={onOpenModal}
            className="bg-turquoise-500 hover:bg-turquoise-600 px-3 py-1 rounded"
          >
            Plan Trip
          </button>
        )}

        {status === "authenticated" ? (
          <button
            onClick={() => signOut()}
            className="bg-red-500 hover:bg-red-600 px-3 py-1 rounded"
          >
            Sign Out
          </button>
        ) : (
          <button
            onClick={() => signIn("google")}
            className="bg-yellow-500 hover:bg-yellow-600 text-black px-3 py-1 rounded"
          >
            Sign In with Google
          </button>
        )}
      </div>
    </nav>
  );
}
