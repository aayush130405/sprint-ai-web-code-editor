import {useState, useCallback} from "react";

interface AISuggestionState {
    suggestion: string | null;
    isLoading: boolean;
    position: {line: number; column: number} | null;
    decoration: string[];
    isEnabled: boolean;
}

interface useAISuggestionsReturn extends AISuggestionState {
    toggleEnabled: () => void;
    fetchSuggestion: (type: string, editor: any) => Promise<void>;
    acceptSuggestion: (editor: any, monaco: any) => void;
    rejectSuggestion: (editor: any) => void;
    clearSuggestion: (editor: any) => void;
}

export const useAISuggestions = (): useAISuggestionsReturn => {
    const [state, setState] = useState<AISuggestionState>({
        suggestion: null,
        isLoading: false,
        position: null,
        decoration: [],
        isEnabled: true,
    });

    //used to toggle the AI enabled option, i.e. enable if disabled and vice versa
    const toggleEnabled = useCallback(() => {
        setState((prev) => ({...prev, isEnabled: !prev.isEnabled}));
    }, [])

    //used to send payload to API endpoint in order to request AI for suggestion
    const fetchSuggestion = useCallback(async (type: string, editor: any) => {
        setState((currentState) => {
            if(!currentState.isEnabled) {
                return currentState;
            }

            if(!editor) {
                return currentState;
            }

            const model = editor.getModel();        //will get whatever is written in the code editor
            const cursorPosition = editor.getPosition();    //will grab the current cursor position in the editor

            if(!model || !cursorPosition) {
                return currentState;
            } 

            const newState = {...currentState, isLoading: true};

            (async () => {      //this is an immediately invoked function. we used this because this callback inside setState can not be async alone
                try {
                    const payload = {
                        fileContent: model.getValue(),
                        cursorLine: cursorPosition.lineNumber - 1,
                        cursorColumn: cursorPosition.column - 1,
                        suggestionType: type
                    }

                    const response = await fetch("/api/code-suggestions", {
                        method: "POST",
                        headers: {"Content-Type": "application/json"},
                        body: JSON.stringify(payload)
                    })

                    if(!response.ok) {
                        throw new Error(`API responded with status ${response.status}`)
                    }

                    const data = await response.json();

                    if(data.suggestion) {
                        //suggestion received
                        const suggestionText = data.suggestion.trim();
                        setState((prev) => ({
                            ...prev,
                            suggestion: suggestionText,
                            position: {
                                line: cursorPosition.line,
                                column: cursorPosition.column
                            },
                            isLoading: false
                        }));
                    } else {
                        //no suggestion received
                        console.warn("No suggestion received from API");
                        setState((prev) => ({...prev, isLoading: false}));
                    }
                } catch (error) { 
                    console.error("Error fetching code suggestion", error);
                    setState((prev) => ({...prev, isLoading: false}));
                }
            })()  
            
            return newState;
        })
    }, [])

    //used to get the suggestion from AI and insert in the codebase, remove decorations and later remove the suggestion from the memory
    const acceptSuggestion = useCallback(() => {
        (editor: any, monaco: any) => {
            setState((currentState) => {
                if(!currentState.suggestion || !currentState.position || !editor || !monaco) {
                    return currentState;
                }

                const {line, column} = currentState.position;
                const sanitizedSuggestion = currentState.suggestion.replace(/^\d+:\s*/gm, "");  //making suggestion monaco compatible... in this case removing line numbers from the AI response

                editor.executeEdits("", [
                    {
                        range: new monaco.Range(line, column, line, column),
                        text: sanitizedSuggestion,
                        forceMoveMarkers: true,
                    }
                ]);

                if(editor && currentState.decoration.length > 0) {
                    editor.deltaDecorations(currentState.decoration, []);
                } 

                return {
                    ...currentState,
                    suggestion: null,
                    position: null,
                    decoration: []
                }
            })
        }
    }, [])

    const rejectSuggestion = useCallback((editor:any)=>{
            setState((currentState)=>{
                 if(editor && currentState.decoration.length > 0){
                    editor.deltaDecorations(currentState.decoration , [])
                }

                return {
                    ...currentState,
                    suggestion:null,
                    position:null,
                    decoration:[]
                }
            })
    },[]);
 
    const clearSuggestion = useCallback((editor: any) => {
        setState((currentState) => {
          if (editor && currentState.decoration.length > 0) {
            editor.deltaDecorations(currentState.decoration, []);
          }
          return {
            ...currentState,
            suggestion: null,
            position: null,
            decoration: [],
          };
    });
  }, []);

  return {
    ...state,
    toggleEnabled,
    fetchSuggestion,
    acceptSuggestion,
    rejectSuggestion,
    clearSuggestion
  }
}