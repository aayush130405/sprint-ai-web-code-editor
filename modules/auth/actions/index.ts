"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";

export const getUserById = async (id:string) => {
    try {
        const user = await db.user.findUnique({
            where: {id},
            include: {
                accounts: true
            }
        })

        return user;
    } catch (error) {
        return null;
        console.log(error);
    }
}

export const getAccountByUserId = async (userId:string) => {
    try {
        const account = await db.account.findFirst({
            where: {userId}
        })

        return account;
    } catch (error) {
        return null;
        console.log(error);
    }
}

export const getCurrentUser = async () => {
    const destructuredAuth = await auth();
    return destructuredAuth?.user;
}