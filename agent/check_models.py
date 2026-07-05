import os
from dotenv import load_dotenv
load_dotenv()

from google import genai

client = genai.Client(api_key=os.getenv("GOOGLE_API_KEY"))

print("Model ho tro embedding:")
for m in client.models.list():
    if hasattr(m, 'supported_actions') and m.supported_actions:
        if any("embed" in str(a).lower() for a in m.supported_actions):
            print(f"  {m.name}")
    elif "embed" in m.name.lower():
        print(f"  {m.name}")
