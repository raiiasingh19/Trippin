"use client";

import React, { useState } from "react";
import { signIn, signOut, useSession } from "next-auth/react";
import { UserCircle } from "lucide-react"; // 👈 icon for user profile

interface NavbarProps {
  savedJourneys: any[];
  onViewSavedTrip: () => void;
  onEditSavedTrip: () => void;
  onOpenModal: () => void;
  onShowTrips: () => void; // ✅ added prop to show My Trips
}

export default function Navbar({
  savedJourneys,
  onViewSavedTrip,
  onEditSavedTrip,
  onOpenModal,
  onShowTrips,
}: NavbarProps) {
  const { data: session, status } = useSession();
  const [dropdownOpen, setDropdownOpen] = useState(false); // ✅ toggle profile dropdown

  return (
    <nav className="bg-black text-white flex items-center justify-between px-4 py-2">
      <div className="flex-shrink-0">
        <h1 className="text-2xl font-bold">TRIPPIN&apos;</h1>
      </div>

      <div className="flex space-x-4 items-center relative">
        {/* ✅ NEW: Explore Button */}
        <button className="bg-purple-500 hover:bg-purple-600 px-3 py-1 rounded">
          Explore
        </button>

        {/* ✅ Unchanged: Plan Trip button */}
        <button
          onClick={onOpenModal}
          className="bg-turquoise-500 hover:bg-turquoise-600 px-3 py-1 rounded"
        >
          Plan Trip
        </button>

        {/* ✅ Signed-out: Show Sign In */}
        {status !== "authenticated" ? (
          <button
            onClick={() => signIn("google")}
            className="bg-yellow-500 hover:bg-yellow-600 text-black px-3 py-1 rounded"
          >
            Sign In with Google
          </button>
        ) : (
          // ✅ Signed-in: Show User Icon + Dropdown
          <div className="relative">
            <button onClick={() => setDropdownOpen((p) => !p)}>
              <UserCircle className="h-8 w-8 text-white" />
            </button>

            {dropdownOpen && (
              <div className="absolute right-0 mt-2 w-40 bg-white text-black rounded shadow z-50">
                <ul className="py-1">
                  {/* ✅ My Trips visible only if trips exist */}
                  {savedJourneys.length > 0 && (
                    <li>
                      <button
                        onClick={() => {
                          onShowTrips();
                          setDropdownOpen(false);
                        }}
                        className="w-full text-left px-4 py-2 hover:bg-gray-100"
                      >
                        My Trips
                      </button>
                    </li>
                  )}
                  <li>
                    <button
                      onClick={() => {
                        signOut();
                        setDropdownOpen(false);
                      }}
                      className="w-full text-left px-4 py-2 hover:bg-gray-100"
                    >
                      Sign Out
                    </button>
                  </li>
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </nav>
  );
}
