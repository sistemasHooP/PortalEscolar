const URL_API = 'https://script.google.com/macros/s/AKfycby-rnmBcploCmdEb8QWkMyo1tEanCcPkmNOA_QMlujH0XQvjLeiCCYhkqe7Hqhi6-mo8A/exec';

const CAMPOS_PADRAO = [
    { key: 'NomeCompleto', label: 'Nome Completo' }, { key: 'DataNascimento', label: 'Data de Nascimento' },
    { key: 'Telefone', label: 'Celular' }, { key: 'Endereco', label: 'Endereço' },
    { key: 'NomeInstituicao', label: 'Instituição' }, { key: 'NomeCurso', label: 'Curso' },
    { key: 'PeriodoCurso', label: 'Período' }, { key: 'Matricula', label: 'Matrícula' }
];

let mapaEventos = {}; 
let chartEventosInstance = null; let chartStatusInstance = null;
let todasInscricoes = [];     
let inscricoesFiltradas = []; 
let paginaAtual = 1;
const ITENS_POR_PAGINA = 50;
let selecionados = new Set(); 

// --- LOADING ---
function showLoading(msg = 'Processando...') {
    Swal.fire({
        html: `
            <div style="display:flex; flex-direction:column; align-items:center; gap:15px; padding:20px;">
                <div class="spinner" style="border-color:#e2e8f0; border-top-color:#2563eb; width:50px; height:50px; border-width:4px;"></div>
                <h3 style="font-family:'Poppins'; font-size:1.1rem; color:#1e293b; margin:0;">${msg}</h3>
                <p style="font-family:'Poppins'; font-size:0.85rem; color:#64748b; margin:0;">Aguarde um momento...</p>
            </div>
        `,
        showConfirmButton: false,
        allowOutsideClick: false,
        width: '300px',
        customClass: { popup: 'swal-loading-popup' }
    });
}

function safeDate(val) {
    if(!val) return '-';
    try {
        const d = new Date(val);
        if(isNaN(d.getTime())) return '-';
        return d.toLocaleDateString('pt-BR');
    } catch(e) { return '-'; }
}

// --- AUTH ---
function toggleSenha() {
    const input = document.getElementById('admin-pass');
    const icon = document.querySelector('.password-toggle');
    if (input.type === 'password') {
        input.type = 'text';
        icon.classList.remove('fa-eye');
        icon.classList.add('fa-eye-slash');
    } else {
        input.type = 'password';
        icon.classList.remove('fa-eye-slash');
        icon.classList.add('fa-eye');
    }
}

function realizarLogin(e) {
    e.preventDefault();
    const pass = document.getElementById('admin-pass').value;
    showLoading('Autenticando...');
    
    fetch(URL_API, { method: 'POST', body: JSON.stringify({ action: 'loginAdmin', senha: pass }) })
    .then(res => res.json()).then(json => {
        Swal.close();
        if(json.auth) {
            document.getElementById('login-screen').classList.add('hidden');
            document.getElementById('admin-panel').classList.remove('hidden');
            sessionStorage.setItem('admin_token', pass);
            carregarDashboard();
        } else { Swal.fire({icon: 'error', title: 'Acesso Negado', text: 'Senha incorreta', confirmButtonColor: '#ef4444'}); }
    }).catch(() => Swal.fire('Erro', 'Falha na conexão', 'error'));
}

function logout() { sessionStorage.removeItem('admin_token'); location.reload(); }

function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('.nav-btn').forEach(el => el.classList.remove('active'));
    document.getElementById(tabId).classList.remove('hidden');
    event.currentTarget.classList.add('active');
    
    if(tabId === 'tab-dashboard') carregarDashboard();
    if(tabId === 'tab-eventos') carregarEventosAdmin();
    if(tabId === 'tab-inscricoes') carregarInscricoes();
    if(tabId === 'tab-config') carregarInstituicoes();
}

// --- DASHBOARD ---
function carregarDashboard() {
    const token = sessionStorage.getItem('admin_token');
    Promise.all([
        fetch(`${URL_API}?action=getTodosEventos`).then(r => r.json()),
        fetch(`${URL_API}?action=getInscricoesAdmin&token=${token}`).then(r => r.json())
    ]).then(([jsonEventos, jsonInscricoes]) => {
        mapaEventos = {}; 
        if(jsonEventos.data) jsonEventos.data.forEach(ev => mapaEventos[ev.id] = ev.titulo);
        
        const inscricoes = jsonInscricoes.data || [];
        atualizarSelectsRelatorio(jsonEventos.data || [], inscricoes);
        
        const total = inscricoes.length;
        const aprovados = inscricoes.filter(i => i.status.includes('Aprovada') || i.status.includes('Emitida')).length;
        
        document.getElementById('stat-total').innerText = total;
        document.getElementById('stat-aprovados').innerText = aprovados;
        document.getElementById('stat-pendentes').innerText = inscricoes.filter(i => i.status === 'Pendente').length;

        const contagemEventos = {}; const contagemStatus = {};
        inscricoes.forEach(i => {
            const nome = mapaEventos[i.eventoId] || 'Desconhecido';
            contagemEventos[nome] = (contagemEventos[nome] || 0) + 1;
            contagemStatus[i.status] = (contagemStatus[i.status] || 0) + 1;
        });
        renderizarGraficos(contagemEventos, contagemStatus);
    });
}

function renderizarGraficos(dadosEventos, dadosStatus) {
    if(chartEventosInstance) chartEventosInstance.destroy();
    chartEventosInstance = new Chart(document.getElementById('chartEventos').getContext('2d'), {
        type: 'bar', data: { labels: Object.keys(dadosEventos), datasets: [{ label: 'Inscritos', data: Object.values(dadosEventos), backgroundColor: '#3b82f6', borderRadius: 6 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
    });
    if(chartStatusInstance) chartStatusInstance.destroy();
    chartStatusInstance = new Chart(document.getElementById('chartStatus').getContext('2d'), {
        type: 'doughnut', data: { labels: Object.keys(dadosStatus), datasets: [{ data: Object.values(dadosStatus), backgroundColor: ['#f59e0b', '#10b981', '#ef4444', '#3b82f6'], borderWidth: 0 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right' } } }
    });
}

function atualizarSelectsRelatorio(eventos, inscricoes) {
    const selEvento = document.getElementById('relatorio-evento');
    selEvento.innerHTML = '<option value="">Selecione...</option>';
    eventos.forEach(ev => selEvento.innerHTML += `<option value="${ev.id}">${ev.titulo}</option>`);
    
    let instituicoes = new Set();
    inscricoes.forEach(ins => { try { instituicoes.add(JSON.parse(ins.dadosJson).NomeInstituicao); } catch(e){} });
    const selInst = document.getElementById('relatorio-inst');
    selInst.innerHTML = '<option value="">Todas</option>';
    instituicoes.forEach(inst => { if(inst) selInst.innerHTML += `<option value="${inst}">${inst}</option>`; });
}

function gerarRelatorioTransporte() {
    const eventoId = document.getElementById('relatorio-evento').value;
    const instFiltro = document.getElementById('relatorio-inst').value;
    if(!eventoId) return Swal.fire({icon: 'warning', title: 'Atenção', text: 'Selecione um evento.'});

    showLoading('Gerando Relatório...');
    const token = sessionStorage.getItem('admin_token');
    fetch(`${URL_API}?action=getInscricoesAdmin&token=${token}`).then(res => res.json()).then(json => {
        Swal.close();
        const alunos = (json.data || []).filter(i => {
            let d = {}; try{d=JSON.parse(i.dadosJson)}catch(e){}
            return String(i.eventoId) === String(eventoId) && (instFiltro === "" || d.NomeInstituicao === instFiltro) && (i.status === 'Aprovada' || i.status === 'Ficha Emitida');
        });

        if(alunos.length === 0) return Swal.fire({icon: 'info', title: 'Vazio', text: 'Nenhum aluno APROVADO encontrado.'});

        let linhas = '';
        alunos.forEach((aluno, idx) => {
            let d = JSON.parse(aluno.dadosJson);
            linhas += `<tr><td>${idx+1}</td><td>${d.NomeCompleto}</td><td>${d.NomeInstituicao}</td><td>${d.Endereco}</td></tr>`;
        });

        document.getElementById('area-impressao').innerHTML = `
            <div class="print-header"><h2>Rota Transporte</h2><p>Evento: ${mapaEventos[eventoId]}</p><p>Inst: ${instFiltro||'Todas'}</p></div>
            <table class="print-table"><thead><tr><th>#</th><th>Nome</th><th>Instituição</th><th>Endereço</th></tr></thead><tbody>${linhas}</tbody></table>
            <div style="margin-top:40px; border-top:1px solid #000; padding-top:10px;">Motorista: _______________________ Data: __/__/____</div>
        `;
        setTimeout(() => window.print(), 500);
    });
}

// --- EVENTOS E MODAL ---
function carregarEventosAdmin() {
    fetch(`${URL_API}?action=getTodosEventos`).then(res => res.json()).then(json => {
        const tbody = document.getElementById('lista-eventos-admin'); 
        tbody.innerHTML = '';
        mapaEventos = {};
        
        if(!json.data || json.data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Nenhum evento encontrado.</td></tr>';
            return;
        }

        json.data.forEach(ev => mapaEventos[ev.id] = ev.titulo);
        
        json.data.sort((a,b) => b.id - a.id).forEach(ev => {
            // Cores ajustadas para visibilidade
            let btnAction = ev.status === 'Ativo' ? 
                `<button class="action-btn" style="background:#eab308; color:#000;" onclick="toggleStatusEvento('${ev.id}','Inativo')" title="Pausar"><i class="fa-solid fa-pause"></i></button>` : 
                `<button class="action-btn" style="background:#22c55e; color:#fff;" onclick="toggleStatusEvento('${ev.id}','Ativo')" title="Ativar"><i class="fa-solid fa-play"></i></button>`;
            
            tbody.innerHTML += `<tr>
                <td>#${ev.id}</td>
                <td><strong>${ev.titulo}</strong><br><small>${safeDate(ev.inicio)} até ${safeDate(ev.fim)}</small></td>
                <td><span class="badge badge-${ev.status}">${ev.status}</span></td>
                <td style="text-align:right;">${btnAction}
                <button class="action-btn btn-edit" onclick='abrirEdicaoEvento(${JSON.stringify(ev)})'><i class="fa-solid fa-pen"></i></button></td>
            </tr>`;
        });
    });
}

function abrirEdicaoEvento(evento) {
    let config = {}; try { config = JSON.parse(evento.config); } catch(e){}
    Swal.fire({
        title: 'Editar Evento',
        html: `
            <div class="modal-form-grid">
                <div class="modal-full">
                    <label class="swal-label">Prorrogar Data Fim</label>
                    <input type="date" id="edit_fim" class="swal-input" value="${evento.fim ? evento.fim.split('T')[0] : ''}">
                </div>
                <div class="modal-full">
                    <label class="swal-label">Mensagem de Alerta (Aviso no topo do form)</label>
                    <textarea id="edit_msg" class="swal-input" style="height:80px;">${config.mensagemAlerta || ''}</textarea>
                </div>
            </div>
        `,
        width: '500px',
        showCancelButton: true, confirmButtonText: 'Salvar Alterações',
        preConfirm: () => { return { fim: document.getElementById('edit_fim').value, msg: document.getElementById('edit_msg').value }; }
    }).then((res) => {
        if(res.isConfirmed) {
            fetch(URL_API, { method: 'POST', body: JSON.stringify({ action: 'editarEvento', senha: sessionStorage.getItem('admin_token'), id: evento.id, ...res.value }) })
            .then(() => { Swal.fire({icon: 'success', title: 'Salvo!'}); carregarEventosAdmin(); });
        }
    });
}

function toggleStatusEvento(id, status) {
    showLoading('Atualizando...');
    fetch(URL_API, { method: 'POST', body: JSON.stringify({ action: 'alterarStatusEvento', senha: sessionStorage.getItem('admin_token'), id, novoStatus: status }) })
    .then(() => { Swal.close(); carregarEventosAdmin(); });
}

// MODAL NOVO EVENTO (COM AVISO CPF/EMAIL E CAMPO DE OBSERVAÇÃO)
function modalNovoEvento() {
    let htmlCampos = '<div class="checkbox-grid">';
    CAMPOS_PADRAO.forEach(c => htmlCampos += `<label class="checkbox-card"><input type="checkbox" id="check_${c.key}" value="${c.key}" checked> ${c.label}</label>`);
    htmlCampos += '</div>';

    Swal.fire({
        title: 'Criar Novo Evento', width: '800px',
        html: `
            <div class="modal-form-grid">
                <input id="swal-titulo" class="swal-input" placeholder="Título do Evento">
                <input id="swal-desc" class="swal-input" placeholder="Descrição Curta">
                <div class="modal-row">
                    <div><label class="swal-label">Início</label><input type="date" id="swal-inicio" class="swal-input"></div>
                    <div><label class="swal-label">Fim</label><input type="date" id="swal-fim" class="swal-input"></div>
                </div>
                
                <div class="modal-full" style="background:#f8fafc; padding:15px; border:1px solid #e2e8f0; border-radius:8px;">
                    <div style="background:#eff6ff; color:#1e40af; padding:8px; border-radius:6px; font-size:0.85rem; margin-bottom:10px; border:1px solid #dbeafe; display:flex; align-items:center; gap:8px;">
                        <i class="fa-solid fa-circle-info"></i>
                        <strong>CPF e E-mail</strong> são obrigatórios e já estarão no formulário.
                    </div>
                    
                    <label class="swal-label" style="color:var(--primary);">Outros Campos Obrigatórios:</label>
                    ${htmlCampos}
                    <hr style="margin:10px 0; border:0; border-top:1px dashed #ccc;">
                    
                    <label class="swal-label">Campos Extras Personalizados</label>
                    <div id="container-extras" style="display:flex; flex-direction:column; gap:5px; margin-bottom:10px;"></div>
                    <button type="button" class="action-btn btn-view" style="width:100%;" id="btn-add-extra">+ Adicionar Pergunta</button>
                    
                    <div class="modal-full" style="margin-top:15px;">
                        <label class="swal-label">Instruções / Observações para o Aluno (Exibido no formulário)</label>
                        <textarea id="txt_obs_admin" class="swal-input" style="height:80px;" placeholder="Ex: Trazer comprovante de residência original no dia da entrega."></textarea>
                    </div>
                </div>

                <div class="modal-full">
                    <label class="swal-label">Uploads Obrigatórios</label>
                    <div style="display:flex; gap:20px;">
                        <label class="checkbox-card"><input type="checkbox" id="req_foto" checked> Foto 3x4</label>
                        <label class="checkbox-card"><input type="checkbox" id="req_doc" checked> Declaração</label>
                    </div>
                </div>
            </div>
        `,
        showCancelButton: true, confirmButtonText: 'Publicar', confirmButtonColor: '#2563eb',
        didOpen: () => {
            document.getElementById('btn-add-extra').addEventListener('click', () => {
                const div = document.createElement('div');
                div.innerHTML = `<div style="display:flex; gap:5px;"><input type="text" class="swal-input extra-field" placeholder="Nome do campo (ex: Tamanho da Camisa)" style="margin-bottom:5px; flex:1;"><button type="button" class="action-btn btn-delete" onclick="this.parentElement.parentElement.remove()">X</button></div>`;
                document.getElementById('container-extras').appendChild(div);
            });
        },
        preConfirm: () => {
            const sels = []; 
            CAMPOS_PADRAO.forEach(c => { if(document.getElementById(`check_${c.key}`).checked) sels.push(c.key); });
            
            const extras = [];
            document.querySelectorAll('.extra-field').forEach(inp => { if(inp.value.trim()) extras.push(inp.value.trim()); });

            return {
                titulo: document.getElementById('swal-titulo').value, descricao: document.getElementById('swal-desc').value,
                inicio: document.getElementById('swal-inicio').value, fim: document.getElementById('swal-fim').value,
                config: { 
                    camposTexto: sels, 
                    camposPersonalizados: extras,
                    observacoesTexto: document.getElementById('txt_obs_admin').value,
                    arquivos: { foto: document.getElementById('req_foto').checked, doc: document.getElementById('req_doc').checked } 
                }, 
                status: 'Ativo'
            }
        }
    }).then((res) => {
        if(res.isConfirmed) {
            showLoading('Criando Evento...');
            fetch(URL_API, { method: 'POST', body: JSON.stringify({ action: 'criarEvento', senha: sessionStorage.getItem('admin_token'), dados: res.value }) })
            .then(() => { Swal.fire({icon: 'success', title: 'Sucesso!'}); carregarEventosAdmin(); });
        }
    });
}

// --- INSCRIÇÕES ---
function carregarInscricoes() {
    const tbody = document.getElementById('lista-inscricoes-admin');
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:20px;">Carregando...</td></tr>';
    
    fetch(`${URL_API}?action=getInscricoesAdmin&token=${sessionStorage.getItem('admin_token')}`).then(r => r.json()).then(json => {
        todasInscricoes = (json.data || []).sort((a,b) => new Date(b.data) - new Date(a.data));
        resetEFiltrar();
    }).catch(() => {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:red;">Erro ao carregar.</td></tr>';
    });
}

function resetEFiltrar() {
    paginaAtual = 1; desmarcarTudo();
    const termo = document.getElementById('filtro-nome').value.toLowerCase();
    const status = document.getElementById('filtro-status').value;
    const eventoId = document.getElementById('filtro-evento').value;
    inscricoesFiltradas = todasInscricoes.filter(i => {
        let d = {}; try { d = JSON.parse(i.dadosJson); } catch(e){}
        const nome = (d.NomeCompleto || "").toLowerCase();
        return (nome.includes(termo) || i.chave.toLowerCase().includes(termo)) && (status === "" || i.status === status) && (eventoId === "" || String(i.eventoId) === String(eventoId));
    });
    if(document.getElementById('filtro-evento').options.length <= 1) {
        const select = document.getElementById('filtro-evento');
        Object.keys(mapaEventos).forEach(id => select.innerHTML += `<option value="${id}">${mapaEventos[id]}</option>`);
    }
    document.getElementById('lista-inscricoes-admin').innerHTML = '';
    renderizarProximaPagina();
}

function renderizarProximaPagina() {
    const tbody = document.getElementById('lista-inscricoes-admin');
    const lote = inscricoesFiltradas.slice((paginaAtual - 1) * ITENS_POR_PAGINA, paginaAtual * ITENS_POR_PAGINA);
    if(paginaAtual === 1 && lote.length === 0) { tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:20px;">Nenhuma inscrição encontrada.</td></tr>'; document.getElementById('btn-load-more').style.display = 'none'; return; }
    
    lote.forEach(ins => {
        let d = {}; try { d = JSON.parse(ins.dadosJson); } catch(e){}
        const checked = selecionados.has(ins.chave) ? 'checked' : '';
        
        let btnFicha = '';
        if(ins.link_ficha && ins.link_ficha.length > 5) {
            btnFicha = `<a href="${ins.link_ficha}" target="_blank" class="action-btn btn-view" style="background:#059669;" title="Baixar PDF"><i class="fa-solid fa-file-pdf"></i></a>`;
        } else {
            btnFicha = `<button class="action-btn" style="background:#6366f1;" onclick="gerarFicha('${ins.chave}')" title="Gerar Ficha"><i class="fa-solid fa-print"></i></button>`;
        }

        tbody.innerHTML += `<tr>
            <td><input type="checkbox" class="bulk-check" value="${ins.chave}" ${checked} onclick="toggleCheck('${ins.chave}')"></td>
            <td>${safeDate(ins.data)}</td><td><small>${mapaEventos[ins.eventoId]||ins.eventoId}</small></td>
            <td><strong>${d.NomeCompleto||'Aluno'}</strong><br><small style="color:#64748b;">${ins.chave}</small></td>
            <td><span class="badge badge-${ins.status.replace(/\s/g, '')}">${ins.status}</span></td>
            <td><div style="display:flex; gap:5px; justify-content:flex-end;"><button class="action-btn btn-edit" onclick="mudarStatus('${ins.chave}')"><i class="fa-solid fa-list-check"></i></button>${btnFicha}${ins.doc ? `<a href="${ins.doc}" target="_blank" class="action-btn btn-view" title="Ver Anexo"><i class="fa-solid fa-paperclip"></i></a>` : ''}</div></td>
        </tr>`;
    });
    paginaAtual++;
    document.getElementById('btn-load-more').style.display = (paginaAtual * ITENS_POR_PAGINA < inscricoesFiltradas.length + ITENS_POR_PAGINA) ? 'block' : 'none';
}

function toggleCheck(k) { if(selecionados.has(k)) selecionados.delete(k); else selecionados.add(k); atualizarBarraBulk(); }
function toggleAllChecks() { const m = document.getElementById('check-all').checked; document.querySelectorAll('.bulk-check').forEach(c => { c.checked = m; if(m) selecionados.add(c.value); else selecionados.delete(c.value); }); atualizarBarraBulk(); }
function atualizarBarraBulk() { const b = document.getElementById('bulk-bar'); document.getElementById('bulk-count').innerText = selecionados.size; if(selecionados.size > 0) b.classList.remove('hidden-bar'); else b.classList.add('hidden-bar'); }
function desmarcarTudo() { selecionados.clear(); document.getElementById('check-all').checked = false; document.querySelectorAll('.bulk-check').forEach(c => c.checked = false); atualizarBarraBulk(); }

function acaoEmMassa(s) {
    Swal.fire({title: `Marcar ${selecionados.size} como ${s}?`, showCancelButton: true}).then((r) => {
        if(r.isConfirmed) {
            showLoading('Atualizando...');
            fetch(URL_API, { method: 'POST', body: JSON.stringify({ action: 'atualizarStatusEmMassa', senha: sessionStorage.getItem('admin_token'), chaves: Array.from(selecionados), novoStatus: s }) }).then(() => { Swal.fire({icon: 'success', title: 'Atualizado!'}); todasInscricoes.forEach(i => { if(selecionados.has(i.chave)) i.status = s; }); resetEFiltrar(); });
        }
    });
}

function gerarFicha(chave) {
    Swal.fire({ title: 'Gerar Ficha Oficial?', text: "O status mudará para 'Ficha Emitida'.", icon: 'question', showCancelButton: true, confirmButtonText: 'Sim', confirmButtonColor: '#4f46e5' }).then((r) => {
        if(r.isConfirmed) {
            showLoading('Gerando PDF...');
            fetch(URL_API, { method: 'POST', body: JSON.stringify({ action: 'gerarFichaPDF', senha: sessionStorage.getItem('admin_token'), chave: chave }) })
            .then(res => res.json()).then(json => {
                Swal.close();
                if(json.status === 'success') { Swal.fire('Sucesso', 'Ficha gerada!', 'success'); const item = todasInscricoes.find(i => i.chave === chave); if(item) { item.status = 'Ficha Emitida'; item.link_ficha = json.link; } resetEFiltrar(); } 
                else { Swal.fire('Erro', json.message, 'error'); }
            });
        }
    });
}

function mudarStatus(chave) {
    Swal.fire({
        title: 'Atualizar Status',
        html: `
            <div style="display:flex; flex-direction:column; gap:10px; padding:10px; text-align:left;">
                <label style="font-weight:600; color:#64748b; font-size:0.9rem;">Novo Status:</label>
                <select id="novo_status" class="swal2-select" style="display:flex; width:100%; margin:0; border:1px solid #cbd5e1; border-radius:8px; padding:10px;">
                    <option value="Pendente">Pendente (Em análise)</option>
                    <option value="Aprovada">Aprovada (Ok)</option>
                    <option value="Rejeitada">Rejeitada (Negado)</option>
                    <option value="Ficha Emitida">Ficha Emitida (Finalizado)</option>
                </select>
            </div>
        `,
        showCancelButton: true, confirmButtonText: 'Salvar', confirmButtonColor: '#2563eb',
        preConfirm: () => { return document.getElementById('novo_status').value; }
    }).then((res) => {
        if(res.isConfirmed) {
            showLoading('Atualizando...');
            fetch(URL_API, { method: 'POST', body: JSON.stringify({ action: 'atualizarStatus', senha: sessionStorage.getItem('admin_token'), chave, novoStatus: res.value }) }).then(() => {
                const item = todasInscricoes.find(i => i.chave === chave);
                if(item) item.status = res.value; 
                resetEFiltrar();
                Swal.fire({icon: 'success', title: 'Status Atualizado!', timer: 1500, showConfirmButton: false});
            });
        }
    });
}

function carregarInstituicoes() { fetch(`${URL_API}?action=getInstituicoes`).then(r => r.json()).then(json => { const d = document.getElementById('lista-instituicoes'); d.innerHTML = ''; if(json.data) json.data.forEach(n => d.innerHTML += `<div style="padding:10px; border-bottom:1px solid #eee; display:flex; justify-content:space-between;">${n} <button onclick="removerInst('${n}')" style="color:red; border:none; cursor:pointer;">X</button></div>`); }); }
function addInstituicao() { const n = document.getElementById('nova-inst').value; if(n) fetch(URL_API, { method: 'POST', body: JSON.stringify({ action: 'adicionarInstituicao', nome: n, senha: sessionStorage.getItem('admin_token') }) }).then(() => { document.getElementById('nova-inst').value = ''; carregarInstituicoes(); }); }
function removerInst(n) { fetch(URL_API, { method: 'POST', body: JSON.stringify({ action: 'removerInstituicao', nome: n, senha: sessionStorage.getItem('admin_token') }) }).then(() => carregarInstituicoes()); }
