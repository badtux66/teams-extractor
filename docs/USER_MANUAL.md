# Teams Message Extractor - User Manual

## Table of Contents
1. [Getting Started](#getting-started)
2. [Chrome Extension](#chrome-extension)
3. [Web Dashboard](#web-dashboard)
4. [Message Management](#message-management)
5. [Analytics](#analytics)
6. [Search and Filters](#search-and-filters)
7. [Common Tasks](#common-tasks)
8. [Tips and Best Practices](#tips-and-best-practices)
9. [FAQ](#faq)

---

## Getting Started

### Prerequisites

Before using Teams Message Extractor, ensure you have:
1. **Google Chrome** or Microsoft Edge browser installed
2. **Access** to Microsoft Teams web interface (https://teams.microsoft.com)
3. **Backend services** running (see [Administrator Guide](ADMIN_GUIDE.md) for setup)

### Initial Setup

1. **Install the Chrome Extension**
   - Your administrator will provide the extension package
   - Open `chrome://extensions` in Chrome
   - Enable "Developer mode" (top right toggle)
   - Click "Load unpacked"
   - Select the `chrome-extension` folder
   - The Teams Message Extractor icon will appear in your toolbar

2. **Configure the Extension**
   - Click the extension icon in Chrome toolbar
   - Click the settings (⚙️) icon
   - Enter the Backend API URL (usually `http://localhost:5000/api`)
   - Set extraction interval (default: 5000ms)
   - Set batch size (default: 50 messages)
   - Click "Save Settings"

3. **Access the Web Dashboard**
   - Open your browser
   - Navigate to `http://localhost:3000` (or the URL provided by your admin)
   - You should see the dashboard with statistics

---

## Chrome Extension

### Understanding the Extension

The Chrome extension automatically extracts messages from Teams as you browse channels and chats. It runs in the background and sends messages to the backend for storage and analysis.

### Extension Interface

#### Popup Window

Click the extension icon to see:
- **Messages Extracted:** Total count of messages captured
- **Last Extraction:** Timestamp of most recent extraction
- **Status:** Current extraction status (Active/Paused/Error)
- **Extract Now** button: Manually trigger immediate extraction
- **Settings** button: Access configuration
- **View Dashboard** button: Open the web interface

#### Status Indicators

- 🟢 **Green badge:** Extension is active and working
- 🟡 **Yellow badge:** Extension is paused or waiting
- 🔴 **Red badge:** Extension encountered an error
- Number badge: Count of messages in current extraction queue

### Using the Extension

1. **Navigate to Teams**
   - Open https://teams.microsoft.com in Chrome
   - Log in to your Teams account
   - Navigate to any channel or chat

2. **Automatic Extraction**
   - The extension automatically starts extracting visible messages
   - Scroll through messages to extract more
   - New messages are captured in real-time
   - Progress shows in the extension popup

3. **Manual Extraction**
   - Click the extension icon
   - Click "Extract Now" button
   - Extension will immediately scan and extract visible messages
   - Useful when automatic extraction is paused

### Extension Settings

**Backend API URL**
- URL where the backend server is running
- Default: `http://localhost:5000/api`
- Change this if backend is on a different server

**Extraction Interval**
- How often (in milliseconds) to check for new messages
- Default: 5000ms (5 seconds)
- Lower = more frequent extraction (higher resource usage)
- Higher = less frequent extraction (lower resource usage)
- Recommended range: 3000-10000ms

**Batch Size**
- Number of messages to send in each API call
- Default: 50 messages
- Lower = more frequent API calls
- Higher = fewer API calls but larger payloads
- Recommended range: 25-100 messages

**Auto-start on Teams**
- Automatically start extracting when Teams pages load
- Default: Enabled
- Disable if you want to manually control extraction

### Troubleshooting Extension

**Extension not working:**
1. Verify you're on teams.microsoft.com
2. Check extension is enabled at chrome://extensions
3. Reload the extension
4. Refresh the Teams page

**No messages extracted:**
1. Ensure Teams has fully loaded
2. Scroll through messages to make them visible
3. Check browser console (F12) for errors
4. Verify backend is running and accessible

**Duplicate messages:**
- The system automatically deduplicates messages using Redis
- Duplicates are normal and handled by the backend
- Check Redis is running if seeing many duplicates

---

## Web Dashboard

### Dashboard Overview

The dashboard is your main interface for monitoring message extraction and viewing statistics.

Access: http://localhost:3000

### Dashboard Cards

#### System Health
- **Status:** Shows if backend is operational
- **Database:** PostgreSQL connection status
- **Redis:** Cache connection status
- **Uptime:** How long the system has been running

#### Message Statistics

**Total Messages**
- Count of all messages ever extracted
- Includes messages from all channels

**Today's Messages**
- Messages extracted in the last 24 hours
- Resets at midnight

**This Week**
- Messages extracted in the last 7 days
- Rolling 7-day window

**Channels**
- Number of unique channels with messages
- Click to see channel breakdown

**Active Senders**
- Number of unique people who have sent messages
- Click to see sender statistics

### Real-Time Updates

The dashboard automatically refreshes every 30 seconds to show latest data. You'll see:
- New message counts update live
- Statistics refresh automatically
- Status indicators change if services go down
- Toast notifications for important events

---

## Message Management

### Viewing Messages

Navigate to the **Messages** page from the sidebar.

#### Message Table

The table displays:
- **ID:** Database identifier
- **Channel:** Teams channel name
- **Author:** Message sender
- **Preview:** First 100 characters of message
- **Timestamp:** When message was sent
- **Type:** Message type (message, reply, system)
- **Actions:** View, Delete buttons

#### Message Details

Click the eye icon (👁️) to view full message details:
- Complete message text
- Sender name and email
- Channel and thread information
- Reactions and reaction counts
- @Mentions
- File attachments
- Teams message URL (click to open in Teams)
- Extraction metadata

### Deleting Messages

⚠️ **Warning:** Deletion is permanent and cannot be undone.

To delete a message:
1. Find the message in the table
2. Click the delete icon (🗑️)
3. Confirm the deletion in the dialog
4. Message is removed from database

**When to delete:**
- Test messages
- Duplicate entries (though system handles these)
- Messages extracted by mistake
- Sensitive information that shouldn't be stored

---

## Analytics

Navigate to the **Analytics** page for visual insights.

### Available Charts

#### Message Timeline
- Line chart showing message volume over time
- X-axis: Date
- Y-axis: Number of messages
- Hover over points for exact counts
- Filter by date range using controls

#### Channel Distribution
- Pie chart showing messages by channel
- Percentages calculated automatically
- Click legend items to show/hide channels
- Useful for understanding channel activity

#### Top Senders
- Bar chart of most active message senders
- Shows top 10 senders by default
- Adjust count with slider
- Filter by channel to see channel-specific top senders

#### Message Types
- Breakdown of message types (messages, replies, system)
- Pie chart visualization
- Helps understand conversation patterns

### Using Analytics

**Date Range Selection**
- Use date pickers to set start and end dates
- Click "Apply" to refresh charts
- Use preset buttons: "Today", "This Week", "This Month"
- Clear filters to see all-time data

**Channel Filtering**
- Select specific channels from dropdown
- Analytics update to show only selected channels
- Useful for team-specific insights

**Export Data**
- Click "Export" button
- Choose format: CSV, JSON, Excel (future)
- Currently supports CSV export

---

## Search and Filters

### Full-Text Search

The **Messages** page includes powerful search capabilities.

#### Search Bar
- Enter any text to search message content
- Searches are case-insensitive
- Searches across all message text
- Results update as you type (with debounce)
- Uses PostgreSQL full-text search

#### Search Examples
```
deployment          - Find messages mentioning "deployment"
"production issue"  - Exact phrase search
error OR warning    - Messages with either word (future)
John meeting        - Messages from John about meetings (future)
```

### Filter Options

**By Channel**
- Dropdown list of all channels
- Select one or more channels
- "All Channels" shows everything

**By Author**
- Dropdown list of message senders
- Filter to see messages from specific people
- Useful for tracking individual contributions

**By Date Range**
- Start date: Messages after this date
- End date: Messages before this date
- Preset ranges: Today, This Week, This Month, Custom

**By Message Type**
- Message: Regular channel messages
- Reply: Reply to another message
- System: System notifications
- All: No filtering

### Advanced Filtering

Combine multiple filters for precise results:
```
Channel: "DevOps"
Author: "John Doe"
Date: Last 7 days
Type: Message

Result: Only John Doe's regular messages in DevOps from last week
```

---

## Common Tasks

### Monitoring Daily Activity

1. Open the dashboard
2. Check "Today's Messages" card
3. Review "This Week" trend
4. Click "View Timeline" for detailed chart
5. Set up daily review schedule (e.g., every morning)

### Finding Specific Information

**To find a specific message:**
1. Go to Messages page
2. Use the search bar to enter keywords
3. Add filters to narrow results
4. Click eye icon to view full details
5. Click Teams URL to view in Teams

**To find all messages from a person:**
1. Go to Messages page
2. Select author from "Author" filter
3. Optionally add date range
4. Review results

**To see channel activity:**
1. Go to Analytics page
2. View "Channel Distribution" chart
3. Or filter Messages page by specific channel
4. Review timeline for activity patterns

### Weekly Review Workflow

1. **Check Dashboard**
   - Note total messages this week
   - Compare to previous week (mental note)
   - Check for any health issues

2. **Review Top Senders**
   - Go to Analytics
   - View "Top Senders" chart
   - Identify most active team members

3. **Analyze Channels**
   - Check "Channel Distribution"
   - Identify most/least active channels
   - Note any unusual activity patterns

4. **Export Data** (if needed)
   - Export this week's messages
   - Save for records or reporting
   - Share with management if required

### Troubleshooting Extraction

**If messages aren't appearing:**

1. **Check Extension**
   - Is it enabled?
   - Is it running on the Teams page?
   - Click "Extract Now" to trigger manual extraction

2. **Check Backend**
   - Visit http://localhost:5000/api/health
   - Should show "healthy" status
   - If not, contact your administrator

3. **Check Database**
   - Dashboard shows database status
   - Green = healthy, Red = problem
   - Contact administrator if red

4. **Check Logs**
   - Administrator can check backend logs
   - Extension console logs (F12 in browser)

---

## Tips and Best Practices

### Extraction Best Practices

1. **Keep Browser Open**
   - Extension only works when Chrome is running
   - Keep Teams tab open (can be backgrounded)
   - Consider pinning the Teams tab

2. **Scroll Through Channels**
   - Extension only captures visible messages
   - Scroll through channel history to extract older messages
   - Initial setup: scroll through all important channels

3. **Regular Monitoring**
   - Check dashboard daily
   - Ensure extraction is running
   - Watch for error badges on extension icon

4. **Reasonable Intervals**
   - Don't set extraction interval too low (< 2000ms)
   - Can cause browser slowdown
   - Default 5000ms is recommended

### Dashboard Usage

1. **Bookmark the Dashboard**
   - Add http://localhost:3000 to bookmarks
   - Quick access for daily checks

2. **Use Filters Effectively**
   - Combine multiple filters for precise results
   - Save common filter combinations (future feature)

3. **Export Regularly**
   - Weekly exports for backup
   - Monthly exports for reporting
   - Keep export files organized by date

### Performance Tips

1. **Close Unnecessary Channels**
   - Focus extraction on relevant channels
   - Reduces data volume
   - Improves performance

2. **Clear Old Data**
   - Work with administrator to archive old messages
   - Keeps database performant
   - Recommended: Archive messages > 6 months old

3. **Browser Performance**
   - Close unnecessary tabs
   - Keep Chrome updated
   - Restart browser if sluggish

---

## FAQ

### General Questions

**Q: Why do I need this tool?**
A: To capture, search, and analyze Teams messages without relying on Microsoft's limited search and export features. Useful for compliance, analysis, and archival.

**Q: Does this require Microsoft API permissions?**
A: No, the extension works by reading the Teams web page directly, no special permissions needed.

**Q: Can others see what I'm extracting?**
A: No, extraction is local to your browser and private backend. However, you can only extract messages you can see in Teams.

**Q: Will this slow down Teams?**
A: Minimal impact. The extension runs efficiently in the background. If you notice slowdown, increase the extraction interval in settings.

### Extension Questions

**Q: Does the extension work with Teams desktop app?**
A: No, only with Teams web interface (teams.microsoft.com) in Chrome/Edge browser.

**Q: Can I use multiple browsers?**
A: Yes, install the extension in each browser. All will send to the same backend.

**Q: What happens if I close my browser?**
A: Extraction stops. Messages are only extracted when browser is open and extension is running.

**Q: Can I pause extraction?**
A: Yes, click the extension icon and toggle "Auto-start" off in settings. Re-enable to resume.

### Data Questions

**Q: How long are messages stored?**
A: Indefinitely by default. Your administrator can set retention policies to archive or delete old messages.

**Q: Can I export messages?**
A: Yes, use the Export button on the Messages or Analytics pages. Currently supports CSV format.

**Q: Are reactions and attachments captured?**
A: Yes, reactions are captured. File attachment metadata is captured (name, type, URL) but not the file contents.

**Q: Can I search by date?**
A: Yes, use the date range filters on the Messages page.

### Troubleshooting

**Q: Extension shows error badge**
A: Check that backend is running. Visit the health endpoint or contact your administrator.

**Q: Messages not showing in dashboard**
A: Ensure extension is extracting (check popup), backend is running, and database is connected. Allow a few seconds for processing.

**Q: Duplicate messages in database**
A: The system automatically handles duplicates. If you see many, contact your administrator to check Redis.

**Q: Search isn't working**
A: Ensure you're typing in the search box, not the filter dropdowns. Try refreshing the page.

**Q: Dashboard not updating**
A: Refresh the page manually. If issue persists, check that backend WebSocket is working (contact admin).

### Advanced Questions

**Q: Can I extract messages from private chats?**
A: Yes, if the extension is running while you view the chat in Teams.

**Q: Can I extract from multiple Teams organizations?**
A: Yes, but each org may need a separate backend or database schema.

**Q: What about data privacy?**
A: Messages are stored on your local server/infrastructure. Ensure compliance with your organization's data policies.

**Q: Can I integrate with other tools?**
A: The API can be used by other tools. See [API Reference](API_REFERENCE.md) for details.

---

## Getting Help

If you need assistance:
1. Check this manual first
2. Review the [Troubleshooting Guide](TROUBLESHOOTING.md)
3. Contact your system administrator
4. Check the GitHub repository for updates
5. Open an issue on GitHub for bugs

---

## Keyboard Shortcuts

- `Ctrl/Cmd + K` - Focus search bar (Messages page)
- `Ctrl/Cmd + R` - Refresh current page
- `Esc` - Close modals and dialogs

More shortcuts coming in future updates.

---

## Updates and Changelog

Check the repository for:
- Version updates
- New features
- Bug fixes
- Breaking changes

Your administrator will notify you of important updates.

---

**Document Version:** 2.0
**Last Updated:** November 2024
**For:** Teams Message Extractor (Chrome Extension Architecture)
