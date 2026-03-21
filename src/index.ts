import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import * as dotenv from 'dotenv'

dotenv.config()

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
)

const server = new McpServer({
  name: 'projectpilot',
  version: '1.0.0',
  description: 'ProjectPilot MCP Server — AI project intelligence connector for Claude'
})

// GET PROJECTS
server.tool('get_projects', 'Get all projects for a user', {
  user_id: z.string().describe('The ProjectPilot user ID')
}, async ({ user_id }) => {
  const { data, error } = await supabase
    .from('projects')
    .select('id, name, description, methodology, current_phase, completion_percent, health_score, schedule_status, budget_status, start_date, end_date')
    .eq('user_id', user_id)
    .order('created_at', { ascending: false })
  if (error) return { content: [{ type: 'text', text: `Error: ${error.message}` }] }
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
})

// GET PROJECT DETAIL
server.tool('get_project_detail', 'Get full details of a specific project', {
  project_id: z.string().describe('The project ID')
}, async ({ project_id }) => {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('id', project_id)
    .single()
  if (error) return { content: [{ type: 'text', text: `Error: ${error.message}` }] }
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
})

// GET HEALTH SCORE
server.tool('get_health_score', 'Get health score and analysis for a project', {
  project_id: z.string().describe('The project ID')
}, async ({ project_id }) => {
  const { data, error } = await supabase
    .from('projects')
    .select('name, health_score, health_analysis, health_assessed_at, schedule_status, budget_status, completion_percent')
    .eq('id', project_id)
    .single()
  if (error) return { content: [{ type: 'text', text: `Error: ${error.message}` }] }
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
})

// GET RISKS
server.tool('get_risks', 'Get all risks for a project', {
  project_id: z.string().describe('The project ID'),
  status: z.string().optional().describe('Filter by status: Open, Mitigated, Accepted, Closed')
}, async ({ project_id, status }) => {
  let query = supabase
    .from('risks')
    .select('*')
    .eq('project_id', project_id)
    .order('created_at', { ascending: false })
  if (status) query = query.eq('status', status)
  const { data, error } = await query
  if (error) return { content: [{ type: 'text', text: `Error: ${error.message}` }] }
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
})

// GET BLOCKERS (Issues)
server.tool('get_blockers', 'Get open issues and blockers for a project', {
  project_id: z.string().describe('The project ID')
}, async ({ project_id }) => {
  const { data, error } = await supabase
    .from('issues')
    .select('*')
    .eq('project_id', project_id)
    .in('status', ['Open', 'In Progress', 'Escalated'])
    .order('created_at', { ascending: false })
  if (error) return { content: [{ type: 'text', text: `Error: ${error.message}` }] }
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
})

// GET TEAM MEMBERS
server.tool('get_team_members', 'Get team members for a project', {
  project_id: z.string().describe('The project ID')
}, async ({ project_id }) => {
  const { data, error } = await supabase
    .from('projects')
    .select('team_members, pm_name, sponsor_name, team_size')
    .eq('id', project_id)
    .single()
  if (error) return { content: [{ type: 'text', text: `Error: ${error.message}` }] }
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
})

// GET RAID LOG
server.tool('get_raid_log', 'Get the full RAID log for a project', {
  project_id: z.string().describe('The project ID')
}, async ({ project_id }) => {
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
})

// LOG RISK (WRITE)
server.tool('log_risk', 'Log a new risk to a project', {
  project_id: z.string(),
  user_id: z.string(),
  title: z.string().describe('Risk title'),
  probability: z.enum(['Low', 'Medium', 'High']),
  impact: z.enum(['Low', 'Medium', 'High', 'Critical']),
  mitigation: z.string().optional(),
  owner: z.string().optional()
}, async ({ project_id, user_id, title, probability, impact, mitigation, owner }) => {
  const { data, error } = await supabase
    .from('risks')
    .insert({ project_id, user_id, title, probability, impact, mitigation, owner, status: 'Open' })
    .select()
    .single()
  if (error) return { content: [{ type: 'text', text: `Error: ${error.message}` }] }
  return { content: [{ type: 'text', text: `Risk logged successfully: ${JSON.stringify(data, null, 2)}` }] }
})

// LOG BLOCKER (WRITE)
server.tool('log_blocker', 'Log a new issue or blocker to a project', {
  project_id: z.string(),
  user_id: z.string(),
  title: z.string().describe('Issue title'),
  severity: z.enum(['Low', 'Medium', 'High', 'Critical']),
  description: z.string().optional(),
  owner: z.string().optional()
}, async ({ project_id, user_id, title, severity, description, owner }) => {
  const { data, error } = await supabase
    .from('issues')
    .insert({ project_id, user_id, title, severity, description, owner, status: 'Open', date_logged: new Date().toISOString().split('T')[0] })
    .select()
    .single()
  if (error) return { content: [{ type: 'text', text: `Error: ${error.message}` }] }
  return { content: [{ type: 'text', text: `Blocker logged successfully: ${JSON.stringify(data, null, 2)}` }] }
})

async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error('ProjectPilot MCP Server running...')
}

main().catch(console.error)