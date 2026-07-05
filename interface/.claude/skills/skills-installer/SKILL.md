---
name: skills-installer
description: Bootstrap that installs this project's required Claude skills into .claude/skills/. Skill folders and sub-agents are git-ignored and NOT committed, so run this after cloning or pulling to restore them. The list of required skills lives in skills.txt. WHEN: "set up the project", "after clone", "after pull", "install project skills", "skills missing", "restore skills", "bootstrap skills", "onboarding".
---

# Skills Installer

This project deliberately does **not** commit Claude skills or sub-agents to git
(see the `.claude/skills/*` and `.claude/agents/` rules in `.gitignore`).
The only tracked skill is this `skills-installer`. It restores every required
skill on demand so the repo stays lean and skills never drift between machines.

## Install all required skills (run this by default)

After any `git clone` or `git pull`, or whenever a skill folder is missing, run:

```bash
bash .claude/skills/skills-installer/install.sh
```

It reads `skills.txt`, downloads each listed skill, and copies it into
`.claude/skills/`. The script is idempotent re-running it cleanly refreshes
every skill.

## Manifest `skills.txt`

`skills.txt` is the **single source of truth**. One skill per line:

```
<owner/repo>[@ref] <path/inside/repo>
```

Currently installed:

| Skill            | Source                              | Purpose                                        |
| ---------------- | ----------------------------------- | ---------------------------------------------- |
| `frontend-design`| `anthropics/skills`                 | Visual/UI design guidance, typography          |
| `theme-factory`  | `anthropics/skills`                 | Color & font theming system                    |
| `webapp-testing` | `anthropics/skills`                 | Playwright verification & screenshots          |

## Adding or removing a skill

1. Edit **`skills.txt`** add or remove a line (e.g. `anthropics/skills skills/canvas-design`).
2. Re-run `install.sh`.

Because the skill folders are git-ignored, **keeping `skills.txt` up to date is
the only way new skills reach the rest of the team.** Always update this manifest
whenever a skill is added to the project.
