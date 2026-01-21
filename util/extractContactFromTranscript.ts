/* eslint-disable @typescript-eslint/no-unused-vars */

const WEEKDAYS: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

const NUMBER_WORDS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
};
const MINUTE_WORDS: Record<string, number> = {
  zero: 0,
  fifteen: 15,
  thirty: 30,
  forty: 40,
  fortyfive: 45,
  forty_five: 45,
};

const TIMEZONE_OFFSETS: Record<string, number> = {
  "central time": -6,
  "ct": -6,
  "cst": -6,
  "mountain time": -7,
  "mt": -7,
  "mst": -7,
  "pacific time": -8,
  "pt": -8,
  "pst": -8,
  "eastern time": -5,
  "et": -5,
  "est": -5,
};

/**
 * Returns the closest upcoming occurrence of a weekday
 * (today included if still in the future)
 */
function getClosestWeekday(targetDay: number, from: Date): Date {
  const date = new Date(from);
  const currentDay = date.getDay();

  let diff = targetDay - currentDay;
  if (diff < 0) diff += 7;

  date.setDate(date.getDate() + diff);
  return date;
}

export function extractContactFromTranscript({
  transcript,
  phoneFromPayload,
  endedReasonFromPayload,
  callEndedAt,
}: {
  transcript: string;
  phoneFromPayload?: string;
  endedReasonFromPayload?: string;
  callEndedAt?: Date;
}) {
  let email: string | null = null;
  let phone: string | null = null;
  let bookingDate: Date | null = null;

  const anchorDate = callEndedAt ?? new Date();

  /* ---------------- EMAIL ---------------- */

  const spokenEmailMatch = transcript.match(
    /([a-z0-9._%+-]+)\s*(?:at|@)\s*([a-z0-9.-]+)\s*(?:dot|\.)\s*([a-z]{2,})/i
  );

  if (spokenEmailMatch) {
    const [, user, domain, tld] = spokenEmailMatch;
    email = `${user}@${domain}.${tld}`.toLowerCase();
  } else {
    const standardEmailMatch = transcript.match(
      /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i
    );
    if (standardEmailMatch) {
      email = standardEmailMatch[0].toLowerCase();
    }
  }

  /* ---------------- PHONE ---------------- */

  if (phoneFromPayload) {
    const cleaned = phoneFromPayload.replace(/[^\d+]/g, "");
    if (cleaned.startsWith("+") && cleaned.length >= 10) {
      phone = cleaned;
    }
  }

  const endedReason = endedReasonFromPayload || null;

  /* ---------------- BOOKING ---------------- */

  /**
   * Example phrase:
   * "You're all set for Wednesday at seven PM central time"
   */
const bookingRegex =
  /(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\s+at\s+((?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)(?:\s+(?:fifteen|thirty|forty(?:\s?five)?))?\s*(?:am|pm))\s+(central|mountain|pacific|eastern)\s*time/i;

  const match = transcript.match(bookingRegex);

  if (match) {
    const [, weekdayRaw, timeRaw, timezoneRaw] = match;

    const weekday = weekdayRaw.toLowerCase();
    const timezoneKey = `${timezoneRaw.toLowerCase()} time`;
    const tzOffset = TIMEZONE_OFFSETS[timezoneKey] ?? -6;

    /* ---- Resolve Date ---- */
    const baseDate = getClosestWeekday(
      WEEKDAYS[weekday],
      anchorDate
    );

    /* ---- Parse Time ---- */
    const timeMatch = timeRaw.match(
      /(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)(?:\s+(fifteen|thirty|forty(?:\s?five)?))?\s*(am|pm)/i
    );

    if (timeMatch) {
      let hour = NUMBER_WORDS[timeMatch[1].toLowerCase()];
      const minuteWord = timeMatch[2]?.toLowerCase().replace(" ", "");
      const minutes = minuteWord ? MINUTE_WORDS[minuteWord] ?? 0 : 0;
      const meridian = timeMatch[3].toLowerCase();

      if (meridian === "pm" && hour !== 12) hour += 12;
      if (meridian === "am" && hour === 12) hour = 0;

      bookingDate = new Date(
        Date.UTC(
          baseDate.getFullYear(),
          baseDate.getMonth(),
          baseDate.getDate(),
          hour - tzOffset,
          minutes,
          0
        )
      );

      if (bookingDate <= anchorDate) {
        bookingDate.setUTCDate(bookingDate.getUTCDate() + 7);
      }
    }

  }

  return {
    email,
    phone,
    endedReason,
    bookingDate,
  };
}
