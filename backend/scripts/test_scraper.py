import requests
from bs4 import BeautifulSoup
import sys
import xml.etree.ElementTree as ET

def test_fetch():
    # 1. Get an RSS item
    url = "https://news.google.com/rss/search?q=weather+mumbai"
    r = requests.get(url)
    root = ET.fromstring(r.text)
    item = root.find(".//item")
    if not item:
        print("No item found")
        return
    link = item.findtext("link")
    print(f"Original link: {link}")
    
    # 2. Try fetching the link
    try:
        user_agent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        res = requests.get(link, headers={"User-Agent": user_agent}, allow_redirects=True, timeout=10)
        print(f"Resolved URL: {res.url}")
        print(f"Status Code: {res.status_code}")
        
        # 3. Simple text extraction
        try:
            from bs4 import BeautifulSoup
            soup = BeautifulSoup(res.text, 'html.parser')
            # remove scripts
            for s in soup(["script", "style", "nav", "footer", "header"]):
                s.decompose()
            paragraphs = soup.find_all('p')
            text = "\n\n".join([p.get_text().strip() for p in paragraphs if len(p.get_text().strip()) > 50])
            print(f"Extracted length: {len(text)}")
            print(text[:1000])
        except ImportError:
            print("bs4 not installed")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_fetch()
