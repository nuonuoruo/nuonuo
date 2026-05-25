// ====== 请替换下面两行为你自己的密钥 ======
const SECRET_ID = 'AKIDhojT7ey61jEkHhw0830qVyGUWSDpFnEW';
const SECRET_KEY = 'GNIAMaieZyOehhWBi9QWUL4czCHAsQuG';
// ====== 替换结束 ======


const BUCKET = 'photoalbum-123456-1395234423';
const REGION = 'ap-beijing';

const AUTH_USER_PREFIX = 'users/';
const LS_CURRENT_USER = 'site_current_user_v1';

const cos = new COS({
  SecretId: SECRET_ID,
  SecretKey: SECRET_KEY,
});

const fileInput = document.getElementById('fileInput');
const uploadBtn = document.getElementById('uploadBtn');
const chooseBtn = document.getElementById('chooseBtn');
const gallery = document.getElementById('gallery');

const previewModal = document.getElementById('previewModal');
const previewImage = document.getElementById('previewImage');
const previewCaption = document.getElementById('previewCaption');
const closeModalBtn = document.getElementById('closeModal');

let authUIReady = false;
let authModalReady = false;

function sanitizeFileName(name) {
  return String(name || '').replace(/[^a-zA-Z0-9._-]/g, '');
}

function randomId() {
  return Math.random().toString(36).slice(2, 10);
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function isImageKey(key) {
  return /\.(png|jpe?g|gif|webp|bmp|svg|heic|avif)$/i.test(String(key || ''));
}

function getSelectedFiles() {
  return Array.from(fileInput.files || []);
}

function updateChooseButtonText() {
  const count = getSelectedFiles().length;
  chooseBtn.textContent = count > 0 ? `已选择 ${count} 张` : '选择图片';
}

function getCurrentUser() {
  try {
    const raw = localStorage.getItem(LS_CURRENT_USER);
    if (!raw) return null;
    const user = JSON.parse(raw);
    if (!user || !user.username) return null;
    return user;
  } catch {
    return null;
  }
}

function setCurrentUser(user) {
  if (!user) {
    localStorage.removeItem(LS_CURRENT_USER);
  } else {
    localStorage.setItem(LS_CURRENT_USER, JSON.stringify(user));
  }
  renderAuthState();
}

function makeUserKey(username) {
  return `${AUTH_USER_PREFIX}${encodeURIComponent(username)}.json`;
}

function putJsonToCos(key, obj) {
  return new Promise((resolve, reject) => {
    cos.putObject({
      Bucket: BUCKET,
      Region: REGION,
      Key: key,
      Body: JSON.stringify(obj, null, 2),
      ContentType: 'application/json; charset=utf-8',
    }, function (err, data) {
      if (err) return reject(err);
      resolve(data);
    });
  });
}

function getObjectText(key) {
  return new Promise((resolve, reject) => {
    cos.getObject({
      Bucket: BUCKET,
      Region: REGION,
      Key: key,
    }, async function (err, data) {
      if (err) return reject(err);

      try {
        const body = data.Body;
        if (typeof body === 'string') return resolve(body);
        if (body instanceof Blob) return resolve(await body.text());
        if (body && typeof body.text === 'function') return resolve(await body.text());
        if (body instanceof ArrayBuffer) {
          return resolve(new TextDecoder('utf-8').decode(body));
        }
        if (ArrayBuffer.isView(body)) {
          return resolve(new TextDecoder('utf-8').decode(body));
        }
        resolve(String(body || ''));
      } catch (e) {
        reject(e);
      }
    });
  });
}

async function getUserByName(username) {
  try {
    const text = await getObjectText(makeUserKey(username));
    return JSON.parse(text);
  } catch (err) {
    if (err && (err.statusCode === 404 || err.error && err.error.Code === 'NoSuchKey')) return null;
    if (String(err && err.message || '').includes('404')) return null;
    throw err;
  }
}

function ensureAuthStyles() {
  if (document.getElementById('authStyles')) return;

  const style = document.createElement('style');
  style.id = 'authStyles';
  style.textContent = `
    .auth-box {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
      margin-left: 8px;
    }
    .auth-status {
      font-size: 13px;
      color: var(--subtext);
      padding: 8px 12px;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.42);
      border: 1px solid rgba(0, 0, 0, 0.05);
      white-space: nowrap;
    }
    .auth-btn {
      border: none;
      border-radius: 999px;
      padding: 10px 14px;
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
      user-select: none;
      -webkit-tap-highlight-color: transparent;
      transition: transform .15s ease, background .2s ease, opacity .2s ease;
      white-space: nowrap;
    }
    .auth-btn:hover { transform: translateY(-1px); }
    .auth-btn.primary {
      background: linear-gradient(180deg, #0a84ff 0%, #0071e3 100%);
      color: #fff;
      box-shadow: 0 10px 22px rgba(0, 113, 227, 0.20);
    }
    .auth-btn.ghost {
      background: rgba(0, 0, 0, 0.06);
      color: var(--text);
    }
    .auth-btn.danger {
      background: rgba(255, 59, 48, 0.92);
      color: #fff;
      box-shadow: 0 8px 18px rgba(255, 59, 48, 0.18);
    }
    .auth-btn:disabled {
      opacity: 0.55;
      cursor: not-allowed;
      transform: none;
      box-shadow: none;
    }
    .photo-owner {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      padding: 12px 14px 0;
      font-size: 12px;
      color: var(--subtext);
      line-height: 1.5;
    }
    .photo-owner strong {
      color: var(--text);
      font-weight: 700;
    }
    .photo-item {
      display: flex;
      flex-direction: column;
    }
    .photo-preview {
      flex: 1 1 auto;
      min-height: 0;
    }
    .auth-modal {
      position: fixed;
      inset: 0;
      z-index: 200;
      display: none;
      align-items: center;
      justify-content: center;
      padding: 18px;
      background: rgba(0, 0, 0, 0.65);
      backdrop-filter: blur(14px);
      -webkit-backdrop-filter: blur(14px);
    }
    .auth-modal.show { display: flex; }
    .auth-modal-card {
      width: min(92vw, 420px);
      border-radius: 24px;
      background: rgba(255, 255, 255, 0.95);
      border: 1px solid rgba(255,255,255,0.3);
      box-shadow: 0 30px 80px rgba(0,0,0,.28);
      overflow: hidden;
    }
    .auth-modal-head {
      padding: 18px 20px 12px;
      border-bottom: 1px solid rgba(0,0,0,.06);
    }
    .auth-modal-head h3 {
      margin: 0;
      font-size: 18px;
      letter-spacing: -0.02em;
    }
    .auth-modal-head p {
      margin: 8px 0 0;
      color: var(--subtext);
      font-size: 13px;
      line-height: 1.7;
    }
    .auth-modal-body {
      padding: 18px 20px 20px;
      display: grid;
      gap: 12px;
    }
    .auth-field {
      display: grid;
      gap: 8px;
    }
    .auth-field label {
      font-size: 13px;
      color: var(--subtext);
      font-weight: 700;
    }
    .auth-input {
      height: 46px;
      border-radius: 14px;
      border: 1px solid rgba(0,0,0,.08);
      padding: 0 14px;
      font-size: 14px;
      outline: none;
      background: rgba(255,255,255,.96);
    }
    .auth-input:focus {
      border-color: rgba(0,113,227,.28);
      box-shadow: 0 0 0 4px rgba(0,113,227,.10);
    }
    .auth-modal-actions {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
      margin-top: 6px;
    }
    .auth-modal-actions button {
      flex: 1 1 0;
      min-width: 120px;
      height: 44px;
      border: none;
      border-radius: 14px;
      font-weight: 700;
      cursor: pointer;
    }
    .auth-modal-actions .ok {
      background: linear-gradient(180deg, #0a84ff 0%, #0071e3 100%);
      color: #fff;
    }
    .auth-modal-actions .cancel {
      background: rgba(0,0,0,.06);
      color: var(--text);
    }
    .auth-switch {
      font-size: 13px;
      color: var(--subtext);
      cursor: pointer;
      user-select: none;
      text-decoration: underline;
    }
    .browse-tip {
      margin-top: 10px;
      padding: 10px 12px;
      border-radius: 14px;
      background: rgba(255, 255, 255, 0.56);
      border: 1px solid rgba(0,0,0,.06);
      color: var(--subtext);
      font-size: 12px;
      line-height: 1.7;
    }
  `;
  document.head.appendChild(style);
}

function ensureAuthUI() {
  if (authUIReady) return;

  const toolbar = document.querySelector('.toolbar');
  if (!toolbar) return;

  ensureAuthStyles();

  const authBox = document.createElement('div');
  authBox.className = 'auth-box';
  authBox.id = 'authBox';
  authBox.innerHTML = `
    <div class="auth-status" id="authStatus">未登录</div>
    <button class="auth-btn primary" id="loginBtn" type="button">登录</button>
    <button class="auth-btn ghost" id="registerBtn" type="button">注册</button>
    <button class="auth-btn danger" id="logoutBtn" type="button" style="display:none;">退出</button>
  `;
  toolbar.appendChild(authBox);

  const tip = document.createElement('div');
  tip.className = 'browse-tip';
  tip.id = 'browseTip';
  tip.textContent = '未登录时只能浏览照片；登录后才能上传、删除，并且每张照片会显示上传者。';
  const content = document.querySelector('.content');
  if (content) {
    content.insertBefore(tip, content.firstChild);
  }

  authUIReady = true;
}

function ensureAuthModal() {
  if (authModalReady) return;

  const modal = document.createElement('div');
  modal.id = 'authModal';
  modal.className = 'auth-modal';
  modal.innerHTML = `
    <div class="auth-modal-card" role="dialog" aria-modal="true" aria-labelledby="authTitle">
      <div class="auth-modal-head">
        <h3 id="authTitle">登录</h3>
        <p id="authDesc">登录后才能上传照片、删除内容，并让上传者信息显示在页面上。</p>
      </div>
      <div class="auth-modal-body">
        <div class="auth-field">
          <label for="authUsername">用户名</label>
          <input id="authUsername" class="auth-input" type="text" maxlength="20" placeholder="请输入用户名" />
        </div>
        <div class="auth-field">
          <label for="authPassword">密码</label>
          <input id="authPassword" class="auth-input" type="password" maxlength="50" placeholder="请输入密码" />
        </div>
        <div class="auth-field" id="authPassword2Wrap" style="display:none;">
          <label for="authPassword2">确认密码</label>
          <input id="authPassword2" class="auth-input" type="password" maxlength="50" placeholder="再次输入密码" />
        </div>
        <div class="auth-modal-actions">
          <button class="ok" id="authSubmitBtn" type="button">登录</button>
          <button class="cancel" id="authCancelBtn" type="button">取消</button>
        </div>
        <div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;">
          <div class="auth-switch" id="authSwitchBtn">没有账号？去注册</div>
          <div class="auth-switch">注册信息会保存到 COS</div>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  authModalReady = true;

  const modalEl = document.getElementById('authModal');
  const titleEl = document.getElementById('authTitle');
  const descEl = document.getElementById('authDesc');
  const submitBtn = document.getElementById('authSubmitBtn');
  const cancelBtn = document.getElementById('authCancelBtn');
  const switchBtn = document.getElementById('authSwitchBtn');

  modalEl.addEventListener('click', (e) => {
    if (e.target === modalEl) closeAuthModal();
  });
  cancelBtn.addEventListener('click', closeAuthModal);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeAuthModal();
  });

  let mode = 'login';

  function renderMode() {
    const isRegister = mode === 'register';
    titleEl.textContent = isRegister ? '注册' : '登录';
    descEl.textContent = isRegister
      ? '注册一个账号，信息会保存到你的 COS 桶里。注册后进入主页、照片墙、留言板都可共用登录状态。'
      : '登录后才能上传照片、删除内容，并让上传者信息显示在页面上。';
    submitBtn.textContent = isRegister ? '注册' : '登录';
    switchBtn.textContent = isRegister ? '已有账号？去登录' : '没有账号？去注册';
    document.getElementById('authPassword2Wrap').style.display = isRegister ? '' : 'none';
    document.getElementById('authPassword').value = '';
    document.getElementById('authPassword2').value = '';
  }

  switchBtn.addEventListener('click', () => {
    mode = mode === 'login' ? 'register' : 'login';
    renderMode();
  });

  submitBtn.addEventListener('click', async () => {
    const username = document.getElementById('authUsername').value.trim();
    const password = document.getElementById('authPassword').value;
    const password2 = document.getElementById('authPassword2').value;

    if (!username || !password) {
      alert('请输入用户名和密码');
      return;
    }
    if (username.length < 2) {
      alert('用户名至少 2 个字符');
      return;
    }

    if (mode === 'register') {
      if (password.length < 4) {
        alert('密码至少 4 位');
        return;
      }
      if (password !== password2) {
        alert('两次密码不一致');
        return;
      }

      try {
        const oldUser = await getUserByName(username);
        if (oldUser) {
          alert('这个用户名已经存在了');
          return;
        }

        await putJsonToCos(makeUserKey(username), {
          username,
          password,
          createdAt: new Date().toISOString()
        });

        setCurrentUser({ username });
        closeAuthModal();
        alert('注册成功，已自动登录');
      } catch (err) {
        console.error(err);
        alert('注册失败，请检查密钥、Bucket、Region、CORS 或网络');
      }
      return;
    }

    try {
      const user = await getUserByName(username);
      if (!user || user.password !== password) {
        alert('用户名或密码错误');
        return;
      }

      setCurrentUser({ username });
      closeAuthModal();
      alert('登录成功');
      loadList();
    } catch (err) {
      console.error(err);
      alert('登录失败，请检查密钥、Bucket、Region、CORS 或网络');
    }
  });

  function renderModeExtern(modeValue) {
    mode = modeValue;
    renderMode();
  }

  modalEl.__setMode = renderModeExtern;
  renderMode();
}

function openAuthModal(mode = 'login') {
  ensureAuthModal();
  const modal = document.getElementById('authModal');
  modal.classList.add('show');
  modal.style.display = 'flex';
  modal.__setMode(mode);
  setTimeout(() => {
    const username = document.getElementById('authUsername');
    if (username) username.focus();
  }, 0);
}

function closeAuthModal() {
  const modal = document.getElementById('authModal');
  if (!modal) return;
  modal.classList.remove('show');
  modal.style.display = 'none';
}

function renderAuthState() {
  ensureAuthUI();

  const user = getCurrentUser();
  const authStatus = document.getElementById('authStatus');
  const loginBtn = document.getElementById('loginBtn');
  const registerBtn = document.getElementById('registerBtn');
  const logoutBtn = document.getElementById('logoutBtn');
  const browseTip = document.getElementById('browseTip');

  if (!authStatus || !loginBtn || !registerBtn || !logoutBtn) return;

  if (user) {
    authStatus.textContent = `当前登录：${user.username}`;
    loginBtn.style.display = 'none';
    registerBtn.style.display = 'none';
    logoutBtn.style.display = '';
    browseTip.textContent = '你已登录，可以上传照片、删除内容，并且每张照片都会显示上传者。';
    uploadBtn.disabled = false;
    chooseBtn.style.pointerEvents = '';
    chooseBtn.style.opacity = '';
    fileInput.disabled = false;
    uploadBtn.textContent = '上传图片';
    updateChooseButtonText();
  } else {
    authStatus.textContent = '未登录';
    loginBtn.style.display = '';
    registerBtn.style.display = '';
    logoutBtn.style.display = 'none';
    browseTip.textContent = '未登录时只能浏览照片；登录后才能上传、删除，并且每张照片会显示上传者。';
    uploadBtn.disabled = true;
    chooseBtn.style.pointerEvents = 'none';
    chooseBtn.style.opacity = '0.55';
    fileInput.disabled = true;
    uploadBtn.textContent = '请先登录';
  }

  loginBtn.onclick = () => openAuthModal('login');
  registerBtn.onclick = () => openAuthModal('register');
  logoutBtn.onclick = () => {
    if (!confirm('确定要退出登录吗？')) return;
    setCurrentUser(null);
    alert('已退出登录');
    renderAuthState();
    loadList();
  };
}

function requireLogin() {
  const user = getCurrentUser();
  if (!user) {
    alert('请先登录后再操作');
    openAuthModal('login');
    return null;
  }
  return user;
}

function openPreview(url, caption) {
  if (!previewModal || !previewImage || !previewCaption) return;
  previewImage.src = url;
  previewImage.alt = caption || '预览图片';
  previewCaption.textContent = caption || '';
  previewModal.classList.add('show');
  previewModal.setAttribute('aria-hidden', 'false');
}

function closePreview() {
  if (!previewModal || !previewImage || !previewCaption) return;
  previewModal.classList.remove('show');
  previewModal.setAttribute('aria-hidden', 'true');
  previewImage.src = '';
  previewCaption.textContent = '';
}

if (previewModal) {
  previewModal.addEventListener('click', (e) => {
    if (e.target === previewModal) closePreview();
  });
}

if (closeModalBtn) {
  closeModalBtn.addEventListener('click', closePreview);
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closePreview();
  }
});

function makePhotoMetaKey(photoKey) {
  return `photo-meta/${encodeURIComponent(photoKey)}.json`;
}

function uploadSingleFile(file) {
  return new Promise((resolve, reject) => {
    const user = requireLogin();
    if (!user) return reject(new Error('NOT_LOGGED_IN'));

    const key = `photos/${Date.now()}-${randomId()}-${sanitizeFileName(file.name)}`;

    cos.uploadFile({
      Bucket: BUCKET,
      Region: REGION,
      Key: key,
      Body: file,
    }, async function (err, data) {
      if (err) return reject(err);

      try {
        const meta = {
          photoKey: key,
          originalName: file.name,
          uploader: user.username,
          createdAt: new Date().toISOString(),
          size: file.size || 0,
          type: file.type || '',
        };

        await putJsonToCos(makePhotoMetaKey(key), meta);
        resolve({ ...data, meta });
      } catch (metaErr) {
        try {
          await new Promise((res) => {
            cos.deleteObject({
              Bucket: BUCKET,
              Region: REGION,
              Key: key,
            }, function () {
              res();
            });
          });
        } catch {}
        reject(metaErr);
      }
    });
  });
}

async function uploadFiles() {
  const user = requireLogin();
  if (!user) return;

  const files = getSelectedFiles();
  if (!files.length) {
    alert('请选择一张或多张图片');
    return;
  }

  uploadBtn.disabled = true;
  chooseBtn.style.pointerEvents = 'none';
  uploadBtn.textContent = '上传中...';

  try {
    for (let i = 0; i < files.length; i++) {
      await uploadSingleFile(files[i]);
    }

    alert(`上传成功！共上传 ${files.length} 张`);
    fileInput.value = '';
    updateChooseButtonText();
    loadList();
  } catch (err) {
    console.error('上传失败:', err);
    if (String(err && err.message) !== 'NOT_LOGGED_IN') {
      alert('上传失败，请检查密钥、Bucket、Region 或网络');
    }
  } finally {
    renderAuthState();
    uploadBtn.disabled = !getCurrentUser();
    chooseBtn.style.pointerEvents = getCurrentUser() ? '' : 'none';
    uploadBtn.textContent = getCurrentUser() ? '上传图片' : '请先登录';
  }
}

function deleteObject(key) {
  return new Promise((resolve, reject) => {
    cos.deleteObject({
      Bucket: BUCKET,
      Region: REGION,
      Key: key,
    }, function (err, data) {
      if (err) return reject(err);
      resolve(data);
    });
  });
}

async function loadList() {
  gallery.innerHTML = `
    <div class="loading-state" style="grid-column: 1 / -1;">
      <div class="state-card">
        <div class="state-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none">
            <path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>
          </svg>
        </div>
        <h2 class="state-title">正在加载照片</h2>
        <p class="state-desc">请稍候，正在从云端获取相册内容。</p>
      </div>
    </div>
  `;

  try {
    const data = await new Promise((resolve, reject) => {
      cos.getBucket({
        Bucket: BUCKET,
        Region: REGION,
        Prefix: 'photos/',
      }, function (err, res) {
        if (err) return reject(err);
        resolve(res);
      });
    });

    const items = (data.Contents || [])
      .filter(item => item && item.Key && isImageKey(item.Key))
      .sort((a, b) => new Date(b.LastModified || 0) - new Date(a.LastModified || 0));

    if (items.length === 0) {
      gallery.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1;">
          <div class="state-card">
            <div class="state-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M7 16l3-3 3 3 4-4 2 2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M5 5h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" stroke="currentColor" stroke-width="1.8"/>
                <path d="M9 10.5A1.5 1.5 0 1 0 9 7.5a1.5 1.5 0 0 0 0 3Z" fill="currentColor"/>
              </svg>
            </div>
            <h2 class="state-title">暂无照片</h2>
            <p class="state-desc">还没有上传内容，登录后点击上方“选择图片”并上传第一张照片吧。</p>
          </div>
        </div>
      `;
      return;
    }

    const enriched = await Promise.all(items.map(async item => {
      const photoKey = item.Key;
      const metaKey = makePhotoMetaKey(photoKey);
      let meta = null;

      try {
        const text = await getObjectText(metaKey);
        meta = JSON.parse(text);
      } catch {
        meta = null;
      }

      return { item, meta };
    }));

    gallery.innerHTML = enriched.map(({ item, meta }) => {
      const url = `https://${BUCKET}.cos.${REGION}.myqcloud.com/${item.Key}`;
      const uploader = escapeHtml(meta?.uploader || '未知用户');
      const createdAt = meta?.createdAt ? new Date(meta.createdAt) : null;
      const timeText = createdAt && !Number.isNaN(createdAt.getTime())
        ? createdAt.toLocaleString('zh-CN', { hour12: false })
        : '';

      const safeKey = item.Key.replace(/'/g, "\\'");
      const safeUrl = url.replace(/'/g, "\\'");
      const caption = `${meta?.originalName || item.Key}\n上传者：${meta?.uploader || '未知用户'}`;

      const deleteBtn = getCurrentUser()
        ? `<button class="photo-action" onclick="deleteFile('${safeKey}')">删除</button>`
        : '';

      return `
        <div class="photo-item">
          <div class="photo-preview" onclick="openPreview('${safeUrl}', '${caption.replace(/'/g, "\\'")}')">
            <img src="${url}" alt="${escapeHtml(meta?.originalName || item.Key)}" loading="lazy" />
          </div>
          <div class="photo-owner">
            <div>上传者：<strong>${uploader}</strong></div>
            <div>${escapeHtml(timeText)}</div>
          </div>
          ${deleteBtn}
        </div>
      `;
    }).join('');
  } catch (err) {
    console.error('列表加载失败:', err);
    gallery.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1;">
        <div class="state-card">
          <div class="state-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M12 9v4" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>
              <path d="M12 17h.01" stroke="currentColor" stroke-width="3.2" stroke-linecap="round"/>
              <path d="M10.3 4.9 2.8 18a2 2 0 0 0 1.73 3h15a2 2 0 0 0 1.73-3l-7.5-13.1a2 2 0 0 0-3.46 0Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
            </svg>
          </div>
          <h2 class="state-title">加载失败</h2>
          <p class="state-desc">请检查密钥、Bucket、Region 或 CORS 配置后重试。</p>
        </div>
      </div>
    `;
  }
}

async function deleteFile(key) {
  const user = requireLogin();
  if (!user) return;

  if (!confirm('确定要删除这张照片吗？')) return;

  try {
    const metaKey = makePhotoMetaKey(key);
    await deleteObject(key);
    try {
      await deleteObject(metaKey);
    } catch {}
    alert('删除成功');
    loadList();
  } catch (err) {
    console.error('删除失败:', err);
    alert('删除失败');
  }
}

window.deleteFile = deleteFile;
window.openPreview = openPreview;
window.closePreview = closePreview;

fileInput.addEventListener('change', updateChooseButtonText);

chooseBtn.addEventListener('click', () => {
  if (!getCurrentUser()) {
    alert('请先登录后再上传');
    openAuthModal('login');
  }
});

uploadBtn.addEventListener('click', uploadFiles);

ensureAuthUI();
ensureAuthModal();
renderAuthState();
updateChooseButtonText();
loadList();
