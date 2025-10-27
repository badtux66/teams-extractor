export interface Message {
  id: number
  message_id: string | null
  channel: string
  author: string
  timestamp: string | null
  classification: {
    type: string
    keyword: string
  }
  resolution_text: string
  quoted_request: {
    author: string
    text: string
  } | null
  permalink: string | null
  status: string
  jira_payload: JiraPayload | null
  n8n_response_code: number | null
  n8n_response_body: string | null
  error: string | null
  created_at: string
  updated_at: string
}

export interface JiraPayload {
  issue_type: string
  summary: string
  description: string
  labels: string[]
  custom_fields: Record<string, any>
  comment?: string
}

export interface HealthStatus {
  status: string
  model: string
  db: string
  n8n_connected: boolean
}

export interface Stats {
  total_messages: number
  processed: number
  pending: number
  failed: number
  today: number
  this_week: number
}

export interface FilterOptions {
  status?: string
  author?: string
  channel?: string
  date_from?: string
  date_to?: string
  search?: string
}
