
# Legacy/Deprecated/Unused Code Audit (Post-Unified Session Refactor)

This document lists all files, code patterns, and storage keys that are now deprecated, unused, or candidates for removal after the unified session refactor. Use this as a checklist for final codebase cleanup.

All legacy server-side files, database tables, socket events, and localStorage keys have been removed. Documentation and test helpers referencing legacy code have been deleted. The codebase now uses only the unified session architecture (RunSessionManager, RunSessionClient, unified run:* events). No backward compatibility or migration code remains.
