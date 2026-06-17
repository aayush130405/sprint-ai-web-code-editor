import { useState, useEffect, useCallback } from "react";
import {WebContainer} from '@webcontainer/api';
import { TemplateFolder } from "@/modules/playground/lib/path-to-json";

interface UseWebContainerProps {
    templateData: TemplateFolder
}

interface UseWebContainerReturn {
    serverUrl: string | null;       //will return a url which will be used to display preview using iframe
    error: string | null;
    instance: WebContainer | null;
    isLoading: boolean;
    writeFileSync: (path: string, content: string) => void; //will update the code in the container whenever changes are made in the editor
    destory: () => void;
}

export const useWebContainer = ({templateData}: UseWebContainerProps): UseWebContainerReturn => {
    
}