import dns from "node:dns/promises";
import { isIP } from "node:net";

type ResolvedAddress = {
  address: string;
  family: 4 | 6;
};

const nonPublicIpv4Cidrs = [
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
] as const;

const nonPublicIpv6Cidrs = [
  ["::", 128],
  ["::1", 128],
  ["64:ff9b:1::", 48],
  ["100::", 64],
  ["2001:2::", 48],
  ["2001:10::", 28],
  ["2001:20::", 28],
  ["2001:db8::", 32],
  ["fc00::", 7],
  ["fe80::", 10],
  ["fec0::", 10],
  ["ff00::", 8],
] as const;

function normalizeIp(address: string): string {
  const mappedIpv4 = address.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  if (mappedIpv4) return mappedIpv4[1];
  const mappedHex = address.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i);
  if (mappedHex) {
    const upper = Number.parseInt(mappedHex[1], 16);
    const lower = Number.parseInt(mappedHex[2], 16);
    return [
      (upper >> 8) & 0xff,
      upper & 0xff,
      (lower >> 8) & 0xff,
      lower & 0xff,
    ].join(".");
  }
  return address;
}

export function isIpLiteral(value: string): boolean {
  return isIP(value.replace(/^\[|\]$/g, "")) !== 0;
}

function parseIpv4(address: string): number | null {
  const parts = address.split(".");
  if (parts.length !== 4) return null;
  let value = 0;
  for (const part of parts) {
    if (!/^\d+$/.test(part)) return null;
    const octet = Number(part);
    if (octet < 0 || octet > 255) return null;
    value = (value << 8) | octet;
  }
  return value >>> 0;
}

function expandIpv6(address: string): string[] | null {
  const lower = address.toLowerCase();
  if (lower.includes(":::")) return null;
  const [head, tail] = lower.split("::");
  const headParts = head ? head.split(":").filter(Boolean) : [];
  const tailParts = tail ? tail.split(":").filter(Boolean) : [];
  if (!lower.includes("::") && headParts.length !== 8) return null;
  if (headParts.length + tailParts.length > 8) return null;
  const fill = new Array(8 - headParts.length - tailParts.length).fill("0");
  const parts = lower.includes("::")
    ? [...headParts, ...fill, ...tailParts]
    : headParts;
  if (parts.length !== 8 || parts.some((part) => !/^[0-9a-f]{1,4}$/.test(part))) return null;
  return parts;
}

function parseIpv6(address: string): bigint | null {
  const parts = expandIpv6(address);
  if (!parts) return null;
  let value = 0n;
  for (const part of parts) {
    value = (value << 16n) | BigInt(`0x${part}`);
  }
  return value;
}

function isIpv4InCidr(address: string, network: string, prefix: number): boolean {
  const ip = parseIpv4(address);
  const base = parseIpv4(network);
  if (ip === null || base === null) return false;
  const mask = prefix === 0 ? 0 : ((0xffffffff << (32 - prefix)) >>> 0);
  return (ip & mask) === (base & mask);
}

function isIpv6InCidr(address: string, network: string, prefix: number): boolean {
  const ip = parseIpv6(address);
  const base = parseIpv6(network);
  if (ip === null || base === null) return false;
  const mask = prefix === 0 ? 0n : (((1n << BigInt(prefix)) - 1n) << BigInt(128 - prefix));
  return (ip & mask) === (base & mask);
}

export function isPublicIp(address: string): boolean {
  const normalized = normalizeIp(address);
  const family = isIP(normalized);
  if (!family) return false;
  return family === 4
    ? !nonPublicIpv4Cidrs.some(([network, prefix]) => isIpv4InCidr(normalized, network, prefix))
    : !nonPublicIpv6Cidrs.some(([network, prefix]) => isIpv6InCidr(normalized, network, prefix));
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
