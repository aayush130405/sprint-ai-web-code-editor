import { TemplateFolder } from '@/modules/playground/lib/path-to-json'
import { WebContainer } from '@webcontainer/api'
import React from 'react'

interface WebContainerPreviewProps {
    templateData: TemplateFolder,
    serverUrl: string,
    isLoading: boolean,
    error: string | null,
    instance: WebContainer | null,
    writeFileSync: (path: string, content: string) => Promise<void>,
    forceResetup?: boolean      //optional prop to force resetup
}

const WebContainerPreview = ({
    templateData,
    serverUrl,
    isLoading,
    error,
    instance,
    writeFileSync,
    forceResetup = false
}: WebContainerPreviewProps) => {
    

  return (
    <div>WebContainerPreview</div>
  )
}

export default WebContainerPreview