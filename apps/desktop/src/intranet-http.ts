/** Transport policy for an AirGap deployment that has no internal TLS yet. */

/**
 * True for a host literal that can only resolve inside an administered network:
 * loopback, RFC 1918, CGNAT/tailnet `100.64.0.0/10`, IPv6 link-local/unique-local,
 * `.local`/`.lan`, or a single-label DNS name (the usual `http://airgap:8080`
 * on an offline switch).
 * @param hostname - `URL.hostname`, which keeps IPv6 brackets.
 * @returns whether plain HTTP to this host stays off the public internet.
 */
export function isIntranetHostname(hostname: string): boolean {
  const host = hostname.toLowerCase()
  if (host === 'localhost' || host === '127.0.0.1' || host === '[::1]' || host === '::1') return true
  if (host.startsWith('[')) {
    // [::1] handled above; fe80::/10 link-local and fc00::/7 unique-local.
    return /^\[(?:fe[89ab][0-9a-f]|f[cd])/u.test(host)
  }
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/u.test(host)) {
    const [a, b] = host.split('.').map(Number)
    return a === 10
      || (a === 172 && b !== undefined && b >= 16 && b <= 31)
      || (a === 192 && b === 168)
      || (a === 100 && b !== undefined && b >= 64 && b <= 127)
      || (a === 169 && b === 254)
      || a === 127
  }
  if (host.endsWith('.local') || host.endsWith('.lan') || host.endsWith('.internal')) return true
  // A single label has no public suffix, so a public resolver cannot answer it.
  return !host.includes('.')
}

/**
 * Accept HTTPS everywhere, and HTTP only when the host is intranet-only.
 * @param parsed - Candidate URL.
 * @returns whether the transport is acceptable.
 */
export function secureOrIntranetTransport(parsed: URL): boolean {
  return parsed.protocol === 'https:'
    || (parsed.protocol === 'http:' && isIntranetHostname(parsed.hostname))
}
