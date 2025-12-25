/**
 * Portal Educacional - App Logic v4.1
 * Suporte a Campos Personalizados, Download de PDF e Máscaras de Input
 */

// ⚠️ URL da API (Já configurada)
const URL_API = 'https://script.google.com/macros/s/AKfycbyQVT1GE4rLNCq50_YpHXMpkC6NwLTH5vW5kbTShaNFeBiO9DXYyU-S3qq8iVm_YRxtsQ/exec';

// Definição dos Campos Padrão (Mapeamento Visual)
const CAMPO_DEFS = {
    'NomeCompleto': { label: 'Nome Completo', type: 'text', placeholder: 'Digite seu nome completo' },
    'CPF': { label: 'CPF', type: 'text', placeholder: '000.000.000-00', mask: 'cpf' }, // Adicionado flag de máscara
    'DataNascimento': { label: 'Data de Nascimento', type: 'date', placeholder: '' },
    'Telefone': { label: 'Celular (WhatsApp)', type: 'tel', placeholder: '(00) 00000-0000', mask: 'tel' }, // Adicionado flag de máscara
    'Email': { label: 'E-mail Pessoal', type: 'email', placeholder: 'seu@email.com' },
    'Endereco': { label: 'Endereço Residencial', type: 'text', placeholder: 'Rua, Número, Complemento' },
    'NomeInstituicao': { label: 'Instituição de Ensino', type: 'text', placeholder: 'Ex: Universidade X' },
    'NomeCurso': { label: 'Curso', type: 'text', placeholder: 'Ex: Engenharia' },
    'PeriodoCurso': { label: 'Período/Semestre', type: 'text', placeholder: 'Ex: 3º Período' },
    'Matricula': { label: 'Nº Matrícula', type: 'text', placeholder: '' }
};

document.addEventListener('DOMContentLoaded', () => { carregarEventos(); });

// --- Funções de UI ---

function toggleLoader(show, msg = "Processando...") {
    const el = document.getElementById('loader-overlay');
    if(show) {
        document.getElementById('loader-text').innerText = msg;
        el.classList.remove('hidden');
    } else {
        el.classList.add('hidden');
    }
}

function showSuccess(titulo, html) {
    Swal.fire({
        icon: 'success',
        title: titulo,
        html: html,
        confirmButtonColor: '#2563eb',
        confirmButtonText: 'OK'
    }).then(() => location.reload());
}

function showError(titulo, text) {
    Swal.fire({ icon: 'error', title, text, confirmButtonColor: '#d33' });
}

// --- Funções de Máscara (Novas) ---

function aplicarMascaraCPF(value) {
    return value
        .replace(/\D/g, '') // Remove não números
        .replace(/(\d{3})(\d)/, '$1.$2') // Ponto após 3º digito
        .replace(/(\d{3})(\d)/, '$1.$2') // Ponto após 6º digito
        .replace(/(\d{3})(\d{1,2})/, '$1-$2') // Traço antes dos últimos 2
        .replace(/(-\d{2})\d+?$/, '$1'); // Impede digitar mais que o necessário
}

function aplicarMascaraTelefone(value) {
    return value
        .replace(/\D/g, '') // Remove não números
        .replace(/(\d{2})(\d)/, '($1) $2') // Parenteses no DDD
        .replace(/(\d{5})(\d)/, '$1-$2') // Traço no celular (9 digitos)
        .replace(/(-\d{4})\d+?$/, '$1'); // Limita tamanho
}

// --- Lógica Principal ---

function carregarEventos() {
    toggleLoader(true, "Buscando eventos...");
    fetch(`${URL_API}?action=getEventosAtivos`)
        .then(res => res.json())
        .then(json => {
            toggleLoader(false);
            const container = document.getElementById('cards-container');
            container.innerHTML = '';
            
            if (!json.data || json.data.length === 0) {
                container.innerHTML = '<div style="text-align:center; padding:2rem; color:#64748b;"><h3>Nenhum evento aberto.</h3><p>Aguarde novas publicações.</p></div>';
                return;
            }
            
            json.data.forEach(ev => {
                container.innerHTML += `
                    <div class="card fade-in">
                        <h3>${ev.titulo}</h3>
                        <p>${ev.descricao}</p>
                        <small>📅 Inscrições até: ${formatarData(ev.fim)}</small>
                        <button class="btn-primary" onclick='abrirInscricao(${JSON.stringify(ev)})'>
                            Inscrever-se <i class="fa-solid fa-arrow-right"></i>
                        </button>
                    </div>
                `;
            });
        })
        .catch(() => {
            toggleLoader(false);
            const container = document.getElementById('cards-container');
            container.innerHTML = '<p style="text-align:center; color:red">Erro de conexão com o sistema.</p>';
        });
}

function abrirInscricao(evento) {
    // 1. Troca de Telas
    document.getElementById('lista-eventos').classList.add('hidden');
    document.getElementById('area-consulta').classList.add('hidden');
    document.getElementById('area-inscricao').classList.remove('hidden');
    
    // 2. Preenche Cabeçalho
    document.getElementById('titulo-evento').innerText = evento.titulo;
    document.getElementById('form-inscricao').dataset.idEvento = evento.id;

    // 3. Lê Configuração
    let config = {};
    try {
        config = typeof evento.config === 'string' ? JSON.parse(evento.config) : evento.config;
    } catch(e) { console.error(e); }

    // Salva config no DOM para usar no envio
    document.getElementById('form-inscricao').dataset.config = JSON.stringify(config);

    const areaCampos = document.getElementById('campos-dinamicos');
    areaCampos.innerHTML = '';
    
    // 4. Renderiza Campos Padrão
    if(config.camposTexto) {
        config.camposTexto.forEach(key => {
            if(CAMPO_DEFS[key]) {
                const def = CAMPO_DEFS[key];
                areaCampos.innerHTML += `
                    <div>
                        <label>${def.label}</label>
                        <input type="${def.type}" name="${key}" placeholder="${def.placeholder||''}" required>
                    </div>
                `;
            }
        });
    }

    // 5. Renderiza Campos Personalizados
    if(config.camposPersonalizados && config.camposPersonalizados.length > 0) {
        areaCampos.innerHTML += `
            <div style="grid-column: 1 / -1; margin-top: 15px; padding-top: 10px; border-top: 1px dashed #cbd5e1;">
                <h4 style="margin: 0 0 10px 0; color: #2563eb; font-size: 1rem;">Perguntas Específicas</h4>
            </div>
        `;
        
        config.camposPersonalizados.forEach(pergunta => {
            const safeName = pergunta.replace(/[^a-zA-Z0-9]/g, '');
            areaCampos.innerHTML += `
                <div>
                    <label>${pergunta}</label>
                    <input type="text" name="${safeName}" placeholder="Responda aqui..." required>
                </div>
            `;
        });
    }

    // --- ATIVAR MÁSCARAS ---
    // Seleciona os inputs recém-criados e aplica os listeners
    
    // Máscara CPF
    const inputCPF = document.querySelector('input[name="CPF"]');
    if(inputCPF) {
        inputCPF.maxLength = 14;
        inputCPF.addEventListener('input', (e) => {
            e.target.value = aplicarMascaraCPF(e.target.value);
        });
    }

    // Máscara Telefone
    const inputTel = document.querySelector('input[name="Telefone"]');
    if(inputTel) {
        inputTel.maxLength = 15;
        inputTel.addEventListener('input', (e) => {
            e.target.value = aplicarMascaraTelefone(e.target.value);
        });
    }
    // -----------------------

    // 6. Controla Uploads
    const divFoto = document.getElementById('div-upload-foto');
    const divDoc = document.getElementById('div-upload-doc');
    const inputFoto = document.getElementById('file-foto');
    const inputDoc = document.getElementById('file-doc');

    // Reset
    divFoto.classList.add('hidden'); inputFoto.required = false;
    divDoc.classList.add('hidden'); inputDoc.required = false;

    // Aplica Regras
    if(config.arquivos?.foto) { divFoto.classList.remove('hidden'); inputFoto.required = true; }
    if(config.arquivos?.doc) { divDoc.classList.remove('hidden'); inputDoc.required = true; }

    window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function enviarInscricao(e) {
    e.preventDefault();
    
    // Validação extra de tamanho do CPF
    const inputCPF = document.querySelector('input[name="CPF"]');
    if(inputCPF && inputCPF.value.length < 14) {
        showError('CPF Inválido', 'Por favor, preencha o CPF completo.');
        return;
    }

    const result = await Swal.fire({
        title: 'Confirmar Inscrição?',
        text: 'Verifique se todos os dados estão corretos.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Sim, Enviar',
        confirmButtonColor: '#2563eb'
    });

    if(!result.isConfirmed) return;

    toggleLoader(true, "Enviando seus dados...");

    // Coleta TODOS os inputs (Padrão + Personalizados)
    const inputs = document.querySelectorAll('#campos-dinamicos input');
    let dadosCampos = {};
    inputs.forEach(inp => dadosCampos[inp.name] = inp.value);

    // Configuração de Arquivos
    const config = JSON.parse(document.getElementById('form-inscricao').dataset.config);
    const arquivosPayload = {};

    try {
        if(config.arquivos?.foto) {
            const f = document.getElementById('file-foto').files[0];
            arquivosPayload.foto = { data: await toBase64(f), mime: f.type };
        }
        if(config.arquivos?.doc) {
            const f = document.getElementById('file-doc').files[0];
            arquivosPayload.doc = { data: await toBase64(f), mime: f.type };
        }

        const payload = {
            action: 'novaInscricao',
            eventoId: document.getElementById('form-inscricao').dataset.idEvento,
            campos: dadosCampos, // Envia objeto com campos padrão e extras misturados
            arquivos: arquivosPayload
        };

        fetch(URL_API, { method: 'POST', body: JSON.stringify(payload) })
            .then(res => res.json())
            .then(json => {
                toggleLoader(false);
                if(json.status === 'success') {
                    showSuccess('Inscrição Realizada!', `
                        Sua Chave Única: <br>
                        <strong style="font-size:1.5rem; color:#2563eb">${json.chave}</strong><br>
                        <span style="font-size:0.9rem">Guarde-a para consultar o resultado.</span>
                    `);
                } else {
                    showError('Erro', json.message);
                }
            });

    } catch(err) {
        toggleLoader(false);
        console.error(err);
        showError('Erro Técnico', 'Falha ao processar os arquivos. Tente novamente.');
    }
}

function consultarChave() {
    const chave = document.getElementById('busca-chave').value.trim();
    if(!chave) return showError('Atenção', 'Digite a chave de inscrição.');

    toggleLoader(true, "Consultando...");
    fetch(`${URL_API}?action=consultarInscricao&chave=${chave}`)
        .then(res => res.json())
        .then(json => {
            toggleLoader(false);
            const div = document.getElementById('resultado-busca');
            
            if(json.status === 'success') {
                const status = json.data.situacao;
                let cor = '#f59e0b'; // Pendente
                if(status.includes('Aprovada') || status.includes('Emitida')) cor = '#10b981'; // Verde
                if(status.includes('Rejeitada')) cor = '#ef4444'; // Vermelho

                // Verifica se tem link da ficha PDF
                let btnFicha = '';
                if(json.data.link_ficha) {
                    btnFicha = `
                        <div style="margin-top:15px; border-top:1px solid #eee; padding-top:10px;">
                            <a href="${json.data.link_ficha}" target="_blank" class="btn-primary" style="text-decoration:none; background:#059669; display:inline-block;">
                                <i class="fa-solid fa-file-pdf"></i> Baixar Ficha Oficial
                            </a>
                            <p style="font-size:0.8rem; color:#666; margin-top:5px;">Imprima, assine e entregue na secretaria.</p>
                        </div>
                    `;
                }

                div.innerHTML = `
                    <div class="card fade-in" style="border-left:5px solid ${cor}; margin-top:15px;">
                        <h3 style="color:${cor}; margin-bottom:5px;">${status}</h3>
                        <p style="margin:0;">Data do Envio: ${formatarData(json.data.data_inscricao)}</p>
                        ${btnFicha}
                    </div>
                `;
            } else {
                div.innerHTML = `<p style="color:#ef4444; margin-top:10px; font-weight:bold;">${json.message}</p>`;
            }
        })
        .catch(() => {
            toggleLoader(false);
            showError('Erro', 'Não foi possível consultar.');
        });
}

function voltarHome() {
    document.getElementById('area-inscricao').classList.add('hidden');
    document.getElementById('area-consulta').classList.remove('hidden');
    document.getElementById('lista-eventos').classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function formatarData(isoStr) {
    if(!isoStr) return '--';
    const partes = isoStr.split('T')[0].split('-');
    if(partes.length < 3) return isoStr;
    return `${partes[2]}/${partes[1]}/${partes[0]}`; 
}

const toBase64 = file => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = error => reject(error);
});
