import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const payload = await req.json();
    console.log("📨 Vapi webhook payload:", payload);

    // Only process completed calls
    if (payload.status !== "completed") {
      return NextResponse.json({ success: true, message: "Call not completed yet" });
    }

    const transcript: string = payload.transcript || "";
    const customerNumber: string = payload.customer?.number;

    if (!customerNumber) {
      console.error("❌ Missing customer number in webhook payload");
      return NextResponse.json({ success: false, error: "Missing customer number" }, { status: 400 });
    }

    // --- Parse transcript for your conditions ---
    const married = /married/i.test(transcript);
    const over28 = /\b([2-9][8-9]|[3-9]\d+)\b/.test(transcript); // looks for age 28+
    const makes75k = /\b(7[5-9]\d{3}|[8-9]\d{4}|[1-9]\d{5,})\b/.test(transcript); // 75k+
    const notTravelClub = /not part of a travel club|no travel club/i.test(transcript);

    console.log({
      married,
      over28,
      makes75k,
      notTravelClub,
    });

    // --- If they qualify, create GoHighLevel calendar event ---
    if (married && over28 && makes75k && notTravelClub) {
      console.log("✅ Customer qualifies, scheduling in GHL...");

      const ghlResp = await fetch("https://rest.gohighlevel.com/v1/appointments", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.GHL_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contactPhone: customerNumber,
          startDateTime: new Date().toISOString(), // replace with your scheduling logic
          serviceId: process.env.GHL_SERVICE_ID,   // your service ID
          notes: "Scheduled via Vapi AI assistant",
        }),
      });

      const ghlData = await ghlResp.json();
      console.log("📅 GHL appointment created:", ghlData);
    } else {
      console.log("❌ Customer does not meet qualifications, skipping scheduling");
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("❌ Vapi webhook error:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
