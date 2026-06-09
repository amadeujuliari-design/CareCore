from logging.config import fileConfig

from sqlalchemy import engine_from_config
from sqlalchemy import pool

from alembic import context

# this is the Alembic Config object, which provides
# access to the values within the .ini file in use.
config = context.config

# Interpret the config file for Python logging.
# This line sets up loggers basically.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# add your model's MetaData object here
# for 'autogenerate' support
# from myapp import mymodel
# target_metadata = mymodel.Base.metadata
import os
import sys

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from database import Base
from models import *

target_metadata = Base.metadata

INDICES_MANUAIS_PERFORMANCE = {
    "ix_registros_rotina_sisa_periodo",
    "ix_registros_rotina_ultimo_movimento",
    "ix_conviventes_instituicao_status",
    "ix_conviventes_lista_resumo",
    "ix_sisa_lancamentos_instituicao_mes",
    "ix_sisa_importacoes_instituicao_data",
    "ix_instituicoes_organizacao",
    "ix_usuarios_organizacao",
    "ix_sisa_presencas_numero_data",
    "ix_sisa_divergencias_importacao_tipo",
    "ix_ocorrencias_dashboard",
    "ix_historico_legado_filtros",
    "ix_historico_legado_busca_nome",
    "ix_historico_legado_ordem",
    "ix_historicos_conviventes_lookup",
    "ix_quartos_instituicao",
    "ix_leitos_quarto_status",
    "ix_chat_participantes_usuario",
    "ix_chat_mensagens_conversa_data",
    "ix_chat_conversas_ordem",
}


def _database_url_para_alembic() -> str:
    """
    Alembic usa drivers síncronos, enquanto a aplicação usa SQLAlchemy async.
    Convertemos as URLs async mais comuns para suas equivalentes síncronas.
    """
    url = os.getenv("DATABASE_URL") or config.get_main_option("sqlalchemy.url")

    if url.startswith("sqlite+aiosqlite://"):
        url = url.replace("sqlite+aiosqlite://", "sqlite://", 1)
        return url

    if url.startswith("postgresql+asyncpg://"):
        url = url.replace("postgresql+asyncpg://", "postgresql://", 1)

    if url.startswith("postgresql"):
        url = url.replace("?ssl=require", "?sslmode=require")
        url = url.replace("&ssl=require", "&sslmode=require")

    return url


config.set_main_option("sqlalchemy.url", _database_url_para_alembic())


def _dialect_name() -> str:
    url = config.get_main_option("sqlalchemy.url")

    if url.startswith("sqlite"):
        return "sqlite"

    if url.startswith("postgresql"):
        return "postgresql"

    return ""


def include_object(objeto, nome, tipo, refletido, comparado):
    if tipo == "index" and nome in INDICES_MANUAIS_PERFORMANCE:
        return False

    if _dialect_name() == "sqlite" and tipo == "foreign_key_constraint":
        return False

    return True

# other values from the config, defined by the needs of env.py,
# can be acquired:
# my_important_option = config.get_main_option("my_important_option")
# ... etc.


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode.

    This configures the context with just a URL
    and not an Engine, though an Engine is acceptable
    here as well.  By skipping the Engine creation
    we don't even need a DBAPI to be available.

    Calls to context.execute() here emit the given string to the
    script output.

    """
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        include_object=include_object,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode.

    In this scenario we need to create an Engine
    and associate a connection with the context.

    """
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            include_object=include_object,
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
