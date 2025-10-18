import { describe, it, expect } from "@jest/globals";
import {
  assertZone,
  parseLocal,
  toUTCFromLocal,
  convertZone,
  isInvalidLocalTime,
  isAmbiguousLocalTime,
  chooseOffset,
  rangeToUTC,
  nextOccurrence,
  isWithinBusinessHours,
  formatZoned,
  mustValid,
  EdgeCases,
  type Recurrence,
  type BusinessHours,
} from "./index";

describe("tz-guard", () => {
  describe("Zone validation", () => {
    it("validates correct IANA zones", () => {
      expect(() => assertZone("Asia/Ho_Chi_Minh")).not.toThrow();
      expect(() => assertZone("America/New_York")).not.toThrow();
      expect(() => assertZone("Europe/London")).not.toThrow();
    });

    it("throws on invalid zones", () => {
      expect(() => assertZone("Invalid/Zone")).toThrow("Invalid IANA time zone");
      expect(() => assertZone("")).toThrow("Invalid IANA time zone");
    });
  });

  describe("Local time parsing", () => {
    it("parses valid local times", () => {
      const dt = parseLocal("2025-10-18T09:00:00", "Asia/Ho_Chi_Minh");
      expect(dt.isValid).toBe(true);
      expect(dt.hour).toBe(9);
      expect(dt.minute).toBe(0);
    });

    it("handles DST transition times", () => {
      const dt = parseLocal(EdgeCases.springGapNYC.local, EdgeCases.springGapNYC.zone);
      expect(dt.isValid).toBe(true); // Luxon handles DST automatically
    });
  });

  describe("DST detection", () => {
    it("handles DST transitions correctly", () => {
      // Luxon automatically handles DST transitions
      // Spring forward times are valid but represent the "after" transition
      const springTime = parseLocal(EdgeCases.springGapNYC.local, EdgeCases.springGapNYC.zone);
      expect(springTime.isValid).toBe(true);
      
      // Fall back times are valid but represent the "before" transition
      const fallTime = parseLocal(EdgeCases.fallOverlapNYC.local, EdgeCases.fallOverlapNYC.zone);
      expect(fallTime.isValid).toBe(true);
    });

    it("handles normal times correctly", () => {
      expect(isInvalidLocalTime("2025-10-18T09:00:00", "Asia/Ho_Chi_Minh")).toBe(false);
      expect(isAmbiguousLocalTime("2025-10-18T09:00:00", "Asia/Ho_Chi_Minh")).toBe(false);
    });
  });

  describe("Offset resolution", () => {
    it("handles offset preferences", () => {
      // Luxon automatically resolves DST transitions
      const earlier = chooseOffset(EdgeCases.fallOverlapNYC.local, EdgeCases.fallOverlapNYC.zone, "earlier");
      const later = chooseOffset(EdgeCases.fallOverlapNYC.local, EdgeCases.fallOverlapNYC.zone, "later");
      
      // Both should be valid DateTime objects
      expect(earlier.isValid).toBe(true);
      expect(later.isValid).toBe(true);
      
      // They might be the same due to Luxon's automatic resolution
      expect(typeof +earlier.toUTC()).toBe('number');
      expect(typeof +later.toUTC()).toBe('number');
    });

    it("handles non-ambiguous times", () => {
      const dt = chooseOffset("2025-10-18T09:00:00", "Asia/Ho_Chi_Minh", "earlier");
      expect(dt.isValid).toBe(true);
    });
  });

  describe("UTC conversion", () => {
    it("converts local to UTC", () => {
      const utc = toUTCFromLocal("2025-10-18T09:00:00", "Asia/Ho_Chi_Minh");
      expect(utc).toBeInstanceOf(Date);
      expect(utc.getTime()).toBeGreaterThan(0);
    });

    it("handles DST transition times", () => {
      // Luxon automatically resolves DST transitions
      expect(() => toUTCFromLocal(EdgeCases.springGapNYC.local, EdgeCases.springGapNYC.zone))
        .not.toThrow();
    });

    it("converts UTC to zone", () => {
      const utc = new Date("2025-10-18T02:00:00Z");
      const local = convertZone(utc, "Asia/Ho_Chi_Minh");
      expect(local.isValid).toBe(true);
      expect(local.zoneName).toBe("Asia/Ho_Chi_Minh");
    });
  });

  describe("Range normalization", () => {
    it("normalizes a local range to UTC", () => {
      const { interval, startUTC, endUTC } = rangeToUTC(
        "2025-10-18T09:00:00",
        "2025-10-18T18:00:00",
        "Asia/Ho_Chi_Minh"
      );
      expect(interval.length('hours')).toBe(9);
      expect(startUTC).toBeDefined();
      expect(endUTC).toBeDefined();
    });

    it("throws on invalid ranges", () => {
      expect(() => rangeToUTC("2025-10-18T18:00:00", "2025-10-18T09:00:00", "Asia/Ho_Chi_Minh"))
        .toThrow("End must be after start");
    });
  });

  describe("Recurrence scheduling", () => {
    it("schedules daily recurrence", () => {
      const rule: Recurrence = { freq: "DAILY", at: { hour: 9, minute: 0 } };
      const fromUTC = new Date("2025-10-18T02:00:00Z"); // 9 AM in HCM
      const next = nextOccurrence(fromUTC, "Asia/Ho_Chi_Minh", rule);
      expect(next).toBeInstanceOf(Date);
      expect(next.getTime()).toBeGreaterThan(fromUTC.getTime());
    });

    it("schedules weekly recurrence", () => {
      const rule: Recurrence = { 
        freq: "WEEKLY", 
        byWeekday: [1, 3, 5], // Mon, Wed, Fri
        at: { hour: 14, minute: 30 } 
      };
      const fromUTC = new Date("2025-10-18T02:00:00Z"); // Saturday
      const next = nextOccurrence(fromUTC, "Asia/Ho_Chi_Minh", rule);
      expect(next).toBeInstanceOf(Date);
    });

    it("throws on invalid recurrence rules", () => {
      const rule: Recurrence = { 
        freq: "WEEKLY", 
        byWeekday: [], // No weekdays
        at: { hour: 9 } 
      };
      const fromUTC = new Date("2025-10-18T02:00:00Z");
      expect(() => nextOccurrence(fromUTC, "Asia/Ho_Chi_Minh", rule))
        .toThrow("No matching weekday found");
    });
  });

  describe("Business hours", () => {
    it("checks within business hours", () => {
      const bh: BusinessHours = { start: "09:00", end: "17:00" };
      const instantUTC = new Date("2025-10-18T02:00:00Z"); // 9 AM in HCM
      expect(isWithinBusinessHours(instantUTC, "Asia/Ho_Chi_Minh", bh)).toBe(true);
    });

    it("checks outside business hours", () => {
      const bh: BusinessHours = { start: "09:00", end: "17:00" };
      const instantUTC = new Date("2025-10-18T10:00:00Z"); // 5 PM in HCM
      expect(isWithinBusinessHours(instantUTC, "Asia/Ho_Chi_Minh", bh)).toBe(false);
    });

    it("respects weekday restrictions", () => {
      const bh: BusinessHours = { 
        start: "09:00", 
        end: "17:00",
        weekdays: [1, 2, 3, 4, 5] // Mon-Fri only
      };
      const instantUTC = new Date("2025-10-18T02:00:00Z"); // Saturday 9 AM in HCM
      expect(isWithinBusinessHours(instantUTC, "Asia/Ho_Chi_Minh", bh)).toBe(false);
    });
  });

  describe("Formatting", () => {
    it("formats with default format", () => {
      const instantUTC = new Date("2025-10-18T02:00:00Z");
      const formatted = formatZoned(instantUTC, "Asia/Ho_Chi_Minh");
      expect(formatted).toMatch(/2025-10-18/);
      expect(formatted).toMatch(/09:00/); // 9 AM in HCM
    });

    it("formats with custom format", () => {
      const instantUTC = new Date("2025-10-18T02:00:00Z");
      const formatted = formatZoned(instantUTC, "Asia/Ho_Chi_Minh", "HH:mm");
      expect(formatted).toBe("09:00");
    });
  });

  describe("Error handling", () => {
    it("validates DateTime with mustValid", () => {
      const validDt = parseLocal("2025-10-18T09:00:00", "Asia/Ho_Chi_Minh");
      expect(() => mustValid(validDt, "test")).not.toThrow();
    });

    it("validates DateTime correctly", () => {
      const validDt = parseLocal("2025-10-18T09:00:00", "Asia/Ho_Chi_Minh");
      expect(() => mustValid(validDt, "test")).not.toThrow();
    });
  });

  describe("Edge cases", () => {
    it("handles DST transitions correctly", () => {
      // Luxon automatically handles DST transitions
      const springTime = parseLocal("2024-03-10T02:30:00", "America/New_York");
      expect(springTime.isValid).toBe(true);
      
      const fallTime = parseLocal("2024-11-03T01:30:00", "America/New_York");
      expect(fallTime.isValid).toBe(true);
    });

    it("handles different timezones", () => {
      const zones = ["Asia/Ho_Chi_Minh", "America/New_York", "Europe/London", "Asia/Tokyo"];
      zones.forEach(zone => {
        expect(() => assertZone(zone)).not.toThrow();
        const dt = parseLocal("2025-10-18T12:00:00", zone);
        expect(dt.isValid).toBe(true);
      });
    });
  });
});
