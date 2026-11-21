from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=BASE_DIR / ".env", extra="ignore")

    database_url: str | None = None
    secret_key: str = "dev-only-secret-change-me-0123456789abcdef"
    signal_hmac_key: str = "dev-only-signal-key-change-me"
    teacher_invite_code: str = "demo-teacher-code"
    cookie_secure: bool = False
    session_hours: int = 72

    anthropic_api_key: str | None = None
    llm_provider: str = "auto"  # auto | anthropic | gemini | demo
    llm_model: str = "claude-opus-5-5"
    llm_effort: str = "medium"
    gemini_api_key: str | None = None
    gemini_model: str = "gemini-3.5-flash"
    gemini_fallback_models: str = "gemini-3.5-flash-lite"
    llm_timeout_s: float = 180.0
    corpus_max_tokens: int = 150_000

    embeddings_provider: str = "hash"
    embedding_dim: int = 384

    search_api_key: str | None = None

    storage_dir: Path = BASE_DIR / "storage"
    max_upload_mb: int = 15
    insight_min_cohort: int = 5
    cors_origins: str = "http://localhost:5173"

    @property
    def active_provider(self) -> str:
        """Explicit LLM_PROVIDER wins; 'auto' picks Claude if its key is set, else Gemini, else demo."""
        if self.llm_provider in ("anthropic", "gemini", "demo"):
            return self.llm_provider
        if self.anthropic_api_key:
            return "anthropic"
        if self.gemini_api_key:
            return "gemini"
        return "demo"

    @property
    def demo_mode(self) -> bool:
        return self.active_provider == "demo"


@lru_cache
def get_settings() -> Settings:
    return Settings()
