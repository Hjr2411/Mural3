// Firebase Configuration
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import {
  getDatabase, ref, set, get, push, remove, onValue, off
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js';

// Firebase config
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

// Inicializa Firebase
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

// Variáveis globais
let currentUser = null;
let currentEditingSection = null;
let currentEditingUser = null;
let sectionsData = {};
let usersData = {};

// Elementos DOM
const loadingScreen = document.getElementById('loading-screen');
const loginScreen = document.getElementById('login-screen');
const mainApp = document.getElementById('main-app');
const adminPanel = document.getElementById('admin-panel');
const readerPanel = document.getElementById('reader-panel');

// Inicialização
document.addEventListener('DOMContentLoaded', function () {
  startApp();
  setupEventListeners();
});

// Função principal
async function startApp() {
  try {
    await checkAndInitializeDatabase();
    loadingScreen.style.display = 'none';
    loginScreen.style.display = 'block';
  } catch (error) {
    console.error('Erro ao inicializar aplicação:', error);
    alert('Erro ao conectar com o banco de dados.');
  }
}

// Verifica se o DB está vazio
async function checkAndInitializeDatabase() {
  const usersRef = ref(database, 'usuarios');
  const usersSnapshot = await get(usersRef);

  if (!usersSnapshot.exists()) {
    console.log('Banco de dados vazio. Configure o primeiro administrador.');
  }
}

// Eventos
function setupEventListeners() {
  document.getElementById('login-form').addEventListener('submit', handleLogin);
  document.getElementById('logout-btn').addEventListener('click', handleLogout);

  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', function () {
      switchAdminSection(this.dataset.section);
    });
  });
}

// Login
async function handleLogin(e) {
  e.preventDefault();
  const formData = new FormData(e.target);
  const username = formData.get('username');
  const password = formData.get('password');

  try {
    const usersRef = ref(database, 'usuarios');
    const snapshot = await get(usersRef);

    if (snapshot.exists()) {
      const users = snapshot.val();
      const user = Object.values(users).find(u => u.nome === username && u.senha === password);

      if (user) {
        currentUser = user;
        await logUserAccess(user);

        loginScreen.style.display = 'none';
        mainApp.style.display = 'block';
        document.getElementById('user-name').textContent = user.nome;

        if (user.tipo === 'admin') {
          adminPanel.style.display = 'block';
          readerPanel.style.display = 'none';
        } else {
          adminPanel.style.display = 'none';
          readerPanel.style.display = 'block';
        }

        e.target.reset();
        document.getElementById('login-error').style.display = 'none';
      } else {
        showLoginError('Usuário ou senha incorretos');
      }
    } else {
      if (username && password) {
        await createFirstAdmin(username, password);
        showLoginError('Primeiro administrador criado. Faça login novamente.');
      } else {
        showLoginError('Configure o primeiro usuário administrador');
      }
    }
  } catch (error) {
    console.error('Erro no login:', error);
    showLoginError('Erro ao fazer login. Tente novamente.');
  }
}

// Erro de login
function showLoginError(message) {
  const errorDiv = document.getElementById('login-error');
  errorDiv.textContent = message;
  errorDiv.style.display = 'block';
}

// Logout
function handleLogout() {
  currentUser = null;
  currentEditingSection = null;
  currentEditingUser = null;
  mainApp.style.display = 'none';
  loginScreen.style.display = 'block';
  off(ref(database, 'secoes'));
}

// Cria primeiro admin
async function createFirstAdmin(username, password) {
  const usersRef = ref(database, 'usuarios');
  const newUserRef = push(usersRef);
  await set(newUserRef, {
    nome: username,
    senha: password,
    tipo: 'admin',
    criadoEm: new Date().toISOString()
  });
  console.log('Primeiro administrador criado:', username);
}

// Log de acesso
async function logUserAccess(user) {
  try {
    const accessRef = ref(database, 'acessos');
    const newAccessRef = push(accessRef);
    const accessData = {
      usuario: user.nome,
      tipo: user.tipo,
      timestamp: new Date().toISOString(),
      ip: await getUserIP(),
      userAgent: navigator.userAgent,
      device: getDeviceType(),
      location: await getUserLocation()
    };
    await set(newAccessRef, accessData);
  } catch (error) {
    console.error('Erro ao registrar acesso:', error);
  }
}

// Captura IP
async function getUserIP() {
  try {
    const response = await fetch('https://api.ipify.org?format=json');
    const data = await response.json();
    return data.ip;
  } catch {
    return 'Unknown';
  }
}

// Tipo de dispositivo
function getDeviceType() {
  const ua = navigator.userAgent;
  if (/tablet|ipad|playbook|silk/i.test(ua)) return 'tablet';
  if (/mobile|iphone|android/i.test(ua)) return 'mobile';
  return 'desktop';
}

// Localização do usuário
async function getUserLocation() {
  try {
    const response = await fetch('https://ipapi.co/json/');
    const data = await response.json();
    return `${data.city}, ${data.country_name}`;
  } catch {
    return 'Unknown';
  }
}

// Alterna seções admin
function switchAdminSection(section) {
  document.querySelectorAll('.nav-btn').forEach(btn =>
    btn.classList.remove('active')
  );
  document.querySelector(`[data-section="${section}"]`).classList.add('active');

  document.querySelectorAll('.admin-section').forEach(sec =>
    sec.classList.remove('active')
  );
  document.getElementById(`${section}-management`).classList.add('active');
}
