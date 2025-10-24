"""Markdown export functionality."""

from pathlib import Path
from typing import Union
from datetime import datetime

from ..core.models import ExtractionResult, TeamsThread, TeamsMessage


class MarkdownExporter:
    """Export Teams messages to Markdown format."""

    @staticmethod
    def export(
        result: ExtractionResult,
        output_path: Union[str, Path],
        title: str = "Teams Message Export",
        group_by_thread: bool = True,
        include_statistics: bool = True,
    ) -> None:
        """
        Export extraction result to Markdown file.

        Args:
            result: Extraction result to export
            output_path: Output file path
            title: Document title
            group_by_thread: Group messages by thread
            include_statistics: Include extraction statistics
        """
        output_path = Path(output_path)
        output_path.parent.mkdir(parents=True, exist_ok=True)

        markdown_content = MarkdownExporter._generate_markdown(
            result, title, group_by_thread, include_statistics
        )

        with open(output_path, "w", encoding="utf-8") as f:
            f.write(markdown_content)

    @staticmethod
    def _generate_markdown(
        result: ExtractionResult,
        title: str,
        group_by_thread: bool,
        include_statistics: bool,
    ) -> str:
        """Generate Markdown content."""
        stats = result.get_statistics()

        # Header
        md = f"# {title}\n\n"
        md += f"**Extraction Date:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n"
        md += f"**Total Messages:** {stats['total_messages']}\n\n"

        # Statistics
        if include_statistics:
            md += "## Extraction Statistics\n\n"
            md += "| Metric | Value |\n"
            md += "|--------|-------|\n"
            md += f"| Total Messages | {stats['total_messages']} |\n"
            md += f"| Root Messages | {stats['root_messages']} |\n"
            md += f"| Threads | {stats['total_threads']} |\n"
            md += f"| Authors | {stats['authors']} |\n"
            md += f"| Channels | {stats['channels']} |\n"
            md += f"| Teams | {stats['teams']} |\n"
            md += f"| With Attachments | {stats['with_attachments']} |\n"
            md += f"| With Reactions | {stats['with_reactions']} |\n"
            md += f"| With Mentions | {stats['with_mentions']} |\n"
            md += f"| Duration (seconds) | {stats['duration_seconds']:.1f} |\n"
            md += f"| Messages/Second | {stats['messages_per_second']:.2f} |\n"
            md += "\n---\n\n"

        # Messages
        md += "## Messages\n\n"

        if group_by_thread:
            md += MarkdownExporter._generate_threads_markdown(result.get_threads())
        else:
            md += MarkdownExporter._generate_messages_markdown(result.messages)

        # Errors
        if result.errors:
            md += "\n---\n\n"
            md += "## Errors\n\n"
            for i, error in enumerate(result.errors, 1):
                md += f"{i}. {error}\n"

        return md

    @staticmethod
    def _generate_threads_markdown(threads: list[TeamsThread]) -> str:
        """Generate Markdown for threaded messages."""
        md = ""

        for i, thread in enumerate(threads, 1):
            md += f"### Thread {i}: {thread.root_message.subject or '(No Subject)'}\n\n"
            md += MarkdownExporter._generate_message_markdown(thread.root_message, level=0)

            if thread.replies:
                md += f"\n**Replies ({len(thread.replies)}):**\n\n"
                for reply in thread.replies:
                    md += MarkdownExporter._generate_message_markdown(reply, level=1)

            md += "\n---\n\n"

        return md

    @staticmethod
    def _generate_messages_markdown(messages: list[TeamsMessage]) -> str:
        """Generate Markdown for flat message list."""
        md = ""

        for i, msg in enumerate(messages, 1):
            md += f"### Message {i}\n\n"
            md += MarkdownExporter._generate_message_markdown(msg, level=0)
            md += "\n---\n\n"

        return md

    @staticmethod
    def _generate_message_markdown(msg: TeamsMessage, level: int = 0) -> str:
        """Generate Markdown for a single message."""
        indent = "  " * level if level > 0 else ""

        md = ""

        # Message header
        md += f"{indent}**From:** {msg.author_name}"
        if msg.author_email:
            md += f" ({msg.author_email})"
        md += "\n"

        md += f"{indent}**Date:** {msg.created_at.strftime('%Y-%m-%d %H:%M:%S')}\n"

        md += f"{indent}**Channel:** #{msg.channel_name or 'Unknown'}"
        if msg.team_name:
            md += f" (Team: {msg.team_name})"
        md += "\n"

        if msg.subject:
            md += f"{indent}**Subject:** {msg.subject}\n"

        # Message metadata
        metadata = []
        if msg.importance != "normal":
            metadata.append(f"**{msg.importance.upper()}**")
        if msg.reply_to_id:
            metadata.append("↪️ Reply")
        if msg.attachments:
            metadata.append(f"📎 {len(msg.attachments)} attachment(s)")
        if msg.mentions:
            metadata.append(f"@ {len(msg.mentions)} mention(s)")
        if msg.reactions:
            metadata.append(f"👍 {len(msg.reactions)} reaction(s)")

        if metadata:
            md += f"{indent}**Tags:** {' | '.join(metadata)}\n"

        md += "\n"

        # Message body
        md += f"{indent}> {msg.body_content.strip()}\n"

        # Attachments
        if msg.attachments:
            md += f"\n{indent}**Attachments:**\n"
            for att in msg.attachments:
                size_str = f" ({att.size} bytes)" if att.size else ""
                md += f"{indent}- 📄 **{att.name}** ({att.content_type}){size_str}\n"
                if att.content_url:
                    md += f"{indent}  - URL: {att.content_url}\n"

        # Reactions
        if msg.reactions:
            md += f"\n{indent}**Reactions:**\n"
            reaction_counts = {}
            reaction_users = {}

            for r in msg.reactions:
                if r.reaction_type not in reaction_counts:
                    reaction_counts[r.reaction_type] = 0
                    reaction_users[r.reaction_type] = []

                reaction_counts[r.reaction_type] += 1
                if r.user_name:
                    reaction_users[r.reaction_type].append(r.user_name)

            for reaction_type, count in reaction_counts.items():
                users = reaction_users[reaction_type]
                user_str = f" ({', '.join(users[:3])}{'...' if len(users) > 3 else ''})" if users else ""
                md += f"{indent}- {reaction_type}: {count}{user_str}\n"

        # Mentions
        if msg.mentions:
            md += f"\n{indent}**Mentions:**\n"
            for mention in msg.mentions:
                email_str = f" ({mention.user_email})" if mention.user_email else ""
                md += f"{indent}- @ {mention.user_name}{email_str}\n"

        # Web URL
        if msg.web_url:
            md += f"\n{indent}**Link:** [View in Teams]({msg.web_url})\n"

        return md + "\n"

    @staticmethod
    def export_incident_report(
        result: ExtractionResult,
        output_path: Union[str, Path],
        incident_title: str,
        incident_description: str = "",
    ) -> None:
        """
        Export messages as an incident report in Markdown.

        Args:
            result: Extraction result to export
            output_path: Output file path
            incident_title: Incident title
            incident_description: Incident description
        """
        output_path = Path(output_path)
        output_path.parent.mkdir(parents=True, exist_ok=True)

        stats = result.get_statistics()
        threads = result.get_threads()

        # Build incident report
        md = f"# Incident Report: {incident_title}\n\n"

        md += "## Incident Overview\n\n"
        if incident_description:
            md += f"{incident_description}\n\n"

        md += f"**Incident Start:** {result.config.start_date.strftime('%Y-%m-%d %H:%M:%S') if result.config.start_date else 'N/A'}\n"
        md += f"**Incident End:** {result.config.end_date.strftime('%Y-%m-%d %H:%M:%S') if result.config.end_date else 'N/A'}\n"
        md += f"**Report Generated:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n"

        md += "## Communication Summary\n\n"
        md += f"- **Total Messages:** {stats['total_messages']}\n"
        md += f"- **Conversation Threads:** {stats['total_threads']}\n"
        md += f"- **Team Members Involved:** {stats['authors']}\n"
        md += f"- **Channels:** {stats['channels']}\n\n"

        md += "## Timeline of Events\n\n"

        # Sort messages chronologically
        sorted_messages = sorted(result.messages, key=lambda m: m.created_at)

        for msg in sorted_messages:
            timestamp = msg.created_at.strftime('%H:%M:%S')
            author = msg.author_name
            channel = msg.channel_name or "Unknown"

            # Extract first line or 100 chars of message
            preview = msg.body_content.strip().split('\n')[0][:100]
            if len(msg.body_content) > 100:
                preview += "..."

            md += f"- **{timestamp}** - {author} in #{channel}: {preview}\n"

        md += "\n## Detailed Communication Log\n\n"
        md += MarkdownExporter._generate_threads_markdown(threads)

        with open(output_path, "w", encoding="utf-8") as f:
            f.write(md)
