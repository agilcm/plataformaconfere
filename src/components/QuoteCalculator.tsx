import { useEffect, useId, useRef, useState } from 'react';
import { OPERATIONAL_SERVICES, COMPANY_PROFILE, whatsappLink } from '../data/servicesData.ts';
import { downloadPdf, slug } from '../lib/pdfReport.ts';
import { quoteRequestReport } from '../lib/reports.ts';
import { openMailto, sendEmail } from '../lib/sendEmail.ts';
import { SectionHeader } from './ui.tsx';

const MAX_STAFF = 50;

interface QuoteCalculatorProps {
  preselectedServiceId?: string;
}

// Pedido de orçamento de terceirização: não mostramos valores.
// Os dados vão por e-mail para a Ágil CM (com cópia para o visitante) e a equipe monta a proposta.
export default function QuoteCalculator({ preselectedServiceId }: QuoteCalculatorProps) {
  const serviceInputId = useId();
  const areaInputId = useId();
  const staffInputId = useId();
  const freqInputId = useId();

  const [serviceId, setServiceId] = useState(preselectedServiceId || OPERATIONAL_SERVICES[0].id);
  const [areaSize, setAreaSize] = useState<number>(800);
  const [staffCount, setStaffCount] = useState<number>(2);
  const [frequency, setFrequency] = useState<'daily' | 'weekly_3x' | 'scale_12x36' | 'planton_24_7'>('daily');
  const [includesSupplies, setIncludesSupplies] = useState(true);
  const [dedicatedSupervisor, setDedicatedSupervisor] = useState(true);
  const [civilInsurance, setCivilInsurance] = useState(true);
  const [slaReporting, setSlaReporting] = useState(true);

  const [companyName, setCompanyName] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [mailStatus, setMailStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const formRef = useRef<HTMLFormElement>(null);
  const [exportState, setExportState] = useState<'idle' | 'busy' | 'done' | 'declined' | 'error'>('idle');

  useEffect(() => {
    if (preselectedServiceId) setServiceId(preselectedServiceId);
  }, [preselectedServiceId]);

  const selectedServiceObj = OPERATIONAL_SERVICES.find((s) => s.id === serviceId) || OPERATIONAL_SERVICES[0];

  const FREQ_LABELS: Record<typeof frequency, string> = {
    weekly_3x: '3x por semana (segunda, quarta e sexta)',
    daily: 'Diária comercial (segunda a sexta)',
    scale_12x36: 'Escala contínua 12x36',
    planton_24_7: 'Plantão 24 horas, 7 dias',
  };

  const inclusions = [
    { label: 'Materiais e equipamentos', included: includesSupplies },
    { label: 'Supervisor volante', included: dedicatedSupervisor },
    { label: 'Seguro de responsabilidade civil', included: civilInsurance },
    { label: 'Relatório mensal e certidões', included: slaReporting },
  ];

  const resumo: [string, string][] = [
    ['Serviço', selectedServiceObj.title],
    ['Área', `${areaSize.toLocaleString('pt-BR')} m²`],
    ['Equipe', `${staffCount} ${staffCount === 1 ? 'profissional' : 'profissionais'}`],
    ['Frequência', FREQ_LABELS[frequency]],
    ['Incluir', inclusions.filter((i) => i.included).map((i) => i.label).join(', ') || 'Nada adicional'],
  ];

  const subject = `[Pedido de orçamento] ${selectedServiceObj.title}${companyName ? ` - ${companyName}` : ''}`;

  const getRequestText = () =>
    `PEDIDO DE ORÇAMENTO - TERCEIRIZAÇÃO
Empresa / órgão: ${companyName || 'A informar'}
Responsável: ${contactName || 'A informar'}
E-mail: ${contactEmail || 'A informar'}
Telefone/WhatsApp: ${contactPhone || 'A informar'}

O QUE PRECISA SER FEITO
- Serviço: ${selectedServiceObj.title} (${selectedServiceObj.subtitle})
- Área aproximada: ${areaSize.toLocaleString('pt-BR')} m²
- Equipe desejada: ${staffCount} profissional(is)
- Frequência: ${FREQ_LABELS[frequency]}
${inclusions.map((i) => `- ${i.label}: ${i.included ? 'Sim' : 'Não'}`).join('\n')}
${notes ? `- Observações: ${notes}\n` : ''}
Aguardo a análise e a proposta da Ágil CM.`;

  const validar = () => !formRef.current || formRef.current.reportValidity();

  const handleSendWhatsApp = () => {
    if (!validar()) return;
    window.open(whatsappLink(getRequestText()), '_blank', 'noopener,noreferrer');
  };

  const handleDownload = async () => {
    setExportState('busy');
    try {
      const r = await downloadPdf(
        `pedido-orcamento-${slug(selectedServiceObj.title)}${companyName ? '-' + slug(companyName) : ''}.pdf`,
        'Solicitação de Orçamento',
        quoteRequestReport({
          serviceTitle: selectedServiceObj.title,
          serviceSubtitle: selectedServiceObj.subtitle,
          areaSize,
          staffCount,
          frequencyLabel: FREQ_LABELS[frequency],
          inclusions,
          companyName: companyName.trim(),
          contactName: contactName.trim(),
          contactEmail: contactEmail.trim(),
          contactPhone: contactPhone.trim(),
          notes: notes.trim(),
        }),
      );
      setExportState(r === 'declined' ? 'declined' : 'done');
    } catch (err) {
      console.error('Falha ao gerar PDF', err);
      setExportState('error');
    }
  };

  const handleSendEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setMailStatus('sending');
    try {
      await sendEmail({
        subject,
        name: contactName,
        email: contactEmail,
        message: getRequestText(),
        fields: { Empresa: companyName, Telefone: contactPhone, Serviço: selectedServiceObj.title },
      });
      setMailStatus('sent');
    } catch {
      setMailStatus('error');
    }
  };

  const inputCls =
    'bg-white border border-slate-300 rounded-lg px-3 py-2.5 text-base text-[#0F2053] placeholder-slate-400 focus:outline-none focus:border-[#0478CA] focus:ring-2 focus:ring-[#0478CA]/20';

  return (
    <section id="simular-orcamento" aria-labelledby="titulo-simular-orcamento" className="py-16 sm:py-24 bg-[#F4F7FB]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeader
          id="titulo-simular-orcamento"
          eyebrow="Pedir orçamento"
          title="Peça o orçamento da sua terceirização"
          lead="Conte como é o serviço: área, equipe e frequência. Nossa equipe analisa e envia a proposta personalizada para o seu e-mail."
        />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

          {/* Controls Column (Left) */}
          <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-6 sm:p-8">
            <h3 className="text-base font-bold font-display text-[#0F2053] mb-6 flex items-center justify-between border-b border-slate-200 pb-3">
              <span>1. Escolha o serviço</span>
            </h3>

            {/* Service selector */}
            <div className="mb-6">
              <label htmlFor={serviceInputId} className="block text-sm font-semibold text-slate-700 mb-2">
                Serviço
              </label>
              <select
                id={serviceInputId}
                value={serviceId}
                onChange={(e) => setServiceId(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg px-3.5 py-2.5 text-sm text-[#0F2053] focus:outline-none focus:border-[#0478CA]"
              >
                {OPERATIONAL_SERVICES.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.number}. {s.title}
                  </option>
                ))}
              </select>
            </div>

            {/* Area Size Slider & Presets */}
            <div className="mb-6">
              <div className="flex justify-between items-center mb-2">
                <label htmlFor={areaInputId} className="text-sm font-semibold text-slate-700">
                  Tamanho da área
                </label>
                <span className="text-sm font-bold font-display text-[#0F2053] tabular-nums">
                  {areaSize.toLocaleString('pt-BR')} m²
                </span>
              </div>
              <input
                id={areaInputId}
                type="range"
                min="100"
                max="10000"
                step="50"
                value={areaSize}
                onChange={(e) => setAreaSize(Number(e.target.value))}
                className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-[#0478CA]"
              />
              <div className="flex flex-wrap items-center gap-2 mt-2.5 text-sm text-slate-600">
                <span>Atalhos:</span>
                <button
                  type="button"
                  onClick={() => setAreaSize(400)}
                  aria-pressed={areaSize === 400}
                  className={`px-2.5 py-1 bg-white border rounded hover:text-[#0F2053] cursor-pointer ${areaSize === 400 ? 'border-[#0478CA] text-[#0F2053]' : 'border-slate-300'}`}
                >
                  Escritório (400m²)
                </button>
                <button
                  type="button"
                  onClick={() => setAreaSize(1800)}
                  aria-pressed={areaSize === 1800}
                  className={`px-2.5 py-1 bg-white border rounded hover:text-[#0F2053] cursor-pointer ${areaSize === 1800 ? 'border-[#0478CA] text-[#0F2053]' : 'border-slate-300'}`}
                >
                  Edifício / Órgão (1.800m²)
                </button>
                <button
                  type="button"
                  onClick={() => setAreaSize(6000)}
                  aria-pressed={areaSize === 6000}
                  className={`px-2.5 py-1 bg-white border rounded hover:text-[#0F2053] cursor-pointer ${areaSize === 6000 ? 'border-[#0478CA] text-[#0F2053]' : 'border-slate-300'}`}
                >
                  Praça / Galpão (6.000m²)
                </button>
              </div>
            </div>

            {/* Staff Count & Frequency */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              <div>
                <label htmlFor={staffInputId} className="block text-sm font-semibold text-slate-700 mb-2">
                  Número de funcionários
                </label>
                <div className="flex items-center">
                  <button
                    type="button"
                    onClick={() => setStaffCount((prev) => Math.max(1, prev - 1))}
                    aria-label="Diminuir equipe"
                    className="w-10 h-10 flex items-center justify-center bg-white border border-slate-300 rounded-l-lg hover:bg-slate-100 text-slate-700 cursor-pointer"
                  >
                    -
                  </button>
                  <input
                    id={staffInputId}
                    type="number"
                    min="1"
                    max={MAX_STAFF}
                    value={staffCount}
                    onChange={(e) => setStaffCount(Math.min(MAX_STAFF, Math.max(1, Number(e.target.value) || 1)))}
                    className="w-full h-10 text-center bg-white border-y border-slate-300 text-sm font-semibold tabular-nums text-[#0F2053]"
                  />
                  <button
                    type="button"
                    onClick={() => setStaffCount((prev) => Math.min(MAX_STAFF, prev + 1))}
                    aria-label="Aumentar equipe"
                    className="w-10 h-10 flex items-center justify-center bg-white border border-slate-300 rounded-r-lg hover:bg-slate-100 text-slate-700 cursor-pointer"
                  >
                    +
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor={freqInputId} className="block text-sm font-semibold text-slate-700 mb-2">
                  Frequência
                </label>
                <select
                  id={freqInputId}
                  value={frequency}
                  onChange={(e) => setFrequency(e.target.value as typeof frequency)}
                  className="w-full h-10 bg-white border border-slate-300 rounded-lg px-3 text-sm text-[#0F2053] focus:outline-none focus:border-[#0478CA]"
                >
                  <option value="weekly_3x">3x na semana (Seg, Qua, Sex)</option>
                  <option value="daily">Diário Comercial (Seg-Sex)</option>
                  <option value="scale_12x36">Escala Contínua 12x36</option>
                  <option value="planton_24_7">Plantão 24/7 (Ininterrupto)</option>
                </select>
              </div>
            </div>

            {/* Inclusions */}
            <div className="space-y-2.5 pt-4 border-t border-slate-200">
              <span className="block text-sm font-semibold text-[#0478CA] mb-2">
                O que você precisa
              </span>

              <label className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-lg cursor-pointer hover:border-slate-300 transition-colors">
                <div>
                  <div className="text-sm font-semibold text-[#0F2053]">Materiais e equipamentos</div>
                  <div className="text-sm text-slate-600">Produtos certificados ANVISA, roçadeiras, enceradeiras e EPIs</div>
                </div>
                <input
                  type="checkbox"
                  checked={includesSupplies}
                  onChange={(e) => setIncludesSupplies(e.target.checked)}
                  className="w-5 h-5 shrink-0 ml-3 accent-[#0478CA] cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-lg cursor-pointer hover:border-slate-300 transition-colors">
                <div>
                  <div className="text-sm font-semibold text-[#0F2053]">Supervisor volante</div>
                  <div className="text-sm text-slate-600">Auditoria periódica com checklist digital e reposição imediata</div>
                </div>
                <input
                  type="checkbox"
                  checked={dedicatedSupervisor}
                  onChange={(e) => setDedicatedSupervisor(e.target.checked)}
                  className="w-5 h-5 shrink-0 ml-3 accent-[#0478CA] cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-lg cursor-pointer hover:border-slate-300 transition-colors">
                <div>
                  <div className="text-sm font-semibold text-[#0F2053]">Seguro de responsabilidade civil</div>
                  <div className="text-sm text-slate-600">Proteção patrimonial completa com apólice ativa</div>
                </div>
                <input
                  type="checkbox"
                  checked={civilInsurance}
                  onChange={(e) => setCivilInsurance(e.target.checked)}
                  className="w-5 h-5 shrink-0 ml-3 accent-[#0478CA] cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-lg cursor-pointer hover:border-slate-300 transition-colors">
                <div>
                  <div className="text-sm font-semibold text-[#0F2053]">Relatório mensal e certidões</div>
                  <div className="text-sm text-slate-600">Envio mensal de CNDs, GFIP, FGTS e eSocial para faturamento</div>
                </div>
                <input
                  type="checkbox"
                  checked={slaReporting}
                  onChange={(e) => setSlaReporting(e.target.checked)}
                  className="w-5 h-5 shrink-0 ml-3 accent-[#0478CA] cursor-pointer"
                />
              </label>
            </div>

          </div>

          {/* Pedido (direita) */}
          <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm">
            <h3 className="text-xl font-bold font-display text-[#0F2053]">2. Receba a proposta</h3>
            <p className="mt-1 text-[15px] text-slate-600 leading-relaxed">
              Cada serviço depende da convenção coletiva, do local e da rotina. Por isso nossa equipe analisa o seu caso e monta o
              orçamento — sem valor pronto de tabela.
            </p>

            <dl className="mt-5 p-4 rounded-xl bg-[#F4F7FB] border border-slate-200 space-y-1.5 text-[15px]">
              {resumo.map(([k, v]) => (
                <div key={k} className="flex gap-3">
                  <dt className="w-24 shrink-0 text-slate-500">{k}</dt>
                  <dd className="font-semibold text-[#0F2053] min-w-0">{v}</dd>
                </div>
              ))}
            </dl>

            <form ref={formRef} onSubmit={handleSendEmail} className="mt-6 space-y-3">
              <p className="text-sm font-semibold text-slate-700">Seus dados</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input type="text" required placeholder="Empresa ou órgão" aria-label="Empresa ou órgão" autoComplete="organization" value={companyName} onChange={(e) => setCompanyName(e.target.value)} className={inputCls} />
                <input type="text" required placeholder="Seu nome" aria-label="Seu nome" autoComplete="name" value={contactName} onChange={(e) => setContactName(e.target.value)} className={inputCls} />
              </div>
              <input type="email" required placeholder="Seu e-mail (a proposta chega aqui)" aria-label="Seu e-mail" autoComplete="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} className={`w-full ${inputCls}`} />
              <input type="tel" placeholder="WhatsApp / telefone (opcional)" aria-label="WhatsApp ou telefone" autoComplete="tel" inputMode="tel" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} className={`w-full ${inputCls}`} />
              <textarea rows={3} placeholder="Endereço do local, horários, data prevista de início, outras informações…" aria-label="Observações" value={notes} onChange={(e) => setNotes(e.target.value)} className={`w-full ${inputCls}`} />

              <button
                type="submit"
                disabled={mailStatus === 'sending'}
                className="w-full py-3.5 px-4 bg-[#0478CA] hover:bg-[#03609F] disabled:opacity-60 text-white font-bold text-base rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-md"
              >
                <svg className="w-5 h-5" aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                {mailStatus === 'sending' ? 'Enviando…' : 'Enviar para a Ágil montar o orçamento'}
              </button>
              <p className="text-sm text-slate-500 text-center">Os dados vão para {COMPANY_PROFILE.email} e você recebe uma cópia.</p>

              {mailStatus === 'sent' && (
                <div role="status" className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-[15px]">
                  Pedido enviado! Uma cópia foi para {contactEmail}. Nossa equipe vai analisar e retornar com a proposta.
                </div>
              )}
              {mailStatus === 'error' && (
                <div role="alert" className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-[15px]">
                  Não conseguimos enviar agora.{' '}
                  <button type="button" onClick={() => openMailto(subject, getRequestText(), contactEmail)} className="font-bold underline cursor-pointer">
                    Abrir no seu e-mail
                  </button>{' '}
                  ou use o WhatsApp.
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleSendWhatsApp}
                  className="py-2.5 px-3 border-2 border-[#128C4A]/30 text-[#0E7A40] hover:bg-[#128C4A]/5 font-bold text-[15px] rounded-xl transition-colors cursor-pointer"
                >
                  Enviar pelo WhatsApp
                </button>
                <button
                  type="button"
                  onClick={handleDownload}
                  disabled={exportState === 'busy'}
                  className="py-2.5 px-3 border-2 border-slate-200 hover:border-[#0478CA] disabled:opacity-60 text-[#0F2053] font-bold text-[15px] rounded-xl transition-colors cursor-pointer"
                >
                  {exportState === 'busy' ? 'Gerando PDF…' : 'Baixar pedido de orçamento (PDF)'}
                </button>
              </div>
              {exportState === 'done' && <p role="status" className="text-sm text-emerald-800">PDF do pedido gerado. Confira a pasta de downloads.</p>}
              {exportState === 'declined' && <p role="status" className="text-sm text-slate-600">Download cancelado. Clique novamente quando quiser salvar.</p>}
              {exportState === 'error' && <p role="alert" className="text-sm text-amber-800">Não foi possível gerar o PDF neste navegador. Tente novamente.</p>}
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}
