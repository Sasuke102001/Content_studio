import os
import requests

class SarvamClient:
    def __init__(self, api_key: str = None):
        # Fallback to env if not passed
        self.api_key = api_key or os.getenv("SARVAM_API_KEY")
        self.supabase_url = os.getenv("SUPABASE_URL")
        self.supabase_publishable_key = os.getenv("SUPABASE_PUBLISHABLE_KEY")
        self.supabase_access_token = os.getenv("SUPABASE_ACCESS_TOKEN")
        self.url = "https://integrate.api.nvidia.com/v1/chat/completions"

    def translate_text(self, text: str, target_lang: str, style: str = "formal", custom_directives: str = "") -> str:
        """
        Translates or adapts text using sarvamai/sarvam-m model on NVIDIA NIM.
        target_lang can be: 'en', 'hi', 'hi-Latn' (Hinglish)
        style can be: 'formal', 'colloquial', 'transliterated'
        """
        if not text or not text.strip():
            return text

        system_msg = "You are a multilingual AI assistant specialized in Indian languages translation and transliteration."
        directives_block = f"\nCustom translation rules: {custom_directives}" if custom_directives else ""

        prompt = f"""
Translate and adapt the following text to {target_lang} with a {style} tone.{directives_block}
Important:
- If target_lang is 'hi-Latn', write the output in Hinglish (a natural mix of Hindi and English in Roman/Latin script, e.g. "Aaj hum product design ke baare mein baat karenge").
- If target_lang is 'hi', translate to pure Hindi in Devanagari script.
- If target_lang is 'en', translate to professional English.
- Return ONLY the translated/adapted text. Do not include quotes, preamble, notes, or explanations.

Text to adapt:
"{text}"
"""

        if self.supabase_url and self.supabase_publishable_key and self.supabase_access_token:
            return self._translate_via_supabase(system_msg, prompt, text)

        if not self.api_key:
            raise ValueError("Neither Supabase proxy auth nor SARVAM_API_KEY was provided.")

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Accept": "application/json",
            "Content-Type": "application/json"
        }

        payload = {
            "model": "sarvamai/sarvam-m",
            "messages": [
                {"role": "system", "content": system_msg},
                {"role": "user",   "content": prompt}
            ],
            "temperature": 0.3,
            "max_tokens": 2048,
            "stream": False
        }
        
        try:
            response = requests.post(self.url, headers=headers, json=payload, timeout=60)
            if response.status_code != 200:
                raise Exception(f"Sarvam API Error {response.status_code}: {response.text}")
                
            result = response.json()
            translated = result["choices"][0]["message"]["content"].strip()
            # Clean quotes if returned
            if translated.startswith('"') and translated.endswith('"'):
                translated = translated[1:-1]
            return translated
        except Exception as e:
            print(f"[SarvamClient Error] Translation failed: {str(e)}")
            return text  # Return original text on failure as fallback

    def _translate_via_supabase(self, system_msg: str, prompt: str, original_text: str) -> str:
        headers = {
            "Authorization": f"Bearer {self.supabase_access_token}",
            "apikey": self.supabase_publishable_key,
            "Content-Type": "application/json"
        }
        payload = {
            "model": "sarvamai/sarvam-m",
            "messages": [
                {"role": "system", "content": system_msg},
                {"role": "user", "content": prompt}
            ],
            "temperature": 0.3,
            "max_tokens": 2048
        }

        try:
            response = requests.post(
                f"{self.supabase_url}/functions/v1/ai-proxy",
                headers=headers,
                json=payload,
                timeout=60
            )
            if response.status_code != 200:
                raise Exception(f"Supabase AI proxy error {response.status_code}: {response.text}")

            translated = response.json().get("content", "").strip()
            if translated.startswith('"') and translated.endswith('"'):
                translated = translated[1:-1]
            return translated
        except Exception as e:
            print(f"[SarvamClient Error] Translation failed: {str(e)}")
            return original_text
