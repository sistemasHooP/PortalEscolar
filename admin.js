const URL_API = 'https://script.google.com/macros/s/AKfycby-rnmBcploCmdEb8QWkMyo1tEanCcPkmNOA_QMlujH0XQvjLeiCCYhkqe7Hqhi6-mo8A/exec';

const CAMPOS_PADRAO = [
    { key: 'NomeCompleto', label: 'Nome Completo' }, { key: 'DataNascimento', label: 'Data de Nascimento' },
    { key: 'Telefone', label: 'Celular' }, { key: 'Endereco', label: 'Endereço' },
    { key: 'NomeInstituicao', label: 'Instituição' }, { key: 'NomeCurso', label: 'Curso' },
    { key: 'PeriodoCurso', label: 'Período' }, { key: 'Matricula', label: 'Matrícula' }
];

let mapaEventos = {}; 
let chartEventosInstance = null; let chartStatusInstance = null;

// Variáveis para Lazy Loading e Bulk
let todasInscricoes = [];     // Guarda TUDO que veio da API
let inscricoesFiltradas = []; // Guarda o que passou no filtro atual
let paginaAtual = 1;
const ITENS_POR_PAGINA = 50;
let selecionados = new Set(); // Guarda IDs dos checkbox marcados

// --- AUTH ---
function toggleSenha() {
    const input = document.getElementById('admin-pass');
    input.type = input.type === 'password' ? 'text' : 'password';
}

function realizarLogin(e) {
    e.preventDefault();
    const pass = document.getElementById('admin-pass').value;
    fetch(URL_API, { method: 'POST', body: JSON.stringify({ action: 'loginAdmin', senha: pass }) })
    .then(res => res.json()).then(json => {
        if(json.auth) {
            document.getElementById('login-screen').classList.add('hidden');
            document.getElementById('admin-panel').classList.remove('hidden');
            sessionStorage.setItem('admin_token', pass);
            carregarDashboard();
        } else { Swal.fire('Erro', 'Senha incorreta', 'error'); }
    });
}
function logout() { sessionStorage.removeItem('admin_token'); location.reload(); }

// --- NAV ---
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
        mapaEventos = {}; jsonEventos.data.forEach(ev => mapaEventos[ev.id] = ev.titulo);
        atualizarSelectsRelatorio(jsonEventos.data, jsonInscricoes.data);
        
        const total = jsonInscricoes.data.length;
        const aprovados = jsonInscricoes.data.filter(i => i.status.includes('Aprovada') || i.status.includes('Emitida')).length;
        
        document.getElementById('stat-total').innerText = total;
        document.getElementById('stat-aprovados').innerText = aprovados;
        document.getElementById('stat-pendentes').innerText = jsonInscricoes.data.filter(i => i.status === 'Pendente').length;

        const contagemEventos = {}; const contagemStatus = {};
        jsonInscricoes.data.forEach(i => {
            const nome = mapaEventos[i.eventoId] || 'Outro';
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

// --- RELATÓRIOS ---
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
    if(!eventoId) return Swal.fire('Atenção', 'Selecione um evento.', 'warning');

    const token = sessionStorage.getItem('admin_token');
    fetch(`${URL_API}?action=getInscricoesAdmin&token=${token}`).then(res => res.json()).then(json => {
        const alunos = json.data.filter(i => {
            let d = {}; try{d=JSON.parse(i.dadosJson)}catch(e){}
            return String(i.eventoId) === String(eventoId) && (instFiltro === "" || d.NomeInstituicao === instFiltro) && (i.status === 'Aprovada' || i.status === 'Ficha Emitida');
        });

        if(alunos.length === 0) return Swal.fire('Vazio', 'Nenhum aluno APROVADO.', 'info');

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

// --- EVENTOS (AGORA COM EDIÇÃO) ---
function carregarEventosAdmin() {
    fetch(`${URL_API}?action=getTodosEventos`).then(res => res.json()).then(json => {
        const tbody = document.getElementById('lista-eventos-admin'); tbody.innerHTML = '';
        mapaEventos = {}; json.data.forEach(ev => mapaEventos[ev.id] = ev.titulo);
        
        json.data.sort((a,b) => b.id - a.id).forEach(ev => {
            let btnAction = ev.status === 'Ativo' ? 
                `<button class="action-btn btn-status-toggle active" onclick="toggleStatusEvento('${ev.id}','Inativo')"><i class="fa-solid fa-pause"></i></button>` : 
                `<button class="action-btn btn-status-toggle inactive" onclick="toggleStatusEvento('${ev.id}','Ativo')"><i class="fa-solid fa-play"></i></button>`;
            
            // Botão de Edição Desbloqueado
            tbody.innerHTML += `<tr>
                <td>#${ev.id}</td>
                <td><strong>${ev.titulo}</strong><br><small>${new Date(ev.inicio).toLocaleDateString()} - ${new Date(ev.fim).toLocaleDateString()}</small></td>
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
            <label class="swal-label">Prorrogar Data Fim</label>
            <input type="date" id="edit_fim" class="swal2-input" value="${evento.fim.split('T')[0]}">
            <label class="swal-label" style="margin-top:15px;">Mensagem de Alerta</label>
            <textarea id="edit_msg" class="swal2-textarea">${config.mensagemAlerta || ''}</textarea>
        `,
        showCancelButton: true, confirmButtonText: 'Salvar',
        preConfirm: () => { return { fim: document.getElementById('edit_fim').value, msg: document.getElementById('edit_msg').value }; }
    }).then((res) => {
        if(res.isConfirmed) {
            fetch(URL_API, { method: 'POST', body: JSON.stringify({ action: 'editarEvento', senha: sessionStorage.getItem('admin_token'), id: evento.id, ...res.value }) })
            .then(() => { Swal.fire('Salvo!', '', 'success'); carregarEventosAdmin(); });
        }
    });
}

function toggleStatusEvento(id, status) {
    fetch(URL_API, { method: 'POST', body: JSON.stringify({ action: 'alterarStatusEvento', senha: sessionStorage.getItem('admin_token'), id, novoStatus: status }) })
    .then(() => carregarEventosAdmin());
}

function modalNovoEvento() {
    let htmlCampos = '<div class="swal-checkbox-grid">';
    CAMPOS_PADRAO.forEach(c => htmlCampos += `<label class="swal-checkbox-item"><input type="checkbox" id="check_${c.key}" value="${c.key}" checked> ${c.label}</label>`);
    htmlCampos += '</div>';

    Swal.fire({
        title: 'Novo Evento', width: '800px',
        html: `<div class="swal-form-container">
            <input id="swal-titulo" class="swal2-input" placeholder="Título">
            <input id="swal-desc" class="swal2-input" placeholder="Descrição">
            <div class="swal-row"><input type="date" id="swal-inicio" class="swal2-input"><input type="date" id="swal-fim" class="swal2-input"></div>
            <label class="swal-label">Campos</label>${htmlCampos}
            <label class="swal-label">Uploads</label>
            <div style="display:flex; gap:15px;"><label><input type="checkbox" id="req_foto" checked> Foto</label><label><input type="checkbox" id="req_doc" checked> Doc</label></div>
        </div>`,
        showCancelButton: true, confirmButtonText: 'Criar',
        preConfirm: () => {
            const sels = []; CAMPOS_PADRAO.forEach(c => { if(document.getElementById(`check_${c.key}`).checked) sels.push(c.key); });
            return {
                titulo: document.getElementById('swal-titulo').value, descricao: document.getElementById('swal-desc').value,
                inicio: document.getElementById('swal-inicio').value, fim: document.getElementById('swal-fim').value,
                config: { camposTexto: sels, arquivos: { foto: document.getElementById('req_foto').checked, doc: document.getElementById('req_doc').checked } }, status: 'Ativo'
            }
        }
    }).then((res) => {
        if(res.isConfirmed) {
            fetch(URL_API, { method: 'POST', body: JSON.stringify({ action: 'criarEvento', senha: sessionStorage.getItem('admin_token'), dados: res.value }) })
            .then(() => { Swal.fire('Criado!', '', 'success'); carregarEventosAdmin(); });
        }
    });
}

// --- INSCRIÇÕES (LAZY LOAD & BULK) ---
function carregarInscricoes() {
    document.getElementById('lista-inscricoes-admin').innerHTML = '<tr><td colspan="6" style="text-align:center">Carregando...</td></tr>';
    fetch(`${URL_API}?action=getInscricoesAdmin&token=${sessionStorage.getItem('admin_token')}`).then(r => r.json()).then(json => {
        todasInscricoes = json.data.sort((a,b) => new Date(b.data) - new Date(a.data));
        resetEFiltrar();
    });
}

function resetEFiltrar() {
    paginaAtual = 1;
    desmarcarTudo();
    const termo = document.getElementById('filtro-nome').value.toLowerCase();
    const status = document.getElementById('filtro-status').value;
    const eventoId = document.getElementById('filtro-evento').value;

    inscricoesFiltradas = todasInscricoes.filter(i => {
        let d = {}; try { d = JSON.parse(i.dadosJson); } catch(e){}
        const nome = (d.NomeCompleto || "").toLowerCase();
        return (nome.includes(termo) || i.chave.toLowerCase().includes(termo)) &&
               (status === "" || i.status === status) &&
               (eventoId === "" || String(i.eventoId) === String(eventoId));
    });

    // Popula filtro de eventos se vazio
    if(document.getElementById('filtro-evento').options.length <= 1) {
        const select = document.getElementById('filtro-evento');
        Object.keys(mapaEventos).forEach(id => select.innerHTML += `<option value="${id}">${mapaEventos[id]}</option>`);
    }

    document.getElementById('lista-inscricoes-admin').innerHTML = '';
    renderizarProximaPagina();
}

function renderizarProximaPagina() {
    const tbody = document.getElementById('lista-inscricoes-admin');
    const inicio = (paginaAtual - 1) * ITENS_POR_PAGINA;
    const fim = inicio + ITENS_POR_PAGINA;
    const lote = inscricoesFiltradas.slice(inicio, fim);

    lote.forEach(ins => {
        let d = {}; try { d = JSON.parse(ins.dadosJson); } catch(e){}
        const checked = selecionados.has(ins.chave) ? 'checked' : '';
        tbody.innerHTML += `<tr>
            <td><input type="checkbox" class="bulk-check" value="${ins.chave}" ${checked} onclick="toggleCheck('${ins.chave}')"></td>
            <td>${new Date(ins.data).toLocaleDateString()}</td>
            <td><small>${mapaEventos[ins.eventoId]||ins.eventoId}</small></td>
            <td><strong>${d.NomeCompleto||'Aluno'}</strong><br><small>${ins.chave}</small></td>
            <td><span class="badge badge-${ins.status.replace(/\s/g, '')}">${ins.status}</span></td>
            <td>
                <button class="action-btn btn-edit" onclick="mudarStatus('${ins.chave}')"><i class="fa-solid fa-list-check"></i></button>
                ${ins.link_ficha ? `<a href="${ins.link_ficha}" target="_blank" class="action-btn btn-view"><i class="fa-solid fa-file-pdf"></i></a>` : ''}
            </td>
        </tr>`;
    });

    paginaAtual++;
    document.getElementById('btn-load-more').style.display = (fim < inscricoesFiltradas.length) ? 'block' : 'none';
}

// --- LÓGICA BULK ---
function toggleCheck(chave) {
    if(selecionados.has(chave)) selecionados.delete(chave); else selecionados.add(chave);
    atualizarBarraBulk();
}
function toggleAllChecks() {
    const master = document.getElementById('check-all').checked;
    document.querySelectorAll('.bulk-check').forEach(ck => {
        ck.checked = master;
        if(master) selecionados.add(ck.value); else selecionados.delete(ck.value);
    });
    atualizarBarraBulk();
}
function atualizarBarraBulk() {
    const bar = document.getElementById('bulk-bar');
    document.getElementById('bulk-count').innerText = selecionados.size;
    if(selecionados.size > 0) bar.classList.remove('hidden-bar'); else bar.classList.add('hidden-bar');
}
function desmarcarTudo() {
    selecionados.clear();
    document.getElementById('check-all').checked = false;
    document.querySelectorAll('.bulk-check').forEach(ck => ck.checked = false);
    atualizarBarraBulk();
}
function acaoEmMassa(status) {
    Swal.fire({ 
        title: `Marcar ${selecionados.size} como ${status}?`, 
        icon: 'warning', showCancelButton: true, confirmButtonText: 'Sim' 
    }).then((res) => {
        if(res.isConfirmed) {
            Swal.showLoading();
            fetch(URL_API, {
                method: 'POST',
                body: JSON.stringify({ action: 'atualizarStatusEmMassa', senha: sessionStorage.getItem('admin_token'), chaves: Array.from(selecionados), novoStatus: status })
            }).then(() => {
                Swal.fire('Atualizado!', '', 'success');
                // Atualiza localmente para não precisar recarregar tudo
                todasInscricoes.forEach(i => { if(selecionados.has(i.chave)) i.status = status; });
                resetEFiltrar();
            });
        }
    });
}

// --- INSTITUIÇÕES ---
function carregarInstituicoes() {
    fetch(`${URL_API}?action=getInstituicoes`).then(r => r.json()).then(json => {
        const div = document.getElementById('lista-instituicoes'); div.innerHTML = '';
        json.data.forEach(nome => {
            div.innerHTML += `<div style="display:flex; justify-content:space-between; padding:10px; border-bottom:1px solid #eee;">
                <span>${nome}</span><button onclick="removerInst('${nome}')" style="border:none; color:red;"><i class="fa-solid fa-trash"></i></button>
            </div>`;
        });
    });
}
function addInstituicao() {
    const nome = document.getElementById('nova-inst').value;
    if(nome) fetch(URL_API, { method: 'POST', body: JSON.stringify({ action: 'adicionarInstituicao', nome, senha: sessionStorage.getItem('admin_token') }) }).then(() => {
        document.getElementById('nova-inst').value = ''; carregarInstituicoes();
    });
}
function removerInst(nome) {
    fetch(URL_API, { method: 'POST', body: JSON.stringify({ action: 'removerInstituicao', nome, senha: sessionStorage.getItem('admin_token') }) }).then(() => carregarInstituicoes());
}

function mudarStatus(chave) {
    Swal.fire({ title: 'Mudar Status', input: 'select', inputOptions: { 'Pendente': 'Pendente', 'Aprovada': 'Aprovada', 'Rejeitada': 'Rejeitada' }, showCancelButton: true })
    .then((res) => {
        if(res.isConfirmed) fetch(URL_API, { method: 'POST', body: JSON.stringify({ action: 'atualizarStatus', senha: sessionStorage.getItem('admin_token'), chave, novoStatus: res.value }) }).then(() => {
            todasInscricoes.find(i => i.chave === chave).status = res.value; resetEFiltrar();
        });
    });
}
