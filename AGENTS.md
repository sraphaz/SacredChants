# Agent notes — Sacred Chants

## ARAH Harness

This repo uses **[ARAH](https://github.com/sraphaz/arah-harness)** (Agent Runtime Autonomous Harness).

- Config: `arah.config.yaml`
- Agents / skills: `.agents/`, `.skills/`
- Validate: `./scripts/agents/validate-manifests.ps1`
- Doctor: `powershell -File $env:ARAH_HARNESS_PATH\cli\arah.ps1 doctor -Target .`
- Upstream path (local): `../arah-harness` or `$env:ARAH_HARNESS_PATH`

Agents propose; humans merge. Prefer PR-based delivery.

### Visual bug reporter (must test)

Flow contract:

1. User can fill title/description/image **before** GitHub login.
2. Upload/crop must **not** POST `/api/contribute/report`.
3. Submit without session → show login; keep draft; OAuth `returnTo` includes `report=1` and `returnOrigin` is the **same browser origin** (never bounce to a different “Contribute app” host by mistake).
4. After OAuth, reopen dialog from `sessionStorage` draft and optionally auto-submit.

Automated proof:

```bash
npm run test:e2e -- e2e/bug-report.spec.ts
```

## Bug queue for agents (`agent-queue`)

Autonomous / assisted loop for open issues labeled `agent-queue` (usually also `bug`), **through opening a PR**. Humans merge — agents never merge.

### One-command pickup → PR (after the fix exists)

```powershell
# 1) Pick next issue (structured JSON + body on disk)
./scripts/agents/pickup-agent-queue.ps1 -WriteBody -Json

# 2) Agent implements + verifies, then open PR from prepared paths:
./scripts/agents/resolve-agent-queue-issue.ps1 -IssueNumber <n> -OpenPr -Paths <file1>,<file2>,...
```

Optional claim comment: `-Claim`. Dry-run: `-OpenPr -DryRun`. Keep queue label: `-KeepAgentQueueLabel`.

### Full procedure

1. **Pickup:** `./scripts/agents/pickup-agent-queue.ps1 -WriteBody` (or `gh issue list --label agent-queue --state open`).
2. **Scope:** `gh issue view <n>`; reproduce if feasible; create an ARAH task (`./scripts/agents/execute-task.ps1 -Objective "…" -Area <area> -WorkClass standard`). Use domain `bug-report` only when the change is the visual reporter itself.
3. **Fix:** minimal code change + focused tests; do not expand scope.
4. **Verify:** unit/e2e as appropriate; complete the ARAH task with evidence.
5. **Ship (autonomous PR):** `./scripts/agents/resolve-agent-queue-issue.ps1 -IssueNumber <n> -OpenPr -Paths …`  
   Creates `fix/agent-queue-<n>-<slug>`, commits (skips `.env` / secrets / noise), pushes `-u`, `gh pr create` with `Fixes #<n>`, comments the issue, removes `agent-queue` (unless `-KeepAgentQueueLabel`). Adds `ready-for-review` only if that label already exists. **Never merge.**

Skill: `.skills/pickup-agent-queue.skill.yaml`.

## New mantra / chant ingestion

When adding or syncing a mantra (text, audio, karaoke timestamps, locales):

1. Read and follow the project skill: [`.cursor/skills/chant-ingestion/SKILL.md`](.cursor/skills/chant-ingestion/SKILL.md)
2. Extra detail (SRT mapping, ffmpeg + faster-whisper): [`.cursor/skills/chant-ingestion/reference.md`](.cursor/skills/chant-ingestion/reference.md)

**Spotify** (`spotifyUrl`) is listen-only. Karaoke requires `public/audio/<slug>.mp3` + `lines[].start`.

Shared timestamp tooling: `scripts/lib/chant-timestamps.mjs`, `scripts/apply-chant-timestamps.mjs`.

## Other pointers

- Schema: `src/content/schemas/chant.ts`
- Locale merge: `npm run chant:merge-locales`
- Human contributing guide: `CONTRIBUTING.md`
- Bug queue for agents: see **Bug queue for agents** above (`pickup-agent-queue.ps1` → `resolve-agent-queue-issue.ps1 -OpenPr`)
