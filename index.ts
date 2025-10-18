import { DateTime, IANAZone, Interval } from "luxon";

// -------------------------
// Types
// -------------------------
export type ZoneId = string; // IANA zone id like "Asia/Ho_Chi_Minh"

export type OffsetPreference = "earlier" | "later";

export type Recurrence =
  | { freq: "DAILY"; at: { hour: number; minute?: number; second?: number } }
  | {
      freq: "WEEKLY";
      byWeekday: number[]; // 0=Sun ... 6=Sat
      at: { hour: number; minute?: number; second?: number };
    };

export interface BusinessHours {
  /** "HH:mm" 24h, local wall-time in the target zone */
  start: string;
  /** "HH:mm" 24h, local wall-time in the target zone */
  end: string;
  /** Optional ISO weekday numbers permitted; omit for all days */
  weekdays?: number[]; // 1=Mon ... 7=Sun (ISO)
}

// -------------------------
// Zone helpers
// -------------------------
export function assertZone(zone: ZoneId): asserts zone is ZoneId {
  const ok = IANAZone.isValidZone(zone);
  if (!ok) {
    throw new Error(`Invalid IANA time zone: ${zone}`);
  }
}

// -------------------------
// Parsing & conversion
// -------------------------
/**
 * Parse a local wall-time string (e.g., "2025-10-18T09:00:00") with an IANA zone.
 * Returns a Luxon DateTime in that zone, with keepLocalTime semantics.
 * NOTE: The returned DateTime may be invalid if the local time is inside a spring DST gap.
 */
export function parseLocal(localISO: string, zone: ZoneId): DateTime {
  assertZone(zone);
  // Accepts extended ISO without explicit offset.
  // Parse as local time in the specified zone
  return DateTime.fromISO(localISO, { zone });
}

/** Convert a local wall-time to a UTC JS Date, throwing on invalid local times. */
export function toUTCFromLocal(localISO: string, zone: ZoneId, opts?: { onAmbiguous?: OffsetPreference }): Date {
  const dt = parseLocal(localISO, zone);
  if (!dt.isValid) {
    throw new Error(`Non-existent local time in ${zone}: ${localISO} (${dt.invalidReason})`);
  }
  // Handle fall-back overlap by choosing earlier/later offset deterministically
  const chosen = chooseOffset(localISO, zone, opts?.onAmbiguous ?? "earlier");
  return chosen.toUTC().toJSDate();
}

/** Convert an instant (UTC-based) to a DateTime in a target zone. */
export function convertZone(instant: Date | string | number, zone: ZoneId): DateTime {
  assertZone(zone);
  const dt = typeof instant === "string"
    ? DateTime.fromISO(instant, { zone: "utc" })
    : DateTime.fromJSDate(new Date(instant), { zone: "utc" });
  return dt.setZone(zone);
}

// -------------------------
// DST diagnostics
// -------------------------
/** True if the provided local wall-time never occurs (spring forward). */
export function isInvalidLocalTime(localISO: string, zone: ZoneId): boolean {
  const dt = parseLocal(localISO, zone);
  return !dt.isValid && dt.invalidReason === "unsupported zone" ? true : !dt.isValid;
}

/** True if the provided local wall-time is ambiguous (occurs twice on fall back). */
export function isAmbiguousLocalTime(localISO: string, zone: ZoneId): boolean {
  assertZone(zone);
  // Strategy: compute offsets around the minute; if two distinct offsets map to same wall-time, it's ambiguous.
  const a = DateTime.fromISO(localISO, { zone });
  if (!a.isValid) return false; // invalid ≠ ambiguous
  // Try forcing earlier vs later offset by shifting a minute to see offset change pattern
  const before = a.minus({ minutes: 30 }).offset;
  const after = a.plus({ minutes: 30 }).offset;
  // Ambiguity typically shows an offset increase after fall-back within a short window.
  return before !== after && a.offset === after; // heuristic works well for fall-back overlaps
}

/**
 * Choose concrete instant for an ambiguous local time.
 * If time is not ambiguous, returns the unique mapping.
 */
export function chooseOffset(localISO: string, zone: ZoneId, pref: OffsetPreference = "earlier"): DateTime {
  const dt = parseLocal(localISO, zone);
  if (!dt.isValid) return dt; // invalid — let caller decide

  // For ambiguous times, probe nearby instants to find both possible mappings
  const baseTime = DateTime.fromISO(localISO);
  const earlier = DateTime.fromObject({
    year: baseTime.year,
    month: baseTime.month,
    day: baseTime.day,
    hour: baseTime.hour,
    minute: baseTime.minute,
    second: baseTime.second ?? 0,
    millisecond: 0,
  }, { zone }).minus({ minutes: 1 }).toUTC();
  
  const later = DateTime.fromObject({
    year: baseTime.year,
    month: baseTime.month,
    day: baseTime.day,
    hour: baseTime.hour,
    minute: baseTime.minute,
    second: baseTime.second ?? 0,
    millisecond: 0,
  }, { zone }).plus({ minutes: 1 }).toUTC();

  // Map back to the exact wall clock using earlier/later surrounding instants
  const candidateEarlier = earlier.setZone(zone).set({
    hour: baseTime.hour,
    minute: baseTime.minute,
    second: baseTime.second ?? 0,
    millisecond: 0,
  });
  const candidateLater = later.setZone(zone).set({
    hour: baseTime.hour,
    minute: baseTime.minute,
    second: baseTime.second ?? 0,
    millisecond: 0,
  });

  // Pick the one whose offset aligns with our preference
  const chosen = pref === "earlier" ? (candidateEarlier < candidateLater ? candidateEarlier : candidateLater)
                                    : (candidateEarlier > candidateLater ? candidateEarlier : candidateLater);
  return chosen;
}

// -------------------------
// Range normalization (local → UTC interval)
// -------------------------
export function rangeToUTC(
  startLocalISO: string,
  endLocalISO: string,
  zone: ZoneId,
  opts?: { ambiguous?: OffsetPreference }
): { startUTC: string; endUTC: string; interval: Interval } {
  const start = chooseOffset(startLocalISO, zone, opts?.ambiguous ?? "earlier");
  const end = chooseOffset(endLocalISO, zone, opts?.ambiguous ?? "earlier");
  if (!start.isValid) throw new Error(`Invalid start: ${start.invalidReason}`);
  if (!end.isValid) throw new Error(`Invalid end: ${end.invalidReason}`);
  const s = start.toUTC();
  const e = end.toUTC();
  if (+e <= +s) throw new Error("End must be after start (consider DST overlap?)");
  const interval = Interval.fromDateTimes(s, e);
  return { startUTC: s.toISO()!, endUTC: e.toISO()!, interval };
}

// -------------------------
// Simple recurrence scheduling (next occurrence in zone → UTC)
// -------------------------
export function nextOccurrence(fromUTC: Date | string | number, zone: ZoneId, rule: Recurrence): Date {
  assertZone(zone);
  const base = typeof fromUTC === "string"
    ? DateTime.fromISO(fromUTC, { zone: "utc" })
    : DateTime.fromJSDate(new Date(fromUTC), { zone: "utc" });
  let cursorLocal = base.setZone(zone);

  const at = (h: number, m = 0, s = 0) => ({ hour: h, minute: m, second: s, millisecond: 0 });

  if (rule.freq === "DAILY") {
    const t = at(rule.at.hour, rule.at.minute ?? 0, rule.at.second ?? 0);
    let candidate = cursorLocal.set(t);
    if (candidate <= cursorLocal) candidate = candidate.plus({ days: 1 });
    // Handle invalid/ambiguous local times
    const chosen = chooseOffset(candidate.toISO({ suppressMilliseconds: true })!, zone, "earlier");
    return chosen.toUTC().toJSDate();
  }

  // WEEKLY
  const weekdays = new Set(rule.byWeekday);
  for (let i = 0; i < 14; i++) { // look ahead up to 2 weeks
    const cand = cursorLocal.plus({ days: i });
    if (weekdays.has(cand.weekday % 7)) {
      const t = at(rule.at.hour, rule.at.minute ?? 0, rule.at.second ?? 0);
      let candidate = cand.set(t);
      if (candidate <= cursorLocal) continue; // same day but already passed
      const chosen = chooseOffset(candidate.toISO({ suppressMilliseconds: true })!, zone, "earlier");
      return chosen.toUTC().toJSDate();
    }
  }
  throw new Error("No matching weekday found in 2-week window (check rule)");
}

// -------------------------
// Business-hours check (instant in UTC → in-hours? in zone)
// -------------------------
export function isWithinBusinessHours(instantUTC: Date | string | number, zone: ZoneId, bh: BusinessHours): boolean {
  assertZone(zone);
  const dt = typeof instantUTC === "string"
    ? DateTime.fromISO(instantUTC, { zone: "utc" })
    : DateTime.fromJSDate(new Date(instantUTC), { zone: "utc" });
  const local = dt.setZone(zone);

  if (bh.weekdays && bh.weekdays.length > 0) {
    const iso = local.weekday; // 1..7
    if (!bh.weekdays.includes(iso)) return false;
  }

  const [sh, sm] = bh.start.split(":" ).map(Number);
  const [eh, em] = bh.end.split(":" ).map(Number);
  const start = local.set({ hour: sh, minute: sm || 0, second: 0, millisecond: 0 });
  const end = local.set({ hour: eh, minute: em || 0, second: 0, millisecond: 0 });

  // Use earlier offset if ambiguous — business rules typically prefer opening at earlier instant
  const sChosen = chooseOffset(start.toISO({ suppressMilliseconds: true })!, zone, "earlier");
  const eChosen = chooseOffset(end.toISO({ suppressMilliseconds: true })!, zone, "later");

  return +local >= +sChosen && +local < +eChosen;
}

// -------------------------
// Formatting
// -------------------------
export function formatZoned(instantUTC: Date | string | number, zone: ZoneId, fmt = "yyyy-LL-dd HH:mm ZZZZ"): string {
  const dt = convertZone(instantUTC, zone);
  return dt.toFormat(fmt);
}

// -------------------------
// Safe parsing helpers
// -------------------------
export function mustValid(dt: DateTime, ctx: string): DateTime {
  if (!dt.isValid) throw new Error(`${ctx}: ${dt.invalidReason} (${dt.invalidExplanation})`);
  return dt;
}

// -------------------------
// Example edge-case table (for tests)
// -------------------------
export const EdgeCases = {
  // These are realistic examples - Luxon handles DST automatically
  // We'll test with times that are actually problematic
  springGapNYC: { local: "2024-03-10T02:30:00", zone: "America/New_York" }, // Spring forward
  fallOverlapNYC: { local: "2024-11-03T01:30:00", zone: "America/New_York" }, // Fall back
};
