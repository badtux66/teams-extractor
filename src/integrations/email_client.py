"""Email notification client for extraction results."""

import logging
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.application import MIMEApplication
from pathlib import Path
from typing import List, Optional, Union

from ..core.models import ExtractionResult

logger = logging.getLogger(__name__)


class EmailError(Exception):
    """Raised when email operations fail."""


class EmailClient:
    """
    Email client for sending extraction results and notifications.

    Supports:
    - SMTP with TLS/SSL
    - HTML and plain text emails
    - Attachments
    - Extraction summaries
    """

    def __init__(
        self,
        smtp_host: str,
        smtp_port: int,
        username: str,
        password: str,
        from_address: str,
        use_tls: bool = True,
    ):
        """
        Initialize email client.

        Args:
            smtp_host: SMTP server hostname
            smtp_port: SMTP server port
            username: SMTP username
            password: SMTP password
            from_address: From email address
            use_tls: Use TLS encryption
        """
        self.smtp_host = smtp_host
        self.smtp_port = smtp_port
        self.username = username
        self.password = password
        self.from_address = from_address
        self.use_tls = use_tls

        logger.info(f"Initialized email client for {smtp_host}:{smtp_port}")

    def send_email(
        self,
        to_addresses: List[str],
        subject: str,
        body_text: str,
        body_html: Optional[str] = None,
        attachments: Optional[List[Union[str, Path]]] = None,
        cc_addresses: Optional[List[str]] = None,
    ) -> None:
        """
        Send an email.

        Args:
            to_addresses: List of recipient email addresses
            subject: Email subject
            body_text: Plain text body
            body_html: HTML body (optional)
            attachments: List of file paths to attach
            cc_addresses: List of CC email addresses
        """
        try:
            # Create message
            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"] = self.from_address
            msg["To"] = ", ".join(to_addresses)

            if cc_addresses:
                msg["Cc"] = ", ".join(cc_addresses)

            # Add plain text part
            msg.attach(MIMEText(body_text, "plain"))

            # Add HTML part if provided
            if body_html:
                msg.attach(MIMEText(body_html, "html"))

            # Add attachments
            if attachments:
                for attachment_path in attachments:
                    path = Path(attachment_path)
                    if not path.exists():
                        logger.warning(f"Attachment not found: {path}")
                        continue

                    with open(path, "rb") as f:
                        part = MIMEApplication(f.read(), Name=path.name)
                        part["Content-Disposition"] = f'attachment; filename="{path.name}"'
                        msg.attach(part)

            # Connect and send
            all_recipients = to_addresses + (cc_addresses or [])

            if self.use_tls:
                with smtplib.SMTP(self.smtp_host, self.smtp_port) as server:
                    server.starttls()
                    server.login(self.username, self.password)
                    server.send_message(msg, self.from_address, all_recipients)
            else:
                with smtplib.SMTP_SSL(self.smtp_host, self.smtp_port) as server:
                    server.login(self.username, self.password)
                    server.send_message(msg, self.from_address, all_recipients)

            logger.info(f"Email sent to {', '.join(to_addresses)}")

        except Exception as exc:
            raise EmailError(f"Failed to send email: {exc}") from exc

    def send_extraction_summary(
        self,
        to_addresses: List[str],
        result: ExtractionResult,
        subject: Optional[str] = None,
        attachments: Optional[List[Union[str, Path]]] = None,
    ) -> None:
        """
        Send extraction result summary via email.

        Args:
            to_addresses: Recipient email addresses
            result: Extraction result
            subject: Email subject (auto-generated if None)
            attachments: Additional attachments
        """
        stats = result.get_statistics()

        # Generate subject
        if subject is None:
            subject = f"Teams Message Extraction - {stats['total_messages']} messages extracted"

        # Generate plain text body
        body_text = f"""
Teams Message Extraction Summary
=================================

Extraction completed successfully!

Statistics:
-----------
Total Messages: {stats['total_messages']}
Threads: {stats['total_threads']}
Authors: {stats['authors']}
Channels: {stats['channels']}
Teams: {stats['teams']}

Details:
--------
Messages with Attachments: {stats['with_attachments']}
Messages with Reactions: {stats['with_reactions']}
Messages with Mentions: {stats['with_mentions']}

Extraction took {stats['duration_seconds']:.1f} seconds
Rate: {stats['messages_per_second']:.2f} messages/second
"""

        if result.config.start_date:
            body_text += f"\nDate Range: {result.config.start_date} to {result.config.end_date or 'now'}"

        if result.config.keywords:
            body_text += f"\nKeywords: {', '.join(result.config.keywords)}"

        if result.errors:
            body_text += f"\n\nErrors encountered: {len(result.errors)}"

        # Generate HTML body
        body_html = f"""
<html>
<head>
    <style>
        body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
        .header {{ background: #0052CC; color: white; padding: 20px; border-radius: 5px; }}
        .stats {{ background: #f4f5f7; padding: 15px; border-radius: 5px; margin: 20px 0; }}
        .stat-row {{ display: flex; justify-content: space-between; padding: 5px 0; }}
        .label {{ font-weight: bold; }}
        .value {{ color: #0052CC; }}
    </style>
</head>
<body>
    <div class="header">
        <h1>Teams Message Extraction Summary</h1>
        <p>Extraction completed successfully!</p>
    </div>

    <div class="stats">
        <h2>Statistics</h2>
        <div class="stat-row"><span class="label">Total Messages:</span> <span class="value">{stats['total_messages']}</span></div>
        <div class="stat-row"><span class="label">Threads:</span> <span class="value">{stats['total_threads']}</span></div>
        <div class="stat-row"><span class="label">Authors:</span> <span class="value">{stats['authors']}</span></div>
        <div class="stat-row"><span class="label">Channels:</span> <span class="value">{stats['channels']}</span></div>
        <div class="stat-row"><span class="label">Teams:</span> <span class="value">{stats['teams']}</span></div>
    </div>

    <div class="stats">
        <h2>Details</h2>
        <div class="stat-row"><span class="label">With Attachments:</span> <span class="value">{stats['with_attachments']}</span></div>
        <div class="stat-row"><span class="label">With Reactions:</span> <span class="value">{stats['with_reactions']}</span></div>
        <div class="stat-row"><span class="label">With Mentions:</span> <span class="value">{stats['with_mentions']}</span></div>
    </div>

    <p>
        <strong>Duration:</strong> {stats['duration_seconds']:.1f} seconds<br/>
        <strong>Rate:</strong> {stats['messages_per_second']:.2f} messages/second
    </p>
"""

        if result.errors:
            body_html += f"<p style='color: #DE350B;'><strong>Errors encountered:</strong> {len(result.errors)}</p>"

        body_html += "</body></html>"

        # Send email
        self.send_email(
            to_addresses=to_addresses,
            subject=subject,
            body_text=body_text,
            body_html=body_html,
            attachments=attachments,
        )

    def send_incident_notification(
        self,
        to_addresses: List[str],
        incident_title: str,
        message_count: int,
        channels: List[str],
        keywords_found: List[str],
        jira_issue_key: Optional[str] = None,
    ) -> None:
        """
        Send incident notification email.

        Args:
            to_addresses: Recipient email addresses
            incident_title: Incident title
            message_count: Number of messages extracted
            channels: Channels involved
            keywords_found: Keywords that triggered the alert
            jira_issue_key: Associated Jira issue key
        """
        subject = f"🚨 Incident Alert: {incident_title}"

        body_text = f"""
Incident Alert
==============

Title: {incident_title}

Details:
--------
Messages Extracted: {message_count}
Channels: {', '.join(channels)}
Keywords Found: {', '.join(keywords_found)}
"""

        if jira_issue_key:
            body_text += f"\nJira Issue: {jira_issue_key}"

        body_html = f"""
<html>
<body style="font-family: Arial, sans-serif;">
    <div style="background: #DE350B; color: white; padding: 20px; border-radius: 5px;">
        <h1>🚨 Incident Alert</h1>
        <h2>{incident_title}</h2>
    </div>

    <div style="margin: 20px 0;">
        <p><strong>Messages Extracted:</strong> {message_count}</p>
        <p><strong>Channels:</strong> {', '.join(channels)}</p>
        <p><strong>Keywords Found:</strong> {', '.join(keywords_found)}</p>
"""

        if jira_issue_key:
            body_html += f"<p><strong>Jira Issue:</strong> {jira_issue_key}</p>"

        body_html += """
    </div>
</body>
</html>
"""

        self.send_email(
            to_addresses=to_addresses,
            subject=subject,
            body_text=body_text,
            body_html=body_html,
        )

        logger.info(f"Sent incident notification for '{incident_title}'")
