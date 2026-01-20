import * as chrono from "chrono-node";

export function extractContactFromTranscript({
  transcript,
  phoneFromPayload,
  endedReasonFromPayload,
}: {
  transcript: string;
  phoneFromPayload?: string;
  endedReasonFromPayload?: string;
}) {
  // --- Normalize email (spoken or standard) ---
  let email: string | null = null;

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

  // --- Normalize phone ---
  let phone: string | null = null;

  if (phoneFromPayload) {
    const cleaned = phoneFromPayload.replace(/[^\d+]/g, "");
    if (cleaned.startsWith("+") && cleaned.length >= 10) {
      phone = cleaned;
    }
  }

  // --- endedReason ---
  const endedReason = endedReasonFromPayload || null;

  // --- Extract booking date/time from AI confirmation ---
  // This assumes AI says something like:
  // "You're all set for the presentation on Thursday at five PM Arizona time."
  const bookingTimeRegex = /(?:all set for|scheduled for|appointment on)\s+([A-Za-z0-9: ,]+(?:AM|PM|am|pm)?(?:\s*[A-Z]{2,3})?)/i;
  const bookingMatch = transcript.match(bookingTimeRegex);
  let bookingDate: Date | null = null;

  if (bookingMatch) {
    // Use chrono-node to parse natural language date/time
    bookingDate = chrono.parseDate(bookingMatch[1]);
  }

  return { email, phone, endedReason, bookingDate };
}
