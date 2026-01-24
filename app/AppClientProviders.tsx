"use client";
import { Providers } from "./providers";
import { TripProvider } from "./context/TripContext";
import AppShell from "./components/AppShell";
import type { ReactNode } from "react";

export default function AppClientProviders({ children }: { children: ReactNode }) {
  return (
    <Providers>
      <TripProvider>
        <AppShell>{children}</AppShell>
      </TripProvider>
    </Providers>
  );
}
