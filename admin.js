const URL_API = 'https://script.google.com/macros/s/AKfycbyQVT1GE4rLNCq50_YpHXMpkC6NwLTH5vW5kbTShaNFeBiO9DXYyU-S3qq8iVm_YRxtsQ/exec';

// Definição de todos os campos possíveis para o Admin escolher
const CAMPOS_DISPONIVEIS = [
    { key: 'NomeCompleto', label: 'Nome Completo' },
    { key: 'CPF', label: 'CPF' },
    { key: 'DataNascimento', label: 'Data de Nascimento' },
    { key: 'Telefone', label: 'Celular (WhatsApp)' },
    { key: 'Email', label: 'E-mail' },
    { key: 'Endereco', label: 'Endereço Completo' },
    { key: 'NomeInstituicao', label: 'Nome da Instituição' },
    { key: 'NomeCurso', label: 'Curso' },
    { key: 'PeriodoCurso', label: 'Período/Semestre' },
    { key: 'Matricula', label: 'Nº Matrícula' }
];

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
            
            // Ordenar por ID decrescente (mais recentes primeiro)
            const eventosOrdenados = json.data.sort((a, b) => b.id - a.id);

            eventosOrdenados.forEach(ev => {
                // Tratamento de datas para exibição
                const inicio = new Date(ev.inicio).toLocaleDateString();
                const fim = new Date(ev.fim).toLocaleDateString();
                
                tbody.innerHTML += `
                    <tr>
                        <td>${ev.id}</td>
                        <td>
                            <strong>${ev.titulo}</strong><br>
                            <small>${inicio} até ${fim}</small>
                        </td>
                        <td><span class="badge badge-${ev.status}">${ev.status}</span></td>
                        <td>
                            <button class="action-btn btn-edit" onclick='alert("Para editar, inative este evento e crie um novo para manter a integridade dos dados.")'><i class="fa-solid fa-lock"></i></button>
                        </td>
                    </tr>
                `;
            });
        });
}

// GERA O MODAL COM CHECKBOXES
function modalNovoEvento() {
    // Gera HTML dos checkboxes de texto
    let htmlCampos = '<div style="text-align:left; max-height:200px; overflow-y:auto; border:1px solid #eee; padding:10px; margin-bottom:10px;">';
    CAMPOS_DISPONIVEIS.forEach(c => {
        htmlCampos += `
            <div style="margin-bottom:5px;">
                <input type="checkbox" id="check_${c.key}" value="${c.key}" checked>
                <label for="check_${c.key}">${c.label}</label>
            </div>
        `;
    });
    htmlCampos += '</div>';

    Swal.fire({
        title: 'Novo Evento',
        width: '600px',
        html: `
            <style>
                .swal-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; text-align: left; }
                .swal-label { font-size: 0.9rem; font-weight: bold; margin-top: 10px; display: block; }
            </style>
            
            <input id="swal-titulo" class="swal2-input" placeholder="Título do Evento (ex: Transporte 2025)">
            <input id="swal-desc" class="swal2-input" placeholder="Descrição Curta">
            
            <div class="swal-grid">
                <div>
                    <label class="swal-label">Data Início</label>
                    <input type="date" id="swal-inicio" class="swal2-input" style="margin:0; width:100%;">
                </div>
                <div>
                    <label class="swal-label">Data Encerramento</label>
                    <input type="date" id="swal-fim" class="swal2-input" style="margin:0; width:100%;">
                </div>
            </div>

            <label class="swal-label">Documentos Obrigatórios (Upload)</label>
            <div style="text-align:left; background:#f0f9ff; padding:10px; border-radius:5px;">
                <input type="checkbox" id="req_foto" checked> <label for="req_foto">Exigir Foto 3x4</label><br>
                <input type="checkbox" id="req_doc" checked> <label for="req_doc">Exigir Declaração de Matrícula (PDF)</label>
            </div>

            <label class="swal-label">Campos do Formulário</label>
            ${htmlCampos}
        `,
        confirmButtonText: 'Criar Evento',
        focusConfirm: false,
        preConfirm: () => {
            // Coletar Texto
            const titulo = document.getElementById('swal-titulo').value;
            const inicio = document.getElementById('swal-inicio').value;
            const fim = document.getElementById('swal-fim').value;
            
            if(!titulo || !inicio || !fim) {
                Swal.showValidationMessage('Preencha título e datas!');
                return false;
            }

            // Coletar Checkboxes de Texto
            const selecionados = [];
            CAMPOS_DISPONIVEIS.forEach(c => {
                if(document.getElementById(`check_${c.key}`).checked) {
                    selecionados.push(c.key);
                }
            });

            // Coletar Checkboxes de Arquivo
            const reqFoto = document.getElementById('req_foto').checked;
            const reqDoc = document.getElementById('req_doc').checked;

            return {
                titulo: titulo,
                descricao: document.getElementById('swal-desc').value,
                inicio: inicio,
                fim: fim,
                // Criamos um objeto de configuração completo
                config: JSON.stringify({
                    camposTexto: selecionados,
                    arquivos: { foto: reqFoto, doc: reqDoc }
                }),
                status: 'Ativo'
            }
        }
    }).then((result) => {
        if (result.isConfirmed) {
            salvarNovoEvento(result.value);
        }
    });
}

function salvarNovoEvento(dados) {
    const payload = {
        action: 'criarEvento',
        senha: sessionStorage.getItem('admin_token'),
        dados: dados
    };
    
    fetch(URL_API, { method: 'POST', body: JSON.stringify(payload) })
        .then(res => res.json())
        .then(json => {
            Swal.fire('Sucesso', 'Evento criado e configurado!', 'success');
            carregarEventosAdmin();
        });
}

// --- Gestão de Inscrições ---
function carregarInscricoes() {
    const token = sessionStorage.getItem('admin_token');
    fetch(`${URL_API}?action=getInscricoesAdmin&token=${token}`)
        .then(res => res.json())
        .then(json => {
            const tbody = document.getElementById('lista-inscricoes-admin');
            tbody.innerHTML = '';
            
            // Ordena por data (recente primeiro)
            const inscricoes = json.data.sort((a, b) => new Date(b.data) - new Date(a.data));
            window.inscricoesData = inscricoes;
            
            inscricoes.forEach(ins => renderLinhaInscricao(ins, tbody));
        });
}

function renderLinhaInscricao(ins, tbody) {
    let detalhes = {};
    try { detalhes = JSON.parse(ins.dadosJson); } catch(e) {}
    const nome = detalhes.NomeCompleto || "Cidadão";

    tbody.innerHTML += `
        <tr>
            <td>${new Date(ins.data).toLocaleDateString()}</td>
            <td>${ins.eventoId}</td>
            <td><strong>${ins.chave}</strong><br><small>${nome}</small></td>
            <td><span class="badge badge-${ins.status}">${ins.status}</span></td>
            <td>
                <button class="action-btn btn-edit" onclick="mudarStatus('${ins.chave}')"><i class="fa-solid fa-pen-to-square"></i></button>
                ${ins.foto ? `<a href="${ins.foto}" target="_blank" class="action-btn btn-view"><i class="fa-regular fa-image"></i></a>` : ''}
                ${ins.doc ? `<a href="${ins.doc}" target="_blank" class="action-btn btn-view"><i class="fa-regular fa-file-pdf"></i></a>` : ''}
            </td>
        </tr>
    `;
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
            }).then(() => {
                Swal.fire('Pronto!', 'Status atualizado.', 'success');
                carregarInscricoes();
            });
        }
    });
}

function logout() {
    sessionStorage.removeItem('admin_token');
    location.reload();
}
