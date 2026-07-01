import { type NextRequest, NextResponse } from "next/server";

interface CodeSuggestionRequest {
  fileContent: string;
  cursorLine: number;
  cursorColumn: number;
  suggestionType: string;
  fileName?: string;
}

interface CodeContext {
  language: string;
  framework: string;
  beforeContext: string;
  currentLine: string;
  afterContext: string;
  cursorPosition: { line: number; column: number };
  isInFunction: boolean;
  isInClass: boolean;
  isAfterComment: boolean;
  incompletePatterns: string[];
}

export async function POST(request: NextRequest) {
  try {
    // Get code, cursor position, suggestion type, and optional filename from the editor
    const body: CodeSuggestionRequest = await request.json();
    const { fileContent, cursorLine, cursorColumn, suggestionType, fileName } = body;

    // Basic validation so we don't process incomplete or invalid editor data
    if (!fileContent || cursorLine < 0 || cursorColumn < 0 || !suggestionType) {
      return NextResponse.json({ error: "Invalid input parameters" }, { status: 400 });
    }

    // Extract useful surrounding code information before asking AI
    const context = analyzeCodeContext(fileContent, cursorLine, cursorColumn, fileName);

    // Build a structured prompt using the analyzed editor context
    const prompt = buildPrompt(context, suggestionType);

    // Send the prompt to the local AI model and get back a code suggestion
    const suggestion = await generateSuggestion(prompt);

    // Send the suggestion and useful metadata back to the frontend
    return NextResponse.json({
      suggestion,
      context,
      metadata: {
        language: context.language,
        framework: context.framework,
        position: context.cursorPosition,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    console.error("Context analysis error", error);
    return NextResponse.json(
      { error: "Internal server error", message: error.message },
      { status: 500 }
    );
  }
}

function analyzeCodeContext(
  content: string,
  line: number,
  column: number,
  fileName?: string
): CodeContext {
  const lines = content.split("\n");
  const currentLine = lines[line] || "";

  // Only send nearby lines to AI instead of the entire file context
  const contextRadius = 10;
  const startLine = Math.max(0, line - contextRadius);
  const endLine = Math.min(lines.length, line + contextRadius);

  const beforeContext = lines.slice(startLine, line).join("\n");
  const afterContext = lines.slice(line + 1, endLine).join("\n");

  // Detect basic language/framework info to improve AI response quality
  const language = detectLanguage(content, fileName);
  const framework = detectFramework(content);

  // Detect where the cursor currently is in the code structure
  const isInFunction = detectInFunction(lines, line);
  const isInClass = detectInClass(lines, line);
  const isAfterComment = detectAfterComment(currentLine, column);
  const incompletePatterns = detectIncompletePatterns(currentLine, column);

  return {
    language,
    framework,
    beforeContext,
    currentLine,
    afterContext,
    cursorPosition: { line, column },
    isInFunction,
    isInClass,
    isAfterComment,
    incompletePatterns,
  };
}

function buildPrompt(context: CodeContext, suggestionType: string): string {
  // |CURSOR| marks the exact point where AI should generate insertable code
  return `You are an expert code completion assistant. Generate a ${suggestionType} suggestion.

Language: ${context.language}
Framework: ${context.framework}

Context:
${context.beforeContext}
${context.currentLine.substring(
  0,
  context.cursorPosition.column
)}|CURSOR|${context.currentLine.substring(context.cursorPosition.column)}
${context.afterContext}

Analysis:
- In Function: ${context.isInFunction}
- In Class: ${context.isInClass}
- After Comment: ${context.isAfterComment}
- Incomplete Patterns: ${context.incompletePatterns.join(", ") || "None"}

Instructions:
1. Provide only the code that should be inserted at the cursor
2. Maintain proper indentation and style
3. Follow ${context.language} best practices
4. Make the suggestion contextually appropriate

Generate suggestion:`;
}

async function generateSuggestion(prompt: string): Promise<string> {
  try {
    // Calls local Ollama server running CodeLlama
    const response = await fetch("http://localhost:11434/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "codellama:latest",
        prompt,
        stream: false,
        option: {
          temperature: 0.7,
          max_tokens: 300,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`AI service error: ${response.statusText}`);
    }

    const data = await response.json();
    let suggestion = data.response;

    // Remove markdown code fences if the model returns ```ts ... ```
    if (suggestion.includes("```")) {
      const codeMatch = suggestion.match(/```[\w]*\n?([\s\S]*?)```/);
      suggestion = codeMatch ? codeMatch[1].trim() : suggestion;
    }

    return suggestion;
  } catch (error) {
    console.error("AI generation error:", error);
    return "// AI suggestion unavailable";
  }
}

// Detect language mainly from filename, then fallback to simple content checks
function detectLanguage(content: string, fileName?: string): string {
  if (fileName) {
    const ext = fileName.split(".").pop()?.toLowerCase();
    const extMap: Record<string, string> = {
      ts: "TypeScript",
      tsx: "TypeScript",
      js: "JavaScript",
      jsx: "JavaScript",
      py: "Python",
      java: "Java",
      go: "Go",
      rs: "Rust",
      php: "PHP",
    };
    if (ext && extMap[ext]) return extMap[ext];
  }

  if (content.includes("interface ") || content.includes(": string"))
    return "TypeScript";
  if (content.includes("def ") || content.includes("import ")) return "Python";
  if (content.includes("func ") || content.includes("package ")) return "Go";

  return "JavaScript";
}

// Basic framework detection based on common imports/syntax
function detectFramework(content: string): string {
  if (content.includes("import React") || content.includes("useState"))
    return "React";
  if (content.includes("import Vue") || content.includes("<template>"))
    return "Vue";
  if (content.includes("@angular/") || content.includes("@Component"))
    return "Angular";
  if (content.includes("next/") || content.includes("getServerSideProps"))
    return "Next.js";

  return "None";
}

// Walk upward from current line to guess whether cursor is inside a function
function detectInFunction(lines: string[], currentLine: number): boolean {
  for (let i = currentLine - 1; i >= 0; i--) {
    const line = lines[i];
    if (line?.match(/^\s*(function|def|const\s+\w+\s*=|let\s+\w+\s*=)/))
      return true;
    if (line?.match(/^\s*}/)) break;
  }
  return false;
}

// Walk upward from current line to guess whether cursor is inside a class/interface
function detectInClass(lines: string[], currentLine: number): boolean {
  for (let i = currentLine - 1; i >= 0; i--) {
    const line = lines[i];
    if (line?.match(/^\s*(class|interface)\s+/)) return true;
  }
  return false;
}

// Checks whether the cursor is currently after a comment marker
function detectAfterComment(line: string, column: number): boolean {
  const beforeCursor = line.substring(0, column);
  return /\/\/.*$/.test(beforeCursor) || /#.*$/.test(beforeCursor);
}

// Detects common unfinished code patterns before the cursor
function detectIncompletePatterns(line: string, column: number): string[] {
  const beforeCursor = line.substring(0, column);
  const patterns: string[] = [];

  if (/^\s*(if|while|for)\s*\($/.test(beforeCursor.trim()))
    patterns.push("conditional");
  if (/^\s*(function|def)\s*$/.test(beforeCursor.trim()))
    patterns.push("function");
  if (/\{\s*$/.test(beforeCursor)) patterns.push("object");
  if (/\[\s*$/.test(beforeCursor)) patterns.push("array");
  if (/=\s*$/.test(beforeCursor)) patterns.push("assignment");
  if (/\.\s*$/.test(beforeCursor)) patterns.push("method-call");

  return patterns;
}