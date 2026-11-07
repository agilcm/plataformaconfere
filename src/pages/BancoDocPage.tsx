// /bancodoc/: conferência mensal dos documentos das prestadoras de serviço (co-responsabilidade da tomadora).
// Cadastro das prestadoras, book de documentos do mês, semáforo "pode pagar / travar pagamento" e
// notificação de pendências. Os dados ficam neste navegador; a leitura das pastas do Drive vem a seguir.
import { useEffect, useMemo, useRef, useState } from 'react';
import Header from '../components/Header.tsx';
import { Container, Icon } from '../components/ui.tsx';
import {
  BOOK,
  SITUACOES,
  STATUS,
  blocosNotificacao,
  competenciaAtual,
  itensDoMes,
  mensagemPendencias,
  nomeCompetencia,
  situacaoDoMes,
} from '../lib/bancodoc.js';
import {
  atualizarConferencia,
  chaveConferencia,
  exportarBancoDoc,
  importarBancoDoc,
  removerPrestadora,
  salvarPrestadora,
  useBancoDoc,
  type Prestadora,
} from '../lib/bancodocStore.ts';
import { dateText, downloadPdf, slug } from '../lib/pdfReport.ts';

type Aba = 'mes' | 'prestadoras' | 'como';
const card = 'p-5 sm:p-6 rounded-2xl bg-white border border-slate-200';
const botao =
  'inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-[15px] font-bold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed';
const campo =
  'w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-[15px] focus:outline-none focus:border-[#0478CA] focus:ring-2 focus:ring-[#0478CA]/20';
const SINAL = {
  pagar: { cor: 'bg-emerald-50 border-emerald-300 text-emerald-900', ponto: 'bg-emerald-600', curto: 'Pode pagar' },
  aguardando: { cor: 'bg-amber-50 border-amber-300 text-amber-900', ponto: 'bg-amber-500', curto: 'Não pagar ainda' },
  travar: { cor: 'bg-red-50 border-red-300 text-red-900', ponto: 'bg-red-600', curto: 'Travar pagamento' },
} as const;
const dataBR = (iso: string) => iso.split('-').reverse().join('/');

export default function BancoDocPage() {
  const [aba, setAba] = useState<Aba>('mes');
  const dados = useBancoDoc();
  const [comp, setComp] = useState(competenciaAtual());
  const [selecionada, setSelecionada] = useState('');
  const prestadora = dados.prestadoras.find((p) => p.id === selecionada) || null;

  useEffect(() => {
    if (!selecionada && dados.prestadoras[0]) setSelecionada(dados.prestadoras[0].id);
  }, [dados.prestadoras, selecionada]);

  return (
    <>
      <Header page="bancodoc" />
      <main id="conteudo" className="bg-[#F4F7FB] min-h-screen py-10 sm:py-14">
        <Container>
          <h1 className="text-2xl sm:text-3xl font-bold font-display text-[#0F2053]">BancoDoc</h1>
          <p className="mt-1 max-w-3xl text-[15px] text-slate-600 leading-relaxed">
            Documentos mensais das prestadoras de serviço. A tomadora responde junto se a prestadora não pagar salários, INSS ou FGTS; por isso cada prestadora
            comprova, todo mês, que está em dia. Sem os documentos conferidos, o pagamento fica travado.
          </p>
          <div role="tablist" aria-label="BancoDoc" className="mt-6 flex flex-wrap gap-2">
            {(
              [
                ['mes', 'Conferência do mês', 'check'],
                ['prestadoras', `Prestadoras (${dados.prestadoras.length})`, 'building'],
                ['como', 'Como funciona', 'doc'],
              ] as const
            ).map(([id, nome, icone]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={aba === id}
                onClick={() => setAba(id)}
                className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-[15px] font-bold border-2 transition-colors cursor-pointer ${
                  aba === id ? 'bg-[#0F2053] border-[#0F2053] text-white' : 'bg-white border-slate-200 text-[#0F2053] hover:border-[#0478CA]'
                }`}
              >
                <Icon name={icone} className="w-5 h-5" />
                {nome}
              </button>
            ))}
          </div>
          <div role="tabpanel" className="mt-6">
            {aba === 'mes' && (
              <ConferenciaDoMes
                prestadoras={dados.prestadoras}
                conferencias={dados.conferencias}
                comp={comp}
                setComp={setComp}
                selecionada={selecionada}
                setSelecionada={setSelecionada}
                prestadora={prestadora}
                irParaPrestadoras={() => setAba('prestadoras')}
              />
            )}
            {aba === 'prestadoras' && <Prestadoras prestadoras={dados.prestadoras} />}
            {aba === 'como' && <ComoFunciona />}
          </div>
        </Container>
      </main>
    </>
  );
}

// ---------------------------------------------------------------- conferência do mês

function ConferenciaDoMes({
  prestadoras,
  conferencias,
  comp,
  setComp,
  selecionada,
  setSelecionada,
  prestadora,
  irParaPrestadoras,
}: {
  prestadoras: Prestadora[];
  conferencias: ReturnType<typeof useBancoDoc>['conferencias'];
  comp: string;
  setComp: (c: string) => void;
  selecionada: string;
  setSelecionada: (id: string) => void;
  prestadora: Prestadora | null;
  irParaPrestadoras: () => void;
}) {
  const [copiado, setCopiado] = useState(false);
  const conf = prestadora ? conferencias[chaveConferencia(prestadora.id, comp)] : undefined;
  const s = useMemo(() => situacaoDoMes(conf || {}, comp, { dia: prestadora?.dia || 25 }), [conf, comp, prestadora]);
  const painel = prestadoras.map((p) => ({ p, s: situacaoDoMes(conferencias[chaveConferencia(p.id, comp)] || {}, comp, { dia: p.dia || 25 }) }));

  if (!prestadoras.length)
    return (
      <div className={`${card} text-center`}>
        <p className="text-lg font-bold text-[#0F2053]">Cadastre a primeira prestadora</p>
        <p className="mt-1 text-[15px] text-slate-600">Razão social, CNPJ, contrato e o link da pasta dela no Google Drive.</p>
        <button type="button" onClick={irParaPrestadoras} className={`${botao} mt-4 bg-[#0F2053] hover:bg-[#13306f] text-white`}>
          <Icon name="building" className="w-5 h-5" /> Cadastrar prestadora
        </button>
      </div>
    );

  const mudarItem = (id: string, status: 'pendente' | 'ok' | 'recusado' | 'na', motivo?: string) =>
    prestadora && atualizarConferencia(prestadora.id, comp, (c) => ({ ...c, itens: { ...c.itens, [id]: { status, motivo: motivo ?? c.itens[id]?.motivo } } }));
  const mudarSituacao = (id: string, v: boolean) =>
    prestadora && atualizarConferencia(prestadora.id, comp, (c) => ({ ...c, situacoes: { ...c.situacoes, [id]: v } }));
  const itens = itensDoMes(conf?.situacoes);
  const grupos = BOOK.filter((g) => itens.some((i) => i.grupo === g.id));

  return (
    <div className="space-y-6">
      <div className={card}>
        <div className="flex flex-wrap items-end gap-4">
          <label className="block">
            <span className="block text-sm font-bold text-slate-600 mb-1">Competência</span>
            <input type="month" value={comp} onChange={(e) => e.target.value && setComp(e.target.value)} className={`${campo} w-48`} />
          </label>
          <p className="text-[15px] text-slate-600">
            {nomeCompetencia(comp)} · documentos até <strong>{dataBR(s.prazo)}</strong>
          </p>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[640px] text-[15px]">
            <thead className="bg-[#F7FAFD] text-left text-sm text-slate-500">
              <tr>
                <th className="px-3 py-2 font-semibold">Prestadora</th>
                <th className="px-3 py-2 font-semibold">Situação em {nomeCompetencia(comp)}</th>
                <th className="px-3 py-2 font-semibold text-right">Conferidos</th>
              </tr>
            </thead>
            <tbody>
              {painel.map(({ p, s: sp }) => (
                <tr
                  key={p.id}
                  onClick={() => setSelecionada(p.id)}
                  className={`border-t border-slate-100 cursor-pointer ${p.id === selecionada ? 'bg-[#0478CA]/5' : 'hover:bg-slate-50'}`}
                >
                  <td className="px-3 py-2 font-semibold text-[#0F2053]">
                    {p.razao}
                    {p.contrato ? <span className="font-normal text-slate-500"> · contrato {p.contrato}</span> : null}
                  </td>
                  <td className="px-3 py-2">
                    <span className="inline-flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${SINAL[sp.sinal].ponto}`} aria-hidden="true" />
                      {SINAL[sp.sinal].curto}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {sp.conferidos} de {sp.total}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {prestadora && (
        <div className={card}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-lg font-bold text-[#0F2053]">{prestadora.razao}</p>
              <p className="text-sm text-slate-500">
                {[prestadora.cnpj && `CNPJ ${prestadora.cnpj}`, prestadora.contrato && `contrato ${prestadora.contrato}`, nomeCompetencia(comp)]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            </div>
            {prestadora.pasta && (
              <a
                href={prestadora.pasta}
                target="_blank"
                rel="noopener noreferrer"
                className={`${botao} border-2 border-slate-200 text-[#0F2053] hover:border-[#0478CA]`}
              >
                Abrir a pasta no Drive <Icon name="arrow" className="w-4 h-4" />
              </a>
            )}
          </div>

          <p role="status" className={`mt-4 p-4 rounded-xl border text-[15px] font-bold ${SINAL[s.sinal].cor}`}>
            {s.titulo}
            <span className="block text-sm font-normal">
              {s.conferidos} de {s.total} documentos conferidos
              {s.diasParaPrazo >= 0
                ? ` · faltam ${s.diasParaPrazo} ${s.diasParaPrazo === 1 ? 'dia' : 'dias'} para o prazo`
                : ` · prazo vencido em ${dataBR(s.prazo)}`}
            </span>
          </p>

          <div className="mt-5">
            <p className="text-sm font-bold text-slate-600 mb-2">No mês</p>
            <div className="grid sm:grid-cols-2 gap-2">
              {SITUACOES.map((q) => {
                const v = !!conf?.situacoes?.[q.id];
                return (
                  <div key={q.id} className="flex items-center justify-between gap-3 px-3 py-2 rounded-xl border border-slate-200">
                    <span className="text-[15px] text-slate-700">{q.pergunta}</span>
                    <span className="flex shrink-0 rounded-lg bg-slate-100 p-0.5" role="group" aria-label={q.pergunta}>
                      {[
                        [false, 'Não'],
                        [true, 'Sim'],
                      ].map(([val, nome]) => (
                        <button
                          key={String(val)}
                          type="button"
                          aria-pressed={v === val}
                          onClick={() => mudarSituacao(q.id, val as boolean)}
                          className={`px-3 py-1 rounded-md text-sm font-bold cursor-pointer ${v === val ? 'bg-white text-[#0F2053] shadow-sm' : 'text-slate-500'}`}
                        >
                          {nome as string}
                        </button>
                      ))}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-6 space-y-5">
            {grupos.map((g) => (
              <div key={g.id}>
                <p className="text-[15px] font-extrabold text-[#0F2053]">Pasta “{g.pasta}”</p>
                <ul className="mt-2 divide-y divide-slate-100 rounded-xl border border-slate-200">
                  {g.itens.map((i) => {
                    const atual = conf?.itens?.[i.id] || { status: 'pendente' as const };
                    return (
                      <li key={i.id} className="px-3 py-2.5 flex flex-col lg:flex-row lg:items-center gap-2">
                        <span className="flex-1 min-w-0 text-[15px] text-slate-800">{i.nome}</span>
                        <span className="flex flex-wrap gap-1.5" role="group" aria-label={`Situação: ${i.nome}`}>
                          {(['ok', 'recusado', 'na', 'pendente'] as const).map((st) => (
                            <button
                              key={st}
                              type="button"
                              aria-pressed={atual.status === st}
                              onClick={() => mudarItem(i.id, st)}
                              className={`px-2.5 py-1 rounded-lg border text-sm font-semibold cursor-pointer ${
                                atual.status === st ? STATUS[st].cor : 'bg-white border-slate-200 text-slate-500 hover:border-slate-400'
                              }`}
                            >
                              {st === 'ok' ? 'Recebido' : STATUS[st].nome}
                            </button>
                          ))}
                        </span>
                        {atual.status === 'recusado' && (
                          <input
                            defaultValue={atual.motivo || ''}
                            onBlur={(e) => mudarItem(i.id, 'recusado', e.target.value)}
                            placeholder="Motivo da recusa"
                            aria-label={`Motivo da recusa: ${i.nome}`}
                            className={`${campo} lg:w-64`}
                          />
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>

          {s.sinal !== 'pagar' && (
            <div className="mt-6 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() =>
                  downloadPdf(`notificacao-${slug(prestadora.razao)}-${comp}.pdf`, 'Notificação de pendências documentais', [
                    { type: 'date', text: dateText() },
                    ...(blocosNotificacao(prestadora, comp, s) as any),
                  ])
                }
                className={`${botao} bg-[#0F2053] hover:bg-[#13306f] text-white`}
              >
                <Icon name="doc" className="w-5 h-5" /> Notificação de pendências (PDF)
              </button>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(mensagemPendencias(prestadora, comp, s));
                    setCopiado(true);
                    setTimeout(() => setCopiado(false), 2500);
                  } catch {
                    /* sem área de transferência */
                  }
                }}
                className={`${botao} border-2 border-slate-200 text-[#0F2053] hover:border-[#0478CA]`}
              >
                {copiado ? 'Mensagem copiada' : 'Copiar mensagem de cobrança'}
              </button>
              {prestadora.email && (
                <a
                  href={`mailto:${encodeURIComponent(prestadora.email)}?subject=${encodeURIComponent(`Pendências documentais · ${nomeCompetencia(comp)}`)}&body=${encodeURIComponent(mensagemPendencias(prestadora, comp, s))}`}
                  className={`${botao} border-2 border-slate-200 text-[#0F2053] hover:border-[#0478CA]`}
                >
                  Enviar por e-mail
                </a>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- prestadoras

const NOVA = { razao: '', cnpj: '', contrato: '', email: '', pasta: '', dia: 25 };

function Prestadoras({ prestadoras }: { prestadoras: Prestadora[] }) {
  const [form, setForm] = useState<typeof NOVA & { id?: string }>(NOVA);
  const [msg, setMsg] = useState('');
  const arquivo = useRef<HTMLInputElement>(null);
  const set = (k: keyof typeof NOVA, v: string) => setForm((f) => ({ ...f, [k]: k === 'dia' ? Number(v) || 25 : v }));
  const hoje = new Date().toISOString().slice(0, 10);

  return (
    <div className="grid lg:grid-cols-5 gap-6 items-start">
      <form
        className={`${card} lg:col-span-2 space-y-3`}
        onSubmit={(e) => {
          e.preventDefault();
          if (!form.razao.trim()) return;
          salvarPrestadora({ ...form, razao: form.razao.trim() });
          setMsg(form.id ? 'Prestadora atualizada.' : 'Prestadora cadastrada.');
          setForm(NOVA);
        }}
      >
        <p className="text-lg font-bold text-[#0F2053]">{form.id ? 'Editar prestadora' : 'Nova prestadora'}</p>
        {(
          [
            ['razao', 'Razão social', 'text', true],
            ['cnpj', 'CNPJ', 'text', false],
            ['contrato', 'Número do contrato', 'text', false],
            ['email', 'E-mail para cobrança', 'email', false],
            ['pasta', 'Link da pasta no Google Drive', 'url', false],
            ['dia', 'Prazo: dia do mês seguinte', 'number', false],
          ] as const
        ).map(([k, nome, tipo, obrig]) => (
          <label key={k} className="block">
            <span className="block text-sm text-slate-600 mb-1">{nome}</span>
            <input
              type={tipo}
              required={obrig}
              value={String(form[k] ?? '')}
              onChange={(e) => set(k, e.target.value)}
              min={k === 'dia' ? 1 : undefined}
              max={k === 'dia' ? 31 : undefined}
              className={campo}
            />
          </label>
        ))}
        <div className="flex flex-wrap gap-2 pt-1">
          <button type="submit" className={`${botao} bg-[#0F2053] hover:bg-[#13306f] text-white`}>
            {form.id ? 'Salvar' : 'Cadastrar'}
          </button>
          {form.id && (
            <button type="button" onClick={() => setForm(NOVA)} className="text-sm font-bold text-slate-600 underline cursor-pointer">
              Cancelar
            </button>
          )}
        </div>
        {msg && (
          <p role="status" className="text-[15px] text-emerald-800">
            {msg}
          </p>
        )}
      </form>

      <div className={`${card} lg:col-span-3`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-lg font-bold text-[#0F2053]">Prestadoras cadastradas</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!prestadoras.length}
              onClick={() => {
                const url = URL.createObjectURL(new Blob([exportarBancoDoc()], { type: 'application/json' }));
                const a = document.createElement('a');
                a.href = url;
                a.download = `bancodoc-${hoje}.json`;
                a.click();
                setTimeout(() => URL.revokeObjectURL(url), 1000);
              }}
              className="text-sm font-bold text-[#0478CA] underline cursor-pointer disabled:opacity-50"
            >
              Baixar cópia
            </button>
            <button type="button" onClick={() => arquivo.current?.click()} className="text-sm font-bold text-[#0478CA] underline cursor-pointer">
              Importar cópia
            </button>
            <input
              ref={arquivo}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                try {
                  setMsg(`${importarBancoDoc(await f.text())} prestadoras importadas.`);
                } catch {
                  setMsg('Esse arquivo não é uma cópia do BancoDoc.');
                } finally {
                  e.target.value = '';
                }
              }}
            />
          </div>
        </div>
        {!prestadoras.length ? (
          <p className="mt-3 text-[15px] text-slate-600">Nenhuma prestadora cadastrada ainda.</p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-100">
            {prestadoras.map((p) => (
              <li key={p.id} className="py-3 flex flex-wrap items-center gap-x-4 gap-y-1">
                <span className="flex-1 min-w-0">
                  <strong className="text-[#0F2053]">{p.razao}</strong>
                  <span className="block text-sm text-slate-500">
                    {[p.cnpj && `CNPJ ${p.cnpj}`, p.contrato && `contrato ${p.contrato}`, `prazo dia ${p.dia || 25}`].filter(Boolean).join(' · ')}
                  </span>
                </span>
                {p.pasta && (
                  <a href={p.pasta} target="_blank" rel="noopener noreferrer" className="text-sm font-bold text-[#0478CA] underline">
                    Pasta no Drive
                  </a>
                )}
                <button type="button" onClick={() => setForm({ ...NOVA, ...p })} className="text-sm font-bold text-slate-600 underline cursor-pointer">
                  Editar
                </button>
                <button
                  type="button"
                  onClick={() => window.confirm(`Tirar ${p.razao} e as conferências dela?`) && removerPrestadora(p.id)}
                  className="text-sm font-bold text-red-700 underline cursor-pointer"
                >
                  Remover
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-4 text-sm text-slate-500">Os dados ficam guardados neste navegador. Use “Baixar cópia” para levar a outro computador.</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- como funciona

function ComoFunciona() {
  const etapas: [string, string, boolean][] = [
    ['Cadastro das prestadoras', 'Razão social, CNPJ, contrato, e-mail de cobrança, link da pasta no Drive e o dia limite.', true],
    ['Conferência do mês', 'O book de documentos de cada competência, com recebido, recusado (com o motivo) ou não se aplica.', true],
    ['Semáforo do pagamento', 'Pode pagar quando tudo foi conferido; não pagar ainda antes do prazo; travar depois do prazo.', true],
    ['Notificação de pendências', 'PDF no padrão Ágil CM, mensagem pronta e e-mail para a prestadora.', true],
    ['Leitura automática das pastas do Drive', 'O site confere sozinho o que chegou em cada pasta e quando chegou.', false],
    ['Cruzamento dos números', 'Força de trabalho × folha × INSS (DARF) × FGTS e CRF dentro da validade.', false],
    ['Alerta no Telegram perto do prazo', 'Quem ainda não mandou, no dia 20 e no dia 25.', false],
    ['Conferência guardada na planilha da equipe', 'A mesma lista em qualquer computador, com histórico de quem conferiu.', false],
  ];
  return (
    <div className="space-y-6">
      <div className={card}>
        <p className="text-lg font-bold text-[#0F2053]">Como funciona</p>
        <ol className="mt-3 space-y-2 text-[15px] text-slate-700 list-decimal pl-5">
          <li>A prestadora recebe o link de uma pasta no Google Drive e, todo mês, cria a pasta da competência com as subpastas do book.</li>
          <li>Até o dia 25 do mês seguinte (ou o dia combinado), ela sobe os documentos e avisa que enviou.</li>
          <li>A equipe confere cada documento aqui: recebido, recusado com o motivo ou não se aplica.</li>
          <li>Faltou algo? O site gera a notificação de pendências e a mensagem de cobrança. Depois do prazo, o pagamento fica travado até regularizar.</li>
        </ol>
        <p className="mt-4 text-sm font-bold text-slate-600">Pastas de cada competência</p>
        <p className="mt-1 text-[15px] text-slate-700">{BOOK.map((g) => g.pasta).join(' · ')}</p>
      </div>
      <div className={card}>
        <p className="text-lg font-bold text-[#0F2053]">O que já funciona e o que vem a seguir</p>
        <ul className="mt-3 space-y-2">
          {etapas.map(([t, d, pronto]) => (
            <li key={t} className="flex gap-3 text-[15px]">
              <span
                className={`mt-0.5 shrink-0 px-2 py-0.5 rounded-full text-xs font-bold ${pronto ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}
              >
                {pronto ? 'pronto' : 'a seguir'}
              </span>
              <span>
                <strong className="text-[#0F2053]">{t}.</strong> <span className="text-slate-600">{d}</span>
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-sm text-slate-500">
          Cuidado com dados pessoais: os documentos têm CPF, salários e exames (ASO). Compartilhe cada pasta só com o e-mail da prestadora, nunca como “qualquer
          pessoa com o link”.
        </p>
      </div>
    </div>
  );
}
