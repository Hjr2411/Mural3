// app.js
// Configuração do Firebase
const firebaseConfig = {
  apiKey: "AIzaSyCVYvTFM3yoMta2T5AX_3FewmhtkvE9SOA",
  authDomain: "muralhsys.firebaseapp.com",
  databaseURL: "https://muralhsys-default-rtdb.firebaseio.com",
  projectId: "muralhsys",
  storageBucket: "muralhsys.firebasestorage.app",
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
  // Verifica se já tem usuário logado (simulação básica)
  const savedUser = localStorage.getItem('currentUser');
  if (savedUser) {
    try {
      currentUser = JSON.parse(savedUser);
      showPanelBasedOnUser();
    } catch(e) {
      console.warn('Dados de usuário inválidos no localStorage');
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
        // Simulação de persistência 
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

// Fechar modal ao clicar fora
window.addEventListener('click', (e) => {
  if (e.target === sectionModal) sectionModal.style.display = 'none';
  if (e.target === reorderModal) reorderModal.style.display = 'none';
});

// Trocar tipo de conteúdo
sectionType.addEventListener('change', function() {
  contentTypes.forEach(el => el.style.display = 'none');
  document.getElementById(`contentType${capitalizeFirst(this.value)}`).style.display = 'block';
  
  if (this.value === 'table') {
    renderTablePreview();
  } else if (this.value === 'list') {
    renderListPreview();
  } else if (this.value === 'goal') {
    updateGoalPreview();
  }
});

function capitalizeFirst(string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

// Funções para tabelas
document.getElementById('addTableRow').addEventListener('click', () => {
  const nome = document.getElementById('tableNome').value.trim();
  const projeto = document.getElementById('tableProjeto').value.trim();
  const data = document.getElementById('tableData').value.trim();
  
  if (nome && projeto && data) {
    currentTableRows.push({ nome, projeto, data });
    document.getElementById('tableNome').value = '';
    document.getElementById('tableProjeto').value = '';
    document.getElementById('tableData').value = '';
    renderTablePreview();
  }
});

function renderTablePreview() {
  const tbody = document.getElementById('tableRows');
  tbody.innerHTML = '';
  currentTableRows.forEach((row, index) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${row.nome}</td>
      <td>${row.projeto}</td>
      <td>${row.data}</td>
      <td><button class="btn btn-danger" onclick="removeTableRow(${index})">Remover</button></td>
    `;
    tbody.appendChild(tr);
  });
}

window.removeTableRow = function(index) {
  currentTableRows.splice(index, 1);
  renderTablePreview();
};

// Funções para listas
document.getElementById('addListItem').addEventListener('click', () => {
  const nome = document.getElementById('listNome').value.trim();
  const projeto = document.getElementById('listProjeto').value.trim();
  const dia = document.getElementById('listDia').value.trim();
  
  if (nome && projeto && dia) {
    currentListItems.push({ nome, projeto, dia });
    document.getElementById('listNome').value = '';
    document.getElementById('listProjeto').value = '';
    document.getElementById('listDia').value = '';
    renderListPreview();
  }
});

function renderListPreview() {
  const container = document.getElementById('listPreview');
  container.innerHTML = '<strong>Pré-visualização:</strong><div>';
  currentListItems.forEach(item => {
    container.innerHTML += `
      <div class="list-item">
        <strong>${item.nome}</strong> - ${item.projeto} - ${item.dia}
        <button class="btn btn-danger" style="float:right; padding:2px 8px; font-size:12px;" 
                onclick="removeListItem(${currentListItems.indexOf(item)})">x</button>
      </div>
    `;
  });
  container.innerHTML += '</div>';
}

window.removeListItem = function(index) {
  currentListItems.splice(index, 1);
  renderListPreview();
};

// Funções para metas
['goalCurrent', 'goalTotal'].forEach(id => {
  document.getElementById(id)?.addEventListener('input', updateGoalPreview);
});

function updateGoalPreview() {
  const current = parseInt(document.getElementById('goalCurrent').value) || 0;
  const total = parseInt(document.getElementById('goalTotal').value) || 1;
  const percent = Math.min(100, Math.round((current / total) * 100));
  
  const bar = document.querySelector('#goalPreview .progress-bar-inner');
  const text = document.querySelector('#goalPreview .progress-text');
  
  if (bar && text) {
    bar.style.width = `${percent}%`;
    text.textContent = `${percent}% (${current}/${total})`;
  }
}

// Funções para enquetes
document.getElementById('addPollOption').addEventListener('click', () => {
  const container = document.getElementById('pollOptionsContainer');
  const div = document.createElement('div');
  div.className = 'poll-option-input';
  div.style = 'display:flex; gap:5px; margin-bottom:5px;';
  div.innerHTML = `
    <input type="text" placeholder="Nova opção" class="poll-option-field" style="flex:1" />
    <button type="button" class="btn btn-danger remove-option" style="padding:5px 10px;">x</button>
  `;
  container.appendChild(div);
});

// Remover opção de enquete
document.getElementById('pollOptionsContainer').addEventListener('click', (e) => {
  if (e.target.classList.contains('remove-option')) {
    const container = e.target.closest('.poll-option-input');
    if (document.querySelectorAll('.poll-option-input').length > 2) {
      container.remove();
    }
  }
});

// Reordenar seções
reorderSectionsBtn.addEventListener('click', () => {
  loadSectionsForReorder();
  reorderModal.style.display = 'flex';
});

function loadSectionsForReorder() {
  const list = document.getElementById('reorderList');
  list.innerHTML = '';
  
  // Ordenar seções pela ordem
  const orderedSections = Object.entries(sections)
    .sort((a, b) => (a[1].ordem || 0) - (b[1].ordem || 0));
  
  orderedSections.forEach(([id, section]) => {
    const li = document.createElement('li');
    li.className = 'reorder-item';
    li.dataset.id = id;
    li.innerHTML = `
      <span class="drag-handle">☰</span>
      <span>${section.titulo}</span>
    `;
    list.appendChild(li);
  });
  
  // Iniciar arrastar e soltar
  initDragAndDrop();
}

function initDragAndDrop() {
  const list = document.getElementById('reorderList');
  let draggedItem = null;

  list.addEventListener('dragstart', (e) => {
    draggedItem = e.target;
    e.dataTransfer.effectAllowed = 'move';
    setTimeout(() => e.target.classList.add('dragging'), 0);
  });

  list.addEventListener('dragend', (e) => {
    e.target.classList.remove('dragging');
    draggedItem = null;
  });

  list.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const afterElement = getDragAfterElement(list, e.clientY);
    const curElement = document.querySelector('.dragging');
    if (afterElement == null) {
      list.appendChild(curElement);
    } else {
      list.insertBefore(curElement, afterElement);
    }
  });
}

function getDragAfterElement(container, y) {
  const draggableElements = [...container.querySelectorAll('.reorder-item:not(.dragging)')];
  return draggableElements.reduce((closest, child) => {
    const box = child.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;
    if (offset < 0 && offset > closest.offset) {
      return { offset: offset, element: child };
    } else {
      return closest;
    }
  }, { offset: Number.NEGATIVE_INFINITY }).element;
}

// Salvar ordem
saveOrderBtn.addEventListener('click', () => {
  const items = document.querySelectorAll('#reorderList .reorder-item');
  const updates = {};
  
  items.forEach((item, index) => {
    const sectionId = item.dataset.id;
    updates[`secoes/${sectionId}/ordem`] = index;
  });
  
  database.ref().update(updates)
    .then(() => {
      reorderModal.style.display = 'none';
      loadSections(); // Atualiza imediatamente
    })
    .catch(error => {
      console.error('Erro ao salvar ordem:', error);
      alert('Erro ao salvar ordem das seções.');
    });
});

// Salvar seção
saveSectionBtn.addEventListener('click', () => {
  const title = document.getElementById('sectionTitle').value.trim();
  const type = sectionType.value;
  
  if (!title) {
    alert('Por favor, insira um título para a seção.');
    return;
  }

  const newSection = {
    titulo: title,
    tipo: type,
    ordem: Object.keys(sections).length
  };

  // Conteúdo específico por tipo
  switch (type) {
    case 'text':
      const textContent = document.getElementById('textContent').value.trim();
      if (!textContent) {
        alert('Por favor, insira o conteúdo da seção.');
        return;
      }
      newSection.conteudo = { texto: textContent };
      break;

    case 'table':
      if (currentTableRows.length === 0) {
        alert('Por favor, adicione pelo menos uma linha na tabela.');
        return;
      }
      newSection.conteudo = { linhas: currentTableRows };
      break;

    case 'list':
      if (currentListItems.length === 0) {
        alert('Por favor, adicione pelo menos um item na lista.');
        return;
      }
      newSection.conteudo = { itens: currentListItems };
      break;

    case 'goal':
      const current = parseInt(document.getElementById('goalCurrent').value);
      const total = parseInt(document.getElementById('goalTotal').value);
      if (isNaN(current) || isNaN(total) || total <= 0) {
        alert('Por favor, insira valores válidos para a meta.');
        return;
      }
      newSection.conteudo = { 
        titulo: document.getElementById('goalTitle').value || 'Nova Meta',
        atual: current,
        total: total
      };
      break;

    case 'poll':
      const question = document.getElementById('pollQuestion').value.trim();
      const options = Array.from(document.querySelectorAll('.poll-option-field'))
        .map(el => el.value.trim())
        .filter(opt => opt);
      
      if (!question || options.length < 2) {
        alert('Por favor, insira uma pergunta e pelo menos duas opções para a enquete.');
        return;
      }
      
      newSection.conteudo = { 
        pergunta: question,
        opcoes: options.map(opt => ({ texto: opt, votos: 0 }))
      };
      break;

    case 'suggestion':
      newSection.conteudo = { 
        titulo: document.getElementById('suggestionTitle').value || 'Caixa de Sugestões',
        sugestoes: []
      };
      break;
  }

  const updates = {};
  const sectionRef = editingSectionId ? 
    `secoes/${editingSectionId}` : 
    `secoes/${database.ref().push().key}`;
  
  updates[sectionRef] = newSection;
  database.ref().update(updates)
    .then(() => {
      sectionModal.style.display = 'none';
      resetModal();
      if (editingSectionId) {
        editingSectionId = null;
      }
    })
    .catch(error => {
      console.error('Erro ao salvar seção:', error);
      alert('Erro ao salvar seção. Verifique a conexão com o banco de dados.');
    });
});

// Resetar modal
function resetModal() {
  document.getElementById('sectionTitle').value = '';
  sectionType.value = 'text';
  document.getElementById('textContent').value = '';
  currentTableRows = [];
  currentListItems = [];
  document.getElementById('goalTitle').value = '';
  document.getElementById('goalCurrent').value = '';
  document.getElementById('goalTotal').value = '';
  document.getElementById('pollQuestion').value = '';
  const optionsContainer = document.getElementById('pollOptionsContainer');
  optionsContainer.innerHTML = `
    <div class="poll-option-input" style="display:flex; gap:5px; margin-bottom:5px;">
      <input type="text" placeholder="Opção 1" class="poll-option-field" style="flex:1" />
      <button type="button" class="btn btn-danger remove-option" style="padding:5px 10px;">x</button>
    </div>
    <div class="poll-option-input" style="display:flex; gap:5px;">
      <input type="text" placeholder="Opção 2" class="poll-option-field" style="flex:1" />
      <button type="button" class="btn btn-danger remove-option" style="padding:5px 10px;">x</button>
    </div>
  `;
  document.getElementById('suggestionTitle').value = '';
  
  contentTypes.forEach(el => el.style.display = 'none');
  document.getElementById('contentTypeText').style.display = 'block';
}

// Carregar seções (admin)
function loadSections() {
  database.ref('secoes').on('value', (snapshot) => {
    sections = snapshot.val() || {};
    const container = document.getElementById('sectionsList');
    container.innerHTML = '';

    // Ordenar por 'ordem'
    const orderedSections = Object.entries(sections)
      .sort((a, b) => (a[1].ordem || 0) - (b[1].ordem || 0));

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
            <button class="btn btn-success edit-section" data-id="${id}">Editar</button>
            <button class="btn btn-danger delete-section" data-id="${id}">Excluir</button>
          </div>
        </div>
      `;
      container.appendChild(sectionEl);
    });

    // Eventos de edição e exclusão
    document.querySelectorAll('.edit-section').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.target.dataset.id;
        editSection(id);
      });
    });

    document.querySelectorAll('.delete-section').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.target.dataset.id;
        deleteSection(id);
      });
    });
  });
}

function renderAdminPreview(section) {
  switch (section.tipo) {
    case 'text':
      return `<p>${section.conteudo.texto?.replace(/\n/g, '<br>') || 'Sem conteúdo'}</p>`;
    
    case 'table':
      if (!section.conteudo.linhas || section.conteudo.linhas.length === 0) {
        return '<p>Sem dados na tabela.</p>';
      }
      let tableHtml = '<table><thead><tr><th>Nome</th><th>Projeto</th><th>Data</th></tr></thead><tbody>';
      section.conteudo.linhas.forEach(row => {
        tableHtml += `<tr><td>${row.nome}</td><td>${row.projeto}</td><td>${row.data}</td></tr>`;
      });
      tableHtml += '</tbody></table>';
      return tableHtml;

    case 'list':
      if (!section.conteudo.itens || section.conteudo.itens.length === 0) {
        return '<p>Sem itens na lista.</p>';
      }
      let listHtml = '<div>';
      section.conteudo.itens.forEach(item => {
        listHtml += `<div class="list-item"><strong>${item.nome}</strong> - ${item.projeto} - ${item.dia}</div>`;
      });
      listHtml += '</div>';
      return listHtml;

    case 'goal':
      const goal = section.conteudo;
      const percent = Math.min(100, Math.round((goal.atual / goal.total) * 100));
      return `
        <p><strong>${goal.titulo}</strong></p>
        <div class="progress-container">
          <div class="progress-bar-outer">
            <div class="progress-bar-inner" style="width: ${percent}%"></div>
          </div>
          <div class="progress-text">${percent}% (${goal.atual}/${goal.total})</div>
        </div>
      `;

    case 'poll':
      const poll = section.conteudo;
      let pollHtml = `<p><strong>${poll.pergunta}</strong></p><div>`;
      poll.opcoes.forEach((opt, index) => {
        pollHtml += `
          <div class="poll-option">
            <input type="radio" name="poll-${section.titulo}" id="opt-${index}" disabled>
            <label for="opt-${index}">${opt.texto}</label>
          </div>
        `;
      });
      pollHtml += '</div>';
      return pollHtml;

    case 'suggestion':
      return `
        <p>${section.conteudo.titulo}</p>
        <p><em>Os colaboradores podem enviar sugestões. Você poderá visualizá-las no painel administrativo.</em></p>
      `;

    default:
      return '<p>Conteúdo não suportado.</p>';
  }
}

// Editar seção
function editSection(id) {
  const section = sections[id];
  if (!section) return;

  editingSectionId = id;
  document.getElementById('sectionTitle').value = section.titulo;
  sectionType.value = section.tipo;

  // Resetar conteúdos
  currentTableRows = [];
  currentListItems = [];

  // Preencher campos
  switch (section.tipo) {
    case 'text':
      document.getElementById('textContent').value = section.conteudo.texto || '';
      break;

    case 'table':
      currentTableRows = [...(section.conteudo.linhas || [])];
      renderTablePreview();
      break;

    case 'list':
      currentListItems = [...(section.conteudo.itens || [])];
      renderListPreview();
      break;

    case 'goal':
      document.getElementById('goalTitle').value = section.conteudo.titulo || '';
      document.getElementById('goalCurrent').value = section.conteudo.atual || 0;
      document.getElementById('goalTotal').value = section.conteudo.total || 1;
      updateGoalPreview();
      break;

    case 'poll':
      document.getElementById('pollQuestion').value = section.conteudo.pergunta || '';
      const container = document.getElementById('pollOptionsContainer');
      container.innerHTML = '';
      (section.conteudo.opcoes || []).forEach(opt => {
        const div = document.createElement('div');
        div.className = 'poll-option-input';
        div.style = 'display:flex; gap:5px; margin-bottom:5px;';
        div.innerHTML = `
          <input type="text" value="${opt.texto}" class="poll-option-field" style="flex:1" />
          <button type="button" class="btn btn-danger remove-option" style="padding:5px 10px;">x</button>
        `;
        container.appendChild(div);
      });
      break;

    case 'suggestion':
      document.getElementById('suggestionTitle').value = section.conteudo.titulo || '';
      break;
  }

  // Mostrar conteúdo correto
  contentTypes.forEach(el => el.style.display = 'none');
  document.getElementById(`contentType${capitalizeFirst(section.tipo)}`).style.display = 'block';

  // Abrir modal
  sectionModal.style.display = 'flex';
}

// Excluir seção
function deleteSection(id) {
  if (confirm('Tem certeza que deseja excluir esta seção?')) {
    database.ref(`secoes/${id}`).remove()
      .then(() => {
        // Atualizar ordens
        const remainingSections = Object.entries(sections)
          .filter(([key]) => key !== id)
          .sort((a, b) => (a[1].ordem || 0) - (b[1].ordem || 0));
        
        const updates = {};
        remainingSections.forEach(([secId, sec], index) => {
          updates[`secoes/${secId}/ordem`] = index;
        });
        
        return database.ref().update(updates);
      })
      .catch(error => {
        console.error('Erro ao excluir seção:', error);
        alert('Erro ao excluir seção.');
      });
  }
}

// Carregar mural (leitor)
function loadMuralContent() {
  database.ref('secoes').on('value', (snapshot) => {
    const data = snapshot.val() || {};
    const container = document.getElementById('muralContent');
    container.innerHTML = '';

    // Ordenar por 'ordem'
    const orderedSections = Object.entries(data)
      .sort((a, b) => (a[1].ordem || 0) - (b[1].ordem || 0));

    orderedSections.forEach(([id, section]) => {
      const sectionEl = document.createElement('div');
      sectionEl.className = 'section-card';
      sectionEl.innerHTML = `
        <div class="section-header">${section.titulo}</div>
        <div class="section-body">${renderReaderContent(section, id)}</div>
      `;
      container.appendChild(sectionEl);
    });
  });
}

function renderReaderContent(section, sectionId) {
  switch (section.tipo) {
    case 'text':
      return `<p>${section.conteudo.texto?.replace(/\n/g, '<br>') || 'Sem conteúdo'}</p>`;
    
    case 'table':
      if (!section.conteudo.linhas || section.conteudo.linhas.length === 0) {
        return '<p>Sem dados disponíveis.</p>';
      }
      let tableHtml = '<table><thead><tr><th>Nome</th><th>Projeto</th><th>Data</th></tr></thead><tbody>';
      section.conteudo.linhas.forEach(row => {
        tableHtml += `<tr><td>${row.nome}</td><td>${row.projeto}</td><td>${row.data}</td></tr>`;
      });
      tableHtml += '</tbody></table>';
      return tableHtml;

    case 'list':
      if (!section.conteudo.itens || section.conteudo.itens.length === 0) {
        return '<p>Sem itens disponíveis.</p>';
      }
      let listHtml = '<div>';
      section.conteudo.itens.forEach(item => {
        listHtml += `<div class="list-item"><strong>${item.nome}</strong> - ${item.projeto} - ${item.dia}</div>`;
      });
      listHtml += '</div>';
      return listHtml;

    case 'goal':
      const goal = section.conteudo;
      const percent = Math.min(100, Math.round((goal.atual / goal.total) * 100));
      return `
        <p><strong>${goal.titulo}</strong></p>
        <div class="progress-container">
          <div class="progress-bar-outer">
            <div class="progress-bar-inner" style="width: ${percent}%"></div>
          </div>
          <div class="progress-text">${percent}% (${goal.atual}/${goal.total})</div>
        </div>
      `;

    case 'poll':
      const poll = section.conteudo;
      let pollHtml = `<p><strong>${poll.pergunta}</strong></p><div id="poll-${sectionId}">`;
      poll.opcoes.forEach((opt, index) => {
        pollHtml += `
          <div class="poll-option">
            <input type="radio" name="poll-${sectionId}" id="poll-${sectionId}-opt${index}" 
                   data-index="${index}" onchange="votePoll('${sectionId}', ${index})">
            <label for="poll-${sectionId}-opt${index}">${opt.texto}</label>
          </div>
        `;
      });
      pollHtml += `
        </div>
        <div class="poll-results" id="poll-results-${sectionId}" style="display:none;">
          <strong>Resultados:</strong>
          <div id="poll-bars-${sectionId}"></div>
          <div>Total de votos: <span id="poll-total-${sectionId}">0</span></div>
        </div>
        <button class="btn btn-success" onclick="showPollResults('${sectionId}')" 
                id="show-results-${sectionId}" style="margin-top:10px;">Ver Resultados</button>
      `;
      return pollHtml;

    case 'suggestion':
      return `
        <p>${section.conteudo.titulo}</p>
        <div class="suggestion-form">
          <textarea id="suggestionText-${sectionId}" placeholder="Digite sua sugestão aqui..."></textarea>
          <button class="btn btn-primary" onclick="submitSuggestion('${sectionId}')">Enviar Sugestão</button>
          <div class="suggestion-thanks" id="suggestionThanks-${sectionId}">Sugestão enviada com sucesso! Obrigado.</div>
        </div>
      `;

    default:
      return '<p>Conteúdo não disponível.</p>';
  }
}

// Votar em enquete
window.votePoll = function(sectionId, optionIndex) {
  const sectionRef = database.ref(`secoes/${sectionId}`);
  sectionRef.transaction(currentSection => {
    if (currentSection && currentSection.conteudo.opcoes[optionIndex]) {
      currentSection.conteudo.opcoes[optionIndex].votos += 1;
    }
    return currentSection;
  }).then(() => {
    // Desabilitar opções após votar
    document.querySelectorAll(`#poll-${sectionId} input[type="radio"]`).forEach(radio => {
      radio.disabled = true;
    });
    alert('Voto registrado com sucesso!');
  }).catch(error => {
    console.error('Erro ao votar:', error);
    alert('Erro ao registrar voto. Verifique a conexão.');
  });
};

// Mostrar resultados da enquete
window.showPollResults = function(sectionId) {
  const sectionRef = database.ref(`secoes/${sectionId}`);
  sectionRef.once('value', (snapshot) => {
    const section = snapshot.val();
    if (!section || section.tipo !== 'poll') return;

    const resultsContainer = document.getElementById(`poll-results-${sectionId}`);
    const barsContainer = document.getElementById(`poll-bars-${sectionId}`);
    const totalSpan = document.getElementById(`poll-total-${sectionId}`);
    
    let totalVotes = 0;
    section.conteudo.opcoes.forEach(opt => {
      totalVotes += opt.votos || 0;
    });

    barsContainer.innerHTML = '';
    section.conteudo.opcoes.forEach(opt => {
      const percent = totalVotes > 0 ? (opt.votos / totalVotes) * 100 : 0;
      barsContainer.innerHTML += `
        <div>${opt.texto}: ${opt.votos} voto(s)</div>
        <div class="poll-result-bar">
          <div class="poll-result-fill" style="width: ${percent}%"></div>
        </div>
      `;
    });

    totalSpan.textContent = totalVotes;
    resultsContainer.style.display = 'block';
    document.getElementById(`show-results-${sectionId}`).style.display = 'none';
  }).catch(error => {
    console.error('Erro ao carregar resultados:', error);
    alert('Erro ao carregar resultados.');
  });
};

// Enviar sugestão
window.submitSuggestion = function(sectionId) {
  const textArea = document.getElementById(`suggestionText-${sectionId}`);
  const text = textArea.value.trim();
  if (!text) {
    alert('Por favor, digite sua sugestão.');
    return;
  }

  const suggestionRef = database.ref(`secoes/${sectionId}/conteudo/sugestoes`).push();
  suggestionRef.set({
    texto: text,
    timestamp: firebase.database.ServerValue.TIMESTAMP,
    colaborador: currentUser.nome || 'Anônimo'
  }).then(() => {
    textArea.value = '';
    document.getElementById(`suggestionThanks-${sectionId}`).style.display = 'block';
    setTimeout(() => {
      document.getElementById(`suggestionThanks-${sectionId}`).style.display = 'none';
    }, 3000);
  }).catch(error => {
    console.error('Erro ao enviar sugestão:', error);
    alert('Erro ao enviar sugestão. Verifique a conexão.');
  });
};
