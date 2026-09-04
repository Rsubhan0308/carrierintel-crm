import cloudscraper
from bs4 import BeautifulSoup
import re

scraper = cloudscraper.create_scraper(
    browser={
        'browser': 'chrome',
        'platform': 'windows',
        'desktop': True
    }
)

url = "https://safer.fmcsa.dot.gov/query.asp?searchtype=ANY&query_type=queryCarrierSnapshot&query_param=USDOT&query_string=3800000"

try:
    res = scraper.get(url, timeout=15)
    print(f"Status Code: {res.status_code}, Length: {len(res.text)}")
    if res.status_code == 200:
        soup = BeautifulSoup(res.text, 'html.parser')
        
        # Check Legal Name
        legal_name_tag = soup.find('th', text=re.compile(r'Legal Name:', re.I))
        if legal_name_tag and legal_name_tag.find_next_sibling('td'):
            legal_name = legal_name_tag.find_next_sibling('td').text.strip()
            print("REAL Legal Name:", legal_name)
        else:
            print("HTML Title:", soup.title.string if soup.title else "No title")
            
        # Check Operating Status
        status_tag = soup.find('th', text=re.compile(r'Operating Status:', re.I))
        if status_tag and status_tag.find_next_sibling('td'):
            status = status_tag.find_next_sibling('td').text.strip()
            print("REAL Operating Status:", status)
except Exception as e:
    print("Cloudscraper error:", e)
