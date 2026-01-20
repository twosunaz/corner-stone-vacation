import { NextResponse } from "next/server";
import * as chrono from "chrono-node";
import { extractContactFromTranscript } from "@/util/extractContactFromTranscript";
export const runtime = "nodejs";

// TODO: fix AI Agent prompt to extract proper start time for appointment
export async function POST(req: Request) {
  try {
    const payload = await req.json();
    console.log("📨 Vapi webhook payload:", payload);

    // Only process end-of-call reports
    if (payload.message?.type !== "end-of-call-report") {
      return NextResponse.json({ success: true, message: "Not an end-of-call report" });
    }

    const transcript: string = payload.message.artifact?.transcript || "";
    const { email, phone, endedReason } = extractContactFromTranscript({
    transcript,
    phoneFromPayload: payload.message.customer?.number,
    endedReasonFromPayload: payload.message?.endedReason
    });

    console.log("Extracted endedReason:", endedReason);
    if (!phone) {
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

    if (!parsedDate && endedReason === "customer-ended-call") {
      console.log("❌ No booking date found in transcript");
      return NextResponse.json({ success: false, message: "No booking date found" }, { status: 200 });
    }

    console.log("⏰ Parsed start time:", parsedDate!.toISOString());
    const startTime = parsedDate!.toISOString();
    const endTime = new Date(parsedDate!.getTime() + 60 * 60 * 1000).toISOString(); // 1-hour appointment

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
            locationId: "VRejswos7T1F1YAC8P1t",
            pageLimit: 1,
            filters: [
                {
                    group: 'OR',
                    filters: [
                        {
                            field: 'email',
                            operator: 'eq',
                            value: [email]
                        },
                        {
                            field: 'phone',
                            operator: 'eq',
                            value: [phone]
                        }
                    ]

                }
            ]
        }),
      }
    );

    const searchData = await searchRes.json();
    console.log("Contact searchData: ", searchData);
    console.log("email: ", email);

    let contactId = searchData?.contacts?.[0]?.id;
    console.log("ContactId from searchData", contactId);
    console.log("endedReason: ", endedReason);

    if (endedReason === "voicemail" || endedReason === "no-answer") {
    // Move contact to "No Answer SMS Nurture"
    if (contactId) {
        await fetch("https://services.leadconnectorhq.com/opportunities/upsert", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            Authorization: `Bearer ${process.env.GHL_PRIVATE_INTEGRATION}`,
            Version: "2021-04-15",
        },
        body: JSON.stringify({
            contactId,
            pipelineId: "TwVBrfxOenOZAr5cVV40",
            stageId: "cd49b825-ae8c-4c92-978f-3e05dc6c7c13",
            title: "Missed call — follow-up required",
            locationId: payload.message.locationId
        }),
        });
    }
    }

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
            phone: phone,
            email: email || undefined,
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
            ignoreFreeSlotValidation: true ,// <-- bypasses the slot check
            address: "Zoom",
            calendarId: process.env.GHL_CALENDAR_ID,
            locationId: "VRejswos7T1F1YAC8P1t",
            contactId,
            startTime,
            endTime,
            assignedUserId: "oSoFaxmr74kOo8jYNiBl",
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

    return NextResponse.json({ success: true, bookingDate: parsedDate!.toISOString(), ghlData });

  } catch (error) {
    console.error("❌ Webhook error:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
