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
    const [previewUrl, setPreviewUrl] = useState<string>('');
    const [loadingState, setLoadingState] = useState({
        transforming: false,
        mounting: false,
        installing: false,
        starting: false,
        ready: false
    });
    const [currentStep, setCurrentStep] = useState(0);
    const totalSteps = 4;
    const [setupError, setSetupError] = useState<string | null>(null);
    const [setupComplete, setIsSetupComplete] = useState(false);
    const [isSetupInProgress, setIsSetupInProgress] = useState(false);

  return (
    <div>WebContainerPreview</div>
  )
}

export default WebContainerPreview