"use client";

import React from "react";
import { Linkedin } from "lucide-react";

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-[#F4E4C1] border-t-4 border-[#C8B896] px-6 py-6 shadow-lg relative z-40">
      <div className="flex items-center justify-center max-w-7xl mx-auto">
        <div className="flex items-center space-x-12 text-gray-700">
          <span className="text-sm font-medium">
            © {currentYear}{" "}
            <span className="font-semibold bg-gradient-to-r from-[#4A7C59] via-[#E07856] to-[#87CEEB] bg-clip-text text-transparent">
              Raiia
            </span>
          </span>

          <a
            href="https://linkedin.com/in/raiiasingh19"
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center space-x-1 text-gray-700 hover:text-[#4A90A4] transition-colors duration-300"
            aria-label="LinkedIn Profile"
          >
            <Linkedin size={18} />
            <span className="text-sm font-medium group-hover:underline">raiiasingh19</span>
          </a>
        </div>
      </div>
    </footer>
  );
}
