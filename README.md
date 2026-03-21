# ProjectPilot MCP Server

> AI project intelligence connector for Claude — built by [ProjectPilot](https://myprojectpilot.io)

## Overview

The ProjectPilot MCP Server connects Claude to your live project data inside ProjectPilot. Instead of copying and pasting project information into Claude, this connector gives Claude direct access to your health scores, risks, blockers, RAID log, team members, and more — in real time.

## What Claude can do with this connector

**Read your project intelligence:**
- `get_projects` — list all active projects with health scores and status
- `get_project_detail` — full project context including methodology, phase, budget
- `get_health_score` — current health score, trend, and analysis
- `get_risks` — all risks with probability, impact, and mitigation plans
- `get_blockers` — open issues and escalated blockers
- `get_team_members` — team roster with roles
- `get_raid_log` — full RAID log (Risks, Assumptions, Issues, Dependencies)

**Take action on your projects:**
- `log_risk` — log a new risk directly from Claude
- `log_blocker` — log a new issue or blocker from Claude

## Example prompts

Once connected, you can ask Claude things like:

- "What are my active projects and their health scores?"
- "Show me all open risks for Project X"
- "What blockers are affecting my team right now?"
- "Log a high severity risk on Project X — budget overrun likely in Q2"
- "Give me a full RAID summary for Project Y"

## Requirements

- A paid [ProjectPilot](https://myprojectpilot.io) account
- A Claude account with MCP connector access

## MCP Server URL
```
https://mcp.myprojectpilot.io/sse
```

## Authentication

Authentication is handled via your ProjectPilot account credentials. Users must have an active ProjectPilot subscription to connect.

## About ProjectPilot

ProjectPilot is the AI co-pilot for project execution — purpose-built for PMs, Scrum Masters, and PMO leaders. Enter your project once and get health assessments, RAID logs, AI-generated documents, and guided execution — all in one place.

[myprojectpilot.io](https://myprojectpilot.io) · [support@myprojectpilot.io](mailto:support@myprojectpilot.io)