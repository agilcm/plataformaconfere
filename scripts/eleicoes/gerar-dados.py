#!/usr/bin/env python3
"""Build the compact public dataset from the TSE MG CSV recorte (one set of files per election year).

Expected input files in --input-dir (2016, 2020, 2022, 2024 and 2026 today):
  perfil_eleitor_secao_{ANO}_MG.csv
  detalhe_votacao_secao_{ANO}_MG.csv
  bweb_1t_MG_*.csv for the same years (the 2016 BWEB has no header: the recorte adds the TSE layout names)
  consulta_cand_{ANO}.csv (optional): TSE candidate registry, for the civil name, the situation (eleito, suplente...)
    and to link the same person across elections. CPF, voter id and birth date are used only to link records and
    are never written to the public file: each person gets a sequential id.
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
    if not profile_files or len(profile_files) != len(detail_files) or len(detail_files) != len(bweb_files):
        raise SystemExit(f"Esperado um arquivo de cada tipo por ano; encontrados perfil={len(profile_files)}, detalhe={len(detail_files)}, BWEB={len(bweb_files)}")

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
            nome_local = str(r.get("NM_LOCAL_VOTACAO", "")).strip()
            if nome_local or key not in local_names:
                local_names[key] = (str(r.get("NR_LOCAL_VOTACAO", "")), nome_local)
            count = integer(r.get("QT_ELEITORES") or r.get("QT_ELEITORES_PERFIL"))
            aptos_by_section[section_id(key)] += count
            for dimension, field in PROFILE_FIELDS:
                if field not in r:
                    continue
                category = re.sub(r"\s+", " ", (r.get(field) or "").strip()) or "NÃO INFORMADO"
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
            if not local_names.get(key, ("", ""))[1]:
                local_names[key] = (str(r.get("NR_LOCAL_VOTACAO", "")), str(r.get("NM_LOCAL_VOTACAO", "")).strip())
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

    # 2016 profile rows carry no location name: an empty name takes the name the
    # same location code has elsewhere in the same city and year.
    name_by_code: dict[tuple, str] = {}
    for (city, year, _z, _s, code), (_c, name) in local_names.items():
        if name: name_by_code.setdefault((city, year, code), name)
    for key, (code, name) in list(local_names.items()):
        if not name: local_names[key] = (code, name_by_code.get((key[0], key[1], code), ""))

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
    anos_txt = ", ".join(str(a) for a in all_years[:-1]) + (" e " if len(all_years) > 1 else "") + str(all_years[-1])
    notice += f" Resultados nominais por seção disponíveis para o 1º turno de {anos_txt}. O perfil da seção não revela o voto de qualquer pessoa ou grupo demográfico."
    candidates = load_candidates(base, votes)
    data = {
        "city": "Cataguases", "municipalityCode": "43052", "cities": CITY_ORDER,
        "availableCities": available, "partial": bool(missing), "notice": notice,
        "notices": [notice], "years": all_years,
        "updatedAt": date.today().isoformat(), "turnout": turnout,
        "votes": votes, "profile": profile, "candidates": candidates,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with args.output.open("wb") as raw:
        with gzip.GzipFile(fileobj=raw, mode="wb", compresslevel=9, mtime=0) as zipped:
            zipped.write(json.dumps(data, ensure_ascii=False, separators=(",", ":")).encode("utf-8"))
    print(json.dumps({"output": str(args.output), "cities": available, "years": all_years,
                      "turnout_rows": len(turnout), "vote_rows": len(votes), "profile_rows": len(profile),
                      "candidates": len(candidates), "people": len({c["person"] for c in candidates}),
                      "size_bytes": args.output.stat().st_size}, ensure_ascii=False))

MUNICIPAL = {"PREFEITO", "VEREADOR"}


def scope_of(cargo: str, city: str) -> str:
    c = norm(cargo)
    return city if c in MUNICIPAL else ("BR" if c == "PRESIDENTE" else "MG")


def situation(raw: str) -> str:
    v = norm(raw)
    if not v or v in {"NULO", "NE"}: return ""
    if v.startswith("ELEITO POR QP"): return "Eleito por QP"
    if v.startswith("ELEITO POR MEDIA"): return "Eleito por média"
    if v.startswith("ELEITO"): return "Eleito"
    if v.startswith("SUPLENTE"): return "Suplente"
    if v.startswith("NAO ELEITO"): return "Não eleito"
    if v.startswith("2 TURNO") or v.startswith("2O TURNO"): return "2º turno"
    return raw.strip().capitalize()


def load_candidates(base: Path, votes: list[dict]) -> list[dict]:
    """Civil name, situation and a person id for every candidacy that got votes in the three cities."""
    files = sorted(base.glob("consulta_cand_*.csv"))
    if not files: return []
    voted = {(v["year"], norm(v["cargo"]), v["candidateNumber"], scope_of(v["cargo"], v["city"])) for v in votes}
    records: dict[tuple, dict] = {}
    for path in files:
        with path.open(encoding="utf-8", newline="") as f:
            for r in csv.DictReader(f, delimiter=";"):
                year = integer(r.get("ANO_ELEICAO"))
                cargo = norm(r.get("DS_CARGO"))
                city = city_name(r.get("NM_UE", "")) if cargo in MUNICIPAL else ""
                if cargo in MUNICIPAL and not city: continue
                scope = city if cargo in MUNICIPAL else ("BR" if cargo == "PRESIDENTE" else "MG")
                key = (year, cargo, str(r.get("NR_CANDIDATO", "")).strip(), scope)
                if key not in voted: continue
                turno = integer(r.get("NR_TURNO")) or 1
                old = records.get(key)
                if old and old["_turno"] >= turno: continue
                records[key] = {"_turno": turno, "_cpf": re.sub(r"\D", "", r.get("NR_CPF_CANDIDATO", "")),
                                "_titulo": re.sub(r"\D", "", r.get("NR_TITULO_ELEITORAL_CANDIDATO", "")),
                                "_nasc": (r.get("DT_NASCIMENTO") or "").strip(), "_row": r, "key": key}
    # union-find: same CPF, same voter id or same civil name + birth date = same person
    parent = {k: k for k in records}
    def find(k):
        while parent[k] != k:
            parent[k] = parent[parent[k]]; k = parent[k]
        return k
    seen: dict[tuple, tuple] = {}
    for k, rec in records.items():
        name = norm(rec["_row"].get("NM_CANDIDATO"))
        links = []
        if len(rec["_cpf"]) == 11 and len(set(rec["_cpf"])) > 1: links.append(("cpf", rec["_cpf"]))
        if len(rec["_titulo"]) >= 10 and len(set(rec["_titulo"])) > 1: links.append(("tit", rec["_titulo"]))
        if name and re.match(r"\d{2}/\d{2}/\d{4}$", rec["_nasc"]): links.append(("nome", name, rec["_nasc"]))
        for link in links:
            if link in seen: parent[find(k)] = find(seen[link])
            else: seen[link] = k
    groups: dict[tuple, list] = defaultdict(list)
    for k in records: groups[find(k)].append(k)
    ordered = sorted(groups.values(), key=lambda ks: (norm(records[ks[0]]["_row"].get("NM_CANDIDATO")), min(k[0] for k in ks)))
    person = {k: f"p{i + 1}" for i, ks in enumerate(ordered) for k in ks}
    out = []
    for k, rec in sorted(records.items(), key=lambda kv: (kv[0][0], kv[0][1], kv[0][3], kv[0][2])):
        r = rec["_row"]
        year, cargo, number, scope = k
        out.append({
            "year": year, "cargo": r.get("DS_CARGO", "").strip().title().replace(" De ", " de "), "number": number, "scope": scope,
            "name": re.sub(r"\s+", " ", r.get("NM_CANDIDATO", "")).strip(),
            "ballotName": re.sub(r"\s+", " ", r.get("NM_URNA_CANDIDATO", "")).strip(),
            "party": (r.get("SG_PARTIDO") or "").strip(), "situation": situation(r.get("DS_SIT_TOT_TURNO", "")),
            "person": person[k], "age": integer(r.get("NR_IDADE_DATA_POSSE")) or None,
            "occupation": (r.get("DS_OCUPACAO") or "").strip().capitalize(),
            "education": (r.get("DS_GRAU_INSTRUCAO") or "").strip().capitalize(),
            "gender": (r.get("DS_GENERO") or "").strip().capitalize(),
        })
    return out


if __name__ == "__main__": main()
