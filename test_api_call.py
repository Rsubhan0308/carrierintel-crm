import urllib.request
import json
import time

url = 'http://localhost:3000/api/scraper/start'
payload = json.dumps({'dotList': ['3800001', '3800002', '3800005']}).encode('utf-8')
headers = {'Content-Type': 'application/json'}

req = urllib.request.Request(url, data=payload, headers=headers)
resp = urllib.request.urlopen(req)
job = json.loads(resp.read().decode('utf-8'))
job_id = job['jobId']
print(f"Started Job: {job_id}")

time.sleep(12)

status_url = f"http://localhost:3000/api/scraper/status/{job_id}"
status_req = urllib.request.Request(status_url)
status_resp = urllib.request.urlopen(status_req)
status_data = json.loads(status_resp.read().decode('utf-8'))

print(f"\nJob Status: {status_data['status']}")
print(f"Scraped Active: {status_data['scrapedCount']} | Skipped Inactive: {status_data['skippedCount']}")
print("\n--- LIVE CONSOLE LOGS ---")
for log in status_data['logs']:
    print(log)
