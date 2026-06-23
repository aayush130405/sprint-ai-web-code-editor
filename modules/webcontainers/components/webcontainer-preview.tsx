"use client"

import { transformToWebContainerFormat } from '../hooks/transformer'
import { CheckCircle, Loader2, XCircle } from 'lucide-react'
import { Progress } from '@/components/ui/progress'
import { TemplateFolder } from '@/modules/playground/lib/path-to-json'
import { WebContainer } from '@webcontainer/api'
import React, {useEffect, useState, useRef} from 'react'

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