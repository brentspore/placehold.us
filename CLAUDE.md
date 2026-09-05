# Project session entry (Claude Code)

Canonical project memory is tool-agnostic and lives in `.ai/memory/` (see `AI.md`). The imports below load it every session; global memory (rules, playbook, pulse) arrives via the SessionStart hook.

Before ending a substantive session: update `.ai/memory/HANDOFF.md` (current state, how to run/verify, next step) and this project's entry in `~/.ai/memory/PULSE.md` (one left-off line, one next-step line).

@.ai/memory/project.md
@.ai/memory/reference.md
@.ai/memory/DECISIONS.md
@.ai/memory/HANDOFF.md
