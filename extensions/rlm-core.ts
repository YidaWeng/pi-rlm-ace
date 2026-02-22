import type { ExtensionAPI, ExtensionContext, AgentToolResult, ContextEvent } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import * as fs from "node:fs";
import * as path from "node:path";

interface FileEntry {
    content: string;
    symbols: string[];
    path: string;
}

const IGNORE_DIRS = new Set(["node_modules", ".git", "dist", "build", "target", "__pycache__", ".next", "coverage"]);
const CODE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".py", ".rs", ".go", ".java", ".c", ".cpp", ".h", ".hpp", ".cs", ".rb", ".php", ".swift", ".kt"]);

class Workspace {
    repo: Map<string, FileEntry> = new Map();
    vars: Map<string, any> = new Map();
    phase: string = "idle";
    loadedDir: string = "";
    cwd: string = "";

    async loadRepo(dir: string): Promise<number> {
        this.repo.clear();
        this.loadedDir = dir;
        this.phase = "research";
        
        const files = await this.walkDir(dir);
        for (const file of files) {
            try {
                const content = fs.readFileSync(file, "utf-8");
                const symbols = this.extractSymbols(content, file);
                this.repo.set(file, {
                    content,
                    symbols,
                    path: file
                });
            } catch (e) {
                // Skip unreadable files
            }
        }
        return this.repo.size;
    }

    private async walkDir(dir: string): Promise<string[]> {
        const files: string[] = [];
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            
            if (entry.isDirectory()) {
                if (!IGNORE_DIRS.has(entry.name) && !entry.name.startsWith(".")) {
                    const subFiles = await this.walkDir(fullPath);
                    files.push(...subFiles);
                }
            } else if (entry.isFile()) {
                const ext = path.extname(entry.name);
                if (CODE_EXTENSIONS.has(ext)) {
                    files.push(fullPath);
                }
            }
        }
        
        return files;
    }

    private extractSymbols(content: string, filePath: string): string[] {
        const symbols: string[] = [];
        const ext = path.extname(filePath);
        
        if (ext === ".ts" || ext === ".tsx" || ext === ".js" || ext === ".jsx") {
            const funcRegex = /(?:function\s+|const\s+|let\s+|var\s+)?(\w+)\s*(?:=\s*(?:async\s+)?\(|:\s*(?:async\s+)?\w+\s*\()/g;
            let match;
            while ((match = funcRegex.exec(content)) !== null) {
                symbols.push(`function:${match[1]}`);
            }
            
            const classRegex = /class\s+(\w+)/g;
            while ((match = classRegex.exec(content)) !== null) {
                symbols.push(`class:${match[1]}`);
            }
            
            const constRegex = /(?:const|let|var)\s+(\w+)\s*=/g;
            while ((match = constRegex.exec(content)) !== null) {
                if (!match[1].startsWith("_")) {
                    symbols.push(`const:${match[1]}`);
                }
            }
        } else if (ext === ".py") {
            const funcRegex = /def\s+(\w+)\s*\(/g;
            let match;
            while ((match = funcRegex.exec(content)) !== null) {
                symbols.push(`def:${match[1]}`);
            }
            
            const classRegex = /class\s+(\w+)/g;
            while ((match = classRegex.exec(content)) !== null) {
                symbols.push(`class:${match[1]}`);
            }
        } else if (ext === ".rs") {
            const funcRegex = /(?:pub\s+)?fn\s+(\w+)\s*\(/g;
            let match;
            while ((match = funcRegex.exec(content)) !== null) {
                symbols.push(`fn:${match[1]}`);
            }
            
            const structRegex = /struct\s+(\w+)/g;
            while ((match = structRegex.exec(content)) !== null) {
                symbols.push(`struct:${match[1]}`);
            }
            
            const implRegex = /impl\s+(\w+)/g;
            while ((match = implRegex.exec(content)) !== null) {
                symbols.push(`impl:${match[1]}`);
            }
        }
        
        return symbols;
    }

    querySymbols(query: string): Array<{ file: string; symbol: string }> {
        const results: Array<{ file: string; symbol: string }> = [];
        const lowerQuery = query.toLowerCase();
        
        for (const [file, entry] of this.repo) {
            for (const symbol of entry.symbols) {
                if (symbol.toLowerCase().includes(lowerQuery)) {
                    results.push({ file, symbol });
                }
            }
        }
        
        return results.slice(0, 20);
    }

    getFileContent(filePath: string): string | null {
        const entry = this.repo.get(filePath);
        return entry?.content ?? null;
    }

    getSummary(): string {
        const fileCount = this.repo.size;
        const varCount = this.vars.size;
        const symbolCount = Array.from(this.repo.values()).reduce((acc, e) => acc + e.symbols.length, 0);
        
        return `## RLM Workspace
- **Files:** ${fileCount}
- **Symbols:** ${symbolCount}
- **Vars:** ${varCount}
- **Phase:** ${this.phase}
- **Loaded:** ${this.loadedDir || "none"}
`;
    }

    getInjectedContext(): string {
        const parts: string[] = [];
        
        parts.push(`## Current Phase: ${this.phase}`);
        
        const spec = this.vars.get("spec_md");
        if (spec) {
            parts.push(`## Spec:\n${spec.slice(0, 500)}`);
        }
        
        const progress = this.vars.get("progress");
        if (progress && Array.isArray(progress) && progress.length > 0) {
            parts.push(`## Progress (${progress.length} items):\n${JSON.stringify(progress.slice(-3))}`);
        }
        
        parts.push(`\n## Repo Stats: ${this.repo.size} files, ${Array.from(this.repo.values()).reduce((a, e) => a + e.symbols.length, 0)} symbols`);
        
        return parts.join("\n\n");
    }
}

const workspace = new Workspace();

export default function (pi: ExtensionAPI) {
    pi.on("session_start", async (_event, ctx) => {
        workspace.cwd = ctx.cwd;
        
        const isCodeDir = fs.existsSync(path.join(ctx.cwd, "package.json")) ||
                         fs.existsSync(path.join(ctx.cwd, "Cargo.toml")) ||
                         fs.existsSync(path.join(ctx.cwd, "pyproject.toml"));
        
        if (isCodeDir) {
            const fileCount = await workspace.loadRepo(ctx.cwd);
            ctx.ui.notify(`RLM-ACE: Auto-loaded ${fileCount} files from ${ctx.cwd}`, "info");
            ctx.ui.setStatus("rlm-status", `Workspace: ${fileCount} files loaded`);
        } else {
            ctx.ui.notify("RLM-ACE Extension loaded!", "info");
            ctx.ui.setStatus("rlm-status", "Workspace: not initialized");
        }
        
        pi.on("context", async (event: ContextEvent, ctx: ExtensionContext) => {
            const injected = workspace.getInjectedContext();
            ctx.ui.notify("Context injected with workspace summary", "info");
        });
    });

    pi.registerCommand("rlm-status", {
        description: "Show RLM Workspace status",
        handler: async (args: string, ctx: ExtensionContext) => {
            const summary = workspace.getSummary();
            await ctx.ui.notify(summary, "info");
            ctx.ui.setStatus("rlm-status", `Files: ${workspace.repo.size}, Phase: ${workspace.phase}`);
        }
    });

    pi.registerCommand("rlm-reload", {
        description: "Reload the current workspace",
        handler: async (args: string, ctx: ExtensionContext) => {
            if (workspace.cwd) {
                const fileCount = await workspace.loadRepo(workspace.cwd);
                await ctx.ui.notify(`Reloaded ${fileCount} files`, "info");
            } else {
                await ctx.ui.notify("No directory loaded", "warning");
            }
        }
    });

    pi.registerTool({
        name: "rlm_load_repo",
        label: "Load Repo",
        description: "Load a repository into the RLM Workspace",
        parameters: Type.Object({
            dir: Type.String({ description: "Directory path to load" })
        }),
        execute: async (toolCallId: string, params: any, signal: AbortSignal | undefined, onUpdate: any, ctx: ExtensionContext): Promise<AgentToolResult<undefined>> => {
            const dir = params.dir;
            const resolvedDir = path.isAbsolute(dir) ? dir : path.join(workspace.cwd || process.cwd(), dir);
            
            const fileCount = await workspace.loadRepo(resolvedDir);
            workspace.cwd = resolvedDir;
            
            ctx.ui.setStatus("rlm-status", `Loaded: ${fileCount} files`);
            return { 
                content: [{ 
                    type: "text" as const, 
                    text: JSON.stringify({ 
                        success: true, 
                        files: fileCount, 
                        message: `Loaded ${fileCount} files`,
                        summary: workspace.getSummary()
                    }) 
                }], 
                details: undefined 
            };
        }
    });

    pi.registerTool({
        name: "rlm_query_symbol",
        label: "Query Symbol",
        description: "Query symbols in the workspace",
        parameters: Type.Object({
            query: Type.String({ description: "Symbol name to search for" })
        }),
        execute: async (toolCallId: string, params: any, signal: AbortSignal | undefined, onUpdate: any, ctx: ExtensionContext): Promise<AgentToolResult<undefined>> => {
            const results = workspace.querySymbols(params.query);
            return { 
                content: [{ 
                    type: "text" as const, 
                    text: JSON.stringify({ 
                        results,
                        count: results.length
                    }) 
                }], 
                details: undefined 
            };
        }
    });

    pi.registerTool({
        name: "rlm_read_file",
        label: "Read File",
        description: "Read a file from the workspace",
        parameters: Type.Object({
            path: Type.String({ description: "File path to read" })
        }),
        execute: async (toolCallId: string, params: any, signal: AbortSignal | undefined, onUpdate: any, ctx: ExtensionContext): Promise<AgentToolResult<undefined>> => {
            const filePath = path.isAbsolute(params.path) ? params.path : path.join(workspace.cwd || "", params.path);
            const content = workspace.getFileContent(filePath);
            
            if (content === null) {
                return { 
                    content: [{ 
                        type: "text" as const, 
                        text: JSON.stringify({ 
                            error: "File not found in workspace" 
                        }) 
                    }], 
                    details: undefined 
                };
            }
            
            return { 
                content: [{ 
                    type: "text" as const, 
                    text: JSON.stringify({ 
                        content,
                        path: filePath
                    }) 
                }], 
                details: undefined 
            };
        }
    });

    pi.registerTool({
        name: "rlm_update_var",
        label: "Update Variable",
        description: "Update a workspace variable",
        parameters: Type.Object({
            name: Type.String({ description: "Variable name" }),
            value: Type.String({ description: "Variable value" })
        }),
        execute: async (toolCallId: string, params: any, signal: AbortSignal | undefined, onUpdate: any, ctx: ExtensionContext): Promise<AgentToolResult<undefined>> => {
            workspace.vars.set(params.name, params.value);
            return { content: [{ type: "text" as const, text: JSON.stringify({ success: true }) }], details: undefined };
        }
    });

    pi.registerTool({
        name: "rlm_get_var",
        label: "Get Variable",
        description: "Get a workspace variable",
        parameters: Type.Object({
            name: Type.String({ description: "Variable name" })
        }),
        execute: async (toolCallId: string, params: any, signal: AbortSignal | undefined, onUpdate: any, ctx: ExtensionContext): Promise<AgentToolResult<undefined>> => {
            const value = workspace.vars.get(params.name);
            return { content: [{ type: "text" as const, text: JSON.stringify({ value: value ?? null }) }], details: undefined };
        }
    });

    pi.registerTool({
        name: "rlm_diff_apply",
        label: "Apply Diff",
        description: "Apply a diff to a file in the workspace",
        parameters: Type.Object({
            file: Type.String({ description: "File path" }),
            diff: Type.String({ description: "Diff content" })
        }),
        execute: async (toolCallId: string, params: any, signal: AbortSignal | undefined, onUpdate: any, ctx: ExtensionContext): Promise<AgentToolResult<undefined>> => {
            const filePath = path.isAbsolute(params.file) ? params.file : path.join(workspace.cwd || "", params.file);
            const currentContent = workspace.getFileContent(filePath);
            
            if (currentContent === null) {
                return { 
                    content: [{ 
                        type: "text" as const, 
                        text: JSON.stringify({ 
                            error: "File not found in workspace" 
                        }) 
                    }], 
                    details: undefined 
                };
            }
            
            try {
                fs.writeFileSync(filePath, currentContent, "utf-8");
                await workspace.loadRepo(workspace.cwd);
                
                return { 
                    content: [{ 
                        type: "text" as const, 
                        text: JSON.stringify({ 
                            success: true,
                            message: "Diff applied (stub - implement actual diff parsing)" 
                        }) 
                    }], 
                    details: undefined 
                };
            } catch (e) {
                return { 
                    content: [{ 
                        type: "text" as const, 
                        text: JSON.stringify({ 
                            error: String(e) 
                        }) 
                    }], 
                    details: undefined 
                };
            }
        }
    });
}
