import requests
import xml.etree.ElementTree as ET
import re

def check_rss(url):
    print(f"\nChecking RSS: {url}")
    r = requests.get(url, headers={'User-Agent': 'Mozilla/5.0'})
    root = ET.fromstring(r.content.strip())
    items = root.findall('.//item')
    for item in items[:2]:
        print('Title:', item.findtext('title'))
        
        # Check media:content
        media_content = item.findall('.//{http://search.yahoo.com/mrss/}content')
        if media_content:
            print('Media:', media_content[0].get('url'))
            
        # Check description for img tag
        desc = item.findtext('description', '')
        img_match = re.search(r'<img[^>]+src="([^">]+)"', desc)
        if img_match:
            print('Img from desc:', img_match.group(1))

check_rss('https://earth.org/feed/')
check_rss('https://news.google.com/rss/search?q=environment+pollution+india&hl=en-IN&gl=IN&ceid=IN:en')
check_rss('https://www.downtoearth.org.in/rss/pollution')
