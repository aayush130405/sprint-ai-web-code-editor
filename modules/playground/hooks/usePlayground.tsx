import {useState, useEffect, useCallback} from "react";
import {toast} from "sonner";

import type { TemplateFolder } from "../lib/path-to-json";

interface PlaygroundData {
    id: string;
    name?: string;
    [key: string]: any;
}

interface UsePlaygroundReturn {
    playgroundData: PlaygroundData | null;
    templateData: TemplateFolder | null;
    isLoading: boolean;
    error: string | null;
}