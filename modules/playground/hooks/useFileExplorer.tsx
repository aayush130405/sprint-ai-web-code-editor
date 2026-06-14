import {create} from 'zustand';
import {toast} from 'sonner';

import {TemplateFile, TemplateFolder} from "../lib/path-to-json";
import { generateFileId } from '../lib';

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

    //setter functions
    setPlaygroundId: (id: string) => void;
    setTemplateData: (data: TemplateFolder | null) => void;
    setOpenFiles: (files: OpenFile[]) => void;
    setActiveFileId: (fileId: string | null) => void;
    setEditorContent: (content: string) => void;

    //functions
    openFile: (file: TemplateFile) => void;
    closeFile: (fileId: string) => void;
    closeAllFiles: () => void;
}

//@ts-ignore
export const useFileExplorer = create<FileExplorerState> ((set, get) => ({
    templateData: null,
    playgroundId: "",
    openFiles: [] satisfies OpenFile[],
    activeFileId: null,
    editorContent: "",

    setTemplateData: (data) => set({templateData: data}),
    setPlaygroundId(id) {
        set({playgroundId: id})
    },
    setOpenFiles: (files) => set({openFiles: files}),
    setActiveFileId: (fileId) => set({activeFileId: fileId}),
    setEditorContent: (content) => set({editorContent: content}),

    openFile: (file) => {
        const fileId = generateFileId(file, get().templateData!);
        const {openFiles} = get();
        const existingFile = openFiles.find((f) => f.id === fileId);

        //if the file is already open, just switch active tab and load its content to the editor
        if(existingFile) {
            set({activeFileId: fileId, editorContent: existingFile.content})
            return;
        }

        //else if the file is not open, make a new openFile type entry and set its content in the editor
        const newOpenFile: OpenFile = {
            ...file,
            id: fileId,
            hasUnsavedChanges: false,
            content: file.content || "",
            originalContent: file.content || ""
        }

        set((state) => ({
            openFiles: [...state.openFiles, newOpenFile],
            activeFileId: fileId,
            editorContent: file.content || ""
        }))
    },

    closeFile: (fileId) => {
        const {openFiles, activeFileId} = get();
        const newFiles = openFiles.filter((f) => f.id !== fileId);

        let newActiveFileId = activeFileId;
        let newEditorContent = get().editorContent;

        //if the file which we are on is to be removed, move to the last file in newFiles array
        if(activeFileId === fileId) {
            if(newFiles.length > 0) {
                const lastFile = newFiles[newFiles.length - 1];
                newActiveFileId = lastFile.id;
                newEditorContent = lastFile.content;
            } else {
                newActiveFileId = null;
                newEditorContent = "";
            }
        }

        //if the file which is to be removed is not our current active file, just update openFiles array and let activeFileId and editorContent be the same
        set({
            openFiles: newFiles,
            activeFileId: newActiveFileId,
            editorContent: newEditorContent
        })
    },

    //this function is used to clear tabs, active file, editor text
    closeAllFiles: () => {
        set({
            openFiles: [],
            activeFileId: null,
            editorContent: ""
        })
    }
}))