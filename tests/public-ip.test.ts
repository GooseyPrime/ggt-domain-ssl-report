import { describe, expect, it } from "vitest";
import { isPublicIp, selectPublicAddress } from "@/lib/public-ip";

describe("public IP policy", () => {
  it("rejects non-public IP ranges", () => {
    expect(isPublicIp("127.0.0.1")).toBe(false);
    expect(isPublicIp("192.168.0.10")).toBe(false);
    expect(isPublicIp("169.254.169.254")).toBe(false);
    expect(isPublicIp("::1")).toBe(false);
    expect(isPublicIp("fc00::1")).toBe(false);
  });

  it("keeps public addresses available for pinning", () => {
    expect(isPublicIp("93.184.216.34")).toBe(true);
    expect(
      selectPublicAddress([
        { address: "127.0.0.1", family: 4 },
        { address: "93.184.216.34", family: 4 },
      ])
    ).toEqual({
      address: "93.184.216.34",
      family: 4,
    });
  });
});
