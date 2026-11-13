/** Transport policy for an AirGap deployment that has no internal TLS yet. */

/**
 * True for a host literal that can only resolve inside an administered network.
 * @param hostname - `URL.hostname`, which keeps IPv6 brackets.
 * @returns Whether plain HTTP to this host stays off the public internet.
 */
export function isIntranetHostname(hostname: string): boolean

/**
 * Accept HTTPS everywhere, and HTTP only when the host is intranet-only.
 * @param parsed - Candidate URL.
 * @returns Whether the transport is acceptable.
 */
export function secureOrIntranetTransport(parsed: URL): boolean