import { NextResponse } from "next/server";
import * as chrono from "chrono-node";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const payload = await req.json();
    console.log("📨 Vapi webhook payload:", payload);

    // Only process end-of-call reports
    if (payload.message?.type !== "end-of-call-report") {
      return NextResponse.json({ success: true, message: "Not an end-of-call report" });
    }

    const transcript: string = payload.message.artifact?.transcript || "";
    const customerNumber: string = payload.message.customer?.number;

    if (!customerNumber) {
      console.error("❌ Missing customer number");
      return NextResponse.json({ success: false, error: "Missing customer number" }, { status: 400 });
    }

    // --- Robust extraction of booking date/time ---
    const dateTimePatterns = [
      // e.g. Monday at 1 PM MST
      /\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\s+at\s+([0-9]{1,2}(?::[0-9]{2})?|\w+(?:\s\w+)*)\s*(AM|PM|am|pm)?\s*(CST|CDT|MST)?/i,
      // e.g. 3:30 PM MST on Monday
      /\b([0-9]{1,2}(?::[0-9]{2})?|\w+(?:\s\w+)*)\s*(AM|PM|am|pm)?\s*(CST|CDT|MST)?\s+on\s+(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)/i
    ];

    let parsedDate: Date | null = null;

    for (const pattern of dateTimePatterns) {
      const match = transcript.match(pattern);
      if (match) {
        // Use the matched string directly with chrono-node for parsing
        parsedDate = chrono.parseDate(match[0]);
        if (parsedDate) break;
      }
    }

    if (!parsedDate) {
      console.log("❌ No booking date found in transcript");
      return NextResponse.json({ success: false, message: "No booking date found" }, { status: 200 });
    }

    console.log("⏰ Parsed start time:", parsedDate.toISOString());
    const startTime = parsedDate.toISOString();
    const endTime = new Date(parsedDate.getTime() + 60 * 60 * 1000).toISOString(); // 1-hour appointment

    // --- Extract email if available ---
    const emailRegex = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
    const emailMatch = transcript.match(emailRegex);
    const extractedEmail = emailMatch ? emailMatch[0] : undefined;

    // --- Search for existing contact ---
    const searchRes = await fetch(
      "https://services.leadconnectorhq.com/contacts/search",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Bearer ${process.env.GHL_PRIVATE_INTEGRATION}`,
          Version: "2021-07-28",
        },
        body: JSON.stringify({
            email: extractedEmail, // optional
            phone: customerNumber, // optional
            locationId: "VRejswos7T1F1YAC8P1t",
            pageLimit: 20,
        }),
      }
    );

    const searchData = await searchRes.json();
    console.log("Contact searchData: ", searchData);
    console.log("emailMatch: ", emailMatch);
    console.log("extractedEmail: ", extractedEmail);

    let contactId = searchData?.[0]?.id;

    // --- Create contact if none found ---
    if (!contactId) {
      const createRes = await fetch(
        "https://services.leadconnectorhq.com/contacts",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            Authorization: `Bearer ${process.env.GHL_PRIVATE_INTEGRATION}`,
            Version: "2021-04-15",
          },
          body: JSON.stringify({
            firstName: "Unknown",
            phone: customerNumber,
            email: extractedEmail || undefined,
          }),
        }
      );

      const createData = await createRes.json();
      contactId = createData.id;
    }

    // --- Call GHL appointments API ---
    const res = await fetch(
      "https://services.leadconnectorhq.com/calendars/events/appointments",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Bearer ${process.env.GHL_PRIVATE_INTEGRATION}`,
          Version: "2021-04-15",
        },
        body: JSON.stringify({
          title: "Scheduled via Vapi AI",
          appointmentStatus: "confirmed",
          address: "Zoom",
          calendarId: process.env.GHL_CALENDAR_ID,
          locationId: "VRejswos7T1F1YAC8P1t",
          contactId: contactId,
          startTime: startTime,
          endTime: endTime
        }),
      }
    );

    const text = await res.text();
    if (!res.ok) {
      console.error("❌ GHL raw response:", text);
      throw new Error("Failed to book GHL appointment");
    }

    const ghlData = JSON.parse(text);
    console.log("✅ GHL appointment created:", ghlData);

    return NextResponse.json({ success: true, bookingDate: parsedDate.toISOString(), ghlData });

  } catch (error) {
    console.error("❌ Webhook error:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
