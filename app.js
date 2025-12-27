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

function abrirModalConsulta() { document.getElementById('modal-consulta').classList.remove('hidden'); setTimeout(() => document.getElementById('busca-chave').focus(), 100); }
function fecharModalConsulta() { document.getElementById('modal-consulta').classList.add('hidden'); document.getElementById('resultado-busca').innerHTML = ''; document.getElementById('busca-chave').value = ''; }
document.getElementById('modal-consulta').addEventListener('click', function(e) { if (e.target === this) fecharModalConsulta(); });

function validarCPF(cpf) {
    cpf = cpf.replace(/[^\d]+/g, '');
    if (cpf == '') return false;
    if (cpf.length != 11 || cpf == "00000000000" || cpf == "11111111111") return false;
    let add = 0; for (let i = 0; i < 9; i++) add += parseInt(cpf.charAt(i)) * (10 - i);
    let rev = 11 - (add % 11); if (rev == 10 || rev == 11) rev = 0; if (rev != parseInt(cpf.charAt(9))) return false;
    add = 0; for (let i = 0; i < 10; i++) add += parseInt(cpf.charAt(i)) * (11 - i);
    rev = 11 - (add % 11); if (rev == 10 || rev == 11) rev = 0; if (rev != parseInt(cpf.charAt(10))) return false;
    return true;
}

function aplicarMascaraCPF(v) { return v.replace(/\D/g, '').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})/, '$1-$2').replace(/(-\d{2})\d+?$/, '$1'); }
function aplicarMascaraTelefone(v) { return v.replace(/\D/g, '').replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2').replace(/(-\d{4})\d+?$/, '$1'); }

function ativarMascaras() {
    const iC = document.querySelector('input[name="CPF"]');
    if(iC) { iC.maxLength=14; iC.addEventListener('input', e=>e.target.value=aplicarMascaraCPF(e.target.value)); }
    const iT = document.querySelector('input[name="Telefone"]');
    if(iT) { iT.maxLength=15; iT.addEventListener('input', e=>e.target.value=aplicarMascaraTelefone(e.target.value)); }
}

async function comprimirImagem(file, maxWidth = 1000, quality = 0.7) {
    if(file.type === 'application/pdf') return toBase64(file);
    return new Promise((resolve, reject) => {
        const reader = new FileReader(); reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image(); img.src = event.target.result;
            img.onload = () => {
                const c = document.createElement('canvas'); let w = img.width, h = img.height;
                if (w > maxWidth) { h *= maxWidth / w; w = maxWidth; }
                c.width = w; c.height = h; const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0, w, h);
                resolve(c.toDataURL('image/jpeg', quality).split(',')[1]);
            }; img.onerror = (e) => reject(e);
        }; reader.onerror = (e) => reject(e);
    });
}

function carregarEventos() {
    toggleLoader(true, "Buscando eventos...");
    fetch(`${URL_API}?action=getEventosAtivos`).then(res => res.json()).then(json => {
        toggleLoader(false);
        const c = document.getElementById('cards-container'); c.innerHTML = '';
        if (!json.data || json.data.length === 0) { c.innerHTML = `<div style="text-align:center; padding:2rem; color:#64748b;"><h3>Nenhum evento aberto.</h3></div>`; return; }
        json.data.forEach(ev => {
            c.innerHTML += `<div class="card fade-in"><h3>${ev.titulo}</h3><p>${ev.descricao}</p><small>📅 Até: ${formatarData(ev.fim)}</small><button class="btn-primary" onclick='abrirInscricao(${JSON.stringify(ev)})'>Inscrever-se <i class="fa-solid fa-arrow-right"></i></button></div>`;
        });
    }).catch(() => { toggleLoader(false); document.getElementById('cards-container').innerHTML = '<p style="text-align:center;color:red">Erro de conexão.</p>'; });
}

async function abrirInscricao(evento) {
    document.getElementById('lista-eventos').classList.add('hidden'); document.getElementById('fab-consulta').classList.add('hidden'); document.getElementById('area-inscricao').classList.remove('hidden');
    document.getElementById('titulo-evento').innerText = evento.titulo; document.getElementById('form-inscricao').dataset.idEvento = evento.id;
    let config = {}; try { config = typeof evento.config === 'string' ? JSON.parse(evento.config) : evento.config; } catch(e) {}
    document.getElementById('form-inscricao').dataset.config = JSON.stringify(config);

    const area = document.getElementById('campos-dinamicos'); area.innerHTML = '';
    
    // Alerta de topo (Amarelo - Atenção)
    if(config.mensagemAlerta) {
        area.innerHTML += `<div class="info-banner"><i class="fa-solid fa-circle-exclamation"></i> <div><strong>Aviso:</strong><br>${config.mensagemAlerta}</div></div>`;
    }
    
    // Observações Gerais (Azul - Instruções do Admin) - SOMENTE LEITURA
    if(config.observacoesTexto) {
        area.innerHTML += `
            <div style="background:#f0f9ff; color:#0369a1; padding:15px; border-radius:8px; border-left:4px solid #3b82f6; margin-bottom:20px; font-size:0.95rem;">
                <h4 style="margin:0 0 5px 0; color:#1e40af;"><i class="fa-solid fa-circle-info"></i> Informações Importantes:</h4>
                <p style="margin:0; line-height:1.5;">${config.observacoesTexto.replace(/\n/g, '<br>')}</p>
            </div>
        `;
    }
    
    // Campos Obrigatórios Fixos
    area.innerHTML += `<div><label>CPF *</label><input type="text" name="CPF" placeholder="000.000.000-00" required></div><div><label>E-mail *</label><input type="email" name="Email" placeholder="seu@email.com" required></div>`;

    if(config.camposTexto && config.camposTexto.includes('NomeInstituicao') && listaInstituicoesCache.length === 0) {
        try { toggleLoader(true,"Carregando..."); const r = await fetch(`${URL_API}?action=getInstituicoes`); const j = await r.json(); if(j.data) listaInstituicoesCache = j.data; } catch(e){} finally { toggleLoader(false); }
    }

    if(config.camposTexto) {
        config.camposTexto.forEach(key => {
            if(CAMPO_DEFS[key]) {
                const def = CAMPO_DEFS[key];
                if (key === 'NomeInstituicao' && listaInstituicoesCache.length > 0) {
                    let opt = '<option value="">Selecione...</option>'; listaInstituicoesCache.forEach(i => opt += `<option value="${i}">${i}</option>`); opt += `<option value="Outra">Outra</option>`;
                    area.innerHTML += `<div><label>${def.label}</label><select name="${key}" required onchange="verificarOutraInst(this)">${opt}</select><input type="text" id="input_outra_inst" placeholder="Digite o nome" style="display:none; margin-top:5px;"></div>`;
                } else {
                    area.innerHTML += `<div><label>${def.label}</label><input type="${def.type}" name="${key}" placeholder="${def.placeholder||''}" required></div>`;
                }
            }
        });
    }

    if(config.camposPersonalizados && config.camposPersonalizados.length > 0) {
        area.innerHTML += `<div style="grid-column:1/-1; margin-top:15px; border-top:1px dashed #ccc; padding-top:10px;"><h4>Perguntas Adicionais</h4></div>`;
        config.camposPersonalizados.forEach(p => {
            area.innerHTML += `<div><label>${p}</label><input type="text" name="${p}" required placeholder="Responda aqui"></div>`;
        });
    }

    ativarMascaras();
    const df = document.getElementById('div-upload-foto'), dd = document.getElementById('div-upload-doc');
    df.classList.add('hidden'); document.getElementById('file-foto').required = false;
    dd.classList.add('hidden'); document.getElementById('file-doc').required = false;
    if(config.arquivos?.foto) { df.classList.remove('hidden'); document.getElementById('file-foto').required = true; }
    if(config.arquivos?.doc) { dd.classList.remove('hidden'); document.getElementById('file-doc').required = true; }
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

window.verificarOutraInst = function(s) { const i = document.getElementById('input_outra_inst'); if(s.value==='Outra'){ i.style.display='block'; i.required=true; } else { i.style.display='none'; i.required=false; } }

async function enviarInscricao(e) {
    e.preventDefault();
    const iCPF = document.querySelector('input[name="CPF"]');
    if(!validarCPF(iCPF.value)) return showError('CPF Inválido', 'CPF inválido.');
    
    const r = await Swal.fire({ title: 'Enviar?', icon: 'warning', showCancelButton: true, confirmButtonText: 'Sim' });
    if(!r.isConfirmed) return;

    toggleLoader(true, "Enviando...");
    const inputs = document.querySelectorAll('#campos-dinamicos input, #campos-dinamicos select, #campos-dinamicos textarea');
    let dados = {};
    inputs.forEach(i => { if(i.id !== 'input_outra_inst' || i.style.display !== 'none') dados[i.name] = i.value; });
    if(dados['NomeInstituicao'] === 'Outra') dados['NomeInstituicao'] = document.getElementById('input_outra_inst').value;

    const config = JSON.parse(document.getElementById('form-inscricao').dataset.config);
    const arqs = {};
    try {
        if(config.arquivos?.foto) arqs.foto = { data: await comprimirImagem(document.getElementById('file-foto').files[0]), mime: 'image/jpeg' };
        if(config.arquivos?.doc) { const f = document.getElementById('file-doc').files[0]; arqs.doc = { data: await toBase64(f), mime: f.type }; }
        
        fetch(URL_API, { method: 'POST', body: JSON.stringify({ action: 'novaInscricao', eventoId: document.getElementById('form-inscricao').dataset.idEvento, campos: dados, arquivos: arqs }) })
        .then(res => res.json()).then(j => {
            toggleLoader(false);
            if(j.status === 'success') showSuccess('Sucesso!', `Chave: <strong>${j.chave}</strong>`, () => { document.getElementById('form-inscricao').reset(); voltarHome(); });
            else showError('Erro', j.message);
        });
    } catch(err) { toggleLoader(false); showError('Erro', 'Falha no envio.'); }
}

function consultarChave() {
    const c = document.getElementById('busca-chave').value.trim();
    if(!c) return showError('Atenção', 'Digite a chave.');
    document.getElementById('resultado-busca').innerHTML = 'Buscando...';
    fetch(`${URL_API}?action=consultarInscricao&chave=${c}`).then(r => r.json()).then(j => {
        if(j.status === 'success') {
            let cor = j.data.situacao.includes('Aprovada')||j.data.situacao.includes('Emitida') ? '#10b981' : '#f59e0b';
            let btn = j.data.link_ficha ? `<a href="${j.data.link_ficha}" target="_blank" class="btn-primary" style="text-align:center; text-decoration:none; margin-top:10px;">Baixar Ficha</a>` : '';
            document.getElementById('resultado-busca').innerHTML = `<div class="card" style="border-left:5px solid ${cor}; background:#f0f9ff;"><h3 style="color:${cor}; margin:0;">${j.data.situacao}</h3><p>Data: ${formatarData(j.data.data_inscricao)}</p>${btn}</div>`;
        } else document.getElementById('resultado-busca').innerHTML = `<p style="color:red;">${j.message}</p>`;
    });
}

function voltarHome() { document.getElementById('area-inscricao').classList.add('hidden'); document.getElementById('fab-consulta').classList.remove('hidden'); document.getElementById('lista-eventos').classList.remove('hidden'); }
function formatarData(iso) { if(!iso) return '--'; const p = iso.split('T')[0].split('-'); return p.length<3 ? iso : `${p[2]}/${p[1]}/${p[0]}`; }
const toBase64 = f => new Promise((r, j) => { const rd = new FileReader(); rd.readAsDataURL(f); rd.onload = () => r(rd.result.split(',')[1]); rd.onerror = e => j(e); });
