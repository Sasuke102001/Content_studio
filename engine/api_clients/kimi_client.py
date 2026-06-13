import json
import os
import requests

class KimiClient:
    def __init__(self, api_key: str = None):
        self.api_key = api_key or os.getenv("NVIDIA_API_KEY")
        self.supabase_url = os.getenv("SUPABASE_URL")
        self.supabase_publishable_key = os.getenv("SUPABASE_PUBLISHABLE_KEY")
        self.supabase_access_token = os.getenv("SUPABASE_ACCESS_TOKEN")
        self.url = "https://integrate.api.nvidia.com/v1/chat/completions"

    def generate_completion(self, system_msg: str, user_msg: str, stream_callback=None) -> str:
        if self.supabase_url and self.supabase_publishable_key and self.supabase_access_token:
            return self._generate_via_supabase(system_msg, user_msg, stream_callback)

        if not self.api_key:
            raise ValueError("Neither Supabase proxy auth nor NVIDIA_API_KEY was provided.")

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Accept": "application/json",
            "Content-Type": "application/json"
        }
        payload = {
            "model": "moonshotai/kimi-k2.6",
            "messages": [
                {"role": "system", "content": system_msg},
                {"role": "user",   "content": user_msg}
            ],
            "temperature": 0.6,
            "max_tokens": 8000,
            "stream": True
        }
        
        response = requests.post(
            self.url,
            headers=headers,
            json=payload,
            timeout=600,
            stream=True
        )
        
        if response.status_code != 200:
            raise Exception(f"API Error {response.status_code}: {response.text}")
            
        full_response = ""
        for line in response.iter_lines():
            if line:
                decoded = line.decode("utf-8")
                if decoded.startswith("data: "):
                    data = decoded[6:]
                    if data == "[DONE]":
                        break
                    try:
                        delta = json.loads(data)["choices"][0].get("delta", {}).get("content", "")
                        if delta:
                            full_response += delta
                            if stream_callback:
                                stream_callback(delta)
                    except Exception:
                        pass
        return full_response

    def _generate_via_supabase(self, system_msg: str, user_msg: str, stream_callback=None) -> str:
        headers = {
            "Authorization": f"Bearer {self.supabase_access_token}",
            "apikey": self.supabase_publishable_key,
            "Content-Type": "application/json"
        }
        payload = {
            "model": "moonshotai/kimi-k2.6",
            "messages": [
                {"role": "system", "content": system_msg},
                {"role": "user", "content": user_msg}
            ],
            "temperature": 0.6,
            "max_tokens": 8000
        }

        response = requests.post(
            f"{self.supabase_url}/functions/v1/ai-proxy",
            headers=headers,
            json=payload,
            timeout=600
        )

        if response.status_code != 200:
            raise Exception(f"Supabase AI proxy error {response.status_code}: {response.text}")

        content = response.json().get("content", "")
        if stream_callback and content:
            for i in range(0, len(content), 200):
                stream_callback(content[i:i + 200])
        return content
