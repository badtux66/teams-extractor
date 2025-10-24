"""Data models for Teams message extraction."""

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, List, Optional
from enum import Enum


class MessageType(Enum):
    """Types of Teams messages."""
    MESSAGE = "message"
    REPLY = "reply"
    SYSTEM = "systemEventMessage"
    MEETING = "meetingMessage"


class ChannelType(Enum):
    """Types of Teams channels."""
    STANDARD = "standard"
    PRIVATE = "private"
    SHARED = "shared"


@dataclass
class Attachment:
    """Represents a message attachment."""
    id: str
    name: str
    content_type: str
    content_url: Optional[str] = None
    size: Optional[int] = None

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "Attachment":
        """Create Attachment from API response."""
        return cls(
            id=data.get("id", ""),
            name=data.get("name", ""),
            content_type=data.get("contentType", ""),
            content_url=data.get("contentUrl"),
            size=data.get("size"),
        )


@dataclass
class Reaction:
    """Represents a message reaction."""
    reaction_type: str
    user_id: str
    user_name: Optional[str] = None
    created_at: Optional[datetime] = None

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "Reaction":
        """Create Reaction from API response."""
        return cls(
            reaction_type=data.get("reactionType", ""),
            user_id=data.get("user", {}).get("user", {}).get("id", ""),
            user_name=data.get("user", {}).get("user", {}).get("displayName"),
            created_at=datetime.fromisoformat(data["createdDateTime"].replace("Z", "+00:00"))
            if "createdDateTime" in data else None,
        )


@dataclass
class Mention:
    """Represents a user mention in a message."""
    id: int
    user_id: str
    user_name: str
    user_email: Optional[str] = None

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "Mention":
        """Create Mention from API response."""
        mentioned = data.get("mentioned", {})
        user_data = mentioned.get("user", {})
        return cls(
            id=data.get("id", 0),
            user_id=user_data.get("id", ""),
            user_name=user_data.get("displayName", ""),
            user_email=user_data.get("userIdentityType") == "aadUser"
                      and user_data.get("userPrincipalName"),
        )


@dataclass
class TeamsMessage:
    """Represents a Teams message with all metadata."""
    id: str
    message_type: MessageType
    created_at: datetime
    last_modified_at: Optional[datetime]
    deleted_at: Optional[datetime]

    # Content
    subject: Optional[str]
    body_content: str
    body_content_type: str  # html or text

    # Author
    author_id: str
    author_name: str
    author_email: Optional[str]

    # Context
    team_id: str
    team_name: Optional[str]
    channel_id: str
    channel_name: Optional[str]

    # Thread information
    reply_to_id: Optional[str] = None

    # Rich data
    attachments: List[Attachment] = field(default_factory=list)
    reactions: List[Reaction] = field(default_factory=list)
    mentions: List[Mention] = field(default_factory=list)

    # Links and references
    web_url: Optional[str] = None
    importance: str = "normal"

    # Metadata
    raw_data: Dict[str, Any] = field(default_factory=dict)

    @classmethod
    def from_dict(cls, data: Dict[str, Any], team_id: str, channel_id: str,
                  team_name: Optional[str] = None, channel_name: Optional[str] = None) -> "TeamsMessage":
        """Create TeamsMessage from API response."""
        from_user = data.get("from", {}).get("user", {})
        body = data.get("body", {})

        # Parse attachments
        attachments = [
            Attachment.from_dict(att)
            for att in data.get("attachments", [])
        ]

        # Parse reactions
        reactions = [
            Reaction.from_dict(react)
            for react in data.get("reactions", [])
        ]

        # Parse mentions
        mentions = [
            Mention.from_dict(mention)
            for mention in data.get("mentions", [])
        ]

        return cls(
            id=data.get("id", ""),
            message_type=MessageType(data.get("messageType", "message")),
            created_at=datetime.fromisoformat(data["createdDateTime"].replace("Z", "+00:00"))
            if "createdDateTime" in data else datetime.now(),
            last_modified_at=datetime.fromisoformat(data["lastModifiedDateTime"].replace("Z", "+00:00"))
            if "lastModifiedDateTime" in data else None,
            deleted_at=datetime.fromisoformat(data["deletedDateTime"].replace("Z", "+00:00"))
            if "deletedDateTime" in data else None,
            subject=data.get("subject"),
            body_content=body.get("content", ""),
            body_content_type=body.get("contentType", "html"),
            author_id=from_user.get("id", ""),
            author_name=from_user.get("displayName", ""),
            author_email=from_user.get("userPrincipalName"),
            team_id=team_id,
            team_name=team_name,
            channel_id=channel_id,
            channel_name=channel_name,
            reply_to_id=data.get("replyToId"),
            attachments=attachments,
            reactions=reactions,
            mentions=mentions,
            web_url=data.get("webUrl"),
            importance=data.get("importance", "normal"),
            raw_data=data,
        )

    def to_dict(self) -> Dict[str, Any]:
        """Convert message to dictionary."""
        return {
            "id": self.id,
            "message_type": self.message_type.value,
            "created_at": self.created_at.isoformat(),
            "last_modified_at": self.last_modified_at.isoformat() if self.last_modified_at else None,
            "deleted_at": self.deleted_at.isoformat() if self.deleted_at else None,
            "subject": self.subject,
            "body_content": self.body_content,
            "body_content_type": self.body_content_type,
            "author_id": self.author_id,
            "author_name": self.author_name,
            "author_email": self.author_email,
            "team_id": self.team_id,
            "team_name": self.team_name,
            "channel_id": self.channel_id,
            "channel_name": self.channel_name,
            "reply_to_id": self.reply_to_id,
            "attachments": [
                {
                    "id": att.id,
                    "name": att.name,
                    "content_type": att.content_type,
                    "content_url": att.content_url,
                    "size": att.size,
                }
                for att in self.attachments
            ],
            "reactions": [
                {
                    "reaction_type": r.reaction_type,
                    "user_id": r.user_id,
                    "user_name": r.user_name,
                    "created_at": r.created_at.isoformat() if r.created_at else None,
                }
                for r in self.reactions
            ],
            "mentions": [
                {
                    "id": m.id,
                    "user_id": m.user_id,
                    "user_name": m.user_name,
                    "user_email": m.user_email,
                }
                for m in self.mentions
            ],
            "web_url": self.web_url,
            "importance": self.importance,
        }


@dataclass
class TeamsChannel:
    """Represents a Teams channel."""
    id: str
    team_id: str
    display_name: str
    description: Optional[str]
    channel_type: ChannelType
    web_url: Optional[str] = None
    email: Optional[str] = None

    @classmethod
    def from_dict(cls, data: Dict[str, Any], team_id: str) -> "TeamsChannel":
        """Create TeamsChannel from API response."""
        return cls(
            id=data.get("id", ""),
            team_id=team_id,
            display_name=data.get("displayName", ""),
            description=data.get("description"),
            channel_type=ChannelType(data.get("membershipType", "standard")),
            web_url=data.get("webUrl"),
            email=data.get("email"),
        )


@dataclass
class TeamsThread:
    """Represents a conversation thread."""
    root_message: TeamsMessage
    replies: List[TeamsMessage] = field(default_factory=list)

    def get_all_messages(self) -> List[TeamsMessage]:
        """Get all messages in the thread."""
        return [self.root_message] + self.replies

    def get_message_count(self) -> int:
        """Get total message count."""
        return 1 + len(self.replies)


@dataclass
class ExtractionConfig:
    """Configuration for message extraction."""
    # Time filters
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None

    # Content filters
    keywords: List[str] = field(default_factory=list)
    regex_patterns: List[str] = field(default_factory=list)

    # User filters
    author_ids: List[str] = field(default_factory=list)
    author_names: List[str] = field(default_factory=list)
    author_emails: List[str] = field(default_factory=list)

    # Channel filters
    team_ids: List[str] = field(default_factory=list)
    channel_ids: List[str] = field(default_factory=list)
    channel_names: List[str] = field(default_factory=list)

    # Message type filters
    include_replies: bool = True
    include_system_messages: bool = False
    include_deleted: bool = False

    # Extraction options
    max_messages: Optional[int] = None
    include_attachments: bool = True
    include_reactions: bool = True
    include_mentions: bool = True

    # Processing options
    batch_size: int = 50
    rate_limit_pause: float = 0.5  # seconds between API calls


@dataclass
class ExtractionResult:
    """Result of message extraction."""
    messages: List[TeamsMessage]
    total_extracted: int
    start_time: datetime
    end_time: datetime
    config: ExtractionConfig
    errors: List[str] = field(default_factory=list)

    def get_duration_seconds(self) -> float:
        """Get extraction duration in seconds."""
        return (self.end_time - self.start_time).total_seconds()

    def get_threads(self) -> List[TeamsThread]:
        """Organize messages into threads."""
        # Group messages by root message
        root_messages = [m for m in self.messages if m.reply_to_id is None]
        threads = []

        for root in root_messages:
            replies = [m for m in self.messages if m.reply_to_id == root.id]
            threads.append(TeamsThread(root_message=root, replies=replies))

        return threads

    def get_statistics(self) -> Dict[str, Any]:
        """Get extraction statistics."""
        threads = self.get_threads()
        return {
            "total_messages": self.total_extracted,
            "root_messages": len(threads),
            "total_threads": len(threads),
            "duration_seconds": self.get_duration_seconds(),
            "messages_per_second": self.total_extracted / self.get_duration_seconds() if self.get_duration_seconds() > 0 else 0,
            "authors": len(set(m.author_id for m in self.messages)),
            "channels": len(set(m.channel_id for m in self.messages)),
            "teams": len(set(m.team_id for m in self.messages)),
            "with_attachments": len([m for m in self.messages if m.attachments]),
            "with_reactions": len([m for m in self.messages if m.reactions]),
            "with_mentions": len([m for m in self.messages if m.mentions]),
            "errors": len(self.errors),
        }
