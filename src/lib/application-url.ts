const HTTP_PROTOCOLS = new Set(["http:", "https:"]);

/**
 * Builds a browser-facing application URL.
 *
 * Behind Komodo's reverse proxy, Next.js can see request.url as
 * https://0.0.0.0:3000 even though the browser used the public hostname.
 * NEXTAUTH_URL is already the canonical public application address, so it
 * must win when redirects and Hub return URLs are generated.
 */
export function applicationUrl(path: string, requestUrl: string): URL {
  const configuredBase =
    process.env.NEXTAUTH_URL?.trim() || process.env.AUTH_URL?.trim();
  const base = new URL(configuredBase || requestUrl);

  if (!HTTP_PROTOCOLS.has(base.protocol)) {
    throw new Error("The application URL must use HTTP or HTTPS");
  }

  return new URL(path, `${base.origin}/`);
}
