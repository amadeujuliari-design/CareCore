import logging
import os

from config_utils import env_float

try:
    import sentry_sdk
except ImportError:  # pragma: no cover - sentry é opcional em desenvolvimento local.
    sentry_sdk = None


logger = logging.getLogger("carecore.observability")


def configurar_observabilidade_carecore() -> bool:
    dsn = os.getenv("CARECORE_SENTRY_DSN", "").strip()
    if not dsn:
        return False

    if sentry_sdk is None:
        logger.warning("CARECORE_SENTRY_DSN definido, mas sentry-sdk não está instalado.")
        return False

    app_env = os.getenv("APP_ENV", "local").strip().lower()
    traces_sample_rate = env_float(
        "CARECORE_SENTRY_TRACES_SAMPLE_RATE",
        0.0,
        minimo=0.0,
        maximo=1.0,
    )

    sentry_sdk.init(
        dsn=dsn,
        environment=app_env,
        traces_sample_rate=traces_sample_rate,
        send_default_pii=False,
    )
    logger.info(
        "Observabilidade Sentry ativada",
        extra={
            "observability_provider": "sentry",
            "environment": app_env,
            "traces_sample_rate": traces_sample_rate,
        },
    )
    return True
