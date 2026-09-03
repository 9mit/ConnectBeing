import {
  ContentDetails,
  ContentReference,
  ContentSearchResult,
  ProviderAvailability,
  ProviderCapabilities,
  StreamingProvider,
  WatchSessionInput,
  WatchSessionResult,
  CapabilityLevel,
} from "./types";

export abstract class BaseStreamingProvider implements StreamingProvider {
  abstract readonly id: string;
  abstract readonly name: string;
  abstract readonly brandColor: string;
  abstract readonly primaryRegions: string[];
  abstract readonly capabilityLevel: CapabilityLevel;

  abstract getCapabilities(): ProviderCapabilities;
  abstract generateLaunchUrl(content: ContentReference): Promise<string>;

  async detectAvailability(region?: string): Promise<ProviderAvailability> {
    if (!region) return "available";
    if (this.primaryRegions.includes("GLOBAL") || this.primaryRegions.includes(region.toUpperCase())) {
      return "available";
    }
    return "region-restricted";
  }

  async searchContent(query: string, region?: string): Promise<ContentSearchResult[]> {
    // Default legitimate search via provider deep link
    const launchUrl = await this.generateLaunchUrl({
      contentId: encodeURIComponent(query),
      providerId: this.id,
      title: query,
    });

    const isAvailable = await this.detectAvailability(region);

    return [
      {
        id: `${this.id}-${encodeURIComponent(query)}`,
        contentId: encodeURIComponent(query),
        providerId: this.id,
        providerName: this.name,
        title: query,
        type: "movie",
        availability: isAvailable,
        availableRegions: this.primaryRegions,
        launchUrl,
      },
    ];
  }

  async getContentDetails(contentId: string): Promise<ContentDetails | null> {
    const launchUrl = await this.generateLaunchUrl({
      contentId,
      providerId: this.id,
      title: contentId,
    });

    return {
      id: `${this.id}-${contentId}`,
      contentId,
      providerId: this.id,
      providerName: this.name,
      title: decodeURIComponent(contentId),
      type: "movie",
      availability: "available",
      availableRegions: this.primaryRegions,
      launchUrl,
      directStreamable: this.capabilityLevel === 1,
      capabilityLevel: this.capabilityLevel,
    };
  }

  async createWatchSession(input: WatchSessionInput): Promise<WatchSessionResult> {
    const launchUrl = await this.generateLaunchUrl(input.content);
    return {
      sessionId: `ws-${this.id}-${Date.now()}`,
      launchUrl,
      capabilityLevel: this.capabilityLevel,
      capabilities: this.getCapabilities(),
    };
  }
}
