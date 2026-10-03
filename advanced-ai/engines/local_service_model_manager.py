"""Acceso estable al ModelManager desde engines/."""
import importlib.util
from pathlib import Path

_path = Path(__file__).resolve().parents[1] / "local-service" / "model_manager.py"
_spec = importlib.util.spec_from_file_location("realify_model_manager", _path)
_mod = importlib.util.module_from_spec(_spec)
assert _spec and _spec.loader
_spec.loader.exec_module(_mod)
ModelManager = _mod.ModelManager
