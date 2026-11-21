from collections.abc import Iterator
from pathlib import Path

from sqlalchemy import create_engine, text
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from .config import BASE_DIR, get_settings


class Base(DeclarativeBase):
    pass


_engine = None
SessionLocal = sessionmaker(autoflush=False, expire_on_commit=False)


def resolve_database_url() -> str:
    url = get_settings().database_url
    if url:
        return url
    # Local fallback: embedded Postgres (pgserver). See scripts/dev_db.py.
    from scripts.dev_db import ensure_dev_server

    return ensure_dev_server()


def get_engine():
    global _engine
    if _engine is None:
        _engine = create_engine(resolve_database_url(), pool_pre_ping=True, pool_size=10, max_overflow=10)
        SessionLocal.configure(bind=_engine)
    return _engine


def set_engine(engine) -> None:
    global _engine
    _engine = engine
    SessionLocal.configure(bind=engine)


def get_db() -> Iterator[Session]:
    get_engine()
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    """Create extensions, tables, then apply post-schema SQL (FTS column, vector index, views)."""
    from . import models  # noqa: F401  (register tables)

    engine = get_engine()
    with engine.begin() as conn:
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
    Base.metadata.create_all(engine)
    sql = (BASE_DIR / "sql" / "post_schema.sql").read_text()
    with engine.begin() as conn:
        conn.exec_driver_sql(sql)
