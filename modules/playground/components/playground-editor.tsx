/**
 * Placeholder for the Monaco (or similar) code editor component. Intended to replace the raw
 * `{activeFile?.content}` text dump in the playground page with a full-featured editor that
 * binds to `useFileExplorer`'s `editorContent`, tracks `hasUnsavedChanges`, and supports
 * syntax highlighting per file extension. Not yet implemented — wire this up when adding the
 * editor pane between the tab bar and the preview panel.
 */
"use client"

import React, {useRef, useEffect, useCallback} from 'react'
import Editor, { type Monaco } from '@monaco-editor/react'
import { configureMonaco, defaultEditorOptions, getEditorLanguage } from '../lib/editor-config'
import type { TemplateFile } from '../lib/path-to-json'

interface PlaygroundEditorProps {
    activeFile: TemplateFile | undefined
    content: string
    onContentChange: (value: string) => void
}

const PlaygroundEditor = ({
    activeFile,
    content,
    onContentChange
} : PlaygroundEditorProps) => {
    const editorRef = useRef<any>(null);
    const monacoRef = useRef<Monaco | null>(null);

    const handleEditorDidMount = (editor: any, monaco: Monaco) => {
        editorRef.current = editor;
        monacoRef.current = monaco;
        console.log("Editor instance mounted", !!editorRef.current);

        editor.updateOptions({
            ...defaultEditorOptions
        });

        configureMonaco(monaco);

        updateEditorLanguage();
    }

    const updateEditorLanguage = () => {
        if(!activeFile || !monacoRef.current || !editorRef.current) return;
        
        const model = editorRef.current.getModel();
        if(!model) return;

        const language = getEditorLanguage(activeFile.fileExtension || "");

        try {
            monacoRef.current.editor.setModelLanguage(model, language);
        } catch (error) {
            console.warn("Failed to set editor language", error);
        }
    }

    useEffect(() => {
        updateEditorLanguage()
    }, [])

  return (
    <div className='h-full relative'>
        <Editor
            height={"100%"}
            value={content}
            onChange={(value) => onContentChange(value || "")}
            onMount={handleEditorDidMount}
            language={activeFile ? getEditorLanguage(activeFile.fileExtension || "") : "plaintext"}
            //@ts-ignore
            options={defaultEditorOptions}
        />
    </div>
  )
}

export default PlaygroundEditor