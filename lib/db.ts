//FILE LOGIC --- Create Prisma once and reuse it globally so Next.js hot reload doesn’t create multiple DB connections

import { PrismaClient } from "@prisma/client"

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }   //globalThis is a shared memory across the whole app

export const db = globalForPrisma.prisma || new PrismaClient()

if(process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db