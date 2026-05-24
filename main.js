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
const gallery = document.getElementById('gallery');

// 上传
async function uploadFile() {
  const file = fileInput.files[0];
  if (!file) return alert('请选择一张图片');

  const key = `photos/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '')}`;

  uploadBtn.disabled = true;
  uploadBtn.textContent = '上传中...';

  cos.uploadFile({
    Bucket: BUCKET,
    Region: REGION,
    Key: key,
    Body: file,
  }, function (err, data) {
    uploadBtn.disabled = false;
    uploadBtn.textContent = '上传照片';

    if (err) {
      console.error('上传失败:', err);
      alert('上传失败，请检查密钥或网络');
      return;
    }

    alert('上传成功！');
    loadList();
    fileInput.value = '';
    const fileName = document.getElementById('fileName');
    if (fileName) fileName.textContent = '未选择文件';
  });
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
            <p class="state-desc">还没有上传内容，点击上方“选择文件”并上传第一张照片吧。</p>
          </div>
        </div>
      `;
      return;
    }

    gallery.innerHTML = items.map(item => {
      const url = `https://${BUCKET}.cos.${REGION}.myqcloud.com/${item.Key}`;
      return `
        <div class="photo-item">
          <div class="photo-preview">
            <img src="${url}" alt="${item.Key}" loading="lazy" />
          </div>
          <div class="photo-meta">
            <div class="photo-name">${item.Key}</div>
            <div class="photo-actions">
              <span class="photo-badge">已上传</span>
              <button class="photo-action" onclick="deleteFile('${item.Key.replace(/'/g, "\\'")}')">删除</button>
            </div>
          </div>
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

// 暴露 deleteFile 到全局（因 onclick 是字符串调用）
window.deleteFile = deleteFile;

// 绑定上传按钮
uploadBtn.addEventListener('click', uploadFile);

// 初始化加载
loadList();