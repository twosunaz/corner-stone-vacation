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
    
    const { email, phone, endedReason, bookingDate } = extractContactFromTranscript({
    transcript,
    phoneFromPayload: payload.message.customer?.number,
    endedReasonFromPayload: payload.message?.endedReason
    });

    console.log("email: ", email);
    console.log("phone: ", phone);
    console.log("bookingDate: ", bookingDate);
    console.log("Extracted endedReason:", endedReason);

    if (!phone) {
      console.error("❌ Missing customer number");
      return NextResponse.json({ success: false, error: "Missing customer number" }, { status: 400 });
    }
    const filters: any[] = [];

    if (email) {
    filters.push({
        field: "email",
        operator: "eq",
        value: [email],
    });
    }

    if (phone) {
    filters.push({
        field: "phone",
        operator: "eq",
        value: [phone],
    });
    }

    // If no filters at all, you probably want to skip searching
    if (filters.length === 0) {
    console.error("❌ No valid search filters (email or phone)");
    return NextResponse.json({ success: false, error: "No contact info to search" }, { status: 400 });
    }

    const searchBody = {
    locationId: "VRejswos7T1F1YAC8P1t",
    pageLimit: 1,
    filters: [
        {
        group: "OR",
        filters,
        },
    ],
    };
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
        body: JSON.stringify(searchBody),
      }
    );

    const searchData = await searchRes.json();
    console.log("Contact searchData: ", searchData);

    let contactId = searchData?.contacts?.[0]?.id;
    console.log("ContactId from searchData", contactId);


    if (endedReason === "voicemail" || endedReason === "no-answer") {
        console.log(`📞 Call not answered (${endedReason}). Moving contact to No Answer SMS Nurture.`);

    // Move contact to "No Answer SMS Nurture"
    if (contactId) {
        const res = await fetch("https://services.leadconnectorhq.com/opportunities/upsert", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            Authorization: `Bearer ${process.env.GHL_PRIVATE_INTEGRATION}`,
            Version: "2021-07-28",
        },
        body: JSON.stringify({
            contactId,
            pipelineId: "TwVBrfxOenOZAr5cVV40",
            pipelineStageId: "cd49b825-ae8c-4c92-978f-3e05dc6c7c13",
            locationId: "VRejswos7T1F1YAC8P1t"
            }),
        });
        
        console.log("opportunities res: ", res);
        
    }
        return NextResponse.json({ success: true, message: "Contact moved to No Answer SMS Nurture"})
    }

    // --- Handle confirmed booking ---
    if (!bookingDate) {
    console.log("❌ No booking time found. Skipping appointment creation.");
    return NextResponse.json({ success: false, message: "No booking date found" });
    }
    // Now it's safe to create appointment
    const startTime = bookingDate.toISOString();
    const endTime = new Date(bookingDate.getTime() + 60 * 60 * 1000).toISOString();

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

    return NextResponse.json({ 
    success: true, 
    bookingDate: bookingDate?.toISOString(), 
    ghlData 
    });

  } catch (error) {
    console.error("❌ Webhook error:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
