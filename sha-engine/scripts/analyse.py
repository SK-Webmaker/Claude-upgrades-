#!/usr/bin/env python3
"""
Media analysis for the cut engine: speech transcription and subject framing.

Runs as a subprocess and returns JSON on stdout, so the Node pipeline stays in
one language while the parts that genuinely need Python (whisper, OpenCV) live
here.

Two commands:

  transcribe <file>   Word-level timestamps via faster-whisper. This is what
                      makes karaoke captions possible — Sha is on camera with
                      voice, so captions must track her actual words rather
                      than text written in advance.

  frame <file>        Per-timestamp horizontal crop centre. Face detection is
                      the usual approach in clipping tools, but a colourist's
                      footage is frequently the back of a head, where face
                      detection finds nothing and silently centres the crop.
                      Tracking subject energy instead works for a face, a back
                      of a head, or a pair of hands in foils.
"""

import json
import sys
import os


def _fail(msg, **extra):
    print(json.dumps({"ok": False, "error": str(msg), **extra}))
    sys.exit(0)  # Non-zero would mask the JSON; the caller reads ok=False.


def transcribe(path, model_size=None):
    try:
        from faster_whisper import WhisperModel
    except ImportError:
        _fail("faster-whisper is not installed. pip install faster-whisper")

    model_size = model_size or os.environ.get("SHA_WHISPER_MODEL", "base")

    try:
        model = WhisperModel(model_size, device="cpu", compute_type="int8")
        segments, info = model.transcribe(
            path,
            word_timestamps=True,
            vad_filter=True,
            vad_parameters={"min_silence_duration_ms": 400},
        )

        words, segs = [], []
        for seg in segments:
            segs.append({
                "start": round(seg.start, 3),
                "end": round(seg.end, 3),
                "text": seg.text.strip(),
            })
            for w in (seg.words or []):
                token = w.word.strip()
                if not token:
                    continue
                words.append({
                    "word": token,
                    "start": round(w.start, 3),
                    "end": round(w.end, 3),
                    "prob": round(getattr(w, "probability", 1.0), 3),
                })

        print(json.dumps({
            "ok": True,
            "language": info.language,
            "languageProb": round(info.language_probability, 3),
            "durationSec": round(info.duration, 3),
            "words": words,
            "segments": segs,
            "hasSpeech": len(words) > 0,
            "model": model_size,
        }))
    except Exception as e:  # noqa: BLE001 — surfaced to the caller as JSON
        _fail(f"transcription failed: {e}")


def frame(path, samples=None):
    """
    Sample the clip and, for each sample, find the horizontal centre of the
    most visually interesting region.

    Column energy = vertical-gradient magnitude summed down each column. Hair,
    faces and hands all carry far more edge detail than a salon wall, so the
    energy peak reliably lands on the subject. A smoothed running centre stops
    the crop jittering frame to frame, which is what makes a naive
    implementation look worse than a static centre crop.
    """
    try:
        import cv2
        import numpy as np
    except ImportError:
        _fail("opencv-python-headless and numpy are required")

    samples = int(samples or 24)

    try:
        cap = cv2.VideoCapture(path)
        if not cap.isOpened():
            _fail(f"could not open {path}")

        total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
        fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH) or 0)
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT) or 0)

        if total <= 0 or width <= 0:
            cap.release()
            _fail("no readable frames")

        step = max(1, total // samples)
        track, idx = [], 0
        smoothed = None
        # Exponential smoothing: high enough to follow a real move, low enough
        # that a flicker of light does not drag the frame around.
        alpha = 0.35

        while idx < total:
            cap.set(cv2.CAP_PROP_POS_FRAMES, idx)
            ok, img = cap.read()
            if not ok:
                break

            small = cv2.resize(img, (160, 90))
            grey = cv2.cvtColor(small, cv2.COLOR_BGR2GRAY)
            grad = cv2.Sobel(grey, cv2.CV_32F, 0, 1, ksize=3)
            energy = np.abs(grad).sum(axis=0)

            if energy.sum() <= 0:
                centre = 0.5
            else:
                # Centre of mass of column energy, in 0..1 of frame width.
                cols = np.arange(energy.shape[0], dtype=np.float32)
                centre = float((cols * energy).sum() / energy.sum() / energy.shape[0])

            smoothed = centre if smoothed is None else (alpha * centre + (1 - alpha) * smoothed)
            track.append({
                "t": round(idx / fps, 3),
                "centre": round(min(0.85, max(0.15, smoothed)), 4),
            })
            idx += step

        cap.release()

        if not track:
            _fail("no frames sampled")

        centres = [p["centre"] for p in track]
        mean_centre = sum(centres) / len(centres)
        spread = max(centres) - min(centres)

        print(json.dumps({
            "ok": True,
            "width": width,
            "height": height,
            "fps": round(fps, 2),
            "samples": len(track),
            "track": track,
            "meanCentre": round(mean_centre, 4),
            "spread": round(spread, 4),
            # A near-static subject is better served by one fixed offset than
            # by an animated crop that introduces motion the footage lacks.
            "recommendStatic": spread < 0.08,
        }))
    except Exception as e:  # noqa: BLE001
        _fail(f"framing failed: {e}")


if __name__ == "__main__":
    if len(sys.argv) < 3:
        _fail("usage: analyse.py <transcribe|frame> <file> [arg]")
    cmd, target = sys.argv[1], sys.argv[2]
    extra = sys.argv[3] if len(sys.argv) > 3 else None
    if not os.path.exists(target):
        _fail(f"no such file: {target}")
    if cmd == "transcribe":
        transcribe(target, extra)
    elif cmd == "frame":
        frame(target, extra)
    else:
        _fail(f"unknown command: {cmd}")
