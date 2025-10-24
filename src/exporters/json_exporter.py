"""JSON export functionality."""

import json
from pathlib import Path
from typing import Union

from ..core.models import ExtractionResult, TeamsMessage


class JSONExporter:
    """Export Teams messages to JSON format."""

    @staticmethod
    def export(
        result: ExtractionResult,
        output_path: Union[str, Path],
        include_statistics: bool = True,
        pretty: bool = True,
    ) -> None:
        """
        Export extraction result to JSON file.

        Args:
            result: Extraction result to export
            output_path: Output file path
            include_statistics: Include extraction statistics
            pretty: Pretty-print JSON (indented)
        """
        output_data = {
            "extraction_metadata": {
                "total_messages": result.total_extracted,
                "start_time": result.start_time.isoformat(),
                "end_time": result.end_time.isoformat(),
                "duration_seconds": result.get_duration_seconds(),
            },
            "messages": [msg.to_dict() for msg in result.messages],
        }

        if include_statistics:
            output_data["statistics"] = result.get_statistics()

        if result.errors:
            output_data["errors"] = result.errors

        # Write to file
        output_path = Path(output_path)
        output_path.parent.mkdir(parents=True, exist_ok=True)

        with open(output_path, "w", encoding="utf-8") as f:
            if pretty:
                json.dump(output_data, f, indent=2, ensure_ascii=False, default=str)
            else:
                json.dump(output_data, f, ensure_ascii=False, default=str)

    @staticmethod
    def export_messages_only(
        messages: list[TeamsMessage],
        output_path: Union[str, Path],
        pretty: bool = True,
    ) -> None:
        """
        Export only messages (no metadata) to JSON.

        Args:
            messages: List of messages to export
            output_path: Output file path
            pretty: Pretty-print JSON
        """
        output_path = Path(output_path)
        output_path.parent.mkdir(parents=True, exist_ok=True)

        data = [msg.to_dict() for msg in messages]

        with open(output_path, "w", encoding="utf-8") as f:
            if pretty:
                json.dump(data, f, indent=2, ensure_ascii=False, default=str)
            else:
                json.dump(data, f, ensure_ascii=False, default=str)
