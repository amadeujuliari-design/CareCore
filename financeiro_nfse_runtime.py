"""Loop asyncio dedicado ao Playwright (evita asyncio.run múltiplo)."""

from __future__ import annotations

import asyncio
import threading
from collections.abc import Coroutine
from typing import Any, TypeVar

T = TypeVar("T")

_loop: asyncio.AbstractEventLoop | None = None
_loop_thread: threading.Thread | None = None
_loop_ready = threading.Event()
_lock = threading.Lock()


def _iniciar_loop() -> asyncio.AbstractEventLoop:
    global _loop, _loop_thread

    with _lock:
        if _loop is not None and _loop_thread and _loop_thread.is_alive():
            return _loop

        _loop_ready.clear()

        def _runner() -> None:
            global _loop
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            _loop = loop
            _loop_ready.set()
            loop.run_forever()

        _loop_thread = threading.Thread(
            target=_runner,
            name="carecore-nfse-playwright",
            daemon=True,
        )
        _loop_thread.start()

    _loop_ready.wait(timeout=30)
    if _loop is None:
        raise RuntimeError("Não foi possível iniciar o loop do Playwright.")
    return _loop


def executar_no_loop(coro: Coroutine[Any, Any, T], *, timeout: float | None = None) -> T:
    loop = _iniciar_loop()
    future = asyncio.run_coroutine_threadsafe(coro, loop)
    return future.result(timeout=timeout)


def agendar_no_loop(coro: Coroutine[Any, Any, T]) -> asyncio.Future:
    loop = _iniciar_loop()
    return asyncio.run_coroutine_threadsafe(coro, loop)
