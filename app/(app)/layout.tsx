import type { ReactNode } from "react";
import AppClientProviders from "../AppClientProviders";

export default function AppLayout({ children }: { children: ReactNode }) {
  return <AppClientProviders>{children}</AppClientProviders>;
}
