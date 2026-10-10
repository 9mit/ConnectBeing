import { BaseStreamingProvider } from "../base";
import { ContentReference, ProviderCapabilities, CapabilityLevel } from "../types";

export class NetflixProvider extends BaseStreamingProvider {
  readonly id = "netflix";
  readonly name = "Netflix";
  readonly brandColor = "#E50914";
  readonly primaryRegions = ["GLOBAL", "IN", "US", "UK", "CA"];
  readonly capabilityLevel: CapabilityLevel = 3;

  getCapabilities(): ProviderCapabilities {
    return {
      deepLink: true,
      browserPlayback: false,
      extensionControl: true,
      playbackSynchronization: false,
      currentTimeDetection: false,
      playPauseControl: false,
      seekControl: false,
      episodeDetection: true,
      metadataLookup: true,
    };
  }

  async generateLaunchUrl(content: ContentReference): Promise<string> {
    if (content.customUrl) return content.customUrl;
    if (content.contentId && /^\d+$/.test(content.contentId)) {
      return `https://www.netflix.com/watch/${content.contentId}`;
    }
    return `https://www.netflix.com/search?q=${encodeURIComponent(content.title || content.contentId)}`;
  }
}

export class PrimeVideoProvider extends BaseStreamingProvider {
  readonly id = "prime";
  readonly name = "Prime Video";
  readonly brandColor = "#00A8E1";
  readonly primaryRegions = ["GLOBAL", "IN", "US", "UK", "CA"];
  readonly capabilityLevel: CapabilityLevel = 3;

  getCapabilities(): ProviderCapabilities {
    return {
      deepLink: true,
      browserPlayback: false,
      extensionControl: true,
      playbackSynchronization: false,
      currentTimeDetection: false,
      playPauseControl: false,
      seekControl: false,
      episodeDetection: true,
      metadataLookup: true,
    };
  }

  async generateLaunchUrl(content: ContentReference): Promise<string> {
    if (content.customUrl) return content.customUrl;
    if (content.contentId && content.contentId.startsWith("amzn1.")) {
      return `https://www.primevideo.com/detail/${content.contentId}`;
    }
    return `https://www.primevideo.com/search/ref=atv_nb_sr?phrase=${encodeURIComponent(content.title || content.contentId)}`;
  }
}

export class JioHotstarProvider extends BaseStreamingProvider {
  readonly id = "jiohotstar";
  readonly name = "JioHotstar";
  readonly brandColor = "#1F80E0";
  readonly primaryRegions = ["IN", "CA", "GB", "SG"];
  readonly capabilityLevel: CapabilityLevel = 3;

  getCapabilities(): ProviderCapabilities {
    return {
      deepLink: true,
      browserPlayback: false,
      extensionControl: false,
      playbackSynchronization: false,
      currentTimeDetection: false,
      playPauseControl: false,
      seekControl: false,
      episodeDetection: true,
      metadataLookup: true,
    };
  }

  async generateLaunchUrl(content: ContentReference): Promise<string> {
    if (content.customUrl) return content.customUrl;
    if (content.contentId && /^\d+$/.test(content.contentId)) {
      return `https://www.hotstar.com/in/movies/${content.contentId}`;
    }
    return `https://www.hotstar.com/in/search?q=${encodeURIComponent(content.title || content.contentId)}`;
  }
}

export class DisneyPlusProvider extends BaseStreamingProvider {
  readonly id = "disney";
  readonly name = "Disney+";
  readonly brandColor = "#113CCF";
  readonly primaryRegions = ["GLOBAL", "US", "UK", "EU", "AU"];
  readonly capabilityLevel: CapabilityLevel = 3;

  getCapabilities(): ProviderCapabilities {
    return {
      deepLink: true,
      browserPlayback: false,
      extensionControl: false,
      playbackSynchronization: false,
      currentTimeDetection: false,
      playPauseControl: false,
      seekControl: false,
      episodeDetection: true,
      metadataLookup: true,
    };
  }

  async generateLaunchUrl(content: ContentReference): Promise<string> {
    if (content.customUrl) return content.customUrl;
    return `https://www.disneyplus.com/search?q=${encodeURIComponent(content.title || content.contentId)}`;
  }
}

export class AppleTvProvider extends BaseStreamingProvider {
  readonly id = "apple";
  readonly name = "Apple TV+";
  readonly brandColor = "#FFFFFF";
  readonly primaryRegions = ["GLOBAL", "US", "IN", "UK", "EU"];
  readonly capabilityLevel: CapabilityLevel = 3;

  getCapabilities(): ProviderCapabilities {
    return {
      deepLink: true,
      browserPlayback: false,
      extensionControl: false,
      playbackSynchronization: false,
      currentTimeDetection: false,
      playPauseControl: false,
      seekControl: false,
      episodeDetection: true,
      metadataLookup: true,
    };
  }

  async generateLaunchUrl(content: ContentReference): Promise<string> {
    if (content.customUrl) return content.customUrl;
    return `https://tv.apple.com/search?term=${encodeURIComponent(content.title || content.contentId)}`;
  }
}

export class SonyLivProvider extends BaseStreamingProvider {
  readonly id = "sonyliv";
  readonly name = "SonyLIV";
  readonly brandColor = "#000000";
  readonly primaryRegions = ["IN", "AE", "SA", "SG"];
  readonly capabilityLevel: CapabilityLevel = 3;

  getCapabilities(): ProviderCapabilities {
    return {
      deepLink: true,
      browserPlayback: false,
      extensionControl: false,
      playbackSynchronization: false,
      currentTimeDetection: false,
      playPauseControl: false,
      seekControl: false,
      episodeDetection: true,
      metadataLookup: true,
    };
  }

  async generateLaunchUrl(content: ContentReference): Promise<string> {
    if (content.customUrl) return content.customUrl;
    return `https://www.sonyliv.com/search/${encodeURIComponent(content.title || content.contentId)}`;
  }
}

export class Zee5Provider extends BaseStreamingProvider {
  readonly id = "zee5";
  readonly name = "ZEE5";
  readonly brandColor = "#8230C6";
  readonly primaryRegions = ["IN", "GLOBAL"];
  readonly capabilityLevel: CapabilityLevel = 3;

  getCapabilities(): ProviderCapabilities {
    return {
      deepLink: true,
      browserPlayback: false,
      extensionControl: false,
      playbackSynchronization: false,
      currentTimeDetection: false,
      playPauseControl: false,
      seekControl: false,
      episodeDetection: true,
      metadataLookup: true,
    };
  }

  async generateLaunchUrl(content: ContentReference): Promise<string> {
    if (content.customUrl) return content.customUrl;
    return `https://www.zee5.com/search?q=${encodeURIComponent(content.title || content.contentId)}`;
  }
}

export class CrunchyrollProvider extends BaseStreamingProvider {
  readonly id = "crunchyroll";
  readonly name = "Crunchyroll";
  readonly brandColor = "#F47521";
  readonly primaryRegions = ["GLOBAL", "US", "IN", "JP", "EU"];
  readonly capabilityLevel: CapabilityLevel = 3;

  getCapabilities(): ProviderCapabilities {
    return {
      deepLink: true,
      browserPlayback: false,
      extensionControl: false,
      playbackSynchronization: false,
      currentTimeDetection: false,
      playPauseControl: false,
      seekControl: false,
      episodeDetection: true,
      metadataLookup: true,
    };
  }

  async generateLaunchUrl(content: ContentReference): Promise<string> {
    if (content.customUrl) return content.customUrl;
    return `https://www.crunchyroll.com/search?q=${encodeURIComponent(content.title || content.contentId)}`;
  }
}

export class YouTubeProvider extends BaseStreamingProvider {
  readonly id = "youtube";
  readonly name = "YouTube";
  readonly brandColor = "#FF0000";
  readonly primaryRegions = ["GLOBAL"];
  readonly capabilityLevel: CapabilityLevel = 1;

  getCapabilities(): ProviderCapabilities {
    return {
      deepLink: true,
      browserPlayback: true,
      extensionControl: true,
      playbackSynchronization: true,
      currentTimeDetection: true,
      playPauseControl: true,
      seekControl: true,
      episodeDetection: false,
      metadataLookup: true,
    };
  }

  async generateLaunchUrl(content: ContentReference): Promise<string> {
    if (content.customUrl) return content.customUrl;
    if (content.contentId && (content.contentId.length === 11 || content.contentId.startsWith("http"))) {
      return content.contentId.startsWith("http")
        ? content.contentId
        : `https://www.youtube.com/watch?v=${content.contentId}`;
    }
    return `https://www.youtube.com/results?search_query=${encodeURIComponent(content.title || content.contentId)}`;
  }
}

