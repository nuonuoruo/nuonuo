// ====== 请替换下面两行为你自己的密钥 ======
const SECRET_ID = 'AKIDhojT7ey61jEkHhw0830qVyGUWSDpFnEW';
const SECRET_KEY = 'GNIAMaieZyOehhWBi9QWUL4czCHAsQuG';
// ====== 替换结束 ======

const cos = new COS({
  SecretId: SECRET_ID,
  SecretKey: SECRET_KEY,
});

const BUCKET = 'photoalbum-123456-1395234423';
const REGION = 'ap-beijing';

const fileInput = document.getElementById('fileInput');
const uploadBtn = document.getElementById('uploadBtn');
const chooseBtn = document.getElementById('chooseBtn');
const gallery = document.getElementById('gallery');

// 预览弹窗相关
const previewModal = document.getElementById('previewModal');
const previewImage = document.getElementById('previewImage');
const previewCaption = document.getElementById('previewCaption');
const closeModalBtn = document.getElementById('closeModal');

// 打开预览
function openPreview(url, caption) {
  if (!previewModal || !previewImage || !previewCaption) return;

  previewImage.src = url;
  previewImage.alt = caption || '预览图片';
  previewCaption.textContent = caption || '';

  previewModal.classList.add('show');
  previewModal.setAttribute('aria-hidden', 'false');
}

// 关闭预览
function closePreview() {
  if (!previewModal || !previewImage || !previewCaption) return;

  previewModal.classList.remove('show');
  previewModal.setAttribute('aria-hidden', 'true');
  previewImage.src = '';
  previewCaption.textContent = '';
}

// 点击遮罩关闭
if (previewModal) {
  previewModal.addEventListener('click', (e) => {
    if (e.target === previewModal) {
      closePreview();
    }
  });
}

// 关闭按钮
if (closeModalBtn) {
  closeModalBtn.addEventListener('click', closePreview);
}

// 按 ESC 关闭
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closePreview();
  }
});

function sanitizeFileName(name) {
  return name.replace(/[^a-zA-Z0-9._-]/g, '');
}

function getSelectedFiles() {
  return Array.from(fileInput.files || []);
}

function updateChooseButtonText() {
  const count = getSelectedFiles().length;
  chooseBtn.textContent = count > 0 ? `已选择 ${count} 张` : '选择图片';
}

// 上传单个文件
function uploadSingleFile(file) {
  return new Promise((resolve, reject) => {
    const key = `photos/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${sanitizeFileName(file.name)}`;

    cos.uploadFile({
      Bucket: BUCKET,
      Region: REGION,
      Key: key,
      Body: file,
    }, function (err, data) {
      if (err) return reject(err);
      resolve(data);
    });
  });
}

// 上传多张
async function uploadFiles() {
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
    alert('上传失败，请检查密钥、Bucket、Region 或网络');
  } finally {
    uploadBtn.disabled = false;
    chooseBtn.style.pointerEvents = '';
    uploadBtn.textContent = '上传图片';
  }
}

// 加载列表
function loadList() {
  gallery.innerHTML = `
    <div class="loading-state">
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

  cos.getBucket({
    Bucket: BUCKET,
    Region: REGION,
    Prefix: 'photos/',
  }, function (err, data) {
    if (err) {
      console.error('列表加载失败:', err);
      gallery.innerHTML = `
        <div class="empty-state">
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
      return;
    }

    const items = data.Contents || [];
    if (items.length === 0) {
      gallery.innerHTML = `
        <div class="empty-state">
          <div class="state-card">
            <div class="state-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M7 16l3-3 3 3 4-4 2 2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M5 5h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" stroke="currentColor" stroke-width="1.8"/>
                <path d="M9 10.5A1.5 1.5 0 1 0 9 7.5a1.5 1.5 0 0 0 0 3Z" fill="currentColor"/>
              </svg>
            </div>
            <h2 class="state-title">暂无照片</h2>
            <p class="state-desc">还没有上传内容，点击上方“选择图片”并上传第一张照片吧。</p>
          </div>
        </div>
      `;
      return;
    }

    gallery.innerHTML = items.map(item => {
      const url = `https://${BUCKET}.cos.${REGION}.myqcloud.com/${item.Key}`;
      const safeKey = item.Key.replace(/'/g, "\\'");
      const safeUrl = url.replace(/'/g, "\\'");

      return `
        <div class="photo-item">
          <div class="photo-preview" onclick="openPreview('${safeUrl}', '${safeKey}')">
            <img src="${url}" alt="${item.Key}" loading="lazy" />
          </div>
          <button class="photo-action" onclick="deleteFile('${safeKey}')">删除</button>
        </div>
      `;
    }).join('');
  });
}

// 删除
function deleteFile(key) {
  if (!confirm('确定要删除这张照片吗？')) return;

  cos.deleteObject({
    Bucket: BUCKET,
    Region: REGION,
    Key: key,
  }, function (err, data) {
    if (err) {
      console.error('删除失败:', err);
      alert('删除失败');
      return;
    }

    alert('删除成功');
    loadList();
  });
}

// 暴露到全局
window.deleteFile = deleteFile;
window.openPreview = openPreview;
window.closePreview = closePreview;

// 绑定选择图片显示数量
fileInput.addEventListener('change', updateChooseButtonText);

// 绑定上传按钮
uploadBtn.addEventListener('click', uploadFiles);

// 初始化
updateChooseButtonText();
loadList();
