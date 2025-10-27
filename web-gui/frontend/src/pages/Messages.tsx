import { useEffect, useState } from 'react'
import {
  Box,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  CircularProgress,
  Alert,
  Chip,
  TextField,
  InputAdornment,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Paper,
  Grid,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
} from '@mui/material'
import {
  Search,
  Refresh,
  Visibility,
  Delete,
  Replay,
} from '@mui/icons-material'
import { messagesApi } from '../services/api'
import type { Message } from '../types'
import { format } from 'date-fns'

export default function Messages() {
  const [messages, setMessages] = useState<Message[]>([])
  const [filteredMessages, setFilteredMessages] = useState<Message[]>([])
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [detailsOpen, setDetailsOpen] = useState(false)

  useEffect(() => {
    loadMessages()
  }, [])

  useEffect(() => {
    filterMessages()
  }, [messages, searchTerm, statusFilter])

  const loadMessages = async () => {
    try {
      setLoading(true)
      const data = await messagesApi.getMessages()
      setMessages(data)
      setError(null)
    } catch (err: any) {
      setError(err.message || 'Failed to load messages')
    } finally {
      setLoading(false)
    }
  }

  const filterMessages = () => {
    let filtered = [...messages]

    // Filter by status
    if (statusFilter !== 'all') {
      filtered = filtered.filter((msg) => msg.status === statusFilter)
    }

    // Filter by search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter(
        (msg) =>
          msg.author.toLowerCase().includes(term) ||
          msg.resolution_text.toLowerCase().includes(term) ||
          msg.channel.toLowerCase().includes(term) ||
          (msg.quoted_request?.text || '').toLowerCase().includes(term)
      )
    }

    setFilteredMessages(filtered)
  }

  const handleViewDetails = async (message: Message) => {
    try {
      const fullMessage = await messagesApi.getMessage(message.id)
      setSelectedMessage(fullMessage)
      setDetailsOpen(true)
    } catch (err: any) {
      setError(err.message || 'Failed to load message details')
    }
  }

  const handleRetry = async (id: number) => {
    try {
      await messagesApi.retryMessage(id)
      await loadMessages()
    } catch (err: any) {
      setError(err.message || 'Failed to retry message')
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this message?')) {
      return
    }
    try {
      await messagesApi.deleteMessage(id)
      await loadMessages()
    } catch (err: any) {
      setError(err.message || 'Failed to delete message')
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'forwarded':
        return 'success'
      case 'processed':
        return 'info'
      case 'received':
      case 'queued':
        return 'warning'
      case 'failed':
      case 'agent_error':
      case 'n8n_error':
        return 'error'
      default:
        return 'default'
    }
  }

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    )
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">Messages</Typography>
        <IconButton onClick={loadMessages} color="primary">
          <Refresh />
        </IconButton>
      </Box>

      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2}>
            <Grid item xs={12} md={8}>
              <TextField
                fullWidth
                placeholder="Search messages..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search />
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  value={statusFilter}
                  label="Status"
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <MenuItem value="all">All</MenuItem>
                  <MenuItem value="received">Received</MenuItem>
                  <MenuItem value="processed">Processed</MenuItem>
                  <MenuItem value="forwarded">Forwarded</MenuItem>
                  <MenuItem value="failed">Failed</MenuItem>
                  <MenuItem value="agent_error">Agent Error</MenuItem>
                  <MenuItem value="n8n_error">n8n Error</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Messages Table */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>ID</TableCell>
              <TableCell>Channel</TableCell>
              <TableCell>Author</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Created At</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredMessages.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} align="center">
                  <Typography variant="body2" color="text.secondary">
                    No messages found
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              filteredMessages.map((message) => (
                <TableRow key={message.id} hover>
                  <TableCell>{message.id}</TableCell>
                  <TableCell>{message.channel}</TableCell>
                  <TableCell>{message.author}</TableCell>
                  <TableCell>
                    <Chip
                      label={message.status}
                      color={getStatusColor(message.status)}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={message.classification.type}
                      size="small"
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell>
                    {format(new Date(message.created_at), 'MMM dd, yyyy HH:mm')}
                  </TableCell>
                  <TableCell>
                    <IconButton
                      size="small"
                      onClick={() => handleViewDetails(message)}
                      title="View Details"
                    >
                      <Visibility fontSize="small" />
                    </IconButton>
                    {(message.status === 'failed' ||
                      message.status === 'agent_error' ||
                      message.status === 'n8n_error') && (
                      <IconButton
                        size="small"
                        onClick={() => handleRetry(message.id)}
                        title="Retry"
                      >
                        <Replay fontSize="small" />
                      </IconButton>
                    )}
                    <IconButton
                      size="small"
                      onClick={() => handleDelete(message.id)}
                      title="Delete"
                      color="error"
                    >
                      <Delete fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Message Details Dialog */}
      <Dialog
        open={detailsOpen}
        onClose={() => setDetailsOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Message Details</DialogTitle>
        <DialogContent>
          {selectedMessage && (
            <Box sx={{ mt: 2 }}>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Resolution Text
                  </Typography>
                  <Paper sx={{ p: 2, bgcolor: 'grey.100', mt: 1 }}>
                    <Typography variant="body2">{selectedMessage.resolution_text}</Typography>
                  </Paper>
                </Grid>

                {selectedMessage.quoted_request && (
                  <Grid item xs={12}>
                    <Typography variant="subtitle2" color="text.secondary">
                      Quoted Request
                    </Typography>
                    <Paper sx={{ p: 2, bgcolor: 'grey.100', mt: 1 }}>
                      <Typography variant="body2" fontWeight="bold">
                        {selectedMessage.quoted_request.author}
                      </Typography>
                      <Typography variant="body2" sx={{ mt: 1 }}>
                        {selectedMessage.quoted_request.text}
                      </Typography>
                    </Paper>
                  </Grid>
                )}

                {selectedMessage.jira_payload && (
                  <Grid item xs={12}>
                    <Typography variant="subtitle2" color="text.secondary">
                      Jira Payload
                    </Typography>
                    <Paper sx={{ p: 2, bgcolor: 'grey.100', mt: 1 }}>
                      <pre style={{ margin: 0, fontSize: '0.85rem', overflow: 'auto' }}>
                        {JSON.stringify(selectedMessage.jira_payload, null, 2)}
                      </pre>
                    </Paper>
                  </Grid>
                )}

                {selectedMessage.error && (
                  <Grid item xs={12}>
                    <Typography variant="subtitle2" color="error">
                      Error
                    </Typography>
                    <Paper sx={{ p: 2, bgcolor: 'error.light', mt: 1 }}>
                      <Typography variant="body2" color="error.contrastText">
                        {selectedMessage.error}
                      </Typography>
                    </Paper>
                  </Grid>
                )}

                {selectedMessage.permalink && (
                  <Grid item xs={12}>
                    <Typography variant="subtitle2" color="text.secondary">
                      Teams Link
                    </Typography>
                    <Typography variant="body2" sx={{ mt: 1 }}>
                      <a
                        href={selectedMessage.permalink}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {selectedMessage.permalink}
                      </a>
                    </Typography>
                  </Grid>
                )}
              </Grid>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailsOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
