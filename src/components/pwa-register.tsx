"use client";

import { useEffect } from "react";

export function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    void navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => {
        void reg.update();
      })
      .catch(() => {
        // ignore SW registration failures in local/dev
      });
  }, []);

  return null;
}
