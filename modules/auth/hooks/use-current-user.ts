//this hook is used to get current logged in user from client side

import {useSession} from "next-auth/react"

export const useCurrentUser = () => {
    const session = useSession();

    return session?.data?.user;
}