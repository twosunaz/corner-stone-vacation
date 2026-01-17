// /app/api/v1/vapi/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    console.log("📨 n8n payload received:", body);

    const { customer, assistantOverrides } = body;

    if (!customer?.number) {
      console.error("❌ Missing customer phone number");
      return NextResponse.json(
        { success: false, error: "Missing customer phone number" },
        { status: 400 }
      );
    }

    // ✅ Fixed assistant ID from your dashboard
    const assistantId = "bf9bd7a4-e51f-4292-9573-8b09af6bd61f";

    // ✅ Prepare variableValues for Vapi
    const variableValues = {
      firstName: assistantOverrides?.variableValues?.firstName ?? "",
      lastName: assistantOverrides?.variableValues?.lastName ?? "",
      email: assistantOverrides?.variableValues?.email ?? "",
      formSource: assistantOverrides?.variableValues?.formSource ?? "",
      customerNumber: customer.number
    };

    // --- Call Vapi REST API directly ---
    const response = await fetch("https://api.vapi.ai/v1/assistants/start", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.VAPI_API_KEY}`, // must be set in Vercel
      },
      body: JSON.stringify({
        assistantId,
        variableValues
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("❌ Vapi API error:", data);
      return NextResponse.json(
        { success: false, error: data },
        { status: response.status }
      );
    }

    console.log("📞 Vapi call started via REST API:", data);

    return NextResponse.json(
      { success: true, result: data },
      { status: 200 }
    );
  } catch (error) {
    console.error("❌ Vapi webhook error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
