// Inicializar Firebase
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

firebase.initializeApp(firebaseConfig);
const database = firebase.database();

let currentUser = null;
let secoes = [];
let usuarios = [];

// Referências do Firebase
const secoesRef = database.ref('mural/secoes');
const usuariosRef = database.ref('mural/usuarios');
const ordemRef = database.ref('mural/ordemCards');

// Carregar dados iniciais
function loadData() {
  usuariosRef.once('value').then(snapshot => {
    usuarios = snapshot.val() || {
      helio: { username: 'helio', password: '97616896', type: 'admin' }
    };
    // Salvar se não existir
    if (!snapshot.val()) {
      usuariosRef.set(usuarios);
    }
  });

  secoesRef.on('value', snapshot => {
    secoes = Object.values(snapshot.val() || {});
    loadMural();
  });
}

// Login
function login() {
  const username = document.getElementById('username').value.trim().toLowerCase();
  const password = document.getElementById('password').value;

  usuariosRef.child(username).once('value').then(snapshot => {
    const user = snapshot.val();
    if (!user || user.password !== password) {
      alert('Usuário ou senha incorretos.');
      return;
    }

    currentUser = user;
    document.getElementById('userDisplay').textContent = `(${username})`;
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('mainApp').style.display = 'block';

    if (user.type === 'admin') {
      document.getElementById('adminPanelBtn').style.display = 'inline-block';
    }

    loadData();
  });
}

function logout() {
  currentUser = null;
  document.getElementById('mainApp').style.display = 'none';
  document.getElementById('loginScreen').style.display = 'block';
  document.getElementById('username').value = '';
  document.getElementById('password').value = '';
}

// Carregar mural
function loadMural() {
  const muralContent = document.getElementById('muralContent');
  muralContent.innerHTML = '';

  ordemRef.once('value').then(orderSnap => {
    const ordem = orderSnap.val() || secoes.map(s => s.id);
    const secoesOrdenadas = ordem
      .map(id => secoes.find(s => s.id === id))
      .filter(Boolean);

    secoesOrdenadas.forEach(secao => {
      const card = createCard(secao);
      muralContent.appendChild(card);
    });

    const now = new Date().toLocaleString();
    document.getElementById('lastUpdate').textContent = now;
  });
}

function createCard(secao) {
  const card = document.createElement('div');
  card.className = 'card';
  card.dataset.id = secao.id;
  card.draggable = currentUser?.type === 'admin';

  const header = document.createElement('h3');
  header.textContent = secao.titulo;
  card.appendChild(header);

  if (secao.tipo === 'enquete') {
    const container = document.createElement('div');
    container.className = 'enquete-container';

    const pergunta = document.createElement('p');
    pergunta.textContent = secao.pergunta || 'Enquete';
    container.appendChild(pergunta);

    const botoes = document.createElement('div');
    botoes.className = 'enquete-opcoes';

    ['Sim', 'Não'].forEach(opcao => {
      const btn = document.createElement('button');
      btn.className = 'enquete-opcao';
      btn.textContent = opcao;
      btn.disabled = (secao.votos?.usuarioVotou || []).includes(currentUser?.username);
      btn.onclick = () => votarEnquete(secao.id, opcao);
      botoes.appendChild(btn);
    });

    container.appendChild(botoes);

    const result = document.createElement('div');
    result.className = 'enquete-result';
    result.id = `result-${secao.id}`;
    updateEnqueteResult(secao, result);
    container.appendChild(result);

    card.appendChild(container);
  }

  else if (secao.tipo === 'sugestao') {
    const container = document.createElement('div');
    container.className = 'sugestao-container';

    const textarea = document.createElement('textarea');
    textarea.className = 'sugestao-textarea';
    textarea.placeholder = 'Escreva sua sugestão aqui...';

    const btn = document.createElement('button');
    btn.className = 'sugestao-enviar';
    btn.textContent = 'Enviar';
    btn.onclick = () => {
      const texto = textarea.value.trim();
      if (texto) {
        const msgRef = database.ref(`mural/secoes/${secao.id}/mensagens`).push();
        msgRef.set({
          texto,
          usuario: currentUser.username,
          data: new Date().toLocaleString(),
          lida: false
        }).then(() => {
          textarea.value = '';
        });
      }
    };

    container.appendChild(textarea);
    container.appendChild(btn);

    // Exibir mensagens (apenas admin)
    if (currentUser.type === 'admin') {
      database.ref(`mural/secoes/${secao.id}/mensagens`).on('value', snap => {
        const mensagens = Object.values(snap.val() || {});
        container.querySelectorAll('.sugestao-item').forEach(el => el.remove());
        mensagens.forEach(msg => {
          const item = document.createElement('div');
          item.className = 'sugestao-item';
          item.innerHTML = `<strong>${msg.usuario}</strong> (${msg.data}): ${msg.texto}`;
          container.appendChild(item);
        });
      });
    }

    card.appendChild(container);
  }

  return card;
}

function updateEnqueteResult(secao, element) {
  const total = (secao.votos?.Sim || 0) + (secao.votos?.Não || 0);
  let html = 'Votos: ';
  ['Sim', 'Não'].forEach(opcao => {
    const v = secao.votos?.[opcao] || 0;
    html += `${opcao}: ${v} `;
  });
  html += ` | Total: ${total}`;
  element.innerHTML = html;
}

function votarEnquete(id, opcao) {
  const secao = secoes.find(s => s.id === id);
  if (!secao || !secao.votos) return;

  const userVoted = (secao.votos.usuarioVotou || []).includes(currentUser.username);
  if (userVoted) {
    alert('Você já votou nesta enquete.');
    return;
  }

  const updates = {};
  updates[`mural/secoes/${id}/votos/${opcao}`] = (secao.votos[opcao] || 0) + 1;
  updates[`mural/secoes/${id}/votos/usuarioVotou`] = [...(secao.votos.usuarioVotou || []), currentUser.username];

  database.ref().update(updates).then(() => {
    loadMural();
  });
}

// Modais
function openNewSectionModal() {
  document.getElementById('newSectionModal').style.display = 'block';
  document.getElementById('sectionTitle').value = '';
  document.getElementById('contentType').value = '';
  document.getElementById('enquetePergunta').value = '';
  document.getElementById('enqueteExtra').style.display = 'none';
}

function openNewUserModal() {
  document.getElementById('newUserModal').style.display = 'block';
  document.getElementById('newUsername').value = '';
  document.getElementById('newPassword').value = '';
  document.getElementById('userType').value = '';
}

function closeModal(id) {
  document.getElementById(id).style.display = 'none';
}

document.getElementById('contentType').addEventListener('change', function () {
  document.getElementById('enqueteExtra').style.display = this.value === 'enquete' ? 'block' : 'none';
});

function saveNewSection() {
  const titulo = document.getElementById('sectionTitle').value.trim();
  const tipo = document.getElementById('contentType').value;
  if (!titulo || !tipo) {
    alert('Preencha todos os campos.');
    return;
  }

  const nova = {
    id: 'sec_' + Date.now(),
    titulo,
    tipo
  };

  if (tipo === 'enquete') {
    const pergunta = document.getElementById('enquetePergunta').value.trim() || 'Enquete';
    nova.pergunta = pergunta;
    nova.votos = { Sim: 0, Não: 0, usuarioVotou: [] };
  } else if (tipo === 'sugestao') {
    nova.mensagens = {};
  }

  secoesRef.child(nova.id).set(nova).then(() => {
    ordemRef.once('value').then(snap => {
      const ordem = snap.val() || [];
      ordemRef.set([...ordem, nova.id]);
    });
    closeModal('newSectionModal');
  });
}

function saveNewUser() {
  const username = document.getElementById('newUsername').value.trim().toLowerCase();
  const password = document.getElementById('newPassword').value;
  const type = document.getElementById('userType').value;

  if (!username || !password || !type) {
    alert('Preencha todos os campos.');
    return;
  }

  usuariosRef.child(username).once('value').then(snap => {
    if (snap.exists()) {
      alert('Usuário já existe.');
      return;
    }
    usuariosRef.child(username).set({ username, password, type });
    closeModal('newUserModal');
  });
}

// Painel Admin
function openManageSections() {
  document.getElementById('adminPanel').style.display = 'none';
  document.getElementById('manageSections').style.display = 'block';
}

function openManageUsers() {
  document.getElementById('adminPanel').style.display = 'none';
  document.getElementById('manageUsers').style.display = 'block';
}

// Ordenar cards
function enableSortMode() {
  const cards = document.querySelectorAll('.card');
  let dragSrcEl = null;

  function handleDragStart(e) {
    dragSrcEl = this;
    e.dataTransfer.effectAllowed = 'move';
    this.classList.add('dragging');
  }

  function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    return false;
  }

  function handleDrop() {
    if (dragSrcEl !== this) {
      const srcId = dragSrcEl.dataset.id;
      const destId = this.dataset.id;

      ordemRef.once('value').then(snap => {
        const ordem = snap.val() || [];
        const srcIndex = ordem.indexOf(srcId);
        const destIndex = ordem.indexOf(destId);

        if (srcIndex > -1) {
          ordem.splice(srcIndex, 1);
          ordem.splice(destIndex, 0, srcId);
          ordemRef.set(ordem).then(() => loadMural());
        }
      });
    }
  }

  function handleDragEnd() {
    this.classList.remove('dragging');
  }

  cards.forEach(card => {
    card.addEventListener('dragstart', handleDragStart);
    card.addEventListener('dragover', handleDragOver);
    card.addEventListener('drop', handleDrop);
    card.addEventListener('dragend', handleDragEnd);
  });

  alert('Modo de ordenação ativado. Arraste os cards para reordenar.');
}

// Inicialização
window.onload = () => {
  setTimeout(() => {
    document.getElementById('loading').style.display = 'none';
  }, 500);
};
