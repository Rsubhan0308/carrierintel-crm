import urllib.request
import json

req = urllib.request.Request('http://localhost:3000/api/carriers')
resp = urllib.request.urlopen(req)
data = json.loads(resp.read().decode('utf-8'))
print(f"Total Active Carriers Saved in DB: {data['total']}")
for c in data['carriers']:
    print(f"  • USDOT {c['usdot']} | {c['companyName']} | MC: {c['mcNumber']} | Phone: {c['phone']} | City: {c['city']}, {c['state']} | Status: {c['authorityStatus']}")
