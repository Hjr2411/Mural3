// Firebase Configuration
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getDatabase, ref, set, get, push, remove, onValue, off } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js';

// Firebase configuration - CONFIGURE SUAS CREDENCIAIS AQUI
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

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

// Global variables
let currentUser = null;
let currentEditingSection = null;
let currentEditingUser = null;
let sectionsData = {};
let usersData = {};

// DOM Elements
const loadingScreen = document.getElementById('loading-screen');
const loginScreen = document.getElementById('login-screen');
const mainApp = document.getElementById('main-app');
const adminPanel = document.getElementById('admin-panel');
const readerPanel = document.getElementById('reader-panel');

// Initialize app
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
    setupEventListeners();
});

// Initialize application
async function initializeApp() {
    try {
        // Check if database is empty and needs initialization
        await checkAndInitializeDatabase();
        
        // Hide loading screen
        loadingScreen.style.display = 'none';
        loginScreen.style.display = 'block';
    } catch (error) {
        console.error('Erro ao inicializar aplicação:', error);
        alert('Erro ao conectar com o banco de dados. Verifique sua configuração do Firebase.');
    }
}

// Check and initialize database if needed
async function checkAndInitializeDatabase() {
    try {
        const usersRef = ref(database, 'usuarios');
        const usersSnapshot = await get(usersRef);
        
        // Se não há usuários, o banco está vazio - não inicializar dados padrão
        if (!usersSnapshot.exists()) {
            console.log('Banco de dados vazio. Configure o primeiro usuário administrador.');
        }
    } catch (error) {
        console.error('Erro ao verificar banco de dados:', error);
        throw error;
    }
}

// Setup event listeners
function setupEventListeners() {
    // Login form
    document.getElementById('login-form').addEventListener('submit', handleLogin);
    
    // Logout button
    document.getElementById('logout-btn').addEventListener('click', handleLogout);
    
    // Admin navigation
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            switchAdminSection(this.dataset.section);
        });
    });
    
    // Section management
    document.getElementById('add-section-btn').addEventListener('click', () => showSectionModal());
    document.getElementById('section-form').addEventListener('submit', handleSectionSave);
    document.getElementById('section-type').addEventListener('change', handleSectionTypeChange);
    
    // User management
    document.getElementById('add-user-btn').addEventListener('click', () => showUserModal());
    document.getElementById('user-form').addEventListener('submit', handleUserSave);
    
    // Modal controls
    document.querySelectorAll('.modal-close, .modal-cancel').forEach(btn => {
        btn.addEventListener('click', closeModals);
    });
    
    // Access logs filters
    document.getElementById('filter-period').addEventListener('change', loadAccessLogs);
    document.getElementById('filter-user').addEventListener('change', loadAccessLogs);
    document.getElementById('export-logs-btn').addEventListener('click', exportAccessLogs);
    
    // Suggestions management
    document.getElementById('filter-suggestion-section').addEventListener('change', loadSuggestions);
    document.getElementById('clear-suggestions-btn').addEventListener('click', clearAllSuggestions);
    
    // Close modals when clicking outside
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', function(e) {
            if (e.target === this) {
                closeModals();
            }
        });
    });
}

// Handle login
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
                
                // Log access
                await logUserAccess(user);
                
                // Show appropriate panel
                loginScreen.style.display = 'none';
                mainApp.style.display = 'block';
                document.getElementById('user-name').textContent = user.nome;
                
                if (user.tipo === 'admin') {
                    adminPanel.style.display = 'block';
                    readerPanel.style.display = 'none';
                    loadAdminData();
                } else {
                    adminPanel.style.display = 'none';
                    readerPanel.style.display = 'block';
                    loadMuralContent();
                }
                
                // Clear form
                e.target.reset();
                document.getElementById('login-error').style.display = 'none';
            } else {
                showLoginError('Usuário ou senha incorretos');
            }
        } else {
            // No users exist - allow first admin creation
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

// Create first admin user
async function createFirstAdmin(username, password) {
    try {
        const usersRef = ref(database, 'usuarios');
        const newUserRef = push(usersRef);
        
        await set(newUserRef, {
            nome: username,
            senha: password,
            tipo: 'admin',
            criadoEm: new Date().toISOString()
        });
        
        console.log('Primeiro administrador criado:', username);
    } catch (error) {
        console.error('Erro ao criar primeiro administrador:', error);
        throw error;
    }
}

// Show login error
function showLoginError(message) {
    const errorDiv = document.getElementById('login-error');
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
}

// Handle logout
function handleLogout() {
    currentUser = null;
    currentEditingSection = null;
    currentEditingUser = null;
    
    mainApp.style.display = 'none';
    loginScreen.style.display = 'block';
    
    // Clear any active listeners
    const sectionsRef = ref(database, 'secoes');
    off(sectionsRef);
}

// Log user access
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

// Get user IP (simplified)
async function getUserIP() {
    try {
        const response = await fetch('https://api.ipify.org?format=json');
        const data = await response.json();
        return data.ip;
    } catch (error) {
        return 'Unknown';
    }
}

// Get device type
function getDeviceType() {
    const userAgent = navigator.userAgent;
    if (/tablet|ipad|playbook|silk/i.test(userAgent)) {
        return 'tablet';
    }
    if (/mobile|iphone|ipod|android|blackberry|opera|mini|windows\sce|palm|smartphone|iemobile/i.test(userAgent)) {
        return 'mobile';
    }
    return 'desktop';
}

// Get user location (simplified)
async function getUserLocation() {
    try {
        const response = await fetch('https://ipapi.co/json/');
        const data = await response.json();
        return `${data.city}, ${data.country_name}`;
    } catch (error) {
        return 'Unknown';
    }
}

// Switch admin section
function switchAdminSection(section) {
    // Update navigation
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`[data-section="${section}"]`).classList.add('active');
    
    // Update content
    document.querySelectorAll('.admin-section').forEach(sec => {
        sec.classList.remove('active');
    });
    document.getElementById(`${section}-management`).classList.add('active');
    
    // Load section-specific data
    switch (section) {
        case 'sections':
            loadSections();
            break;
        case 'users':
            loadUsers();
            break;
        case 'access-logs':
            loadAccessLogs();
            break;
        case 'suggestions':
            loadSuggestions();
            break;
    }
}

// Load admin data
function loadAdminData() {
    loadSections();
    loadUsers();
    loadAccessLogs();
    loadSuggestions();
}// Load sections
async function loadSections() {
    try {
        const sectionsRef = ref(database, 'secoes');
        const snapshot = await get(sectionsRef);
        
        const sectionsList = document.getElementById('sections-list');
        sectionsList.innerHTML = '';
        
        if (snapshot.exists()) {
            sectionsData = snapshot.val();
            const sections = Object.entries(sectionsData).sort((a, b) => (a[1].ordem || 0) - (b[1].ordem || 0));
            
            sections.forEach(([id, section]) => {
                const sectionCard = createSectionCard(id, section);
                sectionsList.appendChild(sectionCard);
            });
        } else {
            sectionsList.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 40px;">Nenhuma seção criada ainda. Clique em "Nova Seção" para começar.</p>';
        }
    } catch (error) {
        console.error('Erro ao carregar seções:', error);
    }
}

// Create section card
function createSectionCard(id, section) {
    const card = document.createElement('div');
    card.className = 'section-card fade-in';
    
    const typeLabels = {
        'texto': 'Texto',
        'meta': 'Meta',
        'folgas': 'Folgas',
        'plantao': 'Plantão',
        'enquete': 'Enquete',
        'imagem-texto': 'Imagem + Texto',
        'sugestoes': 'Sugestões'
    };
    
    card.innerHTML = `
        <div class="card-header">
            <div>
                <div class="card-title">${section.titulo}</div>
                <div class="card-type">${typeLabels[section.tipo] || section.tipo}</div>
            </div>
            <div class="card-actions">
                <button class="btn-secondary btn-small" onclick="editSection('${id}')">
                    <i class="fas fa-edit"></i>
                    Editar
                </button>
                <button class="btn-danger btn-small" onclick="deleteSection('${id}')">
                    <i class="fas fa-trash"></i>
                    Excluir
                </button>
            </div>
        </div>
        <div class="card-content">
            ${getSectionPreview(section)}
        </div>
    `;
    
    return card;
}

// Get section preview
function getSectionPreview(section) {
    switch (section.tipo) {
        case 'texto':
            return `<p>${section.conteudo.substring(0, 100)}${section.conteudo.length > 100 ? '...' : ''}</p>`;
        case 'meta':
            const percentage = Math.round((section.conteudo.atual / section.conteudo.meta) * 100);
            return `
                <div class="progress-container">
                    <div class="progress-info">
                        <span>Progresso: ${section.conteudo.atual}/${section.conteudo.meta}</span>
                        <span>${percentage}%</span>
                    </div>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${percentage}%"></div>
                    </div>
                </div>
            `;
        case 'folgas':
            return `<p><i class="fas fa-calendar-alt"></i> ${Array.isArray(section.conteudo) ? section.conteudo.length : 0} folgas cadastradas</p>`;
        case 'plantao':
            return `<p><i class="fas fa-clock"></i> ${Array.isArray(section.conteudo) ? section.conteudo.length : 0} plantões cadastrados</p>`;
        case 'enquete':
            const totalVotos = section.conteudo.totalVotos || 0;
            return `<p><i class="fas fa-poll"></i> ${section.conteudo.pergunta} (${totalVotos} votos)</p>`;
        case 'imagem-texto':
            return `<p><i class="fas fa-image"></i> Imagem com texto</p>`;
        case 'sugestoes':
            const totalSugestoes = Array.isArray(section.conteudo.sugestoes) ? section.conteudo.sugestoes.length : 0;
            return `<p><i class="fas fa-lightbulb"></i> ${totalSugestoes} sugestões recebidas</p>`;
        default:
            return '<p>Conteúdo não disponível</p>';
    }
}

// Edit section
function editSection(sectionId) {
    currentEditingSection = sectionId;
    const section = sectionsData[sectionId];
    showSectionModal(section);
}

// Delete section
async function deleteSection(sectionId) {
    if (confirm('Tem certeza que deseja excluir esta seção?')) {
        try {
            const sectionRef = ref(database, `secoes/${sectionId}`);
            await remove(sectionRef);
            loadSections();
        } catch (error) {
            console.error('Erro ao excluir seção:', error);
            alert('Erro ao excluir seção');
        }
    }
}

// Load users
async function loadUsers() {
    try {
        const usersRef = ref(database, 'usuarios');
        const snapshot = await get(usersRef);
        
        const usersList = document.getElementById('users-list');
        usersList.innerHTML = '';
        
        if (snapshot.exists()) {
            usersData = snapshot.val();
            
            Object.entries(usersData).forEach(([id, user]) => {
                const userCard = createUserCard(id, user);
                usersList.appendChild(userCard);
            });
        }
    } catch (error) {
        console.error('Erro ao carregar usuários:', error);
    }
}

// Create user card
function createUserCard(id, user) {
    const card = document.createElement('div');
    card.className = 'user-card fade-in';
    
    const typeLabels = {
        'admin': 'Administrador',
        'leitor': 'Leitor'
    };
    
    card.innerHTML = `
        <div class="card-header">
            <div>
                <div class="card-title">${user.nome}</div>
                <div class="card-type">${typeLabels[user.tipo] || user.tipo}</div>
            </div>
            <div class="card-actions">
                <button class="btn-secondary btn-small" onclick="editUser('${id}')">
                    <i class="fas fa-edit"></i>
                    Editar
                </button>
                <button class="btn-danger btn-small" onclick="deleteUser('${id}')">
                    <i class="fas fa-trash"></i>
                    Excluir
                </button>
            </div>
        </div>
    `;
    
    return card;
}

// Edit user
function editUser(userId) {
    currentEditingUser = userId;
    const user = usersData[userId];
    showUserModal(user);
}

// Delete user
async function deleteUser(userId) {
    if (confirm('Tem certeza que deseja excluir este usuário?')) {
        try {
            const userRef = ref(database, `usuarios/${userId}`);
            await remove(userRef);
            loadUsers();
        } catch (error) {
            console.error('Erro ao excluir usuário:', error);
            alert('Erro ao excluir usuário');
        }
    }
}

// Load access logs
async function loadAccessLogs() {
    try {
        const accessRef = ref(database, 'acessos');
        const snapshot = await get(accessRef);
        
        const accessList = document.getElementById('access-logs-list');
        accessList.innerHTML = '';
        
        if (snapshot.exists()) {
            const accessData = snapshot.val();
            const accesses = Object.entries(accessData).sort((a, b) => new Date(b[1].timestamp) - new Date(a[1].timestamp));
            
            // Filter by period and user
            const filteredAccesses = filterAccessLogs(accesses);
            
            // Update stats
            updateAccessStats(filteredAccesses);
            
            // Create header
            const header = document.createElement('div');
            header.className = 'access-log-header';
            header.innerHTML = `
                <div>Usuário</div>
                <div>Localização</div>
                <div>Dispositivo</div>
                <div>Data/Hora</div>
                <div>Status</div>
            `;
            accessList.appendChild(header);
            
            // Create access items
            filteredAccesses.forEach(([id, access]) => {
                const accessItem = createAccessLogItem(id, access);
                accessList.appendChild(accessItem);
            });
            
            // Update user filter options
            updateUserFilterOptions(accesses);
        } else {
            accessList.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 40px;">Nenhum acesso registrado ainda.</p>';
        }
    } catch (error) {
        console.error('Erro ao carregar logs de acesso:', error);
    }
}

// Filter access logs
function filterAccessLogs(accesses) {
    const period = document.getElementById('filter-period').value;
    const user = document.getElementById('filter-user').value;
    
    let filtered = accesses;
    
    // Filter by period
    if (period !== 'all') {
        const now = new Date();
        let startDate;
        
        switch (period) {
            case 'today':
                startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                break;
            case 'week':
                startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                break;
            case 'month':
                startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                break;
        }
        
        filtered = filtered.filter(([id, access]) => new Date(access.timestamp) >= startDate);
    }
    
    // Filter by user
    if (user !== 'all') {
        filtered = filtered.filter(([id, access]) => access.usuario === user);
    }
    
    return filtered;
}

// Create access log item
function createAccessLogItem(id, access) {
    const item = document.createElement('div');
    item.className = 'access-log-item';
    item.onclick = () => showAccessDetail(access);
    
    const deviceIcon = getDeviceIcon(access.device);
    const formattedDate = new Date(access.timestamp).toLocaleString('pt-BR');
    
    item.innerHTML = `
        <div class="log-user">${access.usuario}</div>
        <div class="log-location">${access.location || 'Unknown'}</div>
        <div class="log-device">
            <i class="fas ${deviceIcon} device-icon ${access.device}"></i>
            ${access.device}
        </div>
        <div class="log-time">${formattedDate}</div>
        <div class="log-status success">Sucesso</div>
    `;
    
    return item;
}

// Get device icon
function getDeviceIcon(device) {
    switch (device) {
        case 'desktop':
            return 'fa-desktop';
        case 'mobile':
            return 'fa-mobile-alt';
        case 'tablet':
            return 'fa-tablet-alt';
        default:
            return 'fa-question';
    }
}

// Update access stats
function updateAccessStats(accesses) {
    const uniqueUsers = new Set(accesses.map(([id, access]) => access.usuario)).size;
    const totalLogins = accesses.length;
    
    document.getElementById('total-users').textContent = uniqueUsers;
    document.getElementById('total-logins').textContent = totalLogins;
    
    // Calculate average session (simplified)
    document.getElementById('avg-session').textContent = '15min';
    
    // Most common location
    const locations = accesses.map(([id, access]) => access.location).filter(loc => loc && loc !== 'Unknown');
    const locationCounts = {};
    locations.forEach(loc => {
        locationCounts[loc] = (locationCounts[loc] || 0) + 1;
    });
    
    const topLocation = Object.keys(locationCounts).reduce((a, b) => locationCounts[a] > locationCounts[b] ? a : b, '-');
    document.getElementById('top-location').textContent = topLocation;
}

// Update user filter options
function updateUserFilterOptions(accesses) {
    const userFilter = document.getElementById('filter-user');
    const currentValue = userFilter.value;
    
    // Clear existing options except "all"
    userFilter.innerHTML = '<option value="all">Todos os Usuários</option>';
    
    // Get unique users
    const uniqueUsers = [...new Set(accesses.map(([id, access]) => access.usuario))];
    
    uniqueUsers.forEach(user => {
        const option = document.createElement('option');
        option.value = user;
        option.textContent = user;
        userFilter.appendChild(option);
    });
    
    // Restore previous selection
    userFilter.value = currentValue;
}

// Show access detail
function showAccessDetail(access) {
    const modal = document.getElementById('access-detail-modal');
    const content = document.getElementById('access-detail-content');
    
    content.innerHTML = `
        <div class="access-detail-grid">
            <div class="detail-item">
                <div class="detail-label">Usuário</div>
                <div class="detail-value">${access.usuario}</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">Tipo</div>
                <div class="detail-value">${access.tipo}</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">Data/Hora</div>
                <div class="detail-value">${new Date(access.timestamp).toLocaleString('pt-BR')}</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">IP</div>
                <div class="detail-value">${access.ip}</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">Dispositivo</div>
                <div class="detail-value">${access.device}</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">Localização</div>
                <div class="detail-value">${access.location || 'Unknown'}</div>
            </div>
        </div>
        <div class="detail-item">
            <div class="detail-label">User Agent</div>
            <div class="detail-value" style="word-break: break-all; font-size: 12px;">${access.userAgent}</div>
        </div>
    `;
    
    modal.classList.add('active');
}

// Export access logs
function exportAccessLogs() {
    // Simplified export - in a real app, you'd generate CSV/Excel
    alert('Funcionalidade de exportação será implementada em breve.');
}

// Show section modal
function showSectionModal(sectionData = null) {
    const modal = document.getElementById('section-modal');
    const form = document.getElementById('section-form');
    const title = document.getElementById('modal-title');
    
    if (sectionData) {
        title.textContent = 'Editar Seção';
        document.getElementById('section-title').value = sectionData.titulo;
        document.getElementById('section-type').value = sectionData.tipo;
        handleSectionTypeChange();
        populateContentFields(sectionData);
    } else {
        title.textContent = 'Nova Seção';
        form.reset();
        document.getElementById('content-fields').innerHTML = '';
    }
    
    modal.classList.add('active');
}

// Show user modal
function showUserModal(userData = null) {
    const modal = document.getElementById('user-modal');
    const form = document.getElementById('user-form');
    const title = document.getElementById('user-modal-title');
    
    if (userData) {
        title.textContent = 'Editar Usuário';
        document.getElementById('user-name').value = userData.nome;
        document.getElementById('user-password').value = userData.senha;
        document.getElementById('user-type').value = userData.tipo;
    } else {
        title.textContent = 'Novo Usuário';
        form.reset();
    }
    
    modal.classList.add('active');
}

// Handle section type change
function handleSectionTypeChange() {
    const type = document.getElementById('section-type').value;
    const contentFields = document.getElementById('content-fields');
    
    contentFields.innerHTML = '';
    
    switch (type) {
        case 'texto':
            contentFields.innerHTML = `
                <div class="form-group">
                    <label for="content-text">Conteúdo</label>
                    <textarea id="content-text" name="content" rows="4" required></textarea>
                </div>
            `;
            break;
        case 'meta':
            contentFields.innerHTML = `
                <div class="form-group">
                    <label for="meta-value">Meta</label>
                    <input type="number" id="meta-value" name="meta" required>
                </div>
                <div class="form-group">
                    <label for="atual-value">Valor Atual</label>
                    <input type="number" id="atual-value" name="atual" required>
                </div>
                <div class="form-group">
                    <label for="meta-description">Descrição (opcional)</label>
                    <input type="text" id="meta-description" name="description">
                </div>
            `;
            break;
        case 'folgas':
            contentFields.innerHTML = `
                <div class="form-group">
                    <label>Lista de Folgas</label>
                    <div id="folgas-list" class="dynamic-list">
                        <div class="list-item">
                            <input type="text" placeholder="Nome" name="folga-nome">
                            <input type="text" placeholder="Projeto" name="folga-projeto">
                            <input type="date" name="folga-data">
                            <button type="button" class="btn-danger btn-small" onclick="removeListItem(this)">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                    <button type="button" class="add-item-btn" onclick="addFolgaItem()">
                        <i class="fas fa-plus"></i> Adicionar Folga
                    </button>
                </div>
            `;
            break;
        case 'plantao':
            contentFields.innerHTML = `
                <div class="form-group">
                    <label>Lista de Plantão</label>
                    <div id="plantao-list" class="dynamic-list">
                        <div class="list-item">
                            <input type="text" placeholder="Nome" name="plantao-nome">
                            <input type="text" placeholder="Projeto" name="plantao-projeto">
                            <input type="text" placeholder="Horário (ex: 08:00 - 17:00)" name="plantao-horario">
                            <button type="button" class="btn-danger btn-small" onclick="removeListItem(this)">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                    <button type="button" class="add-item-btn" onclick="addPlantaoItem()">
                        <i class="fas fa-plus"></i> Adicionar Plantão
                    </button>
                </div>
            `;
            break;
        case 'enquete':
            contentFields.innerHTML = `
                <div class="form-group">
                    <label for="enquete-pergunta">Pergunta da Enquete</label>
                    <input type="text" id="enquete-pergunta" name="pergunta" placeholder="Ex: Qual sua preferência?" required>
                </div>
                <div class="form-group">
                    <label for="enquete-tipo">Tipo de Enquete</label>
                    <select id="enquete-tipo" name="tipo-enquete" required>
                        <option value="">Selecione o tipo</option>
                        <option value="multipla-escolha">Múltipla Escolha</option>
                        <option value="sim-nao">Sim/Não</option>
                        <option value="escala">Escala (1-5)</option>
                    </select>
                </div>
                <div class="form-group" id="opcoes-container" style="display: none;">
                    <label>Opções da Enquete</label>
                    <div id="opcoes-list" class="dynamic-list">
                        <div class="list-item">
                            <input type="text" placeholder="Opção 1" name="enquete-opcao">
                            <button type="button" class="btn-danger btn-small" onclick="removeListItem(this)">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                        <div class="list-item">
                            <input type="text" placeholder="Opção 2" name="enquete-opcao">
                            <button type="button" class="btn-danger btn-small" onclick="removeListItem(this)">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                    <button type="button" class="add-item-btn" onclick="addEnqueteOpcao()">
                        <i class="fas fa-plus"></i> Adicionar Opção
                    </button>
                </div>
            `;
            // Add event listener for enquete type change
            document.getElementById('enquete-tipo').addEventListener('change', function() {
                const opcoesContainer = document.getElementById('opcoes-container');
                if (this.value === 'multipla-escolha') {
                    opcoesContainer.style.display = 'block';
                } else {
                    opcoesContainer.style.display = 'none';
                }
            });
            break;
        case 'imagem-texto':
            contentFields.innerHTML = `
                <div class="form-group">
                    <label for="imagem-upload">Imagem</label>
                    <input type="file" id="imagem-upload" name="imagem" accept="image/*" required>
                    <small style="color: var(--text-secondary);">Formatos aceitos: JPG, PNG, GIF (máx. 5MB)</small>
                </div>
                <div class="form-group">
                    <label for="imagem-texto-conteudo">Texto</label>
                    <textarea id="imagem-texto-conteudo" name="texto" rows="4" placeholder="Digite o texto que acompanha a imagem..." required></textarea>
                </div>
                <div class="form-group">
                    <label for="imagem-posicao">Posição da Imagem</label>
                    <select id="imagem-posicao" name="posicao">
                        <option value="acima">Acima do texto</option>
                        <option value="abaixo">Abaixo do texto</option>
                        <option value="esquerda">À esquerda do texto</option>
                        <option value="direita">À direita do texto</option>
                    </select>
                </div>
            `;
            break;
        case 'sugestoes':
            contentFields.innerHTML = `
                <div class="form-group">
                    <label for="sugestoes-titulo">Título da Seção</label>
                    <input type="text" id="sugestoes-titulo" name="titulo-sugestoes" placeholder="Ex: Deixe sua sugestão" value="Caixa de Sugestões">
                </div>
                <div class="form-group">
                    <label for="sugestoes-descricao">Descrição para os usuários</label>
                    <textarea id="sugestoes-descricao" name="descricao-sugestoes" rows="2" readonly style="background-color: var(--background-color); color: var(--text-secondary);">Digite sua sugestão após salvar apenas o administrador poderá ler.</textarea>
                    <small style="color: var(--text-secondary);">Esta descrição será exibida para orientar os usuários.</small>
                </div>
            `;
            break;
    }
}

// Populate content fields for editing
function populateContentFields(sectionData) {
    const type = sectionData.tipo;
    
    switch (type) {
        case 'texto':
            document.getElementById('content-text').value = sectionData.conteudo;
            break;
        case 'meta':
            document.getElementById('meta-value').value = sectionData.conteudo.meta;
            document.getElementById('atual-value').value = sectionData.conteudo.atual;
            if (sectionData.conteudo.descricao) {
                document.getElementById('meta-description').value = sectionData.conteudo.descricao;
            }
            break;
        case 'folgas':
            const folgasList = document.getElementById('folgas-list');
            folgasList.innerHTML = '';
            if (Array.isArray(sectionData.conteudo)) {
                sectionData.conteudo.forEach(item => {
                    const listItem = document.createElement('div');
                    listItem.className = 'list-item';
                    listItem.innerHTML = `
                        <input type="text" placeholder="Nome" name="folga-nome" value="${item.nome}">
                        <input type="text" placeholder="Projeto" name="folga-projeto" value="${item.projeto}">
                        <input type="date" name="folga-data" value="${item.data}">
                        <button type="button" class="btn-danger btn-small" onclick="removeListItem(this)">
                            <i class="fas fa-trash"></i>
                        </button>
                    `;
                    folgasList.appendChild(listItem);
                });
            }
            break;
        case 'plantao':
            const plantaoList = document.getElementById('plantao-list');
            plantaoList.innerHTML = '';
            if (Array.isArray(sectionData.conteudo)) {
                sectionData.conteudo.forEach(item => {
                    const listItem = document.createElement('div');
                    listItem.className = 'list-item';
                    listItem.innerHTML = `
                        <input type="text" placeholder="Nome" name="plantao-nome" value="${item.nome}">
                        <input type="text" placeholder="Projeto" name="plantao-projeto" value="${item.projeto}">
                        <input type="text" placeholder="Horário" name="plantao-horario" value="${item.horario}">
                        <button type="button" class="btn-danger btn-small" onclick="removeListItem(this)">
                            <i class="fas fa-trash"></i>
                        </button>
                    `;
                    plantaoList.appendChild(listItem);
                });
            }
            break;
        case 'enquete':
            if (sectionData.conteudo) {
                document.getElementById('enquete-pergunta').value = sectionData.conteudo.pergunta || '';
                document.getElementById('enquete-tipo').value = sectionData.conteudo.tipo || '';
                
                // Trigger change event to show/hide options
                const tipoSelect = document.getElementById('enquete-tipo');
                tipoSelect.dispatchEvent(new Event('change'));
                
                if (sectionData.conteudo.opcoes && Array.isArray(sectionData.conteudo.opcoes)) {
                    const opcoesList = document.getElementById('opcoes-list');
                    opcoesList.innerHTML = '';
                    sectionData.conteudo.opcoes.forEach(opcao => {
                        const listItem = document.createElement('div');
                        listItem.className = 'list-item';
                        listItem.innerHTML = `
                            <input type="text" placeholder="Opção" name="enquete-opcao" value="${opcao.texto}">
                            <button type="button" class="btn-danger btn-small" onclick="removeListItem(this)">
                                <i class="fas fa-trash"></i>
                            </button>
                        `;
                        opcoesList.appendChild(listItem);
                    });
                }
            }
            break;
        case 'imagem-texto':
            if (sectionData.conteudo) {
                document.getElementById('imagem-texto-conteudo').value = sectionData.conteudo.texto || '';
                document.getElementById('imagem-posicao').value = sectionData.conteudo.posicao || 'acima';
                // Note: File input cannot be pre-filled for security reasons
            }
            break;
        case 'sugestoes':
            if (sectionData.conteudo) {
                document.getElementById('sugestoes-titulo').value = sectionData.conteudo.titulo || 'Caixa de Sugestões';
                document.getElementById('sugestoes-descricao').value = sectionData.conteudo.descricao || 'Digite sua sugestão após salvar apenas o administrador poderá ler.';
            }
            break;
    }
}

// Handle section save
async function handleSectionSave(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const title = formData.get('title');
    const type = formData.get('type');
    
    let content;
    
    switch (type) {
        case 'texto':
            content = formData.get('content');
            break;
        case 'meta':
            content = {
                meta: parseInt(formData.get('meta')),
                atual: parseInt(formData.get('atual')),
                descricao: formData.get('description') || ''
            };
            break;
        case 'folgas':
            content = collectListData('folga');
            break;
        case 'plantao':
            content = collectListData('plantao');
            break;
        case 'enquete':
            const pergunta = formData.get('pergunta');
            const tipoEnquete = formData.get('tipo-enquete');
            
            content = {
                pergunta: pergunta,
                tipo: tipoEnquete,
                votos: {},
                totalVotos: 0
            };
            
            if (tipoEnquete === 'multipla-escolha') {
                const opcoes = [];
                const opcoesInputs = document.querySelectorAll('input[name="enquete-opcao"]');
                opcoesInputs.forEach((input, index) => {
                    if (input.value.trim()) {
                        opcoes.push({
                            id: index,
                            texto: input.value.trim(),
                            votos: 0
                        });
                    }
                });
                content.opcoes = opcoes;
            } else if (tipoEnquete === 'sim-nao') {
                content.opcoes = [
                    { id: 0, texto: 'Sim', votos: 0 },
                    { id: 1, texto: 'Não', votos: 0 }
                ];
            } else if (tipoEnquete === 'escala') {
                content.opcoes = [
                    { id: 0, texto: '1', votos: 0 },
                    { id: 1, texto: '2', votos: 0 },
                    { id: 2, texto: '3', votos: 0 },
                    { id: 3, texto: '4', votos: 0 },
                    { id: 4, texto: '5', votos: 0 }
                ];
            }
            break;
        case 'imagem-texto':
            const imagemFile = formData.get('imagem');
            const texto = formData.get('texto');
            const posicao = formData.get('posicao');
            
            if (imagemFile && imagemFile.size > 0) {
                // Convert image to base64 for storage
                const base64Image = await convertFileToBase64(imagemFile);
                content = {
                    imagem: base64Image,
                    imagemNome: imagemFile.name,
                    texto: texto,
                    posicao: posicao
                };
            } else if (currentEditingSection) {
                // Keep existing image if no new image uploaded
                const currentSection = await getSectionData(currentEditingSection);
                content = {
                    imagem: currentSection.conteudo.imagem,
                    imagemNome: currentSection.conteudo.imagemNome,
                    texto: texto,
                    posicao: posicao
                };
            } else {
                throw new Error('Imagem é obrigatória');
            }
            break;
        case 'sugestoes':
            const tituloSugestoes = formData.get('titulo-sugestoes');
            const descricaoSugestoes = formData.get('descricao-sugestoes');
            
            content = {
                titulo: tituloSugestoes,
                descricao: descricaoSugestoes,
                sugestoes: []
            };
            break;
    }
    
    try {
        let sectionId;
        let ordem;
        
        if (currentEditingSection) {
            sectionId = currentEditingSection;
            // Get current ordem
            const sectionRef = ref(database, `secoes/${sectionId}`);
            const snapshot = await get(sectionRef);
            ordem = snapshot.exists() ? snapshot.val().ordem : 0;
        } else {
            // Get next ordem
            const sectionsRef = ref(database, 'secoes');
            const snapshot = await get(sectionsRef);
            ordem = snapshot.exists() ? Object.keys(snapshot.val()).length : 0;
            
            // Create new section
            const newSectionRef = push(sectionsRef);
            sectionId = newSectionRef.key;
        }
        
        const sectionData = {
            titulo: title,
            tipo: type,
            conteudo: content,
            ordem: ordem,
            criadoEm: new Date().toISOString()
        };
        
        const sectionRef = ref(database, `secoes/${sectionId}`);
        await set(sectionRef, sectionData);
        
        // Reset form and close modal
        e.target.reset();
        closeModals();
        currentEditingSection = null;
        
        // Reload sections
        loadSections();
        
    } catch (error) {
        console.error('Erro ao salvar seção:', error);
        alert('Erro ao salvar seção: ' + error.message);
    }
}

// Handle user save
async function handleUserSave(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const name = formData.get('name');
    const password = formData.get('password');
    const type = formData.get('type');
    
    try {
        let userId;
        
        if (currentEditingUser) {
            userId = currentEditingUser;
        } else {
            const usersRef = ref(database, 'usuarios');
            const newUserRef = push(usersRef);
            userId = newUserRef.key;
        }
        
        const userData = {
            nome: name,
            senha: password,
            tipo: type,
            criadoEm: new Date().toISOString()
        };
        
        const userRef = ref(database, `usuarios/${userId}`);
        await set(userRef, userData);
        
        // Reset form and close modal
        e.target.reset();
        closeModals();
        currentEditingUser = null;
        
        // Reload users
        loadUsers();
        
    } catch (error) {
        console.error('Erro ao salvar usuário:', error);
        alert('Erro ao salvar usuário');
    }
}

// Utility functions
function collectListData(type) {
    const items = [];
    const inputs = document.querySelectorAll(`input[name="${type}-nome"]`);
    
    inputs.forEach((input, index) => {
        const nome = input.value.trim();
        const projeto = document.querySelectorAll(`input[name="${type}-projeto"]`)[index].value.trim();
        
        if (type === 'folga') {
            const data = document.querySelectorAll(`input[name="${type}-data"]`)[index].value;
            if (nome && projeto && data) {
                items.push({ nome, projeto, data });
            }
        } else if (type === 'plantao') {
            const horario = document.querySelectorAll(`input[name="${type}-horario"]`)[index].value.trim();
            if (nome && projeto && horario) {
                items.push({ nome, projeto, horario });
            }
        }
    });
    
    return items;
}

async function convertFileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

async function getSectionData(sectionId) {
    const sectionRef = ref(database, `secoes/${sectionId}`);
    const snapshot = await get(sectionRef);
    return snapshot.exists() ? snapshot.val() : null;
}

function closeModals() {
    document.querySelectorAll('.modal').forEach(modal => {
        modal.classList.remove('active');
    });
}

// Dynamic list functions
function addFolgaItem() {
    const list = document.getElementById('folgas-list');
    const item = document.createElement('div');
    item.className = 'list-item';
    item.innerHTML = `
        <input type="text" placeholder="Nome" name="folga-nome">
        <input type="text" placeholder="Projeto" name="folga-projeto">
        <input type="date" name="folga-data">
        <button type="button" class="btn-danger btn-small" onclick="removeListItem(this)">
            <i class="fas fa-trash"></i>
        </button>
    `;
    list.appendChild(item);
}

function addPlantaoItem() {
    const list = document.getElementById('plantao-list');
    const item = document.createElement('div');
    item.className = 'list-item';
    item.innerHTML = `
        <input type="text" placeholder="Nome" name="plantao-nome">
        <input type="text" placeholder="Projeto" name="plantao-projeto">
        <input type="text" placeholder="Horário (ex: 08:00 - 17:00)" name="plantao-horario">
        <button type="button" class="btn-danger btn-small" onclick="removeListItem(this)">
            <i class="fas fa-trash"></i>
        </button>
    `;
    list.appendChild(item);
}

function addEnqueteOpcao() {
    const list = document.getElementById('opcoes-list');
    const item = document.createElement('div');
    item.className = 'list-item';
    item.innerHTML = `
        <input type="text" placeholder="Nova opção" name="enquete-opcao">
        <button type="button" class="btn-danger btn-small" onclick="removeListItem(this)">
            <i class="fas fa-trash"></i>
        </button>
    `;
    list.appendChild(item);
}

function removeListItem(button) {
    button.parentElement.remove();
}

// Make functions globally available
window.editSection = editSection;
window.deleteSection = deleteSection;
window.editUser = editUser;
window.deleteUser = deleteUser;
window.addFolgaItem = addFolgaItem;
window.addPlantaoItem = addPlantaoItem;
window.addEnqueteOpcao = addEnqueteOpcao;
window.removeListItem = removeListItem;
window.submitVote = submitVote;
window.submitSuggestion = submitSuggestion;
