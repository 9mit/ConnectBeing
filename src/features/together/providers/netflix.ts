import { StreamingProvider } from "./types";

export const NetflixProvider: StreamingProvider = {
  id: "netflix",
  name: "Netflix",
  color: "#E50914",

  supportedCapabilities() {
    return {
      sync: false, // Wait for companion extension to support true sync
      deepLink: true,
    };
  },

  deepLink(contentId: string) {
    // Netflix title URLs usually look like https://www.netflix.com/watch/81283609
    return `https://www.netflix.com/watch/${contentId}`;
  },

  async connect() {
    // For MVP, we rely on the internal simulated timer.
    // Future extension injection would happen here.
  },

  async disconnect() {
    // Cleanup
  },
};
