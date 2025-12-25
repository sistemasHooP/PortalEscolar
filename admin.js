const URL_API = 'https://script.google.com/macros/s/AKfycbyQVT1GE4rLNCq50_YpHXMpkC6NwLTH5vW5kbTShaNFeBiO9DXYyU-S3qq8iVm_YRxtsQ/exec';

const CAMPOS_DISPONIVEIS = [
    { key: 'NomeCompleto', label: 'Nome Completo' },
    { key: 'CPF', label: 'CPF' },
    { key: 'DataNascimento', label: 'Data de Nascimento' },
    { key: 'Telefone', label: 'Celular (WhatsApp)' },
    { key: 'Email', label: 'E-mail' },
    { key: 'Endereco', label: 'Endereço Completo' },
    { key: 'NomeInstituicao', label: 'Nome da Instituição' },
    { key: 'NomeCurso', label: 'Nome do Curso' },
    { key: 'PeriodoCurso', label: 'Período/Semestre' },
    { key: 'Matricula', label: 'Nº Matrícula' }
];

// Variável global para guardar eventos e nomes (para o filtro)
let mapaEventos = {}; 

// --- Autenticação ---
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

// --- Navegação ---
function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(el => el.classList.remove('active'));
    
    document.getElementById(tabId).classList.remove('hidden');
    document.getElementById(tabId).classList.add('active');
    event.currentTarget.classList.add('active');

    if(tabId === 'tab-inscricoes') carregarInscricoes();
}

// --- Gestão de Eventos ---

function carregarEventosAdmin() {
    fetch(`${URL_API}?action=getTodosEventos`)
        .then(res => res.json())
        .then(json => {
            const tbody = document.getElementById('lista-eventos-admin');
            tbody.innerHTML = '';
            
            // Atualiza mapa global de eventos (ID -> Titulo) para usar no filtro depois
            mapaEventos = {};
            json.data.forEach(ev => mapaEventos[ev.id] = ev.titulo);

            // Ordena decrescente
            const eventosOrdenados = json.data.sort((a, b) => b.id - a.id);

            eventosOrdenados.forEach(ev => {
                const inicio = new Date(ev.inicio).toLocaleDateString();
                const fim = new Date(ev.fim).toLocaleDateString();
                
                tbody.innerHTML += `
                    <tr>
                        <td>#${ev.id}</td>
                        <td>
                            <strong>${ev.titulo}</strong><br>
                            <small class="text-muted"><i class="fa-regular fa-calendar"></i> ${inicio} até ${fim}</small>
                        </td>
                        <td><span class="badge badge-${ev.status}">${ev.status}</span></td>
                        <td>
                            <button class="action-btn btn-edit" title="Bloqueado para integridade" onclick="Swal.fire('Evento Registrado', 'Para manter o histórico, inative este evento e crie um novo.', 'info')">
                                <i class="fa-solid fa-lock"></i>
                            </button>
                        </td>
                    </tr>
                `;
            });
        });
}

// NOVO DESIGN DO MODAL (Organizado para PC)
function modalNovoEvento() {
    // Gera checkboxes em Grid
    let htmlCampos = '<div class="checkbox-grid">';
    CAMPOS_DISPONIVEIS.forEach(c => {
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
        width: '850px', // Mais largo para Desktop
        customClass: { container: 'admin-modal' },
        html: `
            <style>
                .modal-section { text-align: left; margin-bottom: 20px; }
                .modal-label { font-size: 0.85rem; font-weight: 600; color: #64748b; margin-bottom: 5px; display: block; text-transform: uppercase; letter-spacing: 0.5px; }
                .modal-row { display: flex; gap: 20px; }
                .modal-col { flex: 1; }
                
                /* Inputs estilizados */
                .swal2-input, .swal2-textarea { margin: 0 !important; width: 100% !important; box-sizing: border-box; font-size: 0.95rem; }
                
                /* Grid de Checkboxes */
                .checkbox-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
                .checkbox-item { background: #f8fafc; padding: 8px 12px; border-radius: 6px; border: 1px solid #e2e8f0; display: flex; align-items: center; gap: 8px; font-size: 0.9rem; cursor: pointer; transition: all 0.2s; }
                .checkbox-item:hover { border-color: #2563eb; background: #eff6ff; }
                
                /* Box de Documentos */
                .doc-box { background: #eff6ff; padding: 15px; border-radius: 8px; border: 1px dashed #2563eb; display: flex; gap: 20px; }
                .doc-option { display: flex; align-items: center; gap: 8px; font-weight: 500; color: #1e3a8a; cursor: pointer; }
            </style>

            <!-- Seção 1: Dados Básicos -->
            <div class="modal-section">
                <label class="modal-label">Informações Básicas</label>
                <div class="modal-row">
                    <div class="modal-col" style="flex: 2;">
                        <input id="swal-titulo" class="swal2-input" placeholder="Nome do Evento (ex: Transporte 2025.1)">
                    </div>
                    <div class="modal-col" style="flex: 3;">
                        <input id="swal-desc" class="swal2-input" placeholder="Descrição curta para o aluno">
                    </div>
                </div>
            </div>

            <!-- Seção 2: Datas -->
            <div class="modal-section">
                <label class="modal-label">Período de Inscrição</label>
                <div class="modal-row">
                    <div class="modal-col">
                        <label style="font-size:0.8rem">Início</label>
                        <input type="date" id="swal-inicio" class="swal2-input">
                    </div>
                    <div class="modal-col">
                        <label style="font-size:0.8rem">Encerramento</label>
                        <input type="date" id="swal-fim" class="swal2-input">
                    </div>
                </div>
            </div>

            <!-- Seção 3: Documentação -->
            <div class="modal-section">
                <label class="modal-label">Uploads Obrigatórios</label>
                <div class="doc-box">
                    <div class="doc-option">
                        <input type="checkbox" id="req_foto" checked style="transform: scale(1.2);"> 
                        <label for="req_foto">Exigir Foto 3x4</label>
                    </div>
                    <div class="doc-option">
                        <input type="checkbox" id="req_doc" checked style="transform: scale(1.2);"> 
                        <label for="req_doc">Exigir Declaração de Matrícula (PDF)</label>
                    </div>
                </div>
            </div>

            <!-- Seção 4: Campos do Formulário -->
            <div class="modal-section">
                <label class="modal-label">Dados a Preencher</label>
                ${htmlCampos}
            </div>
        `,
        confirmButtonText: '<i class="fa-solid fa-check"></i> Criar Evento',
        confirmButtonColor: '#2563eb',
        showCancelButton: true,
        cancelButtonText: 'Cancelar',
        focusConfirm: false,
        preConfirm: () => {
            const titulo = document.getElementById('swal-titulo').value;
            const inicio = document.getElementById('swal-inicio').value;
            const fim = document.getElementById('swal-fim').value;
            
            if(!titulo || !inicio || !fim) {
                Swal.showValidationMessage('Preencha o título e as datas do evento.');
                return false;
            }

            const selecionados = [];
            CAMPOS_DISPONIVEIS.forEach(c => {
                if(document.getElementById(`check_${c.key}`).checked) selecionados.push(c.key);
            });

            return {
                titulo: titulo,
                descricao: document.getElementById('swal-desc').value,
                inicio: inicio,
                fim: fim,
                config: JSON.stringify({
                    camposTexto: selecionados,
                    arquivos: { 
                        foto: document.getElementById('req_foto').checked, 
                        doc: document.getElementById('req_doc').checked 
                    }
                }),
                status: 'Ativo'
            }
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
    
    // Feedback de carregamento
    Swal.fire({ title: 'Criando...', didOpen: () => Swal.showLoading() });

    fetch(URL_API, { method: 'POST', body: JSON.stringify(payload) })
        .then(res => res.json())
        .then(json => {
            Swal.fire('Sucesso', 'O evento foi publicado!', 'success');
            carregarEventosAdmin();
        });
}

// --- Gestão de Inscrições ---

function carregarInscricoes() {
    const token = sessionStorage.getItem('admin_token');
    
    // Primeiro garante que temos a lista de eventos para o filtro
    if(Object.keys(mapaEventos).length === 0) {
        carregarEventosAdmin(); // Carrega em background se estiver vazio
    }

    // Feedback de carregamento na tabela
    document.getElementById('lista-inscricoes-admin').innerHTML = '<tr><td colspan="5" style="text-align:center">Carregando dados...</td></tr>';

    fetch(`${URL_API}?action=getInscricoesAdmin&token=${token}`)
        .then(res => res.json())
        .then(json => {
            const tbody = document.getElementById('lista-inscricoes-admin');
            tbody.innerHTML = '';
            
            // Ordena por data (recente primeiro)
            const inscricoes = json.data.sort((a, b) => new Date(b.data) - new Date(a.data));
            window.inscricoesData = inscricoes;
            
            // Atualiza o Select de Filtro de Eventos
            atualizarFiltroEventos(inscricoes);

            inscricoes.forEach(ins => renderLinhaInscricao(ins, tbody));
        });
}

// Preenche o <select> com os eventos que existem
function atualizarFiltroEventos(inscricoes) {
    const select = document.getElementById('filtro-evento');
    // Mantém a primeira opção "Todos" e limpa o resto
    select.innerHTML = '<option value="">Todos os Eventos</option>';
    
    // Descobre quais IDs de evento existem nas inscrições
    const eventosIdsUnicos = [...new Set(inscricoes.map(i => i.eventoId))];
    
    eventosIdsUnicos.forEach(id => {
        const nomeEvento = mapaEventos[id] || `Evento #${id}`;
        select.innerHTML += `<option value="${id}">${nomeEvento}</option>`;
    });
}

function renderLinhaInscricao(ins, tbody) {
    let detalhes = {};
    try { detalhes = JSON.parse(ins.dadosJson); } catch(e) {}
    const nome = detalhes.NomeCompleto || "Cidadão";
    
    // Busca nome do evento no mapa
    const nomeEvento = mapaEventos[ins.eventoId] || `ID: ${ins.eventoId}`;

    tbody.innerHTML += `
        <tr>
            <td>${new Date(ins.data).toLocaleDateString()}</td>
            <td><small style="font-weight:bold; color:#2563eb;">${nomeEvento}</small></td>
            <td>
                <strong>${nome}</strong><br>
                <small class="text-muted">Chave: ${ins.chave}</small>
            </td>
            <td><span class="badge badge-${ins.status.replace(/\s/g, '')}">${ins.status}</span></td>
            <td>
                <button class="action-btn btn-edit" onclick="mudarStatus('${ins.chave}')" title="Alterar Status"><i class="fa-solid fa-pen-to-square"></i></button>
                ${ins.foto ? `<a href="${ins.foto}" target="_blank" class="action-btn btn-view" title="Ver Foto"><i class="fa-regular fa-image"></i></a>` : ''}
                ${ins.doc ? `<a href="${ins.doc}" target="_blank" class="action-btn btn-view" title="Ver Documento"><i class="fa-regular fa-file-pdf"></i></a>` : ''}
            </td>
        </tr>
    `;
}

function filtrarTabela() {
    const termo = document.getElementById('filtro-nome').value.toLowerCase();
    const status = document.getElementById('filtro-status').value;
    const eventoId = document.getElementById('filtro-evento').value; // Novo Filtro
    
    const tbody = document.getElementById('lista-inscricoes-admin');
    tbody.innerHTML = '';

    window.inscricoesData.forEach(ins => {
        let detalhes = {};
        try { detalhes = JSON.parse(ins.dadosJson); } catch(e) {}
        const nome = (detalhes.NomeCompleto || "").toLowerCase();
        
        // Lógica de Filtro Combinado
        const matchNome = nome.includes(termo) || ins.chave.toLowerCase().includes(termo);
        const matchStatus = status === "" || ins.status === status;
        const matchEvento = eventoId === "" || String(ins.eventoId) === String(eventoId);

        if(matchNome && matchStatus && matchEvento) {
            renderLinhaInscricao(ins, tbody);
        }
    });
}

function mudarStatus(chave) {
    Swal.fire({
        title: 'Atualizar Status',
        input: 'select',
        inputOptions: {
            'Aprovada': 'Aprovada ✅',
            'Rejeitada': 'Rejeitada ❌',
            'Ficha Emitida': 'Ficha Emitida 📄',
            'Pendente': 'Pendente ⏳'
        },
        showCancelButton: true,
        confirmButtonColor: '#2563eb',
        confirmButtonText: 'Salvar'
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
            }).then(() => {
                Swal.fire('Pronto!', 'Status atualizado com sucesso.', 'success');
                carregarInscricoes(); // Recarrega tabela
            });
        }
    });
}

function logout() {
    sessionStorage.removeItem('admin_token');
    location.reload();
}
