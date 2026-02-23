# ACE Plan Skill

## Description
Planning phase skill for ACE workflow. Create detailed implementation plans based on research.

## When to Use
Use this skill after completing research to create a detailed implementation plan.

## Steps

### 1. Review Research
- Read `spec_md` from workspace variables
- Understand the task requirements

### 2. Identify Changes
- List all files that need modification
- Identify new files to create
- Note any dependencies

### 3. Create Implementation Plan
- Break down into smaller tasks
- Order dependencies correctly
- Identify potential issues

### 4. Document Plan
- Update `spec_md` with plan sections:
  - # Implementation Plan
  - # Files to Modify (list)
  - # New Files (list)
  - # Dependencies
  - # Risks

### 5. Validate Plan
- Check all requirements are covered
- Ensure correct order of operations
- Use `rlm_query_symbol` to verify understanding

### 6. Complete Phase
- Use `ace_add_progress` to record plan completion
- Use `ace_set_phase` to advance to "implement" phase

## Tools Available
- `rlm_get_var` - Get workspace variables
- `rlm_query_symbol` - Verify symbol existence
- `ace_update_spec` - Update specification
- `ace_add_progress` - Record progress

## Example Output Format
```markdown
## Implementation Plan

### Files to Modify
1. `src/auth.ts` - Add login function
2. `src/middleware.ts` - Add auth middleware

### New Files
1. `src/types/auth.ts` - Auth types

### Dependencies
- Login depends on Auth types
- Middleware depends on Login

### Risks
- May need to update tests
```

---
*Part of ACE Orchestrator*
