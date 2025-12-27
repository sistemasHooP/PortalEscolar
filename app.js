/**
 * Portal Educacional - App Logic v7.0 (Melhorada)
 * Melhorias: Validação CPF Real e Compressão de Imagens
 */

const URL_API = 'https://script.google.com/macros/s/AKfycby-rnmBcploCmdEb8QWkMyo1tEanCcPkmNOA_QMlujH0XQvjLeiCCYhkqe7Hqhi6-mo8A/exec';

const CAMPO_DEFS = {
    'NomeCompleto': { label: 'Nome Completo', type: 'text', placeholder: 'Digite seu nome completo' },
    'DataNascimento': { label: 'Data de Nascimento', type: 'date', placeholder: '' },
    'Telefone': { label: 'Celular (WhatsApp)', type: 'tel', placeholder: '(00) 00000-0000', mask: 'tel' },
    'Endereco': { label: 'Endereço Residencial', type: 'text', placeholder: 'Rua, Número, Complemento, Bairro' },
    'NomeInstituicao': { label: 'Instituição de Ensino', type: 'select' }, 
    'NomeCurso': { label: 'Curso', type: 'text', placeholder: 'Ex: Engenharia Civil' },
    'PeriodoCurso': { label: 'Período/Semestre', type: 'text', placeholder: 'Ex: 3º Período' },
    'Matricula': { label: 'Nº Matrícula', type: 'text', placeholder: '' }
};

let listaInstituicoesCache = [];

document.addEventListener('DOMContentLoaded', () => { carregarEventos(); });

// --- UTILS UI ---
function toggleLoader(show, msg = "Processando...") {
    const el = document.getElementById('loader-overlay');
    if(show) { document.getElementById('loader-text').innerText = msg; el.classList.remove('hidden'); }
    else { el.classList.add('hidden'); }
}

function showSuccess(titulo, html, callback) {
    Swal.fire({ icon: 'success', title: titulo, html: html, confirmButtonColor: '#2563eb', confirmButtonText: 'OK' }).then(() => { if(callback) callback(); });
}

function showError(titulo, text) {
    Swal.fire({ icon: 'error', title: titulo, text: text, confirmButtonColor: '#d33' });
}

// --- MODAIS ---
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

// --- VALIDAÇÕES E MÁSCARAS ---

function validarCPF(cpf) {
    cpf = cpf.replace(/[^\d]+/g, '');
    if (cpf == '') return false;
    // Elimina CPFs invalidos conhecidos
    if (cpf.length != 11 || 
        cpf == "00000000000" || 
        cpf == "11111111111" || 
        cpf == "22222222222" || 
        cpf == "33333333333" || 
        cpf == "44444444444" || 
        cpf == "55555555555" || 
        cpf == "66666666666" || 
        cpf == "77777777777" || 
        cpf == "88888888888" || 
        cpf == "99999999999")
            return false;
            
    // Valida 1o Digito
    let add = 0;
    for (let i = 0; i < 9; i++) add += parseInt(cpf.charAt(i)) * (10 - i);
    let rev = 11 - (add % 11);
    if (rev == 10 || rev == 11) rev = 0;
    if (rev != parseInt(cpf.charAt(9))) return false;
    
    // Valida 2o Digito
    add = 0;
    for (let i = 0; i < 10; i++) add += parseInt(cpf.charAt(i)) * (11 - i);
    rev = 11 - (add % 11);
    if (rev == 10 || rev == 11) rev = 0;
    if (rev != parseInt(cpf.charAt(10))) return false;
    
    return true;
}

function aplicarMascaraCPF(value) {
    return value.replace(/\D/g, '').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})/, '$1-$2').replace(/(-\d{2})\d+?$/, '$1');
}
function aplicarMascaraTelefone(value) {
    return value.replace(/\D/g, '').replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2').replace(/(-\d{4})\d+?$/, '$1');
}

function ativarMascaras() {
    const inputCPF = document.querySelector('input[name="CPF"]');
    if(inputCPF) {
        inputCPF.maxLength = 14;
        inputCPF.addEventListener('input', (e) => e.target.value = aplicarMascaraCPF(e.target.value));
        inputCPF.addEventListener('blur', (e) => {
            if(e.target.value.length > 0 && !validarCPF(e.target.value)) {
                Swal.fire({
                    toast: true, position: 'top-end', icon: 'warning', 
                    title: 'CPF Inválido', showConfirmButton: false, timer: 3000
                });
                e.target.style.borderColor = '#ef4444';
            } else {
                e.target.style.borderColor = '#22c55e';
            }
        });
    }
    const inputTel = document.querySelector('input[name="Telefone"]');
    if(inputTel) {
        inputTel.maxLength = 15;
        inputTel.addEventListener('input', (e) => e.target.value = aplicarMascaraTelefone(e.target.value));
    }
}

// --- COMPRESSÃO DE IMAGEM ---
// Reduz imagens grandes para evitar erro no Apps Script
async function comprimirImagem(file, maxWidth = 1000, quality = 0.7) {
    if(file.type === 'application/pdf') return toBase64(file); // Não comprime PDF

    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                if (width > maxWidth) {
                    height *= maxWidth / width;
                    width = maxWidth;
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                
                // Converte para Base64 JPEG comprimido
                const dataUrl = canvas.toDataURL('image/jpeg', quality);
                resolve(dataUrl.split(',')[1]); // Retorna apenas o base64 puro
            };
            img.onerror = (err) => reject(err);
        };
        reader.onerror = (err) => reject(err);
    });
}

// --- LÓGICA PRINCIPAL ---

function carregarEventos() {
    toggleLoader(true, "Buscando eventos...");
    fetch(`${URL_API}?action=getEventosAtivos`)
        .then(res => res.json())
        .then(json => {
            toggleLoader(false);
            const container = document.getElementById('cards-container');
            container.innerHTML = '';
            if (!json.data || json.data.length === 0) {
                container.innerHTML = `<div style="text-align:center; padding:2rem; color:#64748b;"><h3>Nenhum evento aberto.</h3></div>`;
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
            document.getElementById('cards-container').innerHTML = '<p style="text-align:center;color:red">Erro de conexão.</p>';
        });
}

async function abrirInscricao(evento) {
    document.getElementById('lista-eventos').classList.add('hidden');
    document.getElementById('fab-consulta').classList.add('hidden');
    document.getElementById('area-inscricao').classList.remove('hidden');
    
    document.getElementById('titulo-evento').innerText = evento.titulo;
    document.getElementById('form-inscricao').dataset.idEvento = evento.id;

    let config = {};
    try { config = typeof evento.config === 'string' ? JSON.parse(evento.config) : evento.config; } catch(e) {}
    document.getElementById('form-inscricao').dataset.config = JSON.stringify(config);

    const areaCampos = document.getElementById('campos-dinamicos');
    areaCampos.innerHTML = '';

    if(config.mensagemAlerta) {
        areaCampos.innerHTML += `<div style="background:#fef9c3; color:#854d0e; padding:15px; border-radius:8px; margin-bottom:20px; border:1px solid #facc15;">
            <i class="fa-solid fa-circle-exclamation"></i> <strong>Aviso:</strong><br> ${config.mensagemAlerta}
        </div>`;
    }
    
    areaCampos.innerHTML += `
        <div><label>CPF *</label><input type="text" name="CPF" placeholder="000.000.000-00" required></div>
        <div><label>E-mail *</label><input type="email" name="Email" placeholder="seu@email.com" required></div>
    `;

    if(config.camposTexto && config.camposTexto.includes('NomeInstituicao') && listaInstituicoesCache.length === 0) {
        try {
            toggleLoader(true, "Carregando instituições...");
            const res = await fetch(`${URL_API}?action=getInstituicoes`);
            const json = await res.json();
            if(json.data) listaInstituicoesCache = json.data;
        } catch(e) {} finally { toggleLoader(false); }
    }

    if(config.camposTexto) {
        config.camposTexto.forEach(key => {
            if(CAMPO_DEFS[key]) {
                const def = CAMPO_DEFS[key];
                if (key === 'NomeInstituicao' && listaInstituicoesCache.length > 0) {
                    let options = '<option value="">Selecione...</option>';
                    listaInstituicoesCache.forEach(inst => options += `<option value="${inst}">${inst}</option>`);
                    options += `<option value="Outra">Outra (Não listada)</option>`;
                    areaCampos.innerHTML += `<div><label>${def.label}</label><select name="${key}" required onchange="verificarOutraInst(this)">${options}</select><input type="text" id="input_outra_inst" placeholder="Digite o nome" style="display:none; margin-top:10px;" ></div>`;
                } else {
                    areaCampos.innerHTML += `<div><label>${def.label}</label><input type="${def.type}" name="${key}" placeholder="${def.placeholder||''}" required></div>`;
                }
            }
        });
    }

    if(config.camposPersonalizados) {
        areaCampos.innerHTML += `<div style="grid-column: 1/-1; margin-top:15px; border-top:1px dashed #cbd5e1; padding-top:10px;"><h4>Perguntas Específicas</h4></div>`;
        config.camposPersonalizados.forEach(pergunta => {
            const safeName = pergunta.replace(/[^a-zA-Z0-9]/g, '');
            areaCampos.innerHTML += `<div><label>${pergunta}</label><input type="text" name="${safeName}" required></div>`;
        });
    }

    ativarMascaras();

    const divFoto = document.getElementById('div-upload-foto');
    const divDoc = document.getElementById('div-upload-doc');
    divFoto.classList.add('hidden'); document.getElementById('file-foto').required = false;
    divDoc.classList.add('hidden'); document.getElementById('file-doc').required = false;

    if(config.arquivos?.foto) { divFoto.classList.remove('hidden'); document.getElementById('file-foto').required = true; }
    if(config.arquivos?.doc) { divDoc.classList.remove('hidden'); document.getElementById('file-doc').required = true; }

    window.scrollTo({ top: 0, behavior: 'smooth' });
}

window.verificarOutraInst = function(select) {
    const input = document.getElementById('input_outra_inst');
    if(select.value === 'Outra') { input.style.display = 'block'; input.required = true; input.focus(); }
    else { input.style.display = 'none'; input.required = false; }
}

async function enviarInscricao(e) {
    e.preventDefault();
    const inputCPF = document.querySelector('input[name="CPF"]');
    if(!validarCPF(inputCPF.value)) return showError('CPF Inválido', 'O CPF digitado é matematicamente inválido.');

    const result = await Swal.fire({ title: 'Confirmar envio?', icon: 'warning', showCancelButton: true, confirmButtonText: 'Sim, Enviar' });
    if(!result.isConfirmed) return;

    toggleLoader(true, "Otimizando imagens e enviando...");

    const inputs = document.querySelectorAll('#campos-dinamicos input, #campos-dinamicos select');
    let dadosCampos = {};
    inputs.forEach(inp => { if(inp.id !== 'input_outra_inst' || inp.style.display !== 'none') dadosCampos[inp.name] = inp.value; });
    if(dadosCampos['NomeInstituicao'] === 'Outra') dadosCampos['NomeInstituicao'] = document.getElementById('input_outra_inst').value;

    const config = JSON.parse(document.getElementById('form-inscricao').dataset.config);
    const arquivosPayload = {};

    try {
        if(config.arquivos?.foto) {
            const f = document.getElementById('file-foto').files[0];
            arquivosPayload.foto = { data: await comprimirImagem(f), mime: 'image/jpeg' }; // Sempre envia JPEG otimizado
        }
        if(config.arquivos?.doc) {
            const f = document.getElementById('file-doc').files[0];
            arquivosPayload.doc = { data: await toBase64(f), mime: f.type };
        }

        const payload = { action: 'novaInscricao', eventoId: document.getElementById('form-inscricao').dataset.idEvento, campos: dadosCampos, arquivos: arquivosPayload };

        fetch(URL_API, { method: 'POST', body: JSON.stringify(payload) })
            .then(res => res.json())
            .then(json => {
                toggleLoader(false);
                if(json.status === 'success') {
                    showSuccess('Inscrição Realizada!', `Chave: <strong>${json.chave}</strong>`, () => { document.getElementById('form-inscricao').reset(); voltarHome(); });
                } else {
                    showError('Erro', json.message);
                }
            });

    } catch(err) {
        toggleLoader(false);
        showError('Erro Técnico', 'Falha no processamento. Tente arquivos menores.');
    }
}

function consultarChave() {
    const chave = document.getElementById('busca-chave').value.trim();
    if(!chave) return showError('Atenção', 'Digite a chave.');
    const divResult = document.getElementById('resultado-busca');
    divResult.innerHTML = '<div style="text-align:center; margin-top:10px;"><i class="fa-solid fa-spinner fa-spin"></i> Buscando...</div>';

    fetch(`${URL_API}?action=consultarInscricao&chave=${chave}`)
        .then(res => res.json())
        .then(json => {
            if(json.status === 'success') {
                const status = json.data.situacao;
                let cor = status.includes('Aprovada') || status.includes('Emitida') ? '#10b981' : (status.includes('Rejeitada') ? '#ef4444' : '#f59e0b');
                let btnFicha = json.data.link_ficha ? `<div style="margin-top:10px;"><a href="${json.data.link_ficha}" target="_blank" class="btn-primary" style="background:#059669; text-decoration:none; text-align:center;">Baixar Ficha</a></div>` : '';
                divResult.innerHTML = `<div class="card fade-in" style="border-left:5px solid ${cor}; margin-top:15px; background:#f0f9ff;">
                    <h3 style="color:${cor}; margin:0;">${status}</h3><p style="margin:5px 0;">Inscrito em: ${formatarData(json.data.data_inscricao)}</p>${btnFicha}
                </div>`;
            } else { divResult.innerHTML = `<p style="color:red; text-align:center;">${json.message}</p>`; }
        })
        .catch(() => { divResult.innerHTML = '<p style="color:red;">Erro ao consultar.</p>'; });
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
    return partes.length < 3 ? isoStr : `${partes[2]}/${partes[1]}/${partes[0]}`; 
}

const toBase64 = file => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = error => reject(error);
});
