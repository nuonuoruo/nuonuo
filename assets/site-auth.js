(function () {
  const CONFIG = {
    secretId: 'AKIDhojT7ey61jEkHhw0830qVyGUWSDpFnEW',
    secretKey: 'GNIAMaieZyOehhWBi9QWUL4czCHAsQuG',
    bucket: 'photoalbum-123456-1395234423',
    region: 'ap-beijing',
    authUserPrefix: 'users/',
    currentUserKey: 'site_current_user_v1',
    passwordIterations: 120000,
  };

  const cos = window.COS
    ? new COS({ SecretId: CONFIG.secretId, SecretKey: CONFIG.secretKey })
    : null;

  const authListeners = new Set();

  function notifyAuthChange() {
    authListeners.forEach((listener) => {
      try {
        listener(getCurrentUser());
      } catch (err) {
        console.warn('Auth listener failed', err);
      }
    });
  }

  function onAuthChange(listener) {
    if (typeof listener !== 'function') return () => {};
    authListeners.add(listener);
    return () => authListeners.delete(listener);
  }

  function bytesToBase64(bytes) {
    let binary = '';
    bytes.forEach((byte) => {
      binary += String.fromCharCode(byte);
    });
    return btoa(binary);
  }

  function base64ToBytes(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  async function hashPassword(password, saltBase64) {
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(password),
      'PBKDF2',
      false,
      ['deriveBits']
    );
    const bits = await crypto.subtle.deriveBits({
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt: base64ToBytes(saltBase64),
      iterations: CONFIG.passwordIterations,
    }, keyMaterial, 256);
    return bytesToBase64(new Uint8Array(bits));
  }

  async function createPasswordRecord(password) {
    const salt = new Uint8Array(16);
    crypto.getRandomValues(salt);
    const passwordSalt = bytesToBase64(salt);
    return {
      passwordAlgo: 'PBKDF2-SHA256',
      passwordIterations: CONFIG.passwordIterations,
      passwordSalt,
      passwordHash: await hashPassword(password, passwordSalt),
    };
  }

  async function verifyPassword(user, password) {
    if (!user) return false;
    if (user.passwordHash && user.passwordSalt) {
      return await hashPassword(password, user.passwordSalt) === user.passwordHash;
    }
    return typeof user.password === 'string' && user.password === password;
  }

  function getCurrentUser() {
    try {
      const raw = localStorage.getItem(CONFIG.currentUserKey);
      if (!raw) return null;
      const user = JSON.parse(raw);
      if (!user || !user.username) return null;
      return user;
    } catch {
      return null;
    }
  }

  function setCurrentUser(user, options = {}) {
    if (!user) {
      localStorage.removeItem(CONFIG.currentUserKey);
    } else {
      localStorage.setItem(CONFIG.currentUserKey, JSON.stringify(user));
    }
    if (options.notify !== false) notifyAuthChange();
  }

  function makeUserKey(username) {
    return `${CONFIG.authUserPrefix}${encodeURIComponent(username)}.json`;
  }

  function assertCos() {
    if (!cos) throw new Error('COS SDK not loaded');
  }

  function putJsonToCos(key, obj) {
    assertCos();
    return new Promise((resolve, reject) => {
      cos.putObject({
        Bucket: CONFIG.bucket,
        Region: CONFIG.region,
        Key: key,
        Body: JSON.stringify(obj, null, 2),
        ContentType: 'application/json; charset=utf-8',
      }, function (err, data) {
        if (err) return reject(err);
        resolve(data);
      });
    });
  }

  function uploadFileToCos(file, key) {
    assertCos();
    return new Promise((resolve, reject) => {
      cos.uploadFile({
        Bucket: CONFIG.bucket,
        Region: CONFIG.region,
        Key: key,
        Body: file,
      }, function (err, data) {
        if (err) return reject(err);
        resolve(data);
      });
    });
  }

  function deleteObject(key) {
    assertCos();
    return new Promise((resolve, reject) => {
      cos.deleteObject({
        Bucket: CONFIG.bucket,
        Region: CONFIG.region,
        Key: key,
      }, function (err, data) {
        if (err) return reject(err);
        resolve(data);
      });
    });
  }

  function getBucket(options = {}) {
    assertCos();
    return new Promise((resolve, reject) => {
      cos.getBucket({
        Bucket: CONFIG.bucket,
        Region: CONFIG.region,
        ...options,
      }, function (err, data) {
        if (err) return reject(err);
        resolve(data);
      });
    });
  }

  function bodyToText(body) {
    if (typeof body === 'string') return Promise.resolve(body);
    if (body instanceof Blob) return body.text();
    if (body && typeof body.text === 'function') return body.text();
    if (body instanceof ArrayBuffer) return Promise.resolve(new TextDecoder('utf-8').decode(body));
    if (ArrayBuffer.isView(body)) return Promise.resolve(new TextDecoder('utf-8').decode(body));
    return Promise.resolve(String(body || ''));
  }

  function getObjectText(key) {
    assertCos();
    return new Promise((resolve, reject) => {
      cos.getObject({
        Bucket: CONFIG.bucket,
        Region: CONFIG.region,
        Key: key,
      }, async function (err, data) {
        if (err) return reject(err);
        try {
          resolve(await bodyToText(data.Body));
        } catch (e) {
          reject(e);
        }
      });
    });
  }

  function isNotFound(err) {
    const code = err?.statusCode || err?.Code || err?.code || err?.error?.Code;
    const msg = String(err?.message || err || '');
    return code === 404 || code === 'NoSuchKey' || msg.includes('404') || msg.includes('NoSuchKey');
  }

  async function getUserByName(username) {
    try {
      const text = await getObjectText(makeUserKey(username));
      return JSON.parse(text);
    } catch (err) {
      if (isNotFound(err)) return null;
      throw err;
    }
  }

  async function upgradePasswordIfNeeded(user, password) {
    if (!user || user.passwordHash || user.password !== password) return;
    const upgradedUser = {
      ...user,
      ...(await createPasswordRecord(password)),
    };
    delete upgradedUser.password;
    await putJsonToCos(makeUserKey(user.username), upgradedUser);
  }

  async function registerUser(username, password) {
    const oldUser = await getUserByName(username);
    if (oldUser) {
      return { ok: false, reason: 'exists' };
    }
    const userData = {
      username,
      ...(await createPasswordRecord(password)),
      createdAt: new Date().toISOString(),
    };
    await putJsonToCos(makeUserKey(username), userData);
    setCurrentUser({ username });
    return { ok: true, user: { username } };
  }

  async function loginUser(username, password) {
    const user = await getUserByName(username);
    if (!user || !(await verifyPassword(user, password))) {
      return { ok: false, reason: 'invalid' };
    }
    await upgradePasswordIfNeeded(user, password);
    setCurrentUser({ username });
    return { ok: true, user: { username } };
  }

  function makeBucketUrl(key) {
    return `https://${CONFIG.bucket}.cos.${CONFIG.region}.myqcloud.com/${key}`;
  }

  window.NuonuoShared = {
    config: CONFIG,
    cos,
    onAuthChange,
    getCurrentUser,
    setCurrentUser,
    makeUserKey,
    putJsonToCos,
    uploadFileToCos,
    deleteObject,
    getBucket,
    getObjectText,
    isNotFound,
    getUserByName,
    createPasswordRecord,
    verifyPassword,
    upgradePasswordIfNeeded,
    registerUser,
    loginUser,
    makeBucketUrl,
  };
})();
