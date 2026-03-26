import express from 'express'
import cors from 'cors'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import * as dotenv from 'dotenv'
import { randomUUID } from 'crypto'

dotenv.config()

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
)

// ─── TOKEN VALIDATION ─────────────────────────────────────────────────────────

async function validateToken(authHeader: string | undefined): Promise<string | null> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null
  const token = authHeader.replace('Bearer ', '').trim()

  const { data, error } = await supabase
    .from('mcp_tokens')
    .select('user_id, expires_at')
    .eq('access_token', token)
    .single()

  if (error || !data) return null
  if (new Date(data.expires_at) < new Date()) return null

  return data.user_id
}

// ─── JIRA HELPER ─────────────────────────────────────────────────────────────

async function jiraRequest(path: string, jiraDomain: string, jiraEmail: string, jiraToken: string): Promise<any> {
  const url = `https://${jiraDomain}/rest/api/3/${path}`
  const auth = Buffer.from(`${jiraEmail}:${jiraToken}`).toString('base64')
  const res = await fetch(url, {
    headers: {
      'Authorization': `Basic ${auth}`,
      'Accept': 'application/json',
    }
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Jira API error ${res.status}: ${text}`)
  }
  return res.json()
}

// ─── SERVER FACTORY ───────────────────────────────────────────────────────────

function createServer(userId: string) {
  const server = new McpServer({
    name: 'projectpilot',
    version: '1.1.0',
    description: 'ProjectPilot MCP Server — AI project intelligence connector for Claude'
  })

  // ─── READ TOOLS ─────────────────────────────────────────────────────────────

  server.tool(
    'get_projects',
    'Get all active projects for the authenticated user',
    {},
    { title: 'Get Projects', readOnlyHint: true, destructiveHint: false },
    async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('id, name, description, methodology, current_phase, completion_percent, health_score, schedule_status, budget_status, start_date, end_date')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
      if (error) return { content: [{ type: 'text', text: `Error: ${error.message}` }] }
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
    }
  )

  server.tool(
    'get_project_detail',
    'Get full details of a specific project',
    { project_id: z.string().describe('The project ID') },
    { title: 'Get Project Detail', readOnlyHint: true, destructiveHint: false },
    async ({ project_id }) => {
      const { data, error } = await supabase
        .from('projects').select('*').eq('id', project_id).eq('user_id', userId).single()
      if (error) return { content: [{ type: 'text', text: `Error: ${error.message}` }] }
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
    }
  )

  server.tool(
    'get_health_score',
    'Get health score and analysis for a project',
    { project_id: z.string().describe('The project ID') },
    { title: 'Get Health Score', readOnlyHint: true, destructiveHint: false },
    async ({ project_id }) => {
      const { data, error } = await supabase
        .from('projects')
        .select('name, health_score, health_analysis, health_assessed_at, schedule_status, budget_status, completion_percent')
        .eq('id', project_id).eq('user_id', userId).single()
      if (error) return { content: [{ type: 'text', text: `Error: ${error.message}` }] }
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
    }
  )

  server.tool(
    'get_risks',
    'Get all risks for a project',
    {
      project_id: z.string().describe('The project ID'),
      status: z.string().optional().describe('Filter by status: Open, Mitigated, Accepted, Closed')
    },
    { title: 'Get Risks', readOnlyHint: true, destructiveHint: false },
    async ({ project_id, status }) => {
      let query = supabase.from('risks').select('*').eq('project_id', project_id).order('created_at', { ascending: false })
      if (status) query = query.eq('status', status)
      const { data, error } = await query
      if (error) return { content: [{ type: 'text', text: `Error: ${error.message}` }] }
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
    }
  )

  server.tool(
    'get_blockers',
    'Get open issues and blockers for a project',
    { project_id: z.string().describe('The project ID') },
    { title: 'Get Blockers', readOnlyHint: true, destructiveHint: false },
    async ({ project_id }) => {
      const { data, error } = await supabase
        .from('issues').select('*').eq('project_id', project_id)
        .in('status', ['Open', 'In Progress', 'Escalated'])
        .order('created_at', { ascending: false })
      if (error) return { content: [{ type: 'text', text: `Error: ${error.message}` }] }
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
    }
  )

  server.tool(
    'get_team_members',
    'Get team members for a project',
    { project_id: z.string().describe('The project ID') },
    { title: 'Get Team Members', readOnlyHint: true, destructiveHint: false },
    async ({ project_id }) => {
      const { data, error } = await supabase
        .from('projects').select('team_members, pm_name, sponsor_name, team_size').eq('id', project_id).eq('user_id', userId).single()
      if (error) return { content: [{ type: 'text', text: `Error: ${error.message}` }] }
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
    }
  )

  server.tool(
    'get_raid_log',
    'Get the full RAID log for a project (Risks, Assumptions, Issues, Dependencies)',
    { project_id: z.string().describe('The project ID') },
    { title: 'Get RAID Log', readOnlyHint: true, destructiveHint: false },
    async ({ project_id }) => {
      const [risks, assumptions, issues, dependencies] = await Promise.all([
        supabase.from('risks').select('*').eq('project_id', project_id),
        supabase.from('assumptions').select('*').eq('project_id', project_id),
        supabase.from('issues').select('*').eq('project_id', project_id),
        supabase.from('dependencies').select('*').eq('project_id', project_id),
      ])
      const raid = {
        risks: risks.data ?? [],
        assumptions: assumptions.data ?? [],
        issues: issues.data ?? [],
        dependencies: dependencies.data ?? []
      }
      return { content: [{ type: 'text', text: JSON.stringify(raid, null, 2) }] }
    }
  )

  // ─── WRITE TOOLS ────────────────────────────────────────────────────────────

  server.tool(
    'log_risk',
    'Log a new risk to a project',
    {
      project_id: z.string().describe('The project ID'),
      title: z.string().describe('Risk title'),
      probability: z.enum(['Low', 'Medium', 'High']).describe('Probability of occurrence'),
      impact: z.enum(['Low', 'Medium', 'High', 'Critical']).describe('Impact if it occurs'),
      mitigation: z.string().optional().describe('Mitigation strategy'),
      owner: z.string().optional().describe('Risk owner name')
    },
    { title: 'Log Risk', readOnlyHint: false, destructiveHint: true },
    async ({ project_id, title, probability, impact, mitigation, owner }) => {
      const { data, error } = await supabase
        .from('risks')
        .insert({ project_id, user_id: userId, title, probability, impact, mitigation, owner, status: 'Open' })
        .select().single()
      if (error) return { content: [{ type: 'text', text: `Error: ${error.message}` }] }
      return { content: [{ type: 'text', text: `Risk logged: ${JSON.stringify(data, null, 2)}` }] }
    }
  )

  server.tool(
    'log_blocker',
    'Log a new issue or blocker to a project',
    {
      project_id: z.string().describe('The project ID'),
      title: z.string().describe('Blocker title'),
      severity: z.enum(['Low', 'Medium', 'High', 'Critical']).describe('Severity level'),
      description: z.string().optional().describe('Detailed description'),
      owner: z.string().optional().describe('Owner responsible for resolution')
    },
    { title: 'Log Blocker', readOnlyHint: false, destructiveHint: true },
    async ({ project_id, title, severity, description, owner }) => {
      const { data, error } = await supabase
        .from('issues')
        .insert({
          project_id, user_id: userId, title, severity, description, owner,
          status: 'Open',
          date_logged: new Date().toISOString().split('T')[0]
        })
        .select().single()
      if (error) return { content: [{ type: 'text', text: `Error: ${error.message}` }] }
      return { content: [{ type: 'text', text: `Blocker logged: ${JSON.stringify(data, null, 2)}` }] }
    }
  )

  // ─── JIRA TOOLS ─────────────────────────────────────────────────────────────

  server.tool(
    'get_jira_issues',
    'Get issues from a Jira project. Requires jira_domain, jira_email, jira_token, and project_key.',
    {
      jira_domain: z.string().describe('Your Jira domain e.g. mycompany.atlassian.net'),
      jira_email: z.string().describe('Your Atlassian account email'),
      jira_token: z.string().describe('Your Jira API token'),
      project_key: z.string().describe('Jira project key e.g. PT'),
      status: z.string().optional().describe('Filter by status e.g. "In Progress", "To Do", "Done"'),
      max_results: z.number().optional().describe('Max number of issues to return (default 20)')
    },
    { title: 'Get Jira Issues', readOnlyHint: true, destructiveHint: false },
    async ({ jira_domain, jira_email, jira_token, project_key, status, max_results }) => {
      try {
        let jql = `project = ${project_key} ORDER BY updated DESC`
        if (status) jql = `project = ${project_key} AND status = "${status}" ORDER BY updated DESC`
        const maxR = max_results ?? 20
        const data = await jiraRequest(
          `search?jql=${encodeURIComponent(jql)}&maxResults=${maxR}&fields=summary,status,assignee,priority,issuetype,created,updated,description`,
          jira_domain, jira_email, jira_token
        )
        const issues = (data.issues ?? []).map((issue: any) => ({
          key: issue.key,
          summary: issue.fields.summary,
          status: issue.fields.status?.name,
          assignee: issue.fields.assignee?.displayName ?? 'Unassigned',
          priority: issue.fields.priority?.name,
          type: issue.fields.issuetype?.name,
          updated: issue.fields.updated,
        }))
        return { content: [{ type: 'text', text: JSON.stringify({ total: data.total, issues }, null, 2) }] }
      } catch (err: any) {
        return { content: [{ type: 'text', text: `Error fetching Jira issues: ${err.message}` }] }
      }
    }
  )

  server.tool(
    'get_jira_sprint',
    'Get the current active sprint and its issues for a Jira board.',
    {
      jira_domain: z.string().describe('Your Jira domain e.g. mycompany.atlassian.net'),
      jira_email: z.string().describe('Your Atlassian account email'),
      jira_token: z.string().describe('Your Jira API token'),
      project_key: z.string().describe('Jira project key e.g. PT'),
    },
    { title: 'Get Jira Sprint', readOnlyHint: true, destructiveHint: false },
    async ({ jira_domain, jira_email, jira_token, project_key }) => {
      try {
        // Get active sprint issues via JQL
        const jql = `project = ${project_key} AND sprint in openSprints() ORDER BY status ASC`
        const data = await jiraRequest(
          `search?jql=${encodeURIComponent(jql)}&maxResults=50&fields=summary,status,assignee,priority,issuetype`,
          jira_domain, jira_email, jira_token
        )
        const issues = (data.issues ?? []).map((issue: any) => ({
          key: issue.key,
          summary: issue.fields.summary,
          status: issue.fields.status?.name,
          assignee: issue.fields.assignee?.displayName ?? 'Unassigned',
          priority: issue.fields.priority?.name,
          type: issue.fields.issuetype?.name,
        }))

        // Summarize by status
        const byStatus: Record<string, number> = {}
        issues.forEach((i: any) => {
          byStatus[i.status] = (byStatus[i.status] ?? 0) + 1
        })

        return {
          content: [{
            type: 'text', text: JSON.stringify({
              total_issues: data.total,
              by_status: byStatus,
              issues
            }, null, 2)
          }]
        }
      } catch (err: any) {
        return { content: [{ type: 'text', text: `Error fetching Jira sprint: ${err.message}` }] }
      }
    }
  )

  server.tool(
    'get_jira_blockers',
    'Get blocked or high-priority in-progress issues from Jira that need attention.',
    {
      jira_domain: z.string().describe('Your Jira domain e.g. mycompany.atlassian.net'),
      jira_email: z.string().describe('Your Atlassian account email'),
      jira_token: z.string().describe('Your Jira API token'),
      project_key: z.string().describe('Jira project key e.g. PT'),
    },
    { title: 'Get Jira Blockers', readOnlyHint: true, destructiveHint: false },
    async ({ jira_domain, jira_email, jira_token, project_key }) => {
      try {
        const jql = `project = ${project_key} AND status = "In Progress" AND priority in (High, Critical) ORDER BY priority DESC`
        const data = await jiraRequest(
          `search?jql=${encodeURIComponent(jql)}&maxResults=20&fields=summary,status,assignee,priority,issuetype,updated`,
          jira_domain, jira_email, jira_token
        )
        const issues = (data.issues ?? []).map((issue: any) => ({
          key: issue.key,
          summary: issue.fields.summary,
          status: issue.fields.status?.name,
          assignee: issue.fields.assignee?.displayName ?? 'Unassigned',
          priority: issue.fields.priority?.name,
          type: issue.fields.issuetype?.name,
          updated: issue.fields.updated,
        }))
        return { content: [{ type: 'text', text: JSON.stringify({ total_blockers: data.total, issues }, null, 2) }] }
      } catch (err: any) {
        return { content: [{ type: 'text', text: `Error fetching Jira blockers: ${err.message}` }] }
      }
    }
  )

  server.tool(
    'sync_jira_to_project',
    'Pull Jira issues into a ProjectPilot project as blockers/issues. Syncs In Progress and high priority items.',
    {
      project_id: z.string().describe('The ProjectPilot project ID'),
      jira_domain: z.string().describe('Your Jira domain e.g. mycompany.atlassian.net'),
      jira_email: z.string().describe('Your Atlassian account email'),
      jira_token: z.string().describe('Your Jira API token'),
      project_key: z.string().describe('Jira project key e.g. PT'),
    },
    { title: 'Sync Jira to Project', readOnlyHint: false, destructiveHint: false },
    async ({ project_id, jira_domain, jira_email, jira_token, project_key }) => {
      try {
        // Fetch in-progress issues from Jira
        const jql = `project = ${project_key} AND status = "In Progress" ORDER BY updated DESC`
        const data = await jiraRequest(
          `search?jql=${encodeURIComponent(jql)}&maxResults=20&fields=summary,status,assignee,priority,issuetype`,
          jira_domain, jira_email, jira_token
        )

        const issues = data.issues ?? []
        let synced = 0

        for (const issue of issues) {
          const title = `[${issue.key}] ${issue.fields.summary}`
          const severity = issue.fields.priority?.name === 'Critical' ? 'Critical'
            : issue.fields.priority?.name === 'High' ? 'High'
            : 'Medium'
          const owner = issue.fields.assignee?.displayName ?? 'Unassigned'

          // Check if already synced
          const { data: existing } = await supabase
            .from('issues')
            .select('id')
            .eq('project_id', project_id)
            .eq('title', title)
            .single()

          if (!existing) {
            await supabase.from('issues').insert({
              project_id,
              user_id: userId,
              title,
              severity,
              owner,
              status: 'In Progress',
              description: `Synced from Jira ${issue.key}`,
              date_logged: new Date().toISOString().split('T')[0]
            })
            synced++
          }
        }

        return {
          content: [{
            type: 'text',
            text: `✅ Synced ${synced} new issues from Jira project ${project_key} into ProjectPilot. ${issues.length - synced} were already logged.`
          }]
        }
      } catch (err: any) {
        return { content: [{ type: 'text', text: `Error syncing Jira: ${err.message}` }] }
      }
    }
  )

  return server
}

// ─── EXPRESS APP ──────────────────────────────────────────────────────────────

const app = express()
app.use(cors({
  origin: [
    'https://claude.ai',
    'https://claude.com',
    'https://api.anthropic.com',
  ],
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'mcp-session-id'],
}))
app.use(express.json())

// ─── STREAMABLE HTTP TRANSPORT ────────────────────────────────────────────────

const streamableSessions: Record<string, StreamableHTTPServerTransport> = {}

app.all('/mcp', async (req, res) => {
  const userId = await validateToken(req.headers.authorization)
  if (!userId) {
    res.status(401).json({ error: 'unauthorized', error_description: 'Valid Bearer token required' })
    return
  }

  const sessionId = req.headers['mcp-session-id'] as string | undefined

  if (req.method === 'POST' && !sessionId) {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (id) => {
        streamableSessions[id] = transport
      }
    })
    transport.onclose = () => {
      if (transport.sessionId) delete streamableSessions[transport.sessionId]
    }
    const server = createServer(userId)
    await server.connect(transport)
    await transport.handleRequest(req, res)
    return
  }

  if (sessionId && streamableSessions[sessionId]) {
    await streamableSessions[sessionId].handleRequest(req, res)
    return
  }

  res.status(400).json({ error: 'Invalid or missing session ID' })
})

// ─── SSE TRANSPORT (legacy) ───────────────────────────────────────────────────

const sseTransports: Record<string, SSEServerTransport> = {}

app.get('/sse', async (req, res) => {
  const userId = await validateToken(req.headers.authorization)
  if (!userId) {
    res.status(401).json({ error: 'unauthorized', error_description: 'Valid Bearer token required' })
    return
  }

  const transport = new SSEServerTransport('/messages', res)
  sseTransports[transport.sessionId] = transport
  res.on('close', () => { delete sseTransports[transport.sessionId] })
  const server = createServer(userId)
  await server.connect(transport)
})

app.post('/messages', async (req, res) => {
  const sessionId = req.query.sessionId as string
  const transport = sseTransports[sessionId]
  if (!transport) { res.status(404).json({ error: 'Session not found' }); return }
  await transport.handlePostMessage(req, res)
})

// ─── HEALTH CHECK ─────────────────────────────────────────────────────────────

app.get('/health', (_, res) => {
  res.json({ status: 'ok', service: 'ProjectPilot MCP Server', version: '1.1.0' })
})

// ─── OAUTH METADATA (required for directory) ──────────────────────────────────

app.get('/.well-known/oauth-authorization-server', (_, res) => {
  res.json({
    issuer: 'https://myprojectpilot.io',
    authorization_endpoint: 'https://myprojectpilot.io/api/mcp/authorize',
    token_endpoint: 'https://myprojectpilot.io/api/mcp/token',
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code'],
    code_challenge_methods_supported: ['S256'],
  })
})

const PORT = process.env.PORT || 3001
app.listen(PORT, () => {
  console.log(`ProjectPilot MCP Server running on port ${PORT}`)
})
