import urllib.request
import re

def fetch_fmcsa_sms(usdot):
    url = f"https://ai.fmcsa.dot.gov/SMS/Carrier/{usdot}/Overview.aspx"
    req = urllib.request.Request(url, headers={
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://ai.fmcsa.dot.gov/SMS/'
    })
    
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            html = resp.read().decode('utf-8', errors='ignore')
            print(f"FMCSA SMS Length for USDOT {usdot}: {len(html)}")
            if "Legal Name" in html or "USDOT" in html or "Power Units" in html:
                print("Found FMCSA SMS Page!")
                # Extract Company Name
                name_match = re.search(r'<span class="master_company_name"[^>]*>(.*?)</span>', html, re.IGNORECASE)
                if name_match:
                    print("Company Name:", name_match.group(1).strip())
                
                status_match = re.search(r'Operating Status:\s*</[^>]+>\s*<span[^>]*>(.*?)</span>', html, re.IGNORECASE)
                if status_match:
                    print("Status:", status_match.group(1).strip())
            else:
                print("Page snippet:", html[:300])
    except Exception as e:
        print(f"FMCSA SMS Error for {usdot}: {e}")

fetch_fmcsa_sms("3800000")
fetch_fmcsa_sms("3894210")
