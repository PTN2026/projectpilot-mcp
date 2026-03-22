# ProjectPilot MCP Server

> AI co-pilot for project execution — your live project data, inside Claude.

Built by [ProjectPilot](https://myprojectpilot.io) — the AI co-pilot for project execution.

---

## Description

The ProjectPilot MCP Server connects Claude to your live project data. Instead of copying and pasting project information into Claude, this connector gives Claude direct access to your health scores, risks, blockers, RAID log, team members, and more — in real time.

Ask Claude to surface open blockers, draft a status report grounded in your actual project data, log a new risk, or pull your full RAID log — all without leaving the conversation.

---

## Features

- **Live project intelligence** — health scores, risks, blockers, RAID log, and team data pulled directly from your ProjectPilot workspace
- **AI document generation** — status reports, BRDs, and steering committee decks generated from your real project context
- **Built-in chat** — a project-aware AI chat that knows your current phase, health score, and open issues
- **Write actions** — log risks and blockers directly from Claude without opening ProjectPilot
- **Coming soon** — Jira and Azure DevOps integration, bringing your full delivery workflow into Claude

---

## Setup

1. Visit the [Anthropic MCP Directory](https://claude.com/connectors)
2. Find and connect to **ProjectPilot**
3. Complete OAuth authentication with your ProjectPilot account
4. Start asking Claude about your projects

---

## Authentication

ProjectPilot uses OAuth 2.0 for authentication. You will need:
- A valid [ProjectPilot](https://myprojectpilot.io) account (Pro or Enterprise plan)
- OAuth authorization via myprojectpilot.io

**OAuth endpoints:**
- Authorization: `https://myprojectpilot.io/api/mcp/authorize`
- Token: `https://myprojectpilot.io/api/mcp/token`
- Callback: `https://myprojectpilot.io/api/mcp/callback`

---

## Examples

### Example 1: Get project health overview

**User prompt:** "What are my active projects and their health scores?"

**What happens:**
- Claude calls `get_projects` to retrieve all active projects
- Returns project names, health scores, methodology, schedule status, and budget status
- Claude summarizes which projects need attention and which are on track

**Sample response from Claude:**
> You have 2 active projects. Website Redesign Q2 has a health score of 50/100 (Needs Attention) — the main risks are vendor delays and scope creep. CRM Migration is at 57/100 (Needs Attention) — UAT sign-off is blocked and a data migration risk is open.

---

### Example 2: Surface open blockers and log a new risk

**User prompt:** "What blockers are affecting my team right now? Also log a new risk — our key vendor just told us delivery will be 3 weeks late, high probability, critical impact."

**What happens:**
- Claude calls `get_blockers` to retrieve all open and escalated issues
- Claude calls `log_risk` to log the new vendor delay risk with the details provided
- Returns a summary of current blockers and confirms the new risk was logged

**Sample response from Claude:**
> You have 2 open blockers: "Waiting on legal approval for data sharing agreement" and "IT environment access not provisioned for QA team." I've logged the vendor delay as a new High Probability / Critical Impact risk on your project. Want me to draft a mitigation plan?

---

### Example 3: Generate a status report grounded in live project data

**User prompt:** "Draft a steering committee status report for my CRM Migration project."

**What happens:**
- Claude calls `get_project_detail` to get full project context
- Claude calls `get_health_score` to retrieve current health and analysis
- Claude calls `get_risks` to pull all open risks
- Claude calls `get_blockers` to pull all open blockers
- Claude generates a structured status report with RAG status, key risks, blockers, and next steps — all grounded in real project data

**Sample response from Claude:**
> Here's your steering committee status report for CRM Migration...
> **Overall Status: AMBER** | Health Score: 57/100
> **Schedule:** At Risk — UAT blocked pending IT access provisioning
> **Budget:** On Track — $0 variance to baseline
> **Key Risks:** Data migration errors (High/Critical), stakeholder unavailability for UAT (Medium/High)
> **Open Blockers:** IT environment access, vendor contract unsigned
> **Recommended Actions:** Escalate IT access request, confirm vendor contract timeline

---

## Available Tools

| Tool | Type | Description |
|------|------|-------------|
| `get_projects` | READ | List all active projects with health scores and status |
| `get_project_detail` | READ | Full project context including methodology, phase, budget |
| `get_health_score` | READ | Current health score, trend, and AI analysis |
| `get_risks` | READ | All risks with probability, impact, and mitigation plans |
| `get_blockers` | READ | Open issues and escalated blockers |
| `get_team_members` | READ | Team roster with roles |
| `get_raid_log` | READ | Full RAID log (Risks, Assumptions, Issues, Dependencies) |
| `log_risk` | WRITE | Log a new risk directly from Claude |
| `log_blocker` | WRITE | Log a new issue or blocker from Claude |

---

## Technical Details

| Field | Value |
|-------|-------|
| SSE Endpoint | `https://mcp.myprojectpilot.io/sse` |
| Streamable HTTP | `https://mcp.myprojectpilot.io/mcp` |
| Health Check | `https://mcp.myprojectpilot.io/health` |
| OAuth Metadata | `https://mcp.myprojectpilot.io/.well-known/oauth-authorization-server` |
| Transport | HTTP/SSE + Streamable HTTP |

---

## Privacy Policy

Your project data is private to your account and never shared with other users or used to train AI models.

Full privacy policy: [myprojectpilot.io/privacy](https://myprojectpilot.io/privacy)

---

## Support

- Email: [support@myprojectpilot.io](mailto:support@myprojectpilot.io)
- Documentation: [myprojectpilot.io/learn](https://myprojectpilot.io/learn)
- Issues: [github.com/PTN2026/projectpilot-mcp](https://github.com/PTN2026/projectpilot-mcp)

---

## About ProjectPilot

ProjectPilot is the AI co-pilot for project execution — purpose-built for PMs, Scrum Masters, and PMO leaders. Enter your project once and get health assessments, RAID logs, AI-generated documents, and guided execution — all in one place.

[myprojectpilot.io](https://myprojectpilot.io) · [support@myprojectpilot.io](mailto:support@myprojectpilot.io)
