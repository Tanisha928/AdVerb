import { describe, it, expect } from "vitest";
import { DEMO_USERS } from "@/lib/demoUsers";

describe("DEMO_USERS", () => {
  it("contains exactly 5 users", () => {
    expect(DEMO_USERS).toHaveLength(5);
  });

  it("each user has id, name, and interests", () => {
    for (const user of DEMO_USERS) {
      expect(user.id).toBeTruthy();
      expect(user.name).toBeTruthy();
      expect(Array.isArray(user.interests)).toBe(true);
      expect(user.interests.length).toBeGreaterThan(0);
    }
  });

  it("all user ids are unique", () => {
    const ids = DEMO_USERS.map((u) => u.id);
    expect(new Set(ids).size).toBe(DEMO_USERS.length);
  });

  it("Alex Rivera has coffee, tech, travel interests", () => {
    const alex = DEMO_USERS.find((u) => u.name === "Alex Rivera");
    expect(alex).toBeDefined();
    expect(alex!.interests).toEqual(["coffee", "tech", "travel"]);
  });

  it("Jordan Lee has fitness, gaming, food interests", () => {
    const jordan = DEMO_USERS.find((u) => u.name === "Jordan Lee");
    expect(jordan).toBeDefined();
    expect(jordan!.interests).toEqual(["fitness", "gaming", "food"]);
  });

  it("Sam Patel has beauty, fashion, travel interests", () => {
    const sam = DEMO_USERS.find((u) => u.name === "Sam Patel");
    expect(sam).toBeDefined();
    expect(sam!.interests).toContain("beauty");
    expect(sam!.interests).toContain("fashion");
  });

  it("user IDs follow expected UUID-like format", () => {
    for (const user of DEMO_USERS) {
      expect(user.id).toMatch(/^[0-9a-f-]{36}$/i);
    }
  });
});
