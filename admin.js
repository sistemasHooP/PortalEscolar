const URL_API = 'https://script.google.com/macros/s/AKfycby-rnmBcploCmdEb8QWkMyo1tEanCcPkmNOA_QMlujH0XQvjLeiCCYhkqe7Hqhi6-mo8A/exec';

// Configuração dos campos que o Admin pode escolher (CPF e Email são obrigatórios por padrão)
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
            carregarEventosAdmin();
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
    if(tabId === 'tab-inscricoes') carregarInscricoes();
    if(tabId === 'tab-config') carregarInstituicoes();
}

// ============================================================
// --- GESTÃO DE INSTITUIÇÕES (CONFIGURAÇÕES) ---
// ============================================================

function carregarInstituicoes() {
    const div = document.getElementById('lista-instituicoes');
    div.innerHTML = '<p style="padding:10px; color:#666;">Carregando lista...</p>';
    
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
                        <button onclick="removerInst('${nome}')" style="background:none; border:none; color:#ef4444; cursor:pointer; padding:5px;">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </div>`;
            });
        });
}

function addInstituicao() {
    const input = document.getElementById('nova-inst');
    const nome = input.value.trim();
    
    if(!nome) return Swal.fire('Atenção', 'Digite o nome da instituição.', 'warning');
    
    // Feedback visual
    const btn = event.currentTarget;
    const originalText = btn.innerHTML;
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
        btn.innerHTML = originalText;
        btn.disabled = false;
        carregarInstituicoes();
        Swal.fire({
            toast: true,
            position: 'top-end',
            icon: 'success',
            title: 'Instituição adicionada',
            showConfirmButton: false,
            timer: 1500
        });
    });
}

function removerInst(nome) {
    Swal.fire({
        title: 'Remover Instituição?',
        text: `Deseja remover "${nome}" da lista?`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        confirmButtonText: 'Sim, remover'
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
            
            // Popula mapa global para usar no filtro depois
            mapaEventos = {};
            json.data.forEach(ev => mapaEventos[ev.id] = ev.titulo);
            
            // Ordena eventos (mais novos primeiro)
            const eventosOrdenados = json.data.sort((a, b) => b.id - a.id);

            eventosOrdenados.forEach(ev => {
                const inicio = new Date(ev.inicio).toLocaleDateString();
                const fim = new Date(ev.fim).toLocaleDateString();
                
                // Botão de Toggle Status
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
                            <small class="text-muted"><i class="fa-regular fa-calendar"></i> ${inicio} até ${fim}</small>
                        </td>
                        <td><span class="badge badge-${ev.status}">${ev.status}</span></td>
                        <td style="text-align:right;">
                             ${btnAction}
                             <button class="action-btn btn-edit" title="Bloqueado para edição (Segurança)" onclick="Swal.fire('Evento Registrado', 'Para garantir a integridade dos dados, inative este evento e crie um novo.', 'info')">
                                <i class="fa-solid fa-lock"></i>
                             </button>
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
        confirmButtonText: 'Sim, confirmar'
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
    // Gera HTML dos checkboxes
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
        customClass: { container: 'admin-modal' },
        html: `
            <style>
                .modal-section { text-align: left; margin-bottom: 20px; border-bottom: 1px solid #eee; padding-bottom: 15px; }
                .modal-label { font-size: 0.8rem; font-weight: 700; color: #2563eb; margin-bottom: 8px; display: block; text-transform: uppercase; }
                .modal-row { display: flex; gap: 15px; }
                .modal-col { flex: 1; }
                .swal2-input, .swal2-textarea { margin: 0 !important; width: 100% !important; font-size: 0.9rem; }
                .checkbox-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
                .checkbox-item { background: #f8fafc; padding: 6px 10px; border-radius: 4px; border: 1px solid #e2e8f0; display: flex; align-items: center; gap: 6px; font-size: 0.85rem; }
                .custom-fields-area { background: #fffbeb; padding: 10px; border: 1px dashed #f59e0b; border-radius: 6px; }
                .custom-field-row { display: flex; gap: 5px; margin-bottom: 5px; }
                .info-msg { background: #e0f2fe; color: #0284c7; padding: 10px; border-radius: 6px; font-size: 0.85rem; margin-bottom: 15px; display: flex; align-items: center; gap: 8px; }
            </style>

            <div class="modal-section">
                <label class="modal-label">1. Dados Principais</label>
                <div class="modal-row">
                    <div style="flex:2"><input id="swal-titulo" class="swal2-input" placeholder="Título do Evento"></div>
                    <div style="flex:3"><input id="swal-desc" class="swal2-input" placeholder="Descrição"></div>
                </div>
                
                <label class="modal-label" style="color:#eab308; margin-top:15px;">Mensagem de Alerta (Opcional)</label>
                <textarea id="swal-msg" class="swal2-textarea" placeholder="Ex: Este evento é exclusivo para residentes da Zona Rural." style="height:60px;"></textarea>

                <div class="modal-row" style="margin-top:10px;">
                    <div class="modal-col"><label style="font-size:0.8rem">Início</label><input type="date" id="swal-inicio" class="swal2-input"></div>
                    <div class="modal-col"><label style="font-size:0.8rem">Fim</label><input type="date" id="swal-fim" class="swal2-input"></div>
                </div>
            </div>

            <div class="modal-section">
                <label class="modal-label">2. Documentos Obrigatórios</label>
                <div style="display:flex; gap:20px;">
                    <div><input type="checkbox" id="req_foto" checked> <label for="req_foto">Foto 3x4</label></div>
                    <div><input type="checkbox" id="req_doc" checked> <label for="req_doc">Declaração Escolar</label></div>
                </div>
            </div>

            <div class="modal-section">
                <label class="modal-label">3. Campos do Formulário</label>
                <div class="info-msg">
                    <i class="fa-solid fa-circle-info"></i> CPF e E-mail são obrigatórios e incluídos automaticamente.
                </div>
                ${htmlCampos}
            </div>

            <div class="modal-section">
                <label class="modal-label" style="color:#f59e0b;">4. Perguntas Personalizadas (Opcional)</label>
                <div class="custom-fields-area" id="custom_fields_container">
                    <small style="display:block; margin-bottom:5px; color:#666;">Adicione campos extras (Ex: "Tamanho da Camisa")</small>
                </div>
                <button type="button" class="action-btn btn-view" style="margin-top:5px; width:100%;" id="btn-add-custom">+ Adicionar Campo Extra</button>
            </div>
        `,
        confirmButtonText: 'Publicar Evento',
        showCancelButton: true,
        didOpen: () => {
            const container = document.getElementById('custom_fields_container');
            const btn = document.getElementById('btn-add-custom');
            
            btn.addEventListener('click', () => {
                const div = document.createElement('div');
                div.className = 'custom-field-row';
                div.innerHTML = `
                    <input type="text" class="swal2-input custom-field-input" placeholder="Nome da Pergunta" style="height:35px;">
                    <button type="button" class="action-btn btn-delete" onclick="this.parentElement.remove()">X</button>
                `;
                container.appendChild(div);
            });
        },
        preConfirm: () => {
            const titulo = document.getElementById('swal-titulo').value;
            const inicio = document.getElementById('swal-inicio').value;
            const fim = document.getElementById('swal-fim').value;

            if(!titulo || !inicio || !fim) {
                Swal.showValidationMessage('Preencha título e datas');
                return false;
            }

            // Coletar Checkboxes Padrão
            const selecionados = [];
            CAMPOS_PADRAO.forEach(c => {
                if(document.getElementById(`check_${c.key}`).checked) selecionados.push(c.key);
            });

            // Coletar Personalizados
            const personalizados = [];
            document.querySelectorAll('.custom-field-input').forEach(input => {
                if(input.value.trim()) personalizados.push(input.value.trim());
            });

            return {
                titulo, 
                descricao: document.getElementById('swal-desc').value,
                inicio, 
                fim,
                config: JSON.stringify({
                    mensagemAlerta: document.getElementById('swal-msg').value,
                    camposTexto: selecionados,
                    camposPersonalizados: personalizados,
                    arquivos: { 
                        foto: document.getElementById('req_foto').checked, 
                        doc: document.getElementById('req_doc').checked 
                    }
                }),
                status: 'Ativo'
            };
        }
    }).then((result) => {
        if (result.isConfirmed) salvarNovoEvento(result.value);
    });
}

function salvarNovoEvento(dados) {
    const payload = { 
        action: 'criarEvento', 
        senha: sessionStorage.getItem('admin_token'), 
        dados: dados 
    };
    
    Swal.fire({ title: 'Salvando...', didOpen: () => Swal.showLoading() });
    
    fetch(URL_API, { method: 'POST', body: JSON.stringify(payload) })
        .then(res => res.json())
        .then(() => {
            Swal.fire('Sucesso', 'Evento Criado!', 'success');
            carregarEventosAdmin();
        });
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
            
            // Ordena por data (recente primeiro)
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

    // Botões de Ação Atualizados
    const btnEditar = `<button class="action-btn" style="background:#f59e0b" onclick="abrirEdicao('${ins.chave}')" title="Editar Dados"><i class="fa-solid fa-pen"></i></button>`;
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
        title: 'Editar Dados da Inscrição',
        html: formHtml,
        width: '600px',
        showCancelButton: true,
        confirmButtonText: 'Salvar Alterações',
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
            Swal.fire({ title: 'Atualizando...', didOpen: () => Swal.showLoading() });
            
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
