import { NextResponse } from "next/server";
import { ghlApi } from "@/util/ghl/client";

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

    // --- Extract date/time from AI's transcript ---
    const dateMatch = transcript.match(
      /\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\s+at\s+(\d{1,2}:\d{2}\s*(AM|PM|am|pm)?\s*CST|CDT)?/i
    );

    if (!dateMatch) {
      console.log("❌ No booking date found in transcript");
      return NextResponse.json({ success: false, message: "No booking date found" }, { status: 200 });
    }

    const bookingDateStr = dateMatch[0];
    console.log("📅 Extracted booking date from transcript:", bookingDateStr);

    // TODO: convert bookingDateStr to ISO string or GHL-compatible datetime
    const bookingDate = new Date(); // placeholder, replace with proper parsing

    // --- Use ghlApi helper to schedule the appointment ---
    const ghlData = await ghlApi("appointments", {
      method: "POST",
      body: JSON.stringify({
        contactPhone: customerNumber,
        startDateTime: bookingDate.toISOString(),
        serviceId: process.env.GHL_SERVICE_ID,
        notes: "Scheduled via Vapi AI assistant",
      }),
    });

    console.log("✅ GHL appointment created:", ghlData);

    return NextResponse.json({ success: true, bookingDate: bookingDateStr, ghlData });
  } catch (error) {
    console.error("❌ Webhook error:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
