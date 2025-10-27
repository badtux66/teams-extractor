import { useEffect, useMemo, useState } from 'react'
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
  Stack,
} from '@mui/material'
import { Search, Refresh, Visibility, OpenInNew } from '@mui/icons-material'
import { format } from 'date-fns'
import { messagesApi } from '../services/api'
import type { Message } from '../types'

type MessageListMeta = {
  total: number
  limit: number
  offset: number
}

export default function Messages() {
  const [messages, setMessages] = useState<Message[]>([])
  const [filteredMessages, setFilteredMessages] = useState<Message[]>([])
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [meta, setMeta] = useState<MessageListMeta>({ total: 0, limit: 0, offset: 0 })

  useEffect(() => {
    loadMessages()
  }, [])

  useEffect(() => {
    filterMessages()
  }, [messages, searchTerm, typeFilter])

  const loadMessages = async () => {
    try {
      setLoading(true)
      const response = await messagesApi.getMessages()
      setMessages(response.messages)
      setMeta({ total: response.total, limit: response.limit, offset: response.offset })
      setError(null)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load messages'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  const filterMessages = () => {
    const term = searchTerm.trim().toLowerCase()
    let filtered = [...messages]

    if (typeFilter !== 'all') {
      filtered = filtered.filter(
        (msg) => (msg.type || '').toLowerCase() === typeFilter.toLowerCase()
      )
    }

    if (term) {
      filtered = filtered.filter((msg) => {
        const haystack = [
          msg.content,
          msg.sender_name,
          msg.sender_email,
          msg.channel_name,
          msg.message_id,
        ]
          .filter(Boolean)
          .map((value) => String(value).toLowerCase())

        return haystack.some((value) => value.includes(term))
      })
    }

    setFilteredMessages(filtered)
  }

  const handleViewDetails = async (message: Message) => {
    try {
      const fullMessage = await messagesApi.getMessage(message.id)
      setSelectedMessage(fullMessage)
      setDetailsOpen(true)
      setError(null)
    } catch (err: unknown) {
      const messageText =
        err instanceof Error ? err.message : 'Failed to load message details'
      setError(messageText)
    }
  }

  const handleCloseDetails = () => {
    setDetailsOpen(false)
    setSelectedMessage(null)
  }

  const formatTimestamp = (value: string | null | undefined) => {
    if (!value) return '—'
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return value
    return format(date, 'PPpp')
  }

  const messageTypes = useMemo(() => {
    const types = new Set<string>()
    messages.forEach((msg) => {
      if (msg.type) {
        types.add(msg.type)
      }
    })
    return ['all', ...Array.from(types)]
  }, [messages])

  const renderJsonBlock = (title: string, data: unknown) => {
    if (!data || (Array.isArray(data) && data.length === 0)) {
      return null
    }

    return (
      <Box>
        <Typography variant="subtitle2" color="text.secondary">
          {title}
        </Typography>
        <Paper sx={{ p: 2, bgcolor: 'grey.100', mt: 1, maxHeight: 240, overflow: 'auto' }}>
          <Typography
            component="pre"
            variant="body2"
            sx={{ m: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
          >
            {JSON.stringify(data, null, 2)}
          </Typography>
        </Paper>
      </Box>
    )
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
        <Box>
          <Typography variant="h4">Messages</Typography>
          <Typography variant="body2" color="text.secondary">
            Showing {filteredMessages.length} of {meta.total} stored messages
          </Typography>
        </Box>
        <IconButton onClick={loadMessages} color="primary">
          <Refresh />
        </IconButton>
      </Box>

      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2}>
            <Grid item xs={12} md={8}>
              <TextField
                fullWidth
                placeholder="Search by content, sender, channel..."
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
                <InputLabel>Type</InputLabel>
                <Select
                  value={typeFilter}
                  label="Type"
                  onChange={(e) => setTypeFilter(e.target.value)}
                >
                  {messageTypes.map((type) => (
                    <MenuItem key={type} value={type}>
                      {type === 'all' ? 'All' : type}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Message</TableCell>
              <TableCell>Channel</TableCell>
              <TableCell>Sender</TableCell>
              <TableCell sx={{ maxWidth: 320 }}>Preview</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Timestamp</TableCell>
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
                  <TableCell>
                    <Typography variant="body2" fontWeight="medium">
                      {message.message_id || message.id}
                    </Typography>
                    {message.url && (
                      <Typography variant="caption" color="text.secondary">
                        {message.url}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>{message.channel_name || '—'}</TableCell>
                  <TableCell>
                    <Typography variant="body2">{message.sender_name || '—'}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {message.sender_email || '—'}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ maxWidth: 320 }}>
                    <Typography variant="body2" noWrap>
                      {message.content}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip label={message.type || 'message'} size="small" variant="outlined" />
                  </TableCell>
                  <TableCell>{formatTimestamp(message.timestamp)}</TableCell>
                  <TableCell>
                    <IconButton
                      size="small"
                      onClick={() => handleViewDetails(message)}
                      title="View Details"
                    >
                      <Visibility fontSize="small" />
                    </IconButton>
                    {message.url && (
                      <IconButton
                        component="a"
                        href={message.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        size="small"
                        title="Open in Teams"
                      >
                        <OpenInNew fontSize="small" />
                      </IconButton>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={detailsOpen} onClose={handleCloseDetails} maxWidth="md" fullWidth>
        <DialogTitle>Message Details</DialogTitle>
        <DialogContent dividers>
          {selectedMessage && (
            <Stack spacing={3} sx={{ mt: 1 }}>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Message ID
                  </Typography>
                  <Typography variant="body2">
                    {selectedMessage.message_id || selectedMessage.id}
                  </Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Timestamp
                  </Typography>
                  <Typography variant="body2">
                    {formatTimestamp(selectedMessage.timestamp)}
                  </Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Channel
                  </Typography>
                  <Typography variant="body2">
                    {selectedMessage.channel_name || selectedMessage.channel_id || '—'}
                  </Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Sender
                  </Typography>
                  <Typography variant="body2">
                    {selectedMessage.sender_name || '—'}
                    {selectedMessage.sender_email && (
                      <>
                        <br />
                        <Typography variant="caption" color="text.secondary">
                          {selectedMessage.sender_email}
                        </Typography>
                      </>
                    )}
                  </Typography>
                </Grid>
              </Grid>

              <Box>
                <Typography variant="subtitle2" color="text.secondary">
                  Message Content
                </Typography>
                <Paper sx={{ p: 2, bgcolor: 'grey.100', mt: 1 }}>
                  <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
                    {selectedMessage.content}
                  </Typography>
                </Paper>
              </Box>

              {selectedMessage.url && (
                <Box>
                  <Typography variant="subtitle2" color="text.secondary">
                    Teams Link
                  </Typography>
                  <Button
                    sx={{ mt: 1 }}
                    variant="outlined"
                    size="small"
                    href={selectedMessage.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    endIcon={<OpenInNew fontSize="small" />}
                  >
                    Open in Teams
                  </Button>
                </Box>
              )}

              {renderJsonBlock('Reactions', selectedMessage.reactions)}
              {renderJsonBlock('Attachments', selectedMessage.attachments)}
              {renderJsonBlock('Metadata', selectedMessage.metadata)}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDetails}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
