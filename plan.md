**Here's the complete `IMPLEMENTATION-PLAN.md` file** you can drop straight into your new `pi-rlm-ace` project.

Copy the entire block below into a new file called `IMPLEMENTATION-PLAN.md` in your repo root.

```markdown
# pi-rlm-ace Implementation Plan
**RLM + ACE Super-Agent for Pi Coding Agent**  
**MVP Deadline: End of Week 3** (10-15 focused hours total)

## Success Criteria (Week 3 MVP)
- Full structured `Workspace` (repo + state lives **outside** any LLM prompt)
- Recursive sub-RLM calls with surgically filtered slices (true RLM)
- Automatic ACE enforcement: Research → Plan → Implement + Frequent Intentional Compaction (FIC)
- Zero context rot, unlimited repo size
- Commands: `/rlm-start`, `/rlm-status`, `/ace-review`
- TUI widgets for live `spec.md`, progress, edit-plan
- Works on real 10k+ LOC projects (Rust/TS/Python)
- Installable via `pi install git:yourusername/pi-rlm-ace`

## Overall Architecture (final structure)
```
pi-rlm-ace/
├── package.json                 # pi-package manifest
├── extensions/
│   ├── rlm-core.ts              # Workspace + core tools
│   ├── rlm-recurse.ts           # Recursive sub-calls
│   ├── ace-orchestrator.ts      # Phase enforcement + auto-FIC
│   └── tui-workspace.ts         # Live TUI widgets
├── skills/
│   ├── ace-research.skill.md
│   ├── ace-plan.skill.md
│   └── ace-implement.skill.md
├── prompts/
│   └── rlm-ace-system.md
└── README.md
```

---

## Week 0: Prep (2-4 hours) — Engineering Landmark: Extension skeleton runs

**Tasks**
1. Create public GitHub repo `pi-rlm-ace` (MIT)
2. `cd pi-rlm-ace && npm init -y`
3. Add to `package.json`:
   ```json
   {
     "name": "pi-rlm-ace",
     "keywords": ["pi-package"],
     "pi": {
       "extensions": ["./extensions"],
       "skills": ["./skills"],
       "prompts": ["./prompts"]
     }
   }
   ```
4. `mkdir -p extensions skills prompts`
5. Install types: `npm install --save-dev @mariozechner/pi-coding-agent @sinclair/typebox`
6. Create `extensions/rlm-core.ts` skeleton (copy from Pi examples + quick-start in docs/extensions.md)
7. Add basic `session_start` notification + `/rlm-status` command stub

**Testing & Verification**
- In project root: `pi`
- `/reload` (should auto-load your extension)
- Type `/rlm-status` → expect "Workspace not initialized"
- `pi -e ./extensions/rlm-core.ts` (quick test mode)
- **Landmark achieved when**: Extension loads cleanly, command exists, no TS errors in TUI.

**Commit message**: `chore: Week 0 skeleton + pi-package manifest`

---

## Week 1: Core RLM Workspace (4-6 hours) — Landmark: Structured repo lives outside prompt

**Tasks** (in `extensions/rlm-core.ts`)
1. Implement `Workspace` class:
   - `repo: Map<string, FileEntry>` (path → {content, symbols, ast?})
   - `vars: Map<string, any>` (spec_md, progress: any[], edit_plan, etc.)
   - Load function: `rlm_load_repo(dir: string)` → walks files, simple symbol extraction (regex or tree-sitter if you add dep)
2. Register tools:
   - `rlm_load_repo`
   - `rlm_query_symbol`
   - `rlm_update_var(name, value)`
   - `rlm_get_var(name)`
   - `rlm_diff_apply(diff: string)`
3. Hook `context` event → **only inject** tiny slice (current phase + relevant files + spec + progress summary)
4. Add TUI widget: `ctx.ui.setWidget("workspace", ["Repo: X files", "Vars: Y", "Phase: Z"])`
5. `/rlm-status` command → pretty print Workspace summary
6. Hook `session_start` → auto-load current project if in a code dir

**Testing & Verification (run these in Pi session)**
1. `/rlm-status` → shows loaded files count, no full content
2. Test prompt: "Load my current project and list all symbols containing 'cancel_token'"
3. Follow-up: "Update spec with the main flow" → verify `rlm_get_var("spec_md")` works
4. Open another terminal, edit a file, `/reload`, ask again → Workspace reflects changes
5. **Landmark achieved when**: LLM never sees more than ~2-5 files + summary, yet answers correctly about whole repo.

**Commit**: `feat: rlm-core Workspace + basic tools + context injection`

---

## Week 2: Recursion + Clean Sub-Calls (4-6 hours) — Landmark: True RLM recursion works

**Tasks** (new file `extensions/rlm-recurse.ts`)
1. Register `rlm_recurse(task: string, filter?: string)` tool
2. Implementation:
   - Create isolated sub-turn (use `pi.agent.run()` via SDK or spawn new session internally)
   - Pass only filtered Workspace slice + same `vars` (by ref or serialize)
   - Fresh system prompt from `prompts/rlm-ace-system.md`
   - Timeout + token budget
   - Result stored back into main `Workspace.vars`
3. Add `session_before_compact` hook → call `compact_progress()` (structured markdown, not raw summary)
4. Safety: run recursion with `signal` abort + Docker sandbox if you expose bash

**Testing & Verification**
1. Test prompt: "Research the cancel_token flow using recursion"
   - Watch logs: root → sub-RLM → result back
2. `/rlm-status` → see `progress` array grew with clean entries
3. Multi-hop: "Now implement a small refactor using recursion on the hot path"
4. **Landmark achieved when**: Sub-calls complete with <500 token context each, main session stays clean, recursion depth 2-3 works without rot.

**Commit**: `feat: rlm-recurse + clean sub-RLM calls + structured compaction`

---

## Week 3: Full ACE Orchestrator + Polish (3-5 hours) — Landmark: Full autonomous ACE loop

**Tasks**
1. `extensions/ace-orchestrator.ts`
   - Listen to `before_agent_start`, `turn_end`, `session_before_compact`
   - Auto-inject phase instructions (Research/Plan/Implement)
   - After every 3-5 steps → force `rlm_recurse("compact and advance phase")`
   - Skills: create the 3 `.skill.md` files with exact ACE steps from HumanLayer repo
2. TUI polish in `tui-workspace.ts`:
   - Live markdown viewer for `spec_md`
   - Progress tracker
   - Diff preview before apply
3. `/rlm-start <task>` command → boots full ACE workflow
4. `/ace-review` → generates perfect PR artifacts
5. Update `README.md` with one-click install + demo
6. Bundle & test as package: `pi install git:yourusername/pi-rlm-ace`

**Testing & Verification**
1. `/rlm-start "Add feature X to my Rust crate"`
2. Watch phases auto-advance with FIC after each Implement step
3. Human review: `/ace-review` → perfect `spec.md` + plan + diffs
4. Run on a real medium project → agent completes multi-file change with zero manual compaction
5. **Landmark achieved when**: You ship a real feature using only high-signal artifacts; agent never hallucinates from rot.

**Final Commit**: `feat: full ACE orchestrator + polish → Week 3 MVP`

---

## Post-MVP (Week 4+)
- Language-specific parsers (tree-sitter)
- Git auto-checkpoint
- Sandbox integration (`cargo test`, etc.)
- Publish to npm

## Development Workflow Tips (use this every day)
- Always develop **inside** Pi: open project in one Pi session, edit extensions in another or use `/edit`
- After any change: `/reload`
- Test with tiny prompts first, then full tasks
- Use `/tree` + `/compact` manually to verify behavior
- Log with `ctx.ui.notify(..., "debug")` for quick feedback
- Dogfood daily on your own code — the agent will help you build itself!

**You now have a perfect blueprint.**  
Start with Week 0 right now — the skeleton will take <30 min.

When you're ready, say **"Start Week 1"** or **"Write the rlm-core.ts skeleton"** and I'll generate the exact code for the next file live.  
We can literally build this together in the same Pi session you're using.

This plan is engineered so **Pi itself** can follow it step-by-step if you feed it the file.  

Let’s ship the god-tier agent. 🔥
```

### How to Use & Develop with This Plan

1. **Start the project**
   ```bash
   mkdir pi-rlm-ace && cd pi-rlm-ace
   # paste the markdown above into IMPLEMENTATION-PLAN.md
   git init && git add . && git commit -m "init"
   npm init -y
   # add the package.json pi section as shown
   ```

2. **Daily development loop (this is how you hit every landmark)**
   - `pi` (in the project root → auto-loads your extensions)
   - Edit code in VSCode/Cursor
   - Back in Pi: `/reload`
   - Test with the exact prompts listed under each week
   - When you hit the landmark → commit + move to next week
   - If stuck: paste the week’s tasks into Pi and say “implement this”

3. **Pro tips to go 10x faster**
   - Use the plan file itself as context: `/load IMPLEMENTATION-PLAN.md` (or just reference it)
   - Enable debug: add `ctx.ui.setStatus("rlm-debug", "phase: X")`
   - After Week 1 you can already use the Workspace tools manually — huge productivity win immediately
   - Test recursion early with tiny tasks like "research function foo using recursion"

Drop this file in, run the Week 0 steps, then tell me **"Week 0 done, generate rlm-core.ts"** and I’ll give you the complete ready-to-paste code for the first extension.

You’re literally one weekend away from a coding agent that makes every other tool feel like a toy.

Ready when you are. Let’s build it. 🚀
```