import urllib.request
import re
import json

def fetch_real_carrier(usdot):
    url = f"https://html.duckduckgo.com/html/?q=USDOT+{usdot}+carrier"
    req = urllib.request.Request(url, headers={
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
    })
    
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            html = resp.read().decode('utf-8', errors='ignore')
            
            # Find titles and snippets
            titles = re.findall(r'<a class="result__a"[^>]*>(.*?)</a>', html, re.DOTALL)
            snippets = re.findall(r'<a class="result__snippet"[^>]*>(.*?)</a>', html, re.DOTALL)
            
            print(f"--- Results for USDOT {usdot} ---")
            for t, s in zip(titles[:3], snippets[:3]):
                clean_t = re.sub(r'<[^>]+>', '', t).strip()
                clean_s = re.sub(r'<[^>]+>', '', s).strip()
                print(f"Title: {clean_t}\nSnippet: {clean_s}\n")
    except Exception as e:
        print(f"Error fetching USDOT {usdot}: {e}")

fetch_real_carrier("3894210")
fetch_real_carrier("3500000")
