import { NetflixProvider } from "./netflix";
import { PrimeProvider } from "./prime";
import { StreamingProvider } from "./types";

export const providers: Record<string, StreamingProvider> = {
  netflix: NetflixProvider,
  prime: PrimeProvider,
};

export function getProvider(id: string): StreamingProvider | undefined {
  return providers[id];
}

export * from "./types";
