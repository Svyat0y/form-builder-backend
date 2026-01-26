import * as crypto from 'crypto';

/**
 * Generates unique device fingerprint based on User-Agent and IP address.
 * Uses first 2 octets of IP to determine subnet (privacy consideration).
 * @param userAgent User-Agent string from request header
 * @param ipAddress Client IP address
 * @returns SHA-256 hash of device fingerprint
 */
export function generateDeviceFingerprint(
  userAgent: string,
  ipAddress?: string,
): string {
  let ipSubnet = 'unknown';
  if (ipAddress) {
    const ipParts = ipAddress.split('.');
    if (ipParts.length >= 2) {
      ipSubnet = `${ipParts[0]}.${ipParts[1]}`;
    } else if (ipAddress.includes(':')) {
      const ipv6Parts = ipAddress.split(':');
      if (ipv6Parts.length >= 2) {
        ipSubnet = `${ipv6Parts[0]}:${ipv6Parts[1]}`;
      }
    }
  }

  const fingerprintData = `${userAgent}|${ipSubnet}`;

  return crypto.createHash('sha256').update(fingerprintData).digest('hex');
}
