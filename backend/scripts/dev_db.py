"""Embedded PostgreSQL 16 + pgvector for local development and tests (no Docker needed).

Usage:  python -m scripts.dev_db        # starts the server and prints DATABASE_URL
Production / Docker users set DATABASE_URL instead and never touch this file.
"""
import os
from pathlib import Path

DATA_DIR = Path(os.environ.get("LF_PGDATA", Path(__file__).resolve().parent.parent / ".pgdata"))
_server = None


def ensure_dev_server(data_dir: Path | None = None) -> str:
    global _server
    import pgserver  # dev dependency

    if _server is None:
        _server = pgserver.get_server(str(data_dir or DATA_DIR), cleanup_mode=None)
        _server.psql("CREATE EXTENSION IF NOT EXISTS vector;")
    uri = _server.get_uri()  # postgresql://postgres:@/postgres?host=/path
    return uri.replace("postgresql://", "postgresql+psycopg://", 1)


if __name__ == "__main__":
    print(ensure_dev_server())
