/**
 * Layout wrapper for all `/playground/:id` routes. Provides the `SidebarProvider` context required
 * by the shadcn Sidebar components used in `TemplateFileTree` and the page header's `SidebarTrigger`.
 * Without this provider, the collapsible sidebar and inset layout in the playground page won't function.
 */
import { SidebarProvider } from "@/components/ui/sidebar";
import React from "react";

export default function PlaygroundLayout({children} : {children: React.ReactNode}) {
    return (
        <SidebarProvider>
            {children}
        </SidebarProvider>
    )
}