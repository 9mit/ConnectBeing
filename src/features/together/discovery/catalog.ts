/**
 * Unified Content Discovery & Entertainment Metadata Engine
 * MadLove Together — Universal Watch-Party Layer
 */

import { registry } from "../providers/registry";
import { CapabilityLevel, ContentType, ProviderAvailability } from "../providers/types";

export interface UnifiedAvailableProvider {
  providerId: string;
  providerName: string;
  brandColor: string;
  availability: ProviderAvailability;
  capabilityLevel: CapabilityLevel;
  launchUrl: string;
}

export interface UnifiedContentItem {
  id: string;
  title: string;
  type: ContentType;
  year: number;
  genre: string[];
  runtimeMinutes: number;
  rating: string;
  posterUrl: string;
  synopsis: string;
  availableOn: UnifiedAvailableProvider[];
  region: string;
}

// Curated Legitimate Metadata Catalog for Couple Entertainment
const CURATED_TITLES: Array<Omit<UnifiedContentItem, "availableOn"> & { providerIds: string[] }> = [
  {
    id: "interstellar-2014",
    title: "Interstellar",
    type: "movie",
    year: 2014,
    genre: ["Sci-Fi", "Adventure", "Drama"],
    runtimeMinutes: 169,
    rating: "PG-13",
    posterUrl: "https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?w=600&auto=format&fit=crop&q=80",
    synopsis: "A team of explorers travel through a wormhole in space in an attempt to ensure humanity's survival.",
    region: "GLOBAL",
    providerIds: ["prime", "jiohotstar", "apple", "netflix"],
  },
  {
    id: "midnight-in-paris-2011",
    title: "Midnight in Paris",
    type: "movie",
    year: 2011,
    genre: ["Romance", "Comedy", "Fantasy"],
    runtimeMinutes: 94,
    rating: "PG-13",
    posterUrl: "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=600&auto=format&fit=crop&q=80",
    synopsis: "While on a trip to Paris with his fiancée's family, a nostalgic screenwriter finds himself mysteriously going back to the 1920s every day at midnight.",
    region: "GLOBAL",
    providerIds: ["prime", "apple", "lionsgate"],
  },
  {
    id: "brahmastra-2022",
    title: "Brahmāstra: Part One – Shiva",
    type: "movie",
    year: 2022,
    genre: ["Fantasy", "Action", "Romance"],
    runtimeMinutes: 167,
    rating: "U/A",
    posterUrl: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600&auto=format&fit=crop&q=80",
    synopsis: "A young man discovers his connection to the element of fire and holds the power to awaken the greatest weapon in the universe.",
    region: "IN",
    providerIds: ["jiohotstar", "disney"],
  },
  {
    id: "stranger-things-2016",
    title: "Stranger Things",
    type: "series",
    year: 2016,
    genre: ["Sci-Fi", "Drama", "Mystery"],
    runtimeMinutes: 50,
    rating: "TV-14",
    posterUrl: "https://images.unsplash.com/photo-1534447677768-be436bb09401?w=600&auto=format&fit=crop&q=80",
    synopsis: "When a young boy vanishes, a small town uncovers a mystery involving secret experiments, terrifying supernatural forces and one strange little girl.",
    region: "GLOBAL",
    providerIds: ["netflix"],
  },
  {
    id: "loki-2021",
    title: "Loki",
    type: "series",
    year: 2021,
    genre: ["Action", "Adventure", "Fantasy"],
    runtimeMinutes: 52,
    rating: "TV-14",
    posterUrl: "https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=600&auto=format&fit=crop&q=80",
    synopsis: "The mercurial villain Loki resumes his role as the God of Mischief in a new series that takes place after the events of Avengers: Endgame.",
    region: "GLOBAL",
    providerIds: ["jiohotstar", "disney"],
  },
  {
    id: "spirited-away-2001",
    title: "Spirited Away",
    type: "movie",
    year: 2001,
    genre: ["Animation", "Adventure", "Family"],
    runtimeMinutes: 125,
    rating: "PG",
    posterUrl: "https://images.unsplash.com/photo-1534447677768-be436bb09401?w=600&auto=format&fit=crop&q=80",
    synopsis: "During her family's move to the suburbs, a sullen 10-year-old girl wanders into a world ruled by gods, witches, and spirits.",
    region: "GLOBAL",
    providerIds: ["netflix", "apple"],
  },
  {
    id: "jujutsu-kaisen-2020",
    title: "Jujutsu Kaisen",
    type: "series",
    year: 2020,
    genre: ["Animation", "Action", "Supernatural"],
    runtimeMinutes: 24,
    rating: "TV-MA",
    posterUrl: "https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=600&auto=format&fit=crop&q=80",
    synopsis: "A boy swallows a cursed talisman and becomes cursed himself. He enters a shaman's school to find the talisman's other fingers and exorcise himself.",
    region: "GLOBAL",
    providerIds: ["crunchyroll", "netflix"],
  },
  {
    id: "12th-fail-2023",
    title: "12th Fail",
    type: "movie",
    year: 2023,
    genre: ["Biography", "Drama"],
    runtimeMinutes: 147,
    rating: "U",
    posterUrl: "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=600&auto=format&fit=crop&q=80",
    synopsis: "The real-life story of an IPS officer who restarts his academic journey and reclaims his destiny against all odds.",
    region: "IN",
    providerIds: ["jiohotstar"],
  },
  {
    id: "scam-1992",
    title: "Scam 1992: The Harshad Mehta Story",
    type: "series",
    year: 2020,
    genre: ["Biography", "Crime", "Drama"],
    runtimeMinutes: 50,
    rating: "16+",
    posterUrl: "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=600&auto=format&fit=crop&q=80",
    synopsis: "Set in 1980s and 90s Bombay, follows the life of Harshad Mehta, a stockbroker who took the stock market to dizzying heights and his catastrophic downfall.",
    region: "IN",
    providerIds: ["sonyliv", "tataplaybinge"],
  },
];

export async function searchUnifiedCatalog(
  query: string,
  userRegion = "IN",
): Promise<UnifiedContentItem[]> {
  const cleanQuery = query.trim().toLowerCase();
  const results: UnifiedContentItem[] = [];

  // 1. Search Curated High-Definition Matches
  const matchedCurated = CURATED_TITLES.filter(
    (item) =>
      item.title.toLowerCase().includes(cleanQuery) ||
      item.genre.some((g) => g.toLowerCase().includes(cleanQuery)),
  );

  for (const item of matchedCurated) {
    const availableOn: UnifiedAvailableProvider[] = [];

    for (const pid of item.providerIds) {
      const provider = registry.get(pid);
      if (!provider) continue;

      const launchUrl = await provider.generateLaunchUrl({
        contentId: item.id,
        providerId: pid,
        title: item.title,
      });

      const availability = await provider.detectAvailability(userRegion);

      availableOn.push({
        providerId: provider.id,
        providerName: provider.name,
        brandColor: provider.brandColor,
        availability,
        capabilityLevel: provider.capabilityLevel,
        launchUrl,
      });
    }

    results.push({
      ...item,
      availableOn,
    });
  }

  // 2. Dynamic Fallback for ANY title queried
  // If no curated match, or as an extensible general search, generate universal provider options
  if (cleanQuery.length > 1 && results.length === 0) {
    const activeProviders = registry.getActive();
    const primaryOptions = activeProviders.slice(0, 5); // top 5 active platforms

    const availableOn: UnifiedAvailableProvider[] = [];
    for (const provider of primaryOptions) {
      const launchUrl = await provider.generateLaunchUrl({
        contentId: encodeURIComponent(query.trim()),
        providerId: provider.id,
        title: query.trim(),
      });
      availableOn.push({
        providerId: provider.id,
        providerName: provider.name,
        brandColor: provider.brandColor,
        availability: await provider.detectAvailability(userRegion),
        capabilityLevel: provider.capabilityLevel,
        launchUrl,
      });
    }

    results.push({
      id: `custom-${encodeURIComponent(cleanQuery)}`,
      title: query.trim(),
      type: "movie",
      year: new Date().getFullYear(),
      genre: ["Cinema", "Entertainment"],
      runtimeMinutes: 120,
      rating: "NR",
      posterUrl: "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=600&auto=format&fit=crop&q=80",
      synopsis: `Stream and synchronize "${query.trim()}" together through your favorite OTT platform.`,
      region: userRegion,
      availableOn,
    });
  }

  return results;
}
