/**
 * Resolve Bandcamp track/album art image URL from a Bandcamp page URL.
 * Used at build time when a chant has bandcampUrl but no bandcampArtImage.
 * Extracts og:image from the page HTML so the editor doesn't need to manage the image.
 */

const OG_IMAGE_RE =
  /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']|content=["']([^"']+)["'][^>]+property=["']og:image["']/i;

/**
 * Fetches the Bandcamp page and returns the og:image URL if present.
 * Returns undefined on failure or if no og:image is found.
 */
export async function getBandcampArtUrl(pageUrl: string): Promise<string | undefined> {
  try {
    const res = await fetch(pageUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; SacredChants/1.0; +https://github.com/sraphaz)',
      },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return undefined;
    const html = await res.text();
    const match = html.match(OG_IMAGE_RE);
    if (!match) return undefined;
    const url = match[1] ?? match[2];
    return url ? String(url).trim() : undefined;
  } catch {
    return undefined;
  }
}
