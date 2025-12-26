const URL_API = 'https://script.google.com/macros/s/AKfycby-rnmBcploCmdEb8QWkMyo1tEanCcPkmNOA_QMlujH0XQvjLeiCCYhkqe7Hqhi6-mo8A/exec';

// Configuração dos campos padrão (CPF e Email são obrigatórios no formulário e não aparecem aqui)
const CAMPOS_PADRAO = [
    { key: 'NomeCompleto', label: 'Nome Completo' },
    { key: 'DataNascimento', label: 'Data de Nascimento' },
    { key: 'Telefone', label: 'Celular (WhatsApp)' },
    { key: 'Endereco', label: 'Endereço Completo' },
    { key: 'NomeInstituicao', label: 'Nome da Instituição' },
    { key: 'NomeCurso', label: 'Nome do Curso' },
    { key: 'PeriodoCurso', label: 'Período/Semestre' },
    { key: 'Matricula', label: 'Nº Matrícula' }
];

let mapaEventos = {}; 
// Instâncias dos gráficos para controlo de atualização
let chartEventosInstance = null;
let chartStatusInstance = null;

// ============================================================
// --- AUTENTICAÇÃO ---
// ============================================================

function realizarLogin(e) {
    e.preventDefault();
    const pass = document.getElementById('admin-pass').value;

    fetch(URL_API, {
        method: 'POST',
        body: JSON.stringify({ action: 'loginAdmin', senha: pass })
    })
    .then(res => res.json())
    .then(json => {
        if(json.auth) {
            document.getElementById('login-screen').classList.add('hidden');
            document.getElementById('admin-panel').classList.remove('hidden');
            sessionStorage.setItem('admin_token', pass);
            // Carrega o Dashboard ao entrar
            carregarDashboard();
        } else {
            Swal.fire('Acesso Negado', 'Senha incorreta', 'error');
        }
    });
}

function logout() {
    sessionStorage.removeItem('admin_token');
    location.reload();
}

// ============================================================
// --- NAVEGAÇÃO (TABS) ---
// ============================================================

function switchTab(tabId) {
    // Esconde todas as abas
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(el => el.classList.remove('active'));
    
    // Mostra a aba selecionada
    document.getElementById(tabId).classList.remove('hidden');
    document.getElementById(tabId).classList.add('active');
    
    // Marca o botão como ativo
    if (event && event.currentTarget) {
        event.currentTarget.classList.add('active');
    }

    // Carrega dados específicos da aba
    if(tabId === 'tab-dashboard') carregarDashboard();
    if(tabId === 'tab-inscricoes') carregarInscricoes();
    if(tabId === 'tab-config') carregarInstituicoes();
}

// ============================================================
// --- DASHBOARD E RELATÓRIOS ---
// ============================================================

function carregarDashboard() {
    const token = sessionStorage.getItem('admin_token');
    
    // Busca dados de Eventos e Inscrições em paralelo para montar os gráficos
    Promise.all([
        fetch(`${URL_API}?action=getTodosEventos`).then(r => r.json()),
        fetch(`${URL_API}?action=getInscricoesAdmin&token=${token}`).then(r => r.json())
    ]).then(([jsonEventos, jsonInscricoes]) => {
        
        // Popula mapa de eventos para uso geral
        mapaEventos = {};
        jsonEventos.data.forEach(ev => mapaEventos[ev.id] = ev.titulo);
        
        // Atualiza Selects da área de Relatório
        atualizarSelectsRelatorio(jsonEventos.data, jsonInscricoes.data);

        // --- Cards de Estatísticas ---
        const total = jsonInscricoes.data.length;
        const aprovados = jsonInscricoes.data.filter(i => i.status.includes('Aprovada') || i.status.includes('Emitida')).length;
        const pendentes = jsonInscricoes.data.filter(i => i.status === 'Pendente').length;

        document.getElementById('stat-total').innerText = total;
        document.getElementById('stat-aprovados').innerText = aprovados;
        document.getElementById('stat-pendentes').innerText = pendentes;

        // --- Processar dados para gráficos ---
        
        // 1. Contagem por Evento
        const contagemEventos = {};
        jsonInscricoes.data.forEach(i => {
            const nome = mapaEventos[i.eventoId] || 'Desconhecido';
            contagemEventos[nome] = (contagemEventos[nome] || 0) + 1;
        });

        // 2. Contagem por Status
        const contagemStatus = {};
        jsonInscricoes.data.forEach(i => {
            contagemStatus[i.status] = (contagemStatus[i.status] || 0) + 1;
        });

        renderizarGraficos(contagemEventos, contagemStatus);
    });
}

function renderizarGraficos(dadosEventos, dadosStatus) {
    // Gráfico de Barras (Inscrições por Evento)
    const ctx1 = document.getElementById('chartEventos').getContext('2d');
    
    // Se já existir gráfico, destrói para criar novo
    if(chartEventosInstance) chartEventosInstance.destroy();
    
    chartEventosInstance = new Chart(ctx1, {
        type: 'bar',
        data: {
            labels: Object.keys(dadosEventos),
            datasets: [{
                label: 'Inscritos',
                data: Object.values(dadosEventos),
                backgroundColor: '#3b82f6',
                borderRadius: 6
            }]
        },
        options: { 
            responsive: true, 
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true } }
        }
    });

    // Gráfico de Rosca (Status das Inscrições)
    const ctx2 = document.getElementById('chartStatus').getContext('2d');
    
    if(chartStatusInstance) chartStatusInstance.destroy();
    
    chartStatusInstance = new Chart(ctx2, {
        type: 'doughnut',
        data: {
            labels: Object.keys(dadosStatus),
            datasets: [{
                data: Object.values(dadosStatus),
                backgroundColor: ['#f59e0b', '#10b981', '#ef4444', '#3b82f6'],
                borderWidth: 0
            }]
        },
        options: { 
            responsive: true, 
            maintainAspectRatio: false,
            plugins: { legend: { position: 'right' } }
        }
    });
}

function atualizarSelectsRelatorio(eventos, inscricoes) {
    const selEvento = document.getElementById('relatorio-evento');
    const selInst = document.getElementById('relatorio-inst');
    
    // Popula Eventos
    selEvento.innerHTML = '<option value="">Selecione o Evento...</option>';
    eventos.forEach(ev => {
        selEvento.innerHTML += `<option value="${ev.id}">${ev.titulo}</option>`;
    });

    // Extrai instituições únicas dos dados JSON das inscrições
    let instituicoes = new Set();
    inscricoes.forEach(ins => {
        try {
            const dados = JSON.parse(ins.dadosJson);
            if(dados.NomeInstituicao) instituicoes.add(dados.NomeInstituicao);
        } catch(e){}
    });
    
    // Popula Instituições
    selInst.innerHTML = '<option value="">Todas as Instituições</option>';
    instituicoes.forEach(inst => {
        selInst.innerHTML += `<option value="${inst}">${inst}</option>`;
    });
}

function gerarRelatorioTransporte() {
    const eventoId = document.getElementById('relatorio-evento').value;
    const instFiltro = document.getElementById('relatorio-inst').value;
    
    if(!eventoId) return Swal.fire('Atenção', 'Selecione um evento para gerar a lista.', 'warning');

    Swal.fire({ title: 'Gerando...', didOpen: () => Swal.showLoading() });

    const token = sessionStorage.getItem('admin_token');
    fetch(`${URL_API}?action=getInscricoesAdmin&token=${token}`)
        .then(res => res.json())
        .then(json => {
            const nomeEvento = mapaEventos[eventoId] || 'Evento';
            
            // Filtra alunos: Evento correto + Instituição (se selecionada) + Status Aprovado/Emitido
            const alunosFiltrados = json.data.filter(i => {
                let dados = {}; try{dados=JSON.parse(i.dadosJson)}catch(e){}
                const matchEvento = String(i.eventoId) === String(eventoId);
                const matchInst = instFiltro === "" || dados.NomeInstituicao === instFiltro;
                const matchStatus = i.status === 'Aprovada' || i.status === 'Ficha Emitida'; 
                return matchEvento && matchInst && matchStatus;
            });

            if(alunosFiltrados.length === 0) {
                Swal.fire('Vazio', 'Nenhum aluno APROVADO encontrado com esses filtros.', 'info');
                return;
            }

            // Gera linhas da tabela
            let linhas = '';
            alunosFiltrados.forEach((aluno, index) => {
                let d = JSON.parse(aluno.dadosJson);
                linhas += `
                    <tr>
                        <td>${index + 1}</td>
                        <td>${d.NomeCompleto}</td>
                        <td>${d.NomeInstituicao || '-'}</td>
                        <td>${d.Endereco || '-'}</td>
                        <td>${d.Bairro || '-'}</td>
                    </tr>
                `;
            });

            // Template HTML para Impressão
            const htmlImpressao = `
                <div class="print-header">
                    <h2>Rota de Transporte Escolar</h2>
                    <p><strong>Evento:</strong> ${nomeEvento}</p>
                    <p><strong>Instituição:</strong> ${instFiltro || 'Todas'}</p>
                    <p><strong>Total de Alunos:</strong> ${alunosFiltrados.length}</p>
                </div>
                <table class="print-table">
                    <thead>
                        <tr>
                            <th style="width:30px">#</th>
                            <th>Nome do Aluno</th>
                            <th>Instituição</th>
                            <th>Endereço</th>
                            <th>Bairro</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${linhas}
                    </tbody>
                </table>
                <div style="margin-top:40px; border-top:1px solid #000; padding-top:10px; display:flex; justify-content:space-between; font-size:12px;">
                    <span>Motorista: __________________________________________</span>
                    <span>Data: ____/____/_______</span>
                </div>
            `;

            document.getElementById('area-impressao').innerHTML = htmlImpressao;
            Swal.close();
            
            // Abre o diálogo de impressão do navegador
            setTimeout(() => window.print(), 500);
        });
}

// ============================================================
// --- GESTÃO DE INSTITUIÇÕES ---
// ============================================================

function carregarInstituicoes() {
    const div = document.getElementById('lista-instituicoes');
    div.innerHTML = '<p style="padding:10px; color:#666;">Carregando...</p>';
    
    fetch(`${URL_API}?action=getInstituicoes`)
        .then(res => res.json())
        .then(json => {
            div.innerHTML = '';
            if(!json.data || json.data.length === 0) {
                div.innerHTML = '<p style="padding:10px; color:#666;">Nenhuma instituição cadastrada.</p>';
                return;
            }
            
            json.data.forEach(nome => {
                div.innerHTML += `
                    <div style="display:flex; justify-content:space-between; padding:10px; border-bottom:1px solid #eee; align-items:center;">
                        <span>${nome}</span>
                        <button onclick="removerInst('${nome}')" style="background:none; border:none; color:#ef4444; cursor:pointer;" title="Remover">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </div>`;
            });
        });
}

function addInstituicao() {
    const input = document.getElementById('nova-inst');
    const nome = input.value.trim();
    
    if(!nome) return Swal.fire('Atenção', 'Digite o nome.', 'warning');
    
    const btn = event.currentTarget;
    const original = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
    btn.disabled = true;

    fetch(URL_API, { 
        method: 'POST', 
        body: JSON.stringify({ 
            action: 'adicionarInstituicao', 
            nome: nome,
            senha: sessionStorage.getItem('admin_token') 
        })
    })
    .then(res => res.json())
    .then(() => {
        input.value = '';
        btn.innerHTML = original;
        btn.disabled = false;
        carregarInstituicoes();
        Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Adicionado', showConfirmButton: false, timer: 1500 });
    });
}

function removerInst(nome) {
    Swal.fire({
        title: 'Remover?',
        text: nome,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        confirmButtonText: 'Sim'
    }).then((result) => {
        if (result.isConfirmed) {
            fetch(URL_API, { 
                method: 'POST', 
                body: JSON.stringify({ 
                    action: 'removerInstituicao', 
                    nome: nome,
                    senha: sessionStorage.getItem('admin_token') 
                })
            })
            .then(() => {
                carregarInstituicoes();
                Swal.fire('Removido!', '', 'success');
            });
        }
    });
}

// ============================================================
// --- GESTÃO DE EVENTOS ---
// ============================================================

function carregarEventosAdmin() {
    fetch(`${URL_API}?action=getTodosEventos`)
        .then(res => res.json())
        .then(json => {
            const tbody = document.getElementById('lista-eventos-admin');
            tbody.innerHTML = '';
            mapaEventos = {};
            
            json.data.sort((a,b)=>b.id-a.id).forEach(ev=>{
                mapaEventos[ev.id]=ev.titulo;
                
                // Botão Toggle (Ativar/Inativar)
                let btnAction = '';
                if(ev.status === 'Ativo') {
                    btnAction = `<button class="action-btn btn-status-toggle active" onclick="toggleStatusEvento('${ev.id}', 'Inativo')" title="Encerrar Evento"><i class="fa-solid fa-pause"></i> Inativar</button>`;
                } else {
                    btnAction = `<button class="action-btn btn-status-toggle inactive" onclick="toggleStatusEvento('${ev.id}', 'Ativo')" title="Reabrir Evento"><i class="fa-solid fa-play"></i> Ativar</button>`;
                }

                tbody.innerHTML += `
                    <tr>
                        <td>#${ev.id}</td>
                        <td>
                            <strong>${ev.titulo}</strong><br>
                            <small class="text-muted"><i class="fa-regular fa-calendar"></i> ${new Date(ev.inicio).toLocaleDateString()} até ${new Date(ev.fim).toLocaleDateString()}</small>
                        </td>
                        <td><span class="badge badge-${ev.status}">${ev.status}</span></td>
                        <td style="text-align:right;">
                            ${btnAction}
                            <button class="action-btn btn-edit" title="Bloqueado (Segurança)" onclick="Swal.fire('Info', 'Crie um novo evento para alterar dados.', 'info')"><i class="fa-solid fa-lock"></i></button>
                        </td>
                    </tr>
                `;
            });
        });
}

function toggleStatusEvento(id, novoStatus) {
    Swal.fire({
        title: `Definir como ${novoStatus}?`,
        text: novoStatus === 'Inativo' ? "O evento não aparecerá mais para os alunos." : "O evento ficará visível novamente.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: novoStatus === 'Inativo' ? '#ef4444' : '#22c55e',
        confirmButtonText: 'Sim'
    }).then((result) => {
        if (result.isConfirmed) {
            Swal.fire({ title: 'Atualizando...', didOpen: () => Swal.showLoading() });
            fetch(URL_API, {
                method: 'POST',
                body: JSON.stringify({
                    action: 'alterarStatusEvento',
                    senha: sessionStorage.getItem('admin_token'),
                    id: id,
                    novoStatus: novoStatus
                })
            }).then(() => {
                Swal.fire('Atualizado!', '', 'success');
                carregarEventosAdmin();
            });
        }
    });
}

function modalNovoEvento() {
    let htmlCampos = '<div class="checkbox-grid">';
    CAMPOS_PADRAO.forEach(c => {
        htmlCampos += `
            <div class="checkbox-item">
                <input type="checkbox" id="check_${c.key}" value="${c.key}" checked>
                <label for="check_${c.key}">${c.label}</label>
            </div>
        `;
    });
    htmlCampos += '</div>';

    Swal.fire({
        title: 'Criar Novo Evento',
        width: '900px',
        html: `
            <style>.modal-label{display:block;text-align:left;margin-top:10px;font-weight:bold;font-size:0.9rem;}</style>
            <input id="swal-titulo" class="swal2-input" placeholder="Título">
            <input id="swal-desc" class="swal2-input" placeholder="Descrição">
            <label class="modal-label" style="color:#eab308;">Mensagem de Alerta (Opcional)</label>
            <textarea id="swal-msg" class="swal2-textarea" placeholder="Ex: Apenas para moradores da Zona Rural" style="margin-top:5px;"></textarea>
            <div style="display:flex; gap:10px; margin-top:10px;">
                <div style="flex:1"><label class="modal-label">Início</label><input type="date" id="swal-inicio" class="swal2-input"></div>
                <div style="flex:1"><label class="modal-label">Fim</label><input type="date" id="swal-fim" class="swal2-input"></div>
            </div>
            <label class="modal-label">Campos</label>
            <div style="background:#e0f2fe;color:#0284c7;padding:10px;border-radius:6px;font-size:0.85rem;margin-bottom:10px;">CPF e E-mail são obrigatórios.</div>
            ${htmlCampos}
            <label class="modal-label">Uploads</label>
            <div style="display:flex; gap:20px; margin-top:5px;">
                <div><input type="checkbox" id="req_foto" checked> Foto 3x4</div>
                <div><input type="checkbox" id="req_doc" checked> Declaração</div>
            </div>
            <label class="modal-label" style="color:#f59e0b;">Perguntas Personalizadas</label>
            <div class="custom-fields-area" id="custom_fields_container"></div>
            <button type="button" class="action-btn btn-view" style="margin-top:5px; width:100%;" id="btn-add-custom">+ Adicionar Campo</button>
        `,
        confirmButtonText: 'Criar',
        showCancelButton: true,
        didOpen: () => {
            const container = document.getElementById('custom_fields_container');
            const btn = document.getElementById('btn-add-custom');
            btn.addEventListener('click', () => {
                const div = document.createElement('div');
                div.className = 'custom-field-row';
                div.innerHTML = `<input type="text" class="swal2-input custom-field-input" placeholder="Nome da Pergunta" style="height:35px;"><button type="button" class="action-btn btn-delete" onclick="this.parentElement.remove()">X</button>`;
                container.appendChild(div);
            });
        },
        preConfirm: () => {
            const selecionados = [];
            CAMPOS_PADRAO.forEach(c => { if(document.getElementById(`check_${c.key}`).checked) selecionados.push(c.key); });
            const personalizados = [];
            document.querySelectorAll('.custom-field-input').forEach(input => { if(input.value.trim()) personalizados.push(input.value.trim()); });
            
            return {
                titulo: document.getElementById('swal-titulo').value,
                descricao: document.getElementById('swal-desc').value,
                inicio: document.getElementById('swal-inicio').value,
                fim: document.getElementById('swal-fim').value,
                config: JSON.stringify({
                    mensagemAlerta: document.getElementById('swal-msg').value,
                    camposTexto: selecionados,
                    camposPersonalizados: personalizados,
                    arquivos: { foto: document.getElementById('req_foto').checked, doc: document.getElementById('req_doc').checked }
                }),
                status: 'Ativo'
            }
        }
    }).then(res => { if(res.isConfirmed) salvarNovoEvento(res.value); });
}

function salvarNovoEvento(dados) {
    const payload = { action: 'criarEvento', senha: sessionStorage.getItem('admin_token'), dados: dados };
    Swal.fire({ title: 'Salvando...', didOpen: () => Swal.showLoading() });
    fetch(URL_API, { method: 'POST', body: JSON.stringify(payload) }).then(() => { Swal.fire('Sucesso', '', 'success'); carregarEventosAdmin(); });
}

// ============================================================
// --- GESTÃO DE INSCRIÇÕES E PDF ---
// ============================================================

function carregarInscricoes() {
    const token = sessionStorage.getItem('admin_token');
    
    // Se mapa vazio, carrega eventos primeiro para ter os nomes
    if(Object.keys(mapaEventos).length === 0) carregarEventosAdmin();
    
    document.getElementById('lista-inscricoes-admin').innerHTML = '<tr><td colspan="5" style="text-align:center">Carregando dados...</td></tr>';

    fetch(`${URL_API}?action=getInscricoesAdmin&token=${token}`)
        .then(res => res.json())
        .then(json => {
            const tbody = document.getElementById('lista-inscricoes-admin');
            tbody.innerHTML = '';
            
            const inscricoes = json.data.sort((a, b) => new Date(b.data) - new Date(a.data));
            window.inscricoesData = inscricoes;
            
            atualizarFiltroEventos(inscricoes);
            
            inscricoes.forEach(ins => renderLinhaInscricao(ins, tbody));
        });
}

function atualizarFiltroEventos(inscricoes) {
    const select = document.getElementById('filtro-evento');
    select.innerHTML = '<option value="">Todos os Eventos</option>';
    
    const ids = [...new Set(inscricoes.map(i => i.eventoId))];
    ids.forEach(id => {
        select.innerHTML += `<option value="${id}">${mapaEventos[id] || id}</option>`;
    });
}

function renderLinhaInscricao(ins, tbody) {
    let detalhes = {};
    try { detalhes = JSON.parse(ins.dadosJson); } catch(e) {}
    const nome = detalhes.NomeCompleto || "Aluno";
    const nomeEvento = mapaEventos[ins.eventoId] || ins.eventoId;

    // Botão PDF / Ficha
    let btnPDF = `<button class="action-btn btn-view" style="background:#4f46e5" onclick="gerarFicha('${ins.chave}')" title="Gerar PDF"><i class="fa-solid fa-file-invoice"></i> PDF</button>`;
    
    if(ins.link_ficha) {
        btnPDF = `<a href="${ins.link_ficha}" target="_blank" class="action-btn btn-view" style="background:#059669" title="Baixar Ficha"><i class="fa-solid fa-download"></i> Ficha</a>`;
    }

    // Botões de Ação
    const btnEditar = `<button class="action-btn" style="background:#f59e0b" onclick="abrirEdicao('${ins.chave}')" title="Editar"><i class="fa-solid fa-pen"></i></button>`;
    const btnStatus = `<button class="action-btn btn-edit" onclick="mudarStatus('${ins.chave}')" title="Mudar Status"><i class="fa-solid fa-list-check"></i></button>`;

    tbody.innerHTML += `
        <tr>
            <td>${new Date(ins.data).toLocaleDateString()}</td>
            <td><small style="color:#2563eb; font-weight:bold;">${nomeEvento}</small></td>
            <td>
                <strong>${nome}</strong><br>
                <small class="text-muted">Chave: ${ins.chave}</small>
            </td>
            <td><span class="badge badge-${ins.status.replace(/\s/g, '')}">${ins.status}</span></td>
            <td>
                <div style="display:flex; gap:5px;">
                    ${btnEditar}
                    ${btnStatus}
                    ${btnPDF} 
                    ${ins.doc ? `<a href="${ins.doc}" target="_blank" class="action-btn btn-view"><i class="fa-solid fa-paperclip"></i></a>` : ''}
                </div>
            </td>
        </tr>
    `;
}

// --- FUNÇÃO PARA EDITAR DADOS (NOVO) ---
function abrirEdicao(chave) {
    const inscricao = window.inscricoesData.find(i => i.chave === chave);
    if(!inscricao) return;
    
    let dados = {};
    try { dados = JSON.parse(inscricao.dadosJson); } catch(e) {}

    let formHtml = '<div style="text-align:left; max-height:400px; overflow-y:auto; padding-right:5px;">';
    for (const [key, value] of Object.entries(dados)) {
        formHtml += `
            <label style="font-size:0.8rem; font-weight:bold; color:#64748b; display:block; margin-top:10px;">${key}</label>
            <input type="text" id="edit_${key}" value="${value}" class="swal2-input" style="margin-top:5px; height:35px;">
        `;
    }
    formHtml += '</div>';

    Swal.fire({
        title: 'Editar Dados',
        html: formHtml,
        width: '600px',
        showCancelButton: true,
        confirmButtonText: 'Salvar',
        confirmButtonColor: '#2563eb',
        preConfirm: () => {
            const novosDados = {};
            for (const key of Object.keys(dados)) {
                const el = document.getElementById(`edit_${key}`);
                if(el) novosDados[key] = el.value;
            }
            return novosDados;
        }
    }).then((result) => {
        if (result.isConfirmed) {
            Swal.fire({ title: 'Salvando...', didOpen: () => Swal.showLoading() });
            fetch(URL_API, {
                method: 'POST',
                body: JSON.stringify({
                    action: 'editarInscricao',
                    senha: sessionStorage.getItem('admin_token'),
                    chave: chave,
                    novosDados: result.value
                })
            })
            .then(res => res.json())
            .then(json => {
                if(json.status === 'success') {
                    Swal.fire('Sucesso', 'Dados atualizados!', 'success')
                        .then(() => carregarInscricoes());
                } else {
                    Swal.fire('Erro', json.message, 'error');
                }
            });
        }
    });
}

function gerarFicha(chave) {
    Swal.fire({
        title: 'Gerar Ficha Oficial?',
        text: "Isso criará um PDF no Drive e mudará o status para 'Ficha Emitida'.",
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Sim, Gerar PDF'
    }).then((result) => {
        if(result.isConfirmed) {
            Swal.fire({ title: 'Gerando PDF...', text:'Isso pode levar uns 5 segundos.', didOpen: () => Swal.showLoading() });
            
            fetch(URL_API, {
                method: 'POST',
                body: JSON.stringify({
                    action: 'gerarFichaPDF',
                    senha: sessionStorage.getItem('admin_token'),
                    chave: chave
                })
            })
            .then(res => res.json())
            .then(json => {
                if(json.status === 'success') {
                    Swal.fire('Sucesso', 'Ficha gerada! A página irá atualizar.', 'success')
                    .then(() => carregarInscricoes());
                } else {
                    Swal.fire('Erro', json.message, 'error');
                }
            });
        }
    });
}

function filtrarTabela() {
    const termo = document.getElementById('filtro-nome').value.toLowerCase();
    const status = document.getElementById('filtro-status').value;
    const eventoId = document.getElementById('filtro-evento').value; 
    
    const tbody = document.getElementById('lista-inscricoes-admin');
    tbody.innerHTML = '';

    window.inscricoesData.forEach(ins => {
        let detalhes = {}; try { detalhes = JSON.parse(ins.dadosJson); } catch(e) {}
        const nome = (detalhes.NomeCompleto || "").toLowerCase();
        
        if(
            (nome.includes(termo) || ins.chave.toLowerCase().includes(termo)) &&
            (status === "" || ins.status === status) &&
            (eventoId === "" || String(ins.eventoId) === String(eventoId))
        ) { renderLinhaInscricao(ins, tbody); }
    });
}

function mudarStatus(chave) {
    Swal.fire({
        title: 'Mudar Status',
        input: 'select',
        inputOptions: { 'Pendente': 'Pendente', 'Aprovada': 'Aprovada', 'Rejeitada': 'Rejeitada' },
        showCancelButton: true
    }).then((result) => {
        if (result.isConfirmed) {
            fetch(URL_API, {
                method: 'POST',
                body: JSON.stringify({
                    action: 'atualizarStatus',
                    senha: sessionStorage.getItem('admin_token'),
                    chave: chave,
                    novoStatus: result.value
                })
            }).then(() => { Swal.fire('Ok', '', 'success'); carregarInscricoes(); });
        }
    });
}
