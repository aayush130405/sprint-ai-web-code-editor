import { NextRequest, NextResponse } from "next/server";



export async function POST(request: NextRequest) {
    const body = request.json();
    const {fileContent, } = body;
}