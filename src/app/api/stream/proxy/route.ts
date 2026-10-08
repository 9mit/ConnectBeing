import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Allow-Headers": "Range, Content-Type, Accept, User-Agent, X-Requested-With",
  "Access-Control-Expose-Headers": "Content-Length, Content-Range, Content-Type, Accept-Ranges, Date",
  "Access-Control-Max-Age": "86400",
};

/**
 * Validates against SSRF by disallowing private, loopback, and local network IPs.
 */
function isPrivateOrLocalHost(hostname: string): boolean {
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
 * Rewrites HLS playlist (.m3u8) URIs (segments and variant playlists)
 * so every chunk is routed through the proxy with CORS & Range support.
 */
function rewriteHlsPlaylist(manifestText: string, baseUrl: string, proxyEndpoint: string): string {
  const lines = manifestText.split("\n");
  const rewritten = lines.map((line) => {
    const trimmed = line.trim();
    if (!trimmed) return line;

    if (trimmed.startsWith("#")) {
      if (
        trimmed.startsWith("#EXT-X-KEY:") ||
        trimmed.startsWith("#EXT-X-MAP:") ||
        trimmed.startsWith("#EXT-X-MEDIA:") ||
        trimmed.startsWith("#EXT-X-I-FRAME-STREAM-INF:")
      ) {
        return line.replace(/URI="([^"]+)"/g, (_, uriValue) => {
          try {
            const absoluteUri = new URL(uriValue, baseUrl).href;
            return `URI="${proxyEndpoint}?url=${encodeURIComponent(absoluteUri)}"`;
          } catch {
            return `URI="${uriValue}"`;
          }
        });
      }
      return line;
    }

    try {
      const absoluteUri = new URL(trimmed, baseUrl).href;
      return `${proxyEndpoint}?url=${encodeURIComponent(absoluteUri)}`;
    } catch {
      return line;
    }
  });

  return rewritten.join("\n");
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}

export async function HEAD(request: NextRequest) {
  return handleProxyRequest(request, "HEAD");
}

export async function GET(request: NextRequest) {
  return handleProxyRequest(request, "GET");
}

async function handleProxyRequest(request: NextRequest, method: "GET" | "HEAD") {
  const { searchParams } = new URL(request.url);
  const targetUrl = searchParams.get("url");

  if (!targetUrl) {
    return NextResponse.json(
      { error: "Missing required query parameter: url" },
      { status: 400, headers: CORS_HEADERS }
    );
  }

  let parsedTarget: URL;
  try {
    parsedTarget = new URL(targetUrl);
    if (parsedTarget.protocol !== "http:" && parsedTarget.protocol !== "https:") {
      throw new Error("Invalid protocol");
    }
  } catch {
    return NextResponse.json(
      { error: "Invalid URL provided. Only http:// and https:// streams are supported." },
      { status: 400, headers: CORS_HEADERS }
    );
  }

  if (isPrivateOrLocalHost(parsedTarget.hostname)) {
    return NextResponse.json(
      { error: "Access to private or local networks is forbidden." },
      { status: 403, headers: CORS_HEADERS }
    );
  }

  // Build upstream request headers. Forward Range and omit browser Origin/Referer (VLC emulation).
  const upstreamHeaders: Record<string, string> = {
    "user-agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    accept: "*/*",
    "accept-encoding": "identity",
  };

  const clientRange = request.headers.get("range");
  if (clientRange) {
    upstreamHeaders["range"] = clientRange;
  }

  try {
    const upstreamRes = await fetch(parsedTarget.href, {
      method,
      headers: upstreamHeaders,
      redirect: "follow",
    });

    const contentType = upstreamRes.headers.get("content-type") || "";
    const isM3u8Extension = parsedTarget.pathname.toLowerCase().endsWith(".m3u8");

    // Check if the response is an HLS playlist
    const isHls =
      isM3u8Extension ||
      contentType.includes("application/vnd.apple.mpegurl") ||
      contentType.includes("application/x-mpegurl") ||
      contentType.includes("audio/x-mpegurl");

    if (method === "GET" && isHls) {
      const manifestText = await upstreamRes.text();
      if (manifestText.trim().startsWith("#EXTM3U") || isM3u8Extension) {
        const proxyEndpoint = "/api/stream/proxy";
        const finalBaseUrl = upstreamRes.url || parsedTarget.href;
        const rewrittenManifest = rewriteHlsPlaylist(manifestText, finalBaseUrl, proxyEndpoint);

        return new Response(rewrittenManifest, {
          status: 200,
          headers: {
            ...CORS_HEADERS,
            "Content-Type": "application/vnd.apple.mpegurl; charset=utf-8",
            "Cache-Control": "no-cache, no-store, must-revalidate",
            Pragma: "no-cache",
            Expires: "0",
          },
        });
      }
    }

    // Stream binary video/audio chunks (MP4, TS, WebM, AAC)
    const responseHeaders = new Headers();
    for (const [key, val] of Object.entries(CORS_HEADERS)) {
      responseHeaders.set(key, val);
    }

    // Pass through essential headers
    const forwardHeader = (name: string, fallback?: string) => {
      const val = upstreamRes.headers.get(name) || fallback;
      if (val) responseHeaders.set(name, val);
    };

    // Deduce accurate Content-Type for browser video engines
    const upstreamContentType = upstreamRes.headers.get("content-type");
    let effectiveContentType = upstreamContentType;
    if (
      !effectiveContentType ||
      effectiveContentType === "application/octet-stream" ||
      effectiveContentType === "text/plain" ||
      effectiveContentType === "binary/octet-stream"
    ) {
      const ext = parsedTarget.pathname.split(".").pop()?.toLowerCase();
      if (ext === "m3u8") effectiveContentType = "application/vnd.apple.mpegurl";
      else if (ext === "ts") effectiveContentType = "video/mp2t";
      else if (ext === "mp4" || ext === "m4v" || ext === "m4s") effectiveContentType = "video/mp4";
      else if (ext === "webm") effectiveContentType = "video/webm";
      else if (ext === "mkv") effectiveContentType = "video/x-matroska";
      else if (ext === "mp3") effectiveContentType = "audio/mpeg";
      else if (ext === "aac") effectiveContentType = "audio/aac";
      else if (ext === "ogg") effectiveContentType = "video/ogg";
      else effectiveContentType = isM3u8Extension ? "application/vnd.apple.mpegurl" : "video/mp4";
    }
    responseHeaders.set("content-type", effectiveContentType);

    forwardHeader("content-length");
    forwardHeader("content-range");
    forwardHeader("accept-ranges", "bytes");
    forwardHeader("last-modified");
    forwardHeader("etag");

    responseHeaders.set("Cache-Control", "public, max-age=3600");

    if (method === "HEAD") {
      return new Response(null, {
        status: upstreamRes.status,
        headers: responseHeaders,
      });
    }

    return new Response(upstreamRes.body, {
      status: upstreamRes.status,
      headers: responseHeaders,
    });
  } catch (err: any) {
    console.error("[StreamProxy] Fetch error for", targetUrl, err?.message || err);
    return NextResponse.json(
      {
        error: "Failed to connect to stream source. Verify the URL is reachable and publicly accessible.",
        details: err?.message || "Upstream fetch error",
      },
      { status: 502, headers: CORS_HEADERS }
    );
  }
}
