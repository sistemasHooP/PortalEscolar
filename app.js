/**
 * Portal Educacional - Frontend Logic
 * Integração com Google Apps Script e SweetAlert2
 */

// ⚠️ CONFIGURAÇÃO OBRIGATÓRIA ⚠️
// Substitua pela URL da sua Web App do Google Apps Script
const URL_API = 'https://script.google.com/macros/s/AKfycbyQVT1GE4rLNCq50_YpHXMpkC6NwLTH5vW5kbTShaNFeBiO9DXYyU-S3qq8iVm_YRxtsQ/exec';

// Dicionário de Definições dos Campos
// Mapeia o nome técnico (no banco) para o rótulo visual e tipo de input
const CAMPO_DEFS = {
    'NomeCompleto': { label: 'Nome Completo', type: 'text', placeholder: 'Digite seu nome completo' },
    'CPF': { label: 'CPF', type: 'text', placeholder: '000.000.000-00' },
    'DataNascimento': { label: 'Data de Nascimento', type: 'date', placeholder: '' },
    'Telefone': { label: 'Celular (WhatsApp)', type: 'tel', placeholder: '(00) 00000-0000' },
    'TelefoneEmergencia': { label: 'Telefone de Emergência', type: 'tel', placeholder: '(00) 00000-0000' },
    'Email': { label: 'E-mail Pessoal', type: 'email', placeholder: 'seu@email.com' },
    'Endereco': { label: 'Endereço Residencial', type: 'text', placeholder: 'Rua, Número, Complemento' },
    'Bairro': { label: 'Bairro', type: 'text', placeholder: '' },
    'Cidade': { label: 'Cidade', type: 'text', placeholder: '' },
    'NomeInstituicao': { label: 'Instituição de Ensino', type: 'text', placeholder: 'Ex: UFRN, IFRN, Unp' },
    'NomeCurso': { label: 'Curso', type: 'text', placeholder: 'Ex: Direito, Medicina' },
    'PeriodoCurso': { label: 'Período/Semestre', type: 'text', placeholder: 'Ex: 3º Período' },
    'Matricula': { label: 'Nº Matrícula', type: 'text', placeholder: '' }
};

// --- Inicialização ---
document.addEventListener('DOMContentLoaded', () => {
    carregarEventos();
});

// --- Funções de UI (Interface) ---

// Controla o Overlay de Carregamento
function toggleLoader(show, msg = "Processando...") {
    const loader = document.getElementById('loader-overlay');
    const txt = document.getElementById('loader-text');
    
    if (txt) txt.innerText = msg;
    
    if (show) {
        loader.classList.remove('hidden');
    } else {
        loader.classList.add('hidden');
    }
}

// Alerta de Sucesso (SweetAlert2)
function showSuccess(titulo, texto, callback = null) {
    Swal.fire({
        icon: 'success',
        title: titulo,
        html: texto,
        confirmButtonColor: '#2563eb',
        confirmButtonText: 'Entendido'
    }).then((result) => {
        if (callback) callback();
    });
}

// Alerta de Erro (SweetAlert2)
function showError(titulo, texto) {
    Swal.fire({
        icon: 'error',
        title: titulo,
        text: texto,
        confirmButtonColor: '#d33',
        confirmButtonText: 'Fechar'
    });
}

// --- Lógica Principal ---

// Busca eventos ativos na API
function carregarEventos() {
    toggleLoader(true, "Buscando eventos disponíveis...");
    
    fetch(`${URL_API}?action=getEventosAtivos`)
        .then(res => res.json())
        .then(json => {
            toggleLoader(false);
            const container = document.getElementById('cards-container');
            container.innerHTML = '';
            
            if (!json.data || json.data.length === 0) {
                container.innerHTML = `
                    <div style="text-align:center; padding: 2rem; color: #64748b;">
                        <i class="fa-regular fa-folder-open" style="font-size: 3rem; margin-bottom: 1rem;"></i>
                        <p>Nenhum evento com inscrições abertas no momento.</p>
                    </div>`;
                return;
            }
            
            json.data.forEach(evento => {
                const div = document.createElement('div');
                div.className = 'card fade-in';
                div.innerHTML = `
                    <h3>${evento.titulo}</h3>
                    <p>${evento.descricao}</p>
                    <small><i class="fa-regular fa-clock"></i> Encerra em: ${formatarData(evento.fim)}</small>
                    <button class="btn-primary" onclick='abrirInscricao(${JSON.stringify(evento)})'>
                        Realizar Inscrição <i class="fa-solid fa-arrow-right"></i>
                    </button>
                `;
                container.appendChild(div);
            });
        })
        .catch(err => {
            console.error(err);
            toggleLoader(false);
            showError("Erro de Conexão", "Não foi possível conectar ao servidor. Verifique sua internet.");
        });
}

// Prepara o formulário para o evento selecionado
function abrirInscricao(evento) {
    // Troca de telas
    document.getElementById('lista-eventos').classList.add('hidden');
    document.getElementById('area-consulta').classList.add('hidden');
    document.getElementById('area-inscricao').classList.remove('hidden');
    
    // Configura cabeçalho
    document.getElementById('titulo-evento').innerText = evento.titulo;
    document.getElementById('form-inscricao').dataset.idEvento = evento.id;

    // Gera campos dinâmicos
    const areaCampos = document.getElementById('campos-dinamicos');
    areaCampos.innerHTML = '';
    
    let listaCampos = [];
    try {
        listaCampos = typeof evento.campos === 'string' ? JSON.parse(evento.campos) : evento.campos;
    } catch (e) {
        console.error("Erro ao ler campos do evento", e);
        showError("Erro de Configuração", "Os campos deste evento estão mal configurados.");
        return;
    }
    
    listaCampos.forEach(campoKey => {
        if(CAMPO_DEFS[campoKey]) {
            const def = CAMPO_DEFS[campoKey];
            const div = document.createElement('div');
            div.innerHTML = `
                <label for="${campoKey}">${def.label}</label>
                <input type="${def.type}" 
                       name="${campoKey}" 
                       id="${campoKey}" 
                       placeholder="${def.placeholder || ''}" 
                       required>
            `;
            areaCampos.appendChild(div);
        }
    });

    // Rola para o topo
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Processa o envio do formulário
async function enviarInscricao(e) {
    e.preventDefault();
    
    // Confirmação do Usuário
    const confirmacao = await Swal.fire({
        title: 'Confirmar envio?',
        text: "Verifique se todos os dados e documentos estão corretos. Não será possível editar depois.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#2563eb',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'Sim, enviar inscrição!',
        cancelButtonText: 'Revisar'
    });

    if (!confirmacao.isConfirmed) return;

    toggleLoader(true, "Enviando seus dados e documentos... Isso pode levar alguns segundos.");

    // Coleta dados dos inputs
    const inputs = document.querySelectorAll('#campos-dinamicos input');
    let dadosCampos = {};
    inputs.forEach(input => dadosCampos[input.name] = input.value);

    // Coleta Arquivos
    const fileFoto = document.getElementById('file-foto').files[0];
    const fileDoc = document.getElementById('file-doc').files[0];

    try {
        // Conversão para Base64
        const fotoBase64 = await toBase64(fileFoto);
        const docBase64 = await toBase64(fileDoc);

        const payload = {
            action: 'novaInscricao',
            eventoId: document.getElementById('form-inscricao').dataset.idEvento,
            campos: dadosCampos,
            arquivos: {
                foto: { data: fotoBase64, mime: fileFoto.type },
                doc: { data: docBase64, mime: fileDoc.type }
            }
        };

        // Envio para API
        fetch(URL_API, {
            method: 'POST',
            body: JSON.stringify(payload)
        })
        .then(res => res.json())
        .then(json => {
            toggleLoader(false);
            if(json.status === 'success') {
                showSuccess(
                    'Inscrição Recebida!', 
                    `Sua inscrição foi realizada com sucesso.<br><br>
                     Sua Chave Única é: <br>
                     <strong style="font-size: 1.5rem; color: #2563eb;">${json.chave}</strong><br><br>
                     Tire um print ou anote essa chave para consultar o status depois.`,
                    () => location.reload()
                );
            } else {
                showError('Erro no Servidor', json.message);
            }
        })
        .catch(err => {
            toggleLoader(false);
            console.error(err);
            showError('Erro de Rede', 'Houve uma falha na comunicação. Tente novamente.');
        });

    } catch (error) {
        toggleLoader(false);
        console.error(error);
        showError('Erro Técnico', 'Falha ao processar os arquivos. Verifique se são PDFs ou imagens válidas.');
    }
}

// Consulta status da inscrição
function consultarChave() {
    const chave = document.getElementById('busca-chave').value.trim();
    if(!chave) {
        showError("Atenção", "Digite sua chave de inscrição.");
        return;
    }

    toggleLoader(true, "Consultando base de dados...");

    fetch(`${URL_API}?action=consultarInscricao&chave=${chave}`)
        .then(res => res.json())
        .then(json => {
            toggleLoader(false);
            const div = document.getElementById('resultado-busca');
            
            if(json.status === 'success') {
                const dataFormatada = formatarData(json.data.data_inscricao);
                
                // Define cor do status
                let corStatus = '#f59e0b'; // Pendente (Laranja)
                if(json.data.situacao.includes('Aprovada') || json.data.situacao.includes('Emitida')) corStatus = '#10b981'; // Verde
                if(json.data.situacao.includes('Rejeitada')) corStatus = '#ef4444'; // Vermelho

                div.innerHTML = `
                    <div class="card fade-in" style="background:#f0f9ff; border-left: 5px solid ${corStatus}; text-align: left; margin-top: 15px;">
                        <h3 style="color: #1e293b; margin-bottom: 10px;">Status da Inscrição</h3>
                        <p><strong>Situação:</strong> <span style="color:${corStatus}; font-weight:bold;">${json.data.situacao}</span></p>
                        <p><strong>Data Envio:</strong> ${dataFormatada}</p>
                        ${json.data.link_ficha ? `<br><a href="${json.data.link_ficha}" target="_blank" class="btn-primary" style="text-decoration:none; padding: 5px 10px; font-size: 0.9rem;">Baixar Ficha PDF <i class="fa-solid fa-download"></i></a>` : ''}
                    </div>
                `;
            } else {
                div.innerHTML = `<p style="color:#ef4444; margin-top:10px;"><i class="fa-solid fa-circle-exclamation"></i> ${json.message}</p>`;
            }
        })
        .catch(err => {
            toggleLoader(false);
            showError("Erro", "Não foi possível consultar. Tente novamente.");
        });
}

// --- Utilitários ---

function voltarHome() {
    document.getElementById('area-inscricao').classList.add('hidden');
    document.getElementById('area-consulta').classList.remove('hidden');
    document.getElementById('lista-eventos').classList.remove('hidden');
    document.getElementById('cards-container').classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Formata data ISO para PT-BR
function formatarData(dataString) {
    if(!dataString) return '--/--/----';
    const data = new Date(dataString);
    return data.toLocaleDateString('pt-BR');
}

// Converte Arquivo para Base64 (Promise)
const toBase64 = file => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = error => reject(error);
});
