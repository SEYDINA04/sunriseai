from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    TELEGRAM_BOT_TOKEN: str
    DATABASE_URL: str
    REDIS_URL: str
    # Public HTTPS URL for the Telegram webhook, e.g. https://yourdomain.com
    # Leave empty to skip webhook registration (useful during local dev with polling override)
    WEBHOOK_BASE_URL: str
    MOCK_MODE: bool
    TEEKI_BASE_URL: str
    AUDIO_DIR: str
    OPENAI_API_KEY: str = ""  # optional: empty string disables TTS voice replies


settings = Settings()
