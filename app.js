// Firebase Configuration import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js'; import { getDatabase, ref, set, get, push, remove, update, onValue, off } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js';

// Firebase config const firebaseConfig = { apiKey: "AIzaSyCVYvTFM3yoMta2T5AX_3FewmhtkvE9SOA", authDomain: "muralhsys.firebaseapp.com", databaseURL: "https://muralhsys-default-rtdb.firebaseio.com", projectId: "muralhsys", storageBucket: "muralhsys.appspot.com", messagingSenderId: "652168528324", appId: "1:652168528324:web:741aa4779c1f7a149c6491", measurementId: "G-FMKBG2M0PE" };

const app = initializeApp(firebaseConfig); const database = getDatabase(app);

let currentUser = null; let editingSectionKey = null; let editingUserKey = null;

const loadingScreen = document.getElementById('loading-screen'); const loginScreen = document.getElementById('login-screen'); const mainApp = document.getElementById('main-app'); const adminPanel = document.getElementById('admin-panel'); const readerPanel = document.getElementById('reader-panel');

const sectionList = document.getElementById('sections-list'); const userList = document.getElementById('users-list'); const logList = document.getElementById('access-logs-list'); const suggestionList = document.getElementById('suggestions-list'); const muralContent = document.getElementById('mural-content');

// Inicialização document.addEventListener('DOMContentLoaded', () => { startApp(); setupEventListeners(); });

async function startApp() { try { await checkAndInitializeDatabase(); loadingScreen.style.display = 'none'; loginScreen.style.display = 'block'; } catch (error) { console.error('Erro ao inicializar aplicação:', error); alert('Erro ao conectar com o banco de dados.'); } }

function setupEventListeners() { document.getElementById('login-form').addEventListener('submit', handleLogin); document.getElementById('logout-btn').addEventListener('click', handleLogout); document.querySelectorAll('.nav-btn').forEach(btn => { btn.addEventListener('click', function () { switchAdminSection(this.dataset.section); }); }); document.getElementById('add-section-btn').addEventListener('click', () => openModal('section')); document.getElementById('add-user-btn').addEventListener('click', () => openModal('user')); document.querySelectorAll('.modal-close, .modal-cancel').forEach(el => el.addEventListener('click', closeModals)); document.getElementById('section-form').addEventListener('submit', handleSectionForm); document.getElementById('user-form').addEventListener('submit', handleUserForm); }

async function handleLogin(e) { e.preventDefault(); const formData = new FormData(e.target); const username = formData.get('username'); const password = formData.get('password');

try { const usersRef = ref(database, 'usuarios'); const snapshot = await get(usersRef); if (snapshot.exists()) { const users = snapshot.val(); const user = Object.entries(users).find(([key, u]) => u.nome === username && u.senha === password); if (user) { currentUser = { ...user[1], key: user[0] }; loginScreen.style.display = 'none'; mainApp.style.display = 'block'; document.getElementById('user-name').textContent = currentUser.nome; if (currentUser.tipo === 'admin') { adminPanel.style.display = 'block'; readerPanel.style.display = 'none'; loadAdminData(); } else { adminPanel.style.display = 'none'; readerPanel.style.display = 'block'; loadMuralContent(); } e.target.reset(); document.getElementById('login-error').style.display = 'none'; } else { showLoginError('Usuário ou senha incorretos'); } } else { if (username && password) { await createFirstAdmin(username, password); showLoginError('Primeiro administrador criado. Faça login novamente.'); } else { showLoginError('Configure o primeiro usuário administrador'); } } } catch (error) { console.error('Erro no login:', error); showLoginError('Erro ao fazer login.'); } }

function showLoginError(msg) { const div = document.getElementById('login-error'); div.textContent = msg; div.style.display = 'block'; }

function handleLogout() { currentUser = null; mainApp.style.display = 'none'; loginScreen.style.display = 'block'; off(ref(database, 'secoes')); }

async function checkAndInitializeDatabase() { const usersRef = ref(database, 'usuarios'); const snapshot = await get(usersRef); if (!snapshot.exists()) { console.log('Banco vazio. Configure o primeiro admin.'); } }

async function createFirstAdmin(username, password) { const newRef = push(ref(database, 'usuarios')); await set(newRef, { nome: username, senha: password, tipo: 'admin', criadoEm: new Date().toISOString() }); }

function switchAdminSection(section) { document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active')); document.querySelector([data-section="${section}"]).classList.add('active'); document.querySelectorAll('.admin-section').forEach(sec => sec.classList.remove('active')); document.getElementById(${section}-management).classList.add('active'); }

async function loadAdminData() { loadSections(); loadUsers(); loadLogs(); loadSuggestions(); }

function loadSections() { const secRef = ref(database, 'secoes'); onValue(secRef, snapshot => { sectionList.innerHTML = ''; if (snapshot.exists()) { const data = snapshot.val(); Object.entries(data).forEach(([key, val]) => { const div = document.createElement('div'); div.textContent = ${val.titulo} (${val.tipo}); sectionList.appendChild(div); }); } }); }

function loadUsers() { const userRef = ref(database, 'usuarios'); onValue(userRef, snapshot => { userList.innerHTML = ''; if (snapshot.exists()) { const data = snapshot.val(); Object.entries(data).forEach(([key, val]) => { const div = document.createElement('div'); div.textContent = ${val.nome} - ${val.tipo}; userList.appendChild(div); }); } }); }

function loadLogs() { const logRef = ref(database, 'acessos'); onValue(logRef, snapshot => { logList.innerHTML = ''; if (snapshot.exists()) { const data = snapshot.val(); Object.values(data).forEach(log => { const div = document.createElement('div'); div.textContent = ${log.usuario} - ${log.timestamp}; logList.appendChild(div); }); } }); }

function loadSuggestions() { const sugRef = ref(database, 'sugestoes'); onValue(sugRef, snapshot => { suggestionList.innerHTML = ''; if (snapshot.exists()) { const data = snapshot.val(); Object.values(data).forEach(s => { const div = document.createElement('div'); div.textContent = ${s.texto}; suggestionList.appendChild(div); }); } }); }

function loadMuralContent() { const muralRef = ref(database, 'secoes'); onValue(muralRef, snapshot => { muralContent.innerHTML = ''; if (snapshot.exists()) { const secoes = snapshot.val(); Object.values(secoes).forEach(sec => { const div = document.createElement('div'); div.textContent = ${sec.titulo}: ${sec.conteudo || ''}; muralContent.appendChild(div); }); } }); }

function openModal(type) { if (type === 'section') { document.getElementById('section-form').reset(); document.getElementById('section-modal').style.display = 'block'; editingSectionKey = null; } else if (type === 'user') { document.getElementById('user-form').reset(); document.getElementById('user-modal').style.display = 'block'; editingUserKey = null; } }

function closeModals() { document.querySelectorAll('.modal').forEach(m => m.style.display = 'none'); }

async function handleSectionForm(e) { e.preventDefault(); const title = document.getElementById('section-title').value; const type = document.getElementById('section-type').value; const refSec = editingSectionKey ? ref(database, secoes/${editingSectionKey}) : push(ref(database, 'secoes')); await set(refSec, { titulo: title, tipo: type }); closeModals(); }

async function handleUserForm(e) { e.preventDefault(); const name = document.getElementById('user-name').value; const password = document.getElementById('user-password').value; const type = document.getElementById('user-type').value; const refUser = editingUserKey ? ref(database, usuarios/${editingUserKey}) : push(ref(database, 'usuarios')); await set(refUser, { nome: name, senha: password, tipo: type }); closeModals(); }

