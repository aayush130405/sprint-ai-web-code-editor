//the role of this file is to connect auth engine to API routes

import { handlers } from "@/auth" // Referring to the auth.ts we just created
export const { GET, POST } = handlers