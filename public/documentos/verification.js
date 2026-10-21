(function(){
  const KIND_NAMES={guide:'Guia',payment:'Comprovante de pagamento',certificate:'Certidão',epi:'Ficha de EPI',other:'Outro documento'};
  const KIND_OPTIONS=[['other','Outro documento'],['guide','Guia de recolhimento'],['payment','Comprovante de pagamento de guia'],['certificate','Certidão'],['epi','Ficha de EPI']];

  function kindOf(doc){
    if(doc&&['guide','payment','certificate','epi','other'].includes(doc.kind))return doc.kind;
    const value=norm((doc&&doc.type||'')+' '+(doc&&doc.fileName||''));
    if(/ficha.{0,15}epi|epi.{0,15}ficha|entrega.{0,15}epi/.test(value))return 'epi';
    if(/(comprovante|recibo).{0,20}(guia|inss|fgts|darf|gps|dctfweb|grf)|pagamento.{0,20}(guia|inss|fgts|darf|gps|dctfweb|grf)/.test(value))return 'payment';
    if(/guia|\bgps\b|\bdarf\b|\bgrf\b|\bgfd\b|dctfweb/.test(value))return 'guide';
    if(/certidao|\bcndt\b|\bcnd\b|regularidade.{0,12}fgts|fgts.{0,12}regularidade/.test(value))return 'certificate';
    return 'other';
  }
  function isGuide(doc){return kindOf(doc)==='guide'}
  function isPayment(doc){return kindOf(doc)==='payment'}
  function isCertificate(doc){return kindOf(doc)==='certificate'}
  function isEpi(doc){return kindOf(doc)==='epi'}
  function parseAmount(value){
    if(value===null||value===undefined||value==='')return null;
    let raw=String(value).trim().replace(/R\$|\s/g,'').replace(/[^0-9,.-]/g,'');
    if(raw.includes(',')){raw=raw.replace(/\./g,'').replace(',','.')}
    const number=Number(raw);
    return Number.isFinite(number)?number:null;
  }
  function money(value){
    const amount=parseAmount(value);
    return amount===null?'Não informado':amount.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
  }
  function dueDays(value){return value?daysUntil(value):null}
  function overdueDays(doc){const days=dueDays(doc.expiryDate);return days!==null&&days<0?Math.abs(days):null}
  function driveDate(doc){
    const value=doc.createdTime||doc.uploadedAt||'';
    if(!value)return 'Não informada';
    const date=new Date(/^\d{4}-\d{2}-\d{2}$/.test(String(value))?value+'T00:00:00':value);
    return Number.isNaN(date.getTime())?'Não informada':date.toLocaleDateString('pt-BR');
  }
  function daysSinceDrivePost(doc){
    const value=doc.createdTime||doc.uploadedAt||'';
    if(!value)return null;
    const date=new Date(/^\d{4}-\d{2}-\d{2}$/.test(String(value))?value+'T00:00:00':value);
    if(Number.isNaN(date.getTime()))return null;
    const today=new Date();today.setHours(0,0,0,0);date.setHours(0,0,0,0);
    return Math.max(0,Math.floor((today-date)/86400000));
  }
  function driveAge(doc){
    const days=daysSinceDrivePost(doc);
    if(days===null)return 'Idade não informada';
    return 'há '+days+' dia'+(days===1?'':'s');
  }
  function postedInfo(doc){return driveDate(doc)+' · '+driveAge(doc)}
  function documentLink(doc){
    return doc.driveUrl?'<a class="subtle-action doc-link" href="'+esc(doc.driveUrl)+'" target="_blank" rel="noopener">Abrir</a>':'<span class="muted">—</span>';
  }
  function docTitle(doc){
    return '<div class="doc-name"><span class="file-type-icon">'+icon('file')+'</span><span><span class="primary-cell">'+esc(doc.type||KIND_NAMES[kindOf(doc)]||'Documento')+'</span><span class="secondary-cell">'+esc(doc.fileName||'')+'</span></span></div>';
  }
  function linkedPayments(guide){
    return (data.documents||[]).filter(function(doc){
      return isPayment(doc)&&(doc.relatedGuideId===guide.id||guide.paymentDocId===doc.id);
    });
  }
  function paymentCheck(guide){
    const receipts=linkedPayments(guide);
    if(!receipts.length)return {state:'missing',label:'Sem comprovante vinculado',receipts:[],paid:null,difference:null};
    const guideAmount=parseAmount(guide.amount);
    const amounts=receipts.map(function(receipt){return parseAmount(receipt.amount)});
    if(guideAmount===null||amounts.some(function(value){return value===null}))return {state:'unknown',label:'Valor não conferido',receipts:receipts,paid:null,difference:null};
    const paid=amounts.reduce(function(total,value){return total+Math.round(value*100)},0)/100;
    const difference=Math.round((paid-guideAmount)*100)/100;
    if(Math.abs(difference)<=0.01)return {state:'match',label:'Valor confere',receipts:receipts,paid:paid,difference:difference};
    return {state:'mismatch',label:'Divergência de '+money(Math.abs(difference)),receipts:receipts,paid:paid,difference:difference};
  }
  function verificationSummary(doc){
    if(isGuide(doc))return paymentCheck(doc).label;
    if(isPayment(doc))return doc.relatedGuideId?'Vinculado a uma guia':'Sem guia vinculada';
    if(isEpi(doc)){
      if(doc.signatureStatus==='signed')return 'Assinatura marcada como conferida';
      if(doc.signatureStatus==='unsigned')return 'Marcada como não assinada';
      return 'Assinatura não conferida';
    }
    if(isCertificate(doc))return doc.expiryDate?docStatus(doc):'Validade não identificada';
    return 'Conferência manual pendente';
  }
  function statusClassFor(value){
    const normalized=norm(value);
    if(/divergencia|sem comprovante|nao conferid[oa]|nao identificada|pendente|sem guia/.test(normalized))return 'status-pending';
    if(/vencid[oa]|reprovado|nao assinada/.test(normalized))return 'status-rejected';
    if(/confere|conferida|assinada|vigente|aprovado/.test(normalized))return 'status-approved';
    return 'status-inactive';
  }
  function verifyButton(doc){
    return '<button class="button button-small" type="button" data-action="verify-document" data-id="'+esc(doc.id)+'">Conferir</button>';
  }
  function renderDocumentsVerified(){
    const docs=(data.documents||[]).filter(function(doc){
      return searchMatch(doc.type,doc.fileName,doc.competency,companyName(doc.companyId),employeeName(doc.employeeId),KIND_NAMES[kindOf(doc)]);
    });
    const rows=docs.map(function(doc){
      const summary=verificationSummary(doc);
      return '<tr><td>'+docTitle(doc)+'</td><td>'+esc(KIND_NAMES[kindOf(doc)])+'</td><td>'+esc(companyName(doc.companyId))+'</td><td>'+esc(doc.competency||'—')+'</td><td>'+money(doc.amount)+'</td><td><span class="status-pill '+statusClassFor(summary)+'">'+esc(summary)+'</span></td><td>'+esc(postedInfo(doc))+'</td><td class="actions-cell">'+documentLink(doc)+' '+verifyButton(doc)+'</td></tr>';
    }).join('');
    return titleBlock('Documentos','Classifique guias, comprovantes, certidões e fichas de EPI; registre os dados para conferência.','<button class="button button-primary" data-action="add-document">'+icon('upload')+' Enviar documento</button>')+
      syncWarning()+
      '<div class="verification-note"><strong>Leitura de conteúdo:</strong> o OCR ainda não está integrado. Os valores, datas e a presença de assinatura precisam ser conferidos e registrados manualmente nesta versão.</div>'+
      '<div class="section-toolbar"><div class="toolbar-left"><span class="muted" style="font-size:9px">'+docs.length+' documento'+(docs.length===1?'':'s')+'</span></div><div class="toolbar-right"><button class="button button-small" data-action="sync-folders">'+icon('refresh')+' Sincronizar pastas</button></div></div>'+
      '<section class="panel table-panel"><div class="table-wrap"><table class="data-table record-table"><thead><tr><th>Documento</th><th>Categoria</th><th>Empresa</th><th>Competência</th><th>Valor</th><th>Conferência</th><th>Postado no Drive</th><th></th></tr></thead><tbody>'+(rows||'<tr><td colspan="8">'+emptyState('Nenhum documento encontrado','Vincule as pastas das empresas e sincronize os arquivos do Drive.','file')+'</td></tr>')+'</tbody></table></div><div class="table-footer">A data de postagem no Drive é informativa. Ela não substitui a validade, a competência ou a data de pagamento registrada no documento.</div></section>';
  }
  function reportRow(doc,details){
    return '<tr><td>'+docTitle(doc)+'</td><td>'+esc(companyName(doc.companyId))+'</td><td>'+esc(details||'—')+'</td><td>'+documentLink(doc)+'</td><td>'+verifyButton(doc)+'</td></tr>';
  }
  function reportTable(title,description,headers,rows,emptyTitle,emptyText){
    return '<section class="panel report-table-panel"><div class="panel-header"><div><h2>'+esc(title)+'</h2><p>'+esc(description)+'</p></div><strong>'+rows.length+'</strong></div><div class="table-wrap"><table class="data-table record-table"><thead><tr>'+headers.map(function(header){return '<th>'+esc(header)+'</th>'}).join('')+'</tr></thead><tbody>'+(rows.length?rows.join(''):'<tr><td colspan="'+headers.length+'">'+emptyState(emptyTitle,emptyText,'check')+'</td></tr>')+'</tbody></table></div></section>';
  }
  function guideMissingRow(guide){
    return '<tr><td>'+docTitle(guide)+'</td><td>'+esc(companyName(guide.companyId))+'</td><td>'+esc(guide.competency||'—')+'</td><td>'+money(guide.amount)+'</td><td>'+fmtDate(guide.dueDate)+'</td><td>Sem comprovante vinculado</td><td>'+esc(postedInfo(guide))+'</td><td>'+documentLink(guide)+' '+verifyButton(guide)+'</td></tr>';
  }
  function mismatchRow(guide){
    const result=paymentCheck(guide);
    return '<tr><td>'+docTitle(guide)+'</td><td>'+esc(companyName(guide.companyId))+'</td><td>'+money(guide.amount)+'</td><td>'+money(result.paid)+'</td><td>'+money(Math.abs(result.difference))+'</td><td>'+esc(result.receipts.map(function(doc){return doc.fileName||doc.type}).join(', '))+'</td><td>'+esc(postedInfo(guide))+'</td><td>'+verifyButton(guide)+'</td></tr>';
  }
  function certificateRow(doc){
    return '<tr><td>'+docTitle(doc)+'</td><td>'+esc(companyName(doc.companyId))+'</td><td>'+fmtDate(doc.expiryDate)+'</td><td>Vencida há '+overdueDays(doc)+' dia'+(overdueDays(doc)===1?'':'s')+'</td><td>'+esc(postedInfo(doc))+'</td><td>'+documentLink(doc)+' '+verifyButton(doc)+'</td></tr>';
  }
  function epiRow(doc){
    const state=doc.signatureStatus==='unsigned'?'Marcada como não assinada':'Assinatura não conferida';
    return '<tr><td>'+docTitle(doc)+'</td><td>'+esc(companyName(doc.companyId))+'</td><td>'+esc(employeeName(doc.employeeId)||'Empresa')+'</td><td>'+esc(state)+'</td><td>'+esc(postedInfo(doc))+'</td><td>'+documentLink(doc)+' '+verifyButton(doc)+'</td></tr>';
  }
  function expiryRow(doc){
    const days=daysUntil(doc.expiryDate);
    return '<tr><td>'+docTitle(doc)+'</td><td>'+esc(companyName(doc.companyId))+'</td><td>'+fmtDate(doc.expiryDate)+'</td><td>'+esc(days<0?'Vencido há '+Math.abs(days)+' dias':days===0?'Vence hoje':'Vence em '+days+' dias')+'</td><td>'+driveDate(doc)+'</td><td>'+driveAge(doc)+'</td><td>'+documentLink(doc)+' '+verifyButton(doc)+'</td></tr>';
  }
  function renderReportsVerified(){
    const docs=data.documents||[];
    const guides=docs.filter(isGuide);
    const missingProof=guides.filter(function(guide){return paymentCheck(guide).state==='missing'});
    const mismatches=guides.filter(function(guide){return paymentCheck(guide).state==='mismatch'});
    const unknownValues=guides.filter(function(guide){return paymentCheck(guide).state==='unknown'});
    const certificates=docs.filter(function(doc){return isCertificate(doc)&&overdueDays(doc)!==null});
    const epis=docs.filter(function(doc){return isEpi(doc)&&doc.signatureStatus!=='signed'});
    const expired=docs.filter(function(doc){return overdueDays(doc)!==null});
    const soon=docs.filter(function(doc){const days=daysUntil(doc.expiryDate);return days!==null&&days>=0&&days<=30}).sort(function(a,b){return daysUntil(a.expiryDate)-daysUntil(b.expiryDate)});
    const missingExpiry=docs.filter(function(doc){return !doc.expiryDate});
    const metric=function(label,count,copy,color){return '<article class="report-card"><span class="metric-icon '+color+'">'+icon(color==='red'?'alert':color==='amber'?'clock':color==='teal'?'check':'file')+'</span><h3>'+esc(label)+'</h3><p>'+esc(copy)+'</p><strong>'+count+'</strong></article>'};
    const guideRows=missingProof.map(guideMissingRow);
    const mismatchRows=mismatches.map(mismatchRow);
    const certificateRows=certificates.map(certificateRow);
    const epiRows=epis.map(epiRow);
    const expiredRows=expired.map(function(doc){return expiryRow(doc)});
    const soonRows=soon.map(function(doc){return expiryRow(doc)});
    const missingRows=missingExpiry.map(function(doc){return '<tr><td>'+docTitle(doc)+'</td><td>'+esc(companyName(doc.companyId))+'</td><td>'+driveDate(doc)+'</td><td>'+driveAge(doc)+'</td><td>Validade não identificada</td><td>'+documentLink(doc)+' '+verifyButton(doc)+'</td></tr>'});
    return titleBlock('Relatórios de conferência','Acompanhe guias, pagamentos, certidões, fichas de EPI e vencimentos.','<button class="button" data-action="print-report">'+icon('download')+' Imprimir / PDF</button><button class="button button-primary" data-action="export-checks">'+icon('download')+' Exportar conferências</button>')+
      syncWarning()+
      '<div class="verification-note"><strong>OCR não conectado:</strong> os relatórios usam os dados cadastrados na conferência do documento. “Sem comprovante” significa que nenhum recibo foi vinculado; não confirma, por si só, que a guia não foi paga. A análise de assinatura verifica apenas presença registrada, não autenticidade.</div>'+
      '<div class="report-grid">'+metric('Guias sem comprovante',missingProof.length,'Sem recibo de pagamento vinculado.','red')+metric('Valores não conferidos',unknownValues.length,'Guia ou comprovante sem valor informado.','amber')+metric('Divergências de valor',mismatches.length,'Valor pago diferente do valor da guia.','amber')+metric('Certidões vencidas',certificates.length,'Certidões com validade registrada e já vencida.','red')+metric('Fichas de EPI pendentes',epis.length,'Sem assinatura confirmada no cadastro.','amber')+metric('Documentos vencidos',expired.length,'Todos os tipos com validade registrada.','red')+metric('Vencimentos em até 30 dias',soon.length,'Documentos que exigem atualização em breve.','teal')+'</div>'+
      reportTable('Guias sem comprovante de pagamento','Vincule o comprovante à guia e informe os valores para comparar.',['Guia','Empresa','Competência','Valor da guia','Vencimento','Conferência','Postado no Drive / idade','Arquivo / ação'],guideRows,'Nenhuma guia sem comprovante','Quando o OCR estiver integrado, os dados poderão ser sugeridos automaticamente; por enquanto, confira cada arquivo.')+
      reportTable('Guias com valores não conferidos','Há comprovante vinculado, mas falta informar o valor da guia ou de algum pagamento.',['Guia','Empresa','Pendência','Arquivo','Ação'],unknownValues.map(function(guide){return reportRow(guide,'Valor da guia ou do comprovante não informado')}),'Nenhum valor pendente','Todos os pares vinculados têm valores informados.')+
      reportTable('Divergências entre guia e pagamento','A soma dos comprovantes vinculados difere do valor registrado na guia.',['Guia','Empresa','Valor da guia','Total pago','Diferença','Comprovantes','Postado no Drive / idade','Ação'],mismatchRows,'Nenhuma divergência registrada','A comparação considera os valores informados manualmente e aceita diferença de até R$ 0,01.')+
      reportTable('Certidões vencidas','Somente certidões classificadas e com data de validade registrada.',['Certidão','Empresa','Validade','Atraso','Postado no Drive / idade','Arquivo / ação'],certificateRows,'Nenhuma certidão vencida identificada','Certidões sem validade precisam ser conferidas antes de concluir que estão regulares.')+
      reportTable('Fichas de EPI sem assinatura confirmada','Registre a situação da assinatura na conferência de cada ficha.',['Ficha','Empresa','Colaborador','Assinatura','Postado no Drive / idade','Arquivo / ação'],epiRows,'Nenhuma ficha pendente','Fichas marcadas como assinadas ficam fora desta lista.')+
      reportTable('Todos os documentos vencidos','Atraso calculado pela validade registrada, com a data de postagem do Drive separada.',['Documento','Empresa','Validade','Atraso','Postado no Drive','Tempo no Drive','Arquivo / ação'],expiredRows,'Nenhum documento vencido identificado','Sem validade registrada, o arquivo não é contado como vencido.')+
      reportTable('Vencimentos nos próximos 30 dias','Documentos com data de validade registrada para hoje ou para os próximos 30 dias.',['Documento','Empresa','Validade','Prazo','Postado no Drive','Tempo no Drive','Arquivo / ação'],soonRows,'Nenhum vencimento próximo','Não há documentos vencendo nos próximos 30 dias.')+
      reportTable('Documentos sem validade registrada','A data de postagem não é usada como validade.',['Documento','Empresa','Postado no Drive','Tempo no Drive','Conferência','Arquivo / ação'],missingRows,'Todos os documentos têm validade registrada','Confira as datas para manter o relatório atualizado.');
  }
  function buildReviewModal(doc){
    const kind=kindOf(doc);
    const guideOptions=(data.documents||[]).filter(function(item){return isGuide(item)&&item.companyId===doc.companyId&&item.id!==doc.id}).map(function(item){
      const selected=item.id===doc.relatedGuideId?'selected':'';
      return '<option value="'+esc(item.id)+'" '+selected+'>'+esc(item.fileName||item.type)+' · '+esc(item.competency||'sem competência')+' · '+money(item.amount)+'</option>';
    }).join('');
    const kindOptions=KIND_OPTIONS.map(function(item){return '<option value="'+item[0]+'" '+(kind===item[0]?'selected':'')+'>'+esc(item[1])+'</option>'}).join('');
    const signature=doc.signatureStatus||'unchecked';
    const signatureOptions=[['unchecked','Não conferida'],['signed','Assinada'],['unsigned','Não assinada']].map(function(item){return '<option value="'+item[0]+'" '+(signature===item[0]?'selected':'')+'>'+item[1]+'</option>'}).join('');
    const statusOptions=['Para análise','Aprovado','Reprovado'].map(function(value){return '<option '+((doc.status||'Para análise')===value?'selected':'')+'>'+value+'</option>'}).join('');
    openModal('Conferir documento','Registre os dados identificados para gerar os relatórios.', '<form class="modal-form" id="document-verification-form" data-id="'+esc(doc.id)+'">'+
      '<div class="field-row"><div class="field"><label for="verify-kind">Categoria</label><select id="verify-kind" name="kind">'+kindOptions+'</select></div><div class="field"><label for="verify-type">Tipo específico</label><input id="verify-type" name="type" value="'+esc(doc.type||'')+'" placeholder="Ex.: Guia de INSS"></div></div>'+
      '<div class="field-row"><div class="field"><label for="verify-competency">Competência</label><input id="verify-competency" name="competency" value="'+esc(doc.competency||'')+'" placeholder="Ex.: 09/2026"></div><div class="field"><label for="verify-amount">Valor da guia ou do comprovante (R$)</label><input id="verify-amount" name="amount" inputmode="decimal" value="'+esc(doc.amount===undefined?'':String(doc.amount).replace('.',','))+'" placeholder="0,00"></div></div>'+
      '<div class="field-row"><div class="field"><label for="verify-due-date">Vencimento da guia</label><input id="verify-due-date" name="dueDate" type="date" value="'+esc(doc.dueDate||'')+'"></div><div class="field"><label for="verify-payment-date">Data do pagamento</label><input id="verify-payment-date" name="paymentDate" type="date" value="'+esc(doc.paymentDate||'')+'"></div></div>'+
      '<div class="field"><label for="verify-related-guide">Guia vinculada (para comprovantes)</label><select id="verify-related-guide" name="relatedGuideId"><option value="">Sem guia vinculada</option>'+guideOptions+'</select><small>É possível vincular mais de um comprovante à mesma guia; o relatório soma os valores informados.</small></div>'+
      '<div class="field-row"><div class="field"><label for="verify-expiry">Validade do documento</label><input id="verify-expiry" name="expiryDate" type="date" value="'+esc(doc.expiryDate||'')+'"></div><div class="field"><label for="verify-signature">Assinatura da ficha de EPI</label><select id="verify-signature" name="signatureStatus">'+signatureOptions+'</select></div></div>'+
      '<div class="field"><label for="verify-status">Situação da análise</label><select id="verify-status" name="status">'+statusOptions+'</select></div>'+
      '<div class="field"><label for="verify-notes">Observações da conferência</label><textarea id="verify-notes" name="verificationNotes" placeholder="Anote divergências ou dados que precisam ser confirmados">'+esc(doc.verificationNotes||'')+'</textarea></div>'+
      '<p class="form-footnote">OCR não está ativo nesta versão. Não registre uma ficha como assinada sem conferir o arquivo. Os dados serão salvos na base do BancoDoc no Drive.</p>'+
      '<div class="form-actions"><button type="button" class="button" data-action="close-modal">Cancelar</button><button type="submit" class="button button-primary">Salvar conferência</button></div></form>');
  }
  async function saveReview(form){
    if(!driveConnected){showToast('Conecte o Google Drive para salvar a conferência.','error');setPage('settings');return}
    const doc=(data.documents||[]).find(function(item){return item.id===form.dataset.id});
    if(!doc)return;
    const values=new FormData(form);
    const category=String(values.get('kind')||'other');
    const amount=parseAmount(values.get('amount'));
    doc.kind=category;
    doc.type=String(values.get('type')||'').trim()||KIND_NAMES[category];
    doc.competency=String(values.get('competency')||'').trim();
    doc.amount=amount===null?'':amount;
    doc.dueDate=String(values.get('dueDate')||'');
    doc.paymentDate=String(values.get('paymentDate')||'');
    doc.expiryDate=String(values.get('expiryDate')||'');
    doc.status=String(values.get('status')||'Para análise');
    doc.verificationNotes=String(values.get('verificationNotes')||'').trim();
    doc.verificationSource='manual';
    doc.verifiedAt=new Date().toISOString();
    doc.relatedGuideId=category==='payment'?String(values.get('relatedGuideId')||''):'';
    doc.signatureStatus=category==='epi'?String(values.get('signatureStatus')||'unchecked'):'';
    const submit=form.querySelector('[type="submit"]');
    if(submit){submit.disabled=true;submit.textContent='Salvando…'}
    try{
      await persistDatabase();
      closeModal();
      renderPage();
      showToast('Conferência salva no Drive.','success');
    }catch(error){
      if(submit){submit.disabled=false;submit.textContent='Salvar conferência'}
      showToast(error.message||'Não foi possível salvar a conferência.','error');
    }
  }
  function exportChecks(){
    const docs=data.documents||[];
    const rows=[['Tipo de pendência','Empresa','Documento','Competência','Valor da guia','Valor pago','Diferença','Vencimento','Validade','Assinatura','Postado no Drive','Dias no Drive','Arquivo no Drive']];
    docs.filter(isGuide).forEach(function(guide){
      const check=paymentCheck(guide);
      if(check.state==='missing')rows.push(['Sem comprovante vinculado',companyName(guide.companyId),guide.fileName||guide.type,guide.competency||'',guide.amount||'','','',guide.dueDate||'','','',driveDate(guide),daysSinceDrivePost(guide)??'',guide.driveUrl||'']);
      if(check.state==='unknown')rows.push(['Valor não conferido',companyName(guide.companyId),guide.fileName||guide.type,guide.competency||'',guide.amount??'','','',guide.dueDate||'','','',driveDate(guide),daysSinceDrivePost(guide)??'',guide.driveUrl||'']);
      if(check.state==='mismatch')rows.push(['Divergência de valor',companyName(guide.companyId),guide.fileName||guide.type,guide.competency||'',guide.amount||'',check.paid,Math.abs(check.difference),guide.dueDate||'','','',driveDate(guide),daysSinceDrivePost(guide)??'',guide.driveUrl||'']);
    });
    docs.filter(function(doc){return isCertificate(doc)&&overdueDays(doc)!==null}).forEach(function(doc){
      rows.push(['Certidão vencida',companyName(doc.companyId),doc.fileName||doc.type,'','','','','',doc.expiryDate||'','',driveDate(doc),daysSinceDrivePost(doc)??'',doc.driveUrl||'']);
    });
    docs.filter(function(doc){return isEpi(doc)&&doc.signatureStatus!=='signed'}).forEach(function(doc){
      rows.push([doc.signatureStatus==='unsigned'?'Ficha EPI marcada como não assinada':'Ficha EPI sem assinatura conferida',companyName(doc.companyId),doc.fileName||doc.type, '', '', '', '', '', '', doc.signatureStatus||'Não conferida',driveDate(doc),daysSinceDrivePost(doc)??'',doc.driveUrl||'']);
    });
    if(rows.length===1){showToast('Não há pendências desse tipo registradas.');return}
    const csv='\ufeff'+rows.map(function(row){return row.map(function(value){return '"'+String(value===null||value===undefined?'':value).replace(/"/g,'""')+'"'}).join(';')}).join('\r\n');
    const anchor=document.createElement('a');
    anchor.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
    anchor.download='bancodoc-conferencias-'+new Date().toISOString().slice(0,10)+'.csv';
    anchor.click();
    URL.revokeObjectURL(anchor.href);
  }
  renderDocuments=renderDocumentsVerified;
  renderReports=renderReportsVerified;
  document.addEventListener('click',function(event){
    const button=event.target.closest('[data-action]');
    if(!button)return;
    if(button.dataset.action==='verify-document'){
      event.preventDefault();
      const doc=(data.documents||[]).find(function(item){return item.id===button.dataset.id});
      if(doc)buildReviewModal(doc);
    }else if(button.dataset.action==='export-checks'){
      event.preventDefault();
      exportChecks();
    }
  });
  document.addEventListener('submit',function(event){
    if(event.target.id==='document-verification-form'){
      event.preventDefault();
      saveReview(event.target);
    }
  });
})();
