/**
 * Next.js server actions for playground persistence. `getPlaygroundById` reads a playground's
 * title and any previously saved template file content from Prisma. `SaveUpdatedCode` upserts
 * the entire `TemplateFolder` tree as a JSON string into the `templateFile` table, gated on
 * the current authenticated user. These are called from `usePlayground` on the client side
 * and run exclusively on the server (`"use server"`), keeping DB access out of components.
 */
"use server"

import { db } from "@/lib/db"
import { TemplateFolder } from "../lib/path-to-json";
import { getCurrentUser } from "@/modules/auth/actions";

export const getPlaygroundById = async (id: string) => {
    try {
        const playground = await db.playground.findUnique({
            where: {id},
            select: {
                title: true,
                templateFiles: {
                    select: {
                        content: true
                    }
                }
            }
        })

        return playground;
    } catch (error) {
        console.log(error);
    }
}

export const SaveUpdatedCode = async(playgroundId: string, data: TemplateFolder) => {
    const user = await getCurrentUser()
    if(!user) return null;

    try {
        const updatedPlayground = await db.templateFile.upsert({
            where: {playgroundId},
            update: {content: JSON.stringify(data)},
            create: {playgroundId, content: JSON.stringify(data)}
        })

        return updatedPlayground;
    } catch (error) {
        console.log("Error", error);
        return null;
    }
}