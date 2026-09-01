import { StreamingProvider } from "./types";

export const PrimeProvider: StreamingProvider = {
  id: "prime",
  name: "Prime Video",
  color: "#00A8E1",

  supportedCapabilities() {
    return {
      sync: false,
      deepLink: true,
    };
  },

  deepLink(contentId: string) {
    // Prime Video URLs
    return `https://www.primevideo.com/detail/${contentId}`;
  },

  async connect() {},
  async disconnect() {},
};
