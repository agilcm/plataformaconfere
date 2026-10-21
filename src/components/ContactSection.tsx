import { useEffect, useId, useState } from 'react';
import { COMPANY_PROFILE, CONTACT_OPTIONS, whatsappLink } from '../data/servicesData.ts';
import { openMailto, sendEmail } from '../lib/sendEmail.ts';
import { btnPrimary, btnWhatsApp, Container, Icon, SectionHeader, WhatsAppIcon } from './ui.tsx';

interface ContactSectionProps {
  defaultService?: string;
}

const PREFERENCES = ['WhatsApp', 'Ligação', 'Reunião online', 'Visita presencial'];

const inputCls =
  'w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-base text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#0478CA] focus:ring-2 focus:ring-[#0478CA]/20';
const labelCls = 'block text-[15px] font-semibold text-slate-800 mb-1.5';

export default function ContactSection({ defaultService }: ContactSectionProps) {
  const uid = useId();
  const id = (k: string) => `${uid}-${k}`;
  const [name, setName] = useState('');
  const [organization, setOrganization] = useState('');
  const [cityState, setCityState] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [serviceType, setServiceType] = useState(CONTACT_OPTIONS[0].value);
  const [preference, setPreference] = useState(PREFERENCES[0]);
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  useEffect(() => {
    if (defaultService) setServiceType(defaultService);
  }, [defaultService]);

  const summary =
    `Nome: ${name}\nEmpresa / órgão: ${organization}\nCidade/UF: ${cityState}\nE-mail: ${email}\nTelefone: ${phone}\n` +
    `Serviço: ${serviceType}\nPrefere: ${preference}` +
    (message ? `\n\nMensagem:\n${message}` : '');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const subject = `[Site Ágil CM] ${serviceType} - ${organization || name}`;
    setStatus('sending');
    try {
      await sendEmail({
        subject,
        name,
        email,
        message: message || '(sem mensagem)',
        fields: {
          'Empresa / órgão': organization || '-',
          'Cidade / UF': cityState || '-',
          Telefone: phone,
          Serviço: serviceType,
          'Prefere ser atendido por': preference,
        },
      });
      setStatus('sent');
    } catch {
      setStatus('error');
    }
  };

  const whatsHref = whatsappLink(`Olá! Vim pelo site da Ágil CM.\n${summary}`);

  return (
    <section id="contato" aria-labelledby="titulo-contato" className="py-16 sm:py-24 bg-[#F4F7FB]">
      <Container>
        <SectionHeader
          id="titulo-contato"
          eyebrow="Fale com a gente"
          title="Peça seu orçamento ou agende uma conversa"
          lead="Respondemos em horário comercial, de segunda a sexta, das 8h às 18h."
        />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Canais diretos */}
          <address className="lg:col-span-4 not-italic space-y-4">
            <a
              href={whatsappLink('Olá! Vim pelo site da Ágil CM e gostaria de atendimento.')}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-4 p-5 rounded-2xl bg-white border border-slate-200 hover:border-[#128C4A] transition-colors"
            >
              <span className="w-12 h-12 rounded-xl bg-[#128C4A] text-white flex items-center justify-center shrink-0">
                <WhatsAppIcon className="w-6 h-6" />
              </span>
              <span>
                <span className="block text-sm text-slate-500">WhatsApp e telefone</span>
                <span className="block text-lg font-bold text-[#0F2053]">{COMPANY_PROFILE.phoneDisplay}</span>
              </span>
            </a>
            <a href={`mailto:${COMPANY_PROFILE.email}`} className="flex items-center gap-4 p-5 rounded-2xl bg-white border border-slate-200 hover:border-[#0478CA] transition-colors">
              <span className="w-12 h-12 rounded-xl bg-[#0478CA] text-white flex items-center justify-center shrink-0">
                <Icon name="doc" className="w-6 h-6" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm text-slate-500">E-mail</span>
                <span className="block text-lg font-bold text-[#0F2053] break-all">{COMPANY_PROFILE.email}</span>
              </span>
            </a>
            <div className="flex items-center gap-4 p-5 rounded-2xl bg-white border border-slate-200">
              <span className="w-12 h-12 rounded-xl bg-[#0F2053] text-white flex items-center justify-center shrink-0">
                <Icon name="building" className="w-6 h-6" />
              </span>
              <span>
                <span className="block text-sm text-slate-500">Sede</span>
                <span className="block text-lg font-bold text-[#0F2053]">{COMPANY_PROFILE.city}</span>
                <span className="block text-sm text-slate-600">CNPJ {COMPANY_PROFILE.cnpj}</span>
              </span>
            </div>
          </address>

          {/* Formulário */}
          <form onSubmit={handleSubmit} className="lg:col-span-8 p-6 sm:p-8 rounded-2xl bg-white border border-slate-200 space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label htmlFor={id('nome')} className={labelCls}>Seu nome</label>
                <input id={id('nome')} required autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label htmlFor={id('org')} className={labelCls}>Empresa ou prefeitura</label>
                <input
                  id={id('org')}
                  autoComplete="organization"
                  placeholder="Nome da empresa ou do órgão"
                  value={organization}
                  onChange={(e) => setOrganization(e.target.value)}
                  className={inputCls}
                />
              </div>
              <div>
                <label htmlFor={id('tel')} className={labelCls}>WhatsApp ou telefone</label>
                <input
                  id={id('tel')}
                  type="tel"
                  required
                  autoComplete="tel"
                  inputMode="tel"
                  placeholder="(32) 90000-0000"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className={inputCls}
                />
              </div>
              <div>
                <label htmlFor={id('email')} className={labelCls}>E-mail</label>
                <input id={id('email')} type="email" required autoComplete="email" placeholder="voce@empresa.com.br" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label htmlFor={id('serv')} className={labelCls}>Serviço de interesse</label>
                <select id={id('serv')} value={serviceType} onChange={(e) => setServiceType(e.target.value)} className={inputCls}>
                  {CONTACT_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor={id('pref')} className={labelCls}>Como prefere ser atendido?</label>
                <select id={id('pref')} value={preference} onChange={(e) => setPreference(e.target.value)} className={inputCls}>
                  {PREFERENCES.map((p) => (
                    <option key={p}>{p}</option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label htmlFor={id('cid')} className={labelCls}>Cidade / UF</label>
                <input id={id('cid')} autoComplete="address-level2" placeholder="Ex.: Cataguases, MG" value={cityState} onChange={(e) => setCityState(e.target.value)} className={inputCls} />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor={id('msg')} className={labelCls}>Conte rapidamente o que precisa</label>
                <textarea id={id('msg')} rows={3} value={message} onChange={(e) => setMessage(e.target.value)} className={inputCls} />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <a href={whatsHref} target="_blank" rel="noopener noreferrer" className={`${btnWhatsApp} flex-1`}>
                <WhatsAppIcon className="w-5 h-5" />
                Enviar pelo WhatsApp
              </a>
              <button type="submit" disabled={status === 'sending'} className={`${btnPrimary} flex-1 disabled:opacity-60`}>
                {status === 'sending' ? 'Enviando…' : 'Enviar por e-mail'}
              </button>
            </div>

            <p className="text-sm text-slate-500">Você recebe uma cópia da mensagem no e-mail informado.</p>
            {status === 'sent' && (
              <p role="status" className="text-[15px] text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
                Mensagem enviada! Uma cópia foi para {email}. Responderemos em breve.
              </p>
            )}
            {status === 'error' && (
              <p role="alert" className="text-[15px] text-amber-900 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                Não conseguimos enviar agora.{' '}
                <button
                  type="button"
                  onClick={() => openMailto(`[Site Ágil CM] ${serviceType} - ${organization || name}`, summary, email)}
                  className="font-bold underline cursor-pointer"
                >
                  Abrir no seu e-mail
                </button>{' '}
                ou use o WhatsApp.
              </p>
            )}
          </form>
        </div>
      </Container>
    </section>
  );
}
