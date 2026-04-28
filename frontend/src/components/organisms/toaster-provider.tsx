"use client";

import { Toaster } from "sonner";

export function ToasterProvider() {
  return (
    <Toaster
      position="bottom-right"
      richColors
      duration={4000}
      swipeDirections={["top", "right", "bottom", "left"]}
    />
  );
}
