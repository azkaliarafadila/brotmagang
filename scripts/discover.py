#!/usr/bin/env python3
"""Public job-feed discovery. No AI API keys, no scraping login pages."""
import datetime as dt
import hashlib
import json
import re
import urllib.request
import urllib.parse
from pathlib import Path
from html import unescape

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/"opportunities.json"
NOW=dt.datetime.now(dt.timezone.utc)
HEADERS={"User-Agent":"BrotMagang/2.0 (personal job discovery; GitHub Actions)","Accept":"application/json"}
PATTERN=re.compile(r"intern(ship)?|trainee|industrial attachment|summer analyst|working student|student assistant|graduate internship",re.I)
FIELDS=re.compile(r"pembangkit|pltu|pltgu|substation|protection|sld|engineering|electrical|energy|renewable|power|sustainab|business|operations|product|strategy|analyst|data|commercial|supply chain|project|software|consult|technology|procurement|research",re.I)
BLOCK=re.compile(r"senior|staff engineer|principal|director|head of|lead engineer|manager,|[5-9]\+ years",re.I)
REGION=re.compile(r"indonesia|jakarta|bogor|depok|tangerang|bekasi|remote|worldwide|anywhere|global|singapore|malaysia|taiwan|japan",re.I)
def get(url):
    req=urllib.request.Request(url,headers=HEADERS)
    with urllib.request.urlopen(req,timeout=22) as r:
        return json.load(r)
def clean(v):
    return re.sub(r"\s+"," ",unescape(re.sub(r"<[^>]*>"," ",str(v or "")))).strip()
POWER=re.compile(r"power plant|power generation|pembangkit|pltu|pltg|pltgu|plta|pltp|plts|power system|electrical protection|protection relay|relay coordination|single.line diagram|\\bsld\\b|switchgear|substation|gardu induk|load flow|short.circuit|electrical design|transmission|distribution network|grid engineering|electrical maintenance",re.I)
ENERGY=re.compile(r"energy|electrical|renewable|utility|power|solar|wind|geothermal|hydro|turbine|generator|transformer",re.I)
BUSINESS=re.compile(r"business|strategy|operations|commercial|finance|consult|analyst|product|project development",re.I)
QUAL=re.compile(r"undergraduate|bachelor|b\\.?sc|degree|university student|currently enrolled|active student|final.year|semester|major|electrical engineering|power engineering|gpa|ipk|proficien|experience|knowledge of|familiar with|protection|single.line diagram|\\bsld\\b|autocad|etap|dig\\s*s ilent|powerfactory|excel|english|communication|must have|required|qualification|eligib|work authorization|citizen|visa|graduate|graduation|available|duration|months|weeks",re.I)
def categorize(j):
    t=j["title"]+" "+j["description"][:1800]
    if POWER.search(t):return "Power Systems / Generation"
    if ENERGY.search(t):return "Energy / Electrical"
    if BUSINESS.search(t):return "Business / Strategy"
    return "Other Engineering / Tech"
def qualification_summary(description):
    # Extract source-text sentences; never invent a qualification or infer eligibility.
    if not description:return []
    sentences=re.split(r"(?<=[.!?])\\s+|\\s*[•\\n]\\s*",description)
    selected=[]
    for item in sentences:
        item=item.strip(" -•")
        if 15<=len(item)<=260 and QUAL.search(item) and item not in selected:
            selected.append(item)
        if len(selected)>=5:break
    return selected
def score(j):
    s=30
    t=(j["title"]+" "+j["description"][:900]).lower()
    loc=j["location"].lower()
    if re.search(r"intern|internship",j["title"],re.I):s+=30
    if re.search(r"energy|power|electrical|renewable|tech|product|business|operations|analyst",t):s+=15
    if "indonesia" in loc or "jakarta" in loc:s+=18
    if "remote" in loc or "worldwide" in loc:s+=8
    if re.search(r"4.?8 weeks|1.?2 months|summer 2027|2027 summer",t):s+=8
    if re.search(r"undergraduate|currently enrolled|university student|final.year student|active student",t):s+=5
    if POWER.search(j["title"]):s+=45
    elif POWER.search(t):s+=25
    elif ENERGY.search(j["title"]):s+=18
    return min(s,100)
def normalize(source,company,title,url,location,description,posted):
    title=clean(title);company=clean(company);location=clean(location);description=clean(description)
    if not title or not company or not url.startswith("https://"):return None
    if not PATTERN.search(title):return None
    if not FIELDS.search(title+" "+description[:1100]):return None
    if BLOCK.search(title):return None
    # Remote roles outside Indonesia remain visible, but work authorization is NOT assumed.
    # Do not discard legitimate international internships just because the location is not on a short allowlist.
    # Eligibility is assessed separately; the listing remains an unverified lead.
    key=hashlib.sha256((company.lower()+"|"+title.lower()+"|"+url).encode()).hexdigest()[:16]
    return dict(id=key,company=company,title=title,url=url,location=location or "Not stated",
                source=source,posted_at=str(posted or "")[:30],description=description[:4000],
                score=0,status="SOURCE_LISTED_UNVERIFIED",duration="Not verified",eligibility="Not verified")
jobs=[];errors=[];counts={}
try:
    d=get("https://www.arbeitnow.com/api/job-board-api")
    items=d.get("data",[])
    counts["Arbeitnow"]=len(items)
    for x in items:
        loc=x.get("location") or ("Remote" if x.get("remote") else "")
        j=normalize("Arbeitnow",x.get("company_name"),x.get("title"),x.get("url"),loc,x.get("description"),x.get("created_at"))
        if j:jobs.append(j)
except Exception as e:errors.append("Arbeitnow: "+type(e).__name__)
try:
    d=get("https://remotive.com/api/remote-jobs?limit=500")
    items=d.get("jobs",[])
    counts["Remotive"]=len(items)
    for x in items:
        j=normalize("Remotive",x.get("company_name"),x.get("title"),x.get("url"),x.get("candidate_required_location") or "Remote",x.get("description"),x.get("publication_date"))
        if j:jobs.append(j)
except Exception as e:errors.append("Remotive: "+type(e).__name__)
# LinkedIn public guest search, best effort only. No login, private API, CAPTCHA bypass, or credentials.
# LinkedIn may return 403 or change markup; failure must be visible in the feed.
def linkedin_public():
    from html.parser import HTMLParser
    class Cards(HTMLParser):
        def __init__(self):
            super().__init__();self.in_card=0;self.field=None;self.card=None;self.cards=[]
        def handle_starttag(self,tag,attrs):
            a=dict(attrs);classes=a.get("class","")
            if tag=="li" and self.in_card==0:
                self.in_card=1;self.card={"title":"","company":"","location":"","url":""}
            elif self.in_card:
                if tag=="a" and "base-card__full-link" in classes:self.field="url";self.card["url"]=a.get("href","").split("?")[0]
                elif tag in ("h3","h4","span") and "base-search-card__title" in classes:self.field="title"
                elif tag in ("h4","a") and "base-search-card__subtitle" in classes:self.field="company"
                elif "job-search-card__location" in classes:self.field="location"
        def handle_data(self,data):
            if self.in_card and self.field in ("title","company","location"):self.card[self.field]+=data.strip()+" "
        def handle_endtag(self,tag):
            if self.in_card and tag in ("h3","h4","span","a"):self.field=None
            if tag=="li" and self.in_card:
                if self.card["title"].strip() and self.card["url"]:self.cards.append(self.card)
                self.in_card=0;self.field=None
    total=0
    for keywords,location in [("power plant internship","Indonesia"),("electrical engineering internship","Indonesia"),("power system internship","Indonesia"),("business internship","Indonesia"),("summer 2027 internship","Singapore")]:
        query=urllib.parse.urlencode({"keywords":keywords,"location":location,"f_TPR":"r2592000","start":0})
        url="https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?"+query
        req=urllib.request.Request(url,headers={"User-Agent":"Mozilla/5.0 (compatible; BROTMagang/3.0; public job listings)","Accept":"text/html"})
        try:
            with urllib.request.urlopen(req,timeout=18) as resp:html=resp.read(600000).decode("utf-8","replace")
            parser=Cards();parser.feed(html)
            for x in parser.cards:
                j=normalize("LinkedIn public listing",x["company"],x["title"],x["url"],x["location"],"",None)
                if j:jobs.append(j);total+=1
        except Exception as exc:
            errors.append("LinkedIn public listings unavailable ("+type(exc).__name__+"); use direct LinkedIn search link")
    counts["LinkedIn public listings"]=total
linkedin_public()

# Public Greenhouse job boards (best-effort; board slugs may change).
# This expands beyond the two broad job aggregators without login scraping.
BOARDS={
    "Airbnb":"airbnb","Cloudflare":"cloudflare","Datadog":"datadog",
    "Figma":"figma","GitLab":"gitlab","Notion":"notion",
    "Stripe":"stripe","Wise":"wise","Canva":"canva",
    "Grab":"grab","Gojek":"gojek","Xendit":"xendit",
    "Schneider Electric":"schneiderelectric","NVIDIA":"nvidia",
    "Vercel":"vercel","Discord":"discord","Duolingo":"duolingo",
    "Canonical":"canonical","Reddit":"reddit","MongoDB":"mongodb"
}
for brand,slug in BOARDS.items():
    try:
        d=get("https://boards-api.greenhouse.io/v1/boards/"+slug+"/jobs?content=true")
        items=d.get("jobs",[])
        counts["Greenhouse "+brand]=len(items)
        for x in items:
            loc=(x.get("location") or {}).get("name","")
            j=normalize("Greenhouse / "+brand,brand,x.get("title"),x.get("absolute_url"),loc,x.get("content"),x.get("updated_at"))
            if j:jobs.append(j)
    except Exception:
        # A board may be missing, renamed, or rate limited.
        pass
# Target-company-first ranking. These names are preferences, not proof of eligibility.
TARGET_COMPANIES=("goto","gojek","tokopedia","tiktok","bytedance","traveloka","shopee","sea group","grab","xendit","telkom","telkomsel","dana","blibli","tiket.com","bukalapak","ruangguru","halodoc","alodokter","akulaku","kredivo","bibit","stockbit","jago","bank jago","siemens","abb","pln","pertamina","unilever","nestle","nestlé","mckinsey","boston consulting group","bcg","pwc","pricewaterhousecoopers")

def target_priority(j):
    name=j["company"].lower()
    return any(x in name for x in TARGET_COMPANIES)
unique={j["id"]:j for j in jobs}
for j in unique.values():
    j["score"]=score(j)
    j["category"]=categorize(j)
    j["qualification_summary"]=qualification_summary(j["description"])
    j["qualification_status"]="Source excerpts only — eligibility unverified" if j["qualification_summary"] else "Qualifications not available in feed — check source"
ordered=sorted(unique.values(),key=lambda j:(0 if j["category"]=="Power Systems / Generation" else 1 if j["category"]=="Energy / Electrical" else 2,not target_priority(j),-j["score"],j["company"]))[:120]
payload=dict(updated_at=NOW.isoformat(),sources=counts,errors=errors,count=len(ordered),
             notice="Automated public-feed leads, NOT verified open applications. Confirm eligibility, duration, location and deadline on employer website. No applications submitted.",
             opportunities=ordered)
OUT.write_text(json.dumps(payload,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
print(f"Published {len(ordered)} leads; sources={counts}; errors={errors}")
