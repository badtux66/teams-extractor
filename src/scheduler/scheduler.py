"""Scheduler for automated Teams message extractions."""

import asyncio
import logging
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional
from dataclasses import dataclass, field
import yaml

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger

from ..core.graph_client import GraphAPIClient
from ..core.extractor import TeamsExtractor
from ..core.models import ExtractionConfig
from ..exporters import JSONExporter, CSVExporter, HTMLExporter, MarkdownExporter

logger = logging.getLogger(__name__)


@dataclass
class ScheduledJob:
    """Configuration for a scheduled extraction job."""
    name: str
    schedule: str  # cron expression or interval (e.g., "0 */6 * * *" or "interval:1h")
    config: ExtractionConfig
    output_formats: List[str] = field(default_factory=lambda: ["json"])
    output_dir: str = "output"
    enabled: bool = True

    # Optional integrations
    jira_project: Optional[str] = None
    confluence_space: Optional[str] = None
    confluence_parent_id: Optional[str] = None
    email_recipients: Optional[List[str]] = None

    # Callbacks
    on_success: Optional[Callable] = None
    on_error: Optional[Callable] = None


class ExtractionScheduler:
    """
    Scheduler for automated Teams message extractions.

    Features:
    - Cron-based scheduling
    - Interval-based scheduling
    - Multiple concurrent jobs
    - Error handling and retry logic
    - Job persistence
    """

    def __init__(
        self,
        graph_client: GraphAPIClient,
        job_config_file: Optional[str] = None,
    ):
        """
        Initialize extraction scheduler.

        Args:
            graph_client: Authenticated Graph API client
            job_config_file: Optional YAML file with job configurations
        """
        self.graph_client = graph_client
        self.job_config_file = job_config_file

        self.scheduler = AsyncIOScheduler()
        self.jobs: Dict[str, ScheduledJob] = {}

        logger.info("Initialized extraction scheduler")

    def add_job(
        self,
        job: ScheduledJob,
        start_now: bool = False,
    ) -> None:
        """
        Add a scheduled extraction job.

        Args:
            job: Job configuration
            start_now: Execute job immediately before scheduling
        """
        if not job.enabled:
            logger.info(f"Job '{job.name}' is disabled, skipping")
            return

        # Parse schedule
        trigger = self._parse_schedule(job.schedule)

        # Add to scheduler
        self.scheduler.add_job(
            func=self._execute_job,
            trigger=trigger,
            args=[job],
            id=job.name,
            name=job.name,
            replace_existing=True,
        )

        self.jobs[job.name] = job

        logger.info(f"Added job '{job.name}' with schedule '{job.schedule}'")

        # Execute immediately if requested
        if start_now:
            asyncio.create_task(self._execute_job(job))

    def remove_job(self, job_name: str) -> None:
        """Remove a scheduled job."""
        if job_name in self.jobs:
            self.scheduler.remove_job(job_name)
            del self.jobs[job_name]
            logger.info(f"Removed job '{job_name}'")

    def load_jobs_from_config(self, config_file: Optional[str] = None) -> None:
        """
        Load jobs from YAML configuration file.

        Args:
            config_file: Path to YAML config file (uses job_config_file if None)
        """
        config_path = Path(config_file or self.job_config_file)

        if not config_path.exists():
            logger.warning(f"Job config file not found: {config_path}")
            return

        with open(config_path, "r") as f:
            config_data = yaml.safe_load(f)

        jobs_data = config_data.get("jobs", [])

        for job_data in jobs_data:
            try:
                job = self._job_from_dict(job_data)
                self.add_job(job)
            except Exception as exc:
                logger.error(f"Failed to load job {job_data.get('name')}: {exc}")

        logger.info(f"Loaded {len(self.jobs)} jobs from {config_path}")

    def _job_from_dict(self, data: Dict[str, Any]) -> ScheduledJob:
        """Create ScheduledJob from dictionary."""
        # Build ExtractionConfig
        config_data = data.get("extraction_config", {})

        config = ExtractionConfig(
            start_date=datetime.fromisoformat(config_data["start_date"])
            if "start_date" in config_data else None,
            end_date=datetime.fromisoformat(config_data["end_date"])
            if "end_date" in config_data else None,
            keywords=config_data.get("keywords", []),
            regex_patterns=config_data.get("regex_patterns", []),
            author_ids=config_data.get("author_ids", []),
            author_names=config_data.get("author_names", []),
            author_emails=config_data.get("author_emails", []),
            team_ids=config_data.get("team_ids", []),
            channel_ids=config_data.get("channel_ids", []),
            channel_names=config_data.get("channel_names", []),
            include_replies=config_data.get("include_replies", True),
            include_system_messages=config_data.get("include_system_messages", False),
            include_deleted=config_data.get("include_deleted", False),
            max_messages=config_data.get("max_messages"),
            batch_size=config_data.get("batch_size", 50),
        )

        return ScheduledJob(
            name=data["name"],
            schedule=data["schedule"],
            config=config,
            output_formats=data.get("output_formats", ["json"]),
            output_dir=data.get("output_dir", "output"),
            enabled=data.get("enabled", True),
            jira_project=data.get("jira_project"),
            confluence_space=data.get("confluence_space"),
            confluence_parent_id=data.get("confluence_parent_id"),
            email_recipients=data.get("email_recipients"),
        )

    def _parse_schedule(self, schedule: str):
        """Parse schedule string into APScheduler trigger."""
        if schedule.startswith("interval:"):
            # Interval-based: "interval:1h", "interval:30m", "interval:1d"
            interval_str = schedule.replace("interval:", "")

            if interval_str.endswith("h"):
                hours = int(interval_str.rstrip("h"))
                return IntervalTrigger(hours=hours)
            elif interval_str.endswith("m"):
                minutes = int(interval_str.rstrip("m"))
                return IntervalTrigger(minutes=minutes)
            elif interval_str.endswith("d"):
                days = int(interval_str.rstrip("d"))
                return IntervalTrigger(days=days)
            else:
                raise ValueError(f"Invalid interval format: {interval_str}")
        else:
            # Cron-based
            return CronTrigger.from_crontab(schedule)

    async def _execute_job(self, job: ScheduledJob) -> None:
        """Execute a scheduled extraction job."""
        logger.info(f"Executing job '{job.name}'")

        try:
            # Create extractor
            extractor = TeamsExtractor(self.graph_client)

            # Adjust time-based config for relative dates
            config = job.config
            if config.start_date is None:
                # Default to last hour
                config.start_date = datetime.now() - timedelta(hours=1)
            if config.end_date is None:
                config.end_date = datetime.now()

            # Extract messages
            result = await extractor.extract_messages(config)

            # Export results
            output_dir = Path(job.output_dir)
            output_dir.mkdir(parents=True, exist_ok=True)

            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            base_filename = f"{job.name}_{timestamp}"

            for format_type in job.output_formats:
                output_path = output_dir / f"{base_filename}.{format_type}"

                if format_type == "json":
                    JSONExporter.export(result, output_path)
                elif format_type == "csv":
                    CSVExporter.export(result, output_path)
                elif format_type == "html":
                    HTMLExporter.export(result, output_path)
                elif format_type == "markdown":
                    MarkdownExporter.export(result, output_path)

                logger.info(f"Exported to {output_path}")

            # Call success callback
            if job.on_success:
                await job.on_success(result)

            logger.info(f"Job '{job.name}' completed successfully ({result.total_extracted} messages)")

        except Exception as exc:
            logger.error(f"Job '{job.name}' failed: {exc}", exc_info=True)

            # Call error callback
            if job.on_error:
                await job.on_error(exc)

    def start(self) -> None:
        """Start the scheduler."""
        if not self.scheduler.running:
            self.scheduler.start()
            logger.info("Scheduler started")

    def stop(self) -> None:
        """Stop the scheduler."""
        if self.scheduler.running:
            self.scheduler.shutdown()
            logger.info("Scheduler stopped")

    def get_job_status(self) -> Dict[str, Any]:
        """Get status of all scheduled jobs."""
        status = {
            "running": self.scheduler.running,
            "jobs": [],
        }

        for job_id, job in self.jobs.items():
            scheduler_job = self.scheduler.get_job(job_id)

            job_status = {
                "name": job.name,
                "schedule": job.schedule,
                "enabled": job.enabled,
                "next_run": scheduler_job.next_run_time.isoformat() if scheduler_job else None,
            }

            status["jobs"].append(job_status)

        return status

    async def run_job_once(self, job_name: str) -> None:
        """Run a scheduled job immediately (outside its schedule)."""
        if job_name not in self.jobs:
            raise ValueError(f"Job '{job_name}' not found")

        job = self.jobs[job_name]
        await self._execute_job(job)
