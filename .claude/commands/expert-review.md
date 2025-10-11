---
description: Multi-expert code review workflow with architect, refactoring, and validation specialists producing actionable todos.
---

The user input to you can be provided directly by the agent or as a command argument - you **MUST** consider it before proceeding with the prompt (if not empty).

User input:

$ARGUMENTS

Goal: Conduct a comprehensive multi-expert code review of the current codebase using specialized agents, synthesize findings into actionable todos, delegate implementation to appropriate experts, and perform final validation.

Execution steps:

1. **Expert Review Phase** - Launch three specialized agents in parallel to conduct independent code reviews:

   A. **Svelte MVVM Architect Review**:
   - Launch `svelte-mvvm-architect` agent to review frontend architecture
   - Focus areas: MVVM pattern compliance, Svelte 5 runes usage, state management, component structure
   - Output: Write review to `.claude/reviews/mvvm-architect-review.md`

   B. **Refactoring Specialist Review**:
   - Launch `refactoring-specialist` agent to review code quality
   - Focus areas: SOLID principles, code smells, duplication, complexity, maintainability
   - Output: Write review to `.claude/reviews/refactoring-review.md`

   C. **SvelteKit Validator Review**:
   - Launch `sveltekit-validator` agent to review application integrity
   - Focus areas: SvelteKit best practices, routing, API patterns, build quality, testing coverage
   - Output: Write review to `.claude/reviews/validation-review.md`

2. **Synthesis Phase** - After all three reviews are complete:
   - Read all three review documents
   - Extract actionable items from each review
   - Categorize by: severity (critical/high/medium/low), area (mvvm/refactoring/validation), estimated effort
   - Remove duplicates and consolidate related items
   - Prioritize based on: constitution violations, architectural issues, code quality, style improvements
   - Output: Write consolidated todos to `.claude/reviews/consolidated-todos.md` with format:

     ```markdown
     ## Critical Priority

     - [ ] [MVVM] Item description (assigned: svelte-mvvm-architect)
     - [ ] [REFACTOR] Item description (assigned: refactoring-specialist)

     ## High Priority

     ...
     ```

3. **Delegation Phase** - Assign and execute todos with appropriate experts:
   - Group todos by assigned expert
   - For MVVM items: Launch `svelte-mvvm-architect` agent with specific tasks
   - For refactoring items: Launch `refactoring-specialist` agent with specific tasks
   - For validation items: Handle directly or with `sveltekit-validator` agent
   - Track completion status in `.claude/reviews/consolidated-todos.md`
   - Update todo checkboxes as items are completed

4. **Final Validation Phase** - After all delegated work is complete:
   - Launch `sveltekit-validator` agent for comprehensive final pass
   - Verify: no new inconsistencies, all changes align, tests pass, build succeeds
   - Check: architectural integrity maintained, no regressions introduced
   - Output: Write final validation report to `.claude/reviews/final-validation.md`
   - Include: issues found, corrections made, overall quality assessment, sign-off status

5. **Summary Report** - Generate final summary:
   - Total items identified across all reviews
   - Items completed by each expert
   - Remaining items (if any) with recommendations
   - Quality metrics: before/after comparison
   - Next steps or follow-up recommendations

Behavior rules:

- **Parallel Execution**: Launch all three initial review agents in parallel for efficiency
- **Review Directory**: Create `.claude/reviews/` if it doesn't exist
- **Artifact Preservation**: Keep all review documents for audit trail
- **Expert Autonomy**: Let each agent work independently; do not override their findings
- **Incremental Updates**: Update todos document as work progresses
- **Validation Gate**: Do NOT proceed to delegation until all reviews are complete
- **Final Gate**: Do NOT mark complete until final validation passes

Context: $ARGUMENTS
