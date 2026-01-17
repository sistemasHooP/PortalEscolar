const URL_API = 'https://script.google.com/macros/s/AKfycby-rnmBcploCmdEb8QWkMyo1tEanCcPkmNOA_QMlujH0XQvjLeiCCYhkqe7Hqhi6-mo8A/exec';

// --- CONFIGURAÇÃO GERAL ---
const URL_LOGO = './logo.png'; 

// Campos padrão (CPF e Email são fixos no sistema e não precisam estar aqui)
const CAMPOS_PADRAO = [
    { key: 'NomeCompleto', label: 'Nome Completo' }, 
    { key: 'DataNascimento', label: 'Nascimento' }, 
    { key: 'Telefone', label: 'Celular' }, 
    { key: 'Endereco', label: 'Endereço' },
    { key: 'NomeInstituicao', label: 'Instituição' }, 
    { key: 'NomeCurso', label: 'Curso' }, 
    { key: 'PeriodoCurso', label: 'Período' }, 
    { key: 'Matricula', label: 'Matrícula' }, 
];

const LABELS_TODOS_CAMPOS = {
    'NomeCompleto': 'Nome Completo',
    'CPF': 'CPF',
    'DataNascimento': 'Nascimento',
    'Telefone': 'Celular',
    'Endereco': 'Endereço',
    'Cidade': 'Cidade',
    'Estado': 'UF',
    'NomeInstituicao': 'Instituição',
    'NomeCurso': 'Curso',
    'PeriodoCurso': 'Período',
    'Matricula': 'Matrícula',
    'Email': 'E-mail'
};

// Estado da Aplicação
let mapaEventos = {}; 
let cacheEventos = {}; 
let chartEventosInstance = null; let chartStatusInstance = null;
let todasInscricoes = [];       
let inscricoesFiltradas = []; 
let dashboardData = []; 
let paginaAtual = 1;
const ITENS_POR_PAGINA = 50;
let selecionados = new Set(); 

// --- LOADING ---
function showLoading(msg = 'Processando...') {
    Swal.fire({
        html: `
            <div style="display:flex; flex-direction:column; align-items:center; gap:15px; padding:20px;">
                <img src="${URL_LOGO}" style="width:60px; height:auto; animation: pulse-swal 1.5s infinite ease-in-out;" onerror="this.style.display='none'">
                <h3 style="font-family:'Poppins', sans-serif; font-size:1.1rem; color:#1e293b; margin:0; font-weight:600;">${msg}</h3>
                <style>@keyframes pulse-swal { 0% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.1); opacity: 0.8; } 100% { transform: scale(1); opacity: 1; } }</style>
            </div>
        `,
        showConfirmButton: false, allowOutsideClick: false, width: '300px', background: '#fff'
    });
}

function safeDate(val) {
    if(!val) return '-';
    try { const d = new Date(val); return isNaN(d.getTime()) ? '-' : d.toLocaleDateString('pt-BR'); } catch(e) { return '-'; }
}

// --- AUTH ---
function toggleSenha() {
    const input = document.getElementById('admin-pass');
    const icon = document.querySelector('.password-toggle');
    if (input.type === 'password') { input.type = 'text'; icon.classList.replace('fa-eye', 'fa-eye-slash'); } 
    else { input.type = 'password'; icon.classList.replace('fa-eye-slash', 'fa-eye'); }
}

function realizarLogin(e) {
    e.preventDefault();
    const pass = document.getElementById('admin-pass').value;
    showLoading('Autenticando...');
    fetch(URL_API, { method: 'POST', body: JSON.stringify({ action: 'loginAdmin', senha: pass }) })
    .then(res => res.json()).then(json => {
        Swal.close();
        if(json.auth) {
            document.getElementById('login-screen').style.display = 'none';
            document.getElementById('admin-panel').classList.remove('hidden');
            sessionStorage.setItem('admin_token', pass);
            carregarDashboard();
        } else { Swal.fire({icon: 'error', title: 'Acesso Negado', text: 'Senha incorreta.'}); }
    }).catch(() => Swal.fire('Erro de Conexão', 'Verifique sua internet.', 'error'));
}

function logout() { 
    sessionStorage.removeItem('admin_token'); 
    window.location.reload(); 
}

// --- NAVEGAÇÃO ---
function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    
    const selectedTab = document.getElementById(tabId);
    if(selectedTab) selectedTab.classList.remove('hidden');
    
    let btnId = '';
    if(tabId === 'tab-dashboard') btnId = 'btn-dashboard';
    if(tabId === 'tab-relatorios') btnId = 'btn-relatorios';
    if(tabId === 'tab-eventos') btnId = 'btn-eventos';
    if(tabId === 'tab-inscricoes') btnId = 'btn-inscricoes';
    if(tabId === 'tab-config') btnId = 'btn-config';
    
    if(btnId) {
        const btn = document.getElementById(btnId);
        if(btn) btn.classList.add('active');
    }

    if(tabId === 'tab-dashboard' || tabId === 'tab-relatorios') carregarDashboard();
    if(tabId === 'tab-eventos') carregarEventosAdmin();
    if(tabId === 'tab-inscricoes') carregarInscricoes();
    if(tabId === 'tab-config') {
        carregarInstituicoes();
        carregarConfigDrive(); 
    }
}

// --- CONFIGURAÇÃO DRIVE ---
function carregarConfigDrive() {
    fetch(`${URL_API}?action=getConfigDrive&token=${sessionStorage.getItem('admin_token')}`)
    .then(r => r.json())
    .then(json => {
        if(json.status === 'success') {
            document.getElementById('config-drive-id').value = json.idPasta || '';
        }
    });
}

function salvarConfigDrive() {
    const id = document.getElementById('config-drive-id').value;
    showLoading('Salvando...');
    fetch(URL_API, { 
        method: 'POST', 
        body: JSON.stringify({ 
            action: 'salvarConfigDrive', 
            senha: sessionStorage.getItem('admin_token'),
            idPasta: id 
        }) 
    }).then(() => {
        Swal.fire({icon: 'success', title: 'Salvo!', timer: 1500, showConfirmButton: false});
    });
}

// --- DASHBOARD ---
function carregarDashboard() {
    const token = sessionStorage.getItem('admin_token');
    Promise.all([
        fetch(`${URL_API}?action=getTodosEventos`).then(r => r.json()),
        fetch(`${URL_API}?action=getInscricoesAdmin&token=${token}`).then(r => r.json())
    ]).then(([jsonEventos, jsonInscricoes]) => {
        mapaEventos = {}; 
        cacheEventos = {}; 
        if(jsonEventos.data) jsonEventos.data.forEach(ev => {
            if (ev.id && ev.titulo) {
                mapaEventos[ev.id] = ev.titulo;
                cacheEventos[ev.id] = ev; 
            }
        });
        
        dashboardData = jsonInscricoes.data || [];
        atualizarSelectsRelatorio(jsonEventos.data || [], dashboardData);
        atualizarEstatisticasDashboard(dashboardData);

        const contagemEventos = {}, contagemStatus = {};
        dashboardData.forEach(i => {
            const nome = mapaEventos[i.eventoId] || `Evento ${i.eventoId}`;
            contagemEventos[nome] = (contagemEventos[nome] || 0) + 1;
            contagemStatus[i.status] = (contagemStatus[i.status] || 0) + 1;
        });
        
        if(document.getElementById('chartEventos')) {
            renderizarGraficos(contagemEventos, contagemStatus);
        }
    });
}

function atualizarEstatisticasDashboard(dados) {
    const elTotal = document.getElementById('stat-total');
    if(elTotal) {
        elTotal.innerText = dados.length;
        document.getElementById('stat-aprovados').innerText = dados.filter(i => i.status.includes('Aprovada') || i.status.includes('Emitida')).length;
        document.getElementById('stat-pendentes').innerText = dados.filter(i => i.status === 'Pendente').length;
    }
}

function renderizarGraficos(dadosEventos, dadosStatus) {
    if(chartEventosInstance) chartEventosInstance.destroy();
    chartEventosInstance = new Chart(document.getElementById('chartEventos').getContext('2d'), {
        type: 'bar', 
        data: { labels: Object.keys(dadosEventos), datasets: [{ label: 'Inscritos', data: Object.values(dadosEventos), backgroundColor: '#2563eb', borderRadius: 4 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, grid: { borderDash: [2, 4] } }, x: { grid: { display: false } } } }
    });
    if(chartStatusInstance) chartStatusInstance.destroy();
    chartStatusInstance = new Chart(document.getElementById('chartStatus').getContext('2d'), {
        type: 'doughnut', 
        data: { labels: Object.keys(dadosStatus), datasets: [{ data: Object.values(dadosStatus), backgroundColor: ['#ca8a04', '#16a34a', '#dc2626', '#2563eb'], borderWidth: 0 }] },
        options: { responsive: true, maintainAspectRatio: false, cutout: '70%', plugins: { legend: { position: 'right', labels: { usePointStyle: true, boxWidth: 8 } } } }
    });
}

function atualizarSelectsRelatorio(eventos, inscricoes) {
    const selEvento = document.getElementById('relatorio-evento');
    if(selEvento) {
        selEvento.innerHTML = '<option value="">Todos os Eventos</option>';
        eventos.forEach(ev => {
            if(ev.id && ev.titulo) {
                selEvento.innerHTML += `<option value="${ev.id}">${ev.titulo}</option>`;
            }
        });
    }
    
    const selInst = document.getElementById('relatorio-inst');
    if(selInst) {
        let instituicoes = new Set();
        inscricoes.forEach(ins => { try { instituicoes.add(JSON.parse(ins.dadosJson).NomeInstituicao); } catch(e){} });
        selInst.innerHTML = '<option value="">Todas as Instituições</option>';
        Array.from(instituicoes).sort().forEach(inst => { if(inst) selInst.innerHTML += `<option value="${inst}">${inst}</option>`; });
    }
}

// --- RELATÓRIO PDF ---
function gerarRelatorioTransporte() {
    const eventoId = document.getElementById('relatorio-evento').value;
    const instFiltro = document.getElementById('relatorio-inst').value;
    
    const alunosFiltrados = dashboardData.filter(i => {
        let d = {}; try { d = JSON.parse(i.dadosJson); } catch (e) {}
        return (eventoId === "" || String(i.eventoId) === String(eventoId)) &&
               (instFiltro === "" || d.NomeInstituicao === instFiltro) &&
               (i.status === 'Aprovada' || i.status === 'Ficha Emitida');
    });

    if (alunosFiltrados.length === 0) {
        return Swal.fire({ icon: 'info', title: 'Sem dados', text: 'Nenhum aluno APROVADO encontrado com esses filtros.' });
    }

    const todasChaves = new Set();
    const chavesPrioritarias = ['NomeCompleto', 'NomeInstituicao', 'NomeCurso', 'PeriodoCurso', 'Telefone', 'Cidade', 'Estado'];
    const ignorar = ['linkFoto', 'linkDoc', 'Assinatura', 'CPF', 'Email'];

    alunosFiltrados.forEach(aluno => {
        try {
            const dados = JSON.parse(aluno.dadosJson);
            Object.keys(dados).forEach(k => {
                if (!ignorar.includes(k)) todasChaves.add(k);
            });
        } catch (e) {}
    });

    const listaChaves = Array.from(todasChaves).sort((a, b) => {
        const idxA = chavesPrioritarias.indexOf(a);
        const idxB = chavesPrioritarias.indexOf(b);
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;
        return a.localeCompare(b);
    });

    let htmlChecks = `<div class="checkbox-grid" style="max-height:300px; overflow-y:auto; padding:5px;">`;
    listaChaves.forEach(chave => {
        const label = LABELS_TODOS_CAMPOS[chave] || chave;
        const checked = chavesPrioritarias.includes(chave) ? 'checked' : '';
        htmlChecks += `
            <label class="checkbox-card">
                <input type="checkbox" class="col-check" value="${chave}" ${checked}> ${label}
            </label>`;
    });
    htmlChecks += `</div>`;

    Swal.fire({
        title: 'Personalizar Relatório',
        html: `<p style="font-size:0.9rem; color:#64748b; margin-bottom:15px;">Selecione as colunas para o PDF:</p>${htmlChecks}`,
        width: '700px',
        showCancelButton: true,
        confirmButtonText: 'Gerar PDF',
        confirmButtonColor: '#2563eb',
        preConfirm: () => {
            const selecionados = [];
            document.querySelectorAll('.col-check:checked').forEach(c => selecionados.push(c.value));
            if (selecionados.length === 0) Swal.showValidationMessage('Selecione pelo menos uma coluna.');
            return selecionados;
        }
    }).then((res) => {
        if (res.isConfirmed) {
            construirRelatorioFinal(alunosFiltrados, res.value, eventoId);
        }
    });
}

function construirRelatorioFinal(alunos, colunasKeys, eventoId) {
    showLoading('Preparando Impressão...');

    const tituloEvento = eventoId ? (mapaEventos[eventoId] || 'Evento') : "Relatório Geral";
    const dataHoje = new Date().toLocaleDateString('pt-BR');

    const grupos = {};
    alunos.forEach(aluno => {
        let d = {}; try { d = JSON.parse(aluno.dadosJson); } catch(e){}
        const inst = d.NomeInstituicao ? d.NomeInstituicao.trim() : 'Outros / Sem Instituição';
        if (!grupos[inst]) grupos[inst] = [];
        grupos[inst].push(d);
    });

    if (!colunasKeys.includes('Assinatura')) colunasKeys.push('Assinatura');

    let htmlContent = `
        <div class="report-container">
            <div class="report-header">
                <div class="header-left">
                    <img src="${URL_LOGO}" alt="Logo" class="report-logo" onerror="this.style.opacity='0'">
                    <div class="header-titles">
                        <h1>Relatório de Transporte Escolar</h1>
                        <p>${tituloEvento}</p>
                    </div>
                </div>
                <div class="header-right">
                    Emitido em: ${dataHoje}<br>
                    Total de Alunos: ${alunos.length}
                </div>
            </div>
    `;

    let thead = `<tr><th class="col-index">#</th>`;
    colunasKeys.forEach(k => {
        const label = k === 'Assinatura' ? 'Assinatura' : (LABELS_TODOS_CAMPOS[k] || k);
        const widthStyle = k === 'Assinatura' ? 'width: 25%;' : '';
        thead += `<th style="${widthStyle}">${label}</th>`;
    });
    thead += `</tr>`;

    const nomesInstituicoes = Object.keys(grupos).sort(); 

    nomesInstituicoes.forEach(instNome => {
        const listaAlunos = grupos[instNome];
        listaAlunos.sort((a,b) => (a['NomeCompleto']||'').localeCompare(b['NomeCompleto']||''));

        htmlContent += `
            <div class="group-header" style="margin-top: 20px; padding: 8px; font-weight: bold; background: #e5e7eb; border: 1px solid #000; border-bottom: none; font-size: 11px;">
                INSTITUIÇÃO: ${instNome.toUpperCase()} (${listaAlunos.length} ALUNOS)
            </div>
            <table class="report-table" style="margin-top:0;">
                <thead>${thead}</thead>
                <tbody>
        `;

        listaAlunos.forEach((dados, idx) => {
            htmlContent += `<tr><td class="col-index">${idx + 1}</td>`;
            colunasKeys.forEach(key => {
                if (key === 'Assinatura') {
                    htmlContent += `<td></td>`;
                } else {
                    htmlContent += `<td>${dados[key] !== undefined ? dados[key] : '-'}</td>`;
                }
            });
            htmlContent += `</tr>`;
        });

        htmlContent += `</tbody></table>`;
    });

    htmlContent += `
            <div class="report-footer">
                <div class="sign-box"><div class="sign-line">Responsável pelo Transporte</div></div>
                <div class="sign-box"><div class="sign-line">Secretaria de Educação</div></div>
            </div>
        </div>
    `;

    let printLayer = document.getElementById('print-layer');
    if (!printLayer) {
        printLayer = document.createElement('div');
        printLayer.id = 'print-layer';
        document.body.appendChild(printLayer);
    }
    
    printLayer.innerHTML = htmlContent;
    Swal.close();
    
    setTimeout(() => window.print(), 500);
}

// --- EVENTOS (WIDESCREEN MODAL) ---
function carregarEventosAdmin() {
    fetch(`${URL_API}?action=getTodosEventos`).then(res => res.json()).then(json => {
        const tbody = document.getElementById('lista-eventos-admin'); 
        tbody.innerHTML = '';
        mapaEventos = {};
        if(!json.data || json.data.length === 0) { tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 2rem;">Nenhum evento criado.</td></tr>'; return; }
        
        json.data.forEach(ev => {
            if (ev.id && ev.titulo) {
                mapaEventos[ev.id] = ev.titulo;
                cacheEventos[ev.id] = ev; 
            }
        });
        
        const eventosValidos = json.data.filter(ev => ev.id && ev.titulo);

        eventosValidos.sort((a,b) => b.id - a.id).forEach(ev => {
            let btnAction = ev.status === 'Ativo' ? 
                `<button class="btn-icon" style="background:#eab308;" onclick="toggleStatusEvento('${ev.id}','Inativo')" title="Pausar"><i class="fa-solid fa-pause"></i></button>` : 
                `<button class="btn-icon" style="background:#22c55e;" onclick="toggleStatusEvento('${ev.id}','Ativo')" title="Ativar"><i class="fa-solid fa-play"></i></button>`;
            
            tbody.innerHTML += `
                <tr>
                    <td><strong>#${ev.id}</strong></td>
                    <td><div style="font-weight:600; color:var(--text-main); font-size:0.95rem;">${ev.titulo}</div></td>
                    <td><div style="font-size:0.85rem; color:var(--text-secondary);">${safeDate(ev.inicio)} - ${safeDate(ev.fim)}</div></td>
                    <td><span class="badge ${ev.status === 'Ativo' ? 'success' : 'danger'}">${ev.status}</span></td>
                    <td style="text-align:right;">
                        ${btnAction}
                        <button class="btn-icon bg-edit" onclick='abrirEdicaoEvento(${JSON.stringify(ev)})'><i class="fa-solid fa-pen"></i></button>
                    </td>
                </tr>`;
        });
    });
}

function abrirEdicaoEvento(evento) {
    let config = {}; try { config = JSON.parse(evento.config); } catch(e){}
    const checkFicha = config.exigeFicha ? 'checked' : '';
    const checkCart = config.emiteCarteirinha ? 'checked' : '';
    const cidades = config.cidadesPermitidas ? config.cidadesPermitidas.join(', ') : '';
    
    // Lógica para carregar campos personalizados existentes
    const camposExtras = config.camposPersonalizados || [];
    let htmlExtras = '';
    camposExtras.forEach((campo, index) => {
        htmlExtras += `<div class="extra-field-item" style="display:flex; gap:10px; margin-bottom:5px;">
            <input type="text" class="swal-input-custom extra-input" value="${campo}" readonly>
            <button type="button" class="btn-icon bg-delete" onclick="this.parentElement.remove()" style="width:30px;"><i class="fa-solid fa-trash"></i></button>
        </div>`;
    });

    Swal.fire({
        title: 'Editar Evento',
        width: '900px',
        html: `
            <div class="swal-grid-2">
                <div><label class="swal-label">Data de Encerramento</label><input type="date" id="edit_fim" class="swal-input-custom" value="${evento.fim ? evento.fim.split('T')[0] : ''}"></div>
                <div><label class="swal-label">Restrição de Cidades</label><input type="text" id="edit_cidades" class="swal-input-custom" placeholder="Separe por vírgulas..." value="${cidades}"></div>
            </div>
            <div class="swal-full"><label class="swal-label">Mensagem de Alerta (Topo)</label><textarea id="edit_msg" class="swal-input-custom" style="height:60px;">${config.mensagemAlerta || ''}</textarea></div>
            
            <div style="background:#f8fafc; padding:15px; border-radius:8px; border:1px solid #e2e8f0; margin-bottom:15px;">
                <label class="swal-label" style="color:var(--primary);">Perguntas Personalizadas (Opcional)</label>
                <div style="display:flex; gap:10px; margin-bottom:10px;">
                    <input type="text" id="new-extra-edit" class="swal-input-custom" placeholder="Digite uma nova pergunta (ex: Tamanho da Camiseta)">
                    <button type="button" id="btn-add-extra-edit" class="btn btn-primary" style="width:auto;"><i class="fa-solid fa-plus"></i></button>
                </div>
                <div id="container-extras-edit">${htmlExtras}</div>
            </div>

            <div class="checkbox-grid"><label class="checkbox-card"><input type="checkbox" id="edit_req_ficha" ${checkFicha}> Exigir Ficha Presencial</label><label class="checkbox-card"><input type="checkbox" id="edit_emitir_carteirinha" ${checkCart}> Carteirinha Digital</label></div>
        `,
        showCancelButton: true, confirmButtonText: 'Salvar', confirmButtonColor: '#2563eb',
        didOpen: () => {
            document.getElementById('btn-add-extra-edit').addEventListener('click', () => {
                const val = document.getElementById('new-extra-edit').value;
                if(val) {
                    const div = document.createElement('div');
                    div.className = 'extra-field-item';
                    div.style.cssText = 'display:flex; gap:10px; margin-bottom:5px;';
                    div.innerHTML = `<input type="text" class="swal-input-custom extra-input" value="${val}" readonly><button type="button" class="btn-icon bg-delete" onclick="this.parentElement.remove()" style="width:30px;"><i class="fa-solid fa-trash"></i></button>`;
                    document.getElementById('container-extras-edit').appendChild(div);
                    document.getElementById('new-extra-edit').value = '';
                }
            });
        },
        preConfirm: () => { 
            const cidadesTexto = document.getElementById('edit_cidades').value;
            const cidadesArr = cidadesTexto ? cidadesTexto.split(',').map(s => s.trim()).filter(s => s) : [];
            const extras = [];
            document.querySelectorAll('#container-extras-edit .extra-input').forEach(el => extras.push(el.value));
            
            return { 
                fim: document.getElementById('edit_fim').value, 
                msg: document.getElementById('edit_msg').value,
                exigeFicha: document.getElementById('edit_req_ficha').checked,
                emiteCarteirinha: document.getElementById('edit_emitir_carteirinha').checked,
                cidadesPermitidas: cidadesArr,
                camposPersonalizados: extras
            }; 
        }
    }).then((res) => {
        if(res.isConfirmed) {
            showLoading('Salvando...');
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

function modalNovoEvento() {
    let htmlCampos = '<div class="checkbox-grid">';
    CAMPOS_PADRAO.forEach(c => {
        if(c.key !== 'Cidade' && c.key !== 'Estado') { 
             htmlCampos += `<label class="checkbox-card"><input type="checkbox" id="check_${c.key}" value="${c.key}" checked> ${c.label}</label>`;
        }
    });
    htmlCampos += '</div>';

    Swal.fire({
        title: 'Criar Novo Evento', 
        width: '900px',
        html: `
            <div style="background:#eff6ff; color:#1e40af; padding:10px; border-radius:6px; font-size:0.85rem; margin-bottom:15px; border:1px solid #dbeafe;">
                <i class="fa-solid fa-info-circle"></i> <strong>Nota:</strong> CPF e E-mail são obrigatórios.
            </div>
            <div class="swal-grid-2">
                <div><label class="swal-label">Título</label><input id="swal-titulo" class="swal-input-custom" placeholder="Ex: Transporte 2025.1"></div>
                <div><label class="swal-label">Descrição</label><input id="swal-desc" class="swal-input-custom" placeholder="Ex: Período letivo regular"></div>
            </div>
            <div class="swal-grid-2">
                <div><label class="swal-label">Início</label><input type="date" id="swal-inicio" class="swal-input-custom"></div>
                <div><label class="swal-label">Fim</label><input type="date" id="swal-fim" class="swal-input-custom"></div>
            </div>

            <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin-top: 20px; border: 1px solid #e2e8f0;">
                <label class="swal-label">Campos Padrão do Aluno</label>
                ${htmlCampos}
                
                <div style="margin-top:20px; border-top:1px dashed #cbd5e1; padding-top:15px;">
                    <label class="swal-label" style="color:var(--primary);">Perguntas Personalizadas (Opcional)</label>
                    <div style="display:flex; gap:10px; margin-bottom:10px;">
                        <input type="text" id="new-extra" class="swal-input-custom" placeholder="Digite uma pergunta extra...">
                        <button type="button" id="btn-add-extra" class="btn btn-primary" style="width:auto;"><i class="fa-solid fa-plus"></i></button>
                    </div>
                    <div id="container-extras"></div>
                </div>

                <div class="swal-grid-2" style="margin-top: 15px;">
                    <div><label class="swal-label">Restrição de Cidades</label><input type="text" id="swal-cidades" class="swal-input-custom" placeholder="Deixe vazio para todas"></div>
                    <div><label class="swal-label">Obs (Leitura)</label><textarea id="txt_obs_admin" class="swal-input-custom" style="height:42px;"></textarea></div>
                </div>
                <label class="swal-label" style="margin-top: 15px;">Uploads</label>
                <div class="checkbox-grid">
                    <label class="checkbox-card"><input type="checkbox" id="req_foto" checked> Foto 3x4</label>
                    <label class="checkbox-card"><input type="checkbox" id="req_doc" checked> Declaração</label>
                </div>
                <div class="checkbox-grid" style="margin-top: 15px;">
                    <label class="checkbox-card" style="background:#fffbeb; border-color:#f59e0b;"><input type="checkbox" id="req_ficha" checked> Exigir Ficha Presencial</label>
                    <label class="checkbox-card" style="background:#eff6ff; border-color:#3b82f6;"><input type="checkbox" id="emitir_carteirinha"> Carteirinha Digital</label>
                </div>
            </div>
        `,
        showCancelButton: true, confirmButtonText: 'Publicar Evento', confirmButtonColor: '#2563eb',
        didOpen: () => {
            document.getElementById('btn-add-extra').addEventListener('click', () => {
                const val = document.getElementById('new-extra').value;
                if(val) {
                    const div = document.createElement('div');
                    div.className = 'extra-field-item';
                    div.style.cssText = 'display:flex; gap:10px; margin-bottom:5px;';
                    div.innerHTML = `<input type="text" class="swal-input-custom extra-input" value="${val}" readonly><button type="button" class="btn-icon bg-delete" onclick="this.parentElement.remove()" style="width:30px;"><i class="fa-solid fa-trash"></i></button>`;
                    document.getElementById('container-extras').appendChild(div);
                    document.getElementById('new-extra').value = '';
                }
            });
        },
        preConfirm: () => {
            const t = document.getElementById('swal-titulo').value;
            const i = document.getElementById('swal-inicio').value;
            const f = document.getElementById('swal-fim').value;

            if(!t || !i || !f) { Swal.showValidationMessage('Preencha dados básicos.'); return false; }

            const sels = ['Cidade', 'Estado']; 
            CAMPOS_PADRAO.forEach(c => { 
                const el = document.getElementById(`check_${c.key}`);
                if(el && el.checked) sels.push(c.key); 
            });
            
            const extras = [];
            document.querySelectorAll('#container-extras .extra-input').forEach(el => extras.push(el.value));
            
            const cidadesTexto = document.getElementById('swal-cidades').value;
            const cidadesArr = cidadesTexto ? cidadesTexto.split(',').map(s => s.trim()).filter(s => s) : [];

            return {
                titulo: t, descricao: document.getElementById('swal-desc').value,
                inicio: i, fim: f,
                config: { 
                    camposTexto: sels, 
                    camposPersonalizados: extras, 
                    observacoesTexto: document.getElementById('txt_obs_admin').value,
                    arquivos: { foto: document.getElementById('req_foto').checked, doc: document.getElementById('req_doc').checked },
                    exigeFicha: document.getElementById('req_ficha').checked,
                    emiteCarteirinha: document.getElementById('emitir_carteirinha').checked,
                    cidadesPermitidas: cidadesArr 
                }, 
                status: 'Ativo'
            }
        }
    }).then((res) => {
        if(res.isConfirmed) {
            showLoading('Criando Evento...');
            fetch(URL_API, { method: 'POST', body: JSON.stringify({ action: 'criarEvento', senha: sessionStorage.getItem('admin_token'), dados: res.value }) })
            .then(() => { Swal.fire({icon: 'success', title: 'Evento Criado!'}); carregarEventosAdmin(); });
        }
    });
}

// --- INSCRIÇÕES (Logic) ---
function carregarInscricoes() {
    const tbody = document.getElementById('lista-inscricoes-admin');
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:2rem;">Carregando dados...</td></tr>';
    
    // 1. Carrega Eventos
    fetch(`${URL_API}?action=getTodosEventos`)
    .then(r => r.json())
    .then(jsonEventos => {
        if(jsonEventos.data) {
             jsonEventos.data.forEach(ev => { 
                 if(ev.id && ev.titulo) {
                     mapaEventos[ev.id] = ev.titulo; 
                     cacheEventos[ev.id] = ev; 
                 }
             });
             const select = document.getElementById('filtro-evento');
             if(select && select.options.length <= 1) {
                 Object.keys(mapaEventos).forEach(id => select.innerHTML += `<option value="${id}">${mapaEventos[id]}</option>`);
             }
        }
        // 2. Carrega Inscrições
        return fetch(`${URL_API}?action=getInscricoesAdmin&token=${sessionStorage.getItem('admin_token')}`);
    })
    .then(r => r.json())
    .then(json => {
        todasInscricoes = (json.data || []).sort((a,b) => new Date(b.data) - new Date(a.data));
        resetEFiltrar();
    })
    .catch(() => {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:#dc2626;">Erro de comunicação.</td></tr>';
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
        const cpf = (d.CPF || "").replace(/\D/g, '');
        return (nome.includes(termo) || i.chave.toLowerCase().includes(termo) || cpf.includes(termo)) && 
               (status === "" || i.status === status) && 
               (eventoId === "" || String(i.eventoId) === String(eventoId));
    });
    document.getElementById('lista-inscricoes-admin').innerHTML = '';
    renderizarProximaPagina();
}

function renderizarProximaPagina() {
    const tbody = document.getElementById('lista-inscricoes-admin');
    const lote = inscricoesFiltradas.slice((paginaAtual - 1) * ITENS_POR_PAGINA, paginaAtual * ITENS_POR_PAGINA);
    
    if(paginaAtual === 1 && lote.length === 0) { 
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 2rem; color: #64748b;">Nenhum registro encontrado.</td></tr>'; 
        document.getElementById('btn-load-more').style.display = 'none'; 
        return; 
    }
    
    lote.forEach(ins => {
        let d = {}; try { d = JSON.parse(ins.dadosJson); } catch(e){}
        const checked = selecionados.has(ins.chave) ? 'checked' : '';
        
        let btnFicha = ins.link_ficha ? 
            `<a href="${ins.link_ficha}" target="_blank" class="btn-icon bg-view" title="Baixar Ficha PDF"><i class="fa-solid fa-file-pdf"></i></a>` : 
            `<button class="btn-icon bg-view" style="background:#6366f1;" onclick="gerarFicha('${ins.chave}')" title="Gerar Ficha"><i class="fa-solid fa-print"></i></button>`;
        
        let btnCartAdm = '';
        const evento = cacheEventos[ins.eventoId];
        if (evento) {
            let config = {}; try { config = JSON.parse(evento.config); } catch(e) {}
            if (config.emiteCarteirinha) {
                btnCartAdm = `<button class="btn-icon bg-view" style="background:#3b82f6;" onclick="imprimirCarteirinhaAdmin('${ins.chave}')" title="Carteirinha"><i class="fa-solid fa-id-card"></i></button>`;
            }
        }
        
        tbody.innerHTML += `<tr>
            <td style="text-align:center;"><input type="checkbox" class="bulk-check" value="${ins.chave}" ${checked} onclick="toggleCheck('${ins.chave}')"></td>
            <td>${safeDate(ins.data)}</td>
            <td><div style="font-weight:600; font-size:0.9rem; color:var(--text-main);">${d.NomeCompleto||'Sem Nome'}</div><small style="color:var(--text-secondary);">${d.CPF||'-'}</small></td>
            <td><div class="badge" style="background:#f1f5f9; color:#475569; font-weight:500;">${mapaEventos[ins.eventoId]||ins.eventoId}</div></td>
            <td><span class="badge ${ins.status.replace(/\s/g, '')}">${ins.status}</span></td>
            <td style="text-align:right;">
                <div style="display:flex; gap:4px; justify-content:flex-end;">
                    <button class="btn-icon bg-edit" style="background:#f59e0b;" onclick="abrirEdicaoInscricao('${ins.chave}')" title="Detalhes"><i class="fa-solid fa-pen-to-square"></i></button>
                    ${btnCartAdm}
                    ${btnFicha}
                    ${ins.doc ? `<a href="${ins.doc}" target="_blank" class="btn-icon bg-view" title="Ver Documento"><i class="fa-solid fa-paperclip"></i></a>` : ''}
                </div>
            </td>
        </tr>`;
    });
    paginaAtual++;
    document.getElementById('btn-load-more').style.display = (paginaAtual * ITENS_POR_PAGINA < inscricoesFiltradas.length + ITENS_POR_PAGINA) ? 'block' : 'none';
}

// --- EDIÇÃO DE INSCRIÇÃO (WIDESCREEN MODAL - NOVA GRID) ---
function abrirEdicaoInscricao(chave) {
    const inscricao = todasInscricoes.find(i => i.chave === chave);
    if (!inscricao) return;
    
    let dados = {}; try { dados = JSON.parse(inscricao.dadosJson); } catch(e) {}
    let evento = cacheEventos[inscricao.eventoId] || {};
    let configEvento = {}; try { configEvento = JSON.parse(evento.config || '{}'); } catch(e) {}

    // Tratamento de imagem para o modal
    let fotoUrl = 'https://via.placeholder.com/150?text=Sem+Foto';
    if(dados.linkFoto) {
        if(dados.linkFoto.includes('drive.google.com')) {
             let id = dados.linkFoto.split(/\/d\/|id=/)[1].split(/\/|&/)[0];
             fotoUrl = `https://lh3.googleusercontent.com/d/${id}`;
        } else {
             fotoUrl = dados.linkFoto;
        }
    }

    // Construção dos Campos em 2 Colunas usando classes swal-grid-2
    let htmlCamposEsquerda = ''; // Dados Pessoais
    let htmlCamposDireita = '';  // Dados Acadêmicos

    const ignorar = ['linkFoto', 'linkDoc'];
    const camposAcad = ['NomeInstituicao', 'NomeCurso', 'PeriodoCurso', 'Matricula', 'Turno'];

    // Usamos o mapeamento completo para os labels, garantindo que CPF e Email tenham rótulos
    for (const [key, val] of Object.entries(dados)) {
        if (!ignorar.includes(key)) {
            const label = LABELS_TODOS_CAMPOS[key] || key;
            const inputHtml = `<div style="margin-bottom:8px;"><label class="swal-label">${label}</label><input type="text" id="edit_aluno_${key}" value="${val}" class="swal-input-custom"></div>`;
            
            if (camposAcad.includes(key) || key.startsWith('Inst') || key.includes('Curso')) {
                htmlCamposDireita += inputHtml;
            } else {
                htmlCamposEsquerda += inputHtml;
            }
        }
    }

    // Área de Uploads Condicional
    let htmlUploads = '';
    const pedeFoto = configEvento.arquivos && configEvento.arquivos.foto;
    const pedeDoc = configEvento.arquivos && configEvento.arquivos.doc;

    if (pedeFoto || pedeDoc) {
        htmlUploads = `<div class="swal-grid-2" style="margin-top:20px; border-top:1px solid #e2e8f0; padding-top:15px;">`;
        if (pedeFoto) htmlUploads += `<div><label class="swal-label">Nova Foto 3x4</label><input type="file" id="edit_upload_foto" accept="image/*" class="swal-input-custom"></div>`;
        if (pedeDoc) htmlUploads += `<div><label class="swal-label">Novo Comprovante</label><input type="file" id="edit_upload_doc" accept="application/pdf" class="swal-input-custom"></div>`;
        htmlUploads += `</div>`;
    }

    Swal.fire({
        width: '1000px', // Modal Largo
        title: '', 
        html: `
            <div class="grid-sidebar">
                <!-- COLUNA LATERAL (FOTO + AÇÕES RÁPIDAS) -->
                <div style="background: #f8fafc; padding: 20px; border-radius: 10px; text-align: center; border: 1px solid #e2e8f0;">
                    <img src="${fotoUrl}" style="width: 140px; height: 140px; border-radius: 50%; object-fit: cover; border: 4px solid white; box-shadow: 0 4px 10px rgba(0,0,0,0.1); margin-bottom: 15px;">
                    <h3 style="font-size: 1.1rem; margin: 0; color: var(--primary); font-weight:700;">${dados.NomeCompleto || 'Estudante'}</h3>
                    <p style="color: #64748b; font-size: 0.9rem; margin-bottom: 20px;">${dados.CPF || ''}</p>
                    
                    <div style="text-align: left;">
                        <label class="swal-label">Status da Inscrição</label>
                        <select id="novo_status_modal" class="swal-input-custom" style="font-weight:600;">
                            <option value="Pendente" ${inscricao.status === 'Pendente' ? 'selected' : ''}>Pendente</option>
                            <option value="Aprovada" ${inscricao.status === 'Aprovada' ? 'selected' : ''}>Aprovada</option>
                            <option value="Rejeitada" ${inscricao.status === 'Rejeitada' ? 'selected' : ''}>Rejeitada</option>
                            <option value="Ficha Emitida" ${inscricao.status === 'Ficha Emitida' ? 'selected' : ''}>Ficha Emitida</option>
                        </select>
                    </div>

                    <div style="margin-top: 20px; display: grid; gap: 10px;">
                        ${inscricao.doc ? `<a href="${inscricao.doc}" target="_blank" class="btn btn-secondary" style="width:100%; justify-content:center;"><i class="fa-solid fa-eye"></i> Visualizar Comprovante</a>` : ''}
                    </div>
                </div>

                <!-- COLUNA PRINCIPAL (FORMULÁRIO) -->
                <div>
                    <h3 style="margin: 0 0 20px 0; color: var(--text-main); border-bottom: 1px solid #e2e8f0; padding-bottom: 10px; font-size:1.1rem;">Dados Cadastrais</h3>
                    
                    <div class="swal-grid-2" style="align-items: start; margin-bottom:0;">
                        <div>${htmlCamposEsquerda}</div>
                        <div>${htmlCamposDireita}</div>
                    </div>

                    ${htmlUploads}
                </div>
            </div>
        `,
        showCancelButton: true, confirmButtonText: 'Salvar Alterações', confirmButtonColor: '#2563eb',
        preConfirm: async () => {
            const novosDados = {};
            for (const key of Object.keys(dados)) { 
                if (!ignorar.includes(key)) { 
                    const el = document.getElementById(`edit_aluno_${key}`); 
                    if (el) novosDados[key] = el.value; 
                } 
            }
            
            const novoStatus = document.getElementById('novo_status_modal').value;
            
            // Coleta Arquivos
            const arqs = {};
            if (pedeFoto) {
                const f = document.getElementById('edit_upload_foto').files[0];
                if(f) arqs.foto = { data: await toBase64(f), mime: 'image/jpeg' };
            }
            if (pedeDoc) {
                const f = document.getElementById('edit_upload_doc').files[0];
                if(f) arqs.doc = { data: await toBase64(f), mime: 'application/pdf' };
            }

            return { novosDados, status: novoStatus, arquivos: Object.keys(arqs).length > 0 ? arqs : null };
        }
    }).then((result) => {
        if (result.isConfirmed) {
            showLoading('Salvando...');
            
            const promiseStatus = (result.value.status !== inscricao.status) ? 
                fetch(URL_API, { method: 'POST', body: JSON.stringify({ action: 'atualizarStatus', senha: sessionStorage.getItem('admin_token'), chave, novoStatus: result.value.status }) }) : 
                Promise.resolve();

            promiseStatus.then(() => {
                return fetch(URL_API, { 
                    method: 'POST', 
                    body: JSON.stringify({ 
                        action: 'editarInscricao', 
                        senha: sessionStorage.getItem('admin_token'), 
                        chave: chave, 
                        novosDados: result.value.novosDados,
                        arquivos: result.value.arquivos 
                    }) 
                });
            }).then(() => {
                Swal.fire({icon: 'success', title: 'Dados Atualizados!'});
                inscricao.status = result.value.status;
                inscricao.dadosJson = JSON.stringify({ ...dados, ...result.value.novosDados });
                resetEFiltrar();
            });
        }
    });
}

// --- FUNÇÕES AUXILIARES ---
function toggleCheck(k) { if(selecionados.has(k)) selecionados.delete(k); else selecionados.add(k); atualizarBarraBulk(); }
function toggleAllChecks() { const m = document.getElementById('check-all').checked; document.querySelectorAll('.bulk-check').forEach(c => { c.checked = m; if(m) selecionados.add(c.value); else selecionados.delete(c.value); }); atualizarBarraBulk(); }
function atualizarBarraBulk() { const b = document.getElementById('bulk-bar'); document.getElementById('bulk-count').innerText = selecionados.size; if(selecionados.size > 0) b.classList.remove('hidden'); else b.classList.add('hidden'); }
function desmarcarTudo() { selecionados.clear(); document.getElementById('check-all').checked = false; document.querySelectorAll('.bulk-check').forEach(c => c.checked = false); atualizarBarraBulk(); }

function acaoEmMassa(s) {
    Swal.fire({title: `Marcar ${selecionados.size} como ${s}?`, icon: 'warning', showCancelButton: true}).then((r) => {
        if(r.isConfirmed) {
            showLoading('Processando...');
            fetch(URL_API, { method: 'POST', body: JSON.stringify({ action: 'atualizarStatusEmMassa', senha: sessionStorage.getItem('admin_token'), chaves: Array.from(selecionados), novoStatus: s }) }).then(() => { Swal.fire({icon: 'success', title: 'Atualizado!'}); todasInscricoes.forEach(i => { if(selecionados.has(i.chave)) i.status = s; }); resetEFiltrar(); });
        }
    });
}

function gerarFicha(chave) {
    Swal.fire({ title: 'Emitir Ficha Oficial', text: "O status do aluno mudará para 'Ficha Emitida'.", icon: 'info', showCancelButton: true, confirmButtonText: 'Confirmar Emissão' }).then((r) => {
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

function imprimirCarteirinhaAdmin(chave) {
    showLoading('Carregando Dados...');
    fetch(`${URL_API}?action=consultarInscricao&chave=${chave}`)
    .then(r => r.json())
    .then(j => {
        Swal.close();
        if(j.status !== 'success') return Swal.fire('Erro', 'Dados não encontrados.', 'error');
        
        const aluno = j.data.aluno;
        let imgSrc = 'https://via.placeholder.com/150?text=FOTO';
        if (aluno.foto) {
            if (aluno.foto.startsWith('data:image') || aluno.foto.startsWith('http')) {
                if (aluno.foto.includes('drive.google.com') && !aluno.foto.startsWith('data:image')) {
                     let id = ''; const parts = aluno.foto.split(/\/d\/|id=/);
                     if (parts.length > 1) id = parts[1].split(/\/|&/)[0];
                     imgSrc = id ? `https://lh3.googleusercontent.com/d/${id}` : aluno.foto;
                } else { imgSrc = aluno.foto; }
            }
        }

        const htmlCarteirinha = `
            <div class="carteirinha-container" style="page-break-inside: avoid; margin: 20px auto;">
                <div class="carteirinha-card" style="-webkit-print-color-adjust: exact; print-color-adjust: exact;">
                    <div class="cart-header">
                        <img src="${URL_LOGO}" alt="Logo" class="cart-logo" style="background:white; border-radius:50%;">
                        <div><h3>TRANSPORTE ESCOLAR</h3><small>Secretaria de Educação</small></div>
                    </div>
                    <div class="cart-body">
                        <div class="cart-photo"><img src="${imgSrc}" alt="Foto" style="width:100%; height:100%; object-fit:cover;"></div>
                        <div class="cart-info">
                            <h2 style="font-size:16px; margin:0 0 5px 0;">${aluno.nome}</h2>
                            <p style="font-size:11px; margin:0;">${aluno.instituicao}</p>
                            <p style="font-size:11px; margin:0;">${aluno.curso}</p>
                            <div class="cart-meta">
                                <span>Mat: <b>${aluno.matricula}</b></span>
                                <span>Validade: <b>${aluno.validade}</b></span>
                            </div>
                        </div>
                    </div>
                    <div class="cart-footer"><span>Uso Pessoal e Intransferível</span></div>
                </div>
            </div>
        `;
        let printLayer = document.getElementById('print-layer');
        if (!printLayer) { printLayer = document.createElement('div'); printLayer.id = 'print-layer'; document.body.appendChild(printLayer); }
        printLayer.innerHTML = htmlCarteirinha;
        setTimeout(() => window.print(), 500);
    });
}

function carregarInstituicoes() { fetch(`${URL_API}?action=getInstituicoes`).then(r => r.json()).then(json => { const d = document.getElementById('lista-instituicoes'); d.innerHTML = ''; if(json.data) json.data.forEach(n => d.innerHTML += `<div style="padding:10px; border-bottom:1px solid #eee; display:flex; justify-content:space-between; align-items:center;"><span>${n}</span> <button onclick="removerInst('${n}')" class="btn-icon bg-delete" style="width:24px; height:24px;"><i class="fa-solid fa-times"></i></button></div>`); }); }
function addInstituicao() { const n = document.getElementById('nova-inst').value; if(n) fetch(URL_API, { method: 'POST', body: JSON.stringify({ action: 'adicionarInstituicao', nome: n, senha: sessionStorage.getItem('admin_token') }) }).then(() => { document.getElementById('nova-inst').value = ''; carregarInstituicoes(); }); }
function removerInst(n) { fetch(URL_API, { method: 'POST', body: JSON.stringify({ action: 'removerInstituicao', nome: n, senha: sessionStorage.getItem('admin_token') }) }).then(() => carregarInstituicoes()); }

const toBase64 = f => new Promise((r, j) => { const rd = new FileReader(); rd.readAsDataURL(f); rd.onload = () => r(rd.result.split(',')[1]); rd.onerror = e => j(e); });
