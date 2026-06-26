/**
 * Global Zustand store for the in-browser editor session state — separate from `usePlayground`
 * which handles server I/O. Tracks the current playground ID, a local copy of `templateData`,
 * the list of open file tabs (`openFiles`), which tab is active, and the editor's current text
 * (`editorContent`). `openFile` deduplicates tabs by generating a path-based ID via `generateFileId`,
 * and `closeFile`/`closeAllFiles` manage tab lifecycle including switching the active tab when the
 * current one is closed. This store is the bridge between the file tree sidebar (file selection)
 * and the tab bar + editor pane; unsaved-change tracking lives on each `OpenFile` entry.
 *
 * File-tree CRUD handlers (`handleAddFile`, `handleAddFolder`, `handleDeleteFile`, etc.) follow
 * a three-layer sync pattern on every mutation:
 *   1. Update local `templateData` in this store (immediate UI refresh in the sidebar)
 *   2. Persist via `saveTemplateData` (writes to the server/database)
 *   3. Mirror to the WebContainer filesystem when applicable (so the terminal/preview stay in sync)
 */
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

    // --- File explorer CRUD (sidebar context-menu actions) ---
    // Each handler receives `parentPath` (e.g. "src/components") to locate the target folder
    // inside the nested `templateData` tree, and `saveTemplateData` to persist changes server-side.
    // WebContainer sync args (`writeFileSync`, `instance`) are injected by the caller so this
    // store stays decoupled from WebContainer boot logic.

    /** Creates a new file in the tree, persists it, writes it to WebContainer, and opens it in a tab. */
    handleAddFile: (
        newFile: TemplateFile,
        parentPath: string,
        writeFileSync: (filePath: string, content: string) => Promise<void>,
        instance: any,
        saveTemplateData: (data: TemplateFolder) => Promise<void>
    ) => Promise<void>;

    /** Creates a new empty folder in the tree, persists it, and mkdirs it in WebContainer. */
    handleAddFolder: (
        newFolder: TemplateFolder,
        parentPath: string,
        instance: any,
        saveTemplateData: (data: TemplateFolder) => Promise<void>
    ) => Promise<void>;

    /** Removes a file from the tree, closes its tab if open, and persists the updated tree. */
    handleDeleteFile: (
        file: TemplateFile,
        parentPath: string,
        saveTemplateData: (data: TemplateFolder) => Promise<void>
    ) => Promise<void>;

    /** Removes a folder (and all nested items) from the tree, closes any open tabs inside it, and persists. */
    handleDeleteFolder: (
        folder: TemplateFolder,
        parentPath: string,
        saveTemplateData: (data: TemplateFolder) => Promise<void>
    ) => Promise<void>;

    /** Renames a file in the tree and updates any matching open tab's id/name so tabs stay linked. */
    handleRenameFile: (
        file: TemplateFile,
        newFilename: string,
        newExtension: string,
        parentPath: string,
        saveTemplateData: (data: TemplateFolder) => Promise<void>
    ) => Promise<void>;

    /** Renames a folder in the tree and persists — open tab IDs are path-based so they may need
     *  a separate refresh if files inside the renamed folder are currently open. */
    handleRenameFolder: (
        folder: TemplateFolder,
        newFolderName: string,
        parentPath: string,
        saveTemplateData: (data: TemplateFolder) => Promise<void>
    ) => Promise<void>;

    /** Called on every keystroke in the editor — updates the tab's in-memory content and flags
     *  `hasUnsavedChanges` when the text diverges from `originalContent` (last saved snapshot). */
    updateFileContent: (fileId: string, content: string) => void;

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
    },

    /**
     * handleAddFile — full create flow for a new file from the sidebar.
     *
     * Flow: clone tree → navigate to parent folder → push file → update store →
     *       persist to server → write to WebContainer FS → open in editor tab.
     */
    handleAddFile: async (newFile, parentPath, writeFileSync, instance, saveTemplateData) => {
        const { templateData } = get();
        // Guard: nothing to mutate if the playground hasn't loaded its file tree yet.
        if (!templateData) return;

        try {
            // Deep-clone so we never mutate the previous `templateData` reference in place
            // (Zustand/React need a new object reference to detect the change and re-render).
            const updatedTemplateData = JSON.parse(JSON.stringify(templateData)) as TemplateFolder;

            // Walk the folder tree using `parentPath` segments (e.g. "src/utils" → ["src","utils"]).
            // `currentFolder` starts at the virtual root and descends one level per path segment.
            const pathParts = parentPath.split("/");
            let currentFolder = updatedTemplateData;

            for (const part of pathParts) {
                if (part) {
                    const nextFolder = currentFolder.items.find(
                        (item) => "folderName" in item && item.folderName === part
                    ) as TemplateFolder;
                    if (nextFolder) currentFolder = nextFolder;
                }
            }

            // Insert the new file node into the resolved parent folder's `items` array.
            currentFolder.items.push(newFile);

            // Layer 1 — local store update (sidebar re-renders immediately).
            set({ templateData: updatedTemplateData });
            toast.success(`Created file: ${newFile.filename}.${newFile.fileExtension}`);

            // Layer 2 — persist the entire updated tree to the server/database.
            await saveTemplateData(updatedTemplateData);

            // Layer 3 — mirror the file onto the WebContainer virtual filesystem so
            // terminal commands and the dev-server preview can see the new file.
            if (writeFileSync) {
                const filePath = parentPath
                    ? `${parentPath}/${newFile.filename}.${newFile.fileExtension}`
                    : `${newFile.filename}.${newFile.fileExtension}`;
                await writeFileSync(filePath, newFile.content || "");
            }

            // Open the newly created file in a tab so the user can start editing right away.
            get().openFile(newFile);
        } catch (error) {
            console.error("Error adding file:", error);
            toast.error("Failed to create file");
        }
    },

    /**
     * handleAddFolder — creates an empty folder node in the tree and on disk.
     *
     * Same tree-navigation pattern as handleAddFile, but pushes a `TemplateFolder`
     * (which starts with an empty `items: []`) instead of a file.
     */
    handleAddFolder: async (newFolder, parentPath, instance, saveTemplateData) => {
        const { templateData } = get();
        if (!templateData) return;

        try {
            const updatedTemplateData = JSON.parse(JSON.stringify(templateData)) as TemplateFolder;
            const pathParts = parentPath.split("/");
            let currentFolder = updatedTemplateData;

            // Descend into the parent folder where the new folder should live.
            for (const part of pathParts) {
                if (part) {
                    const nextFolder = currentFolder.items.find(
                        (item) => "folderName" in item && item.folderName === part
                    ) as TemplateFolder;
                    if (nextFolder) currentFolder = nextFolder;
                }
            }

            currentFolder.items.push(newFolder);
            set({ templateData: updatedTemplateData });
            toast.success(`Created folder: ${newFolder.folderName}`);

            await saveTemplateData(updatedTemplateData);

            // Create the directory in WebContainer's virtual FS (`recursive: true` is safe even
            // if intermediate segments already exist).
            if (instance && instance.fs) {
                const folderPath = parentPath
                    ? `${parentPath}/${newFolder.folderName}`
                    : newFolder.folderName;
                await instance.fs.mkdir(folderPath, { recursive: true });
            }
        } catch (error) {
            console.error("Error adding folder:", error);
            toast.error("Failed to create folder");
        }
    },

    /**
     * handleDeleteFile — removes a single file from the tree and cleans up editor state.
     *
     * Also closes the file's tab if it is currently open, so we don't leave a stale tab
     * pointing at a node that no longer exists in `templateData`.
     */
    handleDeleteFile: async (file, parentPath, saveTemplateData) => {
        const { templateData, openFiles } = get();
        if (!templateData) return;

        try {
            const updatedTemplateData = JSON.parse(
                JSON.stringify(templateData)
            ) as TemplateFolder;
            const pathParts = parentPath.split("/");
            let currentFolder = updatedTemplateData;

            for (const part of pathParts) {
                if (part) {
                    const nextFolder = currentFolder.items.find(
                        (item) => "folderName" in item && item.folderName === part
                    ) as TemplateFolder;
                    if (nextFolder) currentFolder = nextFolder;
                }
            }

            // Keep every item that is NOT the target file. Folders pass through because they
            // lack `filename`; files pass through when name/extension don't match.
            currentFolder.items = currentFolder.items.filter(
                (item) =>
                    !("filename" in item) ||
                    item.filename !== file.filename ||
                    item.fileExtension !== file.fileExtension
            );

            // Tab cleanup: file IDs are path-derived (see `generateFileId`), so we must use
            // the same helper here to find the matching open tab.
            const fileId = generateFileId(file, templateData);
            const openFile = openFiles.find((f) => f.id === fileId);

            if (openFile) {
                // `closeFile` also switches active tab / clears editor if this was the active file.
                get().closeFile(fileId);
            }

            set({ templateData: updatedTemplateData });
            await saveTemplateData(updatedTemplateData);
            toast.success(`Deleted file: ${file.filename}.${file.fileExtension}`);
        } catch (error) {
            console.error("Error deleting file:", error);
            toast.error("Failed to delete file");
        }
    },

    /**
     * handleDeleteFolder — removes an entire folder subtree from the tree.
     *
     * Before updating the store we walk the folder being deleted and close every open tab
     * for files nested inside it (including files in sub-folders), preventing orphaned tabs.
     */
    handleDeleteFolder: async (folder, parentPath, saveTemplateData) => {
        const { templateData } = get();
        if (!templateData) return;

        try {
            const updatedTemplateData = JSON.parse(
                JSON.stringify(templateData)
            ) as TemplateFolder;
            const pathParts = parentPath.split("/");
            let currentFolder = updatedTemplateData;

            for (const part of pathParts) {
                if (part) {
                    const nextFolder = currentFolder.items.find(
                        (item) => "folderName" in item && item.folderName === part
                    ) as TemplateFolder;
                    if (nextFolder) currentFolder = nextFolder;
                }
            }

            // Drop the folder node whose `folderName` matches — this removes the whole subtree
            // from `templateData` in one step (all nested files/folders go with it).
            currentFolder.items = currentFolder.items.filter(
                (item) =>
                    !("folderName" in item) || item.folderName !== folder.folderName
            );

            // Recursively close editor tabs for every file inside the deleted folder.
            // We traverse the *original* `folder` object (pre-deletion) because we still
            // need its nested structure to discover which tabs to close.
            const closeFilesInFolder = (folder: TemplateFolder, currentPath: string = "") => {
                folder.items.forEach((item) => {
                    if ("filename" in item) {
                        const fileId = generateFileId(item, templateData);
                        get().closeFile(fileId);
                    } else if ("folderName" in item) {
                        // Descend into nested folders, building the path as we go.
                        const newPath = currentPath ? `${currentPath}/${item.folderName}` : item.folderName;
                        closeFilesInFolder(item, newPath);
                    }
                });
            };

            closeFilesInFolder(
                folder,
                parentPath ? `${parentPath}/${folder.folderName}` : folder.folderName
            );

            set({ templateData: updatedTemplateData });
            await saveTemplateData(updatedTemplateData);
            toast.success(`Deleted folder: ${folder.folderName}`);
        } catch (error) {
            console.error("Error deleting folder:", error);
            toast.error("Failed to delete folder");
        }
    },

    /**
     * handleRenameFile — changes a file's name/extension in the tree and keeps editor tabs in sync.
     *
     * Renaming changes the path-based file ID, so we must update `openFiles` and `activeFileId`
     * to the new ID — otherwise the tab bar would still reference the old identity.
     */
    handleRenameFile: async (
        file,
        newFilename,
        newExtension,
        parentPath,
        saveTemplateData
    ) => {
        const { templateData, openFiles, activeFileId } = get();
        if (!templateData) return;

        // Compute IDs before and after the rename. Because IDs encode the file path/name,
        // a rename always produces a different ID even if only the extension changes.
        const oldFileId = generateFileId(file, templateData);
        const newFile = { ...file, filename: newFilename, fileExtension: newExtension };
        const newFileId = generateFileId(newFile, templateData);

        try {
            const updatedTemplateData = JSON.parse(
                JSON.stringify(templateData)
            ) as TemplateFolder;
            const pathParts = parentPath.split("/");
            let currentFolder = updatedTemplateData;

            for (const part of pathParts) {
                if (part) {
                    const nextFolder = currentFolder.items.find(
                        (item) => "folderName" in item && item.folderName === part
                    ) as TemplateFolder;
                    if (nextFolder) currentFolder = nextFolder;
                }
            }

            // Locate the exact file entry by its current name + extension.
            const fileIndex = currentFolder.items.findIndex(
                (item) =>
                    "filename" in item &&
                    item.filename === file.filename &&
                    item.fileExtension === file.fileExtension
            );

            if (fileIndex !== -1) {
                const updatedFile = {
                    ...currentFolder.items[fileIndex],
                    filename: newFilename,
                    fileExtension: newExtension,
                } as TemplateFile;
                currentFolder.items[fileIndex] = updatedFile;

                // Patch the matching open tab: swap to the new ID and display name.
                // Other tabs are left untouched.
                const updatedOpenFiles = openFiles.map((f) =>
                    f.id === oldFileId
                        ? {
                              ...f,
                              id: newFileId,
                              filename: newFilename,
                              fileExtension: newExtension,
                          }
                        : f
                );

                set({
                    templateData: updatedTemplateData,
                    openFiles: updatedOpenFiles,
                    // If the renamed file was the active tab, point `activeFileId` at the new ID.
                    activeFileId: activeFileId === oldFileId ? newFileId : activeFileId,
                });

                await saveTemplateData(updatedTemplateData);
                toast.success(`Renamed file to: ${newFilename}.${newExtension}`);
            }
        } catch (error) {
            console.error("Error renaming file:", error);
            toast.error("Failed to rename file");
        }
    },

    /**
     * handleRenameFolder — renames a folder node in the tree and persists.
     *
     * Unlike file rename, this does not patch open tab IDs. File IDs are path-based, so tabs
     * for files inside a renamed folder may become stale until those files are re-opened.
     */
    handleRenameFolder: async (folder, newFolderName, parentPath, saveTemplateData) => {
        const { templateData } = get();
        if (!templateData) return;

        try {
            const updatedTemplateData = JSON.parse(
                JSON.stringify(templateData)
            ) as TemplateFolder;
            const pathParts = parentPath.split("/");
            let currentFolder = updatedTemplateData;

            for (const part of pathParts) {
                if (part) {
                    const nextFolder = currentFolder.items.find(
                        (item) => "folderName" in item && item.folderName === part
                    ) as TemplateFolder;
                    if (nextFolder) currentFolder = nextFolder;
                }
            }

            const folderIndex = currentFolder.items.findIndex(
                (item) => "folderName" in item && item.folderName === folder.folderName
            );

            if (folderIndex !== -1) {
                const updatedFolder = {
                    ...currentFolder.items[folderIndex],
                    folderName: newFolderName,
                } as TemplateFolder;
                currentFolder.items[folderIndex] = updatedFolder;

                set({ templateData: updatedTemplateData });
                await saveTemplateData(updatedTemplateData);
                toast.success(`Renamed folder to: ${newFolderName}`);
            }
        } catch (error) {
            console.error("Error renaming folder:", error);
            toast.error("Failed to rename folder");
        }
    },

    /**
     * updateFileContent — live editor sync on every content change.
     *
     * Updates two places at once:
     *   - The matching entry in `openFiles` (stores per-tab content + dirty flag)
     *   - `editorContent` (what the Monaco/CodeMirror pane displays), but only when
     *     the edited file is the currently active tab.
     *
     * `hasUnsavedChanges` compares against `originalContent` (snapshot from when the
     * file was opened or last saved) — used to show the dot/asterisk on dirty tabs.
     */
    updateFileContent: (fileId, content) => {
        set((state) => ({
            openFiles: state.openFiles.map((file) =>
                file.id === fileId
                    ? {
                          ...file,
                          content,
                          hasUnsavedChanges: content !== file.originalContent,
                      }
                    : file
            ),
            editorContent:
                fileId === state.activeFileId ? content : state.editorContent,
        }));
    },
}))