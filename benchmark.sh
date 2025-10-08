#!/bin/bash

# Model Benchmark Script
# Tests response time and reliability of all available models

URL="https://ai.wush.site/v1/chat/completions"

# Models to test (safe ones only)
MODELS=(
  "phi4-mini-reasoning:3.8b"
  "phi3:3.8b"
  "qwen2.5:7b"
  "qwen2.5-coder:7b"
  "mistral:latest"
  "vicuna:7b"
  "llama3.2:latest"
)

# Test message
TEST_MSG='{"model":"MODEL_NAME","messages":[{"role":"user","content":"hi, how are you?"}],"max_tokens":50}'

echo "🔍 Benchmarking AI Models..."
echo "================================"
echo ""

for MODEL in "${MODELS[@]}"; do
  echo "Testing: $MODEL"
  
  # Replace MODEL_NAME placeholder
  PAYLOAD="${TEST_MSG/MODEL_NAME/$MODEL}"
  
  # Measure time and test
  START=$(date +%s%3N)
  
  RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$URL" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ollama" \
    --max-time 30 \
    -d "$PAYLOAD")
  
  END=$(date +%s%3N)
  DURATION=$((END - START))
  
  # Extract HTTP code (last line)
  HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
  BODY=$(echo "$RESPONSE" | head -n-1)
  
  if [ "$HTTP_CODE" = "200" ]; then
    REPLY=$(echo "$BODY" | grep -o '"content":"[^"]*"' | head -1 | cut -d'"' -f4)
    echo "  ✅ SUCCESS (${DURATION}ms)"
    echo "  Reply: ${REPLY:0:60}..."
  else
    ERROR=$(echo "$BODY" | grep -o '"error":"[^"]*"' | cut -d'"' -f4)
    echo "  ❌ FAILED (HTTP $HTTP_CODE)"
    [ -n "$ERROR" ] && echo "  Error: $ERROR"
  fi
  
  echo ""
  sleep 1
done

echo "================================"
echo "✅ Benchmark complete!"
