import { StreamingProvider, ProviderCapabilities } from "./types";
import {
  NetflixProvider,
  PrimeVideoProvider,
  JioHotstarProvider,
  DisneyPlusProvider,
  AppleTvProvider,
  SonyLivProvider,
  Zee5Provider,
  CrunchyrollProvider,
  YouTubeProvider,
  WebVideoProvider,
} from "./adapters/major";
import {
  MxPlayerProvider,
  LionsgatePlayProvider,
  SunNxtProvider,
  AhaProvider,
  HoichoiProvider,
  ManoramaMaxProvider,
  DiscoveryPlusProvider,
  TataPlayBingeProvider,
} from "./adapters/regional";

/**
 * Universal Streaming Provider Registry
 * Decouples the MadLove Together engine from any individual OTT implementation.
 */
export class StreamingProviderRegistry {
  private static instance: StreamingProviderRegistry | null = null;
  private providers = new Map<string, StreamingProvider>();
  private disabledProviders = new Set<string>();

  private constructor() {
    this.registerDefaults();
  }

  static getInstance(): StreamingProviderRegistry {
    if (!this.instance) {
      this.instance = new StreamingProviderRegistry();
    }
    return this.instance;
  }

  private registerDefaults() {
    // Register Major International & National OTTs
    this.register(new NetflixProvider());
    this.register(new PrimeVideoProvider());
    this.register(new JioHotstarProvider());
    this.register(new DisneyPlusProvider());
    this.register(new AppleTvProvider());
    this.register(new SonyLivProvider());
    this.register(new Zee5Provider());
    this.register(new CrunchyrollProvider());
    this.register(new YouTubeProvider());
    this.register(new WebVideoProvider());

    // Register Regional & Aggregator OTTs
    this.register(new MxPlayerProvider());
    this.register(new LionsgatePlayProvider());
    this.register(new SunNxtProvider());
    this.register(new AhaProvider());
    this.register(new HoichoiProvider());
    this.register(new ManoramaMaxProvider());
    this.register(new DiscoveryPlusProvider());
    this.register(new TataPlayBingeProvider());
  }

  /**
   * Register a new OTT provider adapter into the engine
   */
  register(provider: StreamingProvider): void {
    this.providers.set(provider.id.toLowerCase(), provider);
  }

  /**
   * Get an adapter by provider ID
   */
  get(id: string): StreamingProvider | undefined {
    return this.providers.get(id.toLowerCase());
  }

  /**
   * Check if a provider is registered and active
   */
  has(id: string): boolean {
    const key = id.toLowerCase();
    return this.providers.has(key) && !this.disabledProviders.has(key);
  }

  /**
   * List all registered providers
   */
  getAll(): StreamingProvider[] {
    return Array.from(this.providers.values());
  }

  /**
   * List only active/enabled providers
   */
  getActive(): StreamingProvider[] {
    return this.getAll().filter((p) => !this.disabledProviders.has(p.id.toLowerCase()));
  }

  /**
   * Filter providers by capability
   */
  filterByCapability(predicate: (caps: ProviderCapabilities) => boolean): StreamingProvider[] {
    return this.getActive().filter((p) => predicate(p.getCapabilities()));
  }

  /**
   * Filter providers by region
   */
  filterByRegion(regionCode: string): StreamingProvider[] {
    const upper = regionCode.toUpperCase();
    return this.getActive().filter(
      (p) => p.primaryRegions.includes("GLOBAL") || p.primaryRegions.includes(upper),
    );
  }

  /**
   * Enable or disable a provider dynamically without code changes
   */
  setEnabled(id: string, enabled: boolean): void {
    const key = id.toLowerCase();
    if (enabled) {
      this.disabledProviders.delete(key);
    } else {
      this.disabledProviders.add(key);
    }
  }
}

// Global Singleton Accessors
export const registry = StreamingProviderRegistry.getInstance();

export function getProvider(id: string): StreamingProvider | undefined {
  return registry.get(id);
}

export function getAllProviders(): StreamingProvider[] {
  return registry.getActive();
}
