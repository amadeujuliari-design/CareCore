import json
import logging

from logging_config import (
    CARECORE_LOGGER_NAME,
    _HANDLER_NAME,
    CareCoreJsonFormatter,
    CareCoreTextFormatter,
    configurar_logging_carecore,
)


def test_json_formatter_inclui_campos_extras():
    record = logging.LogRecord(
        name="carecore.audit",
        level=logging.INFO,
        pathname=__file__,
        lineno=10,
        msg="evento_auditoria",
        args=(),
        exc_info=None,
    )
    record.audit_event = "login_sucesso"
    record.audit_context = {"usuario_id": "u1", "ator_global": False}
    record.duration_ms = 123.45

    payload = json.loads(CareCoreJsonFormatter().format(record))

    assert payload["level"] == "INFO"
    assert payload["logger"] == "carecore.audit"
    assert payload["message"] == "evento_auditoria"
    assert payload["audit_event"] == "login_sucesso"
    assert payload["audit_context"] == {"usuario_id": "u1", "ator_global": False}
    assert payload["duration_ms"] == 123.45


def test_text_formatter_inclui_campos_extras():
    record = logging.LogRecord(
        name="carecore.api",
        level=logging.WARNING,
        pathname=__file__,
        lineno=10,
        msg="Requisição lenta na API",
        args=(),
        exc_info=None,
    )
    record.request_id = "req-1"
    record.path = "/api/health"
    record.duration_ms = 2500.0

    texto = CareCoreTextFormatter("%(levelname)s %(message)s").format(record)

    assert "WARNING Requisição lenta na API" in texto
    assert "request_id=req-1" in texto
    assert "path=/api/health" in texto
    assert "duration_ms=2500.0" in texto


def test_configurar_logging_carecore_nao_duplica_handler(monkeypatch):
    monkeypatch.setenv("APP_ENV", "local")
    monkeypatch.setenv("CARECORE_LOG_FORMAT", "text")
    logger = logging.getLogger(CARECORE_LOGGER_NAME)
    handlers_originais = list(logger.handlers)

    try:
        logger.handlers = [
            handler for handler in logger.handlers
            if handler.get_name() != _HANDLER_NAME
        ]

        configurar_logging_carecore()
        configurar_logging_carecore()

        handlers_carecore = [
            handler for handler in logger.handlers
            if handler.get_name() == _HANDLER_NAME
        ]

        assert len(handlers_carecore) == 1
        assert isinstance(handlers_carecore[0].formatter, CareCoreTextFormatter)
    finally:
        logger.handlers = handlers_originais
