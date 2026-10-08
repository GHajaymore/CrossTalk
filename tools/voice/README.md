# CrossTalk voice (early)

Turns a recorded episode into a podcast MP3 using **Kokoro**, a free open-source voice model (Apache-2.0, commercial use allowed). Nothing is paid; it runs on your own machine.

```sh
cd tools/voice
npm install
curl -s localhost:8787/api/conversations/<id> > episode.json   # while the app is running
node render.mjs episode.json episode.mp3
```

- The first run downloads the model (about 90 MB) from Hugging Face.
- Choose voices with `KOKORO_VOICE_A` / `KOKORO_VOICE_B` (e.g. `am_michael`, `af_heart`, `bm_george`, `bf_emma`). Samples are on the model card: https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX
- Writes `episode.mp3` and `episode.json` (when each turn starts and ends).
- Label published audio as AI-generated.
