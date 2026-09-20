import dns from "node:dns/promises";
import { BlockList, isIP } from "node:net";

type ResolvedAddress = {
  address: string;
  family: 4 | 6;
};

const nonPublicRanges = new BlockList();

for (const [network, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const) {
  nonPublicRanges.addSubnet(network, prefix, "ipv4");
}

for (const [network, prefix] of [
  ["::", 128],
  ["::1", 128],
  ["100::", 64],
  ["2001:2::", 48],
  ["2001:db8::", 32],
  ["fc00::", 7],
  ["fe80::", 10],
  ["ff00::", 8],
] as const) {
  nonPublicRanges.addSubnet(network, prefix, "ipv6");
}

function normalizeIp(address: string): string {
  return address.startsWith("::ffff:") ? address.slice(7) : address;
}

export function isIpLiteral(value: string): boolean {
  return isIP(value.replace(/^\[|\]$/g, "")) !== 0;
}

export function isPublicIp(address: string): boolean {
  const normalized = normalizeIp(address);
  const family = isIP(normalized);
  if (!family) return false;
  return !nonPublicRanges.check(normalized, family === 4 ? "ipv4" : "ipv6");
}

export function selectPublicAddress(addresses: ResolvedAddress[]): ResolvedAddress | null {
  for (const entry of addresses) {
    const address = normalizeIp(entry.address);
    const family = isIP(address);
    if (!family || !isPublicIp(address)) continue;
    return { address, family: family as 4 | 6 };
  }
  return null;
}

export async function resolvePublicAddress(hostname: string): Promise<ResolvedAddress | null> {
  if (isIpLiteral(hostname)) return null;
  try {
    const resolved = await dns.lookup(hostname, { all: true, verbatim: true });
    return selectPublicAddress(
      resolved.map((entry) => ({
        address: entry.address,
        family: entry.family as 4 | 6,
      }))
    );
  } catch {
    return null;
  }
}
