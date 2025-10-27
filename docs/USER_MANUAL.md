# Teams Message Extractor - User Manual

## Table of Contents
1. [Getting Started](#getting-started)
2. [Dashboard Overview](#dashboard-overview)
3. [Viewing Messages](#viewing-messages)
4. [Analytics](#analytics)
5. [Configuration](#configuration)
6. [Common Tasks](#common-tasks)
7. [FAQ](#faq)

## Getting Started

### Accessing the Web Interface

1. Open your web browser
2. Navigate to `http://localhost:3000` (or your configured URL)
3. The dashboard will load automatically

### Dashboard Overview

The dashboard is the main screen when you first access the application. It provides:

#### System Health Card
- **Status**: Shows if the system is operational (green) or has issues (red)
- **Model**: The AI model being used for message processing
- **n8n Status**: Connection status to your n8n workflow
- **Database**: Location of the SQLite database

#### Statistics Cards

1. **Total Messages**: All messages ever processed
2. **Processed**: Successfully processed and forwarded to Jira
3. **Pending**: Messages awaiting processing
4. **Failed**: Messages that encountered errors

5. **Today**: Messages processed in the last 24 hours
6. **This Week**: Messages processed in the last 7 days

### Real-Time Updates

The dashboard automatically refreshes every 30 seconds to show the latest statistics.

## Viewing Messages

Navigate to the **Messages** page from the sidebar to:

### Browse All Messages

The message table displays:
- **ID**: Unique message identifier
- **Channel**: Teams channel name
- **Author**: Person who posted the message
- **Status**: Current processing status
- **Type**: Classification (localized/global)
- **Created At**: When the message was captured

### Filter Messages

Use the filters at the top of the page:

1. **Search Bar**: Search by author name, message text, or channel
2. **Status Filter**: Filter by processing status:
   - All
   - Received
   - Processed
   - Forwarded
   - Failed
   - Agent Error
   - n8n Error

### View Message Details

Click the eye icon (👁️) to view full message details:
- Complete resolution text
- Quoted request (the original message being responded to)
- Generated Jira payload
- Error messages (if any)
- Teams permalink

### Message Actions

#### Retry Failed Messages
If a message failed to process:
1. Find the message in the table
2. Click the retry icon (🔄)
3. The system will reprocess the message
4. Check the status to see if it succeeded

#### Delete Messages
To remove a message:
1. Find the message in the table
2. Click the delete icon (🗑️)
3. Confirm the deletion
4. The message is permanently removed

⚠️ **Warning**: Deletion is permanent and cannot be undone.

## Analytics

The Analytics page provides visual insights into your message processing:

### Timeline Chart
- Shows message volume over the last 7 days
- Helps identify trends and patterns
- Line chart format for easy reading

### Status Distribution
- Pie chart showing the breakdown of message statuses
- Percentages calculated automatically
- Color-coded for quick understanding:
  - Green: Successful
  - Yellow: Pending
  - Red: Failed

### Classification Types
- Bar chart showing distribution of message types
- Helps understand the mix of localized vs. global deployments

## Configuration

Access the Settings page to configure the system:

### API Configuration

1. **OpenAI API Key**
   - Your API key for AI processing
   - Stored securely
   - Required for message enrichment

2. **n8n Webhook URL**
   - The endpoint where processed messages are sent
   - Format: `https://your-n8n-instance.com/webhook/teams-guncelleme`

3. **n8n API Key** (Optional)
   - Additional authentication for n8n
   - Leave blank if not required

### Processor Configuration

1. **Host**: Server binding address (usually `0.0.0.0`)
2. **Port**: Server port (default: `8090`)

### Processing Options

1. **Auto Retry**
   - Enable automatic retry for failed messages
   - Toggle on/off

2. **Max Retries**
   - Number of times to retry a failed message
   - Default: 3
   - Only active when Auto Retry is enabled

### Saving Configuration

Click the **Save Configuration** button to apply changes. A success message will appear when saved.

## Common Tasks

### Monitoring System Health

1. Check the Dashboard regularly
2. Look for the green "ok" status
3. Verify n8n connection is active
4. Review today's processing count

### Finding a Specific Message

1. Go to Messages page
2. Use the search bar to enter:
   - Author name
   - Part of the message text
   - Channel name
3. Results filter automatically as you type

### Handling Failed Messages

1. Go to Messages page
2. Filter by "Failed" status
3. Click eye icon to view error details
4. Understand the error
5. Click retry icon to reprocess
6. If retry fails, contact system administrator

### Weekly Review

1. Check Dashboard "This Week" count
2. Go to Analytics page
3. Review timeline for any unusual patterns
4. Check status distribution
5. Ensure most messages are "Forwarded" (green)

### Exporting Data

Currently, you can:
1. View message details
2. Copy Jira payloads
3. Access the Teams permalink

Future versions will include CSV/Excel export.

## FAQ

### Q: Why is a message stuck in "Received" status?
**A**: The AI processing may be taking longer than usual. Check:
- OpenAI API key is valid
- System health on Dashboard
- Error logs (contact admin if needed)

### Q: Can I edit a message after it's processed?
**A**: No, messages are immutable once processed. You can delete and reprocess if needed.

### Q: How do I know if a Jira issue was created?
**A**:
1. Check message status is "Forwarded"
2. View message details to see the Jira payload
3. Check n8n execution logs
4. Look in Jira for the issue

### Q: What does "Agent Error" mean?
**A**: The AI processing failed. Common causes:
- Invalid API key
- OpenAI service outage
- Malformed input data

Click retry to attempt processing again.

### Q: What does "n8n Error" mean?
**A**: The message was processed but failed to send to n8n. Check:
- n8n webhook URL is correct
- n8n workflow is activated
- Network connectivity

### Q: Can I process messages from multiple Teams channels?
**A**: Yes, configure the browser extension for each channel you want to monitor.

### Q: How long are messages stored?
**A**: Messages are stored indefinitely in SQLite. Implement a cleanup policy if needed (contact admin).

### Q: Can multiple users access the GUI simultaneously?
**A**: Yes, the web GUI supports concurrent users.

### Q: Is the system mobile-friendly?
**A**: Yes, the GUI is responsive and works on tablets and mobile devices.

### Q: How do I get support?
**A**:
1. Check this manual
2. Review the Troubleshooting Guide
3. Contact your system administrator
4. Open a GitHub issue

## Tips for Best Results

1. **Regular Monitoring**: Check the dashboard daily
2. **Address Failures Quickly**: Don't let failed messages accumulate
3. **Use Filters**: Make use of the search and filter features
4. **Review Analytics**: Check trends weekly to spot issues early
5. **Keep Config Updated**: Ensure API keys and URLs are current

## Keyboard Shortcuts

Currently, the GUI uses standard browser shortcuts:
- `Ctrl/Cmd + R`: Refresh page
- `Ctrl/Cmd + F`: Search (use GUI search instead for better results)

Future versions will include custom shortcuts.

## Need Help?

If you need assistance:
1. Check the [Troubleshooting Guide](TROUBLESHOOTING.md)
2. Review the [Administrator Guide](ADMIN_GUIDE.md)
3. Contact your system administrator
4. Open an issue on GitHub

---

**Version**: 1.0.0
**Last Updated**: 2025-10-27
