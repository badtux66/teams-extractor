"""HTML export functionality with rich formatting."""

from pathlib import Path
from typing import Union
from datetime import datetime

from ..core.models import ExtractionResult, TeamsThread


class HTMLExporter:
    """Export Teams messages to formatted HTML."""

    @staticmethod
    def export(
        result: ExtractionResult,
        output_path: Union[str, Path],
        title: str = "Teams Message Export",
        group_by_thread: bool = True,
    ) -> None:
        """
        Export extraction result to HTML file.

        Args:
            result: Extraction result to export
            output_path: Output file path
            title: HTML document title
            group_by_thread: Group messages by thread
        """
        output_path = Path(output_path)
        output_path.parent.mkdir(parents=True, exist_ok=True)

        html_content = HTMLExporter._generate_html(result, title, group_by_thread)

        with open(output_path, "w", encoding="utf-8") as f:
            f.write(html_content)

    @staticmethod
    def _generate_html(
        result: ExtractionResult,
        title: str,
        group_by_thread: bool,
    ) -> str:
        """Generate HTML content."""
        stats = result.get_statistics()

        html = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{title}</title>
    <style>
        body {{
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f5f5f5;
        }}
        .header {{
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            border-radius: 10px;
            margin-bottom: 30px;
        }}
        .header h1 {{
            margin: 0 0 10px 0;
        }}
        .stats {{
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
            margin-bottom: 30px;
        }}
        .stat-card {{
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }}
        .stat-card .label {{
            color: #666;
            font-size: 14px;
            margin-bottom: 5px;
        }}
        .stat-card .value {{
            color: #333;
            font-size: 24px;
            font-weight: bold;
        }}
        .thread {{
            background: white;
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 20px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }}
        .message {{
            border-left: 3px solid #667eea;
            padding: 15px;
            margin-bottom: 15px;
            background: #f9f9f9;
            border-radius: 0 5px 5px 0;
        }}
        .message.reply {{
            margin-left: 30px;
            border-left-color: #764ba2;
            background: #fafafa;
        }}
        .message-header {{
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 10px;
            padding-bottom: 10px;
            border-bottom: 1px solid #e0e0e0;
        }}
        .author {{
            font-weight: bold;
            color: #333;
        }}
        .timestamp {{
            color: #666;
            font-size: 14px;
        }}
        .channel-info {{
            color: #888;
            font-size: 13px;
            margin-bottom: 10px;
        }}
        .message-body {{
            line-height: 1.6;
            color: #333;
        }}
        .metadata {{
            display: flex;
            gap: 15px;
            margin-top: 10px;
            font-size: 13px;
            color: #666;
        }}
        .metadata span {{
            display: inline-flex;
            align-items: center;
            gap: 5px;
        }}
        .badge {{
            background: #667eea;
            color: white;
            padding: 2px 8px;
            border-radius: 12px;
            font-size: 11px;
        }}
        .attachments {{
            margin-top: 10px;
            padding: 10px;
            background: white;
            border-radius: 5px;
        }}
        .attachment-item {{
            padding: 5px 0;
            color: #667eea;
        }}
        .reactions {{
            display: flex;
            gap: 8px;
            margin-top: 10px;
        }}
        .reaction {{
            background: #f0f0f0;
            padding: 4px 10px;
            border-radius: 15px;
            font-size: 13px;
        }}
    </style>
</head>
<body>
    <div class="header">
        <h1>{title}</h1>
        <p>Extracted {stats['total_messages']} messages from {stats['channels']} channels</p>
        <p style="font-size: 14px; opacity: 0.9;">
            Duration: {stats['duration_seconds']:.1f}s |
            Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
        </p>
    </div>

    <div class="stats">
        <div class="stat-card">
            <div class="label">Total Messages</div>
            <div class="value">{stats['total_messages']}</div>
        </div>
        <div class="stat-card">
            <div class="label">Threads</div>
            <div class="value">{stats['total_threads']}</div>
        </div>
        <div class="stat-card">
            <div class="label">Authors</div>
            <div class="value">{stats['authors']}</div>
        </div>
        <div class="stat-card">
            <div class="label">Channels</div>
            <div class="value">{stats['channels']}</div>
        </div>
        <div class="stat-card">
            <div class="label">With Attachments</div>
            <div class="value">{stats['with_attachments']}</div>
        </div>
        <div class="stat-card">
            <div class="label">With Reactions</div>
            <div class="value">{stats['with_reactions']}</div>
        </div>
    </div>
"""

        if group_by_thread:
            html += HTMLExporter._generate_threads_html(result.get_threads())
        else:
            html += HTMLExporter._generate_messages_html(result.messages)

        html += """
</body>
</html>
"""
        return html

    @staticmethod
    def _generate_threads_html(threads: list[TeamsThread]) -> str:
        """Generate HTML for threaded messages."""
        html = ""
        for thread in threads:
            html += '<div class="thread">\n'
            html += HTMLExporter._generate_message_html(thread.root_message, is_reply=False)

            for reply in thread.replies:
                html += HTMLExporter._generate_message_html(reply, is_reply=True)

            html += '</div>\n'

        return html

    @staticmethod
    def _generate_messages_html(messages: list) -> str:
        """Generate HTML for flat message list."""
        html = ""
        for msg in messages:
            html += '<div class="thread">\n'
            html += HTMLExporter._generate_message_html(msg, is_reply=bool(msg.reply_to_id))
            html += '</div>\n'

        return html

    @staticmethod
    def _generate_message_html(msg, is_reply: bool = False) -> str:
        """Generate HTML for a single message."""
        reply_class = " reply" if is_reply else ""

        html = f'<div class="message{reply_class}">\n'
        html += '  <div class="message-header">\n'
        html += f'    <div class="author">{msg.author_name}</div>\n'
        html += f'    <div class="timestamp">{msg.created_at.strftime("%Y-%m-%d %H:%M:%S")}</div>\n'
        html += '  </div>\n'

        html += f'  <div class="channel-info">#{msg.channel_name or "Unknown"}'
        if msg.team_name:
            html += f' • {msg.team_name}'
        html += '</div>\n'

        if msg.subject:
            html += f'  <div style="font-weight: bold; margin-bottom: 10px;">{msg.subject}</div>\n'

        html += f'  <div class="message-body">{msg.body_content}</div>\n'

        # Metadata
        metadata_items = []
        if msg.attachments:
            metadata_items.append(f'<span>📎 {len(msg.attachments)} attachment(s)</span>')
        if msg.mentions:
            metadata_items.append(f'<span>@ {len(msg.mentions)} mention(s)</span>')
        if msg.importance != "normal":
            metadata_items.append(f'<span class="badge">{msg.importance}</span>')

        if metadata_items:
            html += '  <div class="metadata">\n'
            html += '    ' + '\n    '.join(metadata_items) + '\n'
            html += '  </div>\n'

        # Attachments
        if msg.attachments:
            html += '  <div class="attachments">\n'
            html += '    <strong>Attachments:</strong>\n'
            for att in msg.attachments:
                html += f'    <div class="attachment-item">📄 {att.name} ({att.content_type})</div>\n'
            html += '  </div>\n'

        # Reactions
        if msg.reactions:
            html += '  <div class="reactions">\n'
            reaction_counts = {}
            for r in msg.reactions:
                reaction_counts[r.reaction_type] = reaction_counts.get(r.reaction_type, 0) + 1

            for reaction_type, count in reaction_counts.items():
                html += f'    <div class="reaction">{reaction_type} {count}</div>\n'
            html += '  </div>\n'

        html += '</div>\n'
        return html
