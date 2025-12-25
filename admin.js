const URL_API = 'https://script.google.com/macros/s/AKfycbyQVT1GE4rLNCq50_YpHXMpkC6NwLTH5vW5kbTShaNFeBiO9DXYyU-S3qq8iVm_YRxtsQ/exec'; // Mesma URL do app.js

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
            sessionStorage.setItem('admin_token', pass); // Salva sessão simples
            carregarEventosAdmin();
        } else {
            Swal.fire('Acesso Negado', 'Senha incorreta', 'error');
        }
    });
}

// --- Navegação entre Abas ---
function switchTab(tabId) {
    // Esconde todas
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(el => el.classList.remove('active'));
    
    // Mostra a selecionada
    document.getElementById(tabId).classList.remove('hidden');
    document.getElementById(tabId).classList.add('active');
    
    // Marca botão
    event.currentTarget.classList.add('active');

    if(tabId === 'tab-inscricoes') carregarInscricoes();
    if(tabId === 'tab-config') carregarConfig();
}

// --- Gestão de Eventos ---
function carregarEventosAdmin() {
    fetch(`${URL_API}?action=getTodosEventos`) // Nova action para pegar até os inativos
        .then(res => res.json())
        .then(json => {
            const tbody = document.getElementById('lista-eventos-admin');
            tbody.innerHTML = '';
            json.data.forEach(ev => {
                tbody.innerHTML += `
                    <tr>
                        <td>${ev.id}</td>
                        <td>${ev.titulo}</td>
                        <td><span class="badge badge-${ev.status}">${ev.status}</span></td>
                        <td>${new Date(ev.fim).toLocaleDateString()}</td>
                        <td>
                            <button class="action-btn btn-edit" onclick='editarEvento(${JSON.stringify(ev)})'><i class="fa-solid fa-pen"></i></button>
                        </td>
                    </tr>
                `;
            });
        });
}

function modalNovoEvento() {
    Swal.fire({
        title: 'Novo Evento',
        html: `
            <input id="swal-titulo" class="swal2-input" placeholder="Título do Evento">
            <input id="swal-desc" class="swal2-input" placeholder="Descrição">
            <label>Data Fim</label><input type="date" id="swal-fim" class="swal2-input">
            <label>Campos Obrigatórios (JSON)</label>
            <textarea id="swal-campos" class="swal2-textarea" placeholder='["NomeCompleto", "CPF"]'>["NomeCompleto", "CPF", "Telefone", "Email", "Instituicao"]</textarea>
        `,
        confirmButtonText: 'Criar Evento',
        preConfirm: () => {
            return {
                titulo: document.getElementById('swal-titulo').value,
                descricao: document.getElementById('swal-desc').value,
                fim: document.getElementById('swal-fim').value,
                campos: document.getElementById('swal-campos').value,
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
            Swal.fire('Sucesso', 'Evento criado!', 'success');
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
            
            // Armazena dados globais para filtro
            window.inscricoesData = json.data;

            json.data.forEach(ins => renderLinhaInscricao(ins, tbody));
        });
}

function renderLinhaInscricao(ins, tbody) {
    // Parseia os dados JSON para mostrar o nome
    let detalhes = {};
    try { detalhes = JSON.parse(ins.dadosJson); } catch(e) {}
    
    const nome = detalhes.NomeCompleto || "Desconhecido";

    tbody.innerHTML += `
        <tr>
            <td>${new Date(ins.data).toLocaleDateString()}</td>
            <td>${ins.eventoId}</td>
            <td><strong>${ins.chave}</strong><br><small>${nome}</small></td>
            <td><span class="badge badge-${ins.status}">${ins.status}</span></td>
            <td>
                <button class="action-btn btn-view" onclick="verDetalhes('${ins.chave}')"><i class="fa-solid fa-eye"></i></button>
                <button class="action-btn btn-edit" onclick="mudarStatus('${ins.chave}')"><i class="fa-solid fa-check"></i></button>
            </td>
        </tr>
    `;
}

function mudarStatus(chave) {
    Swal.fire({
        title: 'Alterar Status',
        input: 'select',
        inputOptions: {
            'Aprovada': 'Aprovada',
            'Rejeitada': 'Rejeitada',
            'Ficha Emitida': 'Ficha Emitida'
        },
        showCancelButton: true,
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
                Swal.fire('Atualizado!', '', 'success');
                carregarInscricoes();
            });
        }
    });
}

function filtrarTabela() {
    const termo = document.getElementById('filtro-nome').value.toLowerCase();
    const status = document.getElementById('filtro-status').value;
    const tbody = document.getElementById('lista-inscricoes-admin');
    tbody.innerHTML = '';

    window.inscricoesData.forEach(ins => {
        let detalhes = {};
        try { detalhes = JSON.parse(ins.dadosJson); } catch(e) {}
        const nome = (detalhes.NomeCompleto || "").toLowerCase();

        const matchNome = nome.includes(termo) || ins.chave.toLowerCase().includes(termo);
        const matchStatus = status === "" || ins.status === status;

        if(matchNome && matchStatus) {
            renderLinhaInscricao(ins, tbody);
        }
    });
}

function logout() {
    sessionStorage.removeItem('admin_token');
    location.reload();
}