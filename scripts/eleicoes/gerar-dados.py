#!/usr/bin/env python3
"""Build the compact public dataset from the four-year TSE MG CSV recorte.

Expected input files in --input-dir:
  perfil_eleitor_secao_{2020,2022,2024,2026}_MG.csv
  detalhe_votacao_secao_{2020,2022,2024,2026}_MG.csv
  bweb_1t_MG_*.csv for the same years
"""
from __future__ import annotations
import argparse, csv, gzip, json, re, unicodedata
from collections import defaultdict
from datetime import date
from pathlib import Path

CITY_NAMES = {
    "ASTOLFO DUTRA": "Astolfo Dutra",
    "DONA EUSEBIA": "Dona Euzébia",
    "DONA EUZEBIA": "Dona Euzébia",
    "CATAGUASES": "Cataguases",
}
CITY_ORDER = ["Astolfo Dutra", "Dona Euzébia", "Cataguases"]
PROFILE_FIELDS = [
    ("Faixa etária", "DS_FAIXA_ETARIA"),
    ("Gênero", "DS_GENERO"),
    ("Escolaridade", "DS_GRAU_ESCOLARIDADE"),
    ("Raça/cor", "DS_RACA_COR"),
    ("Estado civil", "DS_ESTADO_CIVIL"),
    ("Identidade de gênero", "DS_IDENTIDADE_GENERO"),
    ("Origem quilombola", "DS_QUILOMBOLA"),
    ("Intérprete de Libras", "DS_INTERPRETE_LIBRAS"),
]

def norm(value: object) -> str:
    s = unicodedata.normalize("NFKD", str(value or ""))
    s = "".join(ch for ch in s if not unicodedata.combining(ch))
    return re.sub(r"[^A-Z0-9]+", " ", s.upper()).strip()

def city_name(raw: str) -> str | None:
    return CITY_NAMES.get(norm(raw))

def integer(value: object) -> int:
    try: return int(str(value or "0").strip() or 0)
    except ValueError: return 0

def rows(path: Path):
    with path.open("r", encoding="latin-1", newline="") as stream:
        yield from csv.DictReader(stream, delimiter=";")

def section_key(city: str, year: int, row: dict[str, str]):
    return (city, year, str(row.get("NR_ZONA", "")), str(row.get("NR_SECAO", "")),
            str(row.get("NR_LOCAL_VOTACAO", "")))

def section_id(key: tuple) -> tuple:
    return key[:4]

def age_vote_obligation(label: str) -> str:
    v = norm(label)
    if not v: return "Não informado"
    if v.startswith("100") or v.startswith("95 ") or v.startswith("90 ") or v.startswith("85 ") or v.startswith("80 ") or v.startswith("75 ") or v.startswith("70 "):
        return "Facultativo"
    m = re.match(r"(\d+)", v)
    if m and int(m.group(1)) < 18: return "Facultativo"
    return "Obrigatório"

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input-dir", required=True, type=Path)
    parser.add_argument("--output", default=Path("public/dados-eleicao/eleicoes-mg.dat"), type=Path)
    args = parser.parse_args()
    base = args.input_dir
    profile_files = sorted(base.glob("perfil_eleitor_secao_*_MG.csv"))
    detail_files = sorted(base.glob("detalhe_votacao_secao_*_MG.csv"))
    bweb_files = sorted(base.glob("bweb_1t_MG_*.csv"))
    if len(profile_files) != 4 or len(detail_files) != 4 or len(bweb_files) != 4:
        raise SystemExit(f"Esperados 4 arquivos por tipo; encontrados perfil={len(profile_files)}, detalhe={len(detail_files)}, BWEB={len(bweb_files)}")

    # Municipality, year and section labels, plus aggregate electorate counts.
    local_names: dict[tuple, tuple[str, str]] = {}
    aptos_by_section: dict[tuple, int] = defaultdict(int)
    profile_counts: dict[tuple, int] = defaultdict(int)
    for path in profile_files:
        for r in rows(path):
            city = city_name(r.get("NM_MUNICIPIO", ""))
            if not city: continue
            year = integer(r.get("AA_ELEICAO") or r.get("ANO_ELEICAO"))
            key = section_key(city, year, r)
            local_names[key] = (str(r.get("NR_LOCAL_VOTACAO", "")), str(r.get("NM_LOCAL_VOTACAO", "")))
            count = integer(r.get("QT_ELEITORES") or r.get("QT_ELEITORES_PERFIL"))
            aptos_by_section[section_id(key)] += count
            for dimension, field in PROFILE_FIELDS:
                if field not in r:
                    continue
                category = (r.get(field) or "").strip() or "NÃO INFORMADO"
                if category == "#NE": category = "Não registrado neste ano"
                profile_counts[key + (dimension, category)] += count
            if "DS_FAIXA_ETARIA" in r:
                age = (r.get("DS_FAIXA_ETARIA") or "").strip()
                obligation = (r.get("TP_OBRIGATORIEDADE_VOTO") or "").strip() or age_vote_obligation(age)
                profile_counts[key + ("Obrigatoriedade do voto", obligation)] += count

    # The detail file has one row per section and office. Keep its first office
    # row for the attendance summary, matching the TSE section totals.
    turnout_by_section: dict[tuple, dict] = {}
    for path in detail_files:
        for r in rows(path):
            city = city_name(r.get("NM_MUNICIPIO", ""))
            if not city: continue
            year = integer(r.get("ANO_ELEICAO"))
            if integer(r.get("NR_TURNO")) != 1: continue
            key = section_key(city, year, r)
            local_names.setdefault(key, (str(r.get("NR_LOCAL_VOTACAO", "")), str(r.get("NM_LOCAL_VOTACAO", ""))))
            sid = section_id(key)
            if sid in turnout_by_section: continue
            turnout_by_section[sid] = {
                "localCode": key[4], "localName": str(r.get("NM_LOCAL_VOTACAO", "")),
                "aptos": integer(r.get("QT_APTOS")),
                "turnout": integer(r.get("QT_COMPARECIMENTO")),
                "abstentions": integer(r.get("QT_ABSTENCOES")),
                "nominal": integer(r.get("QT_VOTOS_NOMINAIS")),
                "blank": integer(r.get("QT_VOTOS_BRANCOS")),
                "null": integer(r.get("QT_VOTOS_NULOS")),
                "partyVotes": integer(r.get("QT_VOTOS_LEGENDA")),
            }

    # Each BWEB record is one candidate/voting-type tally for a section/office.
    votes = []
    bweb_first: dict[tuple, dict] = {}
    for path in bweb_files:
        for r in rows(path):
            city = city_name(r.get("NM_MUNICIPIO", ""))
            if not city: continue
            year = integer(r.get("ANO_ELEICAO"))
            if integer(r.get("NR_TURNO")) != 1: continue
            key = section_key(city, year, r)
            local = local_names.get(key)
            if local is None:
                local = (str(r.get("NR_LOCAL_VOTACAO", "")), "")
                local_names[key] = local
            if section_id(key) not in bweb_first: bweb_first[section_id(key)] = r
            votes.append({
                "city": city, "year": year, "zone": key[2], "section": key[3],
                "localCode": key[4], "localName": local[1],
                "cargo": str(r.get("DS_CARGO_PERGUNTA", "")).strip(),
                "candidateNumber": str(r.get("NR_VOTAVEL", "")).strip(),
                "candidateName": str(r.get("NM_VOTAVEL", "")).strip(),
                "party": str(r.get("SG_PARTIDO", "")).strip(),
                "votes": integer(r.get("QT_VOTOS")),
            })

    # Keep all profile sections available in the dashboard, even where the
    # TSE has no result row, and use BWEB for any section omitted in detail.
    turnout = []
    profile_sections = {}
    for key, (local_code, local_name) in local_names.items():
        sid = section_id(key)
        if sid not in profile_sections:
            profile_sections[sid] = {"localCode": local_code, "localName": local_name}
    all_section_ids = set(profile_sections) | set(turnout_by_section) | set(bweb_first)
    for sid in sorted(all_section_ids):
        city, year, zone, section = sid
        prof = profile_sections.get(sid, {})
        stats = turnout_by_section.get(sid)
        local_code = prof.get("localCode", "")
        local_name = prof.get("localName", "")
        if stats is None:
            first = bweb_first.get(sid)
            if first:
                local_code = str(first.get("NR_LOCAL_VOTACAO", ""))
                local_name = local_names.get((city, year, zone, section, local_code), (local_code, ""))[1]
            stats = {
                "aptos": integer(first.get("QT_APTOS")) if first else aptos_by_section.get(sid, 0),
                "turnout": integer(first.get("QT_COMPARECIMENTO")) if first else 0,
                "abstentions": integer(first.get("QT_ABSTENCOES")) if first else 0,
                "nominal": 0, "blank": 0, "null": 0, "partyVotes": 0,
            }
        else:
            local_code = stats.pop("localCode")
            local_name = stats.pop("localName")
        turnout.append({
            "city": city, "year": year, "zone": zone, "section": section,
            "localCode": local_code, "localName": local_name,
            **stats,
        })

    profile = []
    for key, count in sorted(profile_counts.items()):
        city, year, zone, section, local_code, dimension, category = key
        local_name = local_names.get((city, year, zone, section, local_code), (local_code, ""))[1]
        profile.append({
            "city": city, "year": year, "zone": zone, "section": section,
            "localCode": local_code, "localName": local_name,
            "dimension": dimension, "category": category, "count": count,
        })

    available = sorted({r["city"] for r in votes} | {r["city"] for r in turnout}, key=CITY_ORDER.index)
    all_years = sorted({r["year"] for r in votes} | {r["year"] for r in profile})
    missing = [city for city in CITY_ORDER if city not in available]
    notice = "Dados consultáveis de " + " e ".join(available) + "."
    if missing:
        notice += " Não foram encontrados arquivos para " + " e ".join(missing) + "."
    notice += " Resultados nominais por seção disponíveis para o 1º turno de 2020, 2022, 2024 e 2026. O perfil da seção não revela o voto de qualquer pessoa ou grupo demográfico."
    data = {
        "city": "Cataguases", "municipalityCode": "43052", "cities": CITY_ORDER,
        "availableCities": available, "partial": bool(missing), "notice": notice,
        "notices": [notice], "years": all_years,
        "updatedAt": date.today().isoformat(), "turnout": turnout,
        "votes": votes, "profile": profile,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with args.output.open("wb") as raw:
        with gzip.GzipFile(fileobj=raw, mode="wb", compresslevel=9, mtime=0) as zipped:
            zipped.write(json.dumps(data, ensure_ascii=False, separators=(",", ":")).encode("utf-8"))
    print(json.dumps({"output": str(args.output), "cities": available, "years": all_years,
                      "turnout_rows": len(turnout), "vote_rows": len(votes), "profile_rows": len(profile),
                      "size_bytes": args.output.stat().st_size}, ensure_ascii=False))

if __name__ == "__main__": main()
