"""Local masked LaMa worker. Input/output paths are supplied by the admin server only."""
import hashlib
import json
import os
import re
import sys
import time
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageOps

VERSION = "lama-ocr-2"
Image.MAX_IMAGE_PIXELS = 24000000
_OCR = None
_MODEL = None
_MODEL_PATH = None
_DEVICE = None


def get_ocr():
    global _OCR
    if _OCR is None:
        from rapidocr_onnxruntime import RapidOCR
        _OCR = RapidOCR(intra_op_num_threads=4, inter_op_num_threads=1)
    return _OCR


def build_mask(image, provider, regions, ocr=None, template=None):
    mask = Image.new("L", image.size)
    draw = ImageDraw.Draw(mask)
    found = []
    if regions:
        for box in regions:
            x, y, w, h = box
            draw.rectangle((int(x*image.width), int(y*image.height), min(image.width-1, int((x+w)*image.width)), min(image.height-1, int((y+h)*image.height))), fill=255)
        found = [{"text": "manual", "confidence": 1}]
    else:
        if ocr is None:
            ocr = get_ocr()
        rows, _ = ocr(np.asarray(image))
        # A tight contrast-enhanced crop helps with faint central LOTTE lettering.
        if template == "lotte-wm224" and not any("global" in re.sub(r"[^a-z0-9]", "", text.lower()) for _, text, _ in rows or []):
            left, top = int(.16*image.width), int(.34*image.height)
            crop = image.crop((left, top, int(.84*image.width), int(.67*image.height)))
            crop = ImageOps.autocontrast(crop.convert("L"), cutoff=1).convert("RGB")
            extra, _ = ocr(np.asarray(crop))
            rows = list(rows or []) + [[[[x+left, y+top] for x, y in polygon], text, confidence] for polygon, text, confidence in extra or []]
        for polygon, text, confidence in rows or []:
            normalized = re.sub(r"[^a-z0-9]", "", text.lower())
            # Only known source words, never generic text, number plates or car badges.
            central = all(.18*image.width < x < .83*image.width and .5*image.height < y < .65*image.height for x, y in polygon)
            known_lotte = provider == "lotte" and template == "lotte-wm224" and central and "global" in normalized and confidence >= .65
            matched = known_lotte or (provider == "lotte" and ("lotte" in normalized or "autoglobal" in normalized)) or (provider == "mobile-de" and "mobilede" in normalized)
            if matched and confidence >= 0.55:
                draw.polygon([(int(x), int(y)) for x, y in polygon], fill=255)
                found.append({"text": text, "confidence": round(float(confidence), 3)})
                if known_lotte:
                    # wm_224 is a centred emblem plus a wordmark. OCR may read only GLOBAL.
                    # Apply the source-specific layout only when its centre wordmark is detected.
                    top = min(y for x, y in polygon)
                    bottom = max(y for x, y in polygon)
                    draw.rectangle((.24*image.width, top, .76*image.width, bottom), fill=255)
                    draw.rounded_rectangle((.455*image.width, .403*image.height, .545*image.width, .523*image.height), radius=.035*image.width, fill=255)
                    found[-1]["template"] = "lotte-wm224"
        mask = mask.filter(ImageFilter.MaxFilter(9))
    coverage = float(np.count_nonzero(np.asarray(mask))) / (image.width * image.height)
    return mask, found, coverage


def process(task):
    global _MODEL, _MODEL_PATH, _DEVICE
    started = time.monotonic()
    image = ImageOps.exif_transpose(Image.open(task["input"])).convert("RGB")
    mask, found, coverage = build_mask(image, task["provider"], task.get("regions"), template=task.get("template"))
    mask.save(task["mask"])
    common = {"version": VERSION, "width": image.width, "height": image.height, "coverage": round(coverage, 5), "detections": found}
    if not found or coverage == 0:
        return {**common, "state": "no_mark", "seconds": round(time.monotonic()-started, 2), "device": "cpu", "note": "Known watermark not detected; image left unchanged."}
    if coverage > 0.25:
        raise ValueError("Mask covers more than 25% of the image. Select a smaller area.")
    import torch
    torch.set_num_threads(4)
    device = "cuda" if torch.cuda.is_available() else "cpu"
    weights = Path(task["model"])
    if _MODEL is None or _MODEL_PATH != str(weights):
        _MODEL = torch.jit.load(str(weights), map_location=device).eval()
        _MODEL_PATH = str(weights)
        _DEVICE = device
    model = _MODEL
    if device == "cuda":
        torch.cuda.reset_peak_memory_stats()
    working = image.copy()
    working.thumbnail((1024, 1024), Image.Resampling.LANCZOS)
    small_mask = mask.resize(working.size, Image.Resampling.NEAREST)
    array = np.asarray(working).transpose(2, 0, 1).astype(np.float32) / 255
    mask_array = (np.asarray(small_mask)[None] > 0).astype(np.float32)
    h, w = working.height, working.width
    padding = ((0, 0), (0, (-h) % 8), (0, (-w) % 8))
    pixels = torch.from_numpy(np.pad(array, padding, mode="symmetric")[None]).to(device)
    areas = torch.from_numpy(np.pad(mask_array, padding, mode="symmetric")[None]).to(device)
    with torch.inference_mode():
        output = model(pixels, areas)[0].permute(1, 2, 0).cpu().numpy()[:h, :w]
    restored = Image.fromarray(np.clip(output * 255, 0, 255).astype(np.uint8)).resize(image.size, Image.Resampling.LANCZOS)
    # Preserve every decoded RGB pixel outside the mask; no global colour correction.
    result = Image.composite(restored, image, mask)
    result.save(task["output"], format="PNG")
    unchanged = np.array_equal(np.asarray(image)[np.asarray(mask) == 0], np.asarray(result)[np.asarray(mask) == 0])
    if not unchanged:
        raise ValueError("Pixels outside the mask changed.")
    return {**common, "state": "review", "device": device, "seconds": round(time.monotonic()-started, 2), "peak_vram_mib": round(torch.cuda.max_memory_reserved()/1048576) if device == "cuda" else 0, "outside_mask_unchanged": True, "model_sha256": hashlib.sha256(weights.read_bytes()).hexdigest()}


if __name__ == "__main__":
    if sys.argv[1] == "--stream":
        for line in sys.stdin:
            try:
                print(json.dumps(process(json.loads(line)), ensure_ascii=True), flush=True)
            except Exception as exc:
                print(json.dumps({"state": "failed", "error": str(exc)}, ensure_ascii=True), flush=True)
    else:
        try:
            task = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
            print(json.dumps(process(task), ensure_ascii=True))
        except Exception as exc:
            print(json.dumps({"state": "failed", "error": str(exc)}, ensure_ascii=True))
            sys.exit(1)
