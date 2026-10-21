(function(){
  function fileCreatedValue(doc){return doc.createdTime||doc.uploadedAt||''}
  function driveDateLabel(value){
    if(!value)return 'Não informada';
    const text=String(value);
    if(/^\d{4}-\d{2}-\d{2}$/.test(text))return fmtDate(text);
    const date=new Date(text);
    return Number.isNaN(date.getTime())?'Não informada':date.toLocaleDateString('pt-BR');
  }
  function daysSinceDrivePost(doc){
    const value=fileCreatedValue(doc);
    if(!value)return null;
    const raw=String(value);
    const date=new Date(/^\d{4}-\d{2}-\d{2}$/.test(raw)?raw+'T00:00:00':raw);
    if(Number.isNaN(date.getTime()))return null;
    const today=new Date();today.setHours(0,0,0,0);date.setHours(0,0,0,0);
    return Math.max(0,Math.floor((today-date)/86400000));
  }
  function ageLabel(doc){
    const days=daysSinceDrivePost(doc);
    return days===null?'Não informada':days+' dia'+(days===1?'':'s');
  }
  function overdueDays(doc){
    const days=daysUntil(doc.expiryDate);
    return days!==null&&days<0?Math.abs(days):null;
  }
  function folderLinkFor(company){
    if(company&&company.driveUrl)return company.driveUrl;
    return company&&company.driveFolderId?'https://drive.google.com/drive/folders/'+encodeURIComponent(company.driveFolderId):'';
  }
  function linkButton(doc){
    return doc.driveUrl?'<a class="subtle-action doc-link" href="'+esc(doc.driveUrl)+'" target="_blank" rel="noopener">Abrir</a>':'<span class="muted">—</span>';
  }
  function renderDocumentsEnhanced(){
    const docs=data.documents||[];
    const items=docs.filter(function(d){return searchMatch(d.type,d.competency,d.fileName,companyName(d.companyId),employeeName(d.employeeId))});
    const rows=items.map(function(d){
      const status=docStatus(d);
      return '<tr><td><div class="doc-name"><span class="file-type-icon">'+icon('file')+'</span><span><span class="primary-cell">'+esc(d.type||'Documento não identificado')+'</span><span class="secondary-cell">'+esc(d.fileName||'')+'</span></span></div></td>'+
        '<td>'+esc(companyName(d.companyId))+'</td><td>'+esc(employeeName(d.employeeId)||'Empresa')+'</td>'+
        '<td>'+fmtDate(d.issueDate)+'</td>'+
        '<td><input class="date-input-compact" type="date" data-doc-expiry="'+esc(d.id)+'" value="'+esc(d.expiryDate||'')+'" '+(driveConnected?'':'disabled')+' aria-label="Data de validade de '+esc(d.type||'documento')+'"><span class="secondary-cell">'+(d.expiryDate?esc(status):'Validade não identificada')+'</span></td>'+
        '<td>'+driveDateLabel(fileCreatedValue(d))+'</td>'+
        '<td><select class="status-select '+statusClass(d.status)+'" data-doc-status="'+esc(d.id)+'" aria-label="Alterar situação do documento"><option '+(d.status==='Para análise'?'selected':'')+'>Para análise</option><option '+(d.status==='Aprovado'?'selected':'')+'>Aprovado</option><option '+(d.status==='Reprovado'?'selected':'')+'>Reprovado</option></select>'+(status==='Vencido'?'<span class="status-banner-inline">Vencido há '+overdueDays(d)+' dias</span>':'')+'</td>'+
        '<td class="actions-cell">'+linkButton(d)+'</td></tr>';
    }).join('');
    return titleBlock('Documentos','Confira os arquivos recebidos, a data de postagem no Drive e a validade identificada.','<button class="button button-primary" data-action="add-document">'+icon('upload')+' Enviar documento</button>')+
      syncWarning()+
      '<div class="section-toolbar"><div class="toolbar-left"><select class="filter-select" id="doc-filter"><option value="all">Todas as situações</option><option value="attention">Com pendência ou vencimento</option><option value="approved">Aprovados</option></select><span class="muted" style="font-size:9px">'+items.length+' documento'+(items.length===1?'':'s')+'</span></div><div class="toolbar-right"><button class="button button-small" data-action="open-settings">'+icon('folder')+' Pasta no Drive</button></div></div>'+
      '<section class="panel table-panel"><div class="table-wrap"><table class="data-table record-table"><thead><tr><th>Documento</th><th>Empresa</th><th>Vinculado a</th><th>Emissão</th><th>Validade</th><th>Postado no Drive</th><th>Situação</th><th></th></tr></thead><tbody id="document-rows">'+(rows||'<tr><td colspan="8">'+emptyState(searchTerm?'Nenhum documento encontrado':'Nenhum documento cadastrado','Vincule uma pasta e sincronize os arquivos do Drive.','file')+'</td></tr>')+'</tbody></table></div><div class="table-footer">A data de postagem é registrada separadamente da validade. A leitura automática do conteúdo dos PDFs ainda não está ativada; sem uma validade identificada, o arquivo aparece como “Validade não identificada” e não é contado como vencido.</div></section>';
  }
  function csvDownload(rows,name){
    const csv='\ufeff'+rows.map(function(row){return row.map(function(value){return '"'+String(value??'').replaceAll('"','""')+'"'}).join(';')}).join('\r\n');
    const link=document.createElement('a');link.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));link.download=name;link.click();URL.revokeObjectURL(link.href);
  }
  function exportExpiredCsv(){
    const docs=(data.documents||[]).filter(function(d){return overdueDays(d)!==null}).sort(function(a,b){return overdueDays(b)-overdueDays(a)});
    if(!docs.length){showToast('Não há documentos com validade vencida registrada.');return}
    const rows=[['Empresa','Documento','Arquivo','Validade','Dias vencido','Postado no Drive','Dias desde a postagem','Link do arquivo']];
    docs.forEach(function(d){rows.push([companyName(d.companyId),d.type||'',d.fileName||'',d.expiryDate||'',overdueDays(d),driveDateLabel(fileCreatedValue(d)),daysSinceDrivePost(d)??'',d.driveUrl||''])});
    csvDownload(rows,'bancodoc-vencidos-'+new Date().toISOString().slice(0,10)+'.csv');
  }
  function printReport(){window.print()}
  function reportDocRow(doc,expired){
    const days=expired?overdueDays(doc):daysUntil(doc.expiryDate);
    const time=expired?'Vencido há '+days+' dia'+(days===1?'':'s'):days===0?'Vence hoje':'Vence em '+days+' dias';
    return '<tr><td><div class="doc-name"><span class="file-type-icon">'+icon('file')+'</span><span><span class="primary-cell">'+esc(doc.type||'Documento não identificado')+'</span><span class="secondary-cell">'+esc(doc.fileName||'')+'</span></span></div></td>'+
      '<td>'+esc(companyName(doc.companyId))+'</td><td>'+fmtDate(doc.expiryDate)+'</td><td>'+esc(time)+'</td><td>'+driveDateLabel(fileCreatedValue(doc))+'</td><td>'+ageLabel(doc)+'</td><td>'+linkButton(doc)+'</td></tr>';
  }
  function renderReportsEnhanced(){
    const docs=data.documents||[];
    const overdue=docs.filter(function(d){return overdueDays(d)!==null}).sort(function(a,b){return overdueDays(b)-overdueDays(a)});
    const soon=docs.filter(function(d){const days=daysUntil(d.expiryDate);return days!==null&&days>=0&&days<=30}).sort(function(a,b){return daysUntil(a.expiryDate)-daysUntil(b.expiryDate)});
    const missing=docs.filter(function(d){return !d.expiryDate});
    const companyRows=(data.companies||[]).map(function(c){
      const list=docs.filter(function(d){return d.companyId===c.id});
      const expired=list.filter(function(d){return overdueDays(d)!==null}).length;
      const percent=list.length?Math.round((list.length-expired)/list.length*100):0;
      return '<div class="company-compliance-row"><span class="primary-cell">'+esc(c.name)+'</span><span>'+list.length+' documentos · '+expired+' vencidos</span><div class="progress-track"><span style="width:'+percent+'%"></span></div><span>'+percent+'%</span></div>';
    }).join('');
    const soonRows=soon.map(function(d){return reportDocRow(d,false)}).join('');
    const expiredRows=overdue.map(function(d){return reportDocRow(d,true)}).join('');
    const missingRows=missing.slice(0,12).map(function(d){
      return '<tr><td>'+esc(d.type||'Não identificado')+'</td><td>'+esc(companyName(d.companyId))+'</td><td>'+esc(d.fileName||'')+'</td><td>'+driveDateLabel(fileCreatedValue(d))+'</td><td>'+ageLabel(d)+'</td><td>'+linkButton(d)+'</td></tr>';
    }).join('');
    return titleBlock('Relatório de vencimentos','Veja há quantos dias cada documento está vencido e há quanto tempo foi postado no Drive.','<button class="button" data-action="print-report">'+icon('download')+' Imprimir / PDF</button><button class="button button-primary" data-action="export-expired-csv">'+icon('download')+' Exportar vencidos</button>')+
      syncWarning()+
      '<div class="report-grid"><article class="report-card"><span class="metric-icon red">'+icon('alert')+'</span><h3>Documentos vencidos</h3><p>Com data de validade registrada anterior a hoje.</p><strong>'+overdue.length+' vencido'+(overdue.length===1?'':'s')+'</strong></article><article class="report-card"><span class="metric-icon amber">'+icon('clock')+'</span><h3>Vencem em até 30 dias</h3><p>Arquivos que precisam de atualização em breve.</p><strong>'+soon.length+' documento'+(soon.length===1?'':'s')+'</strong></article><article class="report-card"><span class="metric-icon teal">'+icon('file')+'</span><h3>Sem validade identificada</h3><p>Precisam de leitura ou conferência da data de validade.</p><strong>'+missing.length+' documento'+(missing.length===1?'':'s')+'</strong></article></div>'+
      '<section class="panel report-table-panel"><div class="panel-header"><div><h2>Documentos vencidos</h2><p>Tempo vencido calculado pela validade registrada; postagem do Drive exibida separadamente.</p></div></div><div class="table-wrap"><table class="data-table record-table"><thead><tr><th>Documento</th><th>Empresa</th><th>Validade</th><th>Atraso</th><th>Postado no Drive</th><th>Tempo no Drive</th><th></th></tr></thead><tbody>'+(expiredRows||'<tr><td colspan="7">'+emptyState('Nenhum vencido identificado','Arquivos sem data de validade não entram nesta lista.','shield')+'</td></tr>')+'</tbody></table></div></section>'+
      '<section class="panel report-table-panel"><div class="panel-header"><div><h2>Vencimentos próximos</h2><p>Documentos com validade nos próximos 30 dias.</p></div></div><div class="table-wrap"><table class="data-table record-table"><thead><tr><th>Documento</th><th>Empresa</th><th>Validade</th><th>Prazo</th><th>Postado no Drive</th><th>Tempo no Drive</th><th></th></tr></thead><tbody>'+(soonRows||'<tr><td colspan="7">'+emptyState('Nenhum vencimento próximo','Não há validade cadastrada para os próximos 30 dias.','calendar')+'</td></tr>')+'</tbody></table></div></section>'+
      '<section class="panel report-table-panel"><div class="panel-header"><div><h2>Arquivos sem validade identificada</h2><p>A data do Drive não substitui a validade do documento.</p></div><strong>'+missing.length+'</strong></div><div class="table-wrap"><table class="data-table record-table"><thead><tr><th>Documento</th><th>Empresa</th><th>Arquivo</th><th>Postado no Drive</th><th>Tempo no Drive</th><th></th></tr></thead><tbody>'+(missingRows||'<tr><td colspan="6">'+emptyState('Todos os arquivos têm validade registrada','Confira as datas e mantenha os documentos atualizados.','check')+'</td></tr>')+'</tbody></table></div>'+(missing.length>12?'<div class="table-footer">Exibindo 12 de '+missing.length+' arquivos sem validade identificada.</div>':'')+'</section>'+
      '<section class="panel"><div class="panel-header"><div><h2>Resumo por empresa</h2><p>Percentual sem documentos vencidos registrados.</p></div></div><div class="company-compliance-list">'+(companyRows||emptyState('Sem empresas vinculadas','Vincule as pastas das empresas para montar o relatório.','building'))+'</div></section>'+
      '<div class="report-note">Importante: a data de postagem vem do registro “createdTime” do Google Drive. O atraso é contado a partir da data de validade registrada no documento. A leitura automática do conteúdo/OCR ainda precisa ser conectada; sem uma validade lida, o BancoDoc sinaliza “Sem validade identificada” em vez de presumir que o arquivo está vencido.</div>';
  }
  function selectedCompany(){
    const idValue=document.getElementById('notification-company')?.value||'';
    return (data.companies||[]).find(function(c){return c.id===idValue});
  }
  function docListFor(company,kind){
    const docs=(data.documents||[]).filter(function(d){return d.companyId===company.id});
    let list=[];
    if(kind==='overdue')list=docs.filter(function(d){return overdueDays(d)!==null}).sort(function(a,b){return overdueDays(b)-overdueDays(a)});
    if(kind==='soon')list=docs.filter(function(d){const days=daysUntil(d.expiryDate);return days!==null&&days>=0&&days<=30}).sort(function(a,b){return daysUntil(a.expiryDate)-daysUntil(b.expiryDate)});
    if(kind==='received')list=docs.filter(function(d){const days=daysSinceDrivePost(d);return days!==null&&days<=30}).sort(function(a,b){return new Date(fileCreatedValue(b))-new Date(fileCreatedValue(a))});
    return list.slice(0,12).map(function(d){
      const posted=driveDateLabel(fileCreatedValue(d));
      const age=daysSinceDrivePost(d);
      const receipt='postado no Drive em '+posted+(age===null?'':' (há '+age+' dias)');
      if(kind==='overdue')return '• '+(d.type||d.fileName||'Documento')+' — validade '+fmtDate(d.expiryDate)+', vencido há '+overdueDays(d)+' dia'+(overdueDays(d)===1?'':'s')+'; '+receipt+'.';
      if(kind==='soon'){const days=daysUntil(d.expiryDate);return '• '+(d.type||d.fileName||'Documento')+' — validade '+fmtDate(d.expiryDate)+', vence '+(days===0?'hoje':'em '+days+' dia'+(days===1?'':'s'))+'; '+receipt+'.'}
      return '• '+(d.type||d.fileName||'Documento')+' — '+receipt+'.';
    });
  }
  async function generateNotification(){
    const company=selectedCompany();
    if(!company){showToast('Selecione uma empresa para montar a mensagem.','error');return}
    const email=document.getElementById('notification-email').value.trim();
    const contact=document.getElementById('notification-contact').value.trim();
    const kind=document.getElementById('notification-template').value;
    const requested=(document.getElementById('notification-doc-list').value||'').trim();
    const deadline=document.getElementById('notification-deadline').value;
    const folder=folderLinkFor(company);
    const greeting=contact?'Olá, '+contact+', tudo bem?':'Olá, tudo bem?';
    let subject='',body='';
    if(kind==='request'){
      subject='Solicitação de documentos — '+company.name;
      const docs=requested?requested.split(/\r?\n/).map(function(x){return x.trim()}).filter(Boolean).map(function(x){return '• '+x}).join('\n'):'• [informe os documentos solicitados]';
      body=[greeting,'','Para manter a documentação da '+company.name+' atualizada, pedimos, por gentileza, o envio dos documentos abaixo:',docs,'',deadline?'Se possível, encaminhe os arquivos até '+fmtDate(deadline)+'.':'Pedimos que os documentos sejam encaminhados assim que possível.',folder?'Os arquivos devem ser colocados na pasta exclusiva da empresa:':'A pasta de envio será informada após a vinculação no BancoDoc.',folder||'','', 'Se tiver qualquer dúvida, fico à disposição.','','Atenciosamente,','BancoDoc'].join('\n');
    }else if(kind==='overdue'){
      subject='Regularização de documentos vencidos — '+company.name;
      const lines=docListFor(company,'overdue');
      body=[greeting,'','Na conferência documental da '+company.name+', identificamos os seguintes documentos com validade vencida:',lines.length?lines.join('\n'):'• Não há documentos com validade vencida registrada no BancoDoc. Arquivos sem validade identificada precisam ser conferidos antes de qualquer cobrança.','','Pedimos, por gentileza, que substitua os documentos vencidos por versões vigentes na pasta da empresa.',folder?'Pasta para envio: '+folder:'A pasta de envio ainda não está vinculada.','','Atenciosamente,','BancoDoc'].join('\n');
    }else if(kind==='soon'){
      subject='Documentos com vencimento próximo — '+company.name;
      const lines=docListFor(company,'soon');
      body=[greeting,'','Identificamos que os documentos abaixo vencerão nos próximos 30 dias:',lines.length?lines.join('\n'):'• Não há documentos com vencimento próximo registrado no BancoDoc.','','Para evitar pendências, pedimos que providencie a atualização antes da data indicada.',folder?'Os novos arquivos podem ser incluídos na pasta da empresa: '+folder:'A pasta de envio ainda não está vinculada.','','Atenciosamente,','BancoDoc'].join('\n');
    }else{
      subject='Confirmação de recebimento de documentos — '+company.name;
      const lines=docListFor(company,'received');
      body=[greeting,'','Confirmamos o recebimento dos seguintes arquivos enviados recentemente para a pasta da '+company.name+':',lines.length?lines.join('\n'):'• Os arquivos recebidos serão relacionados após a próxima sincronização do Drive.','','Nossa equipe fará a conferência e avisará caso seja necessário complementar alguma informação.',folder?'Pasta da empresa: '+folder:'','','Atenciosamente,','BancoDoc'].join('\n');
    }
    document.getElementById('notification-subject').value=subject;
    document.getElementById('notification-body').value=body;
    if(email){company.email=email;if(contact)company.contact=contact;if(driveConnected){try{await persistDatabase()}catch(error){showToast('Mensagem montada; não foi possível salvar o contato no Drive.','error')}}}
    showToast('Mensagem preenchida. Revise antes de enviar.','success');
  }
  async function copyNotification(){
    const subject=document.getElementById('notification-subject')?.value||'';
    const body=document.getElementById('notification-body')?.value||'';
    if(!body){showToast('Monte a mensagem antes de copiar.','error');return}
    try{await navigator.clipboard.writeText('Assunto: '+subject+'\n\n'+body);showToast('Assunto e mensagem copiados.','success')}
    catch(error){const field=document.getElementById('notification-body');field.focus();field.select();document.execCommand('copy');showToast('Mensagem copiada.','success')}
  }
  function openEmailDraft(){
    const email=document.getElementById('notification-email')?.value.trim()||'';
    const subject=document.getElementById('notification-subject')?.value||'';
    const body=document.getElementById('notification-body')?.value||'';
    if(!email){showToast('Informe o e-mail do cliente.','error');return}
    if(!body){showToast('Monte a mensagem antes de abrir o e-mail.','error');return}
    window.location.href='mailto:'+encodeURIComponent(email)+'?subject='+encodeURIComponent(subject)+'&body='+encodeURIComponent(body);
  }
  async function updateExpiry(docId,value){
    const doc=(data.documents||[]).find(function(d){return d.id===docId});
    if(!doc)return;
    if(!driveConnected){showToast('Conecte o Drive para salvar a validade.','error');renderPage();return}
    doc.expiryDate=value||'';
    doc.expirySource='manual';
    try{await persistDatabase();renderPage();showToast('Validade salva.','success')}
    catch(error){showToast(error.message||'Não foi possível salvar a validade.','error');renderPage()}
  }
  function onCompanySelected(){
    const company=selectedCompany();
    const email=document.getElementById('notification-email');
    const contact=document.getElementById('notification-contact');
    const folder=document.getElementById('notification-folder-link');
    if(!company){email.value='';contact.value='';folder.value='';return}
    email.value=company.email||'';
    contact.value=company.contact||'';
    folder.value=folderLinkFor(company);
  }
  function renderNotificationsPage(){
    const companies=data.companies||[];
    const options=companies.map(function(c){return '<option value="'+esc(c.id)+'">'+esc(c.name)+'</option>'}).join('');
    const noCompanies=companies.length?'':'<option value="" selected>Nenhuma empresa cadastrada — vincule a pasta em Configurações</option>';
    return titleBlock('Notificações','Prepare avisos personalizados para solicitar documentos, comunicar vencimentos ou confirmar recebimentos.','')+
      '<div class="notification-grid"><section class="panel notification-panel"><h2>Preparar mensagem</h2><p>Informe o e-mail do cliente, selecione a empresa e escolha um modelo. O BancoDoc inclui os dados e o link da pasta.</p>'+
      '<div class="field"><label for="notification-company">Empresa</label><select id="notification-company"><option value="">Selecione uma empresa</option>'+noCompanies+options+'</select></div>'+
      '<div class="field"><label for="notification-email">E-mail do cliente</label><input id="notification-email" type="email" placeholder="cliente@empresa.com"></div>'+
      '<div class="field"><label for="notification-contact">Nome do contato (opcional)</label><input id="notification-contact" type="text" placeholder="Nome do responsável"></div>'+
      '<div class="field"><label for="notification-template">Modelo</label><select id="notification-template"><option value="request">Solicitação de documentos</option><option value="overdue">Cobrança de documentos vencidos</option><option value="soon">Aviso de vencimento próximo</option><option value="received">Confirmação de recebimento</option></select></div>'+
      '<div class="field"><label for="notification-doc-list">Documentos solicitados (para o modelo de solicitação)</label><textarea id="notification-doc-list" rows="4" placeholder="Ex.: PGR, PCMSO, ASO e comprovante de FGTS"></textarea></div>'+
      '<div class="field"><label for="notification-deadline">Prazo para envio (opcional)</label><input id="notification-deadline" type="date"></div>'+
      '<div class="field"><label for="notification-folder-link">Pasta de envio da empresa</label><input id="notification-folder-link" type="url" readonly placeholder="Vincule uma pasta em Configurações"></div>'+
      '<div class="form-actions"><button type="button" class="button button-primary" data-action="generate-notification">'+icon('mail')+' Montar mensagem</button></div></section>'+
      '<section class="panel notification-panel notification-preview"><h2>Prévia do e-mail</h2><div class="field"><label for="notification-subject">Assunto</label><input id="notification-subject" type="text" placeholder="O assunto será preenchido ao montar a mensagem"></div><div class="field"><label for="notification-body">Mensagem</label><textarea id="notification-body" rows="18" placeholder="Selecione a empresa e clique em “Montar mensagem”."></textarea></div><div class="form-actions"><button type="button" class="button" data-action="copy-notification">'+icon('file')+' Copiar texto</button><button type="button" class="button button-primary" data-action="open-notification-email">'+icon('arrow-right')+' Abrir no e-mail</button></div><p class="form-footnote">O botão abre um rascunho no aplicativo de e-mail do seu computador. Revise e envie por lá; o BancoDoc ainda não envia mensagens automaticamente.</p></section></div>'+
      '<div class="notification-security-note"><strong>Uso administrativo:</strong> o endereço do portal está público no momento e ainda não há login de administrador. Não use dados confidenciais até restringir o acesso. A mensagem é gerada nesta tela e não é enviada sem sua revisão.</div>';
  }
  const baseRenderPage=renderPage;
  renderDocuments=renderDocumentsEnhanced;
  renderReports=renderReportsEnhanced;
  renderPage=function(){
    if(page!=='notifications'){return baseRenderPage()}
    const content=document.getElementById('page-content');
    content.innerHTML=renderNotificationsPage();
    document.querySelectorAll('.nav-item[data-page]').forEach(function(el){el.classList.toggle('active',el.dataset.page===page)});
    document.getElementById('breadcrumb-current').textContent='Notificações';
    document.getElementById('company-count').textContent=(data.companies||[]).length;
    const attention=(data.documents||[]).filter(function(d){return docStatus(d)==='Vencido'||d.status==='Para análise'}).length;
    document.getElementById('document-alert-dot').style.display=attention?'block':'none';
  };
  document.addEventListener('click',function(event){
    const target=event.target.closest('[data-action]');
    if(!target)return;
    const action=target.dataset.action;
    if(action==='generate-notification'){event.preventDefault();generateNotification()}
    if(action==='copy-notification'){event.preventDefault();copyNotification()}
    if(action==='open-notification-email'){event.preventDefault();openEmailDraft()}
    if(action==='export-expired-csv'){event.preventDefault();exportExpiredCsv()}
    if(action==='print-report'){event.preventDefault();printReport()}
  });
  document.addEventListener('change',function(event){
    const target=event.target;
    if(target.matches('[data-doc-expiry]')){updateExpiry(target.dataset.docExpiry,target.value);return}
    if(target.id==='notification-company'){onCompanySelected()}
  });
})();
