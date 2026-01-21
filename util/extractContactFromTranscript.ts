import * as chrono from "chrono-node";

const TIMEZONE_OFFSETS: Record<string, number> = {
  "central time": -6,
  "ct": -6,
  "cst": -6,
  "cst/cdt": -6,
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

export function extractContactFromTranscript({
  transcript,
  phoneFromPayload,
  endedReasonFromPayload,
}: {
  transcript: string;
  phoneFromPayload?: string;
  endedReasonFromPayload?: string;
}) {
  let email: string | null = null;
  let phone: string | null = null;
  let bookingDate: Date | null = null;

  // --- EMAIL ---
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

  // --- PHONE ---
  if (phoneFromPayload) {
    const cleaned = phoneFromPayload.replace(/[^\d+]/g, "");
    if (cleaned.startsWith("+") && cleaned.length >= 10) {
      phone = cleaned;
    }
  }

  const endedReason = endedReasonFromPayload || null;

  // --- BOOKING TIME ---
  // Example phrase:
  // "You're all set for Wednesday at seven PM central time"
  const bookingRegex =
    /(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\s+at\s+([\w: ]+?(?:am|pm))\s+(central|mountain|pacific|eastern)\s*time/i;

  const match = transcript.match(bookingRegex);

  if (match) {
    const [, weekday, time, timezoneRaw] = match;

    const timezoneKey = `${timezoneRaw.toLowerCase()} time`;
    const tzOffset = TIMEZONE_OFFSETS[timezoneKey] ?? -6;

    const naturalPhrase = `${weekday} at ${time}`;

    const parsed = chrono.parseDate(naturalPhrase, new Date(), {
      forwardDate: true,
    });

    if (parsed) {
      // Convert parsed local time to UTC manually
      const utcDate = new Date(
        Date.UTC(
          parsed.getFullYear(),
          parsed.getMonth(),
          parsed.getDate(),
          parsed.getHours() - tzOffset,
          parsed.getMinutes()
        )
      );

      bookingDate = utcDate;
    }
  }

  return { email, phone, endedReason, bookingDate };
}
