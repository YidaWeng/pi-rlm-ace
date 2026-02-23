# ACE Implement Skill

## Description
Implementation phase skill for ACE workflow. Execute the implementation plan with frequent intentional compaction (FIC).

## When to Use
Use this skill to implement changes based on the plan. This phase uses FIC - compact progress every 3-5 steps.

## Steps

### 1. Review Plan
- Read `spec_md` to understand the implementation plan
- Check `edit_plan` for detailed steps

### 2. Implement in Order
- Follow the plan's ordered steps
- Make one change at a time
- Test after each significant change

### 3. Track Progress
- Use `ace_add_progress` after each implementation step
- Include:
  - Type: "implement"
  - Description: What was done
  - Success: true/false

### 4. Frequent Intentional Compaction (FIC)
**Every 3-5 implement steps:**
- Call `rlm_compact_progress` to compact progress
- This keeps context clean
- Prevents context rot

### 5. Handle Errors
- If stuck, call `ace_add_progress` with success: false
- Document the issue
- Use `rlm_query_symbol` to find relevant code

### 6. Complete Implementation
- Verify all plan items are done
- Use `ace_add_progress` to record final completion
- Use `ace_set_phase` to advance to "review" phase

## FIC Protocol
```
Step 1: Implement feature A → ace_add_progress
Step 2: Implement feature B → ace_add_progress  
Step 3: Implement feature C → ace_add_progress → TRIGGER COMPACTION
Step 4: rlm_compact_progress
Step 5: Continue with feature D...
```

## Tools Available
- `read` - Read files
- `write` - Write files
- `edit` - Edit files
- `ace_add_progress` - Record progress
- `rlm_compact_progress` - Compact progress (FIC)
- `ace_set_phase` - Change phase

## Example
```
Implement the login function in src/auth.ts
→ ace_add_progress(type: "implement", description: "Added login function")
→ ace_add_progress(type: "implement", description: "Added token generation")
→ ace_add_progress(type: "implement", description: "Added middleware")
→ rlm_compact_progress (FIC!)
→ Continue...
```

---
*Part of ACE Orchestrator*
