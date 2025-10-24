"""Setup script for Teams Message Extractor."""

from setuptools import setup, find_packages
from pathlib import Path

# Read README
this_directory = Path(__file__).parent
long_description = (this_directory / "TEAMS_EXTRACTOR_README.md").read_text()

setup(
    name="teams-message-extractor",
    version="1.0.0",
    author="Teams Extractor Team",
    description="Comprehensive Microsoft Teams message extraction tool",
    long_description=long_description,
    long_description_content_type="text/markdown",
    url="https://github.com/yourorg/teams-extractor",
    packages=find_packages(),
    classifiers=[
        "Development Status :: 4 - Beta",
        "Intended Audience :: Developers",
        "Intended Audience :: System Administrators",
        "Topic :: Communications :: Chat",
        "Topic :: Office/Business",
        "License :: OSI Approved :: MIT License",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
        "Programming Language :: Python :: 3.12",
    ],
    python_requires=">=3.10",
    install_requires=[
        "msal>=1.25.0",
        "httpx>=0.25.0",
        "pydantic>=2.0.0",
        "python-dateutil>=2.8.2",
        "jira>=3.5.0",
        "atlassian-python-api>=3.41.0",
        "apscheduler>=3.10.4",
        "click>=8.1.0",
        "rich>=13.0.0",
        "pyyaml>=6.0.1",
        "aiofiles>=23.0.0",
        "fastapi>=0.104.0",
        "uvicorn>=0.24.0",
        "openai>=1.3.0",
    ],
    entry_points={
        "console_scripts": [
            "teams-extractor=src.cli.main:cli",
        ],
    },
    include_package_data=True,
    package_data={
        "": ["*.yaml", "*.md"],
    },
)
