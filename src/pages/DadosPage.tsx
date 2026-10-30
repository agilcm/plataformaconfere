// Área /dados/ (sem link no site): simuladores internos de RH, pró-labore, Simples Nacional e enquadramento.
import { useEffect, useMemo, useState } from 'react';
import DepartamentoPessoal from '../components/DepartamentoPessoal.tsx';
import Header from '../components/Header.tsx';
import { Container, Icon } from '../components/ui.tsx';
import { ATIVIDADES } from '../data/atividadesFiscais.js';
import { FATOR_R_MINIMO, SALARIO_MINIMO, TETO_INSS, VIGENCIA } from '../data/parametrosFiscais.js';
import { whatsappLink } from '../data/servicesData.ts';
import { aliquotasPresumido, contaFatorR, criticarFatorR, faturamentosDe, folhaFatorR, projecaoPresumido, projecaoSimples, proLabore } from '../lib/tributos.js';
import { baixarXlsx } from '../lib/xlsx.js';

type Aba = 'rh' | 'simples' | 'eleicao';
const ABAS: { id: Aba; label: string; icon: string }[] = [
  { id: 'rh', label: 'Simulador de RH', icon: 'users' },
  { id: 'simples', label: 'Simples, pró-labore e regime', icon: 'chart' },
  { id: 'eleicao', label: 'Eleição', icon: 'check' },
];

const moeda = (v: number | null | undefined) => (v == null ? '—' : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
const pct = (v: number, casas = 2) => `${(v * 100).toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })}%`;
const card = 'p-5 sm:p-6 rounded-2xl bg-white border border-slate-200';
const inputCls =
  'w-full bg-white border border-slate-300 rounded-xl px-3 py-2.5 text-base text-[#0F2053] tabular-nums focus:outline-none focus:border-[#0478CA] focus:ring-2 focus:ring-[#0478CA]/20';

/** Campo de valor em reais/percentual que aceita digitar "1.234,56" sem pular */
function Campo({ label, valor, onChange, prefixo, sufixo, dica }: { label: string; valor: number; onChange: (n: number) => void; prefixo?: string; sufixo?: string; dica?: string }) {
  const [texto, setTexto] = useState(() => valor.toLocaleString('pt-BR'));
  useEffect(() => {
    const atual = Number(texto.replace(/\./g, '').replace(',', '.'));
    if (atual !== valor) setTexto(valor.toLocaleString('pt-BR'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valor]);
  return (
    <label className="block">
      <span className="block text-sm font-semibold text-slate-700 mb-1.5">{label}</span>
      <span className="relative block">
        {prefixo && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">{prefixo}</span>}
        <input
          inputMode="decimal"
          value={texto}
          onChange={(e) => {
            setTexto(e.target.value);
            const n = Number(e.target.value.replace(/\./g, '').replace(',', '.'));
            if (Number.isFinite(n)) onChange(n);
          }}
          className={`${inputCls} ${prefixo ? 'pl-10' : ''} ${sufixo ? 'pr-10' : ''}`}
        />
        {sufixo && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">{sufixo}</span>}
      </span>
      {dica && <span className="mt-1 block text-sm text-slate-500">{dica}</span>}
    </label>
  );
}

function SelecaoAtividade({ valor, onChange }: { valor: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="block text-sm font-semibold text-slate-700 mb-1.5">Atividade</span>
      <select value={valor} onChange={(e) => onChange(e.target.value)} className={inputCls}>
        {ATIVIDADES.map((a) => (
          <option key={a.id} value={a.id}>
            {a.nome}
          </option>
        ))}
      </select>
    </label>
  );
}

const Linha = ({ nome, valor, forte, negativo }: { nome: string; valor: string; forte?: boolean; negativo?: boolean }) => (
  <div className={`flex justify-between gap-4 py-2 border-b border-slate-100 last:border-0 ${forte ? 'font-bold text-[#0F2053]' : 'text-slate-700'}`}>
    <span>{nome}</span>
    <span className={`tabular-nums whitespace-nowrap ${negativo ? 'text-red-700' : ''}`}>{valor}</span>
  </div>
);

const Nota = ({ children }: { children: React.ReactNode }) => <p className="mt-4 text-sm text-slate-500 leading-relaxed">{children}</p>;

/** Conta do Fator R com os números digitados e a base legal, para conferir */
function ComoConferirFatorR({ conta }: { conta: ReturnType<typeof contaFatorR> }) {
  const ok = conta.fator >= FATOR_R_MINIMO;
  return (
    <details className={`${card} text-[15px]`}>
      <summary className="font-bold text-[#0F2053] cursor-pointer">Como conferir o Fator R</summary>
      <div className="mt-3 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <p className="font-semibold text-slate-700">Folha de salários dos 12 meses anteriores</p>
          <div className="mt-1">
            <Linha nome="Salários dos empregados" valor={moeda(conta.salarios12)} />
            <Linha nome="13º salário e 1/3 de férias" valor={moeda(conta.decimoFerias12)} />
            <Linha nome="FGTS (8%) sobre salários, 13º e férias" valor={moeda(conta.fgts12)} />
            <Linha nome="Pró-labore dos sócios" valor={moeda(conta.proLabore12)} />
            <Linha nome="Folha de salários (A)" valor={moeda(conta.folha12)} forte />
            <Linha nome="Receita bruta dos 12 meses anteriores (B)" valor={moeda(conta.rbt12)} forte />
          </div>
          <p className={`mt-3 p-3 rounded-xl font-bold ${ok ? 'bg-emerald-50 text-emerald-900' : 'bg-red-50 text-red-900'}`}>
            Fator R = A ÷ B = {moeda(conta.folha12)} ÷ {moeda(conta.rbt12)} = {pct(conta.fator)} → {ok ? 'Anexo III' : 'Anexo V'}
          </p>
        </div>
        <div className="text-slate-600 leading-relaxed space-y-2">
          <p>
            <strong className="text-slate-800">Regra:</strong> nas atividades com Fator R, se a folha de salários dos 12 meses anteriores for igual ou maior
            que 28% da receita bruta dos mesmos 12 meses, a empresa é tributada pelo Anexo III; abaixo de 28%, pelo Anexo V (LC 123/2006, art. 18, §§ 5º-J
            e 5º-M).
          </p>
          <p>
            <strong className="text-slate-800">O que entra na folha:</strong> tudo o que foi pago a pessoas físicas pelo trabalho nos 12 meses anteriores
            (salários, 13º, férias, pró-labore), mais o FGTS e a contribuição patronal efetivamente recolhidos (LC 123/2006, art. 18, § 24). Nas atividades
            com Fator R a contribuição patronal está dentro do DAS, por isso não soma.
          </p>
          <p>
            <strong className="text-slate-800">Para conferir no PGDAS-D:</strong> some, mês a mês, a folha informada nos 12 meses anteriores ao período de
            apuração e divida pela receita bruta dos mesmos 12 meses (a RBT12). O cálculo é refeito todo mês, então o anexo pode mudar de um mês para o outro.
          </p>
          <p className="text-sm">
            Aqui a folha é a média mensal informada: o 13º entra como 1/12 e o 1/3 de férias como 1/36 por mês. Distribuição de lucros não entra na folha.
          </p>
        </div>
      </div>
    </details>
  );
}

// ---------------------------------------------------------------- Simples, pró-labore e regime (tudo junto)

const Interruptor = ({ marcado, onChange, titulo, dica }: { marcado: boolean; onChange: (v: boolean) => void; titulo: string; dica?: string }) => (
  <label className={`flex items-start gap-3 p-4 rounded-2xl border-2 cursor-pointer ${marcado ? 'border-[#0478CA] bg-[#0478CA]/5' : 'border-slate-200 bg-white'}`}>
    <input type="checkbox" checked={marcado} onChange={(e) => onChange(e.target.checked)} className="mt-1 w-5 h-5" />
    <span>
      <span className="block font-bold text-[#0F2053]">{titulo}</span>
      {dica && <span className="block text-sm text-slate-500">{dica}</span>}
    </span>
  </label>
);

/** Campo em % que guarda o valor como fração (0,03 = 3%) */
const CampoPct = ({ label, valor, onChange, dica }: { label: string; valor: number; onChange: (n: number) => void; dica?: string }) => (
  <Campo label={label} valor={Math.round(valor * 1e6) / 1e4} onChange={(n) => onChange(n / 100)} sufixo="%" dica={dica} />
);

function SimuladorSimplesProLabore() {
  const [ativ, setAtiv] = useState('servicos-fator-r');
  const [folha, setFolha] = useState(3000);
  const [pl, setPl] = useState(3000);
  const [dep, setDep] = useState(0);
  const [rat, setRat] = useState(2);
  const [comFaturamento, setComFaturamento] = useState(true);
  const [comparar, setComparar] = useState(false);
  const [fat, setFat] = useState(30000);
  const [cresc, setCresc] = useState(0);
  const [situacao, setSituacao] = useState<'existente' | 'nova'>('existente');
  const [rec12, setRec12] = useState(360000);
  const [mesAMes, setMesAMes] = useState(false);
  const [fats, setFats] = useState<number[]>(() => faturamentosDe(30000));
  const atividadeAtual = ATIVIDADES.find((a) => a.id === ativ)!;
  const [aliqP, setAliqP] = useState(() => aliquotasPresumido(atividadeAtual));
  const anexoIV = atividadeAtual.anexo === 'IV';

  const faturamentos = mesAMes ? fats : faturamentosDe(fat, cresc / 100);
  const p = { folhaMensal: folha, proLaboreMensal: pl, dependentes: dep };
  const simples = useMemo(
    () =>
      projecaoSimples({
        atividadeId: ativ,
        faturamentos,
        historico: situacao === 'nova' ? { tipo: 'nova' } : { tipo: 'existente', receita12: rec12 },
        ...p,
        rat: rat / 100,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ativ, faturamentos.join('|'), situacao, rec12, folha, pl, dep, rat],
  );
  const presumido = useMemo(() => projecaoPresumido(faturamentos, p, aliqP), [faturamentos.join('|'), folha, pl, aliqP]); // eslint-disable-line react-hooks/exhaustive-deps
  const critica: any = criticarFatorR({ atividadeId: ativ, faturamento: faturamentos[0], rbt12: simples.meses[0].rbt12, ...p });
  const plSimples = proLabore(pl, { dependentes: dep, cppEmpresa: anexoIV });
  const plPresumido = proLabore(pl, { dependentes: dep, cppEmpresa: true });
  const melhor = presumido.totais.total < simples.totais.totalEmpresa ? 'presumido' : 'simples';
  const aliquotaMudou = new Set(simples.meses.map((m) => m.aliquota.toFixed(6))).size > 1;
  // Fator R que começa acima de 28% e cai ao longo do ano (receita crescendo, folha igual)
  const mesQueCai = atividadeAtual.fatorR ? simples.meses.find((m) => m.fatorR < FATOR_R_MINIMO) : undefined;
  const proLaboreParaMes = mesQueCai ? Math.max(pl, (FATOR_R_MINIMO * mesQueCai.rbt12) / 12 - folhaFatorR(folha, 0).total) : 0;

  const trocarAtividade = (v: string) => {
    setAtiv(v);
    setAliqP(aliquotasPresumido(ATIVIDADES.find((a) => a.id === v)!));
  };

  const exportar = () => {
    const abas: any[] = [
      {
        nome: 'Simples 12 meses',
        colunas: [
          { titulo: 'Mês', largura: 8, tipo: 'numero' },
          { titulo: 'Faturamento', largura: 16, tipo: 'moeda' },
          { titulo: 'Receita 12 meses (RBT12)', largura: 18, tipo: 'moeda' },
          { titulo: 'Fator R', largura: 10 },
          { titulo: 'Anexo', largura: 8 },
          { titulo: 'Faixa', largura: 8, tipo: 'numero' },
          { titulo: 'Alíquota efetiva', largura: 14 },
          { titulo: 'DAS', largura: 14, tipo: 'moeda' },
          { titulo: 'FGTS', largura: 14, tipo: 'moeda' },
          { titulo: 'CPP fora do DAS (Anexo IV)', largura: 16, tipo: 'moeda' },
          { titulo: 'Total da empresa', largura: 16, tipo: 'moeda' },
          { titulo: 'INSS do sócio (pró-labore)', largura: 16, tipo: 'moeda' },
          { titulo: 'IRRF do sócio (pró-labore)', largura: 16, tipo: 'moeda' },
        ],
        linhas: simples.meses.map((m) => [m.mes, m.faturamento, m.rbt12, pct(m.fatorR, 1), m.anexo, m.faixa, pct(m.aliquota), m.das, m.fgts, m.cpp, m.totalEmpresa, m.inssSocio, m.irrfSocio]),
      },
    ];
    if (comparar)
      abas.push({
        nome: 'Lucro Presumido 12 meses',
        colunas: [
          { titulo: 'Mês', largura: 8, tipo: 'numero' },
          { titulo: 'Faturamento', largura: 16, tipo: 'moeda' },
          { titulo: 'PIS e COFINS', largura: 14, tipo: 'moeda' },
          { titulo: 'IRPJ', largura: 14, tipo: 'moeda' },
          { titulo: 'CSLL', largura: 14, tipo: 'moeda' },
          { titulo: atividadeAtual.local, largura: 14, tipo: 'moeda' },
          { titulo: 'Encargos sobre a folha', largura: 16, tipo: 'moeda' },
          { titulo: 'INSS patronal do pró-labore', largura: 16, tipo: 'moeda' },
          { titulo: 'Total', largura: 16, tipo: 'moeda' },
        ],
        linhas: presumido.meses.map((m) => [m.mes, m.faturamento, m.pisCofins, m.irpj, m.csll, m.local, m.encargosFolha, m.patronalPl, m.total]),
      });
    baixarXlsx(`simples-pro-labore-${new Date().toISOString().slice(0, 10)}.xlsx`, abas);
  };

  return (
    <div className="space-y-6">
      {/* Empresa e sócio */}
      <div className={`${card} grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4`}>
        <div className="sm:col-span-2">
          <SelecaoAtividade valor={ativ} onChange={trocarAtividade} />
        </div>
        <Campo label="Folha de salários (mês)" valor={folha} onChange={setFolha} prefixo="R$" dica="Sem o pró-labore" />
        <Campo label="Pró-labore (mês)" valor={pl} onChange={setPl} prefixo="R$" dica={`Mínimo: ${moeda(SALARIO_MINIMO)}`} />
        <Campo label="Dependentes para o IR" valor={dep} onChange={(n) => setDep(Math.max(0, Math.round(n)))} />
        {anexoIV && <Campo label="RAT ajustado" valor={rat} onChange={setRat} sufixo="%" />}
      </div>

      {/* Pró-labore (sempre) */}
      <div className={`${card} grid grid-cols-1 lg:grid-cols-2 gap-6`}>
        <div>
          <p className="text-lg font-bold text-[#0F2053]">Pró-labore do sócio (mês)</p>
          <div className="mt-2 text-[15px]">
            <Linha nome="Pró-labore bruto" valor={moeda(plSimples.bruto)} />
            <Linha nome={`INSS do sócio (11% até ${moeda(TETO_INSS)})`} valor={`− ${moeda(plSimples.inss)}`} negativo />
            <Linha
              nome={`IRRF${plSimples.ir.reducao ? ` (com redução de ${moeda(plSimples.ir.reducao)} da Lei 15.270)` : ''}`}
              valor={`− ${moeda(plSimples.irrf)}`}
              negativo
            />
            <Linha nome="Líquido para o sócio" valor={moeda(plSimples.liquido)} forte />
          </div>
        </div>
        <div className="p-4 rounded-xl bg-[#F2F7FC] text-[15px] self-start">
          <p className="font-semibold text-slate-700">INSS patronal da empresa sobre o pró-labore</p>
          <Linha nome={`No Simples (Anexo ${simples.meses[0].anexo})`} valor={anexoIV ? `${moeda(plSimples.patronal)} (20%)` : 'R$ 0,00 (está no DAS)'} />
          <Linha nome="No Lucro Presumido" valor={`${moeda(plPresumido.patronal)} (20%)`} />
          <p className="mt-2 text-sm text-slate-500">Pró-labore não tem 13º nem férias. O INSS e o IRRF são descontados do sócio.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Interruptor marcado={comFaturamento} onChange={setComFaturamento} titulo="Calcular sobre o faturamento" dica="Projeção do Simples em 12 meses (DAS, Fator R, FGTS)" />
        <Interruptor
          marcado={comFaturamento && comparar}
          onChange={(v) => {
            setComparar(v);
            if (v) setComFaturamento(true);
          }}
          titulo="Comparar regime"
          dica="Simples Nacional × Lucro Presumido nos mesmos 12 meses"
        />
      </div>

      {comFaturamento && (
        <>
          <div className={`${card} space-y-4`}>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Campo label="Faturamento mensal" valor={fat} onChange={setFat} prefixo="R$" />
              <Campo label="Crescimento por mês" valor={cresc} onChange={setCresc} sufixo="%" dica="0 = igual nos 12 meses" />
              <div className="sm:col-span-2">
                <span className="block text-sm font-semibold text-slate-700 mb-1.5">Situação da empresa</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {(
                    [
                      ['existente', 'Já fatura há 12 meses ou mais'],
                      ['nova', 'Empresa nova (início de atividade)'],
                    ] as const
                  ).map(([v, l]) => (
                    <button
                      key={v}
                      type="button"
                      aria-pressed={situacao === v}
                      onClick={() => setSituacao(v)}
                      className={`px-3 py-2.5 rounded-xl border-2 text-sm font-bold cursor-pointer ${situacao === v ? 'border-[#0F2053] bg-[#0F2053] text-white' : 'border-slate-200 text-[#0F2053]'}`}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              </div>
              {situacao === 'existente' && (
                <Campo label="Receita dos últimos 12 meses (RBT12 hoje)" valor={rec12} onChange={setRec12} prefixo="R$" dica="Se for menor que o ritmo atual, a alíquota sobe mês a mês" />
              )}
            </div>
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <input
                type="checkbox"
                checked={mesAMes}
                onChange={(e) => {
                  if (e.target.checked) setFats(faturamentosDe(fat, cresc / 100));
                  setMesAMes(e.target.checked);
                }}
                className="w-4 h-4"
              />
              Digitar o faturamento mês a mês
            </label>
            {mesAMes && (
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
                {fats.map((v, i) => (
                  <Campo key={i} label={`Mês ${i + 1}`} valor={v} prefixo="R$" onChange={(n) => setFats((f) => f.map((x, k) => (k === i ? n : x)))} />
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              ['Faturamento em 12 meses', moeda(simples.totais.faturamento)],
              ['DAS em 12 meses', moeda(simples.totais.das)],
              [`Total da empresa no Simples${anexoIV ? ' (DAS + CPP + FGTS)' : ' (DAS + FGTS)'}`, moeda(simples.totais.totalEmpresa)],
              ['Carga sobre o faturamento', pct(simples.cargaEfetiva)],
            ].map(([k, v]) => (
              <div key={k} className={card}>
                <p className="text-sm text-slate-500">{k}</p>
                <p className="mt-1 text-xl font-bold text-[#0F2053] tabular-nums">{v}</p>
              </div>
            ))}
          </div>

          {critica && !critica.ok && (
            <div className="p-5 rounded-2xl bg-red-50 border-2 border-red-300 text-red-900">
              <p className="text-lg font-bold">
                Atenção: o Fator R está em {pct(critica.fatorR, 1)}, abaixo de {pct(FATOR_R_MINIMO, 0)}
              </p>
              <p className="mt-1 text-[15px]">
                A empresa paga o Simples pelo <strong>Anexo V</strong>. Com o pró-labore em <strong>{moeda(critica.proLaboreNecessario)}</strong> (mais{' '}
                {moeda(critica.aumentoProLabore)} por mês), ela passa ao <strong>Anexo III</strong>.
              </p>
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3 text-[15px]">
                <div className="p-3 rounded-xl bg-white">
                  <p className="text-sm text-slate-500">DAS a menos</p>
                  <p className="font-bold tabular-nums">{moeda(critica.economiaDasMes)}/mês</p>
                </div>
                <div className="p-3 rounded-xl bg-white">
                  <p className="text-sm text-slate-500">INSS e IRRF a mais no pró-labore</p>
                  <p className="font-bold tabular-nums">{moeda(critica.custoExtraMes)}/mês</p>
                </div>
                <div className="p-3 rounded-xl bg-white">
                  <p className="text-sm text-slate-500">{critica.ganhoLiquidoMes > 0 ? 'Ganho líquido' : 'Não compensa: perda'}</p>
                  <p className={`font-bold tabular-nums ${critica.ganhoLiquidoMes > 0 ? 'text-emerald-700' : 'text-red-700'}`}>{moeda(Math.abs(critica.ganhoLiquidoAno))}/ano</p>
                </div>
              </div>
            </div>
          )}
          {critica && critica.ok && !mesQueCai && (
            <p className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900">
              Fator R de {pct(critica.fatorR, 1)}: igual ou acima de {pct(FATOR_R_MINIMO, 0)}, a empresa fica no Anexo III do Simples.
            </p>
          )}
          {critica && critica.ok && mesQueCai && (
            <div className="p-5 rounded-2xl bg-amber-50 border-2 border-amber-300 text-amber-900">
              <p className="text-lg font-bold">
                Atenção: o Fator R cai abaixo de {pct(FATOR_R_MINIMO, 0)} no mês {mesQueCai.mes}
              </p>
              <p className="mt-1 text-[15px]">
                Começa em {pct(critica.fatorR, 1)} (Anexo III), mas com a receita dos 12 meses crescendo e a folha igual, chega a {pct(mesQueCai.fatorR, 1)} no mês{' '}
                {mesQueCai.mes} e a empresa passa ao <strong>Anexo V</strong>. Para continuar no Anexo III, o pró-labore precisaria ser de pelo menos{' '}
                <strong>{moeda(proLaboreParaMes)}</strong> a partir desse mês.
              </p>
            </div>
          )}
          {atividadeAtual.fatorR && <ComoConferirFatorR conta={contaFatorR(folha, pl, simples.meses[0].rbt12)} />}
          {simples.meses.some((m) => m.acimaLimite) && (
            <p className="p-4 rounded-2xl bg-red-50 border border-red-300 text-red-900">A receita de 12 meses passa de R$ 4,8 milhões: a empresa sai do Simples Nacional.</p>
          )}
          {!simples.meses.some((m) => m.acimaLimite) && simples.meses.some((m) => m.acimaSublimite) && (
            <p className="p-4 rounded-2xl bg-amber-50 border border-amber-300 text-amber-900">
              Acima de R$ 3,6 milhões em 12 meses, o {atividadeAtual.local} sai do DAS e passa a ser pago por fora; a projeção não inclui esse valor.
            </p>
          )}

          {comparar && (
            <div className={card}>
              <p className="text-lg font-bold text-[#0F2053]">Simples Nacional × Lucro Presumido (12 meses)</p>
              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { id: 'simples', nome: `Simples Nacional (Anexo ${simples.meses[0].anexo})`, total: simples.totais.totalEmpresa, carga: simples.cargaEfetiva },
                  { id: 'presumido', nome: 'Lucro Presumido', total: presumido.totais.total, carga: presumido.carga },
                ].map((g) => (
                  <div key={g.id} className={`p-4 rounded-2xl border-2 ${melhor === g.id ? 'border-emerald-400 bg-emerald-50/40' : 'border-slate-200'}`}>
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-bold text-[#0F2053]">{g.nome}</p>
                      {melhor === g.id && <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-sm font-bold">Menor custo</span>}
                    </div>
                    <p className="mt-1 text-2xl font-bold tabular-nums text-[#0F2053]">{moeda(g.total)}</p>
                    <p className="text-sm text-slate-500">{pct(g.carga)} do faturamento</p>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-[15px] text-slate-700">
                Diferença em 12 meses: <strong>{moeda(Math.abs(presumido.totais.total - simples.totais.totalEmpresa))}</strong> a favor do{' '}
                {melhor === 'simples' ? 'Simples Nacional' : 'Lucro Presumido'}.
              </p>
              <div className="mt-5 grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="text-[15px]">
                  <p className="font-semibold text-slate-700">Lucro Presumido em 12 meses</p>
                  <Linha nome="PIS e COFINS" valor={moeda(presumido.totais.pisCofins)} />
                  <Linha nome="IRPJ (com adicional)" valor={moeda(presumido.totais.irpj)} />
                  <Linha nome="CSLL" valor={moeda(presumido.totais.csll)} />
                  <Linha nome={atividadeAtual.local} valor={moeda(presumido.totais.local)} />
                  <Linha nome="Encargos sobre a folha" valor={moeda(presumido.totais.encargosFolha)} />
                  <Linha nome="INSS patronal do pró-labore" valor={moeda(presumido.totais.patronalPl)} />
                  <Linha nome="Total" valor={moeda(presumido.totais.total)} forte />
                </div>
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-slate-700">Alíquotas do Lucro Presumido</p>
                    <button type="button" onClick={() => setAliqP(aliquotasPresumido(atividadeAtual))} className="text-sm font-bold text-[#0478CA] underline cursor-pointer">
                      Voltar ao padrão
                    </button>
                  </div>
                  <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <CampoPct label="PIS" valor={aliqP.pis} onChange={(v) => setAliqP({ ...aliqP, pis: v })} />
                    <CampoPct label="COFINS" valor={aliqP.cofins} onChange={(v) => setAliqP({ ...aliqP, cofins: v })} />
                    <CampoPct label={atividadeAtual.local} valor={aliqP.local} onChange={(v) => setAliqP({ ...aliqP, local: v })} />
                    <CampoPct label="Presunção IRPJ" valor={aliqP.presIrpj} onChange={(v) => setAliqP({ ...aliqP, presIrpj: v })} />
                    <CampoPct label="IRPJ" valor={aliqP.irpj} onChange={(v) => setAliqP({ ...aliqP, irpj: v })} />
                    <CampoPct label="Adicional IRPJ" valor={aliqP.adicionalIrpj} onChange={(v) => setAliqP({ ...aliqP, adicionalIrpj: v })} />
                    <CampoPct label="Presunção CSLL" valor={aliqP.presCsll} onChange={(v) => setAliqP({ ...aliqP, presCsll: v })} />
                    <CampoPct label="CSLL" valor={aliqP.csll} onChange={(v) => setAliqP({ ...aliqP, csll: v })} />
                    <CampoPct label="INSS patronal" valor={aliqP.patronal} onChange={(v) => setAliqP({ ...aliqP, patronal: v })} />
                    <CampoPct label="RAT" valor={aliqP.rat} onChange={(v) => setAliqP({ ...aliqP, rat: v })} />
                    <CampoPct label="Terceiros" valor={aliqP.terceiros} onChange={(v) => setAliqP({ ...aliqP, terceiros: v })} />
                    <CampoPct label="FGTS" valor={aliqP.fgts} onChange={(v) => setAliqP({ ...aliqP, fgts: v })} />
                  </div>
                  <p className="mt-2 text-sm text-slate-500">
                    O adicional de IRPJ incide sobre a base presumida acima de {moeda(aliqP.limiteAdicionalMes)} por mês (R$ 60 mil no trimestre).
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className={card}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-lg font-bold text-[#0F2053]">Simples mês a mês</p>
              <button type="button" onClick={exportar} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#1D6F42] hover:bg-[#185C37] text-white font-bold cursor-pointer">
                <Icon name="sheet" className="w-5 h-5" /> Exportar Excel
              </button>
            </div>
            {!aliquotaMudou && (
              <p className="mt-2 text-sm text-slate-600">
                A alíquota ficou igual nos 12 meses porque a receita dos 12 meses anteriores não mudou. Ela sobe quando essa receita cresce: informe um
                faturamento crescente, uma receita dos últimos 12 meses menor que o ritmo atual ou marque "Empresa nova".
              </p>
            )}
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[60rem] text-sm">
                <thead>
                  <tr className="text-left text-slate-500 border-b border-slate-200">
                    {['Mês', 'Faturamento', 'Receita 12 meses', 'Fator R', 'Anexo', 'Faixa', 'Alíquota efetiva', 'DAS', 'FGTS', ...(anexoIV ? ['CPP fora do DAS'] : []), 'Total', ...(comparar ? ['Presumido'] : [])].map((h) => (
                      <th key={h} className="py-2 pr-3 font-semibold whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {simples.meses.map((m, i) => {
                    const subiu = i > 0 && m.aliquota > simples.meses[i - 1].aliquota + 1e-9;
                    return (
                      <tr key={m.mes} className="border-b border-slate-100 tabular-nums">
                        <td className="py-2 pr-3">{m.mes}</td>
                        <td className="py-2 pr-3">{moeda(m.faturamento)}</td>
                        <td className="py-2 pr-3">{moeda(m.rbt12)}</td>
                        <td className={`py-2 pr-3 ${atividadeAtual.fatorR && m.fatorR < FATOR_R_MINIMO ? 'text-red-700 font-semibold' : ''}`}>{atividadeAtual.fatorR ? pct(m.fatorR, 1) : '—'}</td>
                        <td className="py-2 pr-3">{m.anexo}</td>
                        <td className="py-2 pr-3">{m.faixa}ª</td>
                        <td className={`py-2 pr-3 ${subiu ? 'text-amber-700 font-bold' : ''}`}>
                          {pct(m.aliquota)}
                          {subiu ? ' ▲' : ''}
                        </td>
                        <td className="py-2 pr-3">{moeda(m.das)}</td>
                        <td className="py-2 pr-3">{moeda(m.fgts)}</td>
                        {anexoIV && <td className="py-2 pr-3">{moeda(m.cpp)}</td>}
                        <td className="py-2 pr-3 font-semibold">{moeda(m.totalEmpresa)}</td>
                        {comparar && <td className="py-2 pr-3">{moeda(presumido.meses[i].total)}</td>}
                      </tr>
                    );
                  })}
                  <tr className="font-bold text-[#0F2053] tabular-nums">
                    <td className="py-2 pr-3">Total</td>
                    <td className="py-2 pr-3">{moeda(simples.totais.faturamento)}</td>
                    <td className="py-2 pr-3" colSpan={5} />
                    <td className="py-2 pr-3">{moeda(simples.totais.das)}</td>
                    <td className="py-2 pr-3">{moeda(simples.totais.fgts)}</td>
                    {anexoIV && <td className="py-2 pr-3">{moeda(simples.totais.cpp)}</td>}
                    <td className="py-2 pr-3">{moeda(simples.totais.totalEmpresa)}</td>
                    {comparar && <td className="py-2 pr-3">{moeda(presumido.totais.total)}</td>}
                  </tr>
                </tbody>
              </table>
            </div>
            <Nota>
              A alíquota efetiva de cada mês é recalculada pela receita bruta dos 12 meses anteriores (RBT12), como no PGDAS-D: ela sobe (▲) quando essa
              receita cresce e muda de faixa. Empresa nova: no 1º mês a receita do mês × 12; depois, a média dos meses anteriores × 12 (LC 123/2006, art. 18,
              § 2º). O Fator R considera salários (com 13º e 1/3 de férias), pró-labore e FGTS (art. 18, § 24). Não considera IPI, ICMS-ST, DIFAL nem a
              reforma tributária (CBS e IBS a partir de 2027). Estimativa para planejamento; confirme com o contador.
            </Nota>
          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- página

const HASH: Record<string, Aba> = { '#rh': 'rh', '#simples': 'simples', '#pro-labore': 'simples', '#comparativo': 'simples', '#eleicao': 'eleicao' };

export default function DadosPage() {
  const [aba, setAba] = useState<Aba>('rh');
  useEffect(() => {
    const ler = () => setAba(HASH[window.location.hash] ?? 'rh');
    ler();
    window.addEventListener('hashchange', ler);
    return () => window.removeEventListener('hashchange', ler);
  }, []);
  const trocar = (a: Aba) => {
    setAba(a);
    try {
      history.replaceState(null, '', `#${a}`);
    } catch {
      /* sem histórico */
    }
  };

  return (
    <>
      <Header page="dados" />
      <main id="conteudo" className="bg-[#F4F7FB] min-h-screen py-10 sm:py-14">
        <Container>
          <h1 className="text-2xl sm:text-3xl font-bold font-display text-[#0F2053]">Dados</h1>
          <p className="mt-1 text-[15px] text-slate-600">Simuladores internos de folha, pró-labore e regime tributário · parâmetros de {VIGENCIA}</p>
          <div role="tablist" aria-label="Simuladores" className="mt-6 flex flex-wrap gap-2">
            {ABAS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={aba === t.id}
                onClick={() => (t.id === 'eleicao' ? window.location.assign(`${import.meta.env.BASE_URL}dados/eleicao/`) : trocar(t.id))}
                className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-[15px] font-bold border-2 transition-colors cursor-pointer ${
                  aba === t.id ? 'bg-[#0F2053] border-[#0F2053] text-white' : 'bg-white border-slate-200 text-[#0F2053] hover:border-[#0478CA]'
                }`}
              >
                <Icon name={t.icon} className="w-5 h-5" />
                {t.label}
              </button>
            ))}
          </div>
          <div role="tabpanel" className="mt-6">
            {aba === 'simples' && <SimuladorSimplesProLabore />}
            {aba === 'eleicao' && (
              <div className={card}>
                <p className="text-lg font-bold text-[#0F2053]">Eleições em dados</p>
                <p className="mt-1 text-[15px] text-slate-600">
                  Resultado por cargo, votos por local e seção, comparecimento, perfil do eleitorado, histórico de candidatos e relatórios em Excel e PDF
                  (dados do TSE).
                </p>
                <a href={`${import.meta.env.BASE_URL}dados/eleicao/`} className="mt-4 inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-[#0F2053] text-white font-bold">
                  Abrir o painel de eleições
                  <Icon name="arrow" className="w-5 h-5" />
                </a>
              </div>
            )}
          </div>
        </Container>
        {aba === 'rh' && (
          <div className="mt-6">
            <DepartamentoPessoal onContact={() => window.open(whatsappLink('Olá! Quero falar sobre a folha e o Departamento Pessoal.'), '_blank', 'noopener')} />
          </div>
        )}
      </main>
    </>
  );
}
