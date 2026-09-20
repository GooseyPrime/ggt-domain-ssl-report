import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  resolvePublicAddress: vi.fn(),
  connect: vi.fn(),
}));

vi.mock("@/lib/public-ip", () => ({
  resolvePublicAddress: mocks.resolvePublicAddress,
}));

vi.mock("node:tls", () => ({
  default: {
    connect: mocks.connect,
  },
}));

import { fetchTls } from "@/lib/tls";

describe("fetchTls", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the requested host result without silently falling back to www", async () => {
    mocks.resolvePublicAddress.mockResolvedValue({ address: "93.184.216.34", family: 4 });
    mocks.connect.mockImplementation((opts: { host: string }, onSecure: () => void) => {
      const handlers: Record<string, ((value?: unknown) => void) | undefined> = {};
      const socket = {
        getPeerCertificate: () => ({
          subjectaltname: "",
          valid_to: "",
          valid_from: "",
          issuer: { CN: "Example CA" },
          subject: { CN: opts.host },
        }),
        on: (event: string, handler: (value?: unknown) => void) => {
          handlers[event] = handler;
          return socket;
        },
        end: vi.fn(),
        destroy: vi.fn(),
      };
      queueMicrotask(onSecure);
      return socket;
    });

    const result = await fetchTls("example.com");

    expect(mocks.resolvePublicAddress).toHaveBeenCalledTimes(1);
    expect(mocks.connect).toHaveBeenCalledTimes(1);
    expect(result.notAfter).toBeNull();
    expect(result.subject).toBe("93.184.216.34");
  });
});
