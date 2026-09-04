import requests
from bs4 import BeautifulSoup
import re

proxy = "http://qosjlymz:pzqs1nimyl29@48.46.12.121:5751"
proxies = { "http": proxy, "https": proxy }
headers = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36' }

test_dots = ["3200000", "3500000", "2900000", "3894210", "3000000"]

for dot in test_dots:
    url = f"https://safer.fmcsa.dot.gov/query.asp?searchtype=ANY&query_type=queryCarrierSnapshot&query_param=USDOT&query_string={dot}"
    try:
        res = requests.get(url, proxies=proxies, headers=headers, timeout=12)
        if "Record Inactive" in res.text:
            print(f"❌ USDOT {dot}: RECORD INACTIVE / NOT AUTHORIZED -> [SKIPPED]")
        else:
            soup = BeautifulSoup(res.text, 'html.parser')
            
            # Find Legal Name & Operating Status
            text = res.text
            legal_match = re.search(r'Legal Name:\s*</th[^>]*>\s*<td[^>]*>(.*?)</td>', text, re.I | re.S)
            status_match = re.search(r'Operating Status:\s*</th[^>]*>\s*<td[^>]*>(.*?)</td>', text, re.I | re.S)
            phone_match = re.search(r'Phone:\s*</th[^>]*>\s*<td[^>]*>(.*?)</td>', text, re.I | re.S)
            pu_match = re.search(r'Power Units:\s*</th[^>]*>\s*<td[^>]*>(.*?)</td>', text, re.I | re.S)
            
            legal_name = legal_match.group(1).replace('&nbsp;', ' ').strip() if legal_match else "N/A"
            status = status_match.group(1).replace('&nbsp;', ' ').strip() if status_match else "N/A"
            phone = phone_match.group(1).replace('&nbsp;', ' ').strip() if phone_match else "N/A"
            power_units = pu_match.group(1).replace('&nbsp;', ' ').strip() if pu_match else "N/A"
            
            print(f"✅ USDOT {dot}: REAL ACTIVE CARRIER FOUND!")
            print(f"   • Company: {legal_name}")
            print(f"   • Status: {status}")
            print(f"   • Phone: {phone}")
            print(f"   • Power Units: {power_units}\n")
    except Exception as e:
        print(f"Error {dot}: {e}")
