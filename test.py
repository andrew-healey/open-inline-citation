import requests

payload = {
    'api_key': '825e1a99d69640a569300d018721a5ad',
    'country': 'us',
    'query': 'brand monitoring'
}

response = requests.get(
    'https://api.scraperapi.com/structured/google/search', params=payload)
print(response.text)

