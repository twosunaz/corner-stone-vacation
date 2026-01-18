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

    // --- Extract day + time + optional AM/PM + timezone from AI transcript ---
    const dateTimeRegex = /\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\s+at\s+([\d]{1,2}(?::\d{2})?|\w+(?:\s\w+)*)\s*(AM|PM|am|pm)?\s*(CST|CDT)?/i;
    const match = transcript.match(dateTimeRegex);

    if (!match) {
      console.log("❌ No booking date found in transcript");
      return NextResponse.json({ success: false, message: "No booking date found" }, { status: 200 });
    }

    const [fullMatch, day, timeText, ampm, tz] = match;
    console.log("📅 Extracted booking info:", { day, timeText, ampm, tz });

    // --- Convert natural language time to Date ---
    const timezone = tz || "MST"; // default to Mountain Standard Time
    const cleanTimeText = timeText.replace(/[^0-9:apm\s]/gi, "").trim();
    const parsedDate = chrono.parseDate(`${day} at ${cleanTimeText} ${ampm || ""} ${timezone}`);

    if (!parsedDate) {
      console.error("❌ Failed to parse booking date");
      return NextResponse.json({ success: false, message: "Failed to parse booking date" }, { status: 500 });
    }

    console.log("⏰ Parsed start time:", parsedDate.toISOString());

    const startTime = parsedDate.toISOString();
    const endTime = new Date(parsedDate.getTime() + 60 * 60 * 1000).toISOString(); // 1-hour appointment

    // Optional: extract email from transcript if available
    const emailRegex = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
    const emailMatch = transcript.match(emailRegex);
    const extractedEmail = emailMatch ? emailMatch[0] : undefined;

    // --- Call GHL appointments API ---
    const res = await fetch(
      "https://services.leadconnectorhq.com/calendars/events/appointments",
      {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            Authorization: `Bearer ${process.env.GHL_PRIVATE_INTEGRATION}`,
            'Version': '2021-04-15',
        },
        body: JSON.stringify({
          calendarId: process.env.GHL_CALENDAR_ID,
          locationId: "VRejswos7T1F1YAC8P1t",
          startTime,
          endTime,
          title: "Scheduled via Vapi AI",
          appointmentStatus: "confirmed",
          contact: {
            phone: customerNumber,
            email: extractedEmail,
          },
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
