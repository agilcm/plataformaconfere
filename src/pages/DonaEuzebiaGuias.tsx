// /dados/ › Dona Euzébia: separa a guia de INSS em duas, uma do FUNDEB e outra do restante.
// Lê o "Detalhamento de Guias por Dotação" (SiplanWeb) no navegador; nada é enviado nem guardado.
import { useMemo, useRef, useState } from 'react';
import { Icon } from '../components/ui.tsx';
import {
  abasReferencia,
  blocosPdfGuias,
  departamentos,
  dividirPorCodigo,
  ehFundeb,
  juntarCentros,
  lerDarf,
  lerDetalhamento,
  mesmoMunicipio,
  numeroBR,
  separarGuias,
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
const card = 'p-5 sm:p-6 rounded-2xl bg-white border border-slate-200';
const botao =
  'inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-[15px] font-bold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed';

type Centro = ReturnType<typeof lerDetalhamento>['centros'][number];
type Darf = NonNullable<ReturnType<typeof lerDarf>>;
const dinheiro = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function DonaEuzebiaGuias() {
  const [centros, setCentros] = useState<Centro[]>([]);
  const [prefeitura, setPrefeitura] = useState('');
  const [arquivos, setArquivos] = useState<string[]>([]);
  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  const [original, setOriginal] = useState('');
  const [origemOriginal, setOrigemOriginal] = useState('');
  const [lendo, setLendo] = useState('');
  const [aviso, setAviso] = useState('');
  const [verZerados, setVerZerados] = useState(false);
  const [darf, setDarf] = useState<Darf | null>(null);
  const inputDet = useRef<HTMLInputElement>(null);
  const inputGuia = useRef<HTMLInputElement>(null);

  const deps = useMemo(() => departamentos(centros), [centros]);
  const competencias = [...new Set(centros.map((c) => c.competencia))];
  const valorOriginal = original.trim() ? numeroBR(original.replace(/[^\d.,-]/g, '')) : null;
  const g = useMemo(() => separarGuias(centros, marcados, valorOriginal), [centros, marcados, valorOriginal]);
  const somaRelatorio = Math.round(centros.reduce((s, c) => s + c.liquido, 0) * 100) / 100;
  const temOutros = deps.some((d) => !marcados.has(d.nome));

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

  const lerDetalhamentos = async (lista: FileList) => {
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
    if (naoReconhecidos.length) setAviso(`Não reconheci ${naoReconhecidos.join(', ')}: não é o detalhamento nem uma guia com o valor total.`);
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
  };
  const nomeArquivo = `guias-inss-fundeb-${slug(info.competencia || 'competencia')}`;
  const listaFundeb = g.fundeb.filter((c) => verZerados || c.valorGuia || c.liquido || c.base);
  const porCodigo = darf ? dividirPorCodigo(darf, g.totalFundeb) : null;
  const outroMunicipio = darf && prefeitura && !mesmoMunicipio(darf.contribuinte, prefeitura);
  const outraCompetencia = darf && competencias.length > 0 && !competencias.some((c) => c.toLowerCase() === darf.periodo.toLowerCase());

  return (
    <div className="space-y-6">
      <div className={card}>
        <p className="text-lg font-bold text-[#0F2053]">Dona Euzébia · guias de INSS do FUNDEB e do restante</p>
        <p className="mt-1 text-[15px] text-slate-600 leading-relaxed max-w-3xl">
          Separa a guia de INSS em duas: uma só do FUNDEB e outra com o restante. A guia do FUNDEB soma segurados e patronal dos centros de custo do FUNDEB, sem
          abater salário-família e salário-maternidade. A do restante é a guia original menos a do FUNDEB. Os PDFs são lidos aqui no navegador; nada é enviado.
        </p>

        <div className="mt-5 grid lg:grid-cols-2 gap-5">
          <div>
            <p className="text-sm font-bold text-slate-600">1. O relatório e a guia (PDF)</p>
            <p className="text-sm text-slate-500">
              O “Detalhamento de Guias por Dotação” do SiplanWeb (uma página por centro de custo) e a guia original (DARF do DCTFWeb). Pode enviar os dois
              juntos.
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => inputDet.current?.click()}
                disabled={!!lendo}
                className={`${botao} bg-[#0F2053] hover:bg-[#13306f] text-white`}
              >
                <Icon name="doc" className="w-5 h-5" /> Enviar os PDFs
              </button>
              {centros.length > 0 && (
                <button type="button" onClick={limpar} className="text-sm font-bold text-slate-600 underline cursor-pointer">
                  Começar de novo
                </button>
              )}
            </div>
            <input
              ref={inputDet}
              type="file"
              accept="application/pdf,.pdf"
              multiple
              className="hidden"
              onChange={(e) => e.target.files?.length && lerDetalhamentos(e.target.files).finally(() => (e.target.value = ''))}
            />
            {arquivos.length > 0 && (
              <p className="mt-2 text-sm text-slate-600">
                {arquivos.join(', ')} · {centros.length} centros de custo · {info.competencia}
              </p>
            )}
          </div>
          <div>
            <p className="text-sm font-bold text-slate-600">2. Guia original (o total, numa guia só)</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <label className="relative">
                <span className="sr-only">Valor da guia original</span>
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">R$</span>
                <input
                  value={original}
                  onChange={(e) => {
                    setOriginal(e.target.value);
                    setOrigemOriginal('');
                    setDarf(null);
                  }}
                  inputMode="decimal"
                  placeholder="0,00"
                  className="w-44 pl-10 pr-3 py-2.5 rounded-xl border border-slate-300 text-base tabular-nums focus:outline-none focus:border-[#0478CA] focus:ring-2 focus:ring-[#0478CA]/20"
                />
              </label>
              <button
                type="button"
                onClick={() => inputGuia.current?.click()}
                disabled={!!lendo}
                className={`${botao} border-2 border-slate-200 text-[#0F2053] hover:border-[#0478CA]`}
              >
                {darf ? 'trocar a guia (DARF)' : 'ou enviar o PDF da guia (DARF)'}
              </button>
              {temOutros && somaRelatorio > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setOriginal(somaRelatorio.toLocaleString('pt-BR', { minimumFractionDigits: 2 }));
                    setOrigemOriginal('Soma do total líquido de todos os centros do relatório');
                  }}
                  className="text-sm font-bold text-[#0478CA] underline cursor-pointer"
                >
                  usar a soma do relatório ({brl(somaRelatorio)})
                </button>
              )}
            </div>
            <input
              ref={inputGuia}
              type="file"
              accept="application/pdf,.pdf"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && lerGuiaOriginal(e.target.files[0]).finally(() => (e.target.value = ''))}
            />
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
            Atenção: a guia é de <strong>{darf!.contribuinte}</strong> (CNPJ {darf!.cnpj}) e o relatório é de <strong>{prefeitura}</strong>. Confira se os dois
            arquivos são do mesmo município.
          </p>
        )}
        {outraCompetencia && (
          <p role="alert" className="mt-4 text-[15px] text-red-700">
            Atenção: a guia é de {darf!.periodo} e o relatório de {competencias.join(', ')}.
          </p>
        )}

        {deps.length > 0 && (
          <div className="mt-5 pt-4 border-t border-slate-100">
            <p className="text-sm font-bold text-slate-600 mb-2">3. Departamentos que vão para a guia do FUNDEB</p>
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
                    <span
                      aria-hidden="true"
                      className={`w-4 h-4 rounded border flex items-center justify-center text-[11px] ${on ? 'bg-white text-[#0F2053] border-white' : 'border-slate-400'}`}
                    >
                      {on ? '✓' : ''}
                    </span>
                    {d.nome}
                    {d.codigo ? ` (${d.codigo})` : ''}
                    <span className={on ? 'text-white/75' : 'text-slate-400'}>
                      · {d.centros} centros · {brl(d.valorGuia)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {centros.length > 0 && (
        <div className={card}>
          <div className="grid sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-[#0F2053] text-white">
              <p className="text-sm text-white/80">Guia do FUNDEB</p>
              <p className="text-2xl font-extrabold tabular-nums">{brl(g.guiaFundeb)}</p>
              <p className="text-xs text-white/75">
                segurados {brl(g.totalFundeb.segurados)} + patronal {brl(g.totalFundeb.patronal)}
                {g.totalFundeb.outros ? ` + outros ${brl(g.totalFundeb.outros)}` : ''}
              </p>
            </div>
            <div
              className={`p-4 rounded-xl ${g.guiaRestante != null && g.guiaRestante < 0 ? 'bg-red-50 border border-red-200' : 'bg-[#F7FAFD] border border-slate-200'}`}
            >
              <p className="text-sm text-slate-500">Guia do restante</p>
              <p className="text-2xl font-extrabold tabular-nums text-[#0F2053]">{g.guiaRestante == null ? 'Informe a guia original' : brl(g.guiaRestante)}</p>
              <p className="text-xs text-slate-500">guia original − guia do FUNDEB</p>
            </div>
            <div className="p-4 rounded-xl bg-[#F7FAFD] border border-slate-200">
              <p className="text-sm text-slate-500">Guia original</p>
              <p className="text-2xl font-extrabold tabular-nums text-[#0F2053]">{brl(g.guiaOriginal)}</p>
              <p className="text-xs text-slate-500">{origemOriginal || (valorOriginal != null ? 'digitado' : 'ainda não informado')}</p>
            </div>
          </div>
          {g.guiaRestante != null && g.guiaRestante < 0 && (
            <p className="mt-3 text-[15px] text-red-700">
              A guia do FUNDEB ficou maior que a original. Confira o valor da guia original e os departamentos marcados.
            </p>
          )}
          {g.deducoesForaDoFundeb > 0 && (
            <p className="mt-4 p-3 rounded-xl bg-amber-50 border border-amber-200 text-[15px] text-amber-900">
              Desconsiderados na guia do FUNDEB: salário-família {brl(g.totalFundeb.salarioFamilia)} e salário-maternidade {brl(g.totalFundeb.maternidade)}.
              Eles continuam abatidos na guia original, então ficam na guia do restante.
            </p>
          )}

          {porCodigo && (
            <div className="mt-6">
              <p className="font-bold text-[#0F2053]">Por código de receita · para emitir as duas guias no DCTFWeb</p>
              <p className="text-sm text-slate-500">
                Ao emitir cada guia, edite o valor de cada código com a coluna correspondente. Restante = guia original − FUNDEB, código por código.
              </p>
              <div className="mt-2 overflow-x-auto">
                <table className="w-full min-w-[720px] text-[15px]">
                  <thead className="bg-[#F7FAFD] text-left text-sm text-slate-500">
                    <tr>
                      <th className="px-3 py-2 font-semibold">Código</th>
                      <th className="px-3 py-2 font-semibold">Descrição</th>
                      <th className="px-3 py-2 font-semibold text-right">Guia original</th>
                      <th className="px-3 py-2 font-semibold text-right">Guia do FUNDEB</th>
                      <th className="px-3 py-2 font-semibold text-right">Guia do restante</th>
                    </tr>
                  </thead>
                  <tbody>
                    {porCodigo.linhas.map((l) => (
                      <tr key={`${l.codigo}-${l.detalhe}`} className="border-t border-slate-100">
                        <td className="px-3 py-2 tabular-nums font-semibold">
                          {l.codigo}-{l.detalhe}
                        </td>
                        <td className="px-3 py-2">{l.descricao}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{brl(l.total)}</td>
                        <td className="px-3 py-2 text-right tabular-nums font-bold">{brl(l.fundeb)}</td>
                        <td className={`px-3 py-2 text-right tabular-nums font-bold ${l.restante < 0 ? 'text-red-700' : ''}`}>{brl(l.restante)}</td>
                      </tr>
                    ))}
                    <tr className="border-t-2 border-slate-300 font-bold">
                      <td className="px-3 py-2" colSpan={2}>
                        Total
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{brl(porCodigo.linhas.reduce((s, l) => s + l.total, 0))}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{brl(porCodigo.linhas.reduce((s, l) => s + l.fundeb, 0))}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{brl(porCodigo.linhas.reduce((s, l) => s + l.restante, 0))}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              {porCodigo.linhas.some((l) => l.restante < 0) && (
                <p className="mt-2 text-[15px] text-red-700">
                  Algum código ficou negativo no restante: a parte do FUNDEB passou do valor da guia nesse código.
                </p>
              )}
              {porCodigo.semCodigo.length > 0 && (
                <p className="mt-2 text-[15px] text-red-700">
                  O FUNDEB tem valores sem código na guia: {porCodigo.semCodigo.map((c) => `${c.chave} ${c.nome} (${brl(c.valor)})`).join('; ')}.
                </p>
              )}
            </div>
          )}

          <div className="mt-5 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => baixarXlsx(`${nomeArquivo}.xlsx`, abasReferencia(g, info, darf))}
              className={`${botao} bg-[#1D6F42] hover:bg-[#185C37] text-white`}
            >
              <Icon name="sheet" className="w-5 h-5" /> Baixar planilha de referência (Excel)
            </button>
            <button
              type="button"
              onClick={() =>
                downloadPdf(`${nomeArquivo}.pdf`, 'Guias de INSS: FUNDEB e restante', [
                  { type: 'date', text: dateText() },
                  ...(blocosPdfGuias(g, info, darf) as any),
                ])
              }
              className={`${botao} bg-[#0478CA] hover:bg-[#03609F] text-white`}
            >
              <Icon name="doc" className="w-5 h-5" /> Relatório em PDF
            </button>
          </div>

          <div className="mt-6 flex flex-wrap items-baseline justify-between gap-2">
            <p className="font-bold text-[#0F2053]">Centros de custo do FUNDEB</p>
            <label className="inline-flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
              <input type="checkbox" checked={verZerados} onChange={(e) => setVerZerados(e.target.checked)} /> mostrar também os centros zerados
            </label>
          </div>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[720px] text-[15px]">
              <thead className="bg-[#F7FAFD] text-left text-sm text-slate-500">
                <tr>
                  <th className="px-3 py-2 font-semibold">Centro de custo</th>
                  <th className="px-3 py-2 font-semibold text-right">Base INSS</th>
                  <th className="px-3 py-2 font-semibold text-right">Segurados</th>
                  <th className="px-3 py-2 font-semibold text-right">Patronal</th>
                  <th className="px-3 py-2 font-semibold text-right">Sal.-família e maternidade (fora)</th>
                  <th className="px-3 py-2 font-semibold text-right">Valor para a guia</th>
                </tr>
              </thead>
              <tbody>
                {listaFundeb.map((c) => (
                  <tr key={`${c.depCodigo}-${c.ccCodigo}-${c.centro}`} className="border-t border-slate-100">
                    <td className="px-3 py-2">
                      {c.centro}
                      {c.ccCodigo ? <span className="text-slate-400"> ({c.ccCodigo})</span> : null}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{brl(c.base)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{brl(c.segurados)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{brl(c.patronal)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-500">{brl(c.salarioFamilia + c.maternidade)}</td>
                    <td className="px-3 py-2 text-right tabular-nums font-bold">{brl(c.valorGuia)}</td>
                  </tr>
                ))}
                <tr className="border-t-2 border-slate-300 font-bold">
                  <td className="px-3 py-2">Total ({g.fundeb.length} centros)</td>
                  <td className="px-3 py-2 text-right tabular-nums">{brl(g.totalFundeb.base)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{brl(g.totalFundeb.segurados)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{brl(g.totalFundeb.patronal)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{brl(g.totalFundeb.salarioFamilia + g.totalFundeb.maternidade)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{brl(g.guiaFundeb)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-sm text-slate-500">
            Valor para a guia = total líquido do relatório + salário-família + salário-maternidade (o mesmo que segurados + patronal). Confira com a guia gerada
            antes de pagar.
          </p>
        </div>
      )}
    </div>
  );
}
