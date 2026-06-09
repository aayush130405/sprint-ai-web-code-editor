import {create} from 'zustand';
import {toast} from 'sonner';

import {TemplateFile, TemplateFolder} from "../lib/path-to-json";

interface OpenFile extends TemplateFile {
    id: string;
    hasUnsavedChanges: boolean;
    content: string;
    originalContent: string;
}

interface FileExplorerState {
    playgroundId: string;
    templateData: TemplateFolder | null;
    openFiles: OpenFile[];
    activeFileId: string | null;
    editorContent: string;
}