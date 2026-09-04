import requests
from bs4 import BeautifulSoup
import re

proxy = "http://qosjlymz:pzqs1nimyl29@48.46.12.121:5751"
proxies = { "http": proxy, "https": proxy }
headers = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36' }

test_dots = ["2900000", "3000000", "3800000", "2800000"]

for dot in test_dots:
    url = f"https://safer.fmcsa.dot.gov/query.asp?searchtype=ANY&query_type=queryCarrierSnapshot&query_param=USDOT&query_string={dot}"
    try:
        res = requests.get(url, proxies=proxies, headers=headers, timeout=12)
        text = res.text
        if "Record Inactive" in text:
            print(f"[SKIP] USDOT {dot}: RECORD INACTIVE / NOT AUTHORIZED")
        else:
            soup = BeautifulSoup(text, 'html.parser')
            
            # Extract fields from SAFER HTML table
            def get_val(pattern):
                m = re.search(pattern, text, re.I | re.S)
                if m:
                    clean = re.sub(r'<[^>]+>', '', m.group(1))
                    return clean.replace('&nbsp;', ' ').strip()
                return "N/A"

            legal_name = get_val(r'Legal Name:\s*</th[^>]*>\s*<td[^>]*>(.*?)</td>')
            dba_name = get_val(r'DBA Name:\s*</th[^>]*>\s*<td[^>]*>(.*?)</td>')
            status = get_val(r'Operating Status:\s*</th[^>]*>\s*<td[^>]*>(.*?)</td>')
            phone = get_val(r'Phone:\s*</th[^>]*>\s*<td[^>]*>(.*?)</td>')
            power_units = get_val(r'Power Units:\s*</th[^>]*>\s*<td[^>]*>(.*?)</td>')
            drivers = get_val(r'Drivers:\s*</th[^>]*>\s*<td[^>]*>(.*?)</td>')
            mc_num = get_val(r'MC/FF Number\(s\):\s*</th[^>]*>\s*<td[^>]*>(.*?)</td>')
            phy_addr = get_val(r'Physical Address:\s*</th[^>]*>\s*<td[^>]*>(.*?)</td>')

            print(f"\n[ACTIVE REAL CARRIER] USDOT {dot}:")
            print(f"   Company: {legal_name} (DBA: {dba_name})")
            print(f"   MC Number: {mc_num}")
            print(f"   Status: {status}")
            print(f"   Physical Address: {phy_addr}")
            print(f"   Phone: {phone}")
            print(f"   Power Units: {power_units} | Drivers: {drivers}")
    except Exception as e:
        print(f"Error {dot}: {e}")
