"""CSV export functionality."""

import csv
from pathlib import Path
from typing import Union
import html

from ..core.models import ExtractionResult, TeamsMessage


class CSVExporter:
    """Export Teams messages to CSV format."""

    DEFAULT_FIELDS = [
        "message_id",
        "created_at",
        "author_name",
        "author_email",
        "team_name",
        "channel_name",
        "subject",
        "body_content",
        "message_type",
        "is_reply",
        "attachment_count",
        "reaction_count",
        "mention_count",
        "web_url",
    ]

    @staticmethod
    def export(
        result: ExtractionResult,
        output_path: Union[str, Path],
        fields: list[str] = None,
        include_raw_html: bool = False,
    ) -> None:
        """
        Export extraction result to CSV file.

        Args:
            result: Extraction result to export
            output_path: Output file path
            fields: Fields to include (uses DEFAULT_FIELDS if None)
            include_raw_html: Include raw HTML body content
        """
        if fields is None:
            fields = CSVExporter.DEFAULT_FIELDS.copy()

        output_path = Path(output_path)
        output_path.parent.mkdir(parents=True, exist_ok=True)

        with open(output_path, "w", encoding="utf-8", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=fields, extrasaction="ignore")
            writer.writeheader()

            for msg in result.messages:
                row = CSVExporter._message_to_row(msg, include_raw_html)
                writer.writerow(row)

    @staticmethod
    def _message_to_row(msg: TeamsMessage, include_raw_html: bool = False) -> dict:
        """Convert message to CSV row."""
        # Strip HTML tags if not including raw HTML
        body_content = msg.body_content
        if not include_raw_html and msg.body_content_type == "html":
            body_content = html.unescape(
                html.parser.HTMLParser().unescape(
                    ''.join(
                        c for c in msg.body_content
                        if c not in ['<', '>'] or not msg.body_content[
                            max(0, msg.body_content.index(c) - 1):
                            min(len(msg.body_content), msg.body_content.index(c) + 2)
                        ].startswith('<')
                    )
                )
            )

        return {
            "message_id": msg.id,
            "created_at": msg.created_at.isoformat(),
            "last_modified_at": msg.last_modified_at.isoformat() if msg.last_modified_at else "",
            "author_id": msg.author_id,
            "author_name": msg.author_name,
            "author_email": msg.author_email or "",
            "team_id": msg.team_id,
            "team_name": msg.team_name or "",
            "channel_id": msg.channel_id,
            "channel_name": msg.channel_name or "",
            "subject": msg.subject or "",
            "body_content": body_content,
            "body_content_type": msg.body_content_type,
            "message_type": msg.message_type.value,
            "is_reply": "Yes" if msg.reply_to_id else "No",
            "reply_to_id": msg.reply_to_id or "",
            "attachment_count": len(msg.attachments),
            "reaction_count": len(msg.reactions),
            "mention_count": len(msg.mentions),
            "importance": msg.importance,
            "web_url": msg.web_url or "",
        }

    @staticmethod
    def export_threads(
        result: ExtractionResult,
        output_path: Union[str, Path],
    ) -> None:
        """
        Export messages grouped by thread to CSV.

        Args:
            result: Extraction result to export
            output_path: Output file path
        """
        output_path = Path(output_path)
        output_path.parent.mkdir(parents=True, exist_ok=True)

        threads = result.get_threads()

        with open(output_path, "w", encoding="utf-8", newline="") as f:
            writer = csv.writer(f)
            writer.writerow([
                "thread_id",
                "root_message_id",
                "root_author",
                "root_subject",
                "root_created_at",
                "reply_count",
                "total_messages",
                "channel_name",
            ])

            for thread in threads:
                writer.writerow([
                    thread.root_message.id,
                    thread.root_message.id,
                    thread.root_message.author_name,
                    thread.root_message.subject or "(no subject)",
                    thread.root_message.created_at.isoformat(),
                    len(thread.replies),
                    thread.get_message_count(),
                    thread.root_message.channel_name,
                ])
