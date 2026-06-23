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

                        setCurrentStep(4);
                        setLoadingState((prev) => ({
                            ...prev,
                            starting: true
                        }));
                        return;
                    }
                } catch (error) {
                    
                }

                //step 1 -- transform data
                setLoadingState((prev) => ({...prev, transforming: true}));
                setCurrentStep(1);
                //TODO: terminal logic, that is to transform the data

                //@ts-ignore
                const files = transformToWebContainerFormat(templateData);
                setLoadingState((prev) => ({
                    ...prev,
                    transforming: false,
                    mounting: true
                }));
                setCurrentStep(2);

                //step 2 ---mounting files
                //TODO: terminal logic
                await instance.mount(files);

                //TODO: terminal logic
                setLoadingState((prev) => ({
                    ...prev,
                    mounting: false,
                    installing: true
                }));
                setCurrentStep(3);

                //step 3 -- installing dependencies
                //TODO: terminal logic
                const installProcess = await instance.spawn("npm", ["install"]);
                installProcess.output.pipeTo(
                    new WritableStream({
                        write(data) {
                            //TODO: terminal logic
                        }
                    })
                )

                const installExitCode = await installProcess.exit;
                if(installExitCode !== 0) {
                    throw new Error(`Failed to install dependencies. Exit code : ${installExitCode}`);
                }

                //TODO: terminal logic

                setLoadingState((prev) => ({
                    ...prev,
                    installing: false,
                    starting: true
                }))
                setCurrentStep(4);

                //step 4 -- start the server
                //TODO: terminal logic
                const startProcess = await instance.spawn("npm", ["run", "start"]);
                instance.on('server-ready', (port: number, url: string) => {
                    //TODO: terminal logic
                    setPreviewUrl(url);
                    setLoadingState((prev) => ({
                        ...prev,
                        starting: false,
                        ready: true
                    }));
                    setIsSetupComplete(true);
                    setIsSetupInProgress(false);
                })

                startProcess.output.pipeTo(
                    new WritableStream({
                        write(data) {
                            //TODO: terminal logic
                        }
                    })
                )
            } catch (error) {
                console.error("Error setting up container:", error);
                const errorMessage = error instanceof Error ? error.message : String(error);
                //TODO: terminal logic
                setSetupError(errorMessage);
                setIsSetupInProgress(false);
                setLoadingState({
                    transforming: false,
                    mounting: false,
                    installing: false,
                    starting: false,
                    ready: false
                });
            }
        }

        setupContainer();
    }, [instance, templateData, isSetupComplete, isSetupInProgress])

    useEffect(() => {
        return () => {
            //cleanup function
        }
    }, [])

  return (
    <div>WebContainerPreview</div>
  )
}

export default WebContainerPreview