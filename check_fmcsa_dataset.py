import urllib.request
import ssl
import json

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

urls = [
    "https://open-fmcsa.dot.gov/api/carriers",
    "https://data.fmcsa.dot.gov/api/v1/carriers",
    "https://raw.githubusercontent.com/fmcsa-data/fmcsa-census/main/fmcsa_active_carriers.json",
    "https://api.github.com/search/repositories?q=fmcsa+census+carrier"
]

for url in urls:
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, context=ctx, timeout=8) as resp:
            data = resp.read().decode('utf-8', errors='ignore')
            print(f"URL: {url} -> Status: 200 -> Length: {len(data)}")
            print(data[:300])
    except Exception as e:
        print(f"URL: {url} -> Error: {e}")
