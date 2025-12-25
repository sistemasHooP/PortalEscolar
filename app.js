const URL_API = 'https://script.google.com/macros/s/AKfycbyQVT1GE4rLNCq50_YpHXMpkC6NwLTH5vW5kbTShaNFeBiO9DXYyU-S3qq8iVm_YRxtsQ/exec';

// Campos disponíveis no sistema (Mapeamento)
const CAMPO_DEFS = {
    'NomeCompleto': { label: 'Nome Completo', type: 'text' },
    'CPF': { label: 'CPF', type: 'text' },
    'Email': { label: 'E-mail', type: 'email' },
    'Telefone': { label: 'Celular (WhatsApp)', type: 'tel' },
    'DataNascimento': { label: 'Data de Nascimento', type: 'date' },
    'Instituicao': { label: 'Nome da Instituição', type: 'text' },
    'Curso': { label: 'Curso', type: 'text' }
};

// Inicialização
document.addEventListener('DOMContentLoaded', carregarEventos);

function carregarEventos() {
    fetch(`${URL_API}?action=getEventosAtivos`)
        .then(res => res.json())
        .then(json => {
            const container = document.getElementById('cards-container');
            container.innerHTML = '';
            
            json.data.forEach(evento => {
                const div = document.createElement('div');
                div.className = 'card';
                div.innerHTML = `
                    <h3>${evento.titulo}</h3>
                    <p>${evento.descricao}</p>
                    <small>Até: ${new Date(evento.fim).toLocaleDateString()}</small><br><br>
                    <button onclick='abrirInscricao(${JSON.stringify(evento)})'>Inscrever-se</button>
                `;
                container.appendChild(div);
            });
        });
}

function abrirInscricao(evento) {
    document.getElementById('lista-eventos').classList.add('hidden');
    document.getElementById('area-consulta').classList.add('hidden');
    document.getElementById('area-inscricao').classList.remove('hidden');
    document.getElementById('titulo-evento').innerText = evento.titulo;
    document.getElementById('form-inscricao').dataset.idEvento = evento.id;

    // Gerar campos dinâmicos
    const areaCampos = document.getElementById('campos-dinamicos');
    areaCampos.innerHTML = '';
    
    // O backend envia "campos" como string JSON, precisamos parsear
    const listaCampos = JSON.parse(evento.campos); 
    
    listaCampos.forEach(campoKey => {
        if(CAMPO_DEFS[campoKey]) {
            const def = CAMPO_DEFS[campoKey];
            areaCampos.innerHTML += `
                <label>${def.label}</label>
                <input type="${def.type}" name="${campoKey}" required>
            `;
        }
    });
}

async function enviarInscricao(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button');
    btn.disabled = true;
    btn.innerText = "Enviando...";

    // Coleta dados dos inputs dinâmicos
    const inputs = document.querySelectorAll('#campos-dinamicos input');
    let dadosCampos = {};
    inputs.forEach(input => dadosCampos[input.name] = input.value);

    // Converte arquivos para Base64
    const fileFoto = document.getElementById('file-foto').files[0];
    const fileDoc = document.getElementById('file-doc').files[0];

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

    fetch(URL_API, {
        method: 'POST',
        body: JSON.stringify(payload)
    })
    .then(res => res.json())
    .then(json => {
        if(json.status === 'success') {
            alert(`Sucesso! Sua chave de inscrição é: ${json.chave}. Guarde-a!`);
            location.reload();
        } else {
            alert('Erro: ' + json.message);
        }
    });
}

// Utilitário para converter arquivo em Base64 para enviar via JSON
const toBase64 = file => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = error => reject(error);
});

function consultarChave() {
    const chave = document.getElementById('busca-chave').value;
    if(!chave) return;

    fetch(`${URL_API}?action=consultarInscricao&chave=${chave}`)
        .then(res => res.json())
        .then(json => {
            const div = document.getElementById('resultado-busca');
            if(json.status === 'success') {
                div.innerHTML = `
                    <div class="card" style="background:#e8f5e9">
                        <p><strong>Status:</strong> ${json.data.situacao}</p>
                        <p><strong>Data:</strong> ${new Date(json.data.data_inscricao).toLocaleDateString()}</p>
                    </div>
                `;
            } else {
                div.innerHTML = `<p style="color:red">${json.message}</p>`;
            }
        });
}

function voltarHome() {
    location.reload();

}
