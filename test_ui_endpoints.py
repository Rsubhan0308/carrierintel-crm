import urllib.request
import json

endpoints = [
    'http://localhost:3000/api/stats',
    'http://localhost:3000/api/carriers?page=1&limit=5',
    'http://localhost:3000/api/carriers?freshMcDays=14&limit=10'
]

for ep in endpoints:
    try:
        req = urllib.request.Request(ep)
        resp = urllib.request.urlopen(req)
        data = json.loads(resp.read().decode('utf-8'))
        print(f"URL {ep} -> Status 200 OK")
    except Exception as e:
        print(f"URL {ep} -> Error: {e}")
