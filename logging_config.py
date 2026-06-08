import json
import logging
import os
import sys
from datetime import datetime, timezone
from typing import Any


CARECORE_LOGGER_NAME = "carecore"
_HANDLER_NAME = "carecore_stream_handler"


def _valor_json(valor: Any) -> Any:
    if isinstance(valor, (str, int, float, bool)) or valor is None:
        return valor

    if isinstance(valor, dict):
        return {str(chave): _valor_json(item) for chave, item in valor.items()}

    if isinstance(valor, (list, tuple, set)):
        return [_valor_json(item) for item in valor]

    return str(valor)


class CareCoreJsonFormatter(logging.Formatter):
    campos_extras = (
        "audit_event",
        "audit_context",
        "request_id",
        "path",
        "method",
        "status_code",
        "duration_ms",
    )

    def format(self, record: logging.LogRecord) -> str:
        payload = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }

        for campo in self.campos_extras:
            if hasattr(record, campo):
                payload[campo] = _valor_json(getattr(record, campo))

        if record.exc_info:
            payload["exception"] = self.formatException(record.exc_info)

        return json.dumps(payload, ensure_ascii=False, separators=(",", ":"))


class CareCoreTextFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        mensagem = super().format(record)
        extras = []

        for campo in CareCoreJsonFormatter.campos_extras:
            if hasattr(record, campo):
                extras.append(f"{campo}={_valor_json(getattr(record, campo))}")

        if extras:
            mensagem = f"{mensagem} {' '.join(extras)}"

        return mensagem


def _criar_formatter(formato: str) -> logging.Formatter:
    if formato == "json":
        return CareCoreJsonFormatter()

    return CareCoreTextFormatter("%(asctime)s %(levelname)s [%(name)s] %(message)s")


def configurar_logging_carecore() -> None:
    app_env = os.getenv("APP_ENV", "local").strip().lower()
    formato_padrao = "json" if app_env in {"production", "prod"} else "text"
    formato = os.getenv("CARECORE_LOG_FORMAT", formato_padrao).strip().lower()
    nivel = os.getenv("CARECORE_LOG_LEVEL", "INFO").strip().upper()

    logger = logging.getLogger(CARECORE_LOGGER_NAME)
    logger.setLevel(getattr(logging, nivel, logging.INFO))

    formatter = _criar_formatter(formato)
    handler_existente = next(
        (handler for handler in logger.handlers if handler.get_name() == _HANDLER_NAME),
        None,
    )

    if handler_existente is None:
        handler_existente = logging.StreamHandler(sys.stdout)
        handler_existente.set_name(_HANDLER_NAME)
        logger.addHandler(handler_existente)

    handler_existente.setFormatter(formatter)
    handler_existente.setLevel(getattr(logging, nivel, logging.INFO))
