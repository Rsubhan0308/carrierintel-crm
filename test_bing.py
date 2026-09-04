import urllib.request
import re

def fetch_bing(usdot):
    url = f"https://www.bing.com/search?q=USDOT+{usdot}+carrier+mc"
    req = urllib.request.Request(url, headers={
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9'
    })
    
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            html = resp.read().decode('utf-8', errors='ignore')
            print(f"Bing Response Length for USDOT {usdot}: {len(html)}")
            results = re.findall(r'<li class="b_algo"[^>]*>(.*?)</li>', html, re.DOTALL)
            print(f"Found {len(results)} search results!")
            for r in results[:3]:
                title = re.search(r'<h2><a[^>]*>(.*?)</a></h2>', r)
                snippet = re.search(r'<div class="b_caption"[^>]*>(.*?)</div>', r, re.DOTALL)
                if title:
                    clean_t = re.sub(r'<[^>]+>', '', title.group(1)).strip()
                    print(f"Title: {clean_t}")
                if snippet:
                    clean_s = re.sub(r'<[^>]+>', '', snippet.group(1)).strip()
                    print(f"Snippet: {clean_s}\n")
    except Exception as e:
        print(f"Bing error for {usdot}: {e}")

fetch_bing("3800000")
fetch_bing("3900000")
