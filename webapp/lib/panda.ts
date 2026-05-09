/**
 * Panda Video helper. The Panda embed accepts a public iframe URL like
 *   https://player-{LIBRARY}.tv.pandavideo.com.br/embed/?v={VIDEO_ID}
 * For private libraries, Panda offers signed URLs (token in query string).
 * We expose a single helper used by API routes; client never sees the API key.
 */

export interface PandaEmbedConfig {
  videoId: string;
  libraryId?: string;
}

export function buildPandaEmbedUrl(cfg: PandaEmbedConfig): string {
  const lib = cfg.libraryId ?? process.env.PANDA_LIBRARY_ID;
  if (!lib) throw new Error("PANDA_LIBRARY_ID not configured");
  return `https://player-${lib}.tv.pandavideo.com.br/embed/?v=${encodeURIComponent(cfg.videoId)}`;
}

/**
 * Optional: return a short-lived token for protected videos. Panda returns
 * tokens via the API endpoint /videos/{id}. Wire this when you turn on
 * "video signed URLs" in the Panda dashboard.
 */
export async function fetchPandaSignedUrl(videoId: string): Promise<string> {
  // Placeholder until signed URLs are activated; falls back to embed URL.
  return buildPandaEmbedUrl({ videoId });
}
