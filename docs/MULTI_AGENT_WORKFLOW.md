# Multi-Agent Development Workflow

> Applies to Codex, Claude, Gemini/Antigravity, and other AI development tools.
>
> Repository-discoverable rules are summarized in
> [`../AGENTS.md`](../AGENTS.md).

## Purpose

Sky Knights uses a central-architect, specialist-execution model for substantial
work. The goal is to gain parallel review and implementation without producing
competing edits, disconnected subsystems, or a misleading "green" report from
an incomplete integration run.

The workflow is intentionally tool-agnostic. An "agent" may be a spawned
subagent, a separate IDE session, or a human contributor performing the same
role.

## Roles

### Central architect and orchestrator

Use the strongest practical reasoning model for this role. It owns:

- the user-visible outcome and slice boundary;
- architecture and persistence decisions;
- the task graph and file ownership map;
- cross-system implementation and conflict resolution;
- review of every specialist diff;
- full verification, documentation, and commits;
- the decision to stop, defer, or release.

There must be exactly one central architect for a slice.

### Specialist implementer

Use a capable lower-cost model for bounded work such as:

- deterministic world generation and structure tooling;
- persistence and migrations;
- gameplay/content registries;
- tests and progression closure;
- documentation and packaging.

A specialist receives a narrow contract and exclusive ownership of its files.
It runs targeted checks and reports evidence, but it does not declare the
overall slice complete.

### Independent QA/release architect

This role is read-only until the central architect explicitly assigns a fix. It
challenges the integrated result for:

- migration and existing-world safety;
- determinism and reproducibility;
- missing or unregistered identifiers;
- soft locks and incomplete progression;
- Bedrock stable-API compatibility;
- stale documentation or false implementation claims;
- test blind spots and packaging regressions.

QA findings are inputs to the central architect, not parallel architecture
decisions.

## Slice lifecycle

### 1. Establish the checkpoint

- Inspect the branch, HEAD, dirty files, recent commits, and current test state.
- Create a `codex/<slice-name>` branch, or the equivalent prefix required by
  the active tool.
- Do not discard an inherited dirty tree. Record which files predate the slice.
- State what is built, planned, intentionally inactive, and unsafe to deploy.

### 2. Write the architecture brief

The central architect records:

- the outcome and non-goals;
- invariants and compatibility constraints;
- public types or contracts that roles will share;
- a file ownership table;
- targeted test commands;
- integration and release gates.

For a small slice, this may live in the task plan. For a multi-session effort,
put it in a tracked design or status document.

### 3. Delegate bounded roles

Each role brief must include:

| Field | Required content |
| --- | --- |
| Role | A concrete specialty, not "help with the project" |
| Deliverable | The behavior or artifact to produce |
| Owned files | Exact files or directories the role may edit |
| Forbidden scope | Adjacent systems it must not change |
| Invariants | IDs, schema, determinism, API, or compatibility rules |
| Verification | Targeted commands the role must run |
| Handoff | Changed files, decisions, evidence, and unresolved needs |

Keep ownership disjoint. When two roles need the same file, the central
architect owns that file and accepts proposals from the specialists.

Prefer an isolated Git worktree or equivalent sandbox for each editing role.
Some agent platforms intentionally share one filesystem; in that case, use
strictly disjoint file ownership and leave repository-wide formatting,
generation, staging, and commits to the central architect.

### 4. Integrate continuously

The central architect:

- reads actual diffs while specialists work;
- answers contract questions quickly;
- runs targeted integration checks after each handoff;
- folds duplicate registries or helpers into one source of truth;
- rejects partial activation that can reference missing content;
- keeps the task plan and status documentation current.

Agent success messages are not verification evidence by themselves.

### 5. Adversarial QA

After integration, give QA the combined diff and current test results. At
minimum, QA should attempt to disprove:

- old saves migrate without losing state;
- seeded results are stable and non-overlapping;
- every activated identifier exists and is validated;
- progression has a renewable or recoverable source;
- runtime wiring reaches the new code;
- docs describe the code that actually ships.

Every stop-ship finding must be fixed, explicitly deferred behind an inactive
gate, or accepted by the user.

### 6. Release gate

Run:

```powershell
npm run verify
npm audit --audit-level=high
```

Then update the project tracker, validation log, changelog, decisions, and the
focused hands-on plan. Commit only after the central architect has reviewed the
final diff and QA has no unresolved stop-ship findings.

Minecraft playtesting happens from that exact commit and package. Record the
commit, game version, test world provenance, result, and any defect IDs.

## Compute and token budget

Use capability where it has the highest leverage:

- strongest model: central architecture, integration, schema changes, and final
  review;
- lower-cost capable model: isolated implementation and targeted analysis;
- deterministic tools: formatting, structure generation, type checking, tests,
  packaging, and audits.

Prefer a maximum of three concurrent specialist roles. More agents increase
coordination cost and the chance of overlapping edits. Spawn another role only
when its work is independent and the central architect can review the output.

Use focused context, concise handoffs, targeted searches, and test output
summaries. Do not have multiple agents rediscover the entire repository.

## Failure and recovery

If an agent reaches a quota, crashes, or returns incomplete work:

1. Treat disk state and diffs as authoritative, not its final message.
2. Stop new activation or deployment.
3. Inventory modified and untracked files.
4. Run targeted type checks and tests.
5. Reassign only the unfinished ownership area.
6. Have the central architect integrate before resuming normal work.

Do not rerun a large workflow blindly. It may duplicate surviving output or
overwrite valid partial work.

## Recommended improvements over unrestricted agent teams

- Use one accountable integrator instead of a peer swarm.
- Partition by files and contracts, not just feature descriptions.
- Pair implementation with independent read-only QA.
- Keep planned content explicitly inactive until dependencies exist.
- Checkpoint green work at the end of every slice.
- Scale agent count to the task, not to the maximum concurrency available.
- Preserve a vendor-neutral repository handoff so work can move between agent
  platforms without relying on private chat history.
