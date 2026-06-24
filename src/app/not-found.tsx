"use client";

import { useEffect } from "react";

export default function RootNotFound() {
  useEffect(() => {
    window.location.replace("/vi");
  }, []);

  return null;
}
