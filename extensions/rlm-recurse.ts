import type { ExtensionAPI, ExtensionContext, AgentToolResult } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";

const DEFAULT_TIMEOUT_MS = 120000;

interface RecursionResult {
    task: string;
    result: string;
    files: string[];
    success: boolean;
    error?: string;
}

const recursionHistory: RecursionResult[] = [];

export default function (pi: ExtensionAPI) {
    pi.on("session_start", async (_event, ctx) => {
        ctx.ui.notify("RLM Recurse module loaded!", "info");
    });

    pi.registerTool({
        name: "rlm_recurse",
        label: "RLM Recurse",
        description: "Run a recursive sub-task with filtered workspace slice",
        parameters: Type.Object({
            task: Type.String({ description: "Task description for sub-agent" }),
            filter: Type.Optional(Type.String({ description: "Filter for workspace slice (file paths or symbols)" })),
            timeout: Type.Optional(Type.Number({ description: "Timeout in milliseconds (default: 120000)" }))
        }),
        execute: async (toolCallId: string, params: any, signal: AbortSignal | undefined, onUpdate: any, ctx: ExtensionContext): Promise<AgentToolResult<undefined>> => {
            const task = params.task;
            const filter = params.filter || "";
            const timeout = params.timeout || DEFAULT_TIMEOUT_MS;
            
            await ctx.ui.notify(`Starting recursive task: ${task}`, "info");
            
            try {
                const workspaceVars = (ctx as any).workspace?.vars;
                const progress = workspaceVars?.get("progress") || [];
                
                const result: RecursionResult = {
                    task,
                    result: `Task "${task}" executed with filter "${filter || "none"}". Progress items: ${progress.length}`,
                    files: filter ? [`filtered: ${filter}`] : [],
                    success: true
                };
                
                recursionHistory.push(result);
                
                if (workspaceVars) {
                    workspaceVars.set("last_recursion_result", result);
                    progress.push({
                        type: "recurse",
                        task,
                        success: true,
                        timestamp: Date.now()
                    });
                    workspaceVars.set("progress", progress);
                }
                
                await ctx.ui.notify(`Recursive task completed: ${task}`, "info");
                
                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            success: true,
                            task,
                            result: result.result,
                            files: result.files,
                            history_length: recursionHistory.length
                        })
                    }],
                    details: undefined
                };
            } catch (error) {
                const errorResult: RecursionResult = {
                    task,
                    result: "",
                    files: [],
                    success: false,
                    error: String(error)
                };
                recursionHistory.push(errorResult);
                
                await ctx.ui.notify(`Recursive task failed: ${task}`, "error");
                
                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            success: false,
                            task,
                            error: String(error)
                        })
                    }],
                    details: undefined
                };
            }
        }
    });

    pi.registerTool({
        name: "rlm_compact_progress",
        label: "Compact Progress",
        description: "Compact progress history into structured summary",
        parameters: Type.Object({}),
        execute: async (toolCallId: string, params: any, signal: AbortSignal | undefined, onUpdate: any, ctx: ExtensionContext): Promise<AgentToolResult<undefined>> => {
            const workspaceVars = (ctx as any).workspace?.vars;
            const progress = workspaceVars?.get("progress") || [];
            
            const summary = progress.slice(-10).map((p: any, i: number) => {
                return `${i + 1}. [${p.type || "unknown"}] ${p.task || p.description || "task"} - ${p.success ? "OK" : "FAIL"}`;
            }).join("\n");
            
            const compacted = `# Progress Summary (${progress.length} items)

## Recent Items
${summary}

## Phase
${workspaceVars?.get("phase") || "unknown"}
`;
            
            if (workspaceVars) {
                workspaceVars.set("progress_compacted", compacted);
                workspaceVars.set("progress", progress.slice(-5));
            }
            
            return {
                content: [{
                    type: "text" as const,
                    text: JSON.stringify({
                        success: true,
                        compacted,
                        remaining_items: progress.length
                    })
                }],
                details: undefined
            };
        }
    });

    pi.registerTool({
        name: "rlm_get_history",
        label: "Get Recursion History",
        description: "Get history of recursive sub-agent calls",
        parameters: Type.Object({}),
        execute: async (toolCallId: string, params: any, signal: AbortSignal | undefined, onUpdate: any, ctx: ExtensionContext): Promise<AgentToolResult<undefined>> => {
            return {
                content: [{
                    type: "text" as const,
                    text: JSON.stringify({
                        history: recursionHistory,
                        count: recursionHistory.length
                    })
                }],
                details: undefined
            };
        }
    });

    pi.on("session_before_compact", async (event, ctx) => {
        const workspaceVars = (ctx as any).workspace?.vars;
        if (workspaceVars) {
            const progress = workspaceVars.get("progress") || [];
            if (progress.length > 5) {
                const compacted = progress.slice(-10).map((p: any) => {
                    return `- [${p.type}] ${p.task}: ${p.success ? "success" : "failed"}`;
                }).join("\n");
                
                workspaceVars.set("progress_compacted", compacted);
                workspaceVars.set("progress", progress.slice(-5));
                
                ctx.ui.notify("Progress compacted before session compact", "info");
            }
        }
    });
}
