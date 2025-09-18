/****************************************************
 * MuralSys • app.js (V1.7)
 * MVP: feed estilo Instagram corporativo
 * - Login simples via Realtime Database (usuarios/{nome})
 * - Perfis: admin | leitor
 * - Posts: texto | imagem (URL) | enquete
 * - Ordem do feed definida pelo admin (campo "ordem")
 * - Interações: like (confirmação), comentários, voto (1 por usuário)
 * - ADMIN: botão "Novo usuário" (dinâmico) + atalho Ctrl+U
 ****************************************************/

/* ============================
   Firebase SDK (v12 módulos)
============================ */
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";
import {
  getDatabase, ref, get, set, push, update, remove, onValue
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-database.js";

/* ===============================================
   Configuração Firebase (SUAS CHAVES)
=============================================== */
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

// Init Firebase
const app = initializeApp(firebaseConfig);
const db  = getDatabase(app);

/* ============================
   Estado & Referências DOM
============================ */
let currentUser = null;         // { nome, senha, tipo }
let editingPostId = null;       // para o modal do admin

// Telas
const loginScreen = document.getElementById("login-screen");
const appRoot     = document.getElementById("app");

// Login
const loginForm   = document.getElementById("login-form");
const loginUserEl = document.getElementById("login-username");
const loginPassEl = document.getElementById("login-password");
const loginError  = document.getElementById("login-error");

// App header
const currentUsernameEl = document.getElementById("current-username");
const currentRoleEl     = document.getElementById("current-role");
const logoutBtn         = document.getElementById("logout-btn");
const openComposerBtn   = document.getElementById("open-composer");

// Feed
const feedList  = document.getElementById("feed-list");
const feedEmpty = document.getElementById("feed-empty");

// Composer (admin)
const composerModal = document.getElementById("composer-modal");
const composerForm  = document.getElementById("composer-form");
const composerTitle = document.getElementById("composer-title");
const sectionTexto  = document.getElementById("composer-texto");
const sectionImagem = document.getElementById("composer-imagem");
const sectionEnquete= document.getElementById("composer-enquete");

// Template
const postCardTpl = document.getElementById("post-card-template");

// Dialog & Toast
const confirmDialog = document.getElementById("confirm-dialog");
const confirmText   = document.getElementById("confirm-text");
const toastEl       = document.getElementById("toast");

/* ============================
   Utilidades
============================ */
function show(el){ el?.removeAttribute("hidden"); }
function hide(el){ el?.setAttribute("hidden", ""); }
function toast(msg){
  if(!toastEl) return;
  toastEl.textContent = msg;
  show(toastEl);
  setTimeout(()=> hide(toastEl), 2000);
}
function isoNow(){ return new Date().toISOString(); }
function asDateTime(iso){
  try { return new Date(iso).toLocaleString("pt-BR"); } catch { return "—"; }
}
function count(obj){ return obj ? Object.keys(obj).length : 0; }
function byOrdemAsc(a, b){
  const oa = Number(a.ordem ?? 999999);
  const ob = Number(b.ordem ?? 999999);
  if(oa === ob){
    // desempate por timestamp (mais novo primeiro)
    return new Date(b.timestamp||0) - new Date(a.timestamp||0);
  }
  return oa - ob;
}

/* ============================
   Sessão (sem auto-login)
============================ */
// Guardar só o nome para pré-preencher, sem autenticar
function restoreSessionName(){
  const saved = sessionStorage.getItem("currentUser");
  if(!saved) return null;
  try { return JSON.parse(saved)?.nome || null; } catch { return null; }
}
function saveSessionName(){
  sessionStorage.setItem("currentUser", JSON.stringify({ nome: currentUser?.nome || "" }));
}
function clearSession(){
  sessionStorage.removeItem("currentUser");
  currentUser = null;
}

/* ============================
   Fluxo de Tela
============================ */
function showLogin(){
  show(loginScreen);
  hide(appRoot);
}
function showApp(){
  hide(loginScreen);
  show(appRoot);
  currentUsernameEl.textContent = currentUser?.nome || "—";
  currentRoleEl.textContent     = currentUser?.tipo || "—";

  // Itens com data-visible-for="admin"
  document.querySelectorAll("[data-visible-for='admin']").forEach(el=>{
    if(currentUser?.tipo === "admin") show(el); else hide(el);
  });

  // Injeta botão "Novo usuário" (admin) se ainda não existir
  ensureCreateUserButton();
}

/* ============================
   Login simples (RTDB)
============================ */
loginForm?.addEventListener("submit", async (e)=>{
  e.preventDefault();
  const username = (loginUserEl.value||"").trim();
  const password = loginPassEl.value||"";

  hide(loginError);

  try{
    const snap = await get(ref(db, `usuarios/${username}`));
    if(!snap.exists()){
      loginError.textContent = "Usuário não encontrado.";
      show(loginError);
      return;
    }
    const data = snap.val(); // { nome, senha, tipo }
    if(data.senha !== password){
      loginError.textContent = "Senha incorreta.";
      show(loginError);
      return;
    }
    currentUser = data;
    saveSessionName();      // só nome, sem auto-login
    showApp();
    bindFeed();
    toast("Login efetuado");
  }catch(err){
    console.error(err);
    loginError.textContent = "Erro ao fazer login. Tente novamente.";
    show(loginError);
  }
});

logoutBtn?.addEventListener("click", ()=>{
  clearSession();
  showLogin();
});

/* ============================
   Composer (Admin)
============================ */
openComposerBtn?.addEventListener("click", ()=>{
  if(currentUser?.tipo !== "admin") return;
  editingPostId = null;
  composerTitle.textContent = "Criar Post";
  composerForm.reset();
  // tipo default texto
  composerForm.querySelector("input[name='tipo'][value='texto']").checked = true;
  setComposerSection("texto");
  show(composerModal);
});

// Alternância de seções por tipo
composerForm?.addEventListener("change", (e)=>{
  if(e.target.name === "tipo"){
    setComposerSection(e.target.value);
  }
});
function setComposerSection(tipo){
  // mostra apenas a seção do tipo escolhido
  if(tipo === "texto"){
    show(sectionTexto); hide(sectionImagem); hide(sectionEnquete);
  }else if(tipo === "imagem"){
    hide(sectionTexto); show(sectionImagem); hide(sectionEnquete);
  }else if(tipo === "enquete"){
    hide(sectionTexto); hide(sectionImagem); show(sectionEnquete);
  }
}

// Fechar modal (qualquer [data-close-modal])
document.querySelectorAll("[data-close-modal]").forEach(btn=>{
  btn.addEventListener("click", ()=> hide(composerModal));
});

// Salvar/Atualizar post
composerForm?.addEventListener("submit", async (e)=>{
  e.preventDefault();
  if(currentUser?.tipo !== "admin") return;

  const fd = new FormData(composerForm);
  const titulo = (fd.get("titulo")||"").toString().trim();
  const ordem  = Number(fd.get("ordem")||1);
  const tipo   = (fd.get("tipo")||"texto").toString();

  if(!titulo){ toast("Preencha o título."); return; }

  const postData = {
    titulo, tipo, ordem,
    autor: currentUser.nome,
    timestamp: isoNow()
  };

  if(tipo === "texto"){
    postData.conteudo = (fd.get("conteudo_texto")||"").toString();
  }else if(tipo === "imagem"){
    postData.conteudo = (fd.get("conteudo_imagem")||"").toString(); // URL no MVP
  }else if(tipo === "enquete"){
    const opcoes = [];
    for(let i=1;i<=5;i++){
      const val = (fd.get(`enquete_opcao_${i}`)||"").toString().trim();
      if(val) opcoes.push(val);
    }
    if(opcoes.length < 2){ toast("Informe ao menos 2 opções."); return; }
    postData.enquete = { opcoes, votos: {} };
  }

  try{
    if(editingPostId){
      await update(ref(db, `posts/${editingPostId}`), postData);
      toast("Post atualizado.");
    }else{
      const newRef = push(ref(db, "posts"));
      postData.id = newRef.key;
      await set(newRef, postData);
      toast("Post publicado.");
    }
    hide(composerModal);
  }catch(err){
    console.error(err);
    toast("Erro ao salvar o post.");
  }
});

/* ============================
   Feed (render + realtime)
============================ */
let unsubscribePosts = null;

function bindFeed(){
  // limpar listeners antigos
  if(unsubscribePosts) unsubscribePosts();

  const postsRef = ref(db, "posts");
  const off = onValue(postsRef, (snap)=>{
    const list = [];
    if(snap.exists()){
      const obj = snap.val();
      for(const id in obj){ list.push(obj[id]); }
      list.sort(byOrdemAsc);
    }
    renderFeed(list);
  }, (err)=> console.error(err));

  unsubscribePosts = ()=> off(); // compat com v12
}

function renderFeed(posts){
  feedList.innerHTML = "";
  if(!posts || posts.length === 0){
    show(feedEmpty);
    feedList.setAttribute("aria-busy", "false");
    return;
  }
  hide(feedEmpty);

  posts.forEach(post=>{
    const card = buildPostCard(post);
    feedList.appendChild(card);
  });

  feedList.setAttribute("aria-busy", "false");
}

function buildPostCard(post){
  const node = postCardTpl.content.firstElementChild.cloneNode(true);

  node.dataset.postId = post.id || "";
  node.querySelector(".author-name").textContent = post.autor || "—";
  node.querySelector(".post-time").textContent   = asDateTime(post.timestamp||"");
  node.querySelector(".post-title").textContent  = post.titulo || "";

  // menu admin
  const menu = node.querySelector(".post-menu");
  if(currentUser?.tipo === "admin"){ show(menu); } else { hide(menu); }

  // conteúdo
  const textEl  = node.querySelector(".post-text");
  const imgBox  = node.querySelector(".post-image");
  const imgEl   = imgBox.querySelector("img");
  const pollFrm = node.querySelector(".post-poll");
  const pollOpts= node.querySelector(".poll-options");
  const pollRes = node.querySelector(".poll-results");

  if(post.tipo === "texto"){
    textEl.textContent = post.conteudo || "";
    show(textEl);
  }else if(post.tipo === "imagem"){
    if(post.conteudo){
      imgEl.src = post.conteudo;
      show(imgBox);
    }
  }else if(post.tipo === "enquete"){
    // opções como radio
    pollOpts.innerHTML = "";
    const myVote = post.enquete?.votos?.[currentUser?.nome || ""] ?? null;

    (post.enquete?.opcoes || []).forEach((opt, idx)=>{
      const id = `poll_${post.id}_${idx}`;
      const label = document.createElement("label");
      label.style.display = "flex";
      label.style.alignItems = "center";
      label.style.gap = ".5rem";
      label.innerHTML = `
        <input type="radio" name="poll_${post.id}" value="${escapeHtml(opt)}" id="${id}" ${myVote===opt?'checked':''}>
        <span>${escapeHtml(opt)}</span>
      `;
      pollOpts.appendChild(label);
    });

    // resultados (se já votei, mostra contagem)
    if(post.enquete?.votos){
      const counts = {};
      Object.values(post.enquete.votos).forEach(v=> counts[v] = (counts[v]||0)+1);
      pollRes.textContent = Object.keys(counts).length
        ? "Parciais: " + Object.entries(counts).map(([k,v])=>`${k}: ${v}`).join(" · ")
        : "";
      if(myVote){ show(pollRes); }
    }

    // se já votou, desabilitar inputs
    if(myVote){
      pollOpts.querySelectorAll("input[type='radio']").forEach(inp=> inp.disabled = true);
    }

    show(pollFrm);

    // votar
    pollFrm.addEventListener("submit", async (e)=>{
      e.preventDefault();
      if(!currentUser) return;
      if(post.enquete?.votos?.[currentUser.nome]){ toast("Você já votou."); return; }
      const chosen = pollOpts.querySelector("input[type='radio']:checked");
      if(!chosen){ toast("Selecione uma opção."); return; }
      try{
        await set(ref(db, `posts/${post.id}/enquete/votos/${currentUser.nome}`), chosen.value);
        toast("Voto registrado.");
      }catch(err){
        console.error(err);
        toast("Erro ao registrar voto.");
      }
    });
  }

  // like
  const likeBtn   = node.querySelector(".btn-like");
  const likeCount = node.querySelector(".like-count");
  const liked = !!(post.likes && post.likes[currentUser?.nome || ""]);
  likeBtn.setAttribute("aria-pressed", liked ? "true" : "false");
  likeCount.textContent = count(post.likes);

  likeBtn.addEventListener("click", async ()=>{
    if(!currentUser) return;
    const path = ref(db, `posts/${post.id}/likes/${currentUser.nome}`);
    try{
      if(likeBtn.getAttribute("aria-pressed") === "true"){
        await remove(path); // desfaz like
        likeBtn.setAttribute("aria-pressed", "false");
      }else{
        await set(path, true); // like
        likeBtn.setAttribute("aria-pressed", "true");
      }
    }catch(err){
      console.error(err);
      toast("Erro ao registrar like.");
    }
  });

  // comentários (render + enviar)
  const listEl = node.querySelector(".comment-list");
  const frmEl  = node.querySelector(".comment-form");
  const inpEl  = node.querySelector(".comment-input");

  // render inicial
  if(post.comentarios){
    Object.values(post.comentarios).sort((a,b)=>{
      return new Date(a.timestamp||0) - new Date(b.timestamp||0);
    }).forEach(c => {
      const li = document.createElement("li");
      li.textContent = `${c.usuario}: ${c.texto}`;
      listEl.appendChild(li);
    });
  }

  // enviar comentário
  frmEl.addEventListener("submit", async (e)=>{
    e.preventDefault();
    if(!currentUser) return;
    const text = sanitize((inpEl.value||"").trim());
    if(!text) return;
    try{
      const newC = push(ref(db, `posts/${post.id}/comentarios`));
      await set(newC, { usuario: currentUser.nome, texto: text, timestamp: isoNow() });
      inpEl.value = "";
      toast("Comentário enviado.");
    }catch(err){
      console.error(err);
      toast("Erro ao comentar.");
    }
  });

  // editar/excluir (admin)
  const editBtn = node.querySelector(".post-edit");
  const delBtn  = node.querySelector(".post-delete");

  editBtn?.addEventListener("click", ()=>{
    if(currentUser?.tipo !== "admin") return;
    openEditPost(post);
  });

  delBtn?.addEventListener("click", async ()=>{
    if(currentUser?.tipo !== "admin") return;
    confirmText.textContent = "Deseja excluir este post?";
    confirmDialog.showModal();
    const res = await waitDialog(confirmDialog);
    if(res === "ok"){
      try{
        await remove(ref(db, `posts/${post.id}`));
        toast("Post excluído.");
      }catch(err){
        console.error(err);
        toast("Erro ao excluir.");
      }
    }
  });

  return node;
}

function openEditPost(post){
  editingPostId = post.id;
  composerTitle.textContent = "Editar Post";
  show(composerModal);

  // preencher
  composerForm.reset();
  composerForm.querySelector("#post-title").value = post.titulo || "";
  composerForm.querySelector("#post-ordem").value = Number(post.ordem||1);

  composerForm.querySelectorAll("input[name='tipo']").forEach(r=>{
    r.checked = (r.value === post.tipo);
  });
  setComposerSection(post.tipo);

  if(post.tipo === "texto"){
    composerForm.querySelector("#post-conteudo-texto").value = post.conteudo || "";
  }else if(post.tipo === "imagem"){
    composerForm.querySelector("#post-conteudo-imagem").value = post.conteudo || "";
  }else if(post.tipo === "enquete"){
    const ops = post.enquete?.opcoes || [];
    for(let i=1;i<=5;i++){
      const el = composerForm.querySelector(`[name='enquete_opcao_${i}']`);
      el.value = ops[i-1] || "";
    }
  }
}

function waitDialog(dlg){
  return new Promise(resolve=>{
    dlg.addEventListener("close", ()=> resolve(dlg.returnValue), { once:true });
  });
}

/* ============================
   Administrar usuários (dinâmico)
   - Botão "Novo usuário" injetado no header quando admin loga
   - Atalho: Ctrl+U para abrir prompts
============================ */
function ensureCreateUserButton(){
  const container = document.querySelector(".app-actions");
  if(!container || currentUser?.tipo !== "admin") return;

  // evita duplicar
  if(document.getElementById("create-user-btn")) return;

  const btn = document.createElement("button");
  btn.id = "create-user-btn";
  btn.className = "btn btn--ghost";
  btn.title = "Cadastrar novo usuário";
  btn.innerHTML = `<i class="fa-solid fa-user-plus"></i> Novo usuário`;
  btn.addEventListener("click", handleCreateUserPrompt);
  container.insertBefore(btn, container.firstChild);

  // atalho Ctrl+U
  window.addEventListener("keydown", (e)=>{
    if(e.ctrlKey && (e.key.toLowerCase() === "u")){
      e.preventDefault();
      if(currentUser?.tipo === "admin") handleCreateUserPrompt();
    }
  }, { once:false });
}

async function handleCreateUserPrompt(){
  const nome = prompt("Usuário (ex.: joao.silva):")?.trim();
  if(!nome) return;
  const senha = prompt("Senha (mínimo 4 caracteres):") || "";
  if(senha.length < 4){ alert("Senha muito curta."); return; }
  let tipo = prompt('Tipo (admin/leitor):', 'leitor')?.trim().toLowerCase();
  if(tipo !== "admin" && tipo !== "leitor") tipo = "leitor";

  try{
    const path = ref(db, `usuarios/${nome}`);
    const snap = await get(path);
    if(snap.exists()){
      if(!confirm("Usuário já existe. Deseja atualizar a senha/tipo?")) return;
    }
    await set(path, { nome, senha, tipo });
    toast("Usuário salvo.");
  }catch(err){
    console.error(err);
    toast("Erro ao salvar usuário.");
  }
}

/* ============================
   Sanitização simples
============================ */
function escapeHtml(s){
  return (s||"").toString()
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}
function sanitize(s){
  // remove tags básicas (MVP)
  return (s||"").toString().replace(/<[^>]*>/g,"").trim();
}

/* ============================
   Inicialização (SEM auto-login)
============================ */
(async function init(){
  // NÃO chamamos seedIfEmpty aqui porque você já importou base.json
  const lastName = restoreSessionName();
  showLogin();

  // pré-preenche usuário se existir
  if (lastName && loginUserEl) loginUserEl.value = lastName;

  // fechar modal ao clicar fora
  composerModal?.addEventListener("click", (e)=>{
    if(e.target === composerModal) hide(composerModal);
  });
})();
