// Área /dados/ (sem link no site): simuladores internos de RH, pró-labore, Simples Nacional e enquadramento.
import { useEffect, useMemo, useState } from 'react';
import DepartamentoPessoal from '../components/DepartamentoPessoal.tsx';
import Header from '../components/Header.tsx';
import { Container, Icon } from '../components/ui.tsx';
import { ATIVIDADES } from '../data/atividadesFiscais.js';
import { FATOR_R_MINIMO, SALARIO_MINIMO, TETO_INSS, VIGENCIA } from '../data/parametrosFiscais.js';
import { whatsappLink } from '../data/servicesData.ts';
import { comparativo, contaFatorR, projecaoSimples, proLabore } from '../lib/tributos.js';
import { baixarXlsx } from '../lib/xlsx.js';

type Aba = 'rh' | 'prolabore' | 'simples' | 'comparativo' | 'eleicao';
const ABAS: { id: Aba; label: string; icon: string }[] = [
  { id: 'rh', label: 'Simulador de RH', icon: 'users' },
  { id: 'prolabore', label: 'Simulador de pró-labore', icon: 'calc' },
  { id: 'simples', label: 'Encargos do Simples', icon: 'chart' },
  { id: 'comparativo', label: 'Comparativo de enquadramento', icon: 'bank' },
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

// ---------------------------------------------------------------- pró-labore

function SimuladorProLabore() {
  const [bruto, setBruto] = useState(5000);
  const [dep, setDep] = useState(0);
  const [cpp, setCpp] = useState(true);
  const r = proLabore(bruto, { dependentes: dep, cppEmpresa: cpp });
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <div className={`${card} lg:col-span-5 space-y-4`}>
        <Campo label="Pró-labore bruto (mês)" valor={bruto} onChange={setBruto} prefixo="R$" dica={`Mínimo: um salário mínimo (${moeda(SALARIO_MINIMO)}).`} />
        <Campo label="Dependentes para o IR" valor={dep} onChange={(n) => setDep(Math.max(0, Math.round(n)))} />
        <label className="flex items-start gap-3 text-[15px] text-slate-700">
          <input type="checkbox" checked={cpp} onChange={(e) => setCpp(e.target.checked)} className="mt-1 w-4 h-4" />
          <span>
            A empresa paga INSS patronal de 20% sobre o pró-labore
            <span className="block text-sm text-slate-500">Lucro Presumido, Lucro Real e Simples Anexo IV. Nos demais anexos do Simples, a CPP está no DAS.</span>
          </span>
        </label>
      </div>
      <div className={`${card} lg:col-span-7`}>
        <p className="text-lg font-bold text-[#0F2053]">Resultado mensal</p>
        <div className="mt-3 text-[15px]">
          <Linha nome="Pró-labore bruto" valor={moeda(r.bruto)} />
          <Linha nome={`INSS do sócio (11% até o teto de ${moeda(TETO_INSS)})`} valor={`− ${moeda(r.inss)}`} negativo />
          <Linha
            nome={`IRRF (base ${moeda(r.ir.base)}${r.ir.simplificado ? ', desconto simplificado' : ''}${r.ir.reducao ? `, redução de ${moeda(r.ir.reducao)} da Lei 15.270` : ''})`}
            valor={`− ${moeda(r.irrf)}`}
            negativo
          />
          <Linha nome="Líquido para o sócio" valor={moeda(r.liquido)} forte />
        </div>
        <div className="mt-5 p-4 rounded-xl bg-[#F2F7FC] text-[15px]">
          <Linha nome="INSS patronal da empresa (20%)" valor={moeda(r.patronal)} />
          <Linha nome="Custo total para a empresa" valor={moeda(r.custoEmpresa)} forte />
          <Linha nome="Custo no ano (12 meses; pró-labore não tem 13º nem férias)" valor={moeda(r.custoEmpresa * 12)} />
        </div>
        <Nota>
          Parâmetros de {VIGENCIA}: INSS de 11% até o teto, tabela do IRRF com isenção até R$ 5.000 e redução parcial até R$ 7.350 (Lei 15.270/2025).
          Lucros distribuídos acima de R$ 50 mil por mês ao mesmo sócio passam a ter retenção de 10% de IR.
        </Nota>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Simples: projeção de 12 meses

function SimuladorSimples() {
  const [ativ, setAtiv] = useState('servicos-fator-r');
  const [fat, setFat] = useState(30000);
  const [cresc, setCresc] = useState(0);
  const [rec12, setRec12] = useState(360000);
  const [rec12Manual, setRec12Manual] = useState(false);
  const [folha, setFolha] = useState(3000);
  const [pl, setPl] = useState(3000);
  const [rat, setRat] = useState(2);
  const r = useMemo(
    () =>
      projecaoSimples({
        atividadeId: ativ,
        faturamentoMensal: fat,
        crescimentoMensal: cresc / 100,
        receita12Anterior: rec12Manual ? rec12 : fat * 12,
        folhaMensal: folha,
        proLaboreMensal: pl,
        rat: rat / 100,
      }),
    [ativ, fat, cresc, rec12, rec12Manual, folha, pl, rat],
  );
  const anexoIV = r.atividade.anexo === 'IV';
  const exportar = () =>
    baixarXlsx(`projecao-simples-${new Date().toISOString().slice(0, 10)}.xlsx`, [
      {
        nome: 'Projeção 12 meses',
        colunas: [
          { titulo: 'Mês', largura: 8, tipo: 'numero' },
          { titulo: 'Faturamento', largura: 16, tipo: 'moeda' },
          { titulo: 'Receita 12 meses (RBT12)', largura: 18, tipo: 'moeda' },
          { titulo: 'Fator R', largura: 10 },
          { titulo: 'Anexo', largura: 8 },
          { titulo: 'Alíquota efetiva', largura: 14 },
          { titulo: 'DAS', largura: 14, tipo: 'moeda' },
          { titulo: 'FGTS', largura: 14, tipo: 'moeda' },
          { titulo: 'CPP fora do DAS (Anexo IV)', largura: 16, tipo: 'moeda' },
          { titulo: 'Total da empresa', largura: 16, tipo: 'moeda' },
          { titulo: 'INSS do sócio (pró-labore)', largura: 16, tipo: 'moeda' },
          { titulo: 'IRRF do sócio (pró-labore)', largura: 16, tipo: 'moeda' },
        ],
        linhas: r.meses.map((m) => [m.mes, m.faturamento, m.rbt12, pct(m.fatorR, 1), m.anexo, pct(m.aliquota), m.das, m.fgts, m.cpp, m.totalEmpresa, m.inssSocio, m.irrfSocio]),
      },
    ]);
  const ultimo = r.meses[r.meses.length - 1];
  return (
    <div className="space-y-6">
      <div className={`${card} grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4`}>
        <div className="sm:col-span-2">
          <SelecaoAtividade valor={ativ} onChange={setAtiv} />
        </div>
        <Campo label="Faturamento mensal" valor={fat} onChange={setFat} prefixo="R$" />
        <Campo label="Crescimento por mês" valor={cresc} onChange={setCresc} sufixo="%" dica="0 = faturamento igual nos 12 meses" />
        <Campo label="Folha de salários (mês)" valor={folha} onChange={setFolha} prefixo="R$" dica="Sem o pró-labore" />
        <Campo label="Pró-labore (mês)" valor={pl} onChange={setPl} prefixo="R$" />
        {anexoIV && <Campo label="RAT ajustado" valor={rat} onChange={setRat} sufixo="%" />}
        <div className="sm:col-span-2">
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
            <input type="checkbox" checked={rec12Manual} onChange={(e) => setRec12Manual(e.target.checked)} className="w-4 h-4" />
            Informar a receita dos últimos 12 meses (empresa nova ou faturamento diferente)
          </label>
          {rec12Manual && (
            <div className="mt-2">
              <Campo label="Receita dos últimos 12 meses" valor={rec12} onChange={setRec12} prefixo="R$" />
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          ['Faturamento em 12 meses', moeda(r.totais.faturamento)],
          ['DAS em 12 meses', moeda(r.totais.das)],
          [`Total da empresa${anexoIV ? ' (DAS + CPP + FGTS)' : ' (DAS + FGTS)'}`, moeda(r.totais.totalEmpresa)],
          ['Carga sobre o faturamento', pct(r.cargaEfetiva)],
        ].map(([k, v]) => (
          <div key={k} className={card}>
            <p className="text-sm text-slate-500">{k}</p>
            <p className="mt-1 text-xl font-bold text-[#0F2053] tabular-nums">{v}</p>
          </div>
        ))}
      </div>

      {r.atividade.fatorR && (
        <div className={`p-4 rounded-2xl border-2 ${ultimo.anexo === 'III' ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-red-50 border-red-300 text-red-900'}`}>
          <strong>Fator R de {pct(r.meses[0].fatorR, 1)}</strong> no primeiro mês:{' '}
          {r.meses[0].anexo === 'III'
            ? `acima de ${pct(FATOR_R_MINIMO, 0)}, a empresa fica no Anexo III.`
            : `abaixo de ${pct(FATOR_R_MINIMO, 0)}, a empresa paga pelo Anexo V. Veja no Comparativo de enquadramento quanto de pró-labore leva ao Anexo III.`}
        </div>
      )}
      {r.atividade.fatorR && <ComoConferirFatorR conta={contaFatorR(folha, pl, r.meses[0].rbt12)} />}
      {r.meses.some((m) => m.acimaLimite) && (
        <p className="p-4 rounded-2xl bg-red-50 border border-red-300 text-red-900">A receita de 12 meses passa de R$ 4,8 milhões: a empresa sai do Simples Nacional.</p>
      )}
      {!r.meses.some((m) => m.acimaLimite) && r.meses.some((m) => m.acimaSublimite) && (
        <p className="p-4 rounded-2xl bg-amber-50 border border-amber-300 text-amber-900">
          Acima de R$ 3,6 milhões em 12 meses, o {r.atividade.local} sai do DAS e passa a ser pago por fora; a projeção não inclui esse valor.
        </p>
      )}

      <div className={card}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-lg font-bold text-[#0F2053]">Projeção mês a mês</p>
          <button type="button" onClick={exportar} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#1D6F42] hover:bg-[#185C37] text-white font-bold cursor-pointer">
            <Icon name="sheet" className="w-5 h-5" /> Exportar Excel
          </button>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[56rem] text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b border-slate-200">
                {['Mês', 'Faturamento', 'Receita 12 meses', 'Fator R', 'Anexo', 'Alíquota efetiva', 'DAS', 'FGTS', ...(anexoIV ? ['CPP fora do DAS'] : []), 'Total da empresa', 'INSS + IRRF do sócio'].map((h) => (
                  <th key={h} className="py-2 pr-3 font-semibold whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {r.meses.map((m) => (
                <tr key={m.mes} className="border-b border-slate-100 tabular-nums">
                  <td className="py-2 pr-3">{m.mes}</td>
                  <td className="py-2 pr-3">{moeda(m.faturamento)}</td>
                  <td className="py-2 pr-3">{moeda(m.rbt12)}</td>
                  <td className={`py-2 pr-3 ${r.atividade.fatorR && m.fatorR < FATOR_R_MINIMO ? 'text-red-700 font-semibold' : ''}`}>{r.atividade.fatorR ? pct(m.fatorR, 1) : '—'}</td>
                  <td className="py-2 pr-3">{m.anexo}</td>
                  <td className="py-2 pr-3">{pct(m.aliquota)}</td>
                  <td className="py-2 pr-3">{moeda(m.das)}</td>
                  <td className="py-2 pr-3">{moeda(m.fgts)}</td>
                  {anexoIV && <td className="py-2 pr-3">{moeda(m.cpp)}</td>}
                  <td className="py-2 pr-3 font-semibold">{moeda(m.totalEmpresa)}</td>
                  <td className="py-2 pr-3">{moeda(m.inssSocio + m.irrfSocio)}</td>
                </tr>
              ))}
              <tr className="font-bold text-[#0F2053] tabular-nums">
                <td className="py-2 pr-3">Total</td>
                <td className="py-2 pr-3">{moeda(r.totais.faturamento)}</td>
                <td className="py-2 pr-3" colSpan={4} />
                <td className="py-2 pr-3">{moeda(r.totais.das)}</td>
                <td className="py-2 pr-3">{moeda(r.totais.fgts)}</td>
                {anexoIV && <td className="py-2 pr-3">{moeda(r.totais.cpp)}</td>}
                <td className="py-2 pr-3">{moeda(r.totais.totalEmpresa)}</td>
                <td className="py-2 pr-3">{moeda(r.totais.inssSocio + r.totais.irrfSocio)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <Nota>
          A alíquota efetiva de cada mês usa a receita bruta dos 12 meses anteriores (RBT12), como no PGDAS. O Fator R considera salários (com 13º e 1/3 de
          férias), pró-labore e FGTS dos 12 meses anteriores (LC 123/2006, art. 18, § 24). O INSS e o IRRF do pró-labore são descontados do sócio, não somam no custo da empresa. Estimativa para planejamento.
        </Nota>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- comparativo de enquadramento

function ComparativoEnquadramento() {
  const [ativ, setAtiv] = useState('servicos-fator-r');
  const [fat, setFat] = useState(30000);
  const [folha, setFolha] = useState(3000);
  const [pl, setPl] = useState(3000);
  const [local, setLocal] = useState(3);
  const [rat, setRat] = useState(2);
  const [compras, setCompras] = useState(0);
  const [despesas, setDespesas] = useState(5000);
  const r = useMemo(
    () =>
      comparativo({
        atividadeId: ativ,
        faturamentoMensal: fat,
        folhaMensal: folha,
        proLaboreMensal: pl,
        aliquotaLocal: local / 100,
        rat: rat / 100,
        comprasComCredito: compras,
        outrasDespesas: despesas,
      }),
    [ativ, fat, folha, pl, local, rat, compras, despesas],
  );
  const c: any = r.criticaFatorR;
  return (
    <div className="space-y-6">
      <div className={`${card} grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4`}>
        <div className="sm:col-span-2">
          <SelecaoAtividade
            valor={ativ}
            onChange={(v) => {
              setAtiv(v);
              setLocal(ATIVIDADES.find((a) => a.id === v)!.localPadrao * 100);
            }}
          />
        </div>
        <Campo label="Faturamento mensal" valor={fat} onChange={setFat} prefixo="R$" />
        <Campo label="Folha de salários (mês)" valor={folha} onChange={setFolha} prefixo="R$" dica="Sem o pró-labore" />
        <Campo label="Pró-labore (mês)" valor={pl} onChange={setPl} prefixo="R$" />
        <Campo
          label={`${r.atividade.local} efetivo`}
          valor={local}
          onChange={setLocal}
          sufixo="%"
          dica={r.atividade.local === 'ISS' ? 'De 2% a 5%, conforme o município' : 'Depois dos créditos; ajuste ao seu caso'}
        />
        <Campo label="RAT ajustado" valor={rat} onChange={setRat} sufixo="%" dica="De 1% a 3% × FAP" />
        <Campo label="Compras com crédito de PIS/COFINS (mês)" valor={compras} onChange={setCompras} prefixo="R$" dica="Só para o Lucro Real" />
        <Campo label="Outras despesas (mês)" valor={despesas} onChange={setDespesas} prefixo="R$" dica="Aluguel, sistemas etc. Só para o Lucro Real" />
      </div>

      {c && !c.ok && (
        <div className="p-5 rounded-2xl bg-red-50 border-2 border-red-300 text-red-900">
          <p className="text-lg font-bold">Atenção: o Fator R está em {pct(c.fatorR, 1)}, abaixo de {pct(FATOR_R_MINIMO, 0)}</p>
          <p className="mt-1 text-[15px]">
            Com a folha e o pró-labore informados, a empresa paga o Simples pelo <strong>Anexo V</strong>, o mais caro. Subindo o pró-labore para{' '}
            <strong>{moeda(c.proLaboreNecessario)}</strong> (mais {moeda(c.aumentoProLabore)} por mês), ela passa ao <strong>Anexo III</strong>.
          </p>
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3 text-[15px]">
            <div className="p-3 rounded-xl bg-white">
              <p className="text-sm text-slate-500">DAS a menos</p>
              <p className="font-bold tabular-nums">{moeda(c.economiaDasMes)}/mês</p>
            </div>
            <div className="p-3 rounded-xl bg-white">
              <p className="text-sm text-slate-500">INSS e IRRF a mais no pró-labore</p>
              <p className="font-bold tabular-nums">{moeda(c.custoExtraMes)}/mês</p>
            </div>
            <div className="p-3 rounded-xl bg-white">
              <p className="text-sm text-slate-500">{c.ganhoLiquidoMes > 0 ? 'Ganho líquido' : 'Não compensa: perda'}</p>
              <p className={`font-bold tabular-nums ${c.ganhoLiquidoMes > 0 ? 'text-emerald-700' : 'text-red-700'}`}>{moeda(Math.abs(c.ganhoLiquidoAno))}/ano</p>
            </div>
          </div>
        </div>
      )}
      {c && c.ok && (
        <p className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900">
          Fator R de {pct(c.fatorR, 1)}: igual ou acima de {pct(FATOR_R_MINIMO, 0)}, a empresa fica no Anexo III do Simples.
        </p>
      )}
      {r.atividade.fatorR && <ComoConferirFatorR conta={r.contaFatorR} />}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {r.regimes.map((g) => (
          <div key={g.id} className={`${card} ${g.id === r.melhor ? 'border-2 border-emerald-400' : ''} ${!g.elegivel ? 'opacity-60' : ''}`}>
            <div className="flex items-center justify-between gap-2">
              <p className="text-lg font-bold text-[#0F2053]">{g.nome}</p>
              {g.id === r.melhor && <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-sm font-bold">Menor custo</span>}
            </div>
            <p className="mt-2 text-2xl font-bold tabular-nums text-[#0F2053]">
              {moeda(g.anual ?? 0)}
              <span className="text-base font-semibold text-slate-500"> /ano</span>
            </p>
            <p className="text-sm text-slate-500">
              {moeda(g.mensal ?? 0)} por mês · {pct(g.percentual ?? 0)} do faturamento
            </p>
            <div className="mt-3 text-sm">
              {g.linhas.map((l) => (
                <Linha key={l.nome} nome={l.nome} valor={moeda(l.valor)} />
              ))}
            </div>
            {g.aviso && <p className="mt-3 text-sm font-semibold text-amber-800">{g.aviso}</p>}
          </div>
        ))}
      </div>
      <Nota>
        Comparação de tributos sobre o faturamento e encargos sobre a folha e o pró-labore, com os mesmos valores em todos os regimes. No Lucro Real o
        lucro é estimado como faturamento menos tributos, folha, encargos, pró-labore, compras e outras despesas. O INSS e o IRRF do sócio não entram
        (são iguais nos três regimes). Não considera IPI, ICMS-ST, DIFAL, retenções nem a reforma tributária (CBS e IBS a partir de 2027). Estimativa
        para orientar a decisão; confirme com o contador.
      </Nota>
    </div>
  );
}

// ---------------------------------------------------------------- página

const HASH: Record<string, Aba> = { '#rh': 'rh', '#pro-labore': 'prolabore', '#simples': 'simples', '#comparativo': 'comparativo', '#eleicao': 'eleicao' };

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
      history.replaceState(null, '', `#${Object.entries(HASH).find(([, v]) => v === a)![0].slice(1)}`);
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
                onClick={() => trocar(t.id)}
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
            {aba === 'prolabore' && <SimuladorProLabore />}
            {aba === 'simples' && <SimuladorSimples />}
            {aba === 'comparativo' && <ComparativoEnquadramento />}
            {aba === 'eleicao' && (
              <div className={card}>
                <p className="text-lg font-bold text-[#0F2053]">Eleição</p>
                <p className="mt-1 text-[15px] text-slate-600">Em construção: aguardando as instruções.</p>
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
