/**
 * Top-level orchestrator page for a single code playground (`/playground/:id`). Wires together
 * the three main concerns: data loading (`usePlayground`), session state (`useFileExplorer`), and
 * UI layout (sidebar file tree + main editor area). The left sidebar renders `TemplateFileTree`
 * fed with `templateData`; the right pane shows a tab bar for open files and a placeholder content
 * area (raw text until `PlaygroundEditor` is built). Header actions for save, AI bot, preview toggle,
 * and close-all are scaffolded but several handlers (save, tree CRUD) are still no-ops. Syncs
 * `templateData` into the Zustand store on initial load so `generateFileId` can resolve paths.
 */
"use client"
import { usePlayground } from '@/modules/playground/hooks/usePlayground';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useParams } from 'next/navigation'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { SidebarInset, SidebarSeparator, SidebarTrigger } from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import { TemplateFileTree } from '@/modules/playground/components/playground-explorer';
import { useFileExplorer } from '@/modules/playground/hooks/useFileExplorer';
import { TemplateFile, TemplateFolder } from '@/modules/playground/lib/path-to-json';
import { Button } from '@/components/ui/button';
import { AlertCircle, Bot, FileText, FolderOpen, Save, Settings, X } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import PlaygroundEditor from '@/modules/playground/components/playground-editor';
import { useWebContainer } from '@/modules/webcontainers/hooks/useWebContainer';
import WebContainerPreview from '@/modules/webcontainers/components/webcontainer-preview';
import LoadingStep from '@/modules/playground/components/loader';
import { findFilePath } from '@/modules/playground/lib';
import { toast } from 'sonner';
import ToggleAI from '@/modules/playground/components/toggle-ai';
import { useAISuggestions } from '@/modules/playground/hooks/useAISuggestion';

const MainPlaygroundPage = () => {
    const {id} = useParams<{id:string}>();

    const [isPreviewVisible, setIsPreviewAvailable] = useState(true);
    const [previewRefreshKey, setPreviewRefreshKey] = useState(0);

    const {playgroundData, templateData, isLoading, error, saveTemplateData} = usePlayground(id);

    const aiSuggestions = useAISuggestions();

    const {
      setTemplateData,
      setActiveFileId,
      setPlaygroundId,
      setOpenFiles,
      activeFileId,
      closeAllFiles,
      openFile,
      openFiles,
      closeFile,

      handleAddFile,
      handleAddFolder,
      handleDeleteFile,
      handleDeleteFolder,
      handleRenameFile,
      handleRenameFolder,
      updateFileContent
    } = useFileExplorer();

    const {
      serverUrl, 
      isLoading: containerLoading, 
      error: containerError, 
      instance, 
      writeFileSync, 
      //@ts-ignore
    } = useWebContainer({templateData});

    const lastSyncedContent = useRef<Map<string, string>>(new Map());

    useEffect(() => {setPlaygroundId(id)}, [id, setPlaygroundId]);

    useEffect(() => {
      if(templateData && !openFiles.length) {   
        setTemplateData(templateData);    //this means that if we have template data but no open files, then set template data 
      }
    }, [templateData, setTemplateData, openFiles.length])

    // Create wrapper functions that pass saveTemplateData
  const wrappedHandleAddFile = useCallback(
    (newFile: TemplateFile, parentPath: string) => {
      return handleAddFile(
        newFile,
        parentPath,
        //@ts-ignore
        writeFileSync!,
        instance,
        saveTemplateData
      );
    },
    [handleAddFile, writeFileSync, instance, saveTemplateData]
  );

  const wrappedHandleAddFolder = useCallback(
    (newFolder: TemplateFolder, parentPath: string) => {
      return handleAddFolder(newFolder, parentPath, instance, saveTemplateData);
    },
    [handleAddFolder, instance, saveTemplateData]
  );

  const wrappedHandleDeleteFile = useCallback(
    (file: TemplateFile, parentPath: string) => {
      return handleDeleteFile(file, parentPath, saveTemplateData);
    },
    [handleDeleteFile, saveTemplateData]
  );

  const wrappedHandleDeleteFolder = useCallback(
    (folder: TemplateFolder, parentPath: string) => {
      return handleDeleteFolder(folder, parentPath, saveTemplateData);
    },
    [handleDeleteFolder, saveTemplateData]
  );

  const wrappedHandleRenameFile = useCallback(
    (
      file: TemplateFile,
      newFilename: string,
      newExtension: string,
      parentPath: string
    ) => {
      return handleRenameFile(
        file,
        newFilename,
        newExtension,
        parentPath,
        saveTemplateData
      );
    },
    [handleRenameFile, saveTemplateData]
  );

  const wrappedHandleRenameFolder = useCallback(
    (folder: TemplateFolder, newFolderName: string, parentPath: string) => {
      return handleRenameFolder(
        folder,
        newFolderName,
        parentPath,
        saveTemplateData
      );
    },
    [handleRenameFolder, saveTemplateData]
  );

  const activeFile = openFiles.find((file) => file.id === activeFileId);
  const hasUnsavedChanges = openFiles.some((file) => file.hasUnsavedChanges);
  const handleFileSelect = (file: TemplateFile) => {
    openFile(file);
  };

  const handleSave = useCallback(async (fileId?: string) => {
    const targetFileId = fileId || activeFileId;
    if(!targetFileId) return;

    const fileToSave = openFiles.find((f) => f.id === targetFileId);
    if(!fileToSave) return;

    const latestTemplateData = useFileExplorer.getState().templateData;
    if(!latestTemplateData) return;

    try {
      const filePath = findFilePath(fileToSave, latestTemplateData);
      if(!filePath) {
        toast.error(`Could not find path for file : ${fileToSave.filename}.${fileToSave.fileExtension}`);
        return;
      }

      const updatedTemplateData = JSON.parse(JSON.stringify(latestTemplateData));

      const updateFileContent = (items: any[] = []): any[] => {
        return items.map((item) => {
          if ("folderName" in item) {
            return {
              ...item,
              items: updateFileContent(item.items ?? []),
            };
          }

          if (
            item.fileName === fileToSave.filename &&
            item.fileExtension === fileToSave.fileExtension
          ) {
            return {
              ...item,
              content: fileToSave.content,
            };
          }

          return item;
        });
      };

      updatedTemplateData.items = updateFileContent(updatedTemplateData.items ?? []);

      //sync with webContainer
      if(writeFileSync) {
        await writeFileSync(filePath, fileToSave.content);
        lastSyncedContent.current.set(fileToSave.id, fileToSave.content);

        if(instance && instance.fs) {
          await instance.fs.writeFile(filePath, fileToSave.content);
        }

        const newTemplateData = await saveTemplateData(updatedTemplateData);
        //@ts-ignore
        setTemplateData(newTemplateData || updatedTemplateData);
      }

      //update open files
      const updatedOpenFiles = openFiles.map((f) => f.id === targetFileId ? {
        ...f,
        content: fileToSave.content,
        originalContent: fileToSave.content,
        hasUnsavedChanges: false
      } : f);
      setOpenFiles(updatedOpenFiles);
      setPreviewRefreshKey((prev) => prev + 1);

      toast.success(`Saved ${fileToSave.filename}.${fileToSave.fileExtension}`);
    } catch (error) {
      console.error(`Failed to save ${fileToSave.filename}.${fileToSave.fileExtension}`);
    }
  }, [
    activeFileId,
    openFiles,
    writeFileSync,
    instance,
    saveTemplateData,
    setTemplateData,
    setOpenFiles
  ])

  const handleSaveAll = async () => {
    const unsavedFiles = openFiles.filter((f) => f.hasUnsavedChanges);
    if(unsavedFiles.length === 0) {
      toast.info("No unsaved changes");
      return;
    } 

    try {
      await Promise.all(unsavedFiles.map((f) => handleSave(f.id)));
      toast.success(`Saved ${unsavedFiles.length} file(s)`);
    } catch (error) {
      toast.error("Failed to save some files");
    }
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isSaveShortcut = (e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === "s" || e.code === "KeyS");

      if (!isSaveShortcut) return;

      e.preventDefault();
      e.stopPropagation();
      void handleSave(activeFileId || undefined);
    };

    document.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [handleSave, activeFileId]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-4rem)] p-4">
        <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
        <h2 className="text-xl font-semibold text-red-600 mb-2">
          Something went wrong
        </h2>
        <p className="text-gray-600 mb-4">{error}</p>
        <Button onClick={() => window.location.reload()} variant="destructive">
          Try Again
        </Button>
      </div>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-4rem)] p-4">
        <div className="w-full max-w-md p-6 rounded-lg shadow-sm border">
          <h2 className="text-xl font-semibold mb-6 text-center">
            Loading Playground
          </h2>
          <div className="mb-8">
            <LoadingStep
              currentStep={1}
              step={1}
              label="Loading playground data"
            />
            <LoadingStep
              currentStep={2}
              step={2}
              label="Setting up environment"
            />
            <LoadingStep currentStep={3} step={3} label="Ready to code" />
          </div>
        </div>
      </div>
    );
  }

  // No template data
  if (!templateData) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-4rem)] p-4">
        <FolderOpen className="h-12 w-12 text-amber-500 mb-4" />
        <h2 className="text-xl font-semibold text-amber-600 mb-2">
          No template data available
        </h2>
        <Button onClick={() => window.location.reload()} variant="outline">
          Reload Template
        </Button>
      </div>
    );
  }
    
  return (
    <TooltipProvider>
      <>
        {/* Template file tree */}
        <TemplateFileTree
          data={templateData!}
          onFileSelect={handleFileSelect}
          selectedFile={activeFile}
          title="File Explorer"
          onAddFile={wrappedHandleAddFile}
          onAddFolder={wrappedHandleAddFolder}
          onDeleteFile={wrappedHandleDeleteFile}
          onDeleteFolder={wrappedHandleDeleteFolder}
          onRenameFile={wrappedHandleRenameFile}
          onRenameFolder={wrappedHandleRenameFolder}
        />
        <SidebarInset>
          <header className='flex h-16 shrink-0 items-center gap-2 border-b px-4'>
            <SidebarTrigger className='-ml-1'/>
            <Separator orientation='vertical' className='mr-2 h-4'/>

            <div className='flex flex-1 items-center gap-2'>
              <div className='flex flex-col flex-1'>
                <h1 className='text-sm font-medium'>
                  {playgroundData?.title || "Code playground"} 
                </h1>
                <p className='text-xs text-muted-foreground'>{openFiles.length} File(s) Open
                  {hasUnsavedChanges && " . Unsaved changes"}
                </p>
              </div>

              <div className='flex items-center gap-1'>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                    size="sm"
                    variant="outline"
                    onClick={() => handleSave()}
                    disabled={!activeFile || !activeFile.hasUnsavedChanges}
                    >
                      <Save className='h-4 w-4'/>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Save (Ctrl + S)</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                    size="sm"
                    variant="outline"
                    onClick={handleSaveAll}
                    disabled={!hasUnsavedChanges}
                    >
                      <Save className='h-4 w-4'/> All
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Save All (Ctrl + Shift + S)</TooltipContent>
                </Tooltip>

                <ToggleAI
                isEnabled={aiSuggestions.isEnabled}
                onToggle={aiSuggestions.toggleEnabled}
                suggestionLoading={aiSuggestions.isLoading}
                />

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" variant="outline">
                      <Settings className='h-4 w-4'/>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align='end'>
                    <DropdownMenuItem onClick={() => setIsPreviewAvailable(!isPreviewVisible)}>
                      {isPreviewVisible ? "Hide" : "Show"} Preview
                    </DropdownMenuItem>
                    <DropdownMenuSeparator/>
                    <DropdownMenuItem onClick={closeAllFiles}>
                      Close All Files
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </header>

          <div className='h-[calc(100vh-4rem)]'>
            {
              openFiles.length > 0 ? (
                <div className='h-full flex flex-col'>
                  <div className='border-b bg-muted/30'> 
                    <Tabs value={activeFileId || ""} onValueChange={setActiveFileId}>
                      <div className="flex items-center justify-between px-4 py-2">
                        <TabsList className="h-8 bg-transparent p-0">
                          {openFiles.map((file) => (
                            <TabsTrigger
                              key={file.id}
                              value={file.id}
                              className="relative h-8 px-3 data-[state=active]:bg-background data-[state=active]:shadow-sm group"
                            >
                              <div className="flex items-center gap-2">
                                <FileText className="h-3 w-3" />
                                <span>
                                  {file.filename}.{file.fileExtension}
                                </span>
                                {file.hasUnsavedChanges && (
                                  <span className="h-2 w-2 rounded-full bg-orange-500" />
                                )}
                                <span
                                  className="ml-2 h-4 w-4 hover:bg-destructive hover:text-destructive-foreground rounded-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    closeFile(file.id);
                                  }}
                                >
                                  <X className="h-3 w-3" />
                                </span>
                              </div>
                            </TabsTrigger>
                          ))}
                        </TabsList>

                        {openFiles.length > 1 && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={closeAllFiles}
                            className="h-6 px-2 text-xs"
                          >
                            Close All
                          </Button>
                        )}
                      </div>
                    </Tabs>
                  </div>

                  <div className='flex-1'>
                      <ResizablePanelGroup className='h-full'>
                        <ResizablePanel defaultSize={isPreviewVisible ? 50 : 100}>
                          <PlaygroundEditor
                          activeFile={activeFile}
                          content={activeFile?.content || ""}
                          onContentChange={(value) => {
                            activeFileId && updateFileContent(activeFileId, value);
                          }}
                          />
                        </ResizablePanel>

                        {
                          isPreviewVisible && (
                            <>
                              <ResizableHandle />
                              <ResizablePanel defaultSize={50}>
                                {/* render web container preview component */}
                                <WebContainerPreview 
                                //@ts-ignore
                                templateData={templateData}
                                instance={instance}
                                //@ts-ignore

                                writeFileSync={writeFileSync}
                                isLoading={containerLoading}
                                refreshKey={previewRefreshKey}
                                error={containerError}
                                //@ts-ignore

                                serverUrl={serverUrl}
                                forceResetup={false}
                                />
                              </ResizablePanel>
                            </>
                          )
                        }
                      </ResizablePanelGroup>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col h-full items-center justify-center text-muted-foreground gap-4">
                  <FileText className="h-16 w-16 text-gray-300" />
                  <div className="text-center">
                    <p className="text-lg font-medium">No files open</p>
                    <p className="text-sm text-gray-500">
                      Select a file from the sidebar to start editing
                    </p>
                  </div>
                </div>
              )
            }
          </div>

        </SidebarInset>
      </>
    </TooltipProvider>
  )
}

export default MainPlaygroundPage