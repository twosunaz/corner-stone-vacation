import { NextRequest, NextResponse } from "next/server";
import { vapi } from "@/util/vapi/client";

export async function POST(req: Request) {
    const body = req.json();
    console.log("body", body);
    vapi.start('bf9bd7a4-e51f-4292-9573-8b09af6bd61f');
}
