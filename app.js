/**
 * Portal Educacional - App Logic v5.2
 * Melhoria: Alerta amigável para CPF Duplicado
 */

// ⚠️ URL da API (Mantida a mesma)
const URL_API = 'https://script.google.com/macros/s/AKfycby-rnmBcploCmdEb8QWkMyo1tEanCcPkmNOA_QMlujH0XQvjLeiCCYhkqe7Hqhi6-mo8A/exec';

const CAMPO_DEFS = {
    'NomeCompleto': { label: 'Nome Completo', type: 'text', placeholder: 'Digite seu nome completo' },
    // CPF e Email são inseridos manualmente no código agora (fixos)
    'DataNascimento': { label: 'Data de Nascimento', type: 'date', placeholder: '' },
    'Telefone': { label: 'Celular (WhatsApp)', type: 'tel', placeholder: '(00) 00000-0000', mask: 'tel' },
    'Endereco': { label: 'Endereço Residencial', type: 'text', placeholder: 'Rua, Número, Complemento' },
    'NomeInstituicao': { label: 'Instituição de Ensino', type: 'text', placeholder: 'Ex: Universidade X' },
    'NomeCurso': { label: 'Curso', type: 'text', placeholder: 'Ex: Engenharia' },
    'PeriodoCurso': { label: 'Período/Semestre', type: 'text', placeholder: 'Ex: 3º Período' },
    'Matricula': { label: 'Nº Matrícula', type: 'text', placeholder: '' }
};

document.addEventListener('DOMContentLoaded', () => { carregarEventos(); });

// --- Funções UI ---

function toggleLoader(show, msg = "Processando...") {
    const el = document.getElementById('loader-overlay');
    if(show) { document.getElementById('loader-text').innerText = msg; el.classList.remove('hidden'); }
    else { el.classList.add('hidden'); }
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
    Swal.fire({ icon: 'error', title, text, confirmButtonColor: '#d33' });
}

// --- CONTROLE DE MODAL E FAB ---
function abrirModalConsulta() {
    document.getElementById('modal-consulta').classList.remove('hidden');
    setTimeout(() => document.getElementById('busca-chave').focus(), 100); 
}

function fecharModalConsulta() {
    document.getElementById('modal-consulta').classList.add('hidden');
    document.getElementById('resultado-busca').innerHTML = ''; 
    document.getElementById('busca-chave').value = '';
}

document.getElementById('modal-consulta').addEventListener('click', function(e) {
    if (e.target === this) fecharModalConsulta();
});

// --- Máscaras ---
function aplicarMascaraCPF(value) {
    return value.replace(/\D/g, '').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})/, '$1-$2').replace(/(-\d{2})\d+?$/, '$1');
}
function aplicarMascaraTelefone(value) {
    return value.replace(/\D/g, '').replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2').replace(/(-\d{4})\d+?$/, '$1');
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
                        <small>📅 Até: ${formatarData(ev.fim)}</small>
                        <button class="btn-primary" onclick='abrirInscricao(${JSON.stringify(ev)})'>
                            Inscrever-se <i class="fa-solid fa-arrow-right"></i>
                        </button>
                    </div>`;
            });
        })
        .catch(() => { toggleLoader(false); document.getElementById('cards-container').innerHTML = '<p style="text-align:center;color:red">Erro de conexão.</p>'; });
}

function abrirInscricao(evento) {
    document.getElementById('lista-eventos').classList.add('hidden');
    document.getElementById('fab-consulta').classList.add('hidden'); 
    document.getElementById('area-inscricao').classList.remove('hidden');
    
    document.getElementById('titulo-evento').innerText = evento.titulo;
    document.getElementById('form-inscricao').dataset.idEvento = evento.id;

    let config = {};
    try { config = typeof evento.config === 'string' ? JSON.parse(evento.config) : evento.config; } catch(e){}
    document.getElementById('form-inscricao').dataset.config = JSON.stringify(config);

    const areaCampos = document.getElementById('campos-dinamicos');
    areaCampos.innerHTML = '';
    
    // --- CAMPOS OBRIGATÓRIOS (FIXOS) ---
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

    // Campos Configuráveis
    if(config.camposTexto) {
        config.camposTexto.forEach(key => {
            if(CAMPO_DEFS[key]) {
                const def = CAMPO_DEFS[key];
                areaCampos.innerHTML += `<div><label>${def.label}</label><input type="${def.type}" name="${key}" placeholder="${def.placeholder||''}" required></div>`;
            }
        });
    }

    if(config.camposPersonalizados && config.camposPersonalizados.length > 0) {
        areaCampos.innerHTML += `<div style="grid-column: 1/-1; margin-top:15px; border-top:1px dashed #cbd5e1; padding-top:10px;"><h4 style="margin:0 0 10px 0; color:#2563eb; font-size:1rem;">Perguntas Específicas</h4></div>`;
        config.camposPersonalizados.forEach(p => {
            const safeName = p.replace(/[^a-zA-Z0-9]/g, '');
            areaCampos.innerHTML += `<div><label>${p}</label><input type="text" name="${safeName}" placeholder="Responda aqui..." required></div>`;
        });
    }

    // Ativa Máscaras
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

    // Uploads
    const divFoto = document.getElementById('div-upload-foto');
    const divDoc = document.getElementById('div-upload-doc');
    const inputFoto = document.getElementById('file-foto');
    const inputDoc = document.getElementById('file-doc');

    divFoto.classList.add('hidden'); inputFoto.required = false;
    divDoc.classList.add('hidden'); inputDoc.required = false;

    if(config.arquivos?.foto) { divFoto.classList.remove('hidden'); inputFoto.required = true; }
    if(config.arquivos?.doc) { divDoc.classList.remove('hidden'); inputDoc.required = true; }

    window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function enviarInscricao(e) {
    e.preventDefault();
    const inputCPF = document.querySelector('input[name="CPF"]');
    if(inputCPF && inputCPF.value.length < 14) return showError('CPF Inválido', 'Preencha o CPF completo.');

    const result = await Swal.fire({ title: 'Confirmar?', text: 'Verifique os dados.', icon: 'warning', showCancelButton: true, confirmButtonText: 'Enviar' });
    if(!result.isConfirmed) return;

    toggleLoader(true, "Enviando...");

    const inputs = document.querySelectorAll('#campos-dinamicos input');
    let dadosCampos = {};
    inputs.forEach(inp => dadosCampos[inp.name] = inp.value);

    const config = JSON.parse(document.getElementById('form-inscricao').dataset.config);
    const arquivosPayload = {};

    try {
        if(config.arquivos?.foto) { const f = document.getElementById('file-foto').files[0]; arquivosPayload.foto = { data: await toBase64(f), mime: f.type }; }
        if(config.arquivos?.doc) { const f = document.getElementById('file-doc').files[0]; arquivosPayload.doc = { data: await toBase64(f), mime: f.type }; }

        const payload = {
            action: 'novaInscricao',
            eventoId: document.getElementById('form-inscricao').dataset.idEvento,
            campos: dadosCampos,
            arquivos: arquivosPayload
        };

        fetch(URL_API, { method: 'POST', body: JSON.stringify(payload) })
            .then(res => res.json())
            .then(json => {
                toggleLoader(false);
                if(json.status === 'success') {
                    // --- SUCESSO E RESET ---
                    showSuccess('Sucesso!', `Sua Chave: <strong>${json.chave}</strong><br>Enviamos um e-mail de confirmação.`, () => {
                        document.getElementById('form-inscricao').reset(); 
                        voltarHome(); 
                    });
                } else if (json.message && json.message.includes('inscrição realizada')) { 
                    // --- TRATAMENTO DE DUPLICIDADE (NOVO) ---
                    // Se a mensagem do backend for de duplicidade, mostra alerta amarelo específico
                    Swal.fire({
                        icon: 'warning',
                        title: 'Atenção!',
                        html: `Já existe uma inscrição com este CPF para este evento.<br><br>Verifique seu e-mail para recuperar sua chave ou consulte na secretaria.`,
                        confirmButtonColor: '#f59e0b',
                        confirmButtonText: 'Entendi'
                    });
                } else {
                    // Erro genérico
                    showError('Não foi possível realizar a inscrição', json.message);
                }
            });
    } catch(err) { toggleLoader(false); showError('Erro', 'Falha na comunicação com o servidor.'); }
}

function consultarChave() {
    const chave = document.getElementById('busca-chave').value.trim();
    if(!chave) return showError('Atenção', 'Digite a chave.');

    const divResult = document.getElementById('resultado-busca');
    divResult.innerHTML = '<div style="text-align:center; color:#666; margin-top:10px;"><i class="fa-solid fa-spinner fa-spin"></i> Buscando...</div>';

    fetch(`${URL_API}?action=consultarInscricao&chave=${chave}`)
        .then(res => res.json())
        .then(json => {
            if(json.status === 'success') {
                const status = json.data.situacao;
                let cor = '#f59e0b';
                if(status.includes('Aprovada') || status.includes('Emitida')) cor = '#10b981';
                if(status.includes('Rejeitada')) cor = '#ef4444';

                let btnFicha = '';
                if(json.data.link_ficha) {
                    btnFicha = `<div style="margin-top:15px; border-top:1px solid #eee; padding-top:10px;"><a href="${json.data.link_ficha}" target="_blank" class="btn-primary" style="text-decoration:none; background:#059669; display:inline-block; font-size:0.9rem; width:100%; text-align:center;"><i class="fa-solid fa-file-pdf"></i> Baixar Ficha</a></div>`;
                }

                divResult.innerHTML = `<div class="card fade-in" style="border-left:5px solid ${cor}; margin-top:15px; background:#f0f9ff;"><h3 style="color:${cor}; margin-bottom:5px;">${status}</h3><p style="margin:0;">Data: ${formatarData(json.data.data_inscricao)}</p>${btnFicha}</div>`;
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

const toBase64 = file => new Promise((r, j) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => r(reader.result.split(',')[1]);
    reader.onerror = error => j(error);
});
