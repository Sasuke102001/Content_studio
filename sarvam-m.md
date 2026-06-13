# sarvam-m

This script demonstrates how to call the NVIDIA API for `sarvamai/sarvam-m` chat completions using the OpenAI-compatible client.

## Python Code

```python
from openai import OpenAI

client = OpenAI(
  base_url = "https://integrate.api.nvidia.com/v1",
  api_key = "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"
)

completion = client.chat.completions.create(
  model="sarvamai/sarvam-m",
  messages=[{"role":"user","content":""}],
  temperature=0.5,
  top_p=1,
  max_tokens=16384,
  stream=False
)

print(completion.choices[0].message.content)
```

## Notes

- Replace the `api_key` with your own NVIDIA API key.
- The `base_url` points to NVIDIA's OpenAI-compatible integration endpoint.
- Set `stream=True` to enable streaming responses.
