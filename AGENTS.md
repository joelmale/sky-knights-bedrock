# Sky Knights Agent Instructions

These instructions are vendor-neutral. Codex, Claude, Gemini/Antigravity, and
other AI development tools should follow them when working in this repository.
The detailed operating model is in
[`docs/MULTI_AGENT_WORKFLOW.md`](docs/MULTI_AGENT_WORKFLOW.md).

## Operating model

Use a hub-and-spoke workflow for substantial slices:

1. One high-capability central architect owns scope, architecture, integration,
   verification, documentation, and commits.
2. Lower-cost specialist agents receive narrow, independently testable tasks.
3. One independent QA/release role reviews the integrated result.
4. The central architect resolves every cross-file decision and is the only
   role that declares the slice complete.

Small, localized fixes do not require delegation. Do not create agents merely
to increase concurrency.

## Delegation rules

- Give every specialist an explicit role, deliverable, file ownership boundary,
  and verification command.
- Prefer isolated worktrees or equivalent sandboxes when the agent platform
  supports them. If agents share one worktree, their edit ownership must be
  disjoint and the central architect must coordinate formatting and generated
  files.
- Only one active role may edit a file. Read-only review may overlap.
- Prefer two or three specialists per slice. Add more only when the work has
  genuinely independent ownership.
- Specialists must not commit, deploy, change package versions, rename shipped
  identifiers, or expand scope unless the central architect explicitly assigns
  that action.
- Specialists report changed files, decisions, test evidence, and unresolved
  integration needs.
- The central architect reviews diffs rather than accepting specialist reports
  as proof.
- Use the least expensive model that can reliably perform a bounded role.
  Reserve the strongest available model for architecture, integration,
  migration safety, and final review.
- Share focused briefs and relevant contracts instead of entire transcripts
  when the agent platform permits it.

## Project invariants

- Target stable Minecraft Bedrock APIs unless a task is explicitly assigned to
  an experimental profile.
- Preserve shipped identifiers, pack UUIDs, dynamic-property keys, and existing
  structure bytes unless a documented migration intentionally changes them.
- Deterministic world logic must not use `Math.random()`, `Date.now()`,
  unordered iteration, or a shared random stream for unrelated purposes.
- Existing worlds must not silently relocate generated or player-modified
  islands.
- Planned content must not be activated until every referenced item, entity,
  structure, localization entry, and progression source exists and validates.
- Treat `docs/CONTENT_MATRIX.md` as a contract only when its rows accurately
  distinguish `built` from `planned`.
- Use 2-space indentation, double quotes, trailing commas, and named exports.

## Required slice gate

Before a central architect commits a slice:

1. Review the worktree and preserve unrelated user changes.
2. Reconcile specialist work into one architecture with no duplicate source of
   truth.
3. Run targeted tests while integrating.
4. Run `npm run verify`.
5. Run `npm audit --audit-level=high`.
6. Update `CHANGELOG.md`, `docs/PROJECT_STATUS.md`,
   `docs/VALIDATION_LOG.md`, applicable test plans, and
   `docs/DECISIONS.md` when contracts changed.
7. Obtain an independent QA review of the integrated diff.
8. Commit only a green, documented checkpoint unless the user explicitly asks
   for a labeled work-in-progress commit.

Hands-on Minecraft validation remains a separate gate. Automated verification
does not prove in-game behavior.
