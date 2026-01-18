import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  try {
    // --- Hardcoded minimal info ---
    const contactId = "VJHDNpvwpCzGhTw5KmZY"; // test contactId in GHL
    const startTime = new Date("2026-01-19T03:30:00+05:30").toISOString();
    const endTime = new Date("2026-01-19T04:30:00+05:30").toISOString();

    // --- Book appointment ---
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
            ignoreFreeSlotValidation: true ,// <-- bypasses the slot check
            address: "Zoom",
            calendarId: process.env.GHL_CALENDAR_ID,
            locationId: "VRejswos7T1F1YAC8P1t",
            contactId,
            startTime,
            endTime,
            assignedUserId: "0007BWpSzSwfiuSl0tR2",
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

    return NextResponse.json({ success: true, ghlData });
  } catch (error) {
    console.error("❌ Webhook error:", error);
    return NextResponse.json(
      { success: false, error: (error as any).message || "Internal server error" },
      { status: 500 }
    );
  }
}
