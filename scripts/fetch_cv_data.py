from __future__ import annotations

import json
import re
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import requests
import yaml

ROOT = Path(__file__).resolve().parents[1]
PROFILE_PATH = ROOT / "cv_profile.yaml"
OUTPUT_PATH = ROOT / "site-data.json"
ESEARCH_URL = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi"
ESUMMARY_URL = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi"
PUBMED_AUTHOR_QUERY = "Sheharyar Raza[Author - Full]"


def search_pubmed_pmids() -> list[str]:
    response = requests.get(
        ESEARCH_URL,
        params={
            "db": "pubmed",
            "term": PUBMED_AUTHOR_QUERY,
            "retmode": "json",
            "retmax": 200,
            "sort": "pub date",
            "tool": "raza-cv",
        },
        timeout=30,
    )
    response.raise_for_status()
    pmids = response.json()["esearchresult"]["idlist"]

    seen: set[str] = set()
    ordered_pmids: list[str] = []
    for pmid in pmids:
        if pmid not in seen:
            ordered_pmids.append(pmid)
            seen.add(pmid)

    return ordered_pmids


def batched(values: list[str], size: int) -> list[list[str]]:
    return [values[index:index + size] for index in range(0, len(values), size)]


def normalize_whitespace(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def parse_publication_year(item: dict[str, Any]) -> str:
    sortpubdate = item.get("sortpubdate", "")
    if sortpubdate:
        return sortpubdate[:4]

    pubdate = item.get("pubdate", "")
    match = re.search(r"(19|20)\d{2}", pubdate)
    return match.group(0) if match else "Unknown"


def summarize_authors(authors: list[dict[str, Any]]) -> tuple[list[str], str]:
    names = [normalize_whitespace(author.get("name", "")) for author in authors if author.get("name")]
    if len(names) <= 6:
        return names, ", ".join(names)
    return names, ", ".join(names[:6]) + ", et al."


def extract_article_id(item: dict[str, Any], idtype: str) -> str | None:
    for article_id in item.get("articleids", []):
        if article_id.get("idtype") == idtype:
            return article_id.get("value")
    return None


def fetch_pubmed_records(pmids: list[str]) -> list[dict[str, Any]]:
    publications: list[dict[str, Any]] = []

    for batch in batched(pmids, 20):
        response = requests.get(
            ESUMMARY_URL,
            params={"db": "pubmed", "id": ",".join(batch), "retmode": "json"},
            timeout=30,
        )
        response.raise_for_status()
        payload = response.json()["result"]

        for uid in payload["uids"]:
            item = payload[uid]
            authors_list, authors_display = summarize_authors(item.get("authors", []))
            doi = extract_article_id(item, "doi")
            year = parse_publication_year(item)
            publication = {
                "pmid": uid,
                "title": normalize_whitespace(item.get("title", "")),
                "authors": authors_list,
                "authors_display": authors_display,
                "journal": normalize_whitespace(item.get("fulljournalname", "") or item.get("source", "")),
                "publication_date": normalize_whitespace(item.get("pubdate", "")),
                "year": year,
                "doi": doi,
                "publication_types": item.get("pubtype", []),
                "pubmed_url": f"https://pubmed.ncbi.nlm.nih.gov/{uid}/",
                "sortpubdate": item.get("sortpubdate", ""),
            }
            publications.append(publication)

    publications.sort(key=lambda publication: publication.get("sortpubdate", ""), reverse=True)
    return publications


def load_profile() -> dict[str, Any]:
    return yaml.safe_load(PROFILE_PATH.read_text())


def curated_contributions() -> list[dict[str, str]]:
    return [
        {
            "title": "Plasma analysis from GADGET, ICTMG plasma guidelines",
            "type": "Rounds",
            "date": "March 26, 2026",
            "year": "2026",
            "venue": "University of Toronto Transfusion Medicine Rounds",
            "credit": "Presented by Dr. Nadia Gabarin and Dr. Sheharyar Raza.",
            "description": "ORBCoN event listing for the University of Toronto Transfusion Medicine Rounds.",
            "url": "https://transfusionontario.org/en/event/university-of-toronto-transfusion-medicine-rounds-march-26-2026/",
        },
        {
            "title": "AI applications for blood bank",
            "type": "Symposium Presentation",
            "date": "November 2025",
            "year": "2025",
            "venue": "Golden Horseshoe Education Supporting Transfusionists (GHEST) Symposium 2025",
            "credit": "Presentation by Dr. Sheharyar Raza during the afternoon program.",
            "description": "ORBCoN recap of the 2025 GHEST symposium in Oakville, Ontario.",
            "url": "https://transfusionontario.org/en/golden-horseshoe-education-supporting-transfusionists-ghest-symposium-2025/",
        },
        {
            "title": "Advancing transfusion practices for hemoglobinopathies",
            "type": "Congress Session",
            "date": "June 2, 2025",
            "year": "2025",
            "venue": "ISBT Milan 2025",
            "credit": "Listed with Arwa Al Riyami, Patrizia Zerra, Sheharyar Raza, Evan M. Bloch, and Khadija Niyaz Mohammad.",
            "description": "International Society of Blood Transfusion resource entry for a congress session.",
            "url": "https://www.isbtweb.org/resource/advancing-transfusion-practices-for-hemoglobinopathies.html",
        },
        {
            "title": "Early Cold Stored Platelet Transfusion Following Severe Injury",
            "type": "LearnTransfusion Seminar",
            "date": "January 7, 2025",
            "year": "2025",
            "venue": "Canadian Blood Services Professional Education",
            "credit": "Presented by Dr. Sheharyar Raza, Transfusion Medicine Physician Trainee, University of Toronto.",
            "description": "LearnTransfusion event page outlining the seminar and learning objectives.",
            "url": "https://professionaleducation.blood.ca/en/early-cold-stored-platelet-transfusion-following-severe-injury",
        },
        {
            "title": "The International Collaboration for Transfusion Medicine Guidelines’ (ICTMG) Use of Intravenous Albumin guideline: Moving evidence into practice",
            "type": "Webinar",
            "date": "September 6, 2024",
            "year": "2024",
            "venue": "Breakthroughs in Blood: Advancements into Action",
            "credit": "Presented by Sheharyar Raza, MD, MSc, FRCPC, Transfusion Medicine – Toronto, Canada.",
            "description": "Canadian Blood Services professional education webinar page with recording and slide materials.",
            "url": "https://professionaleducation.blood.ca/en/international-collaboration-transfusion-medicine-guidelines-ictmg-use-intravenous-albumin-guideline",
        },
    ]


def build_site_data() -> dict[str, Any]:
    profile = load_profile()["profile"]
    pmids = search_pubmed_pmids()
    publications = fetch_pubmed_records(pmids)
    publication_years = Counter(publication["year"] for publication in publications)
    contributions = curated_contributions()

    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "name": "Sheharyar Raza",
        "headline": "Interactive curriculum vitae",
        "summary": (
            "Hematology, transfusion medicine, biostatistics, scientific writing, "
            "computer programming, and artificial intelligence."
        ),
        "skills": profile["skills"]["items"],
        "formal_education": profile["formal_education"]["items"],
        "professional_experience": profile["professional_experience"]["items"],
        "publications": publications,
        "publication_years": dict(sorted(publication_years.items(), reverse=True)),
        "publication_count": len(publications),
        "other_contributions": contributions,
        "other_contributions_count": len(contributions),
        "stats": [
            {"label": "PubMed publications", "value": str(len(publications))},
            {"label": "Other contributions", "value": str(len(contributions))},
            {"label": "Current academic track", "value": "MSc Candidate"},
        ],
    }


def main() -> None:
    data = build_site_data()
    OUTPUT_PATH.write_text(json.dumps(data, indent=2))
    print(f"Wrote {OUTPUT_PATH}")
    print(f"Publications: {data['publication_count']}")
    print(f"Other contributions: {data['other_contributions_count']}")


if __name__ == "__main__":
    main()
