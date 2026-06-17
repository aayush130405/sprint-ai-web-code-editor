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
    const [serverUrl, setServerUrl] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [instance, setInstance] = useState<WebContainer | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);

    useEffect(() => {
        let mounted = true;
        
        async function initializeWebContainer() {
            try {
                const webcontainerInstance = await WebContainer.boot();

                if(!mounted) return;

                setInstance(webcontainerInstance);
                setIsLoading(false);
            } catch (error) {
                console.error("Failed to initialize Web Container : ", error);
                if(mounted) {
                    setError(error instanceof Error ? error.message : "Failed to initialize Web Container");
                    setIsLoading(false);
                }
            }
        }

        initializeWebContainer();

        return () => {
            mounted = false;
            if(instance) {
                instance.teardown();        //used to destroy the web container instance
            }
        }
    }, [])
}