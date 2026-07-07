---
title: "Squeeze LLM Throughput"
slug: "squeeze-llm-througtout"
type: "essay"
language: "en"
status: "published"
summary: "Tuning a 3B vLLM deployment for better throughput on an RTX 5880."
tags: []
channels:
  - site
wechat_mp:
  publish: false
published_at: "2025-09-03T18:17:44+08:00"
updated_at: "2025-09-03T18:17:44+08:00"
source: "legacy-worker"
legacy_urls:
  - "/posts/squeeze-llm-througtout/"
---

I've been running a 3B model on an RTX 5880 (48 GB) and my initial container flags were fine for functional testing, but throughput felt capped. After some digging into vLLM's engine arguments, I re-tuned my run configuration and saw a noticeable jump in tokens per second without compromising stability.

Here's the updated preset that worked best for me:

```shell
docker run --gpus '"device=1"' --rm -it \
  -p 8888:8000 \
  -e TRANSFORMERS_OFFLINE=1 \
  -e HF_DATASET_OFFLINE=1 \
  -e HF_HUB_OFFLINE=1 \
  --shm-size 2g \
  -v ~/.cache/huggingface:/root/.cache/huggingface \
  vllm/vllm-openai:v0.9.2 \
  --model ChatDOC/OCRFlux-3B \
  --served-model-name "chat-doc/ocrflux-3b" \
  --dtype auto \
  --tensor-parallel-size 1 \
  --gpu-memory-utilization 0.95 \
  --kv-cache-dtype fp8 \
  --calculate-kv-scales \
  --enable-chunked-prefill \
  --max-model-len 8192 \
  --max-num-seqs 512 \
  --swap-space 0 \
  --disable-log-requests \
  --disable-log-stats
```

## Why this setup worked better

- Dropped `--enforce-eager`: that flag forces eager execution and disables vLLM's optimized paged-attention kernels. By removing it, I let the engine use its fast path.
- FP8 KV cache with dynamic scaling: `--kv-cache-dtype fp8 --calculate-kv-scales` drastically reduced KV cache memory footprint. On a 48 GB card, that translated into much higher concurrency.
- Chunked prefill: with `--enable-chunked-prefill`, long prompts no longer stall throughput; prefill overlaps with decode and keeps the GPU busy.
- Memory dial-up: bumping `--gpu-memory-utilization` to `0.95` squeezed more active sequences onto the card. On this dedicated GPU, that was safe.
- Concurrency bump: I raised `--max-num-seqs` from 256 to 512. For a ~3B dense model plus FP8 cache, this fits comfortably, and the scheduler thrives with larger sequence pools.
- Housekeeping: `--dtype auto` let vLLM pick the right precision for Ada hardware; `--swap-space 0` kept everything on-GPU for speed; and turning off logs shaved a few milliseconds at scale.

## Things to remember

- FP8 KV caching isn't always friendly with prefix caching. If you see instability, roll back to FP16 KV.
- The best throughput only shows up when the client is sending many concurrent requests. vLLM does continuous batching automatically. There's no explicit "batch" field in the API.
- If you run close to OOM, reduce `--max-num-seqs` to 384 or lower `--gpu-memory-utilization` to `0.9`.

Overall, this tuning let me push the 3B model far closer to the hardware limits of the 5880, especially under high QPS load. The biggest win came from FP8 KV cache concurrency increase.
