"""Configuration management for Teams Extractor."""

import os
from pathlib import Path
from typing import Any, Dict, Optional
import yaml
from dataclasses import dataclass, field


@dataclass
class GraphAPIConfig:
    """Microsoft Graph API configuration."""
    tenant_id: str = ""
    client_id: str = ""
    client_secret: str = ""
    use_delegated_auth: bool = False


@dataclass
class JiraConfig:
    """Jira integration configuration."""
    url: str = ""
    username: str = ""
    api_token: str = ""
    default_project: str = ""
    default_issue_type: str = "Task"
    enabled: bool = False


@dataclass
class ConfluenceConfig:
    """Confluence integration configuration."""
    url: str = ""
    username: str = ""
    api_token: str = ""
    default_space: str = ""
    enabled: bool = False


@dataclass
class EmailConfig:
    """Email notification configuration."""
    smtp_host: str = ""
    smtp_port: int = 587
    username: str = ""
    password: str = ""
    from_address: str = ""
    use_tls: bool = True
    enabled: bool = False


@dataclass
class Settings:
    """Application settings."""
    graph_api: GraphAPIConfig = field(default_factory=GraphAPIConfig)
    jira: JiraConfig = field(default_factory=JiraConfig)
    confluence: ConfluenceConfig = field(default_factory=ConfluenceConfig)
    email: EmailConfig = field(default_factory=EmailConfig)

    # Output settings
    output_dir: str = "output"
    log_level: str = "INFO"
    log_file: Optional[str] = None

    @classmethod
    def load_from_file(cls, config_file: str) -> "Settings":
        """Load settings from YAML file."""
        config_path = Path(config_file)

        if not config_path.exists():
            raise FileNotFoundError(f"Config file not found: {config_file}")

        with open(config_path, "r") as f:
            data = yaml.safe_load(f) or {}

        return cls.from_dict(data)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "Settings":
        """Create settings from dictionary."""
        graph_api_data = data.get("graph_api", {})
        graph_api = GraphAPIConfig(
            tenant_id=graph_api_data.get("tenant_id", ""),
            client_id=graph_api_data.get("client_id", ""),
            client_secret=graph_api_data.get("client_secret", ""),
            use_delegated_auth=graph_api_data.get("use_delegated_auth", False),
        )

        jira_data = data.get("jira", {})
        jira = JiraConfig(
            url=jira_data.get("url", ""),
            username=jira_data.get("username", ""),
            api_token=jira_data.get("api_token", ""),
            default_project=jira_data.get("default_project", ""),
            default_issue_type=jira_data.get("default_issue_type", "Task"),
            enabled=jira_data.get("enabled", False),
        )

        confluence_data = data.get("confluence", {})
        confluence = ConfluenceConfig(
            url=confluence_data.get("url", ""),
            username=confluence_data.get("username", ""),
            api_token=confluence_data.get("api_token", ""),
            default_space=confluence_data.get("default_space", ""),
            enabled=confluence_data.get("enabled", False),
        )

        email_data = data.get("email", {})
        email = EmailConfig(
            smtp_host=email_data.get("smtp_host", ""),
            smtp_port=email_data.get("smtp_port", 587),
            username=email_data.get("username", ""),
            password=email_data.get("password", ""),
            from_address=email_data.get("from_address", ""),
            use_tls=email_data.get("use_tls", True),
            enabled=email_data.get("enabled", False),
        )

        return cls(
            graph_api=graph_api,
            jira=jira,
            confluence=confluence,
            email=email,
            output_dir=data.get("output_dir", "output"),
            log_level=data.get("log_level", "INFO"),
            log_file=data.get("log_file"),
        )

    @classmethod
    def from_env(cls) -> "Settings":
        """Load settings from environment variables."""
        graph_api = GraphAPIConfig(
            tenant_id=os.getenv("TEAMS_TENANT_ID", ""),
            client_id=os.getenv("TEAMS_CLIENT_ID", ""),
            client_secret=os.getenv("TEAMS_CLIENT_SECRET", ""),
            use_delegated_auth=os.getenv("TEAMS_USE_DELEGATED_AUTH", "false").lower() == "true",
        )

        jira = JiraConfig(
            url=os.getenv("JIRA_URL", ""),
            username=os.getenv("JIRA_USERNAME", ""),
            api_token=os.getenv("JIRA_API_TOKEN", ""),
            default_project=os.getenv("JIRA_DEFAULT_PROJECT", ""),
            enabled=os.getenv("JIRA_ENABLED", "false").lower() == "true",
        )

        confluence = ConfluenceConfig(
            url=os.getenv("CONFLUENCE_URL", ""),
            username=os.getenv("CONFLUENCE_USERNAME", ""),
            api_token=os.getenv("CONFLUENCE_API_TOKEN", ""),
            default_space=os.getenv("CONFLUENCE_DEFAULT_SPACE", ""),
            enabled=os.getenv("CONFLUENCE_ENABLED", "false").lower() == "true",
        )

        email = EmailConfig(
            smtp_host=os.getenv("SMTP_HOST", ""),
            smtp_port=int(os.getenv("SMTP_PORT", "587")),
            username=os.getenv("SMTP_USERNAME", ""),
            password=os.getenv("SMTP_PASSWORD", ""),
            from_address=os.getenv("SMTP_FROM_ADDRESS", ""),
            enabled=os.getenv("EMAIL_ENABLED", "false").lower() == "true",
        )

        return cls(
            graph_api=graph_api,
            jira=jira,
            confluence=confluence,
            email=email,
            output_dir=os.getenv("OUTPUT_DIR", "output"),
            log_level=os.getenv("LOG_LEVEL", "INFO"),
            log_file=os.getenv("LOG_FILE"),
        )

    def validate(self) -> None:
        """Validate required settings."""
        errors = []

        if not self.graph_api.tenant_id:
            errors.append("Graph API tenant_id is required")
        if not self.graph_api.client_id:
            errors.append("Graph API client_id is required")

        if not self.graph_api.use_delegated_auth and not self.graph_api.client_secret:
            errors.append("Graph API client_secret is required for service principal auth")

        if errors:
            raise ValueError(f"Configuration errors:\n" + "\n".join(f"- {e}" for e in errors))
