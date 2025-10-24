"""Command-line interface for Teams message extractor."""

import asyncio
import logging
import sys
from datetime import datetime, timedelta
from pathlib import Path
from typing import List, Optional

import click
from rich.console import Console
from rich.logging import RichHandler
from rich.progress import Progress, SpinnerColumn, TextColumn, BarColumn, TimeRemainingColumn
from rich.table import Table

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from config.settings import Settings
from src.core.graph_client import GraphAPIClient
from src.core.extractor import TeamsExtractor
from src.core.models import ExtractionConfig
from src.exporters import JSONExporter, CSVExporter, HTMLExporter, MarkdownExporter
from src.integrations import JiraClient, ConfluenceClient, EmailClient
from src.scheduler import ExtractionScheduler

console = Console()


def setup_logging(log_level: str, log_file: Optional[str] = None):
    """Configure logging."""
    handlers = [RichHandler(console=console, rich_tracebacks=True)]

    if log_file:
        handlers.append(logging.FileHandler(log_file))

    logging.basicConfig(
        level=log_level,
        format="%(message)s",
        datefmt="[%X]",
        handlers=handlers,
    )


@click.group()
@click.option("--config", "-c", default="config/config.yaml", help="Configuration file path")
@click.option("--log-level", default="INFO", help="Logging level")
@click.option("--log-file", help="Log file path")
@click.pass_context
def cli(ctx, config, log_level, log_file):
    """Teams Message Extractor CLI - Extract, analyze, and export Teams messages."""
    ctx.ensure_object(dict)

    setup_logging(log_level, log_file)

    # Load settings
    try:
        if Path(config).exists():
            settings = Settings.load_from_file(config)
        else:
            console.print(f"[yellow]Config file not found: {config}, using environment variables[/yellow]")
            settings = Settings.from_env()

        settings.validate()
        ctx.obj["settings"] = settings

    except Exception as exc:
        console.print(f"[red]Configuration error: {exc}[/red]")
        sys.exit(1)


@cli.command()
@click.option("--start-date", help="Start date (ISO format: 2024-01-01)")
@click.option("--end-date", help="End date (ISO format: 2024-01-31)")
@click.option("--last-hours", type=int, help="Extract messages from last N hours")
@click.option("--last-days", type=int, help="Extract messages from last N days")
@click.option("--keywords", "-k", multiple=True, help="Keywords to filter (can specify multiple)")
@click.option("--channel", "-ch", multiple=True, help="Channel names to include")
@click.option("--team-id", multiple=True, help="Team IDs to include")
@click.option("--author-email", multiple=True, help="Author emails to filter")
@click.option("--max-messages", type=int, help="Maximum messages to extract")
@click.option("--output", "-o", default="output", help="Output directory")
@click.option("--format", "-f", multiple=True, default=["json"], help="Output formats (json, csv, html, markdown)")
@click.option("--create-jira-issue", is_flag=True, help="Create Jira incident issue")
@click.option("--create-confluence-page", is_flag=True, help="Create Confluence page")
@click.option("--send-email", is_flag=True, help="Send email notification")
@click.option("--email-to", multiple=True, help="Email recipients")
@click.pass_context
def extract(ctx, start_date, end_date, last_hours, last_days, keywords, channel, team_id,
            author_email, max_messages, output, format, create_jira_issue,
            create_confluence_page, send_email, email_to):
    """Extract Teams messages with filters and export to various formats."""
    settings: Settings = ctx.obj["settings"]

    # Parse dates
    if last_hours:
        start_dt = datetime.now() - timedelta(hours=last_hours)
        end_dt = datetime.now()
    elif last_days:
        start_dt = datetime.now() - timedelta(days=last_days)
        end_dt = datetime.now()
    else:
        start_dt = datetime.fromisoformat(start_date) if start_date else None
        end_dt = datetime.fromisoformat(end_date) if end_date else None

    # Build extraction config
    config = ExtractionConfig(
        start_date=start_dt,
        end_date=end_dt,
        keywords=list(keywords) if keywords else [],
        channel_names=list(channel) if channel else [],
        team_ids=list(team_id) if team_id else [],
        author_emails=list(author_email) if author_email else [],
        max_messages=max_messages,
    )

    async def run_extraction():
        # Connect to Graph API
        async with GraphAPIClient(
            tenant_id=settings.graph_api.tenant_id,
            client_id=settings.graph_api.client_id,
            client_secret=settings.graph_api.client_secret,
            use_delegated_auth=settings.graph_api.use_delegated_auth,
        ) as graph_client:

            # Create extractor
            extractor = TeamsExtractor(graph_client)

            # Progress callback
            with Progress(
                SpinnerColumn(),
                TextColumn("[progress.description]{task.description}"),
                BarColumn(),
                TextColumn("[progress.percentage]{task.percentage:>3.0f}%"),
                TimeRemainingColumn(),
                console=console,
            ) as progress:
                task = progress.add_task("Extracting messages...", total=100)

                def update_progress(current, total, message):
                    progress.update(task, completed=(current / total) * 100, description=message)

                # Extract messages
                result = await extractor.extract_messages(config, progress_callback=update_progress)

            # Display statistics
            stats = result.get_statistics()
            table = Table(title="Extraction Statistics")
            table.add_column("Metric", style="cyan")
            table.add_column("Value", style="green")

            for key, value in stats.items():
                table.add_row(key.replace("_", " ").title(), str(value))

            console.print(table)

            # Export results
            output_dir = Path(output)
            output_dir.mkdir(parents=True, exist_ok=True)

            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

            for fmt in format:
                output_path = output_dir / f"teams_export_{timestamp}.{fmt}"

                with console.status(f"[bold green]Exporting to {fmt.upper()}..."):
                    if fmt == "json":
                        JSONExporter.export(result, output_path)
                    elif fmt == "csv":
                        CSVExporter.export(result, output_path)
                    elif fmt == "html":
                        HTMLExporter.export(result, output_path, title="Teams Message Export")
                    elif fmt == "markdown":
                        MarkdownExporter.export(result, output_path, title="Teams Message Export")

                console.print(f"✓ Exported to [bold]{output_path}[/bold]")

            # Integrations
            jira_issue_key = None

            if create_jira_issue and settings.jira.enabled:
                with console.status("[bold yellow]Creating Jira issue..."):
                    async with JiraClient(
                        jira_url=settings.jira.url,
                        username=settings.jira.username,
                        api_token=settings.jira.api_token,
                        default_project=settings.jira.default_project,
                    ) as jira_client:
                        issue = await jira_client.create_incident_issue(
                            result=result,
                            incident_title=f"Teams Extraction - {datetime.now().strftime('%Y-%m-%d')}",
                        )
                        jira_issue_key = issue.get("key")
                        console.print(f"✓ Created Jira issue: [bold]{jira_issue_key}[/bold]")

            if create_confluence_page and settings.confluence.enabled:
                with console.status("[bold yellow]Creating Confluence page..."):
                    async with ConfluenceClient(
                        confluence_url=settings.confluence.url,
                        username=settings.confluence.username,
                        api_token=settings.confluence.api_token,
                        default_space=settings.confluence.default_space,
                    ) as confluence_client:
                        page = await confluence_client.create_page_from_extraction(
                            result=result,
                            title=f"Teams Export - {datetime.now().strftime('%Y-%m-%d %H:%M')}",
                        )
                        console.print(f"✓ Created Confluence page: [bold]{page.get('id')}[/bold]")

            if send_email and settings.email.enabled:
                recipients = list(email_to) if email_to else []
                if recipients:
                    with console.status("[bold yellow]Sending email..."):
                        email_client = EmailClient(
                            smtp_host=settings.email.smtp_host,
                            smtp_port=settings.email.smtp_port,
                            username=settings.email.username,
                            password=settings.email.password,
                            from_address=settings.email.from_address,
                        )
                        email_client.send_extraction_summary(
                            to_addresses=recipients,
                            result=result,
                        )
                        console.print(f"✓ Sent email to {', '.join(recipients)}")

            console.print("\n[bold green]✓ Extraction complete![/bold green]")

    # Run async extraction
    asyncio.run(run_extraction())


@cli.command()
@click.option("--start-date", required=True, help="Incident start date (ISO format)")
@click.option("--end-date", help="Incident end date (ISO format, default: now)")
@click.option("--title", required=True, help="Incident title")
@click.option("--keywords", "-k", multiple=True, help="Incident keywords")
@click.option("--channel", "-ch", multiple=True, help="Channels to search")
@click.option("--output", "-o", default="output", help="Output directory")
@click.option("--create-jira-issue", is_flag=True, default=True, help="Create Jira issue")
@click.option("--jira-severity", default="Medium", help="Jira issue severity")
@click.pass_context
def incident(ctx, start_date, end_date, title, keywords, channel, output,
             create_jira_issue, jira_severity):
    """Extract messages for incident investigation and create incident report."""
    settings: Settings = ctx.obj["settings"]

    start_dt = datetime.fromisoformat(start_date)
    end_dt = datetime.fromisoformat(end_date) if end_date else datetime.now()

    # Default incident keywords
    incident_keywords = list(keywords) if keywords else [
        "incident", "outage", "down", "error", "critical", "urgent"
    ]

    async def run_incident_extraction():
        async with GraphAPIClient(
            tenant_id=settings.graph_api.tenant_id,
            client_id=settings.graph_api.client_id,
            client_secret=settings.graph_api.client_secret,
        ) as graph_client:

            extractor = TeamsExtractor(graph_client)

            console.print(f"[bold]Extracting incident messages for: {title}[/bold]")

            result = await extractor.extract_incident_messages(
                start_time=start_dt,
                end_time=end_dt,
                keywords=incident_keywords,
                channel_names=list(channel) if channel else None,
            )

            stats = result.get_statistics()
            console.print(f"\n[green]✓ Extracted {stats['total_messages']} incident-related messages[/green]")

            # Export incident report
            output_dir = Path(output)
            output_dir.mkdir(parents=True, exist_ok=True)

            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            report_path = output_dir / f"incident_report_{timestamp}.md"

            MarkdownExporter.export_incident_report(
                result=result,
                output_path=report_path,
                incident_title=title,
                incident_description=f"Incident occurred from {start_dt} to {end_dt}",
            )

            console.print(f"✓ Created incident report: [bold]{report_path}[/bold]")

            # Create Jira issue
            if create_jira_issue and settings.jira.enabled:
                async with JiraClient(
                    jira_url=settings.jira.url,
                    username=settings.jira.username,
                    api_token=settings.jira.api_token,
                    default_project=settings.jira.default_project,
                ) as jira_client:
                    issue = await jira_client.create_incident_issue(
                        result=result,
                        incident_title=title,
                        incident_severity=jira_severity,
                    )
                    console.print(f"✓ Created Jira issue: [bold]{issue.get('key')}[/bold]")

    asyncio.run(run_incident_extraction())


@cli.command()
@click.option("--job-config", required=True, help="Job configuration YAML file")
@click.option("--daemon", is_flag=True, help="Run as daemon")
@click.pass_context
def schedule(ctx, job_config, daemon):
    """Run scheduled extraction jobs."""
    settings: Settings = ctx.obj["settings"]

    async def run_scheduler():
        async with GraphAPIClient(
            tenant_id=settings.graph_api.tenant_id,
            client_id=settings.graph_api.client_id,
            client_secret=settings.graph_api.client_secret,
        ) as graph_client:

            scheduler = ExtractionScheduler(graph_client, job_config_file=job_config)
            scheduler.load_jobs_from_config()

            # Display job status
            status = scheduler.get_job_status()

            table = Table(title="Scheduled Jobs")
            table.add_column("Job Name", style="cyan")
            table.add_column("Schedule", style="yellow")
            table.add_column("Next Run", style="green")

            for job in status["jobs"]:
                table.add_row(
                    job["name"],
                    job["schedule"],
                    job["next_run"] or "N/A",
                )

            console.print(table)

            # Start scheduler
            scheduler.start()
            console.print("[bold green]✓ Scheduler started[/bold green]")

            if daemon:
                console.print("Running in daemon mode. Press Ctrl+C to stop.")
                try:
                    while True:
                        await asyncio.sleep(1)
                except KeyboardInterrupt:
                    console.print("\n[yellow]Stopping scheduler...[/yellow]")
                    scheduler.stop()
            else:
                console.print("Scheduler running. Press Ctrl+C to stop.")
                await asyncio.sleep(10)
                scheduler.stop()

    asyncio.run(run_scheduler())


@cli.command()
@click.pass_context
def test_connection(ctx):
    """Test Microsoft Graph API connection."""
    settings: Settings = ctx.obj["settings"]

    async def test():
        with console.status("[bold yellow]Testing Graph API connection..."):
            async with GraphAPIClient(
                tenant_id=settings.graph_api.tenant_id,
                client_id=settings.graph_api.client_id,
                client_secret=settings.graph_api.client_secret,
                use_delegated_auth=settings.graph_api.use_delegated_auth,
            ) as graph_client:

                # Try to get teams
                teams = await graph_client.get_teams()

                console.print(f"[green]✓ Successfully connected to Microsoft Graph API[/green]")
                console.print(f"[green]✓ Found {len(teams)} teams[/green]")

                # Display teams
                if teams:
                    table = Table(title="Available Teams")
                    table.add_column("Team Name", style="cyan")
                    table.add_column("Team ID", style="yellow")

                    for team in teams[:10]:  # Show first 10
                        table.add_row(team.get("displayName", "Unknown"), team.get("id", ""))

                    console.print(table)

    try:
        asyncio.run(test())
    except Exception as exc:
        console.print(f"[red]✗ Connection failed: {exc}[/red]")
        sys.exit(1)


if __name__ == "__main__":
    cli()
