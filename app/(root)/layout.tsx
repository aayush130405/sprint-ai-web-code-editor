import Footer from "@/modules/home/footer";
import {Header} from "@/modules/home/header";
import { Metadata } from "next";
import React from "react";

export const metadata: Metadata = {
    title: {
        template: "Sprint Editor",
        default: "AI based web IDE"
    }
}

export default function HomeLayout ({children} : {children: React.ReactNode}) {
    return (
        <>
            {/* header */}
            <Header/>

            {/* background effects and grid*/}


            {/* main */}
            <main className="z-20 relative w-full pt-0">
                {
                    children
                }
            </main>


            {/* footer */}
            <Footer/>
        </>
    )
}