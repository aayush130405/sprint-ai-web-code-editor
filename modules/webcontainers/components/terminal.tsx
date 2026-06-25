/**
 * WebContainer Terminal Component
 * ================================
 *
 * This file builds a browser-based terminal UI that runs real shell commands inside
 * a WebContainer (StackBlitz's in-browser Node.js runtime). Think of it as three layers:
 *
 *   1. **xterm.js** — Renders the terminal pixels, cursor, colors, and scrollback.
 *   2. **This component** — Handles keyboard input, command history, and toolbar actions.
 *   3. **WebContainer API** — Actually spawns processes (ls, npm, node, etc.) in the sandbox.
 *
 * Data flow when you press Enter:
 *   keystroke → handleTerminalInput → executeCommand → webContainerInstance.spawn()
 *   → process output streams back → term.write() → you see output on screen
 *
 * Why `forwardRef` + `useImperativeHandle`?
 *   Parent components can call writeToTerminal(), clearTerminal(), or focusTerminal()
 *   without passing callback props down — useful for programmatic output (e.g. build logs).
 */

"use client"; // Required: xterm and WebContainer only work in the browser, not during SSR

import React, { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle } from "react";
import { Terminal } from "xterm"; // Core terminal emulator library
import { FitAddon } from "xterm-addon-fit"; // Auto-resizes terminal cols/rows when container resizes
import { WebLinksAddon } from "xterm-addon-web-links"; // Makes URLs in output clickable
import { SearchAddon } from "xterm-addon-search"; // Find-in-terminal (used by the search toolbar)
import "xterm/css/xterm.css"; // Default xterm styling — we override colors via `theme` below
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Copy, Trash2, Download } from "lucide-react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Props & Ref types
// ---------------------------------------------------------------------------

interface TerminalProps {
  webcontainerUrl?: string; // Reserved for future use (e.g. linking to preview URL)
  className?: string; // Extra Tailwind classes on the outer wrapper
  theme?: "dark" | "light"; // Terminal color scheme
  webContainerInstance?: any; // The booted WebContainer from useWebContainer — required to run commands
}

/** Methods exposed to parent components via ref={terminalRef} */
export interface TerminalRef {
  writeToTerminal: (data: string) => void; // Append raw text to the terminal (no newline)
  clearTerminal: () => void; // Wipe screen and show welcome message again
  focusTerminal: () => void; // Focus keyboard input into xterm
}

// forwardRef lets parents attach a ref; inner logic stays encapsulated
const TerminalComponent = forwardRef<TerminalRef, TerminalProps>(({
  webcontainerUrl,
  className,
  theme = "dark",
  webContainerInstance
}, ref) => {

  // ---------------------------------------------------------------------------
  // Refs — values that persist across renders WITHOUT triggering re-renders
  // ---------------------------------------------------------------------------
  // We use refs for xterm/WebContainer handles because mutating them should not
  // cause React to re-render the whole component.

  const terminalRef = useRef<HTMLDivElement>(null); // DOM node xterm mounts into
  const term = useRef<Terminal | null>(null); // The xterm.js Terminal instance
  const fitAddon = useRef<FitAddon | null>(null); // Keeps terminal sized to its container
  const searchAddon = useRef<SearchAddon | null>(null); // Powers the search toolbar

  // State — values that SHOULD trigger UI updates when they change
  const [isConnected, setIsConnected] = useState(false); // Shows green "Connected" badge in header
  const [searchTerm, setSearchTerm] = useState(""); // Current search box text
  const [showSearch, setShowSearch] = useState(false); // Toggles search input visibility

  // Shell-like input state (kept in refs because keystrokes don't need React re-renders)
  const currentLine = useRef<string>(""); // Text typed after the `$ ` prompt (before Enter)
  const cursorPosition = useRef<number>(0); // Insertion index within currentLine (for backspace)
  const commandHistory = useRef<string[]>([]); // Previous commands (Up/Down arrow navigation)
  const historyIndex = useRef<number>(-1); // -1 = not browsing history; 0..n = index in history
  const currentProcess = useRef<any>(null); // Running WebContainer child process (for Ctrl+C kill)
  const shellProcess = useRef<any>(null); // Reserved for a persistent shell process (currently unused)

  // ---------------------------------------------------------------------------
  // Color themes — maps to xterm's ITheme interface (ANSI 16-color palette + bg/fg)
  // ---------------------------------------------------------------------------
  const terminalThemes = {
    dark: {
      background: "#09090B",
      foreground: "#FAFAFA",
      cursor: "#FAFAFA",
      cursorAccent: "#09090B",
      selection: "#27272A",
      black: "#18181B",
      red: "#EF4444",
      green: "#22C55E",
      yellow: "#EAB308",
      blue: "#3B82F6",
      magenta: "#A855F7",
      cyan: "#06B6D4",
      white: "#F4F4F5",
      brightBlack: "#3F3F46",
      brightRed: "#F87171",
      brightGreen: "#4ADE80",
      brightYellow: "#FDE047",
      brightBlue: "#60A5FA",
      brightMagenta: "#C084FC",
      brightCyan: "#22D3EE",
      brightWhite: "#FFFFFF",
    },
    light: {
      background: "#FFFFFF",
      foreground: "#18181B",
      cursor: "#18181B",
      cursorAccent: "#FFFFFF",
      selection: "#E4E4E7",
      black: "#18181B",
      red: "#DC2626",
      green: "#16A34A",
      yellow: "#CA8A04",
      blue: "#2563EB",
      magenta: "#9333EA",
      cyan: "#0891B2",
      white: "#F4F4F5",
      brightBlack: "#71717A",
      brightRed: "#EF4444",
      brightGreen: "#22C55E",
      brightYellow: "#EAB308",
      brightBlue: "#3B82F6",
      brightMagenta: "#A855F7",
      brightCyan: "#06B6D4",
      brightWhite: "#FAFAFA",
    },
  };

  /**
   * Writes a fresh command prompt: newline + `$ ` and resets input buffers.
   * Called after every command finishes (success, error, or built-in like `clear`).
   */
  const writePrompt = useCallback(() => {
    if (term.current) {
      term.current.write("\r\n$ "); // \r\n = CRLF (standard terminal line ending)
      currentLine.current = "";
      cursorPosition.current = 0;
    }
  }, []);

  // ---------------------------------------------------------------------------
  // Imperative API — what parent components can call via ref
  // ---------------------------------------------------------------------------
  useImperativeHandle(ref, () => ({
    writeToTerminal: (data: string) => {
      if (term.current) {
        term.current.write(data);
      }
    },
    clearTerminal: () => {
      clearTerminal();
    },
    focusTerminal: () => {
      if (term.current) {
        term.current.focus();
      }
    },
  }));

  /**
   * Runs a command string inside the WebContainer sandbox.
   *
   * Built-in commands handled locally (never spawned):
   *   - `clear`   → wipe xterm buffer
   *   - `history` → print commandHistory ref
   *   - `` (empty) → just show a new prompt
   *
   * Everything else is split on spaces and passed to webContainerInstance.spawn().
   */
  const executeCommand = useCallback(async (command: string) => {
    if (!webContainerInstance || !term.current) return;

    // Dedupe consecutive identical commands in history (like bash HIST_IGNORE_DUPS)
    if (command.trim() && commandHistory.current[commandHistory.current.length - 1] !== command) {
      commandHistory.current.push(command);
    }
    historyIndex.current = -1; // Reset Up/Down navigation after submitting

    try {
      // --- Built-in: clear ---
      if (command.trim() === "clear") {
        term.current.clear();
        writePrompt();
        return;
      }

      // --- Built-in: history ---
      if (command.trim() === "history") {
        commandHistory.current.forEach((cmd, index) => {
          term.current!.writeln(`  ${index + 1}  ${cmd}`);
        });
        writePrompt();
        return;
      }

      // --- Built-in: empty line ---
      if (command.trim() === "") {
        writePrompt();
        return;
      }

      // Split "npm install lodash" → cmd="npm", args=["install", "lodash"]
      const parts = command.trim().split(' ');
      const cmd = parts[0];
      const args = parts.slice(1);

      // Spawn a real process in the WebContainer filesystem
      term.current.writeln("");
      const process = await webContainerInstance.spawn(cmd, args, {
        // Tell WebContainer how big our terminal is so output wraps correctly
        terminal: {
          cols: term.current.cols,
          rows: term.current.rows,
        },
      });

      currentProcess.current = process; // Track so Ctrl+C can kill it

      // Stream stdout/stderr from the process into xterm as it arrives
      process.output.pipeTo(new WritableStream({
        write(data) {
          if (term.current) {
            term.current.write(data);
          }
        },
      }));

      // Block until the process exits (like waiting for a shell command to finish)
      const exitCode = await process.exit;
      currentProcess.current = null;

      writePrompt();

    } catch (error) {
      // spawn() throws if the binary doesn't exist (similar to "command not found")
      if (term.current) {
        term.current.writeln(`\r\nCommand not found: ${command}`);
        writePrompt();
      }
      currentProcess.current = null;
    }
  }, [webContainerInstance, writePrompt]);

  /**
   * xterm calls this on every keystroke via terminal.onData().
   * `data` is a raw string — often a single character, but special keys send
   * escape sequences (e.g. Up arrow = "\u001b[A").
   */
  const handleTerminalInput = useCallback((data: string) => {
    if (!term.current) return;

    switch (data) {
      case '\r': // Enter key — submit the current line as a command
        executeCommand(currentLine.current);
        break;

      case '\u007F': // Backspace (DEL) — delete char before cursor
        if (cursorPosition.current > 0) {
          // Update our in-memory line buffer
          currentLine.current =
            currentLine.current.slice(0, cursorPosition.current - 1) +
            currentLine.current.slice(cursorPosition.current);
          cursorPosition.current--;

          // Visually erase one char: move cursor back, overwrite with space, move back again
          term.current.write('\b \b');
        }
        break;

      case '\u0003': // Ctrl+C — interrupt the running process
        if (currentProcess.current) {
          currentProcess.current.kill();
          currentProcess.current = null;
        }
        term.current.writeln("^C"); // Standard shell notation for interrupt
        writePrompt();
        break;

      case '\u001b[A': // Up arrow — walk backward through command history
        if (commandHistory.current.length > 0) {
          if (historyIndex.current === -1) {
            // First press: jump to most recent command
            historyIndex.current = commandHistory.current.length - 1;
          } else if (historyIndex.current > 0) {
            historyIndex.current--;
          }

          const historyCommand = commandHistory.current[historyIndex.current];
          // Overwrite the current line on screen: carriage return, clear with spaces, rewrite
          term.current.write('\r$ ' + ' '.repeat(currentLine.current.length) + '\r$ ');
          term.current.write(historyCommand);
          currentLine.current = historyCommand;
          cursorPosition.current = historyCommand.length;
        }
        break;

      case '\u001b[B': // Down arrow — walk forward through history (or back to empty line)
        if (historyIndex.current !== -1) {
          if (historyIndex.current < commandHistory.current.length - 1) {
            historyIndex.current++;
            const historyCommand = commandHistory.current[historyIndex.current];
            term.current.write('\r$ ' + ' '.repeat(currentLine.current.length) + '\r$ ');
            term.current.write(historyCommand);
            currentLine.current = historyCommand;
            cursorPosition.current = historyCommand.length;
          } else {
            // Past the newest entry — restore an empty prompt line
            historyIndex.current = -1;
            term.current.write('\r$ ' + ' '.repeat(currentLine.current.length) + '\r$ ');
            currentLine.current = "";
            cursorPosition.current = 0;
          }
        }
        break;

      default:
        // Printable characters (ASCII >= space) and Tab
        if (data >= ' ' || data === '\t') {
          // Insert at cursor position (supports mid-line editing in theory)
          currentLine.current =
            currentLine.current.slice(0, cursorPosition.current) +
            data +
            currentLine.current.slice(cursorPosition.current);
          cursorPosition.current++;
          term.current.write(data);
        }
        break;
    }
  }, [executeCommand, writePrompt]);

  /**
   * Creates the xterm instance once and mounts it into terminalRef DOM node.
   * Guard `term.current` prevents double-initialization on strict-mode double mount.
   */
  const initializeTerminal = useCallback(() => {
    if (!terminalRef.current || term.current) return;

    const terminal = new Terminal({
      cursorBlink: true,
      fontFamily: '"Fira Code", "JetBrains Mono", "Consolas", monospace',
      fontSize: 14,
      lineHeight: 1.2,
      letterSpacing: 0,
      theme: terminalThemes[theme],
      allowTransparency: false,
      convertEol: true, // Normalize \n to \r\n so output from different OSes displays correctly
      scrollback: 1000, // Lines kept in memory above the viewport (scroll up to see old output)
      tabStopWidth: 4,
    });

    // Register xterm plugins
    const fitAddonInstance = new FitAddon();
    const webLinksAddon = new WebLinksAddon();
    const searchAddonInstance = new SearchAddon();

    terminal.loadAddon(fitAddonInstance);
    terminal.loadAddon(webLinksAddon);
    terminal.loadAddon(searchAddonInstance);

    // Attach xterm canvas/DOM to our React-managed div
    terminal.open(terminalRef.current);

    fitAddon.current = fitAddonInstance;
    searchAddon.current = searchAddonInstance;
    term.current = terminal;

    // Wire keyboard input → our custom shell-like handler
    terminal.onData(handleTerminalInput);

    // Delay fit slightly so the container has finished layout (cols/rows would be 0 otherwise)
    setTimeout(() => {
      fitAddonInstance.fit();
    }, 100);

    terminal.writeln("🚀 WebContainer Terminal");
    terminal.writeln("Type 'help' for available commands");
    writePrompt();

    return terminal;
  }, [theme, handleTerminalInput, writePrompt]);

  /**
   * Called once webContainerInstance becomes available from the parent hook.
   * Currently just updates UI state — actual command execution happens in executeCommand.
   */
  const connectToWebContainer = useCallback(async () => {
    if (!webContainerInstance || !term.current) return;

    try {
      setIsConnected(true);
      term.current.writeln("✅ Connected to WebContainer");
      term.current.writeln("Ready to execute commands");
      writePrompt();
    } catch (error) {
      setIsConnected(false);
      term.current.writeln("❌ Failed to connect to WebContainer");
      console.error("WebContainer connection error:", error);
    }
  }, [webContainerInstance, writePrompt]);

  /** Clears scrollback and redraws the welcome banner + prompt */
  const clearTerminal = useCallback(() => {
    if (term.current) {
      term.current.clear();
      term.current.writeln("🚀 WebContainer Terminal");
      writePrompt();
    }
  }, [writePrompt]);

  /** Copies the user's text selection from xterm to the system clipboard */
  const copyTerminalContent = useCallback(async () => {
    if (term.current) {
      const content = term.current.getSelection();
      if (content) {
        try {
          await navigator.clipboard.writeText(content);
        } catch (error) {
          console.error("Failed to copy to clipboard:", error);
        }
      }
    }
  }, []);

  /**
   * Dumps the entire scrollback buffer to a .txt file download.
   * Iterates every line in xterm's internal buffer (including off-screen history).
   */
  const downloadTerminalLog = useCallback(() => {
    if (term.current) {
      const buffer = term.current.buffer.active;
      let content = "";

      for (let i = 0; i < buffer.length; i++) {
        const line = buffer.getLine(i);
        if (line) {
          content += line.translateToString(true) + "\n";
        }
      }

      const blob = new Blob([content], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `terminal-log-${new Date().toISOString().slice(0, 19)}.txt`;
      a.click();
      URL.revokeObjectURL(url); // Free memory — blob URL is no longer needed
    }
  }, []);

  /** Highlights the next match of `term` in the scrollback (SearchAddon) */
  const searchInTerminal = useCallback((term: string) => {
    if (searchAddon.current && term) {
      searchAddon.current.findNext(term);
    }
  }, []);

  // ---------------------------------------------------------------------------
  // Lifecycle effects
  // ---------------------------------------------------------------------------

  /**
   * Mount: initialize xterm + watch container size.
   * Unmount: kill any running processes and dispose xterm (prevents memory leaks).
   */
  useEffect(() => {
    initializeTerminal();

    // When the panel is resized (e.g. user drags a split pane), refit cols/rows
    const resizeObserver = new ResizeObserver(() => {
      if (fitAddon.current) {
        setTimeout(() => {
          fitAddon.current?.fit();
        }, 100);
      }
    });

    if (terminalRef.current) {
      resizeObserver.observe(terminalRef.current);
    }

    return () => {
      resizeObserver.disconnect();
      if (currentProcess.current) {
        currentProcess.current.kill();
      }
      if (shellProcess.current) {
        shellProcess.current.kill();
      }
      if (term.current) {
        term.current.dispose();
        term.current = null;
      }
    };
  }, [initializeTerminal]);

  /**
   * When the parent finishes booting WebContainer, flip isConnected and show status.
   * The `!isConnected` guard ensures this only runs once per mount.
   */
  useEffect(() => {
    if (webContainerInstance && term.current && !isConnected) {
      connectToWebContainer();
    }
  }, [webContainerInstance, connectToWebContainer, isConnected]);

  // ---------------------------------------------------------------------------
  // Render — chrome around the xterm canvas
  // ---------------------------------------------------------------------------
  return (
    <div className={cn("flex flex-col h-full bg-background border rounded-lg overflow-hidden", className)}>
      {/* macOS-style title bar with traffic-light dots + toolbar actions */}
      <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/50">
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
          </div>
          <span className="text-sm font-medium">WebContainer Terminal</span>
          {isConnected && (
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
              <span className="text-xs text-muted-foreground">Connected</span>
            </div>
          )}
        </div>

        {/* Toolbar: search, copy selection, download log, clear screen */}
        <div className="flex items-center gap-1">
          {showSearch && (
            <div className="flex items-center gap-2">
              <Input
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  searchInTerminal(e.target.value); // Live highlight as you type
                }}
                className="h-6 w-32 text-xs"
              />
            </div>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowSearch(!showSearch)}
            className="h-6 w-6 p-0"
          >
            <Search className="h-3 w-3" />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={copyTerminalContent}
            className="h-6 w-6 p-0"
          >
            <Copy className="h-3 w-3" />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={downloadTerminalLog}
            className="h-6 w-6 p-0"
          >
            <Download className="h-3 w-3" />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={clearTerminal}
            className="h-6 w-6 p-0"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* xterm mounts into this div — absolute positioning fills remaining flex space */}
      <div className="flex-1 relative">
        <div
          ref={terminalRef}
          className="absolute inset-0 p-2"
          style={{
            background: terminalThemes[theme].background,
          }}
        />
      </div>
    </div>
  );
});

// Required for React DevTools to show a readable name instead of "ForwardRef"
TerminalComponent.displayName = "TerminalComponent";

export default TerminalComponent;
