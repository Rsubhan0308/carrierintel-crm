import requests
from bs4 import BeautifulSoup
import re

proxy = "http://qosjlymz:pzqs1nimyl29@48.46.12.121:5751"
proxies = { "http": proxy, "https": proxy }
headers = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }

test_dots = ["3800001", "3800005", "3800010"]

for dot in test_dots:
    url = f"https://safer.fmcsa.dot.gov/query.asp?searchtype=ANY&query_type=queryCarrierSnapshot&query_param=USDOT&query_string={dot}"
    res = requests.get(url, proxies=proxies, headers=headers, timeout=10)
    soup = BeautifulSoup(res.text, 'html.parser')
    
    legal_name = ""
    phone = ""
    power_units = ""
    mc_num = ""
    phy_addr = ""
    status_val = ""
    
    for tr in soup.find_all('tr'):
        tds = [t.text.strip() for t in tr.find_all(['th', 'td'])]
        if len(tds) >= 2:
            label = tds[0]
            val = tds[1]
            if 'Legal Name:' in label: legal_name = val
            elif 'USDOT Status:' in label: status_val = val
            elif 'Phone:' in label: phone = val
            elif 'Power Units:' in label: power_units = val
            elif 'MC/MX/FF Number(s):' in label: mc_num = val
            elif 'Physical Address:' in label: phy_addr = val.replace('\n', ' ')

    print(f"USDOT {dot}:")
    print(f"  Company: {legal_name}")
    print(f"  MC#: {mc_num}")
    print(f"  Status: {status_val}")
    print(f"  Phone: {phone}")
    print(f"  Power Units: {power_units}")
    print(f"  Address: {phy_addr}\n")
