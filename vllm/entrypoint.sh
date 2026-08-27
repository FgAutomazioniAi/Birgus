#!/bin/sh
set -eu

: "${VLLM_MODEL:?VLLM_MODEL is required}"
: "${VLLM_SERVED_MODEL_NAME:?VLLM_SERVED_MODEL_NAME is required}"
: "${VLLM_MAX_MODEL_LEN:?VLLM_MAX_MODEL_LEN is required}"

exec vllm serve "$VLLM_MODEL" \
  --served-model-name "$VLLM_SERVED_MODEL_NAME" \
  --max-model-len "$VLLM_MAX_MODEL_LEN" \
  --gpu-memory-utilization "${VLLM_GPU_MEMORY_UTILIZATION:-0.90}" \
  --host 0.0.0.0 \
  --port 8000
