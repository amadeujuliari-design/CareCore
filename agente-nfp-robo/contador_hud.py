#!/usr/bin/env python3
"""HUD flutuante — contador de envios NFP (sempre no topo, arrastavel).

Uso: python contador_hud.py
Atualiza a cada ~0,5s lendo robo/_capturas/contador_vivo.json
"""

from __future__ import annotations

import sys
import tkinter as tk
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT / "robo"))

from contador_estado import ler  # noqa: E402


class ContadorHud:
    def __init__(self) -> None:
        self.root = tk.Tk()
        self.root.title("CareCore NFP · Contador")
        self.root.attributes("-topmost", True)
        self.root.resizable(False, False)
        # Janela compacta, tipicamente sobre o Chrome da Fazenda
        self.root.geometry("+80+80")

        self.bg = "#0f172a"
        self.fg = "#e2e8f0"
        self.muted = "#94a3b8"
        self.ok = "#34d399"
        self.warn = "#fbbf24"
        self.err = "#f87171"
        self.root.configure(bg=self.bg)

        pad = {"padx": 12, "pady": 2}
        self.lbl_titulo = tk.Label(
            self.root,
            text="NFP · Contador ao vivo",
            font=("Segoe UI", 11, "bold"),
            bg=self.bg,
            fg="#38bdf8",
        )
        self.lbl_titulo.pack(anchor="w", padx=12, pady=(10, 4))

        self.lbl_status = tk.Label(
            self.root, text="Aguardando…", font=("Segoe UI", 9), bg=self.bg, fg=self.muted
        )
        self.lbl_status.pack(anchor="w", **pad)

        self.vars: dict[str, tk.StringVar] = {}
        linhas = [
            ("enviados", "Enviados (ok)", self.ok),
            ("novos", "  · novos", self.fg),
            ("ja_existe", "  · já existiam", self.fg),
            ("prazo", "Fora do prazo", self.warn),
            ("erros", "Outros erros", self.err),
            ("inconclusivo", "Inconclusivos", self.muted),
            ("total", "Total processados", "#f8fafc"),
        ]
        for key, titulo, cor in linhas:
            row = tk.Frame(self.root, bg=self.bg)
            row.pack(fill="x", padx=12, pady=1)
            tk.Label(
                row, text=titulo, font=("Segoe UI", 9), bg=self.bg, fg=self.muted, width=18, anchor="w"
            ).pack(side="left")
            var = tk.StringVar(value="0")
            self.vars[key] = var
            tk.Label(
                row, textvariable=var, font=("Segoe UI", 11, "bold"), bg=self.bg, fg=cor, anchor="e"
            ).pack(side="right")

        self.lbl_ultimo = tk.Label(
            self.root,
            text="Último: —",
            font=("Segoe UI", 8),
            bg=self.bg,
            fg=self.muted,
            wraplength=280,
            justify="left",
            anchor="w",
        )
        self.lbl_ultimo.pack(anchor="w", padx=12, pady=(8, 4))

        self.lbl_hora = tk.Label(
            self.root, text="", font=("Segoe UI", 8), bg=self.bg, fg="#64748b"
        )
        self.lbl_hora.pack(anchor="w", padx=12, pady=(0, 10))

        # Arrastar pela area do titulo (alem da barra nativa)
        self.lbl_titulo.bind("<ButtonPress-1>", self._start_move)
        self.lbl_titulo.bind("<B1-Motion>", self._on_move)
        self._ox = 0
        self._oy = 0

        self.root.after(200, self._tick)

    def _start_move(self, event: Any) -> None:
        self._ox = event.x
        self._oy = event.y

    def _on_move(self, event: Any) -> None:
        x = self.root.winfo_x() + event.x - self._ox
        y = self.root.winfo_y() + event.y - self._oy
        self.root.geometry(f"+{x}+{y}")

    def _tick(self) -> None:
        try:
            self._atualizar()
        except Exception:
            pass
        self.root.after(500, self._tick)

    def _atualizar(self) -> None:
        e = ler()
        pt = e.get("por_tipo") or {}
        ps = e.get("por_status") or {}
        sucesso = int(pt.get("sucesso") or 0)
        ja = int(pt.get("ja_existe") or 0)
        enviados = int(ps.get("enviado") or (sucesso + ja))
        prazo = int(ps.get("rejeitado_prazo") or 0)
        # erros "outros": status erro, sem contar prazo
        erros_status = int(ps.get("erro") or 0)
        inconclusivo = int(pt.get("inconclusivo") or 0) + int(ps.get("pendente") or 0)
        # pendente inclui inconclusivo; evita double-count visual — preferir tipo
        inconclusivo = int(pt.get("inconclusivo") or 0)
        sessao = int(pt.get("sessao_caiu") or 0)
        bloqueio = int(pt.get("bloqueio_sefaz") or 0)
        outros_err = erros_status + sessao + bloqueio

        self.vars["enviados"].set(str(enviados))
        self.vars["novos"].set(str(sucesso))
        self.vars["ja_existe"].set(str(ja))
        self.vars["prazo"].set(str(prazo))
        self.vars["erros"].set(str(outros_err))
        self.vars["inconclusivo"].set(str(inconclusivo))
        self.vars["total"].set(str(int(e.get("total") or 0)))

        ativo = bool(e.get("ativo"))
        self.lbl_status.config(
            text=("● Enviando…" if ativo else "○ Parado / aguardando"),
            fg=(self.ok if ativo else self.muted),
        )
        ult = e.get("ultimo") or {}
        if ult:
            chave = (ult.get("chave") or "")[:12]
            tip = ult.get("tipo") or "?"
            msg = (ult.get("mensagem") or "")[:80]
            self.lbl_ultimo.config(text=f"Último: {tip} · {chave}…\n{msg}")
        else:
            self.lbl_ultimo.config(text="Último: —")
        self.lbl_hora.config(text=f"Atualizado: {e.get('atualizado_em') or '—'}")

    def run(self) -> None:
        self.root.mainloop()


def main() -> int:
    ContadorHud().run()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
