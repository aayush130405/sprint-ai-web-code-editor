import { useState, useEffect, useCallback } from "react";
import {WebContainer} from '@webcontainer/api';
import { TemplateFolder } from "@/modules/playground/lib/path-to-json";

interface UseWebContainerProps {
    templateData: TemplateFolder
}

interface UseWebContainerReturn {
    serverUrl: string | null;
    error: string | null;
    instance: WebContainer | null;
    isLoading: boolean;
    writeFileSync: (path: string, content: string) => void;
    destory: () => void;
}

export const useWebContainer = ({templateData}: UseWebContainerProps): UseWebContainerReturn => {

}