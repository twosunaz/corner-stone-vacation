import { NextResponse, NextRequest } from "next/server";
import { vapi } from "@/util/vapi/client";

export async function POST(req: Request) {
    const body = req.json();
    console.log("n8n body payload:", body);
    
}