"use client";

import React, { useEffect, useState } from "react";
import { LogIn } from "lucide-react";
import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

interface SignInPromptModalProps {
  showPrompt: boolean;
  onClose: () => void;
}

export default function SignInPromptModal({ showPrompt, onClose }: SignInPromptModalProps) {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [isSigningIn, setIsSigningIn] = useState(false);

  // Redirect to home after successful sign-in
  useEffect(() => {
    if (status === "authenticated" && isSigningIn) {
      setIsSigningIn(false);
      onClose();
      router.push("/");
    }
  }, [status, isSigningIn, router, onClose]);

  if (!showPrompt) return null;

  const handleSignIn = () => {
    setIsSigningIn(true);
    signIn("google", { redirect: false });
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl p-6 md:p-8 w-full max-w-sm md:max-w-md mx-4 md:mx-0 border-4 border-[#4A7C59]">
        <div className="flex justify-center mb-4">
          <LogIn className="h-12 w-12 text-[#4A7C59]" />
        </div>
        
        <h2 className="text-2xl font-semibold text-center text-[#6B5539] mb-4">
          Sign In to Plan Your Trip
        </h2>
        
        <p className="text-center text-gray-700 mb-6">
          Sign in with your Google account to start planning amazing trips, save your itineraries, and explore Goa like never before.
        </p>
        
        <div className="space-y-3">
          <button
            onClick={handleSignIn}
            disabled={isSigningIn}
            className="w-full bg-gradient-to-r from-[#4A7C59] to-[#4A90A4] text-white px-6 py-3 rounded-xl font-medium transition-all hover:shadow-lg whitespace-nowrap disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isSigningIn ? "Signing in..." : "Sign In with Google"}
          </button>
          
          <button
            onClick={onClose}
            disabled={isSigningIn}
            className="w-full btn-glass text-gray-700 px-6 py-3 rounded-xl font-medium whitespace-nowrap disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
        
        <p className="text-xs text-gray-500 text-center mt-4">
          No account? Creating one is quick and easy with your Google credentials.
        </p>
      </div>
    </div>
  );
}
