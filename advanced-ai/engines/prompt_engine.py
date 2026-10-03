from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any
import sys

import torch
from transformers import AutoModelForCausalLM, AutoTokenizer

ROOT = Path(__file__).resolve().parents[1]
LOCAL_SERVICE = ROOT / "local-service"
if str(LOCAL_SERVICE) not in sys.path:
    sys.path.insert(0, str(LOCAL_SERVICE))

from model_manager import ModelManager  # noqa: E402

_MANAGER = ModelManager()

ALLOWED = {
    "exposure": (-5.0, 5.0),
    "brightness": (-100.0, 100.0),
    "contrast": (-100.0, 100.0),
    "highlights": (-100.0, 100.0),
    "shadows": (-100.0, 100.0),
    "whites": (-100.0, 100.0),
    "blacks": (-100.0, 100.0),
    "temperature": (-100.0, 100.0),
    "tint": (-100.0, 100.0),
    "saturation": (-100.0, 100.0),
    "vibrance": (-100.0, 100.0),
    "clarity": (-100.0, 100.0),
    "texture": (-100.0, 100.0),
    "dehaze": (-100.0, 100.0),
    "sharpen": (0.0, 100.0),
}

SYSTEM = """Eres un intérprete de instrucciones para un editor fotográfico.
Devuelve SOLO JSON válido y compacto. Nunca markdown, explicaciones ni texto fuera del JSON.

Esquema permitido:
{"adjustments":{"exposure":0,"brightness":0,"contrast":0,"highlights":0,"shadows":0,"whites":0,"blacks":0,"temperature":0,"tint":0,"saturation":0,"vibrance":0,"clarity":0,"texture":0,"dehaze":0,"sharpen":0},"summary":"resumen breve en español","unsupported":[]}

Reglas:
- Incluye únicamente ajustes explícitos o claramente implicados por el usuario.
- exposure está en EV: -5..5.
- El resto usa -100..100, excepto sharpen: 0..100.
- Sé conservador salvo que el usuario pida un cambio fuerte o extremo.
- No inventes herramientas ni comandos.
- Si el usuario pide cambios generativos, insertar/eliminar objetos, sustituir fondo o cielo, cambiar color de pelo, ropa, identidad, pose, escenario o cualquier acción fuera de los ajustes numéricos permitidos, añade una descripción breve en español a unsupported y NO intentes simularla con ajustes numéricos.
- Puedes devolver a la vez ajustes compatibles y peticiones no compatibles.
- Si el usuario no solicita ningún ajuste compatible, adjustments debe quedar vacío.
"""


class PromptEngine:
    def __init__(self) -> None:
        self.model_id = "qwen3-1.7b"
        self._tokenizer = None
        self._model = None

    def release(self) -> None:
        self._model = None
        self._tokenizer = None
        if torch.cuda.is_available():
            torch.cuda.empty_cache()

    def _load(self):
        if self._model is not None and self._tokenizer is not None:
            return self._tokenizer, self._model

        path = _MANAGER.ensure(self.model_id)
        tok = AutoTokenizer.from_pretrained(str(path), local_files_only=True)

        if torch.cuda.is_available():
            props = torch.cuda.get_device_properties(0)
            major, _ = torch.cuda.get_device_capability(0)
            dtype = torch.bfloat16 if major >= 8 else torch.float16
        else:
            dtype = torch.float32

        model = AutoModelForCausalLM.from_pretrained(
            str(path),
            local_files_only=True,
            torch_dtype=dtype,
            low_cpu_mem_usage=True,
        )
        model.eval()
        if torch.cuda.is_available():
            model.to("cuda:0")

        self._tokenizer, self._model = tok, model
        return tok, model

    @staticmethod
    def _extract_json(text: str) -> dict[str, Any]:
        text = text.strip()

        # Qwen3 puede envolver una respuesta en bloques de razonamiento si
        # el chat template del modelo cambia. Se descartan de forma segura.
        text = re.sub(r"<think>.*?</think>", "", text, flags=re.S | re.I).strip()

        if text.startswith("{") and text.endswith("}"):
            return json.loads(text)

        start = text.find("{")
        end = text.rfind("}")
        if start < 0 or end <= start:
            raise RuntimeError("El modelo no devolvió JSON.")
        return json.loads(text[start:end + 1])

    @staticmethod
    def _validate(data: dict[str, Any]) -> dict[str, Any]:
        if not isinstance(data, dict):
            raise RuntimeError("La respuesta del modelo no es un objeto JSON.")

        raw = data.get("adjustments")
        if not isinstance(raw, dict):
            raw = {}

        clean: dict[str, float] = {}
        for key, value in raw.items():
            if key not in ALLOWED:
                continue
            try:
                num = float(value)
            except (TypeError, ValueError):
                continue
            if not torch.isfinite(torch.tensor(num)).item():
                continue
            lo, hi = ALLOWED[key]
            num = max(lo, min(hi, num))
            if abs(num) >= 1e-6:
                clean[key] = round(num, 3)

        unsupported = data.get("unsupported")
        if not isinstance(unsupported, list):
            unsupported = []
        unsupported = [str(x).strip()[:180] for x in unsupported if str(x).strip()][:8]

        summary = str(data.get("summary") or "").strip()[:240]
        return {
            "adjustments": clean,
            "summary": summary,
            "unsupported": unsupported,
        }

    def parse(self, prompt: str) -> dict[str, Any]:
        prompt = str(prompt or "").strip()
        if not prompt:
            raise ValueError("El prompt está vacío.")
        if len(prompt) > 2000:
            raise ValueError("El prompt es demasiado largo.")

        tok, model = self._load()
        messages = [
            {"role": "system", "content": SYSTEM},
            {"role": "user", "content": prompt},
        ]

        # Qwen3 admite modo no-thinking; se usa para conseguir una salida
        # corta, determinista y fácil de validar. Hay fallback por si una
        # versión futura del tokenizer no acepta este argumento.
        try:
            text = tok.apply_chat_template(
                messages,
                tokenize=False,
                add_generation_prompt=True,
                enable_thinking=False,
            )
        except TypeError:
            text = tok.apply_chat_template(
                messages,
                tokenize=False,
                add_generation_prompt=True,
            )

        inputs = tok(text, return_tensors="pt")
        if torch.cuda.is_available():
            inputs = {k: v.to("cuda:0") for k, v in inputs.items()}

        with torch.inference_mode():
            out = model.generate(
                **inputs,
                max_new_tokens=320,
                do_sample=False,
                use_cache=True,
                pad_token_id=tok.eos_token_id,
                eos_token_id=tok.eos_token_id,
            )

        generated = out[0][inputs["input_ids"].shape[-1]:]
        decoded = tok.decode(generated, skip_special_tokens=True)
        return self._validate(self._extract_json(decoded))


ENGINE = PromptEngine()
