from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MODULO = ROOT / "agente-nfp-robo" / "instalador_exe.py"


def _carregar_instalador():
    spec = spec_from_file_location("instalador_exe_agente_nfp", MODULO)
    modulo = module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(modulo)
    return modulo


def test_rejeita_atalho_python_da_microsoft_store():
    modulo = _carregar_instalador()
    stub = Path(r"C:\Users\Apolo\AppData\Local\Microsoft\WindowsApps\python.EXE")
    real = Path(r"C:\Users\Apolo\AppData\Local\Programs\Python\Python312\python.exe")
    assert modulo._eh_python_store_stub(stub)
    assert not modulo._eh_python_store_stub(real)
