import json
import requests
from requests.exceptions import ConnectionError

class APIClient:
    def __init__(self, base_url="http://localhost:8080/api/v1"):
        self.base_url = base_url

    def post_payload(self, filepath):
        url = f"{self.base_url}/ingestion/import"
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                payload = json.load(f)
            
            print(f"Sending payload from {filepath} to {url}...")
            response = requests.post(url, json=payload, headers={'Content-Type': 'application/json'})
            
            if response.status_code in (200, 201):
                print("Payload successfully sent to the Spring Boot backend!")
                print(f"Response: {response.text}")
            else:
                print(f"Failed to send payload. Status code: {response.status_code}")
                print(f"Response: {response.text}")
        except ConnectionError:
            print("Error: Could not connect to the Spring Boot backend.")
            print("Make sure the Java backend is running on http://localhost:8080")
        except Exception as e:
            print(f"An unexpected error occurred: {e}")
