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
    const [isSetupComplete, setIsSetupComplete] = useState(false);
    const [isSetupInProgress, setIsSetupInProgress] = useState(false);

    useEffect(() => {
        async function setupContainer() {
            if(!instance || isSetupInProgress || isSetupComplete) return;

            try {
                setIsSetupInProgress(true);
                setSetupError(null);

                try {
                    const packageJsonExists = await instance.fs.readFile('package.json', "utf-8");
                    if(packageJsonExists) {
                        //no need to setup again just restore previous one
                        //TODO: terminal logic
                        instance.on('server-ready', (port: number, url: string) => {
                            //TODO: terminal logic

                            setPreviewUrl(url);
                            setLoadingState((prev) => ({        
                                ...prev,
                                starting: false,
                                ready: true
                            }))
                            /*
                                `prev` contains the current state before the update. The spread operator (`...prev`)
                                copies all the existing state values into a new object. Then we only change the values
                                we want (`starting` and `ready`). This means all other state properties stay exactly
                                the same, and only these two fields are updated.
                            */
                        })
                    }
                } catch (error) {
                    
                }
            } catch (error) {
                
            }
        }

        setupContainer();
    }, [instance, templateData, isSetupComplete, isSetupInProgress])

  return (
    <div>WebContainerPreview</div>
  )
}

export default WebContainerPreview