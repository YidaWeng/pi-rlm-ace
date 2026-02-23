import type { ExtensionAPI, ExtensionContext, AgentToolResult } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";

type ACEPhase = "idle" | "research" | "plan" | "implement" | "review";

interface ACETask {
    id: string;
    description: string;
    phase: ACEPhase;
    createdAt: number;
    completedAt?: number;
    status: "pending" | "in_progress" | "completed" | "failed";
    result?: string;
}

const ACTIVE_TASK_KEY = "ace_active_task";
const PHASE_HISTORY_KEY = "ace_phase_history";

export default function (pi: ExtensionAPI) {
    pi.on("session_start", async (_event, ctx) => {
        ctx.ui.notify("ACE Orchestrator loaded!", "info");
    });

    pi.registerCommand("rlm-start", {
        description: "Start RLM-ACE workflow with a task",
        handler: async (args: string, ctx: ExtensionContext) => {
            const workspaceVars = (ctx as any).workspace?.vars;
            
            if (!args.trim()) {
                await ctx.ui.notify("Usage: /rlm-start <task description>", "warning");
                return;
            }

            const task: ACETask = {
                id: `task_${Date.now()}`,
                description: args,
                phase: "research",
                createdAt: Date.now(),
                status: "in_progress"
            };

            if (workspaceVars) {
                workspaceVars.set(ACTIVE_TASK_KEY, task);
                workspaceVars.set("phase", "research");
                workspaceVars.set("spec_md", "");
                workspaceVars.set("progress", []);
                workspaceVars.set("edit_plan", "");
            }

            ctx.ui.setStatus("ace-phase", "🔬 Research");
            await ctx.ui.notify(`🚀 Starting ACE workflow: ${args}`, "info");
            await ctx.ui.notify(`## Phase 1: Research\n\nTask: ${args}\n\nUse /ace-status to check progress.`, "info");
        }
    });

    pi.registerCommand("ace-status", {
        description: "Show ACE workflow status",
        handler: async (args: string, ctx: ExtensionContext) => {
            const workspaceVars = (ctx as any).workspace?.vars;
            
            if (!workspaceVars) {
                await ctx.ui.notify("Workspace not initialized", "warning");
                return;
            }

            const task = workspaceVars.get(ACTIVE_TASK_KEY) as ACETask | undefined;
            const phase = workspaceVars.get("phase") as string || "idle";
            const spec = workspaceVars.get("spec_md") as string || "";
            const progress = workspaceVars.get("progress") as any[] || [];

            const phaseEmoji: Record<ACEPhase, string> = {
                idle: "⏸️",
                research: "🔬",
                plan: "📋",
                implement: "🔧",
                review: "✅"
            };

            const status = `# ACE Workflow Status

**Current Phase:** ${phaseEmoji[phase as ACEPhase]} ${phase.toUpperCase()}
**Task:** ${task?.description || "No active task"}
**Status:** ${task?.status || "none"}
**Progress Items:** ${progress.length}
**Spec Length:** ${spec.length} chars
`;

            await ctx.ui.notify(status, "info");
            ctx.ui.setStatus("ace-phase", `${phaseEmoji[phase as ACEPhase]} ${phase}`);
        }
    });

    pi.registerCommand("ace-next", {
        description: "Advance to next ACE phase",
        handler: async (args: string, ctx: ExtensionContext) => {
            const workspaceVars = (ctx as any).workspace?.vars;
            
            if (!workspaceVars) {
                await ctx.ui.notify("Workspace not initialized", "warning");
                return;
            }

            const currentPhase = (workspaceVars.get("phase") as ACEPhase) || "idle";
            const nextPhase = getNextPhase(currentPhase);

            workspaceVars.set("phase", nextPhase);
            
            const phaseMessages: Record<ACEPhase, string> = {
                idle: "Workflow idle",
                research: "## Phase 1: Research\n\nResearch the codebase and gather requirements.",
                plan: "## Phase 2: Plan\n\nCreate a detailed implementation plan based on research.",
                implement: "## Phase 3: Implement\n\nExecute the implementation plan.",
                review: "## Phase 4: Review\n\nReview the implementation and prepare for PR."
            };

            ctx.ui.setStatus("ace-phase", `🔬 ${nextPhase}`);
            await ctx.ui.notify(`Advanced to ${nextPhase.toUpperCase()} phase`, "info");
            await ctx.ui.notify(phaseMessages[nextPhase], "info");
        }
    });

    pi.registerCommand("ace-review", {
        description: "Generate PR artifacts for review",
        handler: async (args: string, ctx: ExtensionContext) => {
            const workspaceVars = (ctx as any).workspace?.vars;
            
            if (!workspaceVars) {
                await ctx.ui.notify("Workspace not initialized", "warning");
                return;
            }

            const task = workspaceVars.get(ACTIVE_TASK_KEY) as ACETask | undefined;
            const phase = workspaceVars.get("phase") as string;
            const spec = workspaceVars.get("spec_md") as string;
            const progress = workspaceVars.get("progress") as any[] || [];
            const editPlan = workspaceVars.get("edit_plan") as string;

            const artifacts = `# ACE Review Artifacts

## Task
${task?.description || "No task"}

## Current Phase
${phase}

## Spec
${spec || "No spec defined"}

## Progress
${progress.length} items completed

${progress.map((p, i) => `${i + 1}. [${p.type}] ${p.task || "task"} - ${p.success ? "✅" : "❌"}`).join("\n")}

## Edit Plan
${editPlan || "No edit plan"}

---

*Generated by ACE Orchestrator*
`;

            workspaceVars.set("review_artifacts", artifacts);
            
            await ctx.ui.notify("## Review Artifacts Generated\n\n" + artifacts.slice(0, 500) + "...", "info");
            await ctx.ui.notify("✅ Review artifacts saved to workspace. Use rlm_get_var to retrieve.", "info");
        }
    });

    pi.registerTool({
        name: "ace_set_phase",
        label: "Set Phase",
        description: "Set the current ACE phase",
        parameters: Type.Object({
            phase: Type.String({ description: "Phase: research, plan, implement, or review" })
        }),
        execute: async (toolCallId: string, params: any, signal: AbortSignal | undefined, onUpdate: any, ctx: ExtensionContext): Promise<AgentToolResult<undefined>> => {
            const workspaceVars = (ctx as any).workspace?.vars;
            const phase = params.phase as ACEPhase;
            
            if (!["research", "plan", "implement", "review"].includes(phase)) {
                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({ success: false, error: "Invalid phase" })
                    }],
                    details: undefined
                };
            }

            if (workspaceVars) {
                const history = workspaceVars.get(PHASE_HISTORY_KEY) as string[] || [];
                history.push(phase);
                workspaceVars.set(PHASE_HISTORY_KEY, history);
                workspaceVars.set("phase", phase);
            }

            ctx.ui.setStatus("ace-phase", phase);
            
            return {
                content: [{
                    type: "text" as const,
                    text: JSON.stringify({ success: true, phase })
                }],
                details: undefined
            };
        }
    });

    pi.registerTool({
        name: "ace_update_spec",
        label: "Update Spec",
        description: "Update the specification document",
        parameters: Type.Object({
            spec: Type.String({ description: "Spec content (markdown)" })
        }),
        execute: async (toolCallId: string, params: any, signal: AbortSignal | undefined, onUpdate: any, ctx: ExtensionContext): Promise<AgentToolResult<undefined>> => {
            const workspaceVars = (ctx as any).workspace?.vars;
            
            if (workspaceVars) {
                workspaceVars.set("spec_md", params.spec);
            }

            return {
                content: [{
                    type: "text" as const,
                    text: JSON.stringify({ success: true, spec_length: params.spec.length })
                }],
                details: undefined
            };
        }
    });

    pi.registerTool({
        name: "ace_add_progress",
        label: "Add Progress",
        description: "Add progress item to tracking",
        parameters: Type.Object({
            type: Type.String({ description: "Type: research, plan, implement, review" }),
            description: Type.String({ description: "What was done" }),
            success: Type.Optional(Type.Boolean({ description: "Whether it succeeded" }))
        }),
        execute: async (toolCallId: string, params: any, signal: AbortSignal | undefined, onUpdate: any, ctx: ExtensionContext): Promise<AgentToolResult<undefined>> => {
            const workspaceVars = (ctx as any).workspace?.vars;
            
            if (workspaceVars) {
                const progress = workspaceVars.get("progress") as any[] || [];
                progress.push({
                    type: params.type,
                    task: params.description,
                    success: params.success ?? true,
                    timestamp: Date.now()
                });
                workspaceVars.set("progress", progress);

                const currentPhase = workspaceVars.get("phase") as string;
                if (progress.length % 3 === 0 && currentPhase !== "review") {
                    await ctx.ui.notify("🎯 3 steps completed - consider compacting progress", "info");
                }
            }

            return {
                content: [{
                    type: "text" as const,
                    text: JSON.stringify({ success: true, progress_count: ((ctx as any).workspace?.vars?.get("progress") as any[])?.length || 0 })
                }],
                details: undefined
            };
        }
    });

    pi.on("before_agent_start", async (event, ctx) => {
        const workspaceVars = (ctx as any).workspace?.vars;
        if (!workspaceVars) return;

        const phase = workspaceVars.get("phase") as ACEPhase;
        const progress = workspaceVars.get("progress") as any[] || [];

        if (progress.length > 0 && progress.length % 5 === 0) {
            const instruction = `\n\n## ACE Enforcement\nCurrent phase: ${phase}. After every 3-5 implement steps, call rlm_compact_progress to compact progress before continuing.\n`;
            
            ctx.ui.notify("Auto-FIC: Progress will be compacted after this step", "info");
        }
    });

    pi.on("agent_end", async (event, ctx) => {
        const workspaceVars = (ctx as any).workspace?.vars;
        if (!workspaceVars) return;

        const progress = workspaceVars.get("progress") as any[] || [];
        const phase = workspaceVars.get("phase") as string;

        if (progress.length > 0 && progress.length % 3 === 0 && phase === "implement") {
            ctx.ui.notify("🎯 FIC Triggered: Compacting progress after 3 implement steps", "info");
        }
    });
}

function getNextPhase(current: ACEPhase): ACEPhase {
    const phaseOrder: ACEPhase[] = ["research", "plan", "implement", "review"];
    const currentIndex = phaseOrder.indexOf(current);
    if (currentIndex === -1 || currentIndex === phaseOrder.length - 1) {
        return "review";
    }
    return phaseOrder[currentIndex + 1];
}
