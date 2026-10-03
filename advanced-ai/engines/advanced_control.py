from __future__ import annotations

import os
import subprocess
import tempfile
from pathlib import Path

import numpy as np
from PIL import Image

from phase7.runtime_manager import ensure_runtime, phase7_env


ROOT = Path(__file__).resolve().parents[1]
WORKER = ROOT / "phase7" / "worker.py"


def _to_png(src: Path, input_format: str, width: int, height: int, work: Path) -> Path:
    if input_format == "png":
        return src
    raw = np.fromfile(src, dtype="<u2")
    expected = width * height * 3
    if raw.size != expected:
        raise RuntimeError("RGB16 de control avanzado incompleto.")
    arr16 = raw.reshape(height, width, 3)
    arr8 = np.clip((arr16.astype(np.uint32) + 128) // 257, 0, 255).astype(np.uint8)
    path = work / "phase7-source.png"
    Image.fromarray(arr8, "RGB").save(path, "PNG")
    return path


class AdvancedControlEngine:
    """Puente aislado hacia PuLID-FLUX, IP-Adapter y FLUX ControlNet."""

    def release(self) -> None:
        # El trabajo vive en un subproceso aislado; al terminar no deja pesos
        # residentes en la VRAM del proceso principal.
        return

    def run(
        self, job, src: Path, out: Path, *,
        task: str,
        reference: Path | None,
        input_format: str,
        width: int,
        height: int,
        prompt: str,
        negative_prompt: str = "",
        steps: int = 28,
        guidance: float = 4.0,
        seed: int = 0,
        identity_weight: float = 1.0,
        start_step: int = 2,
        reference_weight: float = 0.8,
        control_mode: str = "depth",
        control_strength: float = 0.6,
        max_side: int = 1024,
    ) -> Path:
        if task not in ("identity", "reference", "control"):
            raise RuntimeError("Tarea avanzada no válida.")
        if task in ("identity", "reference") and reference is None:
            raise RuntimeError("Esta tarea necesita una imagen de referencia.")

        job.set_progress(0.01, "Preparando Fase 7")
        py = ensure_runtime(job)

        work = out.parent
        source_png = _to_png(src, input_format, width, height, work)
        result_png = work / "phase7-result.png"
        meta = work / "phase7-meta.txt"

        cmd = [
            str(py), str(WORKER),
            "--task", task,
            "--image", str(source_png),
            "--output", str(result_png),
            "--meta", str(meta),
            "--prompt", prompt,
            "--negative-prompt", negative_prompt,
            "--steps", str(int(steps)),
            "--guidance", str(float(guidance)),
            "--seed", str(int(seed)),
            "--max-side", str(int(max_side)),
            "--identity-weight", str(float(identity_weight)),
            "--start-step", str(int(start_step)),
            "--reference-weight", str(float(reference_weight)),
            "--control-mode", control_mode,
            "--control-strength", str(float(control_strength)),
        ]
        if reference is not None:
            cmd.extend(["--reference", str(reference)])

        proc = subprocess.Popen(
            cmd,
            cwd=str(ROOT / "phase7"),
            env=phase7_env(),
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1,
        )

        try:
            assert proc.stdout is not None
            while True:
                if job.cancelled:
                    proc.terminate()
                    try:
                        proc.wait(timeout=5)
                    except subprocess.TimeoutExpired:
                        proc.kill()
                    raise RuntimeError("Cancelado")

                line = proc.stdout.readline()
                if line:
                    line = line.strip()
                    if line.startswith("PROGRESS|"):
                        try:
                            _, value, stage = line.split("|", 2)
                            # Reserva un pequeño tramo inicial al bootstrap.
                            p = 0.06 + float(value) * 0.90
                            job.set_progress(p, stage)
                        except Exception:
                            pass

                code = proc.poll()
                if code is not None:
                    # Vacía cualquier salida restante.
                    for tail in proc.stdout:
                        tail = tail.strip()
                        if tail.startswith("PROGRESS|"):
                            try:
                                _, value, stage = tail.split("|", 2)
                                job.set_progress(0.06 + float(value) * 0.90, stage)
                            except Exception:
                                pass
                    if code != 0:
                        raise RuntimeError("El motor avanzado terminó con error. Revisa la instalación de Fase 7.")
                    break
        finally:
            if proc.poll() is None:
                proc.kill()

        if not result_png.is_file():
            raise RuntimeError("El motor avanzado no produjo resultado.")

        image = Image.open(result_png).convert("RGB")
        if image.size != (width, height):
            image = image.resize((width, height), Image.Resampling.LANCZOS)
        arr16 = np.asarray(image, dtype=np.uint16) * 257
        arr16.astype("<u2", copy=False).tofile(out)

        used_seed = seed
        try:
            used_seed = int(meta.read_text(encoding="utf-8").strip())
        except Exception:
            pass

        job.meta.update({
            "width": width,
            "height": height,
            "channels": 3,
            "dtype": "uint16le",
            "inputPrecision": 16 if input_format == "raw16" else 8,
            "model": {
                "identity": "PuLID-FLUX-v0.9.1 + FLUX.1-dev FP8",
                "reference": "FLUX.1-dev NF4 + XLabs IP-Adapter",
                "control": "FLUX.1-dev NF4 + ControlNet Union Pro 2.0",
            }[task],
            "task": "advanced-" + task,
            "seed": used_seed,
            "controlMode": control_mode if task == "control" else None,
        })
        job.set_progress(0.98, "Resultado avanzado preparado")
        return out
