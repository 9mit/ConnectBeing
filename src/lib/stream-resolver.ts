/**
 * Universal Stream URL Resolver for CoupleConnect VirtualRoom & VLC Engine.
 * Automatically transforms raw download links from media servers (Jellyfin, Emby)
 * into browser-compatible adaptive HLS streams (H.264 + AAC) that play seamlessly in HTML5 <video>.
 */

export interface ResolvedStream {
  url: string;
  derivedTitle?: string;
  isHls?: boolean;
}

export function resolveStreamUrl(rawUrl: string): ResolvedStream {
  if (!rawUrl || typeof rawUrl !== "string") {
    return { url: rawUrl || "" };
  }

  const trimmed = rawUrl.trim();

  try {
    const parsed = new URL(trimmed);

    // 1. Jellyfin & Emby Media Server Auto-Transformation
    // Detects /jellyfin/Items/{id}/Download, /Items/{id}/Download, /Videos/{id}/stream, etc.
    const isJellyfinOrEmby =
      parsed.pathname.toLowerCase().includes("jellyfin") ||
      parsed.pathname.toLowerCase().includes("emby") ||
      Boolean(parsed.pathname.match(/\/(?:items|videos)\/[a-f0-9]{32}/i));

    if (isJellyfinOrEmby) {
      const match = parsed.pathname.match(/\/(?:items|videos)\/([a-f0-9]{32})/i);
      if (match) {
        const itemId = match[1];
        const apiKey =
          parsed.searchParams.get("api_key") ||
          parsed.searchParams.get("token") ||
          parsed.searchParams.get("X-Emby-Token") ||
          "";

        // Determine base path prefix (e.g. "/jellyfin" or "")
        const idx = parsed.pathname.toLowerCase().indexOf(match[0].toLowerCase());
        const basePath = idx > 0 ? parsed.pathname.slice(0, idx) : "";

        // Construct high-grade browser HLS stream forced to H.264 High profile, AAC stereo, 1080p
        const hlsParams = new URLSearchParams({
          api_key: apiKey,
          MediaSourceId: itemId,
          VideoCodec: "h264",
          AudioCodec: "aac",
          AudioStreamIndex: "1",
          SubtitleStreamIndex: "-1",
          VideoBitrate: "8000000",
          AudioBitrate: "384000",
          MaxFramerate: "60",
          MaxWidth: "1920",
          MaxHeight: "1080",
          SegmentContainer: "ts",
          MinSegments: "2",
          BreakOnNonKeyFrames: "true",
          AllowVideoStreamCopy: "false",
          AllowAudioStreamCopy: "false",
          TranscodeReasons: "ContainerNotSupported,VideoCodecNotSupported,AudioCodecNotSupported",
        });

        // Use direct main.m3u8 media playlist to eliminate master manifest ambiguity and ensure pure H.264
        const hlsUrl = `${parsed.origin}${basePath}/videos/${itemId}/main.m3u8?${hlsParams.toString()}`;
        console.log("[StreamResolver] Auto-converted Jellyfin/Emby raw download URL to browser HLS stream:", hlsUrl);
        return {
          url: hlsUrl,
          derivedTitle: "Jellyfin Cinema Stream",
          isHls: true,
        };
      }
    }

    // 2. Derive title from standard video filename if possible
    const pathname = parsed.pathname;
    const filename = pathname.split("/").pop();
    if (filename && filename.includes(".")) {
      const cleanName = decodeURIComponent(
        filename.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ")
      );
      return { url: trimmed, derivedTitle: cleanName };
    }
  } catch {
    /* Fall back to raw URL if parsing fails */
  }

  return { url: trimmed };
}
