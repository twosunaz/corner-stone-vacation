import { NextResponse } from "next/server";
import { vapi } from "@/util/vapi/client";

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

    // ✅ Fixed assistant ID from dashboard
    const assistantId = "bf9bd7a4-e51f-4292-9573-8b09af6bd61f";

    // ✅ Start Vapi assistant with variable overrides
    const call = await vapi.start(assistantId, {
      variableValues: {
        firstName: assistantOverrides?.variableValues?.firstName ?? "",
        lastName: assistantOverrides?.variableValues?.lastName ?? "",
        email: assistantOverrides?.variableValues?.email ?? "",
        formSource: assistantOverrides?.variableValues?.formSource ?? "",
        customerNumber: customer.number
      }
    });

    console.log("📞 Vapi call started:", call);

    return NextResponse.json(
      { success: true, callId: call?.id || null },
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
