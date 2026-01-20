import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  try {
    
    // // --- Hardcoded minimal info ---
    // const contactId = "VJHDNpvwpCzGhTw5KmZY"; // test contactId in GHL
    // const startTime = new Date("2026-01-19T03:30:00+05:30").toISOString();
    // const endTime = new Date("2026-01-19T04:30:00+05:30").toISOString();

    // // --- Book appointment ---
    // const res = await fetch(
    //   "https://services.leadconnectorhq.com/calendars/events/appointments",
    //   {
    //     method: "POST",
    //     headers: {
    //       "Content-Type": "application/json",
    //       Accept: "application/json",
    //       Authorization: `Bearer ${process.env.GHL_PRIVATE_INTEGRATION}`,
    //       Version: "2021-04-15",
    //     },
    //       body: JSON.stringify({
    //         title: "Scheduled via Vapi AI",
    //         appointmentStatus: "confirmed",
    //         ignoreFreeSlotValidation: true ,// <-- bypasses the slot check
    //         address: "Zoom",
    //         calendarId: process.env.GHL_CALENDAR_ID,
    //         locationId: "VRejswos7T1F1YAC8P1t",
    //         contactId,
    //         startTime,
    //         endTime,
    //         assignedUserId: "oSoFaxmr74kOo8jYNiBl",
    // }),
    //   }
    // );
    // const res = await fetch(
    //   "https://services.leadconnectorhq.com/contacts/search",
    //   {
    //     method: "POST",
    //     headers: {
    //       "Content-Type": "application/json",
    //       Accept: "application/json",
    //       Authorization: `Bearer ${process.env.GHL_PRIVATE_INTEGRATION}`,
    //       Version: "2021-07-28",
    //     },
    //     body: JSON.stringify({
    //         locationId: "VRejswos7T1F1YAC8P1t",
    //         pageLimit: 1,
    //         filters: [
    //             {
    //                 group: 'OR',
    //                 filters: [
    //                     {
    //                         field: 'email',
    //                         operator: 'eq',
    //                         value: ["vibecommunitypublishing@gmail.com"]
    //                     },
    //                     {
    //                         field: 'phone',
    //                         operator: 'eq',
    //                         value: ["+15204445252"]
    //                     }
    //                 ]

    //             }
    //         ]
    //     }),
    //   }
    // );
    const res = await fetch("https://services.leadconnectorhq.com/opportunities/upsert", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            Authorization: `Bearer ${process.env.GHL_PRIVATE_INTEGRATION}`,
            Version: "2021-07-28",
        },
        body: JSON.stringify({
            contactId: "VJHDNpvwpCzGhTw5KmZY",
            pipelineId: "TwVBrfxOenOZAr5cVV40",
            stageId: "cd49b825-ae8c-4c92-978f-3e05dc6c7c13",
            title: "Missed call — follow-up required",
            locationId: "VRejswos7T1F1YAC8P1t"
        }),
        });
    
    const text = await res.text();
    if (!res.ok) {
      console.error("❌ GHL raw response:", text);
      throw new Error("Failed to update opportunities");
    }

    const ghlData = JSON.parse(text);
    console.log("✅ GHL opportunities updated:", ghlData);

    return NextResponse.json({ success: true, ghlData });
  } catch (error) {
    console.error("❌ Webhook error:", error);
    return NextResponse.json(
      { success: false, error: (error as any).message || "Internal server error" },
      { status: 500 }
    );
  }
}
