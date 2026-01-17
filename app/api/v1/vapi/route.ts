import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    console.log("n8n body payload:", body);

    return NextResponse.json(
      { success: true, received: body },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error parsing request body:", error);

    return NextResponse.json(
      { success: false, error: "Invalid JSON payload" },
      { status: 400 }
    );
  }
}
