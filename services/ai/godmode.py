import os
import requests
from .base import BaseLLM

class GodmodeLLM(BaseLLM):
    """
    G0DM0D3 integration - races multiple AI models in parallel and returns the best response.
    Uses OpenRouter API key for authentication.
    """
    
    def __init__(self):
        self.openrouter_api_key = os.getenv("OPENROUTER_API_KEY")
        self.base_url = os.getenv("GODMODE_BASE_URL", "http://localhost:7860/v1")
        self.endpoint = f"{self.base_url}/ultraplinian/completions"
        
        if not self.openrouter_api_key:
            print("WARNING: OPENROUTER_API_KEY not set. G0DM0D3 requires OpenRouter API key.")
        
        if not self.openrouter_api_key:
            self.client = None
        else:
            self.client = True  # Flag that we have credentials
    
    def _local_fallback(self, system_prompt: str, user_message: str) -> str:
        return (
            "I can't reach G0DM0D3 right now. Please ensure:\n"
            "1. G0DM0D3 is running: docker run -p 7860:7860 ghcr.io/elder-plinius/g0dm0d3\n"
            "2. OPENROUTER_API_KEY is set in your environment\n"
            f"Received message: {user_message}"
        )
    
    def generate_response(self, system_prompt: str, user_message: str) -> str:
        if not self.client:
            return self._local_fallback(system_prompt, user_message)
        
        try:
            headers = {
                "Authorization": f"Bearer {self.openrouter_api_key}",
                "Content-Type": "application/json"
            }
            
            payload = {
                "model": "auto",
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_message}
                ],
                "temperature": 0.7,
                "max_tokens": 2000
            }
            
            response = requests.post(
                self.endpoint,
                headers=headers,
                json=payload,
                timeout=60
            )
            
            if response.status_code == 200:
                data = response.json()
                # G0DM0D3 returns the best response from the race
                content = data.get("choices", [{}])[0].get("message", {}).get("content", "")
                
                # Extract race metadata if available
                race_metadata = data.get("metadata", {})
                if race_metadata:
                    winner = race_metadata.get("winner", "Unknown")
                    score = race_metadata.get("score", 0)
                    total_models = race_metadata.get("total_models", 0)
                    duration = race_metadata.get("duration", 0)
                    
                    # Add race info as a comment at the end
                    race_info = f"\n\n---\n🏆 Race Winner: {winner} (score: {score}) from {total_models} models in {duration:.1f}s"
                    content += race_info
                
                return content
            else:
                print(f"G0DM0D3 API error: {response.status_code} - {response.text}")
                return self._local_fallback(system_prompt, user_message)
                
        except requests.exceptions.Timeout:
            print("G0DM0D3 request timed out")
            return self._local_fallback(system_prompt, user_message)
        except requests.exceptions.ConnectionError:
            print("G0DM0D3 connection error. Is G0DM0D3 running on localhost:7860?")
            return self._local_fallback(system_prompt, user_message)
        except Exception as e:
            print(f"G0DM0D3 error: {e}")
            return self._local_fallback(system_prompt, user_message)
    
    def analyze_image(self, system_prompt: str, image_path: str, user_message: str = "") -> str:
        """
        G0DM0D3 supports vision through OpenRouter-compatible endpoints.
        """
        if not self.client:
            return self._local_fallback(system_prompt, user_message or "Image analysis requested")
        
        try:
            # Read image and convert to base64
            import base64
            
            with open(image_path, "rb") as image_file:
                base64_image = base64.b64encode(image_file.read()).decode('utf-8')
            
            headers = {
                "Authorization": f"Bearer {self.openrouter_api_key}",
                "Content-Type": "application/json"
            }
            
            messages = [
                {"role": "system", "content": system_prompt}
            ]
            
            if user_message:
                messages.append({
                    "role": "user",
                    "content": [
                        {"type": "text", "text": user_message},
                        {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{base64_image}"}}
                    ]
                })
            else:
                messages.append({
                    "role": "user",
                    "content": [
                        {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{base64_image}"}}
                    ]
                })
            
            payload = {
                "model": "auto",
                "messages": messages,
                "temperature": 0.5,
                "max_tokens": 2000
            }
            
            response = requests.post(
                self.endpoint,
                headers=headers,
                json=payload,
                timeout=60
            )
            
            if response.status_code == 200:
                data = response.json()
                content = data.get("choices", [{}])[0].get("message", {}).get("content", "")
                
                # Extract race metadata
                race_metadata = data.get("metadata", {})
                if race_metadata:
                    winner = race_metadata.get("winner", "Unknown")
                    score = race_metadata.get("score", 0)
                    total_models = race_metadata.get("total_models", 0)
                    duration = race_metadata.get("duration", 0)
                    
                    race_info = f"\n\n---\n🏆 Race Winner: {winner} (score: {score}) from {total_models} models in {duration:.1f}s"
                    content += race_info
                
                return content
            else:
                print(f"G0DM0D3 vision error: {response.status_code} - {response.text}")
                return "I could not analyze the image with G0DM0D3."
                
        except Exception as e:
            print(f"G0DM0D3 vision error: {e}")
            return "I could not analyze the image."
