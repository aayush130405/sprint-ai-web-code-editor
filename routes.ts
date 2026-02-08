//public routes that do not require auth 
export const publicRoutes: string[] = [
    "/"
]

//protected routes that require auth 
export const protectedRoutes : string[] = [
    "/"
]

//accessible to the public but require auth
export const authRoutes : string[] = [
    "/auth/sign-in"
]

export const apiAuthPrefix : string = "/api/auth"

export const DEFAULT_LOGIN_REDIRECT = "/"