/**
 * WebContainer File-System Transformer
 * ------------------------------------
 * Bridges two different ways of representing a project:
 *
 * 1. OUR FORMAT (from `templateData` / `TemplateFolder` in path-to-json.ts)
 *    A nested JSON tree used by the playground editor:
 *    - Files:   { filename, fileExtension, content }
 *    - Folders: { folderName, items: [...] }
 *
 * 2. WEBCONTAINER FORMAT (required by `webcontainer.mount()`)
 *    A flat keyed object where each entry is either:
 *    - { file: { contents: string } }
 *    - { directory: { [name]: file | directory } }
 *
 * USAGE (once wired up in webcontainer-preview or useWebContainer):
 *   const fsTree = transformToWebContainerFormat(templateData);
 *   await instance.mount(fsTree);
 *   await instance.spawn('npm', ['install']);
 *   await instance.spawn('npm', ['run', 'dev']);
 *
 * Example transformation:
 *   Input:  { folderName: "root", items: [{ filename: "App", fileExtension: "tsx", content: "..." }] }
 *   Output: { "App.tsx": { file: { contents: "..." } } }
 */

/** Represents a single node in our template tree (file OR folder). */
interface TemplateItem {
    filename: string;
    fileExtension: string;
    content: string;
    folderName?: string;  // present when this node is a folder
    items?: TemplateItem[]; // children, only on folders
  }
  
  /** WebContainer's shape for a single file node. */
  interface WebContainerFile {
    file: {
      contents: string;
    };
  }
  
  /** WebContainer's shape for a directory node (map of child name → node). */
  interface WebContainerDirectory {
    directory: {
      [key: string]: WebContainerFile | WebContainerDirectory;
    };
  }
  
  /** The full virtual FS object passed to `webcontainer.mount()`. */
  type WebContainerFileSystem = Record<string, WebContainerFile | WebContainerDirectory>;
  
  /**
   * Converts a `TemplateFolder` tree into WebContainer's mount format.
   *
   * @param template - Root folder from playground state (`templateData`)
   * @returns Object ready for `instance.mount(result)`
   */
  export function transformToWebContainerFormat(
    template: { folderName: string; items: TemplateItem[] }
  ): WebContainerFileSystem {
    /**
     * Recursively converts one template item into a WebContainer file or directory node.
     * - Has `folderName` + `items` → directory
     * - Otherwise → file (uses `content`)
     */
    function processItem(item: TemplateItem): WebContainerFile | WebContainerDirectory {
      if (item.folderName && item.items) {
        const directoryContents: WebContainerFileSystem = {};
  
        item.items.forEach((subItem) => {
          // Files: "App.tsx" | Folders: "src"
          const key = subItem.fileExtension
            ? `${subItem.filename}.${subItem.fileExtension}`
            : subItem.folderName!;
          directoryContents[key] = processItem(subItem);
        });
  
        return { directory: directoryContents };
      }
  
      return {
        file: { contents: item.content },
      };
    }
  
    const result: WebContainerFileSystem = {};
  
    // Process each top-level item in the template root
    template.items.forEach((item) => {
      const key = item.fileExtension
        ? `${item.filename}.${item.fileExtension}`
        : item.folderName!;
      result[key] = processItem(item);
    });
  
    return result;
  }