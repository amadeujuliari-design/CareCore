"""Diálogo nativo de seleção de pasta (Windows, ambiente local)."""

from __future__ import annotations

import sys


def escolher_pasta_windows(titulo: str = "Selecione uma pasta") -> str | None:
    if sys.platform != "win32":
        raise RuntimeError(
            "Seletor de pastas do Explorer disponível apenas no Windows local."
        )

    import tkinter as tk
    from tkinter import filedialog

    root = tk.Tk()
    root.withdraw()
    root.attributes("-topmost", True)
    root.update_idletasks()
    root.update()

    try:
        caminho = filedialog.askdirectory(title=titulo, mustexist=True)
    finally:
        root.destroy()

    if not caminho:
        return None
    return str(caminho)
