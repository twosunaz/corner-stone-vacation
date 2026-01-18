import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  try {
    const customerNumber = "15204445252";
    const extractedEmail = "vibecommunitypublishing@gmail.com";

    // --- Search for existing contact ---
    const searchRes = await fetch(
      "https://services.leadconnectorhq.com/contacts/search",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Bearer ${process.env.GHL_PRIVATE_INTEGRATION}`,
          Version: "2021-04-15",
        },
        body: JSON.stringify({ email: extractedEmail, phone: customerNumber }),
      }
    );

    const searchData = await searchRes.json();
    let contactId = searchData?.[0]?.id;

    // --- Create contact if none found OR incomplete ---
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
            lastName: "User",
            phone: customerNumber,
            email: extractedEmail || undefined,
          }),
        }
      );

      const createData = await createRes.json();
      contactId = createData.id;
    }

    if (!contactId) {
      throw new Error("Failed to get or create a valid contactId");
    }

    // --- Call GHL appointments API ---
    const startTime = new Date("2026-01-19T03:30:00+05:30").toISOString();
    const endTime = new Date("2026-01-19T04:30:00+05:30").toISOString();

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
          contactId,
          startTime,
          endTime,
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
    return NextResponse.json({ success: false, error: error.message || "Internal server error" }, { status: 500 });
  }
}
