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