import {readTemplateStructureFromJson, saveTemplateStructureToJson} from "@/modules/playground/lib/path-to-json"
import {db} from "@/lib/db"
import { templatePath } from "@/lib/template"
import path from "path"
import fs from "fs/promises"
import { NextRequest } from "next/server"

export async function GET(request: NextRequest, {params}:{params:Promise<{id: string}>}) {
    const {id} = await params;
    if(!id) return Response.json({error: "Missing playground ID"}, {status: 400});

    const playground = await db.playground.findUnique({where: {id}});
    if(!playground) return Response.json({error: "Playground not found"}, {status: 404});

    const templateKey = playground.template as keyof typeof templatePath;
    const templatePaths = templatePath[templateKey];
    if(!templatePaths) return Response.json({error: "Invalid template"}, {status: 401});

    try {
        
    } catch (error) {
        
    }
}