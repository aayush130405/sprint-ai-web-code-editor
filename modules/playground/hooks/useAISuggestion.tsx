import {useState, useCallback} from "react";

interface AISuggestionState {
    suggestion: string | null;
    isLoading: boolean;
    position: {line: number; column: number} | null;
    decoration: string[];
    isEnabled: boolean;
}