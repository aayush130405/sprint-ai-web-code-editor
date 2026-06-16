/**
 * React hook that owns playground-level data fetching and persistence for a single playground
 * session. On mount (or when `id` changes), it loads the playground record from the DB via
 * `getPlaygroundById`, then fetches the starter template structure from `/api/template/:id`.
 * Saved user edits take precedence if `templateFiles[0].content` exists in the DB; otherwise
 * the API-generated template is used. Exposes `playgroundData` (title, metadata), `templateData`
 * (the nested file tree), loading/error state, and `saveTemplateData` which persists the entire
 * tree back to the DB through the `SaveUpdatedCode` server action. Toast notifications surface
 * load/save outcomes to the user.
 */
import {useState, useEffect, useCallback} from "react";
import {toast} from "sonner";

import type { TemplateFolder } from "../lib/path-to-json";
import { getPlaygroundById, SaveUpdatedCode } from "../actions";

interface PlaygroundData {
    id: string;
    title?: string;
    [key: string]: any;
}

interface UsePlaygroundReturn {
    playgroundData: PlaygroundData | null;
    templateData: TemplateFolder | null;
    isLoading: boolean;
    error: string | null;
    loadPlayground: () => Promise<void>;
    saveTemplateData: (data: TemplateFolder) => Promise<void>;
}

export const usePlayground = (id: string) : UsePlaygroundReturn => {
    const [playgroundData, setPlaygroundData] = useState<PlaygroundData | null>(null);
    const [templateData, setTemplateData] = useState<TemplateFolder | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const loadPlayground = useCallback(async () => {
        if(!id) return;

        try {
            setIsLoading(true);
            setError(null);

            const data = await getPlaygroundById(id);
            // @ts-ignore
            setPlaygroundData(data);

            const rawContent = data?.templateFiles?.[0]?.content;
            if(typeof rawContent === "string") {
                const parsedContent = JSON.parse(rawContent);
                setTemplateData(parsedContent);
                toast.success("Playground loaded successfully");
            }

            //if not saved content, load template from api as api generates templateJSON by passing id
            const res = await fetch(`/api/template/${id}`);
            if(!res.ok) throw new Error(`Failed to load template: ${res.status}`);
            const templateRes = await res.json();

            if(templateRes.templateJson && Array.isArray(templateRes.templateJson)) {
                setTemplateData({
                    folderName: "Root",
                    items: templateRes.templateJson
                })
            } else {
                setTemplateData(templateRes.templateJson || {
                    folderName: "Root",
                    items: []
                })
            }
            toast.success("Template loaded successfully");
        } catch (error) {
            console.log("Error loading playground");
            setError("Failed to load playground data");
            toast.error("Failed to load playground data");
        } finally {
            setIsLoading(false);
        }
    }, [id]);

    const saveTemplateData = useCallback(async (data: TemplateFolder) => {
        try {
            await SaveUpdatedCode(id, data);
            setTemplateData(data);
            toast.success("Changes saved successfully");
        } catch (error) {
            console.error("Error saving template data", error);
            toast.error("Failed to save changes");
            throw error;
        }
    }, [id])

    useEffect(() => {
        void loadPlayground();
    }, [loadPlayground]);

    return {
        playgroundData,
        templateData,
        isLoading,
        error,
        loadPlayground,
        saveTemplateData
    }
}