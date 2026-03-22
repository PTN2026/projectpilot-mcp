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

function createServer() {
  const server = new McpServer({
    name: 'projectpilot',
    version: '1.0.0',
    description: 'ProjectPilot MCP Server — AI project intelligence connector for Claude'
  })

  // ─── READ TOOLS ───────────────────────────────────────────────────────────

  server.tool(
    'get_projects',
    'Get all projects for a user',
    { user_id: z.string().describe('The ProjectPilot user ID') },
    {
      title: 'Get Projects',
      readOnlyHint: true,
      destructiveHint: false
    },
    async ({ user_id }) => {
      const { data, error } = await supabase
        .from('projects')
        .select('id, name, description, methodology, current_phase, completion_percent, health_score, schedule_status, budget_status, start_date, end_date')
        .eq('user_id', user_id)
        .order('created_at', { ascending: false })
      if (error) return { content: [{ type: 'text', text: `Error: ${error.message}` }] }
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
    }
  )

  server.tool(
    'get_project_detail',
    'Get full details of a specific project',
    { project_id: z.string().describe('The project ID') },
    {
      title: 'Get Project Detail',
      readOnlyHint: true,
      destructiveHint: false
    },
    async ({ project_id }) => {
      const { data, error } = await supabase
        .from('projects').select('*').eq('id', project_id).single()
      if (error) return { content: [{ type: 'text', text: `Error: ${error.message}` }] }
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
    }
  )

  server.tool(
    'get_health_score',
    'Get health score and analysis for a project',
    { project_id: z.string().describe('The project ID') },
    {
      title: 'Get Health Score',
      readOnlyHint: true,
      destructiveHint: false
    },
    async ({ project_id }) => {
      const { data, error } = await supabase
        .from('projects')
        .select('name, health_score, health_analysis, health_assessed_at, schedule_status, budget_status, completion_percent')
        .eq('id', project_id).single()
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
    {
      title: 'Get Risks',
      readOnlyHint: true,
      destructiveHint: false
    },
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
    {
      title: 'Get Blockers',
      readOnlyHint: true,
      destructiveHint: false
    },
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
    {
      title: 'Get Team Members',
      readOnlyHint: true,
      destructiveHint: false
    },
    async ({ project_id }) => {
      const { data, error } = await supabase
        .from('projects').select('team_members, pm_name, sponsor_name, team_size').eq('id', project_id).single()
      if (error) return { content: [{ type: 'text', text: `Error: ${error.message}` }] }
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
    }
  )

  server.tool(
    'get_raid_log',
    'Get the full RAID log for a project (Risks, Assumptions, Issues, Dependencies)',
    { project_id: z.string().describe('The project ID') },
    {
      title: 'Get RAID Log',
      readOnlyHint: true,
      destructiveHint: false
    },
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

  // ─── WRITE TOOLS ──────────────────────────────────────────────────────────

  server.tool(
    'log_risk',
    'Log a new risk to a project',
    {
      project_id: z.string(),
      user_id: z.string(),
      title: z.string(),
      probability: z.enum(['Low', 'Medium', 'High']),
      impact: z.enum(['Low', 'Medium', 'High', 'Critical']),
      mitigation: z.string().optional(),
      owner: z.string().optional()
    },
    {
      title: 'Log Risk',
      readOnlyHint: false,
      destructiveHint: true
    },
    async ({ project_id, user_id, title, probability, impact, mitigation, owner }) => {
      const { data, error } = await supabase
        .from('risks')
        .insert({ project_id, user_id, title, probability, impact, mitigation, owner, status: 'Open' })
        .select().single()
      if (error) return { content: [{ type: 'text', text: `Error: ${error.message}` }] }
      return { content: [{ type: 'text', text: `Risk logged: ${JSON.stringify(data, null, 2)}` }] }
    }
  )

  server.tool(
    'log_blocker',
    'Log a new issue or blocker to a project',
    {
      project_id: z.string(),
      user_id: z.string(),
      title: z.string(),
      severity: z.enum(['Low', 'Medium', 'High', 'Critical']),
      description: z.string().optional(),
      owner: z.string().optional()
    },
    {
      title: 'Log Blocker',
      readOnlyHint: false,
      destructiveHint: true
    },
    async ({ project_id, user_id, title, severity, description, owner }) => {
      const { data, error } = await supabase
        .from('issues')
        .insert({
          project_id, user_id, title, severity, description, owner,
          status: 'Open',
          date_logged: new Date().toISOString().split('T')[0]
        })
        .select().single()
      if (error) return { content: [{ type: 'text', text: `Error: ${error.message}` }] }
      return { content: [{ type: 'text', text: `Blocker logged: ${JSON.stringify(data, null, 2)}` }] }
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

// ─── STREAMABLE HTTP TRANSPORT (required for directory) ───────────────────────

const streamableSessions: Record<string, StreamableHTTPServerTransport> = {}

app.all('/mcp', async (req, res) => {
  const sessionId = req.headers['mcp-session-id'] as string | undefined

  if (req.method === 'POST' && !sessionId) {
    // New session
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (id) => {
        streamableSessions[id] = transport
      }
    })
    transport.onclose = () => {
      if (transport.sessionId) delete streamableSessions[transport.sessionId]
    }
    const server = createServer()
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

// ─── SSE TRANSPORT (legacy, keep for compatibility) ───────────────────────────

const sseTransports: Record<string, SSEServerTransport> = {}

app.get('/sse', async (req, res) => {
  const transport = new SSEServerTransport('/messages', res)
  sseTransports[transport.sessionId] = transport
  res.on('close', () => { delete sseTransports[transport.sessionId] })
  const server = createServer()
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
  res.json({ status: 'ok', service: 'ProjectPilot MCP Server', version: '1.0.0' })
})

const PORT = process.env.PORT || 3001
app.listen(PORT, () => {
  console.log(`ProjectPilot MCP Server running on port ${PORT}`)
})
