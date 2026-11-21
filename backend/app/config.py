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
    gemini_fast_model: str = "gemini-3.5-flash-lite"
    gemini_max_concurrency: int = 2  # simultaneous Gemini calls (raise on paid plans)
    llm_max_backoff_s: float = 45.0
    # Optional per-tier override "provider:model", e.g. LLM_FAST=anthropic:claude-haiku-5-5, LLM_SMART=gemini:gemini-3.5-flash
    llm_fast: str | None = None  # interactive: Sam (tutor) via Nova
    llm_smart: str | None = None  # background generation: Clara, Quinn, Alex, Sage, Max, Riley
    llm_timeout_s: float = 180.0
    llm_prices: str | None = None  # JSON price overrides per model (USD / 1M tokens), see app/llm/pricing.py
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

    def tier(self, tier: str) -> tuple[str, str]:
        """Resolve a tier ('fast' | 'smart') to (provider, model)."""
        explicit = self.llm_fast if tier == "fast" else self.llm_smart
        if explicit and ":" in explicit:
            prov, model = explicit.split(":", 1)
            return prov.strip(), model.strip()
        prov = self.active_provider
        if prov == "gemini":
            return prov, self.gemini_fast_model if tier == "fast" else self.gemini_model
        if prov == "anthropic":
            return prov, self.llm_model
        return "demo", "demo-fixtures"

    @property
    def demo_mode(self) -> bool:
        return self.tier("smart")[0] == "demo" and self.tier("fast")[0] == "demo"


@lru_cache
def get_settings() -> Settings:
    return Settings()
