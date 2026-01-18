import { NextResponse } from "next/server";
import { normalizeUSNumber } from "@/util/normalizeNumber";
export const runtime = "nodejs";

export async function GET() {
  try {
    const customerNumber = normalizeUSNumber("5204445252"); // ✅ include +1 for US number
    const extractedEmail = "vibecommunitypublishing@gmail.com"; // test email

    let contactId: string | null = null;

    // --- Try to find contact by email ---
    if (extractedEmail && extractedEmail.includes("@")) {
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
          body: JSON.stringify({ email: extractedEmail }),
        }
      );
      const searchData = await searchRes.json();
      contactId = searchData?.[0]?.id || null;
    }

    // --- If no contact, search by phone ---
    if (!contactId) {
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
          body: JSON.stringify({ phone: customerNumber }),
        }
      );
      const searchData = await searchRes.json();
      contactId = searchData?.[0]?.id || null;
    }

    // --- Create contact if none found ---
    if (!contactId) {
      const payload: any = {
        firstName: "Unknown",
        lastName: "User",
        phone: customerNumber,
      };
      if (extractedEmail && extractedEmail.includes("@")) payload.email = extractedEmail;

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
          body: JSON.stringify(payload),
        }
      );

      const createData = await createRes.json();
      contactId = createData?.id || null;
    }

    if (!contactId) {
      throw new Error("Failed to get or create a valid contactId. Ensure phone is valid.");
    }

    // --- Book appointment ---
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
    return NextResponse.json(
      { success: false, error: (error as any).message || "Internal server error" },
      { status: 500 }
    );
  }
}
