// /dados/ › Dona Euzébia: guia de INSS do FUNDEB (e, com a guia original, a do restante).
// 1) a equipe digita a alíquota patronal e a do RAT ajustado; 2) envia o PDF "Detalhamento de Guias por Dotação"
// do SiplanWeb; 3) baixa a planilha. Os PDFs são lidos no navegador; nada é enviado nem guardado.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '../components/ui.tsx';
import {
  abasReferencia,
  aplicarAliquotas,
  blocosPdfGuias,
  departamentos,
  ehFundeb,
  juntarCentros,
  lerDarf,
  lerDetalhamento,
  mesmoMunicipio,
  numeroBR,
  porcentagem,
  separarGuias,
  tabelaCodigos,
  valorDaGuia,
} from '../lib/guiasDotacao.js';
import { dateText, downloadPdf, slug } from '../lib/pdfReport.ts';
import { linhasDoPdf } from '../lib/privado/pdfTexto.js';
import { baixarXlsx } from '../lib/xlsx.js';

let pdfjsCarregado: Promise<any> | null = null;
function pdfjs() {
  pdfjsCarregado ??= (async () => {
    const [lib, worker] = await Promise.all([import('pdfjs-dist'), import('pdfjs-dist/build/pdf.worker.min.mjs?url')]);
    lib.GlobalWorkerOptions.workerSrc = worker.default;
    return lib;
  })();
  return pdfjsCarregado;
}
async function linhasDe(arquivo: File) {
  return (await linhasDoPdf(await pdfjs(), new Uint8Array(await arquivo.arrayBuffer()))).linhas;
}

const brl = (v: number | null | undefined) => (v == null ? '—' : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
const pctTexto = (v: number | null | undefined) => (v == null ? '' : v.toLocaleString('pt-BR', { maximumFractionDigits: 4 }));
const dinheiro = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const card = 'p-5 sm:p-6 rounded-2xl bg-white border border-slate-200';
const botao =
  'inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-[15px] font-bold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed';
const campo =
  'w-full pl-3 pr-9 py-2.5 rounded-xl border border-slate-300 text-base tabular-nums focus:outline-none focus:border-[#0478CA] focus:ring-2 focus:ring-[#0478CA]/20';
const CHAVE_ALIQ = 'agilcm:euzebia:aliquotas';

type Centro = ReturnType<typeof lerDetalhamento>['centros'][number];
type Darf = NonNullable<ReturnType<typeof lerDarf>>;

export default function DonaEuzebiaGuias() {
  const [patronalTxt, setPatronalTxt] = useState('');
  const [ratTxt, setRatTxt] = useState('');
  const [centros, setCentros] = useState<Centro[]>([]);
  const [prefeitura, setPrefeitura] = useState('');
  const [arquivos, setArquivos] = useState<string[]>([]);
  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  const [original, setOriginal] = useState('');
  const [origemOriginal, setOrigemOriginal] = useState('');
  const [darf, setDarf] = useState<Darf | null>(null);
  const [lendo, setLendo] = useState('');
  const [aviso, setAviso] = useState('');
  const [verZerados, setVerZerados] = useState(false);
  const inputPdf = useRef<HTMLInputElement>(null);
  const inputGuia = useRef<HTMLInputElement>(null);

  // as alíquotas do mês passado ficam lembradas neste navegador
  useEffect(() => {
    try {
      const a = JSON.parse(localStorage.getItem(CHAVE_ALIQ) || 'null');
      if (a?.patronal) setPatronalTxt(a.patronal);
      if (a?.rat) setRatTxt(a.rat);
    } catch {
      /* sem armazenamento */
    }
  }, []);
  useEffect(() => {
    try {
      if (patronalTxt || ratTxt) localStorage.setItem(CHAVE_ALIQ, JSON.stringify({ patronal: patronalTxt, rat: ratTxt }));
    } catch {
      /* sem armazenamento */
    }
  }, [patronalTxt, ratTxt]);

  const patronal = porcentagem(patronalTxt);
  const rat = porcentagem(ratTxt);
  const aliqDigitadas = patronal != null && rat != null;
  const doRelatorio = centros.find((c) => c.aliqEmpresa || c.aliqRat);
  const calculados = useMemo(() => aplicarAliquotas(centros, { patronal, rat }), [centros, patronal, rat]);
  const deps = useMemo(() => departamentos(calculados), [calculados]);
  const competencias = [...new Set(centros.map((c) => c.competencia))];
  const valorOriginal = original.trim() ? numeroBR(original.replace(/[^\d.,-]/g, '')) : null;
  const g = useMemo(() => separarGuias(calculados, marcados, valorOriginal), [calculados, marcados, valorOriginal]);

  /** A guia original: o DARF do DCTFWeb (com os códigos de receita) ou, sem ele, só o valor total achado no PDF */
  const usarGuia = (linhas: any[], nome: string) => {
    const d = lerDarf(linhas);
    if (d?.total) {
      setDarf(d);
      setOriginal(dinheiro(d.total));
      setOrigemOriginal(`DARF ${d.numero || nome} · ${d.contribuinte} · ${d.periodo} · vence em ${d.vencimento}`);
      return true;
    }
    const v = valorDaGuia(linhas);
    if (v == null) return false;
    setDarf(null);
    setOriginal(dinheiro(v));
    setOrigemOriginal(`Lido do PDF ${nome}`);
    return true;
  };

  const lerPdfs = async (lista: FileList) => {
    setAviso('');
    const novos: Centro[][] = [];
    const nomes: string[] = [];
    const naoReconhecidos: string[] = [];
    for (const arq of Array.from(lista)) {
      setLendo(`Lendo ${arq.name}…`);
      try {
        const linhas = await linhasDe(arq);
        const r = lerDetalhamento(linhas);
        if (!r.centros.length) {
          // não é o relatório: pode ser a guia original
          if (!usarGuia(linhas, arq.name)) naoReconhecidos.push(arq.name);
          continue;
        }
        if (r.prefeitura) setPrefeitura(r.prefeitura);
        novos.push(r.centros);
        nomes.push(arq.name);
      } catch {
        naoReconhecidos.push(arq.name);
      }
    }
    setLendo('');
    if (naoReconhecidos.length) setAviso(`Não reconheci ${naoReconhecidos.join(', ')}: não é o “Detalhamento de Guias por Dotação” nem uma guia.`);
    if (!novos.length) return;
    const todos = juntarCentros([centros, ...novos]);
    setCentros(todos);
    setArquivos((a) => [...new Set([...a, ...nomes])]);
    setMarcados(
      new Set(
        departamentos(todos)
          .filter((d) => ehFundeb(d.nome))
          .map((d) => d.nome),
      ),
    );
  };

  const lerGuiaOriginal = async (arq: File) => {
    setLendo(`Lendo ${arq.name}…`);
    try {
      if (usarGuia(await linhasDe(arq), arq.name)) setAviso('');
      else setAviso(`Não achei o valor total em ${arq.name}. Digite o valor da guia original.`);
    } catch {
      setAviso(`Não consegui ler ${arq.name}. Digite o valor da guia original.`);
    } finally {
      setLendo('');
    }
  };

  const limpar = () => {
    setCentros([]);
    setArquivos([]);
    setMarcados(new Set());
    setOriginal('');
    setOrigemOriginal('');
    setAviso('');
    setDarf(null);
  };

  const info = {
    prefeitura: prefeitura || 'Prefeitura Municipal de Dona Euzébia',
    competencia: competencias.join(', '),
    origemOriginal: origemOriginal || (valorOriginal != null ? 'Digitado na ferramenta' : ''),
    patronal: aliqDigitadas ? patronal : (doRelatorio?.aliqEmpresa ?? null),
    rat: aliqDigitadas ? rat : (doRelatorio?.aliqRat ?? null),
  };
  const nomeArquivo = `guia-inss-fundeb-${slug(info.competencia || 'competencia')}`;
  const baixarPlanilha = () => baixarXlsx(`${nomeArquivo}.xlsx`, abasReferencia(g, info, darf));
  const listaFundeb = g.fundeb.filter((c) => verZerados || c.valorGuia || c.liquido || c.base);
  const outroMunicipio = darf && prefeitura && !mesmoMunicipio(darf.contribuinte, prefeitura);
  const outraCompetencia = darf && competencias.length > 0 && !competencias.some((c) => c.toLowerCase() === darf.periodo.toLowerCase());
  const tf = g.totalFundeb;
  const codigos = tabelaCodigos(tf, darf);
  const comGuia = g.guiaOriginal != null;

  return (
    <div className="space-y-6">
      <div className={card}>
        <p className="text-lg font-bold text-[#0F2053]">Dona Euzébia · guia de INSS do FUNDEB</p>
        <p className="mt-1 text-[15px] text-slate-600 leading-relaxed max-w-3xl">
          Digite as alíquotas, envie o PDF do relatório e baixe a planilha. A guia do FUNDEB soma, em cada centro de custo do FUNDEB, os segurados, o patronal e
          o RAT ajustado (base patronal × alíquota), sem abater salário-família e salário-maternidade. O PDF é lido aqui no navegador; nada é enviado.
        </p>

        <div className="mt-5 grid lg:grid-cols-3 gap-6">
          <div>
            <p className="text-sm font-bold text-slate-600">1. Alíquotas</p>
            <div className="mt-2 grid grid-cols-2 gap-3 max-w-md">
              <label className="block">
                <span className="block text-sm text-slate-600 mb-1">Patronal (%)</span>
                <span className="relative block">
                  <input
                    value={patronalTxt}
                    onChange={(e) => setPatronalTxt(e.target.value)}
                    inputMode="decimal"
                    placeholder={pctTexto(doRelatorio?.aliqEmpresa) || 'ex.: 20'}
                    className={campo}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">%</span>
                </span>
              </label>
              <label className="block">
                <span className="block text-sm text-slate-600 mb-1">RAT ajustado (%)</span>
                <span className="relative block">
                  <input
                    value={ratTxt}
                    onChange={(e) => setRatTxt(e.target.value)}
                    inputMode="decimal"
                    placeholder={pctTexto(doRelatorio?.aliqRat) || 'ex.: 2'}
                    className={campo}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">%</span>
                </span>
              </label>
            </div>
            <p className="mt-2 text-sm text-slate-500">
              RAT ajustado = RAT × FAP. As duas ficam lembradas para o próximo mês.
              {doRelatorio && ` No relatório: ${pctTexto(doRelatorio.aliqEmpresa)}% e ${pctTexto(doRelatorio.aliqRat)}%.`}
            </p>
          </div>

          <div>
            <p className="text-sm font-bold text-slate-600">2. PDF do relatório</p>
            <p className="text-sm text-slate-500">O “Detalhamento de Guias por Dotação” do SiplanWeb, com uma página por centro de custo.</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => inputPdf.current?.click()}
                disabled={!!lendo}
                className={`${botao} bg-[#0F2053] hover:bg-[#13306f] text-white`}
              >
                <Icon name="doc" className="w-5 h-5" /> Enviar o PDF
              </button>
              {centros.length > 0 && (
                <button type="button" onClick={limpar} className="text-sm font-bold text-slate-600 underline cursor-pointer">
                  Começar de novo
                </button>
              )}
            </div>
            <input
              ref={inputPdf}
              type="file"
              accept="application/pdf,.pdf"
              multiple
              className="hidden"
              onChange={(e) => e.target.files?.length && lerPdfs(e.target.files).finally(() => (e.target.value = ''))}
            />
            {arquivos.length > 0 && (
              <p className="mt-2 text-sm text-slate-600">
                {arquivos.join(', ')} · {centros.length} centros de custo · {info.competencia}
              </p>
            )}
          </div>

          <div>
            <p className="text-sm font-bold text-slate-600">3. Guia completa (opcional)</p>
            <p className="text-sm text-slate-500">Anexe a guia completa (DARF do DCTFWeb) para gerar também a guia do restante, o que não é FUNDEB.</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => inputGuia.current?.click()}
                disabled={!!lendo}
                className={`${botao} border-2 border-[#0F2053] text-[#0F2053] hover:bg-[#0F2053]/5`}
              >
                <Icon name="doc" className="w-5 h-5" /> {darf ? 'Trocar a guia completa' : 'Anexar a guia completa'}
              </button>
              <input
                ref={inputGuia}
                type="file"
                accept="application/pdf,.pdf"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && lerGuiaOriginal(e.target.files[0]).finally(() => (e.target.value = ''))}
              />
            </div>
            <label className="mt-2 relative block w-56">
              <span className="sr-only">Valor total da guia completa</span>
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">R$</span>
              <input
                value={original}
                onChange={(e) => {
                  setOriginal(e.target.value);
                  setOrigemOriginal('');
                  setDarf(null);
                }}
                inputMode="decimal"
                placeholder="ou digite o valor total"
                className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-slate-300 text-base tabular-nums focus:outline-none focus:border-[#0478CA]"
              />
            </label>
            {origemOriginal && <p className="mt-1 text-sm text-slate-500">{origemOriginal}</p>}
          </div>
        </div>
        {lendo && <p className="mt-4 text-[15px] text-slate-700">{lendo}</p>}
        {aviso && <p className="mt-4 text-[15px] text-amber-900">{aviso}</p>}
        {competencias.length > 1 && (
          <p className="mt-4 text-[15px] text-red-700">Atenção: os PDFs são de competências diferentes ({competencias.join(', ')}).</p>
        )}
        {outroMunicipio && (
          <p role="alert" className="mt-4 p-3 rounded-xl bg-red-50 border border-red-200 text-[15px] text-red-800">
            Atenção: a guia completa é de <strong>{darf!.contribuinte}</strong> (CNPJ {darf!.cnpj}) e o relatório é de <strong>{prefeitura}</strong>.
          </p>
        )}
        {outraCompetencia && (
          <p role="alert" className="mt-4 text-[15px] text-red-700">
            Atenção: a guia completa é de {darf!.periodo} e o relatório de {competencias.join(', ')}.
          </p>
        )}

        {deps.length > 1 && (
          <div className="mt-5 pt-4 border-t border-slate-100">
            <p className="text-sm font-bold text-slate-600 mb-2">Departamentos que vão para a guia do FUNDEB</p>
            <div className="flex flex-wrap gap-2">
              {deps.map((d) => {
                const on = marcados.has(d.nome);
                return (
                  <button
                    key={d.nome}
                    type="button"
                    aria-pressed={on}
                    onClick={() =>
                      setMarcados((m) => {
                        const n = new Set(m);
                        if (on) n.delete(d.nome);
                        else n.add(d.nome);
                        return n;
                      })
                    }
                    className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-full text-sm font-semibold border cursor-pointer ${
                      on ? 'bg-[#0F2053] border-[#0F2053] text-white' : 'bg-white border-slate-300 text-slate-700 hover:border-[#0478CA]'
                    }`}
                  >
                    {d.nome}
                    {d.codigo ? ` (${d.codigo})` : ''} <span className={on ? 'text-white/75' : 'text-slate-500'}>· {d.centros} centros</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {centros.length > 0 && (
        <div className={card}>
          {!aliqDigitadas && (
            <p className="mb-4 p-3 rounded-xl bg-amber-50 border border-amber-200 text-[15px] text-amber-900">
              Usando as alíquotas do relatório ({pctTexto(doRelatorio?.aliqEmpresa)}% e {pctTexto(doRelatorio?.aliqRat)}%). Digite as suas no passo 1 para
              recalcular.
            </p>
          )}
          <div className="flex flex-wrap items-end gap-x-8 gap-y-4">
            <div>
              <p className="text-sm text-slate-500">Guia do FUNDEB</p>
              <p className="text-3xl font-extrabold tabular-nums text-[#0F2053]">{brl(g.guiaFundeb)}</p>
            </div>
            {comGuia && (
              <div>
                <p className="text-sm text-slate-500">Guia do restante (não FUNDEB)</p>
                <p className={`text-3xl font-extrabold tabular-nums ${g.guiaRestante! < 0 ? 'text-red-700' : 'text-[#0F2053]'}`}>{brl(g.guiaRestante)}</p>
                <p className="text-xs text-slate-500">guia completa {brl(g.guiaOriginal)} − FUNDEB</p>
              </div>
            )}
            <dl className="grid grid-cols-3 gap-x-6 gap-y-1 text-[15px]">
              <dt className="text-sm text-slate-500">Segurados</dt>
              <dt className="text-sm text-slate-500">Patronal ({pctTexto(info.patronal)}%)</dt>
              <dt className="text-sm text-slate-500">RAT ajustado ({pctTexto(info.rat)}%)</dt>
              <dd className="font-bold tabular-nums">{brl(tf.segurados)}</dd>
              <dd className="font-bold tabular-nums">{brl(tf.patronalEmpresa)}</dd>
              <dd className="font-bold tabular-nums">{brl(tf.gilrat)}</dd>
            </dl>
            <button type="button" onClick={baixarPlanilha} className={`${botao} ml-auto bg-[#1D6F42] hover:bg-[#185C37] text-white text-base px-5 py-3`}>
              <Icon name="sheet" className="w-5 h-5" /> Baixar a planilha
            </button>
          </div>
          <p className="mt-3 text-sm text-slate-500">
            Base patronal do FUNDEB: {brl(tf.baseTributavel)}.
            {aliqDigitadas && Math.abs(tf.diferencaRelatorio) >= 0.05 && (
              <>
                {' '}
                Com essas alíquotas, patronal + RAT ficam {brl(Math.abs(tf.diferencaRelatorio))} {tf.diferencaRelatorio > 0 ? 'acima' : 'abaixo'} do que o
                relatório calculou.
              </>
            )}{' '}
            Salário-família ({brl(tf.salarioFamilia)}) e salário-maternidade ({brl(tf.maternidade)}) não foram abatidos.
          </p>

          <div className="mt-6">
            <p className="font-bold text-[#0F2053]">{comGuia && darf ? 'Códigos das guias' : 'Códigos da guia do FUNDEB'}</p>
            <p className="text-sm text-slate-500">
              {darf
                ? 'Ao emitir cada guia no DCTFWeb, informe em cada código o valor da coluna correspondente. A última linha é o total de cada guia.'
                : 'O valor de cada código de receita na guia do FUNDEB. Anexe a guia completa (passo 3) para gerar também o restante de cada código.'}
            </p>
            <div className="mt-2 overflow-x-auto">
              <table className="w-full min-w-[640px] text-[15px]">
                <thead className="bg-[#F7FAFD] text-left text-sm text-slate-500">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Código</th>
                    <th className="px-3 py-2 font-semibold">Descrição</th>
                    {darf && <th className="px-3 py-2 font-semibold text-right">Guia completa</th>}
                    <th className="px-3 py-2 font-semibold text-right">Guia do FUNDEB</th>
                    {darf && <th className="px-3 py-2 font-semibold text-right">Guia do restante (não FUNDEB)</th>}
                  </tr>
                </thead>
                <tbody>
                  {codigos.linhas.map((l) => (
                    <tr key={l.chave} className="border-t border-slate-100">
                      <td className="px-3 py-2 tabular-nums font-semibold">{l.chave}</td>
                      <td className="px-3 py-2">
                        {l.descricao}
                        {l.faltaNaGuia && <span className="ml-2 text-sm font-bold text-red-700">não está na guia completa</span>}
                      </td>
                      {darf && <td className="px-3 py-2 text-right tabular-nums">{brl(l.completa)}</td>}
                      <td className="px-3 py-2 text-right tabular-nums font-bold">{brl(l.fundeb)}</td>
                      {darf && <td className={`px-3 py-2 text-right tabular-nums font-bold ${l.restante! < 0 ? 'text-red-700' : ''}`}>{brl(l.restante)}</td>}
                    </tr>
                  ))}
                  <tr className="border-t-2 border-slate-300 font-bold bg-[#F7FAFD]">
                    <td className="px-3 py-2" colSpan={2}>
                      Total {darf ? 'de cada guia' : 'da guia do FUNDEB'}
                    </td>
                    {darf && <td className="px-3 py-2 text-right tabular-nums">{brl(codigos.total.completa)}</td>}
                    <td className="px-3 py-2 text-right tabular-nums">{brl(codigos.total.fundeb)}</td>
                    {darf && <td className="px-3 py-2 text-right tabular-nums">{brl(codigos.total.restante)}</td>}
                  </tr>
                </tbody>
              </table>
            </div>
            {comGuia && !darf && (
              <p className="mt-2 text-sm text-slate-500">
                Com o valor digitado dá o total do restante ({brl(g.guiaRestante)}); para o valor de cada código, anexe o PDF da guia completa.
              </p>
            )}
          </div>

          <div className="mt-6 flex flex-wrap items-baseline justify-between gap-2">
            <p className="font-bold text-[#0F2053]">Centros de custo do FUNDEB</p>
            <label className="inline-flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
              <input type="checkbox" checked={verZerados} onChange={(e) => setVerZerados(e.target.checked)} /> mostrar também os zerados
            </label>
          </div>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[760px] text-[15px]">
              <thead className="bg-[#F7FAFD] text-left text-sm text-slate-500">
                <tr>
                  <th className="px-3 py-2 font-semibold">Centro de custo</th>
                  <th className="px-3 py-2 font-semibold text-right">Base patronal</th>
                  <th className="px-3 py-2 font-semibold text-right">Segurados</th>
                  <th className="px-3 py-2 font-semibold text-right">Patronal</th>
                  <th className="px-3 py-2 font-semibold text-right">RAT ajustado</th>
                  <th className="px-3 py-2 font-semibold text-right">Valor para a guia</th>
                </tr>
              </thead>
              <tbody>
                {listaFundeb.map((c) => (
                  <tr key={`${c.depCodigo}-${c.ccCodigo}-${c.centro}`} className="border-t border-slate-100">
                    <td className="px-3 py-2">
                      {c.centro}
                      {c.ccCodigo ? <span className="text-slate-500"> ({c.ccCodigo})</span> : null}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{brl(c.baseTributavel)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{brl(c.segurados)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{brl(c.patronalEmpresa)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{brl(c.gilrat)}</td>
                    <td className="px-3 py-2 text-right tabular-nums font-bold">{brl(c.valorGuia)}</td>
                  </tr>
                ))}
                <tr className="border-t-2 border-slate-300 font-bold">
                  <td className="px-3 py-2">Total ({g.fundeb.length} centros)</td>
                  <td className="px-3 py-2 text-right tabular-nums">{brl(tf.baseTributavel)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{brl(tf.segurados)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{brl(tf.patronalEmpresa)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{brl(tf.gilrat)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{brl(g.guiaFundeb)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            <button type="button" onClick={baixarPlanilha} className={`${botao} bg-[#1D6F42] hover:bg-[#185C37] text-white`}>
              <Icon name="sheet" className="w-5 h-5" /> Baixar a planilha
            </button>
            <button
              type="button"
              onClick={() =>
                downloadPdf(`${nomeArquivo}.pdf`, 'Guia de INSS do FUNDEB', [{ type: 'date', text: dateText() }, ...(blocosPdfGuias(g, info, darf) as any)])
              }
              className={`${botao} border-2 border-slate-200 text-[#0F2053] hover:border-[#0478CA]`}
            >
              <Icon name="doc" className="w-5 h-5" /> Relatório em PDF
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
