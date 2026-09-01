import { LocalProvider } from "./providers";
import type { AIProvider } from "./types";

export * from "./types";
export * from "./events";
export * from "./graph";
export * from "./behavior";
export * from "./compatibility";
export * from "./recommendation";
export * from "./templates";
export * from "./analyze";
export * from "./conversation";
export * from "./mood-engine";
export * from "./habit";
export * from "./memory-engine";
export * from "./insight-generator";
export {
  LocalProvider,
  NullProvider,
  FutureGroqProvider,
  FutureGeminiProvider,
  FutureOpenAIProvider,
} from "./providers";

/**
 * Core path always uses LocalProvider.
 * External adapters exist only as stubs and are never selected by default.
 */
const currentProvider: AIProvider = LocalProvider;

export function getAIProvider(): AIProvider {
  return currentProvider;
}

/** Explicit local-only accessor for callers that must not risk adapters. */
export function getLocalAIProvider(): AIProvider {
  return LocalProvider;
}
