// app.js
// Configuração do Firebase
const firebaseConfig = {
  apiKey: "AIzaSyCVYvTFM3yoMta2T5AX_3FewmhtkvE9SOA",
  authDomain: "muralhsys.firebaseapp.com",
  databaseURL: "https://muralhsys-default-rtdb.firebaseio.com",
  projectId: "muralhsys",
  storageBucket: "muralhsys.appspot.com",
  messagingSenderId: "652168528324",
  appId: "1:652168528324:web:741aa4779c1f7a149c6491",
  measurementId: "G-FMKBG2M0PE"
};

// Inicializar Firebase
firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// Elementos DOM
const loginScreen = document.getElementById('loginScreen');
const adminPanel = document.getElementById('adminPanel');
const readerView = document.getElementById('readerView');
const loginBtn = document.getElementById('loginBtn');
const logoutBtn = document.getElementById('logoutBtn');
const logoutBtnReader = document.getElementById('logoutBtnReader');
const addSectionBtn = document.getElementById('addSectionBtn');
const reorderSectionsBtn = document.getElementById('reorderSectionsBtn');
const sectionModal = document.getElementById('sectionModal');
const reorderModal = document.getElementById('reorderModal');
const closeModal = document.querySelectorAll('.close-modal');
const sectionType = document.getElementById('sectionType');
const contentTypes = document.querySelectorAll('.content-type');
const saveSectionBtn = document.getElementById('saveSectionBtn');
const saveOrderBtn = document.getElementById('saveOrderBtn');

// Variáveis de estado
let currentUser = null;
let sections = {};
let editingSectionId = null;
let currentTableRows = [];
let currentListItems = [];

// Verificar conexão com o Firebase
database.ref('.info/connected').on('value', (snapshot) => {
  if (snapshot.val() === true) {
    console.log('Conectado ao Firebase Realtime Database');
  } else {
    console.log('Desconectado do Firebase Realtime Database');
    alert('Erro de conexão com o banco de dados. Verifique sua conexão com a internet.');
  }
});

// Inicialização
window.onload = function() {
  const savedUser = localStorage.getItem('currentUser');
  if (savedUser) {
    try {
      currentUser = JSON.parse(savedUser);
      showPanelBasedOnUser();
    } catch(e) {
      console.warn('Dados de usuário inválidos no localStorage');
      localStorage.removeItem('currentUser');
    }
  }
};

// Login
loginBtn.addEventListener('click', async () => {
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value.trim();
  const errorDiv = document.getElementById('loginError');
  
  if (!username || !password) {
    errorDiv.textContent = 'Por favor, preencha todos os campos.';
    return;
  }

  try {
    const snapshot = await database.ref('usuarios').orderByChild('nome').equalTo(username).once('value');
    const users = snapshot.val();
    
    if (users) {
      const userKey = Object.keys(users)[0];
      const user = users[userKey];
      
      if (user.senha === password) {
        currentUser = user;
        currentUser.key = userKey;
        try {
          localStorage.setItem('currentUser', JSON.stringify(user));
        } catch(e) {
          console.warn('localStorage não disponível');
        }
        showPanelBasedOnUser();
        errorDiv.textContent = '';
      } else {
        errorDiv.textContent = 'Senha incorreta.';
      }
    } else {
      errorDiv.textContent = 'Usuário não encontrado.';
    }
  } catch (error) {
    console.error('Erro ao fazer login:', error);
    errorDiv.textContent = 'Erro ao conectar ao servidor. Verifique a conexão com o banco de dados.';
  }
});

// Mostrar painel com base no usuário
function showPanelBasedOnUser() {
  loginScreen.style.display = 'none';
  if (currentUser.tipo === 'admin') {
    adminPanel.style.display = 'block';
    loadSections();
  } else {
    readerView.style.display = 'block';
    loadMuralContent();
  }
}

// Logout
[logoutBtn, logoutBtnReader].forEach(btn => {
  btn.addEventListener('click', () => {
    currentUser = null;
    try {
      localStorage.removeItem('currentUser');
    } catch(e) {}
    loginScreen.style.display = 'flex';
    adminPanel.style.display = 'none';
    readerView.style.display = 'none';
    document.getElementById('username').value = '';
    document.getElementById('password').value = '';
  });
});

// Abrir modal de nova seção
addSectionBtn.addEventListener('click', () => {
  editingSectionId = null;
  resetModal();
  sectionModal.style.display = 'flex';
});

// Fechar modais
closeModal.forEach(btn => {
  btn.addEventListener('click', () => {
    sectionModal.style.display = 'none';
    reorderModal.style.display = 'none';
  });
});

window.addEventListener('click', (e) => {
  if (e.target === sectionModal) sectionModal.style.display = 'none';
  if (e.target === reorderModal) reorderModal.style.display = 'none';
});

// Trocar tipo de conteúdo no modal
sectionType.addEventListener('change', function() {
  contentTypes.forEach(el => el.style.display = 'none');
  const selectedType = `contentType${this.value.charAt(0).toUpperCase() + this.value.slice(1)}`;
  document.getElementById(selectedType).style.display = 'block';
  
  if (this.value === 'goal') {
    updateGoalPreview();
  }
});

// Salvar seção (NOVO E ATUALIZADO)
saveSectionBtn.addEventListener('click', () => {
  const title = document.getElementById('sectionTitle').value.trim();
  const type = sectionType.value;
  
  if (!title) {
    alert('Por favor, insira um título para a seção.');
    return;
  }

  const sectionData = {
    titulo: title,
    tipo: type,
    ordem: editingSectionId ? sections[editingSectionId].ordem : Object.keys(sections).length
  };

  // Coleta dados específicos do tipo de seção
  switch (type) {
    case 'text':
      sectionData.conteudo = { texto: document.getElementById('textContent').value.trim() };
      if (!sectionData.conteudo.texto) { alert('O campo de texto não pode estar vazio.'); return; }
      break;
    case 'table':
      sectionData.conteudo = { linhas: currentTableRows };
      if (currentTableRows.length === 0) { alert('Adicione pelo menos uma linha na tabela.'); return; }
      break;
    case 'list':
      sectionData.conteudo = { itens: currentListItems };
      if (currentListItems.length === 0) { alert('Adicione pelo menos um item na lista.'); return; }
      break;
    case 'goal':
      const current = parseInt(document.getElementById('goalCurrent').value);
      const total = parseInt(document.getElementById('goalTotal').value);
      if (isNaN(current) || isNaN(total) || total <= 0) { alert('Insira valores válidos para a meta.'); return; }
      sectionData.conteudo = { 
        titulo: document.getElementById('goalTitle').value || 'Nova Meta',
        atual: current, total: total
      };
      break;
    case 'poll':
      const question = document.getElementById('pollQuestion').value.trim();
      const options = Array.from(document.querySelectorAll('.poll-option-field')).map(el => el.value.trim()).filter(Boolean);
      if (!question || options.length < 2) { alert('Insira uma pergunta e pelo menos duas opções para a enquete.'); return; }
      sectionData.conteudo = { 
        pergunta: question,
        opcoes: options.map(opt => ({ texto: opt, votos: 0 }))
      };
      break;
    case 'suggestion':
      sectionData.conteudo = { 
        titulo: document.getElementById('suggestionTitle').value.trim() || 'Caixa de Sugestões',
        sugestoes: {}
      };
      break;
  }

  const sectionId = editingSectionId || database.ref().child('secoes').push().key;
  database.ref(`secoes/${sectionId}`).set(sectionData)
    .then(() => {
      sectionModal.style.display = 'none';
      resetModal();
    })
    .catch(error => {
      console.error("Erro ao salvar seção:", error);
      alert("Erro ao salvar a seção. Verifique a conexão.");
    });
});


// Resetar o Modal (NOVO E ATUALIZADO)
function resetModal() {
  document.getElementById('sectionModal').querySelector('form, div').scrollTop = 0;
  document.getElementById('sectionTitle').value = '';
  document.getElementById('textContent').value = '';
  sectionType.value = 'text';
  contentTypes.forEach(el => el.style.display = 'none');
  document.getElementById('contentTypeText').style.display = 'block';
  
  // Limpar tabela
  currentTableRows = [];
  renderTablePreview();

  // Limpar lista
  currentListItems = [];
  renderListPreview();
  
  // Limpar meta
  document.getElementById('goalTitle').value = '';
  document.getElementById('goalCurrent').value = '';
  document.getElementById('goalTotal').value = '';
  updateGoalPreview();
  
  // Limpar enquete
  document.getElementById('pollQuestion').value = '';
  const pollOptionsContainer = document.getElementById('pollOptionsContainer');
  pollOptionsContainer.innerHTML = `
    <div class="poll-option-input" style="display:flex; gap:5px; margin-bottom:5px;">
      <input type="text" placeholder="Opção 1" class="poll-option-field" style="flex:1" />
      <button type="button" class="btn btn-danger remove-option" style="padding:5px 10px;">x</button>
    </div>
    <div class="poll-option-input" style="display:flex; gap:5px;">
      <input type="text" placeholder="Opção 2" class="poll-option-field" style="flex:1" />
      <button type="button" class="btn btn-danger remove-option" style="padding:5px 10px;">x</button>
    </div>`;

  // Limpar sugestão
  document.getElementById('suggestionTitle').value = '';
}


// --- Lógica para Enquetes ---
document.getElementById('addPollOption').addEventListener('click', () => {
  const container = document.getElementById('pollOptionsContainer');
  const div = document.createElement('div');
  div.className = 'poll-option-input';
  div.style = 'display:flex; gap:5px; margin-bottom:5px;';
  div.innerHTML = `
    <input type="text" placeholder="Nova opção" class="poll-option-field" style="flex:1" />
    <button type="button" class="btn btn-danger remove-option" style="padding:5px 10px;">x</button>`;
  container.appendChild(div);
});

document.getElementById('pollOptionsContainer').addEventListener('click', (e) => {
  if (e.target.classList.contains('remove-option')) {
    const container = e.target.closest('.poll-option-input');
    if (document.querySelectorAll('.poll-option-input').length > 2) {
      container.remove();
    } else {
      alert('A enquete precisa de no mínimo 2 opções.');
    }
  }
});


// --- Lógica de Renderização ---

// Carregar seções no painel Admin
function loadSections() {
  database.ref('secoes').on('value', (snapshot) => {
    sections = snapshot.val() || {};
    const container = document.getElementById('sectionsList');
    container.innerHTML = '';

    const orderedSections = Object.entries(sections).sort((a, b) => (a[1].ordem || 0) - (b[1].ordem || 0));

    orderedSections.forEach(([id, section]) => {
      const sectionEl = document.createElement('div');
      sectionEl.className = 'section-card';
      sectionEl.innerHTML = `
        <div class="section-header">
          ${section.titulo}
          <span style="float:right; font-size:14px; opacity:0.8;">(${section.tipo})</span>
        </div>
        <div class="section-body">
          ${renderAdminPreview(section)}
          <div style="margin-top:15px; text-align:right;">
            <button class="btn btn-warning" onclick="editSection('${id}')">Editar</button>
            <button class="btn btn-danger" onclick="deleteSection('${id}')">Excluir</button>
          </div>
        </div>`;
      container.appendChild(sectionEl);
    });
  });
}

// Renderizar preview para o Admin (NOVO E ATUALIZADO)
function renderAdminPreview(section) {
  const c = section.conteudo;
  switch (section.tipo) {
    case 'text': return `<p>${c.texto?.replace(/\n/g, '<br>') || 'Sem conteúdo'}</p>`;
    case 'table':
      if (!c.linhas?.length) return '<p>Tabela vazia.</p>';
      let table = '<table><thead><tr><th>Nome</th><th>Projeto</th><th>Data</th></tr></thead><tbody>';
      c.linhas.forEach(row => { table += `<tr><td>${row.nome}</td><td>${row.projeto}</td><td>${row.data}</td></tr>`; });
      return table + '</tbody></table>';
    case 'list':
      if (!c.itens?.length) return '<p>Lista vazia.</p>';
      return c.itens.map(item => `<div class="list-item"><strong>${item.nome}</strong> - ${item.projeto} - ${item.dia}</div>`).join('');
    case 'goal':
      const percent = Math.min(100, Math.round((c.atual / c.total) * 100));
      return `<p><strong>${c.titulo}</strong></p><div class="progress-container"><div class="progress-bar-outer"><div class="progress-bar-inner" style="width: ${percent}%"></div></div><div class="progress-text">${percent}% (${c.atual}/${c.total})</div></div>`;
    case 'poll':
      let pollPrev = `<p><strong>${c.pergunta}</strong></p>`;
      c.opcoes.forEach(opt => { pollPrev += `<div class="list-item">${opt.texto}</div>`; });
      return pollPrev;
    case 'suggestion':
      return `<p><strong>${c.titulo}</strong></p><p><em>Clique em "Editar" para ver as sugestões enviadas.</em></p>`;
    default: return '<p>Tipo de seção desconhecido.</p>';
  }
}

// Carregar mural do leitor
function loadMuralContent() {
  database.ref('secoes').on('value', (snapshot) => {
    const data = snapshot.val() || {};
    const container = document.getElementById('muralContent');
    container.innerHTML = '';
    
    const orderedSections = Object.entries(data).sort((a, b) => (a[1].ordem || 0) - (b[1].ordem || 0));

    orderedSections.forEach(([id, section]) => {
      const sectionEl = document.createElement('div');
      sectionEl.className = 'section-card';
      sectionEl.innerHTML = `
        <div class="section-header">${section.titulo}</div>
        <div class="section-body">${renderReaderContent(section, id)}</div>`;
      container.appendChild(sectionEl);
    });
  });
}

// Renderizar conteúdo para o Leitor (NOVO E ATUALIZADO)
function renderReaderContent(section, sectionId) {
  const c = section.conteudo;
  switch (section.tipo) {
    case 'text':
    case 'table':
    case 'list':
    case 'goal':
      return renderAdminPreview(section); // Reutiliza a mesma lógica de preview
    
    case 'poll':
      let pollHtml = `<p><strong>${c.pergunta}</strong></p><div id="poll-${sectionId}">`;
      c.opcoes.forEach((opt, index) => {
        pollHtml += `
          <div class="poll-option">
            <input type="radio" name="poll-${sectionId}" id="poll-${sectionId}-opt${index}" onchange="votePoll('${sectionId}', ${index})">
            <label for="poll-${sectionId}-opt${index}">${opt.texto}</label>
          </div>`;
      });
      pollHtml += `</div><div class="poll-results" id="poll-results-${sectionId}" style="display:none;"></div>
      <button class="btn btn-primary" onclick="showPollResults('${sectionId}', this)" style="margin-top:10px;">Ver Resultados</button>`;
      return pollHtml;

    case 'suggestion':
      return `
        <p><strong>${c.titulo}</strong></p>
        <div class="suggestion-form">
          <textarea id="suggestionText-${sectionId}" placeholder="Sua sugestão é importante..."></textarea>
          <button class="btn btn-primary" onclick="submitSuggestion('${sectionId}')">Enviar Sugestão</button>
          <div class="suggestion-thanks" id="suggestionThanks-${sectionId}">Obrigado pela sua contribuição!</div>
        </div>`;
    default: return '<p>Conteúdo indisponível.</p>';
  }
}

// Funções de Interação do Leitor
window.votePoll = function(sectionId, optionIndex) {
  const pollOptionsDiv = document.getElementById(`poll-${sectionId}`);
  pollOptionsDiv.querySelectorAll('input').forEach(radio => radio.disabled = true);
  
  const voteRef = database.ref(`secoes/${sectionId}/conteudo/opcoes/${optionIndex}/votos`);
  voteRef.transaction(currentVotes => (currentVotes || 0) + 1)
    .then(() => {
      alert('Voto registrado! Clique em "Ver Resultados" para acompanhar.');
    }).catch(error => {
      console.error("Erro ao votar:", error);
      alert("Não foi possível registrar seu voto.");
    });
};

window.showPollResults = function(sectionId, button) {
  database.ref(`secoes/${sectionId}/conteudo`).once('value').then(snapshot => {
    const content = snapshot.val();
    const totalVotes = content.opcoes.reduce((sum, opt) => sum + (opt.votos || 0), 0);
    
    let resultsHtml = `<strong>Resultados (${totalVotes} votos):</strong>`;
    content.opcoes.forEach(opt => {
      const percent = totalVotes > 0 ? Math.round(((opt.votos || 0) / totalVotes) * 100) : 0;
      resultsHtml += `
        <div>${opt.texto} (${opt.votos || 0} votos)</div>
        <div class="poll-result-bar">
          <div class="poll-result-fill" style="width: ${percent}%">${percent}%</div>
        </div>`;
    });
    
    document.getElementById(`poll-results-${sectionId}`).innerHTML = resultsHtml;
    document.getElementById(`poll-results-${sectionId}`).style.display = 'block';
    button.style.display = 'none'; // Esconde o botão após mostrar os resultados
  });
};

window.submitSuggestion = function(sectionId) {
  const textArea = document.getElementById(`suggestionText-${sectionId}`);
  const text = textArea.value.trim();
  if (!text) { alert('Por favor, escreva sua sugestão.'); return; }

  const newSuggestionRef = database.ref(`secoes/${sectionId}/conteudo/sugestoes`).push();
  newSuggestionRef.set({
    texto: text,
    data: new Date().toISOString(),
    autor: currentUser.nome || 'Anônimo'
  }).then(() => {
    textArea.value = '';
    const thanksMsg = document.getElementById(`suggestionThanks-${sectionId}`);
    thanksMsg.style.display = 'block';
    setTimeout(() => { thanksMsg.style.display = 'none'; }, 4000);
  }).catch(error => {
    console.error("Erro ao enviar sugestão:", error);
    alert("Não foi possível enviar sua sugestão.");
  });
};


// --- Funções Auxiliares (Tabela, Lista, Meta) ---
// (O restante do seu código JS original para gerenciar tabelas, listas, metas, reordenação e exclusão permanece aqui)
// ...
// Adicione o resto do seu código JS que não foi modificado aqui.
// As funções como `editSection`, `deleteSection`, `reorderSectionsBtn`, etc.,
// precisam estar presentes para que o sistema funcione completamente.
// Para fins de concisão, o código repetido foi omitido.

// Exemplo:
function editSection(id) { /* ... seu código original ... */ }
function deleteSection(id) { /* ... seu código original ... */ }
// ... e assim por diante
