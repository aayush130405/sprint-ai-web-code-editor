//this file gets the existing playground data for the current user if any

"use server";

import { db } from "@/lib/db";
import { getCurrentUser } from "@/modules/auth/actions";

export const getAllPlaygroundForUser = async () => {
    const user = await getCurrentUser();

    try {
        const playground = await db.playground.findMany({
            where: {
                userId: user?.id
            },
            include: {
                user: true
            }
        })

        return playground;
    } catch (error) {
        console.log(error);
    }
}