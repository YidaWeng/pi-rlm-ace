# ACE Research Skill

## Description
Research phase skill for ACE (Architecture, Context, Execution) workflow.

## When to Use
Use this skill when you need to research a codebase, understand existing patterns, or gather requirements before planning implementation.

## Steps

### 1. Understand the Task
- Read the task description from workspace variable `ace_active_task`
- Clarify any ambiguities before proceeding

### 2. Explore the Codebase
- Use `rlm_query_symbol` to find relevant symbols
- Use `rlm_read_file` to examine key files
- Document your findings in `spec_md`

### 3. Gather Requirements
- What files need to be modified?
- What patterns already exist?
- What are the dependencies?

### 4. Document Research
- Update `spec_md` with research findings
- Use `ace_update_spec` tool to save
- Format as markdown with sections:
  - # Task Overview
  - # Existing Code
  - # Requirements
  - # Files to Modify

### 5. Complete Phase
- Use `ace_add_progress` to record research completion
- Use `ace_set_phase` to advance to "plan" phase
- Call `/ace-status` to verify phase change

## Tools Available
- `rlm_query_symbol` - Search symbols
- `rlm_read_file` - Read file contents
- `rlm_load_repo` - Load repository
- `ace_update_spec` - Update specification
- `ace_add_progress` - Record progress

## Example Usage
```
/ace-research "Understand the authentication flow"
```

---
*Part of ACE Orchestrator*
