from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path
from types import SimpleNamespace

import numpy as np
from PIL import Image


ROOT = Path(os.environ["REALIFY_PHASE7_ROOT"])
VENDOR = Path(os.environ["REALIFY_PULID_VENDOR"])
MODELS = ROOT / "models"


def progress(value: float, stage: str) -> None:
    print(f"PROGRESS|{max(0.0,min(1.0,value)):.4f}|{stage}", flush=True)


def fit_size(w: int, h: int, max_side: int = 1024) -> tuple[int, int]:
    k = min(1.0, max_side / max(w, h))
    tw = max(256, int(round(w * k / 16)) * 16)
    th = max(256, int(round(h * k / 16)) * 16)
    return tw, th


def task_identity(args) -> None:
    progress(.08, "Cargando PuLID-FLUX v0.9.1")
    sys.path.insert(0, str(VENDOR))
    runtime = MODELS / "identity" / "pulid-runtime"
    runtime.mkdir(parents=True, exist_ok=True)
    os.chdir(runtime)

    from app_flux import FluxGenerator

    opts = SimpleNamespace(
        fp8=True,
        onnx_provider="cpu",
        pretrained_model=None,
        version="v0.9.1",
        dev=False,
    )
    generator = FluxGenerator(
        "flux-dev", "cuda",
        offload=True,
        aggressive_offload=True,
        args=opts,
    )

    ref = Image.open(args.reference).convert("RGB")
    src = Image.open(args.image).convert("RGB")
    w, h = fit_size(src.width, src.height, args.max_side)

    progress(.32, "Extrayendo identidad facial")
    img, used_seed, _ = generator.generate_image(
        w, h,
        args.steps,
        args.start_step,
        args.guidance,
        args.seed,
        args.prompt,
        np.asarray(ref),
        args.identity_weight,
        args.negative_prompt,
        1.0,
        1,
        256,
    )
    progress(.91, "Recomponiendo identidad")
    img.resize(src.size, Image.Resampling.LANCZOS).save(args.output, "PNG")
    Path(args.meta).write_text(str(used_seed), encoding="utf-8")
    progress(1.0, "Identidad preservada")


def make_control(image: Image.Image, mode: str) -> Image.Image:
    if mode == "canny":
        import cv2
        arr = np.asarray(image.convert("RGB"))
        edges = cv2.Canny(arr, 100, 200)
        rgb = np.repeat(edges[..., None], 3, axis=2)
        return Image.fromarray(rgb)
    if mode == "depth":
        import torch
        from transformers import AutoImageProcessor, AutoModelForDepthEstimation
        repo = "depth-anything/Depth-Anything-V2-Large-hf"
        proc = AutoImageProcessor.from_pretrained(repo)
        model = AutoModelForDepthEstimation.from_pretrained(repo, torch_dtype=torch.float16).to("cuda").eval()
        inputs = proc(images=image, return_tensors="pt").to("cuda")
        with torch.inference_mode():
            pred = model(**inputs).predicted_depth
        pred = torch.nn.functional.interpolate(
            pred.unsqueeze(1), size=(image.height, image.width),
            mode="bicubic", align_corners=False,
        ).squeeze().float().cpu().numpy()
        pred = (pred - pred.min()) / max(1e-6, pred.max() - pred.min())
        gray = (pred * 255).astype(np.uint8)
        del model
        torch.cuda.empty_cache()
        return Image.fromarray(gray).convert("RGB")
    if mode == "pose":
        from controlnet_aux import OpenposeDetector
        det = OpenposeDetector.from_pretrained("lllyasviel/Annotators")
        return det(image, hand_and_face=True).convert("RGB")
    if mode == "softedge":
        from controlnet_aux import HEDdetector
        det = HEDdetector.from_pretrained("lllyasviel/Annotators")
        return det(image, safe=True).convert("RGB")
    raise ValueError("Modo de control desconocido.")


def task_control(args) -> None:
    import torch
    from diffusers import FluxControlNetModel, FluxControlNetPipeline

    src = Image.open(args.image).convert("RGB")
    w, h = fit_size(src.width, src.height, args.max_side)
    resized = src.resize((w, h), Image.Resampling.LANCZOS)

    progress(.10, f"Calculando control {args.control_mode}")
    control = make_control(resized, args.control_mode)

    progress(.26, "Cargando ControlNet Union Pro 2.0")
    controlnet = FluxControlNetModel.from_pretrained(
        "Shakker-Labs/FLUX.1-dev-ControlNet-Union-Pro-2.0",
        torch_dtype=torch.bfloat16,
    )
    pipe = FluxControlNetPipeline.from_pretrained(
        "diffusers/FLUX.1-dev-bnb-4bit",
        controlnet=controlnet,
        torch_dtype=torch.bfloat16,
    )
    pipe.enable_model_cpu_offload()
    pipe.vae.enable_slicing()
    pipe.vae.enable_tiling()

    progress(.42, "Generando con control estructural")
    out = pipe(
        prompt=args.prompt,
        control_image=control,
        controlnet_conditioning_scale=args.control_strength,
        width=w,
        height=h,
        guidance_scale=args.guidance,
        num_inference_steps=args.steps,
        max_sequence_length=256,
        generator=torch.Generator(device="cpu").manual_seed(args.seed),
    ).images[0]
    progress(.92, "Recomponiendo escena controlada")
    out.resize(src.size, Image.Resampling.LANCZOS).save(args.output, "PNG")
    Path(args.meta).write_text(str(args.seed), encoding="utf-8")
    progress(1.0, "Control estructural terminado")


def task_reference(args) -> None:
    import torch
    from diffusers import FluxPipeline

    src = Image.open(args.image).convert("RGB")
    ref = Image.open(args.reference).convert("RGB")
    w, h = fit_size(src.width, src.height, args.max_side)

    progress(.15, "Cargando FLUX IP-Adapter")
    pipe = FluxPipeline.from_pretrained(
        "diffusers/FLUX.1-dev-bnb-4bit",
        torch_dtype=torch.bfloat16,
    )
    pipe.load_ip_adapter(
        "XLabs-AI/flux-ip-adapter",
        weight_name="ip_adapter.safetensors",
        image_encoder_pretrained_model_name_or_path="openai/clip-vit-large-patch14",
    )
    pipe.set_ip_adapter_scale(args.reference_weight)
    pipe.enable_model_cpu_offload()
    pipe.vae.enable_slicing()
    pipe.vae.enable_tiling()

    progress(.38, "Generando desde referencia visual")
    out = pipe(
        prompt=args.prompt,
        ip_adapter_image=ref.resize((w, h), Image.Resampling.LANCZOS),
        width=w,
        height=h,
        guidance_scale=args.guidance,
        num_inference_steps=args.steps,
        max_sequence_length=256,
        generator=torch.Generator(device="cpu").manual_seed(args.seed),
    ).images[0]
    progress(.92, "Recomponiendo referencia visual")
    out.resize(src.size, Image.Resampling.LANCZOS).save(args.output, "PNG")
    Path(args.meta).write_text(str(args.seed), encoding="utf-8")
    progress(1.0, "Referencia visual terminada")


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--task", choices=["identity", "control", "reference"], required=True)
    p.add_argument("--image", required=True)
    p.add_argument("--reference")
    p.add_argument("--output", required=True)
    p.add_argument("--meta", required=True)
    p.add_argument("--prompt", required=True)
    p.add_argument("--negative-prompt", default="bad quality, worst quality, text, signature, watermark, extra limbs")
    p.add_argument("--steps", type=int, default=28)
    p.add_argument("--guidance", type=float, default=4.0)
    p.add_argument("--seed", type=int, default=0)
    p.add_argument("--max-side", type=int, default=1024)
    p.add_argument("--identity-weight", type=float, default=1.0)
    p.add_argument("--start-step", type=int, default=2)
    p.add_argument("--reference-weight", type=float, default=0.8)
    p.add_argument("--control-mode", choices=["canny", "softedge", "depth", "pose"], default="depth")
    p.add_argument("--control-strength", type=float, default=0.6)
    args = p.parse_args()

    if args.task in ("identity", "reference") and not args.reference:
        raise SystemExit("Se necesita imagen de referencia.")

    if args.task == "identity":
        task_identity(args)
    elif args.task == "reference":
        task_reference(args)
    else:
        task_control(args)


if __name__ == "__main__":
    main()
