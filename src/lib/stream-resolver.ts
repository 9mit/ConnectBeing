/**
 * Universal Stream URL Resolver & Validator for CoupleConnect Direct Sync.
 * Supports direct MP4/WebM, HLS (.m3u8), MPEG-DASH (.mpd), and YouTube.
 * Performs format detection, container compatibility inspection, protocol validation,
 * mixed-content checks, and safe diagnostic sanitization.
 */

export type StreamFormat =
  | "mp4"
  | "webm"
  | "ogg"
  | "hls"
  | "dash"
  | "youtube"
  | "unsupported_container"
  | "unsupported_protocol"
  | "webpage"
  | "unknown";

export interface ResolvedStream {
  url: string;
  originalUrl?: string;
  fallbackUrl?: string;
  derivedTitle?: string;
  isHls?: boolean;
  isDash?: boolean;
  format?: StreamFormat;
  isBrowserCompatible?: boolean;
  isInsecureHttp?: boolean;
  unsupportedReason?: string;
  suggestedAction?: string;
}

export interface StreamValidationResult {
  isValid: boolean;
  url: string;
  originalUrl: string;
  format: StreamFormat;
  derivedTitle: string;
  isBrowserCompatible: boolean;
  isInsecureHttp: boolean;
  unsupportedReason?: string;
  suggestedAction?: string;
}

/**
 * Checks if a hostname belongs to private/loopback IP space (SSRF guard).
 */
export function isPrivateHost(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  if (
    lower === "localhost" ||
    lower.endsWith(".local") ||
    lower.endsWith(".internal") ||
    lower === "127.0.0.1" ||
    lower === "::1" ||
    lower === "0.0.0.0"
  ) {
    return true;
  }
  const parts = lower.split(".").map(Number);
  if (parts.length === 4 && parts.every((n) => !isNaN(n) && n >= 0 && n <= 255)) {
    if (parts[0] === 10) return true;
    if (parts[0] === 127) return true;
    if (parts[0] === 169 && parts[1] === 254) return true;
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    if (parts[0] === 192 && parts[1] === 168) return true;
    if (parts[0] === 0) return true;
  }
  return false;
}

/**
 * Sanitizes URLs for diagnostic logs by scrubbing sensitive query parameters
 * (tokens, api keys, signatures) so credentials are never leaked.
 */
export function sanitizeStreamUrlForLogging(rawUrl: string): string {
  if (!rawUrl || typeof rawUrl !== "string") return "";
  try {
    const parsed = new URL(rawUrl);
    if (parsed.username) parsed.username = "REDACTED";
    if (parsed.password) parsed.password = "REDACTED";

    const SENSITIVE_KEYS = [
      "token",
      "api_key",
      "apikey",
      "key",
      "secret",
      "sig",
      "signature",
      "auth",
      "x-emby-token",
      "access_token",
      "credential",
      "playsessionid",
    ];
    for (const key of Array.from(parsed.searchParams.keys())) {
      if (SENSITIVE_KEYS.some((s) => key.toLowerCase().includes(s))) {
        parsed.searchParams.set(key, "REDACTED");
      }
    }
    return parsed.toString();
  } catch {
    return rawUrl.split("?")[0] || "";
  }
}

/**
 * Detects if a URL is a YouTube link.
 */
export function isYouTubeUrl(url: string): boolean {
  if (!url) return false;
  const lower = url.toLowerCase();
  return (
    lower.includes("youtube.com/watch") ||
    lower.includes("youtu.be/") ||
    lower.includes("youtube.com/embed/") ||
    lower.includes("youtube.com/shorts/") ||
    lower.includes("youtube-nocookie.com/")
  );
}

/**
 * Extracts YouTube video ID if present.
 */
export function extractYouTubeId(url: string): string | null {
  if (!url) return null;
  const match = url.match(
    /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([\w-]{11})/i
  );
  return match ? match[1] : null;
}

/**
 * Detects the media format and streaming protocol of a given URL.
 */
export function detectStreamFormat(url: string): StreamFormat {
  if (!url) return "unknown";

  const trimmed = url.trim();
  const lower = trimmed.toLowerCase();

  // 1. Protocol check
  const protocolMatch = lower.match(/^([a-z0-9+.-]+):/);
  if (protocolMatch) {
    const proto = protocolMatch[1];
    if (["rtsp", "rtmp", "smb", "ftp", "udp", "file", "magnet"].includes(proto)) {
      return "unsupported_protocol";
    }
  }

  // 2. YouTube
  if (isYouTubeUrl(trimmed)) {
    return "youtube";
  }

  try {
    const parsed = new URL(trimmed);
    const pathname = parsed.pathname.toLowerCase();
    const search = parsed.search.toLowerCase();

    // 3. HLS (.m3u8, /m3u8, query format=m3u8)
    if (
      pathname.endsWith(".m3u8") ||
      pathname.includes("/m3u8") ||
      pathname.includes("master.m3u8") ||
      pathname.includes("playlist.m3u8") ||
      pathname.includes("index.m3u8") ||
      search.includes(".m3u8") ||
      search.includes("format=m3u8") ||
      search.includes("ext=m3u8")
    ) {
      return "hls";
    }

    // 4. MPEG-DASH (.mpd, /dash/, query format=mpd)
    if (
      pathname.endsWith(".mpd") ||
      pathname.includes("/dash/") ||
      pathname.includes("manifest.mpd") ||
      search.includes(".mpd") ||
      search.includes("format=mpd")
    ) {
      return "dash";
    }

    // 5. Incompatible container formats that browsers cannot natively decode
    const unsupportedExts = [
      ".mkv",
      ".avi",
      ".flv",
      ".wmv",
      ".rmvb",
      ".mov",
      ".vob",
      ".iso",
      ".ts", // Raw standalone TS without HLS playlist
    ];
    if (unsupportedExts.some((ext) => pathname.endsWith(ext))) {
      return "unsupported_container";
    }

    // 6. Direct browser-compatible video formats
    if (pathname.endsWith(".mp4") || pathname.endsWith(".m4v") || pathname.endsWith(".f4v")) {
      return "mp4";
    }
    if (pathname.endsWith(".webm")) {
      return "webm";
    }
    if (pathname.endsWith(".ogv") || pathname.endsWith(".ogg")) {
      return "ogg";
    }

    // 7. Non-direct web pages / landing pages / media server web interfaces
    const isWebpageExtension =
      pathname.endsWith(".html") ||
      pathname.endsWith(".htm") ||
      pathname.endsWith(".php") ||
      pathname.endsWith(".asp") ||
      pathname.endsWith(".aspx");

    const isVideoPortalDomain = [
      "vimeo.com",
      "dailymotion.com",
      "twitch.tv",
      "tiktok.com",
      "netflix.com",
      "hotstar.com",
      "primevideo.com",
      "disneyplus.com",
      "hulu.com",
    ].some((d) => parsed.hostname.toLowerCase().includes(d));

    const isMediaServerWebUi =
      pathname === "/web" ||
      pathname === "/web/" ||
      pathname.startsWith("/web/") ||
      pathname.endsWith("/web/index.html") ||
      pathname.includes("/web/index.html") ||
      parsed.hash.includes("#!/") ||
      parsed.hash.includes("#/details") ||
      parsed.hash.includes("#/item");

    if (isWebpageExtension || isVideoPortalDomain || isMediaServerWebUi) {
      return "webpage";
    }

    // Check query params if path had no extension (e.g. storage signed URLs)
    if (search.includes(".mp4")) return "mp4";
    if (search.includes(".webm")) return "webm";
    if (search.includes(".m3u8")) return "hls";
    if (search.includes(".mpd")) return "dash";

    return "unknown";
  } catch {
    return "unknown";
  }
}

/**
 * Derives a human-friendly title from URL filename or query parameters.
 */
export function deriveStreamTitle(url: string, customTitle?: string): string {
  if (customTitle && customTitle.trim()) {
    return customTitle.trim();
  }
  if (!url) return "Network Stream";

  try {
    const parsed = new URL(url.trim());

    // 1. Check title / name query parameter
    const queryTitle =
      parsed.searchParams.get("title") ||
      parsed.searchParams.get("name") ||
      parsed.searchParams.get("filename");
    if (queryTitle && queryTitle.trim()) {
      return decodeURIComponent(queryTitle.trim());
    }

    // 2. Extract from filename in pathname
    const pathname = parsed.pathname;
    const segments = pathname.split("/").filter(Boolean);
    const lastSegment = segments.pop();

    if (lastSegment && lastSegment.includes(".")) {
      // Strip extension and replace underscores/dashes with spaces
      const withoutExt = lastSegment.replace(/\.[^/.]+$/, "");
      const cleaned = decodeURIComponent(withoutExt)
        .replace(/[-_.]+/g, " ")
        .replace(/\b(1080p|720p|480p|2160p|4k|h264|x264|aac|webrip|bluray|x265|hevc)\b/gi, "")
        .trim();
      if (cleaned.length > 2) {
        // Capitalize words
        return cleaned.replace(/\b\w/g, (c) => c.toUpperCase());
      }
    }

    // 3. Fallback to host or generic title
    if (parsed.hostname) {
      return `Stream from ${parsed.hostname}`;
    }
  } catch {
    /* ignore parse errors */
  }

  return "Network Stream";
}

/**
 * Comprehensive stream validator that inspects protocol, format, browser capability,
 * mixed-content constraints, and provides actionable remediation guidance.
 */
export function validateStreamUrl(
  rawUrl: string,
  isPageHttps = typeof window !== "undefined" && window.location.protocol === "https:"
): StreamValidationResult {
  const trimmed = (rawUrl || "").trim();

  if (!trimmed) {
    return {
      isValid: false,
      url: "",
      originalUrl: "",
      format: "unknown",
      derivedTitle: "Network Stream",
      isBrowserCompatible: false,
      isInsecureHttp: false,
      unsupportedReason: "No stream URL provided. Please enter a media URL.",
      suggestedAction: "Paste a direct MP4, WebM, HLS (.m3u8), or MPEG-DASH (.mpd) link.",
    };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return {
      isValid: false,
      url: trimmed,
      originalUrl: trimmed,
      format: "unknown",
      derivedTitle: "Network Stream",
      isBrowserCompatible: false,
      isInsecureHttp: false,
      unsupportedReason: "Malformed URL syntax. Ensure the URL begins with https:// or http://.",
      suggestedAction: "Check the URL format and try again.",
    };
  }

  // Protocol check
  const protocol = parsed.protocol.toLowerCase();
  if (protocol !== "http:" && protocol !== "https:") {
    const protoName = protocol.replace(":", "").toUpperCase();
    return {
      isValid: false,
      url: trimmed,
      originalUrl: trimmed,
      format: "unsupported_protocol",
      derivedTitle: "Network Stream",
      isBrowserCompatible: false,
      isInsecureHttp: false,
      unsupportedReason: `The ${protoName} protocol cannot be streamed directly inside a web browser due to security sandbox policies.`,
      suggestedAction:
        "Provide an HTTP or HTTPS stream URL (such as an HLS .m3u8, DASH .mpd, or direct MP4 link).",
    };
  }

  // SSRF guard
  if (isPrivateHost(parsed.hostname)) {
    return {
      isValid: false,
      url: trimmed,
      originalUrl: trimmed,
      format: "unknown",
      derivedTitle: "Local Network Stream",
      isBrowserCompatible: false,
      isInsecureHttp: false,
      unsupportedReason:
        "Streams hosted on local or private networks (e.g. localhost, 192.168.x.x) cannot be shared with your partner across the internet.",
      suggestedAction:
        "Use a publicly reachable HTTPS stream, or play locally in VLC and click 'Share Screen' to stream your screen to your partner.",
    };
  }

  // Mixed content check (HTTP on HTTPS page)
  const isInsecureHttp = protocol === "http:" && isPageHttps;

  // Format detection
  const format = detectStreamFormat(trimmed);
  const derivedTitle = deriveStreamTitle(trimmed);

  // Incompatible containers
  if (format === "unsupported_container") {
    const extMatch = parsed.pathname.match(/\.([a-z0-9]+)$/i);
    const ext = extMatch ? extMatch[1].toUpperCase() : "container";
    return {
      isValid: false,
      url: trimmed,
      originalUrl: trimmed,
      format,
      derivedTitle,
      isBrowserCompatible: false,
      isInsecureHttp,
      unsupportedReason: `Web browsers cannot hardware-decode ${ext} containers directly in HTML5 video elements.`,
      suggestedAction:
        "Convert the file to MP4 (H.264 + AAC) or an HLS (.m3u8) stream, or play it on your computer in VLC Player and click 'Share Screen' to stream it in 1080p with audio to your partner.",
    };
  }

  // Web pages / portals
  if (format === "webpage") {
    const isMediaServer =
      parsed.pathname === "/web" ||
      parsed.pathname === "/web/" ||
      parsed.pathname.startsWith("/web/") ||
      parsed.pathname.includes("/web/index.html") ||
      parsed.hash.includes("details") ||
      parsed.hash.includes("item");

    return {
      isValid: false,
      url: trimmed,
      originalUrl: trimmed,
      format,
      derivedTitle,
      isBrowserCompatible: false,
      isInsecureHttp,
      unsupportedReason: isMediaServer
        ? "This URL points to the media server's web interface rather than a direct playable stream endpoint."
        : "The provided URL leads to a web page rather than a direct playable media stream file.",
      suggestedAction: isMediaServer
        ? "In your media server (Jellyfin/Emby), open the media item, select 'Copy Stream Link' or 'Copy Download Link' (containing /stream or /Download with your API key/token), and paste that link here."
        : "Extract the direct video stream URL ending in .mp4, .m3u8, or .mpd, or use YouTube links directly.",
    };
  }

  // Insecure HTTP warning
  if (isInsecureHttp) {
    return {
      isValid: false,
      url: trimmed,
      originalUrl: trimmed,
      format,
      derivedTitle,
      isBrowserCompatible: false,
      isInsecureHttp: true,
      unsupportedReason:
        "Mixed-Content Block: Modern browsers block insecure HTTP media streams on secure HTTPS pages.",
      suggestedAction:
        "Please use the HTTPS version of this stream (change http:// to https://) if supported by the provider.",
    };
  }

  // Valid, browser-compatible stream
  return {
    isValid: true,
    url: trimmed,
    originalUrl: trimmed,
    format,
    derivedTitle,
    isBrowserCompatible: true,
    isInsecureHttp: false,
  };
}

/**
 * Universal Stream URL Resolver for CoupleConnect VirtualRoom & Direct Sync.
 * Automatically resolves and normalizes media server URLs (e.g. Jellyfin, Emby)
 * while preserving direct video links and adaptive manifests.
 */
export function resolveStreamUrl(rawUrl: string): ResolvedStream {
  if (!rawUrl || typeof rawUrl !== "string") {
    return { url: rawUrl || "" };
  }

  const trimmed = rawUrl.trim();
  const validation = validateStreamUrl(trimmed);

  try {
    const parsed = new URL(trimmed);

    // Jellyfin & Emby Media Server Download / Stream URL Auto-Transformation
    // Detects /Items/{id}/Download, /Videos/{id}/stream, or /Videos/{id}/master.m3u8 and provides robust adaptive HLS
    const hasJellyfinIndicator =
      parsed.pathname.toLowerCase().includes("jellyfin") ||
      parsed.pathname.toLowerCase().includes("emby") ||
      parsed.hostname.toLowerCase().includes("jellyfin") ||
      parsed.hostname.toLowerCase().includes("emby") ||
      Boolean(
        parsed.searchParams.get("api_key") ||
        parsed.searchParams.get("ApiKey") ||
        parsed.searchParams.get("apikey") ||
        parsed.searchParams.get("token") ||
        parsed.searchParams.get("Token") ||
        parsed.searchParams.get("X-Emby-Token") ||
        parsed.searchParams.get("x-emby-token")
      );

    const isJellyfinOrEmbyMedia =
      hasJellyfinIndicator &&
      (parsed.pathname.toLowerCase().includes("/items/") ||
        parsed.pathname.toLowerCase().includes("/videos/")) &&
      (parsed.pathname.toLowerCase().includes("/download") ||
        parsed.pathname.toLowerCase().includes("/stream") ||
        parsed.pathname.toLowerCase().includes("master.m3u8") ||
        parsed.pathname.toLowerCase().includes("main.m3u8"));

    if (isJellyfinOrEmbyMedia) {
      const match = parsed.pathname.match(/\/(?:items|videos)\/([a-f0-9]{32}|[a-f0-9-]{36})/i);
      if (match) {
        const itemId = match[1].replace(/-/g, "");
        const apiKey =
          parsed.searchParams.get("api_key") ||
          parsed.searchParams.get("ApiKey") ||
          parsed.searchParams.get("apikey") ||
          parsed.searchParams.get("token") ||
          parsed.searchParams.get("Token") ||
          parsed.searchParams.get("X-Emby-Token") ||
          parsed.searchParams.get("x-emby-token") ||
          "";

        const idx = parsed.pathname.toLowerCase().indexOf(match[0].toLowerCase());
        const basePath = idx > 0 ? parsed.pathname.slice(0, idx) : "";

        const isAlreadyHls =
          parsed.pathname.toLowerCase().includes("master.m3u8") ||
          parsed.pathname.toLowerCase().includes("main.m3u8");

        let hlsUrl: string;
        if (isAlreadyHls) {
          // If already an HLS URL, keep all existing parameters and ensure DeviceId & PlaySessionId are present
          const hlsParams = new URLSearchParams(parsed.search);
          if (apiKey && !hlsParams.has("api_key")) {
            hlsParams.set("api_key", apiKey);
          }
          if (!hlsParams.has("DeviceId")) {
            hlsParams.set("DeviceId", "SoulNestWeb");
          }
          if (!hlsParams.has("PlaySessionId")) {
            hlsParams.set(
              "PlaySessionId",
              `cc_${Math.random().toString(36).substring(2, 9)}_${Date.now()}`
            );
          }
          hlsUrl = `${parsed.origin}${parsed.pathname}?${hlsParams.toString()}`;
        } else {
          // Construct Jellyfin adaptive HLS playlist with full session and codec specifications
          const hlsParams = new URLSearchParams();
          if (apiKey) {
            hlsParams.set("api_key", apiKey);
          }
          hlsParams.set("MediaSourceId", itemId);
          hlsParams.set("DeviceId", "SoulNestWeb");
          hlsParams.set(
            "PlaySessionId",
            `cc_${Math.random().toString(36).substring(2, 9)}_${Date.now()}`
          );
          hlsParams.set("VideoCodec", "h264");
          hlsParams.set("AudioCodec", "aac");
          hlsParams.set("TranscodeReasons", "ContainerNotSupported");
          hlsParams.set("SegmentContainer", "ts");
          hlsParams.set("MinSegments", "1");
          hlsParams.set("BreakOnNonKeyFrames", "true");

          hlsUrl = `${parsed.origin}${basePath}/videos/${itemId}/master.m3u8?${hlsParams.toString()}`;
        }

        return {
          url: hlsUrl,
          originalUrl: trimmed,
          fallbackUrl: isAlreadyHls ? undefined : trimmed,
          derivedTitle:
            validation.derivedTitle && !validation.derivedTitle.startsWith("Stream from")
              ? validation.derivedTitle
              : "Jellyfin Cinema Stream",
          isHls: true,
          format: "hls",
          isBrowserCompatible: true,
          isInsecureHttp: validation.isInsecureHttp,
        };
      }
    }

    return {
      url: trimmed,
      originalUrl: trimmed,
      derivedTitle: validation.derivedTitle,
      isHls: validation.format === "hls",
      isDash: validation.format === "dash",
      format: validation.format,
      isBrowserCompatible: validation.isBrowserCompatible,
      isInsecureHttp: validation.isInsecureHttp,
      unsupportedReason: validation.unsupportedReason,
      suggestedAction: validation.suggestedAction,
    };
  } catch {
    return {
      url: trimmed,
      originalUrl: trimmed,
      derivedTitle: validation.derivedTitle,
      format: validation.format,
      isBrowserCompatible: validation.isBrowserCompatible,
      isInsecureHttp: validation.isInsecureHttp,
      unsupportedReason: validation.unsupportedReason,
      suggestedAction: validation.suggestedAction,
    };
  }
}
