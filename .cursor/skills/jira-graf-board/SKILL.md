---
name: jira-graf-board
description: Use the GRAF Jira board/project for any Jira work originating from this Grafana repository. Use whenever the user asks to create, search, update, comment on, or triage Jira issues, generate tickets from specs or meeting notes, build a backlog, or otherwise reference Jira from this codebase.
---

# Jira: Use the GRAF Board

## Rule

All Jira tasks initiated from this codebase MUST target the **GRAF** project/board in the connected Atlassian account. Do not create or modify issues in any other project unless the user explicitly names a different project key in the current request.

## Applies To

Any Jira-related action, including but not limited to:

- Creating issues, subtasks, epics, or bugs
- Searching, filtering, or listing issues (default JQL scope: `project = GRAF`)
- Adding comments, transitions, assignees, or links
- Converting Confluence specs to backlogs (Epic + tickets land in GRAF)
- Capturing action items from meeting notes into Jira
- Triaging bug reports or error messages

This applies to direct MCP `atlassian` tool calls and to the Atlassian skills (`spec-to-backlog`, `capture-tasks-from-meeting-notes`, `triage-issue`, `generate-status-report`, `search-company-knowledge`).

## How to Apply

1. When creating issues: set `projectKey` (or equivalent field) to `GRAF`.
2. When searching: scope JQL with `project = GRAF` unless the user asks to search broader.
3. When a sibling skill (e.g. `spec-to-backlog`, `triage-issue`) asks which project to use, answer `GRAF` without re-prompting the user.
4. If the user explicitly specifies a different project key in their message, honor that for the current request only — do not change the default.

## Confirmation

Do not ask the user "which project?" for routine Jira actions in this repo. Proceed with `GRAF` and mention it briefly in your response (e.g. "Created GRAF-123 ...").
