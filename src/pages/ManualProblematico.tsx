// Consulta CNPJ → CNPJ problemático → "Manual: como proceder". Passo a passo para a equipe: a rotina de envio, o que cada
// caso significa e o que oferecer, o que conferir antes, a mensagem, o atendimento depois da resposta, como regularizar
// cada caso, os cuidados e a metodologia da lista (as regras ficam em src/lib/cnpjProblematico.js). Só texto: não
// depende dos dados cifrados, então abre mesmo antes de digitar a senha.
import type { ReactNode } from 'react';
import { Icon } from '../components/ui.tsx';

const SECOES = [
  { id: 'manual-resumo', titulo: 'Resumo em 1 minuto' },
  { id: 'manual-rotina', titulo: 'Rotina de envio, passo a passo' },
  { id: 'manual-casos', titulo: 'O que cada caso significa e o que oferecer' },
  { id: 'manual-conferir', titulo: 'Antes de enviar: conferir a empresa' },
  { id: 'manual-mensagem', titulo: 'A mensagem do WhatsApp' },
  { id: 'manual-resposta', titulo: 'Quando a empresa responder' },
  { id: 'manual-regularizar', titulo: 'Como regularizar cada caso' },
  { id: 'manual-cuidados', titulo: 'Cuidados: LGPD, WhatsApp e linguagem' },
  { id: 'manual-metodologia', titulo: 'Como a lista é montada' },
  { id: 'manual-limites', titulo: 'Limites dos dados' },
];

const irPara = (id: string) => {
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  el.focus({ preventScroll: true });
};

function Secao({ id, n, children }: { id: string; n: number; children: ReactNode }) {
  const s = SECOES.find((x) => x.id === id)!;
  return (
    <section aria-labelledby={`${id}-t`} className="scroll-mt-24">
      <h3 id={`${id}-t`} className="text-xl sm:text-2xl font-bold font-display text-[#0F2053] tracking-tight">
        <span id={id} tabIndex={-1} className="outline-none">
          {n}. {s.titulo}
        </span>
      </h3>
      <div className="mt-3 space-y-3 text-base sm:text-[17px] text-slate-800 leading-relaxed">{children}</div>
    </section>
  );
}

function Caso({ titulo, tipo, cor, children }: { titulo: string; tipo: string; cor: string; children: ReactNode }) {
  return (
    <li className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200">
      <p className="flex flex-wrap items-center gap-2">
        <strong className="text-lg font-bold font-display text-[#0F2053]">{titulo}</strong>
        <span className={`px-2.5 py-0.5 rounded-full text-sm font-bold ${cor}`}>{tipo}</span>
      </p>
      <div className="mt-2 space-y-2 text-base text-slate-800 leading-relaxed">{children}</div>
    </li>
  );
}

const PROBLEMA = 'bg-red-50 text-red-800 border border-red-200';
const CRESCIMENTO = 'bg-emerald-50 text-emerald-800 border border-emerald-200';
const VERIFICAR = 'bg-amber-50 text-amber-900 border border-amber-200';

function Resposta({ pergunta, children }: { pergunta: string; children: ReactNode }) {
  return (
    <div className="p-4 rounded-xl bg-[#F7FAFD] border border-slate-200">
      <p className="font-bold text-[#0F2053]">{pergunta}</p>
      <p className="mt-1 text-slate-800">{children}</p>
    </div>
  );
}

export default function ManualProblematico({ onFechar }: { onFechar: () => void }) {
  return (
    <article aria-labelledby="manual-titulo" className="mt-5 p-5 sm:p-8 rounded-2xl bg-white border border-slate-200">
      <div className="flex flex-col sm:flex-row sm:items-start gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-[#0369B3]">Manual da equipe</p>
          <h2 id="manual-titulo" tabIndex={-1} className="mt-1 text-2xl sm:text-3xl font-bold font-display text-[#0F2053] tracking-tight outline-none">
            CNPJ problemático: como proceder
          </h2>
          <p className="mt-2 max-w-3xl text-base sm:text-lg text-slate-700 leading-relaxed">
            Do primeiro contato ao fechamento: como montar a fila do dia, o que cada caso significa, o que conferir antes de enviar, o que responder e como a
            regularização funciona.
          </p>
        </div>
        <button
          type="button"
          onClick={onFechar}
          className="sm:shrink-0 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-[#0F2053] hover:bg-[#13306f] text-white text-base font-bold cursor-pointer"
        >
          Voltar para a lista
        </button>
      </div>

      <nav aria-label="Seções do manual" className="mt-6 p-4 sm:p-5 rounded-2xl bg-[#F4F7FB] border border-slate-200">
        <p className="text-sm font-bold text-slate-700">Neste manual</p>
        <ol className="mt-2 grid sm:grid-cols-2 gap-x-6 gap-y-1">
          {SECOES.map((s, i) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => irPara(s.id)}
                className="text-left font-semibold text-[#0369B3] underline underline-offset-4 cursor-pointer hover:text-[#0F2053]"
              >
                {i + 1}. {s.titulo}
              </button>
            </li>
          ))}
        </ol>
      </nav>

      <div className="mt-8 max-w-4xl space-y-10">
        <Secao id="manual-resumo" n={1}>
          <ul className="list-disc pl-6 space-y-1.5">
            <li>
              A lista mostra empresas da região com o <strong>CNPJ inapto</strong> ou que <strong>saíram (ou vão sair) do Simples ou do MEI</strong>.
            </li>
            <li>
              <strong>Problema</strong>: oferecer a regularização. <strong>Crescimento</strong>: oferecer os serviços contábeis. <strong>Verificar</strong>:
              conferir antes, porque a saída pode ter sido escolha da empresa ou já estar resolvida.
            </li>
            <li>
              Comece pela <strong>prioridade alta</strong>, com telefone e ainda sem mensagem. Dentro de cada prioridade, os casos mais recentes já vêm
              primeiro.
            </li>
            <li>
              Envie pelo botão <strong>Enviar WhatsApp</strong> e leia a mensagem antes de mandar. O site marca o envio e agenda o retorno em 3 dias.
            </li>
            <li>
              Quem pedir para não receber: etapa <strong>Não quis</strong>, e não procure de novo.
            </li>
          </ul>
        </Secao>

        <Secao id="manual-rotina" n={2}>
          <ol className="list-decimal pl-6 space-y-3">
            <li>
              <strong>Abra a lista.</strong> Consulta CNPJ › CNPJ problemático, com a senha do Privado. Preencha <em>Seu nome na mensagem</em> (fica guardado
              neste navegador) para a mensagem sair com "Aqui é (seu nome), da Ágil CM".
            </li>
            <li>
              <strong>Monte a fila do dia.</strong> Prioridade <em>Alta</em>, Mensagem <em>Falta enviar</em> e <em>Com telefone</em>. Se quiser, uma cidade por
              vez. Em novembro, dezembro e janeiro, comece pelas empresas que <em>Saem do Simples</em> no próximo 1º de janeiro e pelas que saíram no último: é
              em janeiro que se pede a volta ao Simples.
            </li>
            <li>
              <strong>Confira a empresa</strong> antes de enviar (seção 4). Leva um minuto e evita mandar mensagem errada.
            </li>
            <li>
              <strong>Envie.</strong> Clique em <em>Enviar WhatsApp</em> (o celular vem primeiro; o fixo também aparece porque muita empresa usa o WhatsApp
              Business no fixo). O WhatsApp abre com a mensagem pronta: leia, ajuste se precisar e envie.
            </li>
            <li>
              <strong>Confira a marcação.</strong> Ao abrir o WhatsApp, o site marca <em>Já enviei</em> e põe a empresa no funil como <em>Mensagem enviada</em>,
              com retorno em 3 dias (o lembrete chega pelo Telegram). Se acabou não enviando (o número não tem WhatsApp, por exemplo), desmarque.
            </li>
            <li>
              <strong>Faça um único lembrete.</strong> No dia do retorno, quem não respondeu recebe uma mensagem curta, por exemplo:{' '}
              <em>
                "Olá, Maria! Passando só para saber se recebeu minha mensagem sobre o CNPJ da Padaria Bom Pão. Se preferir, posso te ligar. Se não tiver
                interesse, é só me avisar."
              </em>{' '}
              Sem resposta depois disso, mude a etapa para <em>Não quis</em> e siga em frente.
            </li>
            <li>
              <strong>Envie aos poucos</strong>, em horário comercial (segunda a sexta, das 8h às 18h; sábado, das 8h às 12h). Sugestão: 20 a 30 mensagens por
              dia, espaçadas. Muitas mensagens seguidas para quem não tem o número salvo fazem o WhatsApp restringir a conta.
            </li>
            <li>
              <strong>Prefere planilha?</strong> <em>Exportar em Excel</em> traz a mensagem e o link <em>Abrir conversa</em> de cada empresa. Mas marque o envio
              no site: o que for marcado na planilha não volta para o site.
            </li>
          </ol>
        </Secao>

        <Secao id="manual-casos" n={3}>
          <p>
            O tipo de caso e o motivo aparecem em cada empresa. A mensagem pronta muda sozinha conforme o caso, mas é bom saber o que está por trás para
            conduzir a conversa.
          </p>
          <ul className="space-y-3">
            <Caso titulo="CNPJ inapto" tipo="Problema" cor={PROBLEMA}>
              <p>
                A Receita declarou o CNPJ inapto, quase sempre por <strong>falta de declarações</strong> (o motivo aparece no card). A empresa fica impedida de
                licitar, tem dificuldade com bancos e as notas fiscais emitidas podem ser consideradas inidôneas.
              </p>
              <p>
                <strong>Oferecer:</strong> a regularização (declarações em atraso, débitos e reativação do CNPJ) ou, se a empresa parou de funcionar, o
                encerramento do jeito certo.
              </p>
            </Caso>
            <Caso titulo="Sai do Simples no próximo 1º de janeiro" tipo="Problema · urgente" cor={PROBLEMA}>
              <p>
                A Receita já marcou a exclusão, em geral a <strong>exclusão anual por débitos</strong>. É o caso mais quente: com os débitos regularizados, a
                empresa pode pedir a volta ao Simples em janeiro.
              </p>
              <p>
                <strong>Oferecer:</strong> a regularização dos débitos e o pedido de volta ao Simples.
              </p>
            </Caso>
            <Caso titulo="Saiu do Simples em 1º de janeiro" tipo="Problema" cor={PROBLEMA}>
              <p>
                Saiu na exclusão anual por débitos. Desde então a empresa deveria apurar os impostos por outro regime (em geral o Lucro Presumido), com mais
                imposto e mais declarações. Se ela não percebeu a mudança, os impostos do novo regime podem estar sem pagar.
              </p>
              <p>
                <strong>Oferecer:</strong> a regularização (débitos e declarações do período) e o pedido de volta ao Simples no próximo janeiro.
              </p>
            </Caso>
            <Caso titulo="Saiu do MEI e do Simples na mesma data" tipo="Problema" cor={PROBLEMA}>
              <p>Saiu do MEI junto com o Simples, em geral por débitos do DAS. Passa a ser uma empresa comum fora do Simples, com uma declaração por mês.</p>
              <p>
                <strong>Oferecer:</strong> a regularização e o pedido de volta ao Simples (ou ao MEI, se ainda se encaixar), que é feito em janeiro.
              </p>
            </Caso>
            <Caso titulo="Saiu do MEI e continua no Simples" tipo="Crescimento" cor={CRESCIMENTO}>
              <p>
                Passou do limite de faturamento do MEI, contratou mais gente, abriu filial, ganhou sócio ou mudou para uma atividade que o MEI não permite.
                Agora é microempresa e <strong>precisa de contabilidade</strong>: a declaração do Simples todo mês (PGDAS-D), a DEFIS todo ano e, se tiver
                pró-labore ou funcionário, a folha, o eSocial e a DCTFWeb.
              </p>
              <p>
                <strong>Oferecer:</strong> os serviços contábeis da microempresa. Não fale em regularização: a empresa não está com problema.
              </p>
            </Caso>
            <Caso titulo="Verificar" tipo="Verificar" cor={VERIFICAR}>
              <p>
                Saída do Simples no meio do ano, saída do MEI sem estar no Simples, ou empresa que <strong>já voltou</strong> ao Simples ou ao MEI. Pode ter
                sido decisão da própria empresa (por exemplo, para mudar de regime) ou já estar resolvido. A mensagem pronta é mais leve e não fala em
                pendência.
              </p>
              <p>
                <strong>Oferecer:</strong> uma análise do regime (se compensa voltar ao Simples e se ficou algo pendente) ou, para quem já voltou, o
                acompanhamento mensal para não acontecer de novo.
              </p>
            </Caso>
          </ul>
          <p>
            <strong>Prioridade.</strong> <em>Alta</em>: problema, com telefone ou e-mail que não é de contador. <em>Média</em>: problema em que o e-mail parece
            ser de contador (a empresa já tem alguém), ou crescimento sem contador. <em>Baixa</em>: o resto, inclusive os casos a verificar.
          </p>
        </Secao>

        <Secao id="manual-conferir" n={4}>
          <p>A lista sai da base mensal da Receita, então algo pode ter mudado desde então. Antes de enviar, principalmente nos casos de prioridade alta:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              <strong>Consulta Optantes</strong>, no Portal do Simples Nacional (pública, com o CNPJ): mostra se a empresa está no Simples ou no MEI hoje e os
              períodos anteriores, com o tipo de exclusão. Se já voltou, não mande a mensagem de problema: edite o texto ou pule a empresa.
            </li>
            <li>
              <strong>Comprovante de Inscrição e de Situação Cadastral</strong>, no site da Receita: confirma se o CNPJ ainda está inapto e o motivo.
            </li>
            <li>
              <strong>De quem é o contato.</strong> Se o e-mail é de escritório de contabilidade, o telefone também pode ser do contador. Nesse caso, a conversa
              é diferente: a empresa já tem alguém, e a proposta é ajudar a resolver, sem criticar o contador.
            </li>
            <li>
              <strong>Consultar este CNPJ</strong> (no card) abre a ficha completa da empresa, com atividades e o histórico nas licitações.
            </li>
          </ul>
        </Secao>

        <Secao id="manual-mensagem" n={5}>
          <p>
            A mensagem se apresenta como a Ágil CM, empresa de consultoria, diz o que foi visto no cadastro público da Receita, explica o risco, faz a oferta e
            termina pedindo desculpas caso o número não seja da pessoa. Ela muda conforme o caso:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              <strong>Problema:</strong> pode gerar multa, bloqueio de notas fiscais e impedir empréstimos e vendas para órgãos públicos; as multas e dívidas
              podem chegar ao CPF; a pendência pode atrapalhar pedidos de auxílio ou de seguro-desemprego e a abertura de um MEI ou de outra empresa. Oferece a
              regularização.
            </li>
            <li>
              <strong>Saiu do MEI:</strong> passa a ter uma declaração por mês (12 por ano), e a multa de cada uma em atraso pode chegar a R$ 500, conforme o
              regime e o faturamento.
            </li>
            <li>
              <strong>Crescimento:</strong> a microempresa passa a precisar de contabilidade. Oferece os serviços contábeis.
            </li>
            <li>
              <strong>Verificar:</strong> se a saída não foi planejada, vale conferir se compensa voltar ao Simples. Para quem já voltou, oferece
              acompanhamento.
            </li>
          </ul>
          <p>
            <strong>Por que o texto diz "pode" e "podem acabar".</strong> No MEI e no empresário individual, a empresa e a pessoa são a mesma: as dívidas caem
            direto no CPF. Na sociedade (LTDA), a dívida só chega ao sócio em alguns casos. A multa de R$ 500 por declaração é o mínimo da DCTFWeb para empresa
            fora do Simples; dentro do Simples, a declaração mensal (PGDAS-D) tem multa mínima de R$ 50. O seguro-desemprego pode ser negado a quem tem empresa
            aberta, que precisa provar que ela não dá renda, e com declarações em atraso isso fica difícil. Não troque essas frases por afirmações absolutas
            ("vai cair no seu CPF", "você vai perder o seguro"): um empresário bem informado, ou o contador dele, desmente, e a confiança vai embora.
          </p>
        </Secao>

        <Secao id="manual-resposta" n={6}>
          <ol className="list-decimal pl-6 space-y-2">
            <li>
              Mude a etapa para <em>Respondeu</em> e anote o que a pessoa disse.
            </li>
            <li>
              <strong>Entenda o caso.</strong> A empresa ainda funciona? Recebeu algum aviso da Receita ou do Simples (DTE-SN, carta, e-mail)? Tem contador
              hoje? Emite nota fiscal? Tem funcionário ou pró-labore?
            </li>
            <li>
              <strong>Peça o acesso do jeito certo:</strong> uma procuração eletrônica no e-CAC para a Ágil CM, que o próprio cliente faz com a conta gov.br
              (nível prata ou ouro). Nunca peça a senha do gov.br, códigos de acesso ou o certificado digital do cliente.
            </li>
            <li>
              <strong>Faça o levantamento:</strong> relatório de situação fiscal no e-CAC, Consulta Optantes, dívida ativa na PGFN (Regularize), declarações em
              falta e débitos do DAS. Marque <em>Diagnóstico enviado</em> quando mandar o resumo.
            </li>
            <li>
              <strong>Proposta:</strong> o que será feito, o prazo e o valor. Depois, <em>Reunião marcada</em> ou <em>Fechou</em>.
            </li>
          </ol>
          <div className="space-y-2">
            <Resposta pergunta={'"Como você conseguiu meu número?"'}>
              "Os dados de contato das empresas são públicos no cadastro do CNPJ da Receita Federal. Se preferir não receber mais mensagens, é só me avisar."
            </Resposta>
            <Resposta pergunta={'"Já tenho contador."'}>
              "Ótimo! Vale confirmar com ele se essa situação já está sendo resolvida. Se precisar de uma segunda opinião, fico à disposição." Se não houver
              interesse, etapa <em>Não quis</em>.
            </Resposta>
            <Resposta pergunta={'"Isso é golpe?"'}>
              "Pode conferir: somos a Ágil CM, www.agilcm.com.br. Não pedimos senha, código nem pagamento por mensagem. Se quiser, te ligo do nosso número."
            </Resposta>
            <Resposta pergunta={'"Quanto custa?"'}>
              "Depende do que estiver pendente. Com a procuração no e-CAC, levantamos tudo e te passamos o valor antes de começar."
            </Resposta>
            <Resposta pergunta={'"Não tenho interesse" ou "não mande mais"'}>
              "Tudo bem, desculpe o incômodo. Não envio mais." Etapa <em>Não quis</em>, e a empresa não deve ser procurada de novo.
            </Resposta>
            <Resposta pergunta={'"Esse número não é dessa empresa."'}>
              "Desculpe o engano, obrigado por avisar." Etapa <em>Não quis</em>, com a anotação "número errado".
            </Resposta>
          </div>
        </Secao>

        <Secao id="manual-regularizar" n={7}>
          <p className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900">
            <Icon name="alert" className="inline w-5 h-5 -mt-1 mr-1" />
            Resumo para orientar o atendimento. Antes de passar prazos ou valores ao cliente, confira as regras em vigor no Portal do Simples Nacional e na
            Receita Federal.
          </p>
          <ul className="list-disc pl-6 space-y-3">
            <li>
              <strong>CNPJ inapto por falta de declarações:</strong> levante as declarações em falta (relatório de situação fiscal no e-CAC) e entregue todas:
              DASN-SIMEI no MEI; PGDAS-D e DEFIS no Simples; DCTFWeb, ECF e as demais fora do Simples. Pague ou parcele os débitos que aparecerem. A inscrição
              volta a ativa depois que as declarações são processadas. Outros motivos (por exemplo, não localizada no endereço) pedem a atualização do cadastro.
            </li>
            <li>
              <strong>Exclusão do Simples por débitos:</strong> o termo de exclusão chega pelo DTE-SN (a caixa postal do Simples). Regularizar os débitos
              (pagar, parcelar ou compensar) dentro do prazo do termo deixa a exclusão sem efeito. Se o prazo passou, regularize e faça nova opção pelo Simples
              em janeiro, até o último dia útil do mês; se for aceita, vale desde 1º de janeiro. Enquanto a empresa estiver fora, os impostos são os do outro
              regime.
            </li>
            <li>
              <strong>MEI desenquadrado por faturamento:</strong> se passou do limite em até 20%, vira microempresa a partir de 1º de janeiro do ano seguinte e
              paga um DAS complementar sobre o que passou; acima de 20%, o desenquadramento volta para o início do ano, e os meses precisam ser recalculados
              como microempresa. Em todos os casos, entregue a DASN-SIMEI do período em que foi MEI.
            </li>
            <li>
              <strong>MEI excluído junto com o Simples (débitos):</strong> regularize os débitos do DAS (dá para parcelar) e peça a volta em janeiro, ao Simples
              ou ao MEI, se a empresa ainda se encaixar.
            </li>
            <li>
              <strong>Ex-MEI no Simples (contabilidade):</strong> PGDAS-D e DAS até o dia 20 de cada mês, DEFIS até 31 de março, escrituração contábil (ou ao
              menos o livro-caixa) e, se houver pró-labore ou funcionário, folha, eSocial e DCTFWeb.
            </li>
            <li>
              <strong>Empresa que parou de funcionar:</strong> o encerramento (baixa) é feito pela Redesim ou, no MEI, pelo Portal do Empreendedor. A baixa pode
              ser feita mesmo com débitos, mas eles não somem: passam a ser cobrados do titular ou dos sócios. Por isso vale regularizar antes ou junto.
            </li>
          </ul>
        </Secao>

        <Secao id="manual-cuidados" n={8}>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              <strong>LGPD.</strong> Os dados são públicos, mas têm nomes de pessoas. Use só para oferecer o serviço, não repasse a lista nem a planilha para
              fora da equipe e atenda na hora quem pedir para não ser procurado (etapa <em>Não quis</em>).
            </li>
            <li>
              <strong>WhatsApp.</strong> Use o WhatsApp Business da Ágil, com foto, nome, site e horário no perfil. Poucas mensagens por dia, sem insistir: um
              envio e, no máximo, um lembrete.
            </li>
            <li>
              <strong>Linguagem.</strong> Use "pode" e evite tom de ameaça. Nunca diga que fala em nome da Receita ou do governo, não prometa resultado ("vamos
              tirar a multa") e não cite valores de dívida que ainda não foram levantados.
            </li>
            <li>
              <strong>Senha.</strong> A lista fica cifrada com a senha do Privado. Ao terminar num computador que não é seu, clique em <em>Fechar</em>.
            </li>
          </ul>
        </Secao>

        <Secao id="manual-metodologia" n={9}>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              <strong>Fonte.</strong> Dados Abertos do CNPJ da Receita Federal (cadastro, sócios, Simples e MEI), base mensal. A lista é montada no GitHub a
              partir do <code>cnpj.db</code> do Google Drive e publicada cifrada. Ela é refeita quando a base muda e sempre que as regras mudam.
            </li>
            <li>
              <strong>Quem entra.</strong> Estabelecimentos das cidades configuradas (a lista mostra quais) com o CNPJ inapto, de qualquer data, ou que saíram
              do Simples ou do MEI no ano da base ou no anterior. Nas saídas, só empresas ainda abertas (ativas, suspensas ou inaptas).
            </li>
            <li>
              <strong>Datas.</strong> A Receita grava a saída de 1º de janeiro como 31/12 do ano anterior (o último dia no regime). O site mostra a data em que
              a saída vale ("Saiu do Simples em 01/01/2026") e conta o ano por ela. "Sai" ou "Saem" é a saída já marcada para o próximo 1º de janeiro.
            </li>
            <li>
              <strong>Motivo deduzido.</strong> A base aberta não traz o motivo da exclusão. <em>Problema</em>: CNPJ inapto; saída do MEI e do Simples na mesma
              data; exclusão do Simples com efeito em 1º de janeiro (a exclusão anual por débitos); saída do MEI seguida de exclusão do Simples; ou saída perto
              da data em que o CNPJ ficou inapto. <em>Crescimento</em>: saiu do MEI e continua no Simples. <em>Verificar</em>: exclusão no meio do ano, saída do
              MEI sem estar no Simples, ou empresa que já voltou ao Simples ou ao MEI.
            </li>
            <li>
              <strong>Contador.</strong> O e-mail é tratado como de contador quando tem palavras como contab, contador, contábil, escritório, assessoria, fiscal
              ou consultoria.
            </li>
            <li>
              <strong>Ordem.</strong> Prioridade, depois o tipo de caso e, dentro disso, o caso mais recente primeiro (quem acabou de receber o aviso tende a
              responder mais e com o contato em dia).
            </li>
          </ul>
        </Secao>

        <Secao id="manual-limites" n={10}>
          <ul className="list-disc pl-6 space-y-2">
            <li>O motivo é deduzido, não informado pela Receita: confirme na Consulta Optantes antes de afirmar qualquer coisa ao cliente.</li>
            <li>Telefone e e-mail são os que a empresa informou à Receita: podem estar desatualizados ou ser do contador.</li>
            <li>A base é mensal: a empresa pode já ter resolvido a situação depois da data da base.</li>
            <li>
              Os riscos da mensagem (CPF, seguro-desemprego, auxílios, abertura de outra empresa) são possibilidades, não certezas, e dependem de cada caso.
            </li>
          </ul>
        </Secao>
      </div>

      <div className="mt-10 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={onFechar}
          className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-[#0F2053] hover:bg-[#13306f] text-white text-base font-bold cursor-pointer"
        >
          Voltar para a lista
        </button>
        <button
          type="button"
          onClick={() => irPara('manual-titulo')}
          className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl border-2 border-slate-300 bg-white text-[#0F2053] text-base font-bold hover:border-[#0478CA] cursor-pointer"
        >
          Voltar ao início do manual
        </button>
      </div>
    </article>
  );
}
