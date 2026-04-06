"use client";

import { useContext } from "react";

import { AppContext } from "@/providers/app-provider";

export function useAppState() {
  const context = useContext(AppContext);

  if (!context) {
    throw new Error("useAppState must be used within AppProvider.");
  }

  return context;
}
