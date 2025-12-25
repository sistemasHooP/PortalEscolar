/**
 * Portal Educacional - App Logic v6.2 (Full)
 * Funcionalidades:
 * - Listagem de Eventos
 * - Formulário Dinâmico com Máscaras (CPF/Telefone)
 * - Select de Instituições (Carregamento Dinâmico)
 * - Verificação de Duplicidade de CPF
 * - Upload de Arquivos (Foto/Doc)
 * - Consulta de Status e Download de PDF
 * - Botão Flutuante (FAB) e Modais
 * - Mensagens de Alerta personalizadas por evento
 */

// ⚠️ URL da API (Link mais recente fornecido)
const URL_API = 'https://script.google.com/macros/s/AKfycby-rnmBcploCmdEb8QWkMyo1tEanCcPkmNOA_QMlujH0XQvjLeiCCYhkqe7Hqhi6-mo8A/exec';

// Definição dos campos visuais e seus tipos
const CAMPO_DEFS = {
    'NomeCompleto': { 
        label: 'Nome Completo', 
        type: 'text', 
        placeholder: 'Digite seu nome completo' 
    },
    // CPF e Email são inseridos manualmente no código (obrigatórios)
    'DataNascimento': { 
        label: 'Data de Nascimento', 
        type: 'date', 
        placeholder: '' 
    },
    'Telefone': { 
        label: 'Celular (WhatsApp)', 
        type: 'tel', 
        placeholder: '(00) 00000-0000', 
        mask: 'tel' 
    },
    'Endereco': { 
        label: 'Endereço Residencial', 
        type: 'text', 
        placeholder: 'Rua, Número, Complemento, Bairro' 
    },
    'NomeInstituicao': { 
        label: 'Instituição de Ensino', 
        type: 'select' // Tipo especial SELECT que carrega lista do servidor
    }, 
    'NomeCurso': { 
        label: 'Curso', 
        type: 'text', 
        placeholder: 'Ex: Engenharia Civil, Direito' 
    },
    'PeriodoCurso': { 
        label: 'Período/Semestre', 
        type: 'text', 
        placeholder: 'Ex: 3º Período' 
    },
    'Matricula': { 
        label: 'Nº Matrícula', 
        type: 'text', 
        placeholder: '' 
    }
};

// Cache para armazenar as instituições e não buscar repetidamente na API
let listaInstituicoesCache = [];

// Inicialização
document.addEventListener('DOMContentLoaded', () => { 
    carregarEventos(); 
});

// --- Funções de Interface (UI) ---

function toggleLoader(show, msg = "Processando...") {
    const el = document.getElementById('loader-overlay');
    if(show) {
        document.getElementById('loader-text').innerText = msg;
        el.classList.remove('hidden');
    } else {
        el.classList.add('hidden');
    }
}

function showSuccess(titulo, html, callback) {
    Swal.fire({
        icon: 'success',
        title: titulo,
        html: html,
        confirmButtonColor: '#2563eb',
        confirmButtonText: 'OK'
    }).then(() => {
        if(callback) callback();
    });
}

function showError(titulo, text) {
    Swal.fire({
        icon: 'error',
        title: titulo,
        text: text,
        confirmButtonColor: '#d33'
    });
}

// --- Controle de Modal e Botão Flutuante (FAB) ---

function abrirModalConsulta() {
    document.getElementById('modal-consulta').classList.remove('hidden');
    // Pequeno delay para focar no input (melhor UX no mobile)
    setTimeout(() => document.getElementById('busca-chave').focus(), 100); 
}

function fecharModalConsulta() {
    document.getElementById('modal-consulta').classList.add('hidden');
    document.getElementById('resultado-busca').innerHTML = ''; // Limpa resultados anteriores
    document.getElementById('busca-chave').value = '';
}

// Fecha o modal se clicar na área escura (fora da caixa branca)
document.getElementById('modal-consulta').addEventListener('click', function(e) {
    if (e.target === this) fecharModalConsulta();
});

// --- Máscaras de Input ---

function aplicarMascaraCPF(value) {
    return value
        .replace(/\D/g, '') // Remove tudo o que não é dígito
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d{1,2})/, '$1-$2')
        .replace(/(-\d{2})\d+?$/, '$1'); // Limita tamanho
}

function aplicarMascaraTelefone(value) {
    return value
        .replace(/\D/g, '')
        .replace(/(\d{2})(\d)/, '($1) $2')
        .replace(/(\d{5})(\d)/, '$1-$2')
        .replace(/(-\d{4})\d+?$/, '$1');
}

function ativarMascaras() {
    const inputCPF = document.querySelector('input[name="CPF"]');
    if(inputCPF) {
        inputCPF.maxLength = 14;
        inputCPF.addEventListener('input', (e) => e.target.value = aplicarMascaraCPF(e.target.value));
    }
    
    const inputTel = document.querySelector('input[name="Telefone"]');
    if(inputTel) {
        inputTel.maxLength = 15;
        inputTel.addEventListener('input', (e) => e.target.value = aplicarMascaraTelefone(e.target.value));
    }
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
                    </div>`;
            });
        })
        .catch(() => {
            toggleLoader(false);
            document.getElementById('cards-container').innerHTML = '<p style="text-align:center;color:red">Erro de conexão com o sistema.</p>';
        });
}

async function abrirInscricao(evento) {
    // 1. Troca de Telas
    document.getElementById('lista-eventos').classList.add('hidden');
    document.getElementById('fab-consulta').classList.add('hidden'); // Esconde FAB na tela de form
    document.getElementById('area-inscricao').classList.remove('hidden');
    
    // 2. Preenche Cabeçalho
    document.getElementById('titulo-evento').innerText = evento.titulo;
    document.getElementById('form-inscricao').dataset.idEvento = evento.id;

    // 3. Lê Configuração do Evento
    let config = {};
    try {
        config = typeof evento.config === 'string' ? JSON.parse(evento.config) : evento.config;
    } catch(e) { console.error(e); }
    
    // Salva config no elemento form para usar no envio
    document.getElementById('form-inscricao').dataset.config = JSON.stringify(config);

    const areaCampos = document.getElementById('campos-dinamicos');
    areaCampos.innerHTML = '';

    // --- MENSAGEM DE ALERTA (Se houver) ---
    if(config.mensagemAlerta) {
        areaCampos.innerHTML += `
            <div style="background:#fef9c3; color:#854d0e; padding:15px; border-radius:8px; margin-bottom:20px; border:1px solid #facc15; font-size:0.9rem; line-height:1.5;">
                <i class="fa-solid fa-circle-exclamation"></i> <strong>Aviso Importante:</strong><br> ${config.mensagemAlerta}
            </div>
        `;
    }
    
    // --- CAMPOS OBRIGATÓRIOS (FIXOS) ---
    // Estes campos aparecem sempre, independentemente da configuração
    areaCampos.innerHTML += `
        <div>
            <label>CPF *</label>
            <input type="text" name="CPF" placeholder="000.000.000-00" required>
        </div>
        <div>
            <label>E-mail *</label>
            <input type="email" name="Email" placeholder="seu@email.com" required>
        </div>
    `;

    // --- CARREGAR LISTA DE INSTITUIÇÕES ---
    // Apenas se o campo "NomeInstituicao" for solicitado e a lista ainda não estiver em cache
    if(config.camposTexto && config.camposTexto.includes('NomeInstituicao') && listaInstituicoesCache.length === 0) {
        try {
            toggleLoader(true, "Carregando instituições...");
            const res = await fetch(`${URL_API}?action=getInstituicoes`);
            const json = await res.json();
            if(json.data && json.data.length > 0) {
                listaInstituicoesCache = json.data;
            }
        } catch(e) {
            console.warn("Falha ao carregar lista de instituições. Usando input de texto.", e);
        } finally {
            toggleLoader(false);
        }
    }

    // --- RENDERIZAR CAMPOS DINÂMICOS (PADRÃO) ---
    if(config.camposTexto) {
        config.camposTexto.forEach(key => {
            if(CAMPO_DEFS[key]) {
                const def = CAMPO_DEFS[key];
                
                // Lógica de Select Inteligente para Instituição
                if (key === 'NomeInstituicao') {
                    if (listaInstituicoesCache.length > 0) {
                        // Se temos a lista carregada, exibe um SELECT
                        let options = '<option value="">Selecione a Instituição...</option>';
                        listaInstituicoesCache.forEach(inst => {
                            options += `<option value="${inst}">${inst}</option>`;
                        });
                        // Opção de fallback caso não esteja na lista
                        options += `<option value="Outra">Outra (Não listada)</option>`;
                        
                        areaCampos.innerHTML += `
                            <div>
                                <label>${def.label}</label>
                                <select name="${key}" required style="width:100%; padding:12px; border:1px solid #cbd5e1; border-radius:8px; background:white;">${options}</select>
                            </div>
                        `;
                    } else {
                        // FALLBACK: Se lista vazia ou erro, exibe INPUT de texto normal
                        areaCampos.innerHTML += `<div><label>${def.label}</label><input type="text" name="${key}" placeholder="Digite o nome da instituição" required></div>`;
                    }
                } else {
                    // Renderiza como INPUT normal
                    areaCampos.innerHTML += `<div><label>${def.label}</label><input type="${def.type}" name="${key}" placeholder="${def.placeholder||''}" required></div>`;
                }
            }
        });
    }

    // --- CAMPOS PERSONALIZADOS (Criados pelo Admin) ---
    if(config.camposPersonalizados && config.camposPersonalizados.length > 0) {
        areaCampos.innerHTML += `
            <div style="grid-column: 1/-1; margin-top:15px; border-top:1px dashed #cbd5e1; padding-top:10px;">
                <h4 style="margin:0 0 10px 0; color:#2563eb; font-size:1rem;">Perguntas Específicas</h4>
            </div>`;
            
        config.camposPersonalizados.forEach(pergunta => {
            // Remove caracteres especiais para criar o 'name' do input
            const safeName = pergunta.replace(/[^a-zA-Z0-9]/g, '');
            areaCampos.innerHTML += `<div><label>${pergunta}</label><input type="text" name="${safeName}" placeholder="Responda aqui..." required></div>`;
        });
    }

    // Ativa máscaras nos novos inputs (CPF/Telefone)
    ativarMascaras();

    // --- CONTROLE DE UPLOADS (FOTO/DOC) ---
    const divFoto = document.getElementById('div-upload-foto');
    const divDoc = document.getElementById('div-upload-doc');
    const inputFoto = document.getElementById('file-foto');
    const inputDoc = document.getElementById('file-doc');

    // Reset: esconde tudo inicialmente
    divFoto.classList.add('hidden'); inputFoto.required = false;
    divDoc.classList.add('hidden'); inputDoc.required = false;

    // Aplica regras do Admin (mostra se estiver configurado)
    if(config.arquivos?.foto) { 
        divFoto.classList.remove('hidden'); 
        inputFoto.required = true; 
    }
    if(config.arquivos?.doc) { 
        divDoc.classList.remove('hidden'); 
        inputDoc.required = true; 
    }

    // Rola para o topo do formulário
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function enviarInscricao(e) {
    e.preventDefault();
    
    // Validação extra de CPF (tamanho mínimo)
    const inputCPF = document.querySelector('input[name="CPF"]');
    if(inputCPF && inputCPF.value.length < 14) {
        showError('CPF Inválido', 'Por favor, preencha o CPF completo.');
        return;
    }

    // Confirmação antes de enviar
    const result = await Swal.fire({
        title: 'Confirmar envio?',
        text: 'Verifique se todos os dados estão corretos.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Sim, Enviar',
        confirmButtonColor: '#2563eb'
    });

    if(!result.isConfirmed) return;

    toggleLoader(true, "Enviando dados e arquivos...");

    // Coleta dados (INPUT e SELECT)
    const inputs = document.querySelectorAll('#campos-dinamicos input, #campos-dinamicos select');
    let dadosCampos = {};
    inputs.forEach(inp => dadosCampos[inp.name] = inp.value);

    // Preparação de Arquivos
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
            campos: dadosCampos,
            arquivos: arquivosPayload
        };

        // Envio para API
        fetch(URL_API, { method: 'POST', body: JSON.stringify(payload) })
            .then(res => res.json())
            .then(json => {
                toggleLoader(false);
                
                if(json.status === 'success') {
                    // SUCESSO: Redireciona e limpa
                    showSuccess('Inscrição Realizada!', 
                        `Sua Chave: <strong>${json.chave}</strong><br>Foi enviado um e-mail de confirmação.`, 
                        () => {
                            document.getElementById('form-inscricao').reset(); 
                            voltarHome(); 
                        }
                    );
                } else if (json.message && (json.message.includes('inscrição realizada') || json.message.includes('já existe'))) { 
                    // AVISO DE DUPLICIDADE (CPF já existe)
                    Swal.fire({
                        icon: 'warning',
                        title: 'Atenção!',
                        html: `Este CPF já possui uma inscrição neste evento.<br><br>Verifique seu e-mail para recuperar sua chave ou entre em contato com a secretaria.`,
                        confirmButtonColor: '#f59e0b',
                        confirmButtonText: 'Entendi'
                    });
                } else {
                    // ERRO GENÉRICO
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

    const divResult = document.getElementById('resultado-busca');
    divResult.innerHTML = '<div style="text-align:center; color:#666; margin-top:10px;"><i class="fa-solid fa-spinner fa-spin"></i> Buscando...</div>';

    fetch(`${URL_API}?action=consultarInscricao&chave=${chave}`)
        .then(res => res.json())
        .then(json => {
            if(json.status === 'success') {
                const status = json.data.situacao;
                let cor = '#f59e0b'; // Laranja (Pendente)
                if(status.includes('Aprovada') || status.includes('Emitida')) cor = '#10b981'; // Verde
                if(status.includes('Rejeitada')) cor = '#ef4444'; // Vermelho

                let btnFicha = '';
                if(json.data.link_ficha) {
                    btnFicha = `
                        <div style="margin-top:15px; border-top:1px solid #eee; padding-top:10px;">
                            <a href="${json.data.link_ficha}" target="_blank" class="btn-primary" style="text-decoration:none; background:#059669; display:inline-block; font-size:0.9rem; width:100%; text-align:center;">
                                <i class="fa-solid fa-file-pdf"></i> Baixar Ficha Oficial
                            </a>
                        </div>`;
                }

                divResult.innerHTML = `
                    <div class="card fade-in" style="border-left:5px solid ${cor}; margin-top:15px; background:#f0f9ff;">
                        <h3 style="color:${cor}; margin-bottom:5px;">${status}</h3>
                        <p style="margin:0;">Data: ${formatarData(json.data.data_inscricao)}</p>
                        ${btnFicha}
                    </div>`;
            } else {
                divResult.innerHTML = `<p style="color:red; margin-top:10px; text-align:center;">${json.message}</p>`;
            }
        })
        .catch(() => { divResult.innerHTML = '<p style="color:red; margin-top:10px;">Erro ao consultar.</p>'; });
}

function voltarHome() {
    document.getElementById('area-inscricao').classList.add('hidden');
    document.getElementById('fab-consulta').classList.remove('hidden'); 
    document.getElementById('lista-eventos').classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function formatarData(isoStr) {
    if(!isoStr) return '--';
    const partes = isoStr.split('T')[0].split('-');
    if(partes.length < 3) return isoStr;
    return `${partes[2]}/${partes[1]}/${partes[0]}`; 
}

// Converte arquivo para Base64 (Necessário para envio via API)
const toBase64 = file => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = error => reject(error);
});
