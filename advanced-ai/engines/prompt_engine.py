from __future__ import annotations

import json
import re
from typing import Any

import torch
from transformers import AutoModelForCausalLM, AutoTokenizer

from pathlib import Path
import sys

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

SYSTEM = """You are a photo-editing command parser.
Return ONLY valid compact JSON, never markdown.
Allowed schema:
{"adjustments":{"exposure":0,"brightness":0,"contrast":0,"highlights":0,"shadows":0,"whites":0,"blacks":0,"temperature":0,"tint":0,"saturation":0,"vibrance":0,"clarity":0,"texture":0,"dehaze":0,"sharpen":0},"summary":"short Spanish summary","unsupported":[]}
Rules:
- Only include adjustments explicitly or clearly implied by the user's editing request.
- Values are signed strengths. exposure is EV from -5 to 5. All others are -100..100 except sharpen 0..100.
- Keep changes conservative unless the user explicitly asks for strong/extreme changes.
- If the request asks for generative edits, object insertion/removal, background replacement, hair color change, sky replacement, identity/pose changes, or anything outside these numeric photo adjustments, put a short Spanish description in unsupported and do not invent a numeric substitute for that request.
- You may combine supported numeric edits with unsupported generative requests in the same JSON.
"""

class PromptEngine:
    def __init__(self) -> None:
        self.model_id = "qwen2.5-1.5b-instruct"
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
        model = AutoModelForCausalLM.from_pretrained(
            str(path),
            local_files_only=True,
            torch_dtype=torch.float16 if torch.cuda.is_available() else torch.float32,
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
        if text.startswith("{") and text.endswith("}"):
            return json.loads(text)
        m = re.search(r"{.*}", text, flags=re.S)
        if not m:
            raise RuntimeError("El modelo no devolvió JSON.")
        return json.loads(m.group(0))

    @staticmethod
    def _validate(data: dict[str, Any]) -> dict[str, Any]:
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
            lo, hi = ALLOWED[key]
            num = max(lo, min(hi, num))
            if abs(num) >= 1e-6:
                clean[key] = round(num, 3)

        unsupported = data.get("unsupported")
        if not isinstance(unsupported, list):
            unsupported = []
        unsupported = [str(x)[:180] for x in unsupported if str(x).strip()][:8]

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

        tok, model = self._load()
        messages = [
            {"role":"system","content":SYSTEM},
            {"role":"user","content":prompt},
        ]
        text = tok.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
        inputs = tok(text, return_tensors="pt")
        if torch.cuda.is_available():
            inputs = {k:v.to("cuda:0") for k,v in inputs.items()}

        with torch.inference_mode():
            out = model.generate(
                **inputs,
                max_new_tokens=280,
                do_sample=False,
                temperature=None,
                top_p=None,
                pad_token_id=tok.eos_token_id,
            )
        generated = out[0][inputs["input_ids"].shape[-1]:]
        decoded = tok.decode(generated, skip_special_tokens=True)
        data = self._extract_json(decoded)
        return self._validate(data)


ENGINE = PromptEngine()
