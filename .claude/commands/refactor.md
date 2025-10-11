---
description: Multi-expert code refactoring workflow with architect, refactoring, and validation specialists producing working changes based on the user's request.
---

You are coordinating a team of specialized agents to execute comprehensive code refactoring. Use the **parallel-work-orchestrator** agent as your primary orchestration layer for complex, multi-workstream refactorings.

## User Request

$ARGUMENTS

## Orchestration Strategy

### For Simple Refactorings (single file/component)

Execute the workflow below directly with specialized agents.

### For Complex Refactorings (multiple files/systems/features)

**First, launch the parallel-work-orchestrator agent** to:

- Break down the refactoring into parallel workstreams
- Identify dependencies and execution order
- Assign workstreams to specialized agents
- Define validation checkpoints
- Track progress across all workstreams

Then execute the coordinated plan using the workflow phases below.

## Refactoring Workflow

### Phase 1: Analysis & Planning

Launch agents in parallel for comprehensive analysis:

**svelte-mvvm-architect** - Analyze architecture:

- Current architecture and patterns in affected code
- MVVM compliance and Svelte 5 best practices
- Component boundaries and separation of concerns
- State management patterns ($state, $derived, $effect)

**refactoring-specialist** - Identify improvements:

- Code smells and technical debt
- SOLID principle adherence
- Design pattern opportunities
- Testability and maintainability gaps

**frontend-design-expert** (if UI changes involved):

- Visual consistency and modern CSS techniques
- Design system alignment
- Accessibility considerations

**Deliverable**: Comprehensive refactoring plan with:

- Architectural changes required
- Sequence of refactoring steps (parallel vs sequential)
- Risk assessment and mitigation strategies
- Success criteria and validation checkpoints

### Phase 2: Implementation (refactoring-specialist + svelte-mvvm-architect)

Execute the refactoring plan systematically:

1. **Use TodoWrite** to track all refactoring tasks with granular items
2. Launch **refactoring-specialist** to perform code transformations:
   - Extract functions/classes to reduce complexity
   - Apply design patterns (Strategy, Adapter, Observer, etc.)
   - Eliminate duplication via DRY principles
   - Improve naming and code readability
3. Coordinate with **svelte-mvvm-architect** for Svelte-specific changes:
   - ViewModel class structure with runes
   - Service layer integration
   - Component composition and props
   - Reactive state management

**Important**: Make incremental, atomic changes. Mark todos as completed only when each refactoring step is fully verified.

### Phase 3: Code Review (svelte-code-reviewer)

After implementation, launch **svelte-code-reviewer** agent to:

- Perform comprehensive code review of all changes
- Verify adherence to SOLID principles and clean code practices
- Check Svelte 5 best practices and runes usage
- Trace code execution paths for correctness
- Identify any remaining technical debt

**Action**: Address all critical feedback before proceeding.

### Phase 4: Testing & Validation (test-runner + sveltekit-validator)

Run comprehensive validation in parallel:

1. Launch **test-runner** to:
   - Execute existing test suites
   - Analyze test failures with detailed diagnostics
   - Report results without making fixes

2. Launch **sveltekit-validator** to:
   - Validate SvelteKit application integrity
   - Check API routes and server-side logic
   - Verify component integration
   - Test build and runtime behavior

**Deliverable**: All tests passing, no regressions introduced.

### Phase 5: CSS Maintenance (css-maintainer) - If Applicable

If refactoring involves UI changes, launch **css-maintainer** to:

- Analyze CSS usage patterns in modified components
- Consolidate duplicate styles
- Remove unused CSS selectors
- Optimize CSS organization and performance

**Deliverable**: Clean, optimized CSS with no visual regressions.

### Phase 6: Final Validation & Reporting

1. Use **sveltekit-validator** for final comprehensive check
2. Generate refactoring report with:
   - **Changes Summary**: What was refactored and why
   - **Architecture Improvements**: Design patterns applied, SOLID compliance
   - **Test Results**: Coverage and validation outcomes
   - **Metrics**: Lines of code changed, complexity reduction, duplication eliminated
   - **Recommendations**: Future improvements and technical debt items

## Tools & Resources

- **Available Scripts**: Check `scripts/` directory for analysis tools (CSS, components, etc.)
- **Architecture Docs**: Reference `docs/architecture/` for MVVM patterns and guides
- **Testing Helpers**: Use `tests/helpers/` and `e2e/core-helpers.js`
- **Parallel Execution**: Launch independent agents concurrently with multiple tool calls in a single message

## Agent Quick Reference

- **parallel-work-orchestrator**: Complex multi-workstream coordination (use first for large refactorings)
- **svelte-mvvm-architect**: Svelte 5 + MVVM architecture analysis and design
- **refactoring-specialist**: Code quality, SOLID principles, design patterns
- **svelte-code-reviewer**: Comprehensive code review after implementation
- **frontend-design-expert**: Visual design, modern CSS, accessibility (UI changes)
- **test-runner**: Test execution and failure analysis
- **sveltekit-validator**: SvelteKit application validation and integration testing
- **css-maintainer**: CSS optimization, deduplication, and maintenance (UI changes)

## Success Criteria

- [ ] All code follows MVVM architecture patterns
- [ ] SOLID principles applied throughout
- [ ] No duplication or code smells
- [ ] Comprehensive test coverage maintained/improved
- [ ] All tests passing (unit + E2E)
- [ ] Build succeeds without errors
- [ ] CSS optimized (if applicable)
- [ ] Documentation updated
- [ ] Project tracking updated
- [ ] Refactoring report delivered

## Notes

- **Never cut corners**: Quality and correctness are paramount
- **Atomic commits**: Each logical refactoring step should be a separate, testable change
- **Leverage agents**: Use specialized agents for their expertise, don't try to do everything yourself
- **Parallel execution**: Launch multiple agents concurrently when tasks are independent
- **Continuous validation**: Test after each significant change, not just at the end
- **Use parallel-work-orchestrator first**: For complex refactorings involving multiple systems/files
