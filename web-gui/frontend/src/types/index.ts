export interface Message {
  id: number | string
  message_id: string | null
  channel_id: string | null
  channel_name: string | null
  content: string
  sender_id: string | null
  sender_name: string | null
  sender_email: string | null
  timestamp: string | null
  url: string | null
  type: string
  thread_id: string | null
  attachments?: unknown[] | null
  reactions: unknown[] | null
  metadata?: Record<string, unknown> | null
  extracted_at?: string | null
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
