#!/usr/bin/env python3
"""Where every word lands in a presenter take.

The presenter's own video is the voice track, so nothing can be re-timed
without breaking her lip-sync. Instead the reel follows her: this transcribes
the take with word timestamps and writes them for tools/take-timeline.mjs.

  python tools/take-words.py reel/vo/presenter.mp4 > reel/out/words.json

Needs faster-whisper (pip install faster-whisper). The model downloads once.
"""
import json
import os
import sys

from faster_whisper import WhisperModel

src = sys.argv[1]
model = WhisperModel(os.environ.get('WHISPER_MODEL', 'small.en'), device='cpu', compute_type='int8',
                     download_root=os.environ.get('WHISPER_DIR'))
segments, info = model.transcribe(src, language='en', word_timestamps=True, vad_filter=False, beam_size=5,
                                  initial_prompt='Kairo. DM the word Kairo. Four hundred and ten bucks.')
words = []
for seg in segments:
    for w in seg.words:
        words.append({'w': w.word.strip(), 'start': round(w.start, 3), 'end': round(w.end, 3), 'p': round(w.probability, 3)})
json.dump({'source': src, 'duration': round(info.duration, 3), 'words': words}, sys.stdout, indent=1)
