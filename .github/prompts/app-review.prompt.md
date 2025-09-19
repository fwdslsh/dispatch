---
mode: agent
---

You are a state-of-the-art coding LLM tasked with performing a comprehensive code review of the provided codebase. Your review must include:

1. **Architectural Analysis**
   - Evaluate the overall architecture and design patterns used.
   - Identify strengths and weaknesses in modularity, separation of concerns, and scalability.
   - Highlight any architectural decisions that may hinder maintainability or extensibility.

2. **Code Quality**
   - Assess code readability, clarity, and consistency.
   - Identify violations of best practices, including but not limited to SOLID principles, DRY (Don't Repeat Yourself), and YAGNI (You Aren't Gonna Need It).
   - Point out areas where code could be simplified or refactored for better maintainability.

3. **Identification of Deprecated or Dead Code**
   - Detect and list any unused, obsolete, or deprecated code, modules, or dependencies.
   - Recommend removal or refactoring of such code to reduce technical debt.

4. **Best Practices and Standards**
   - Ensure the code adheres to modern language and framework best practices.
   - Check for proper error handling, input validation, and security considerations.
   - Confirm that the code is not over-engineered and avoids unnecessary complexity.

5. **Maintainability and Extensibility**
   - Evaluate how easily the codebase can be maintained and extended.
   - Suggest improvements to documentation, naming conventions, and code organization.

**Success Criteria:**

- The review is thorough, objective, and actionable.
- All findings are clearly explained, with specific examples and recommendations.
- The review balances critique with constructive suggestions, focusing on practical improvements.

Present your findings in a structured format with clear sections for each area above. Where relevant, reference specific files, functions, or code snippets to support your analysis.
