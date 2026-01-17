// /app/api/v1/vapi/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    console.log("📨 n8n payload received:", body);

    const { assistantId, phoneNumberId, customer, assistantOverrides } = body;

    if (!assistantId || !phoneNumberId || !customer?.number) {
      console.error("❌ Missing required fields");
      return NextResponse.json(
        { success: false, error: "Missing assistantId, phoneNumberId, or customer number" },
        { status: 400 }
      );
    }

    const vapiApiKey = process.env.VAPI_API_KEY;
    if (!vapiApiKey) {
      console.error("❌ Missing VAPI_API_KEY");
      return NextResponse.json(
        { success: false, error: "VAPI_API_KEY is not configured" },
        { status: 500 }
      );
    }

    // Build request payload for calls/create
    const payload: any = {
      assistantId,
      phoneNumberId,
      customer: { number: customer.number },
    };

    // Optional: add variable values if provided
    if (assistantOverrides?.variableValues) {
      payload.variableValues = assistantOverrides.variableValues;
    }

    const response = await fetch("https://api.vapi.ai/v1/calls/create", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${vapiApiKey}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("❌ Vapi API error:", data);
      return NextResponse.json(
        { success: false, error: data },
        { status: response.status }
      );
    }

    console.log("📞 Vapi call created:", data);

    return NextResponse.json({ success: true, result: data }, { status: 200 });
  } catch (err) {
    console.error("❌ Vapi webhook error:", err);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
