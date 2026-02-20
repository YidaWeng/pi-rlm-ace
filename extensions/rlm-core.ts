import type { ExtensionAPI, ExtensionContext, AgentToolResult } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";

interface FileEntry {
    content: string;
    symbols: string[];
}

class Workspace {
    repo: Map<string, FileEntry> = new Map();
    vars: Map<string, any> = new Map();
    phase: string = "idle";
}

const workspace = new Workspace();

export default function (pi: ExtensionAPI) {
    pi.on("session_start", async (_event, ctx) => {
        ctx.ui.notify("RLM-ACE Extension loaded!", "info");
        ctx.ui.setStatus("rlm-status", "Workspace: not initialized");
    });

    pi.registerCommand("rlm-status", {
        description: "Show RLM Workspace status",
        handler: async (args: string, ctx: ExtensionContext) => {
            const fileCount = workspace.repo.size;
            const varCount = workspace.vars.size;
            const phase = workspace.phase;
            
            await ctx.ui.notify(`📦 Workspace: ${fileCount} files, ${varCount} vars, Phase: ${phase}`, "info");
            ctx.ui.setStatus("rlm-status", `Files: ${fileCount}, Vars: ${varCount}, Phase: ${phase}`);
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
            workspace.repo.clear();
            workspace.vars.set("loaded_dir", dir);
            workspace.phase = "research";
            
            ctx.ui.setStatus("rlm-status", `Loaded: ${dir}`);
            return { content: [{ type: "text" as const, text: JSON.stringify({ success: true, files: 0, message: "Repository loaded" }) }], details: undefined };
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
}
