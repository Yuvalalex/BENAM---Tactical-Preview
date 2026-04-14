---
name: readme-file-master
description: 'Create or rewrite a README in strong English with a high-conviction GitHub landing page, accurate setup steps, audience-aware positioning, feature summaries, architecture notes, demo guidance, and final quality checks. Use when asked to improve documentation, rewrite README.md, make the project page look professional, or produce a world-class English README.'
argument-hint: 'Repository, product, or README goal to document'
user-invocable: true
---

# README File Master

## What This Skill Produces

This skill creates or rewrites a repository README so it works as a serious project front page, not just a notes file.

Default bias for this workspace:
- BENAM-specific
- English only
- Professional product/demo positioning first, developer onboarding second

Target outcome:
- Strong English aimed at the right audience
- Accurate claims backed by the codebase
- Fast onboarding for local run, build, and test
- Clear separation between public-safe content and sensitive or private details
- A README that is useful to evaluators, collaborators, and future maintainers

## When to Use

Use this skill when the user asks for any of the following:
- Make `README.md` much better
- Rewrite the README in English
- Create a polished GitHub landing page
- Improve project documentation for demos, hiring, pilots, or open-source distribution
- Add structure, setup steps, feature summaries, screenshots guidance, or architecture sections

## Procedure

1. Audit the repository before drafting.
   - Read the current `README.md` if it exists.
   - Inspect `package.json`, build scripts, test scripts, app entry points, and any docs that affect setup or claims.
   - Identify the actual stack, supported platforms, and working commands.
   - Do not invent demos, screenshots, metrics, integrations, or production guarantees.

2. Identify the README's primary audience and goal.
   - Infer from the repo when possible.
   - If unclear, choose the safest plausible framing and state the assumption.
   - In this BENAM workspace, default to evaluators, pilot partners, and technical reviewers unless the user says otherwise.
   - Typical audience branches:
     - Recruiters or evaluators: emphasize clarity, value proposition, quick proof of quality.
     - Engineers: emphasize architecture, setup, scripts, constraints, and contribution flow.
     - Customers or partners: emphasize outcomes, deployment shape, trust boundaries, and contact paths.

3. Decide the README type.
   - For product demos or proprietary previews: highlight capabilities, boundaries, disclaimers, and evaluation flow.
   - For open-source libraries or tools: highlight installation, API or usage, examples, and contribution guidance.
   - For internal or hybrid apps: balance product narrative with developer onboarding.

4. Gather proof for every important section.
   - Commands come from real scripts.
   - Platform support comes from actual files and configs.
   - Feature bullets come from implemented flows, not aspirations.
   - If information is missing, either omit it or mark it as a placeholder only when the user explicitly wants placeholders.

5. Draft the README structure using the blueprint in [README Blueprint](./assets/README_BLUEPRINT.md).
   - Keep the opening tight: product identity, what it does, why it matters.
   - Add a short proof strip near the top when useful: demo link, video, platform, stack, status.
   - Order sections from decision-making value to implementation detail.

6. Write with disciplined English.
   - Prefer concrete claims over hype.
   - Use short paragraphs and scan-friendly bullets.
   - Remove repetition, filler, and empty adjectives.
   - Replace vague phrases like "powerful solution" with specific operational value.

7. Handle sensitive or risky domains carefully.
   - Avoid exposing operationally sensitive, security-sensitive, or medically unsafe details that should remain private.
   - For tactical, medical, or regulated software, include appropriate disclaimers when the repo is clearly a demo, preview, or non-clinical artifact.
   - Separate public demo behavior from private or commercial capabilities when that distinction exists.
   - In BENAM, preserve the public-safe boundary and avoid presenting the repository as a production clinical system.

8. Validate the draft against the codebase.
   - Check that install, run, build, test, and packaging commands match the repo.
   - Check that file paths and architecture references are real.
   - Remove stale sections copied from old README content if they no longer match the repository.

9. Finish with a final quality pass.
   - The first screen should explain the project in under 20 seconds.
   - The quick start should be executable without guesswork.
   - Claims should survive basic technical scrutiny.
   - English should read cleanly and professionally.

## Decision Rules

- If the repo already has a decent README, preserve useful facts and upgrade structure and language instead of replacing everything blindly.
- If links, demo URLs, contact details, or screenshots are missing, keep explicit placeholders only when the user asked for a polished draft that can be finalized later.
- If the repository mixes legacy and modern code, explain that plainly instead of pretending the architecture is fully unified.
- If the project includes sensitive functionality, describe public-safe outcomes and omit implementation details that create risk.

## Completion Checks

The skill is complete when all of the following are true:
- The README opens with a crisp project summary in English.
- Audience and use case are obvious.
- Setup and verification commands are real.
- Major sections are ordered logically and are easy to scan.
- Claims are grounded in the repository.
- Disclaimers and boundaries are present when the domain requires them.
- The final document reads like a serious project front page.

## Output Expectations

When using this skill:
- Prefer editing the actual `README.md` unless the user asked for a separate draft.
- Briefly note assumptions made because of missing information.
- Mention any placeholders that still need user-supplied data, such as demo URLs, screenshots, or contact details.