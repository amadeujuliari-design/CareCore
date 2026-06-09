from pathlib import Path
import os

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base


def carregar_env_local() -> None:
    """
    Carrega variáveis do arquivo .env sem depender de biblioteca externa.

    Isso mantém o projeto funcionando localmente agora e permite trocar
    DATABASE_URL/SECRET_KEY no futuro quando subir para nuvem.
    """
    env_path = Path(__file__).resolve().parent / ".env"

    if not env_path.exists():
        return

    for linha in env_path.read_text(encoding="utf-8").splitlines():
        linha = linha.strip()

        if not linha or linha.startswith("#") or "=" not in linha:
            continue

        chave, valor = linha.split("=", 1)
        chave = chave.strip()
        valor = valor.strip().strip('"').strip("'")

        os.environ.setdefault(chave, valor)


carregar_env_local()

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "sqlite+aiosqlite:///./carecore_local.db"
)

if DATABASE_URL.startswith("postgresql+psycopg2://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql+psycopg2://", "postgresql+asyncpg://", 1)
elif DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://", 1)

engine_kwargs = {
    "echo": os.getenv("SQLALCHEMY_ECHO", "false").lower() == "true",
}

if DATABASE_URL.startswith("postgresql+asyncpg://"):
    engine_kwargs.update(
        {
            "pool_size": int(os.getenv("SQLALCHEMY_POOL_SIZE", "8")),
            "max_overflow": int(os.getenv("SQLALCHEMY_MAX_OVERFLOW", "2")),
            "pool_timeout": int(os.getenv("SQLALCHEMY_POOL_TIMEOUT", "15")),
            "pool_recycle": int(os.getenv("SQLALCHEMY_POOL_RECYCLE", "1800")),
            "pool_pre_ping": True,
            "connect_args": {
                "statement_cache_size": int(os.getenv("SQLALCHEMY_STATEMENT_CACHE_SIZE", "0")),
            },
        }
    )

engine = create_async_engine(DATABASE_URL, **engine_kwargs)

AsyncSessionLocal = async_sessionmaker(
    engine,
    expire_on_commit=False
)

Base = declarative_base()


async def get_db():
    async with AsyncSessionLocal() as session:
        yield session
