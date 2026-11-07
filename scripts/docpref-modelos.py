"""Gera os modelos do DocPref em public/docpref/modelos (Word e Excel), no padrão Ágil CM.

Declarações mensais (houve / não houve), de início e fim de contrato, de não aplicação e a planilha de força de
trabalho com as mesmas validações do modelo usado pelas tomadoras. Os arquivos saem sem metadados de terceiros.

Uso: python3 scripts/docpref-modelos.py   (precisa de python-docx e openpyxl)
"""

import datetime
import pathlib
import zipfile

from docx import Document
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.shared import Cm, Pt, RGBColor
from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.worksheet.datavalidation import DataValidation

SAIDA = pathlib.Path(__file__).resolve().parent.parent / 'public' / 'docpref' / 'modelos'
AUTOR = 'Ágil CM - DocPref'
DATA_FIXA = datetime.datetime(2026, 11, 1)  # data fixa: o arquivo só muda quando o texto muda

ABERTURA = 'Declaramos para os devidos fins, que (colocar a razão social completa), inscrita no CNPJ ____________________, com sede na Rua ______________________________, '

# (arquivo, título, texto depois da abertura, tabelas [(subtítulo, colunas, linhas)], texto final opcional)
DECLARACOES = [
    (
        'declaracao-acidente-de-trabalho',
        'DECLARAÇÃO DE REGISTRO DE ACIDENTE DE TRABALHO',
        'declara que houve / não houve acidente de trabalho no mês de ____________________, vinculado ao contrato nº ______________, mantendo assim nossa performance de excelência na prevenção de acidente.',
        [],
        None,
    ),
    (
        'declaracao-admissao-alocacao',
        'DECLARAÇÃO DE ADMISSÃO-ALOCAÇÃO',
        'declara que houve / não houve admissões/alocações de novos colaboradores no mês de ____________________, vinculado ao contrato nº ______________, conforme relação abaixo:',
        [(None, ['Nome Funcionário', 'CPF', 'Data admissão/alocação'], 8)],
        None,
    ),
    (
        'declaracao-demissao',
        'DECLARAÇÃO DE DEMISSÃO',
        'declara que houve / não houve demissões de colaboradores no mês de ____________________, vinculado ao contrato nº ______________, conforme relação abaixo:',
        [(None, ['Nome Funcionário', 'CPF', 'Data da demissão'], 8)],
        None,
    ),
    (
        'declaracao-transferencia',
        'DECLARAÇÃO DE TRANSFERÊNCIA',
        'declara que houve / não houve transferência de colaboradores do contrato nº ______________ para outros serviços ou contratos no mês de ____________________, conforme relação abaixo:',
        [(None, ['Nome Funcionário', 'CPF', 'Data da transferência', 'Destino'], 8)],
        None,
    ),
    (
        'declaracao-ferias',
        'DECLARAÇÃO DE FÉRIAS',
        'declara que houve / não houve profissionais em gozo de férias no mês de ____________________, vinculado ao contrato nº ______________, conforme relação abaixo:',
        [(None, ['Nome Funcionário', 'CPF', 'Período aquisitivo', 'Início', 'Término'], 8)],
        'O período aquisitivo deve ter dia, mês e ano (dd/mm/aaaa a dd/mm/aaaa).',
    ),
    (
        'declaracao-subcontratacao',
        'DECLARAÇÃO DE SUBCONTRATAÇÃO',
        'que na competência ____________________ houve / não houve subcontratação de empresas na prestação de serviço do contrato nº ______________ firmado com a contratante ______________________________.',
        [(None, ['Empresa subcontratada', 'CNPJ'], 6)],
        'Afirmo a veracidade das informações repassadas nesse documento.',
    ),
    (
        'declaracao-mobilizacao',
        'DECLARAÇÃO DE MOBILIZAÇÃO DO CONTRATO',
        'que houve / haverá mobilização no contrato de nº ______________, a partir do dia ____/____/20____, e começaram a prestar serviço neste contrato os funcionários relacionados abaixo:',
        [(None, ['Nome Funcionário', 'CPF', 'Data admissão/alocação'], 12)],
        None,
    ),
    (
        'declaracao-desmobilizacao',
        'DECLARAÇÃO DE DESMOBILIZAÇÃO DO CONTRATO',
        'declara que a prestação de serviço do contrato nº ______________ foi encerrada em ____/____/20____ (data efetiva da desmobilização) e que os funcionários relacionados abaixo foram (ou serão) demitidos ou transferidos para outros contratos:',
        [
            ('Demitidos', ['Nome Funcionário', 'CPF', 'Data da demissão'], 6),
            ('Transferidos para outros contratos', ['Nome Funcionário', 'CPF', 'Novo contrato ou serviço', 'Data da transferência'], 6),
        ],
        None,
    ),
    (
        'declaracao-nao-aplicacao-ponto',
        'DECLARAÇÃO DE NÃO APLICAÇÃO DE CONTROLE DE PONTO',
        'declara que, no mês de ____________________, não se aplica o controle de ponto aos empregados do contrato nº ______________, pelo seguinte motivo: ____________________________________________________________ (ex.: trabalho externo, cargo de confiança, teletrabalho).',
        [],
        None,
    ),
    (
        'declaracao-nao-aplicacao-va-vr',
        'DECLARAÇÃO DE NÃO FORNECIMENTO DE VALE-ALIMENTAÇÃO OU REFEIÇÃO',
        'declara que, no mês de ____________________, não se aplica o fornecimento de vale-alimentação, vale-refeição ou cesta básica aos empregados do contrato nº ______________, pelo seguinte motivo: ____________________________________________________________ (ex.: não previsto na convenção coletiva da categoria; refeição fornecida no local).',
        [],
        None,
    ),
    (
        'declaracao-nao-aplicacao-vt',
        'DECLARAÇÃO DE NÃO FORNECIMENTO DE VALE-TRANSPORTE',
        'declara que, no mês de ____________________, não se aplica o vale-transporte aos empregados do contrato nº ______________, pelo seguinte motivo: ____________________________________________________________ (ex.: nenhum empregado optou pelo benefício, conforme as declarações de opção anexas; transporte fornecido pela empresa).',
        [],
        None,
    ),
    (
        'declaracao-pagamento-em-especie',
        'DECLARAÇÃO DE PAGAMENTO EM ESPÉCIE',
        'declara que os salários do mês de ____________________ dos empregados relacionados abaixo, vinculados ao contrato nº ______________, foram pagos em espécie, conforme os holerites datados e assinados anexos:',
        [(None, ['Nome Funcionário', 'CPF', 'Valor líquido pago', 'Data do pagamento'], 8)],
        None,
    ),
]


def limpar_metadados(core):
    core.author = AUTOR
    core.last_modified_by = AUTOR
    core.title = ''
    core.subject = ''
    core.comments = ''
    core.keywords = ''
    core.category = ''
    core.created = DATA_FIXA
    core.modified = DATA_FIXA
    core.revision = 1


def paragrafo(doc, texto='', *, negrito=False, tamanho=12, alinhar=WD_ALIGN_PARAGRAPH.JUSTIFY, cor=None, italico=False, depois=8):
    p = doc.add_paragraph()
    p.alignment = alinhar
    p.paragraph_format.space_after = Pt(depois)
    p.paragraph_format.line_spacing = 1.3
    if texto:
        r = p.add_run(texto)
        r.bold = negrito
        r.italic = italico
        r.font.size = Pt(tamanho)
        if cor:
            r.font.color.rgb = RGBColor(*cor)
    return p


def tabela(doc, colunas, linhas):
    t = doc.add_table(rows=1 + linhas, cols=len(colunas))
    t.style = 'Table Grid'
    t.alignment = WD_TABLE_ALIGNMENT.CENTER
    for i, nome in enumerate(colunas):
        cel = t.rows[0].cells[i]
        cel.text = ''
        r = cel.paragraphs[0].add_run(nome)
        r.bold = True
        r.font.size = Pt(10.5)
    for linha in t.rows[1:]:
        linha.height = Cm(0.75)
    return t


def gerar_declaracao(arquivo, titulo, texto, tabelas, final):
    doc = Document()
    estilo = doc.styles['Normal']
    estilo.font.name = 'Arial'
    estilo.font.size = Pt(12)
    for s in doc.sections:
        s.page_height, s.page_width = Cm(29.7), Cm(21)
        s.top_margin = s.bottom_margin = Cm(2.5)
        s.left_margin = s.right_margin = Cm(2.5)
    paragrafo(doc, 'Papel Timbrado', alinhar=WD_ALIGN_PARAGRAPH.CENTER, cor=(140, 140, 140), italico=True, tamanho=11, depois=36)
    paragrafo(doc, titulo, negrito=True, tamanho=13, alinhar=WD_ALIGN_PARAGRAPH.CENTER, depois=24)
    paragrafo(doc, ABERTURA + texto, alinhar=WD_ALIGN_PARAGRAPH.LEFT, depois=14)
    for sub, colunas, linhas in tabelas:
        if sub:
            paragrafo(doc, sub, negrito=True, tamanho=11, alinhar=WD_ALIGN_PARAGRAPH.LEFT, depois=4)
        tabela(doc, colunas, linhas)
        paragrafo(doc, '', depois=10)
    if final:
        paragrafo(doc, final, alinhar=WD_ALIGN_PARAGRAPH.LEFT, depois=14)
    paragrafo(doc, '', depois=18)
    paragrafo(doc, 'Local e data: ______________________, ____ de ______________ de 20____.', alinhar=WD_ALIGN_PARAGRAPH.LEFT, depois=40)
    paragrafo(doc, '______________________________________________', alinhar=WD_ALIGN_PARAGRAPH.LEFT, depois=2)
    paragrafo(doc, 'Assinatura e identificação, nome e CPF do responsável legal.', alinhar=WD_ALIGN_PARAGRAPH.LEFT, tamanho=11)
    limpar_metadados(doc.core_properties)
    doc.save(SAIDA / f'{arquivo}.docx')


# planilha de força de trabalho: as mesmas colunas e validações do modelo das tomadoras, com o contratante no lugar
COLUNAS = [
    ('Empresa (razão social da prestadora)', 34),
    ('Nº do contrato', 18),
    ('Ano competência', 14),
    ('Mês competência', 14),
    ('Razão social do contratante', 32),
    ('CNPJ do contratante', 20),
    ('Nome do Colaborador', 34),
    ('Situação', 11),
    ('Vínculo do colaborador', 22),
    ('Função', 26),
    ('CPF do Colaborador', 18),
    ('Data Nasc.', 14),
    ('Gênero', 13),
    ('Estado', 9),
    ('Relação Contratual', 18),
    ('Data admissão', 14),
    ('Data alocação', 14),
    ('Data demissão', 14),
    ('Data da desvinculação', 18),
    ('Motivo do Afastamento', 30),
    ('Salário', 14),
]
ORIENTACOES = [
    ('A', 'Empresa', 'Razão social da sua empresa (a prestadora).'),
    ('B', 'Nº do contrato', 'Número do contrato com o contratante.'),
    ('C', 'Ano competência', 'Só o ano (ex.: 2026).'),
    ('D', 'Mês competência', 'Só o número do mês (ex.: março = 3).'),
    ('E', 'Razão social do contratante', 'Nome do órgão ou empresa contratante.'),
    ('F', 'CNPJ do contratante', 'Só números.'),
    ('G', 'Nome do Colaborador', 'Nome completo do empregado.'),
    ('H', 'Situação', 'A = ativo; I = inativo (demitido ou afastado). Quem trabalhou ao menos um dia no mês, mesmo demitido, fica A.'),
    ('I', 'Vínculo do colaborador', 'Celetista, Autônomo, MEI ou Sócio/Proprietário.'),
    ('J', 'Função', 'Função atual no mês.'),
    ('K', 'CPF do Colaborador', 'Só números.'),
    ('L', 'Data Nasc.', 'Data de nascimento.'),
    ('M', 'Gênero', 'Feminino ou Masculino.'),
    ('N', 'Estado', 'UF onde presta o serviço (2 letras).'),
    ('O', 'Relação Contratual', 'Integral ou Parcial.'),
    ('P', 'Data admissão', 'Data de admissão na empresa.'),
    ('Q', 'Data alocação', 'Data em que começou neste contrato.'),
    ('R', 'Data demissão', 'Data da demissão, quando houver.'),
    ('S', 'Data da desvinculação', 'Data em que saiu deste contrato sem ser demitido (transferência).'),
    ('T', 'Motivo do Afastamento', 'Auxílio Doença, Acidente de Trabalho, Licença Maternidade, Transferido ou Reclusão.'),
    ('U', 'Salário', 'Salário bruto do mês, sem descontos.'),
]


def gerar_forca():
    wb = Workbook()
    ws = wb.active
    ws.title = 'Força de Trabalho'
    azul = PatternFill('solid', fgColor='0F2053')
    borda = Border(*(Side(style='thin', color='B7C3D9') for _ in range(4)))
    for i, (nome, largura) in enumerate(COLUNAS, start=1):
        c = ws.cell(row=1, column=i, value=nome)
        c.font = Font(bold=True, color='FFFFFF')
        c.fill = azul
        c.alignment = Alignment(wrap_text=True, vertical='center', horizontal='center')
        c.border = borda
        ws.column_dimensions[c.column_letter].width = largura
    ws.row_dimensions[1].height = 42
    ws.freeze_panes = 'H2'
    ws.auto_filter.ref = 'A1:U1'
    fim = 1009
    regras = [
        ('C2:C%d' % fim, DataValidation(type='whole', operator='greaterThanOrEqual', formula1='2020')),
        ('D2:D%d' % fim, DataValidation(type='whole', operator='between', formula1='1', formula2='12')),
        ('H2:H%d' % fim, DataValidation(type='list', formula1='"A,I"')),
        ('I2:I%d' % fim, DataValidation(type='list', formula1='"Celetista,Autônomo,MEI,Sócio/Proprietário"')),
        ('M2:M%d' % fim, DataValidation(type='list', formula1='"Feminino,Masculino"')),
        ('N2:N%d' % fim, DataValidation(type='textLength', operator='equal', formula1='2')),
        ('O2:O%d' % fim, DataValidation(type='list', formula1='"Integral,Parcial"')),
        ('T2:T%d' % fim, DataValidation(type='list', formula1='"Auxílio Doença,Acidente de Trabalho,Licença Maternidade,Transferido,Reclusão"')),
        ('U2:U%d' % fim, DataValidation(type='decimal', operator='greaterThanOrEqual', formula1='0')),
    ]
    for faixa in ['L2:L%d' % fim, 'P2:S%d' % fim]:
        regras.append((faixa, DataValidation(type='date', operator='greaterThan', formula1='1')))
    for faixa, dv in regras:
        dv.allow_blank = True
        dv.error = 'Valor fora do padrão: veja a aba "Como preencher".'
        dv.errorTitle = 'DocPref'
        dv.showErrorMessage = True
        ws.add_data_validation(dv)
        dv.add(faixa)
    for linha in range(2, fim + 1):
        for col in ('L', 'P', 'Q', 'R', 'S'):
            ws[f'{col}{linha}'].number_format = 'DD/MM/YYYY'
        ws[f'U{linha}'].number_format = '#,##0.00'
    guia = wb.create_sheet('Como preencher')
    guia.column_dimensions['A'].width = 8
    guia.column_dimensions['B'].width = 30
    guia.column_dimensions['C'].width = 100
    for i, t in enumerate(['Coluna', 'Campo', 'Como preencher'], start=1):
        c = guia.cell(row=1, column=i, value=t)
        c.font = Font(bold=True, color='FFFFFF')
        c.fill = azul
    for r, linha in enumerate(ORIENTACOES, start=2):
        for c, v in enumerate(linha, start=1):
            guia.cell(row=r, column=c, value=v).alignment = Alignment(wrap_text=True, vertical='top')
    n = len(ORIENTACOES) + 3
    guia.cell(row=n, column=2, value='Atenção').font = Font(bold=True)
    guia.cell(
        row=n,
        column=3,
        value='Envie todo mês, atualizando a competência e as admissões, alocações, demissões, transferências e afastamentos. Quem foi demitido nunca sai da planilha: preencha a data e mantenha a linha.',
    ).alignment = Alignment(wrap_text=True)
    p = wb.properties
    p.creator = AUTOR
    p.lastModifiedBy = AUTOR
    p.created = DATA_FIXA
    p.modified = DATA_FIXA
    p.title = 'Força de trabalho - modelo'
    wb.save(SAIDA / 'forca-de-trabalho-modelo.xlsx')


def main():
    SAIDA.mkdir(parents=True, exist_ok=True)
    for d in DECLARACOES:
        gerar_declaracao(*d)
    gerar_forca()
    arquivos = sorted(p for p in SAIDA.iterdir() if p.suffix in ('.docx', '.xlsx'))
    with zipfile.ZipFile(SAIDA / 'modelos-docpref.zip', 'w', zipfile.ZIP_DEFLATED) as z:
        for p in arquivos:
            info = zipfile.ZipInfo(p.name, date_time=DATA_FIXA.timetuple()[:6])
            info.compress_type = zipfile.ZIP_DEFLATED
            z.writestr(info, p.read_bytes())
    print(f'{len(arquivos)} modelos em {SAIDA}')


if __name__ == '__main__':
    main()
