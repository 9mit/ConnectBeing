import { BaseStreamingProvider } from "../base";
import { ContentReference, ProviderCapabilities, CapabilityLevel } from "../types";

export class MxPlayerProvider extends BaseStreamingProvider {
  readonly id = "mxplayer";
  readonly name = "MX Player";
  readonly brandColor = "#0053E2";
  readonly primaryRegions = ["IN"];
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
    return `https://www.mxplayer.in/search?q=${encodeURIComponent(content.title || content.contentId)}`;
  }
}

export class LionsgatePlayProvider extends BaseStreamingProvider {
  readonly id = "lionsgate";
  readonly name = "Lionsgate Play";
  readonly brandColor = "#9B783E";
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
    return `https://www.lionsgateplay.com/search/${encodeURIComponent(content.title || content.contentId)}`;
  }
}

export class SunNxtProvider extends BaseStreamingProvider {
  readonly id = "sunnxt";
  readonly name = "Sun NXT";
  readonly brandColor = "#ED1C24";
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
    return `https://www.sunnxt.com/search?q=${encodeURIComponent(content.title || content.contentId)}`;
  }
}

export class AhaProvider extends BaseStreamingProvider {
  readonly id = "aha";
  readonly name = "Aha";
  readonly brandColor = "#FF3D00";
  readonly primaryRegions = ["IN", "US", "GLOBAL"];
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
    return `https://www.aha.video/search?q=${encodeURIComponent(content.title || content.contentId)}`;
  }
}

export class HoichoiProvider extends BaseStreamingProvider {
  readonly id = "hoichoi";
  readonly name = "Hoichoi";
  readonly brandColor = "#E50000";
  readonly primaryRegions = ["IN", "BD", "GLOBAL"];
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
    return `https://www.hoichoi.tv/search?q=${encodeURIComponent(content.title || content.contentId)}`;
  }
}

export class ManoramaMaxProvider extends BaseStreamingProvider {
  readonly id = "manoramamax";
  readonly name = "ManoramaMAX";
  readonly brandColor = "#FF5100";
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
    return `https://www.manoramamax.com/search?q=${encodeURIComponent(content.title || content.contentId)}`;
  }
}

export class DiscoveryPlusProvider extends BaseStreamingProvider {
  readonly id = "discovery";
  readonly name = "Discovery+";
  readonly brandColor = "#004071";
  readonly primaryRegions = ["IN", "US", "UK", "GLOBAL"];
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
    return `https://www.discoveryplus.in/search?q=${encodeURIComponent(content.title || content.contentId)}`;
  }
}

export class TataPlayBingeProvider extends BaseStreamingProvider {
  readonly id = "tataplaybinge";
  readonly name = "Tata Play Binge";
  readonly brandColor = "#0B2545";
  readonly primaryRegions = ["IN"];
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
    return `https://www.tataplaybinge.com/search?q=${encodeURIComponent(content.title || content.contentId)}`;
  }
}
