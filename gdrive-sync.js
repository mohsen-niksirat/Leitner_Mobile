/* ═══════════════════════════════════════════
   Google Drive Sync Module — Leitner Pro
   ═══════════════════════════════════════════
   
   این ماژول قابلیت سینک داده‌ها با Google Drive رو فراهم می‌کنه.
   کاربر با اکانت گوگلش لاگین می‌کنه و داده‌ها تو Drive خودش ذخیره می‌شه.
   
   نیاز به Google Client ID داره:
   1. برید console.cloud.google.com
   2. پروژه بسازید
   3. Google Drive API رو فعال کنید
   4. OAuth consent screen تنظیم کنید
   5. Client ID بسازید (Web application)
   6. redirect URI رو اضافه کنید
═══════════════════════════════════════════ */

const GDriveSync = (() => {
  // ── Config ──
  const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest';
  const SCOPES = 'https://www.googleapis.com/auth/drive.file';
  const BACKUP_FILE_NAME = 'leitner-pro-backup.json';
  const FOLDER_NAME = 'LeitnerPro';
  const TOKEN_KEY = 'leitner-gdrive-token';
  const CLIENT_ID_KEY = 'leitner-gdrive-client-id';
  const STATE_KEY = 'leitner-gdrive-state'; // logged_in, logged_out

  let accessToken = null;
  let tokenExpiry = 0;
  let fileId = null; // ID of the backup file in Drive
  let folderId = null; // ID of the folder in Drive
  let onStatusChange = null; // callback
  let syncInProgress = false;
  let autoSyncTimer = null;

  // ── Helpers ──
  function getClientId() {
    return localStorage.getItem(CLIENT_ID_KEY) || '1048349568529-5our29tuemgr642aqf5t1qqnfsf05ea0.apps.googleusercontent.com';
  }

  function setClientId(id) {
    localStorage.setItem(CLIENT_ID_KEY, id);
  }

  function isLoggedIn() {
    return localStorage.getItem(STATE_KEY) === 'logged_in' && !!accessToken;
  }

  function getStoredToken() {
    try {
      const raw = localStorage.getItem(TOKEN_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (data.expiry && Date.now() < data.expiry) {
        return data;
      }
      // Token expired
      localStorage.removeItem(TOKEN_KEY);
      return null;
    } catch {
      return null;
    }
  }

  function storeToken(token, expiresIn) {
    const data = {
      token,
      expiry: Date.now() + (expiresIn - 60) * 1000 // 60s buffer
    };
    localStorage.setItem(TOKEN_KEY, JSON.stringify(data));
    accessToken = token;
    tokenExpiry = data.expiry;
  }

  function clearToken() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(STATE_KEY);
    accessToken = null;
    tokenExpiry = 0;
    fileId = null;
    folderId = null;
  }

  // ── Google Identity Services (GIS) ──
  // Uses the newer GIS library — no deprecated gapi.auth2
  
  function loadGISLibrary() {
    return new Promise((resolve, reject) => {
      if (window.google && window.google.accounts) {
        resolve();
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = () => {
        // Wait a bit for the library to initialize
        setTimeout(resolve, 500);
      };
      script.onerror = () => reject(new Error('خطا در بارگذاری کتابخانه گوگل'));
      document.head.appendChild(script);
    });
  }

  // ── OAuth2 with GIS Token Model ──
  let tokenClient = null;

  async function initTokenClient() {
    const clientId = getClientId();
    if (!clientId) throw new Error('Google Client ID تنظیم نشده');
    
    await loadGISLibrary();
    
    return new Promise((resolve) => {
      tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: SCOPES,
        callback: (tokenResponse) => {
          if (tokenResponse.error) {
            console.error('OAuth error:', tokenResponse);
            notifyStatus('error', 'خطا در ورود: ' + tokenResponse.error);
            return;
          }
          storeToken(tokenResponse.access_token, tokenResponse.expires_in);
          localStorage.setItem(STATE_KEY, 'logged_in');
          notifyStatus('logged_in', 'با موفقیت وارد شدید');
          resolve(tokenResponse.access_token);
        },
      });
      resolve(tokenClient);
    });
  }

  async function signIn() {
    const clientId = getClientId();
    if (!clientId) {
      notifyStatus('need_config', 'ابتدا Google Client ID را تنظیم کنید');
      showConfigSheet();
      return;
    }

    try {
      notifyStatus('connecting', 'در حال اتصال...');
      
      // Check for stored valid token first
      const stored = getStoredToken();
      if (stored) {
        accessToken = stored.token;
        tokenExpiry = stored.expiry;
        localStorage.setItem(STATE_KEY, 'logged_in');
        notifyStatus('logged_in', 'با موفقیت وارد شدید');
        return;
      }

      await initTokenClient();
      
      // Request access token
      if (tokenClient) {
        tokenClient.requestAccessToken({ prompt: 'consent' });
      }
    } catch (err) {
      console.error('Sign-in error:', err);
      notifyStatus('error', 'خطا در ورود: ' + err.message);
    }
  }

  async function signOut() {
    if (accessToken) {
      try {
        google.accounts.oauth2.revoke(accessToken);
      } catch {}
    }
    clearToken();
    notifyStatus('logged_out', 'از حساب گوگل خارج شدید');
  }

  // ── Drive API Calls ──
  async function driveFetch(url, options = {}) {
    if (!accessToken) {
      clearToken();
      notifyStatus('token_expired', 'توکن موجود نیست. دوباره وارد شوید');
      throw new Error('TOKEN_EXPIRED');
    }
    
    const headers = {
      'Authorization': `Bearer ${accessToken}`,
      ...options.headers
    };
    
    let resp;
    try {
      console.log('[GDrive] Fetching:', url.substring(0, 80) + '...');
      console.log('[GDrive] Headers:', JSON.stringify({ Authorization: 'Bearer ' + accessToken.substring(0, 20) + '...', ...options.headers }));
      resp = await fetch(url, { ...options, headers });
      console.log('[GDrive] Response status:', resp.status);
    } catch (fetchErr) {
      console.error('[GDrive] Fetch error:', fetchErr);
      console.error('[GDrive] URL:', url);
      console.error('[GDrive] Token present:', !!accessToken);
      console.error('[GDrive] Token length:', accessToken ? accessToken.length : 0);
      console.error('[GDrive] Origin:', window.location.origin);
      // Try a simple test fetch to Google
      try {
        const testResp = await fetch('https://www.googleapis.com/drive/v3/about?fields=user', { headers: { 'Authorization': 'Bearer ' + accessToken } });
        console.error('[GDrive] Test fetch status:', testResp.status);
      } catch (testErr) {
        console.error('[GDrive] Test fetch also failed:', testErr);
      }
      throw new Error('خطا در اتصال: ' + fetchErr.message);
    }
    
    if (resp.status === 401) {
      // Token expired — try to re-authenticate
      clearToken();
      notifyStatus('token_expired', 'نشست شما منقضی شده. دوباره وارد شوید');
      throw new Error('TOKEN_EXPIRED');
    }
    
    if (resp.status === 403) {
      const err = await resp.json().catch(() => ({}));
      if (err.error && err.error.errors) {
        const reason = err.error.errors[0].reason;
        if (reason === 'rateLimitExceeded' || reason === 'userRateLimitExceeded') {
          throw new Error('RATE_LIMIT');
        }
      }
      throw new Error('دسترسی رد شد. مجوزها را بررسی کنید');
    }
    
    return resp;
  }

  // Find or create the LeitnerPro folder
  async function findOrCreateFolder() {
    if (folderId) return folderId;
    
    // Search for existing folder
    const searchResp = await driveFetch(
      `https://www.googleapis.com/drive/v3/files?q=name='${FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false&fields=files(id,name)`
    );
    const searchResult = await searchResp.json();
    
    if (searchResult.files && searchResult.files.length > 0) {
      folderId = searchResult.files[0].id;
      return folderId;
    }
    
    // Create folder
    const createResp = await driveFetch('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: FOLDER_NAME,
        mimeType: 'application/vnd.google-apps.folder'
      })
    });
    const createResult = await createResp.json();
    folderId = createResult.id;
    return folderId;
  }

  // Find the backup file
  async function findBackupFile() {
    if (fileId) return fileId;
    
    const folder = await findOrCreateFolder();
    const resp = await driveFetch(
      `https://www.googleapis.com/drive/v3/files?q=name='${BACKUP_FILE_NAME}' and '${folder}' in parents and trashed=false&fields=files(id,name,modifiedTime)`
    );
    const result = await resp.json();
    
    if (result.files && result.files.length > 0) {
      fileId = result.files[0].id;
      return fileId;
    }
    return null;
  }

  // Download backup from Drive
  async function downloadBackup() {
    const fId = await findBackupFile();
    if (!fId) return null;
    
    const resp = await driveFetch(
      `https://www.googleapis.com/drive/v3/files/${fId}?alt=media`
    );
    
    if (!resp.ok) {
      throw new Error('خطا در دانلود فایل پشتیبان');
    }
    
    const text = await resp.text();
    try {
      return JSON.parse(text);
    } catch (e) {
      console.error('Invalid JSON in backup file:', text.substring(0, 200));
      // Delete corrupted file so next sync creates a fresh one
      try {
        await driveFetch(
          `https://www.googleapis.com/drive/v3/files/${fId}`,
          { method: 'DELETE' }
        );
        fileId = null;
      } catch {}
      return null;
    }
  }

  // Upload backup to Drive
  async function uploadBackup(data) {
    const folder = await findOrCreateFolder();
    const jsonStr = JSON.stringify(data, null, 2);
    
    // If file exists, update it; otherwise create new
    const existingId = await findBackupFile();
    
    if (existingId) {
      // Update existing file content
      const resp = await driveFetch(
        `https://www.googleapis.com/upload/drive/v3/files/${existingId}?uploadType=media`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: jsonStr
        }
      );
      if (!resp.ok) throw new Error('خطا در آپلود');
      return await resp.json();
    } else {
      // Create new file: first create metadata, then upload content
      const createResp = await driveFetch(
        'https://www.googleapis.com/drive/v3/files',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: BACKUP_FILE_NAME,
            mimeType: 'application/json',
            parents: [folder]
          })
        }
      );
      if (!createResp.ok) throw new Error('خطا در ساخت فایل');
      const createResult = await createResp.json();
      fileId = createResult.id;
      
      // Now upload the content
      const uploadResp = await driveFetch(
        `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: jsonStr
        }
      );
      if (!uploadResp.ok) throw new Error('خطا در آپلود محتوا');
      return await uploadResp.json();
    }
  }

  // ── Sync Logic ──
  function buildBackupData() {
    return {
      schema: 'leitner-pro-backup',
      version: typeof SCHEMA_VERSION !== 'undefined' ? SCHEMA_VERSION : 2,
      syncedAt: new Date().toISOString(),
      device: navigator.userAgent.includes('Android') ? 'android' : 
              navigator.userAgent.includes('iPhone') ? 'ios' : 'web',
      words: (typeof state !== 'undefined' && state.words) ? state.words : [],
      longTerm: (typeof state !== 'undefined' && state.longTerm) ? state.longTerm : [],
      stats: (typeof state !== 'undefined' && state.stats) ? state.stats : {},
      categories: (typeof state !== 'undefined' && state.categories) ? state.categories : [],
      settings: (typeof state !== 'undefined' && state.settings) ? state.settings : {},
      achievements: (typeof state !== 'undefined' && state.achievements) ? state.achievements : {},
      streak: (typeof state !== 'undefined') ? state.streak : 0,
      lastStudyDate: (typeof state !== 'undefined') ? state.lastStudyDate : null
    };
  }

  async function syncToDrive() {
    if (!isLoggedIn() || syncInProgress) return;
    
    syncInProgress = true;
    notifyStatus('syncing', 'در حال ذخیره‌سازی...');
    
    try {
      console.log('[GDrive] Starting sync...');
      console.log('[GDrive] Token exists:', !!accessToken);
      console.log('[GDrive] Token length:', accessToken ? accessToken.length : 0);
      const data = buildBackupData();
      console.log('[GDrive] Backup data size:', JSON.stringify(data).length, 'bytes');
      await uploadBackup(data);
      notifyStatus('synced', '✅ داده‌ها با موفقیت ذخیره شد');
      
      // Update last sync time
      localStorage.setItem('leitner-gdrive-last-sync', new Date().toISOString());
    } catch (err) {
      console.error('Upload error:', err);
      if (err.message === 'TOKEN_EXPIRED') return;
      if (err.message === 'RATE_LIMIT') {
        notifyStatus('error', '⏳ محدودیت سرعت. کمی صبر کنید');
      } else {
        notifyStatus('error', 'خطا در ذخیره: ' + err.message);
      }
    } finally {
      syncInProgress = false;
    }
  }

  async function syncFromDrive() {
    if (!isLoggedIn() || syncInProgress) return null;
    
    syncInProgress = true;
    notifyStatus('syncing', 'در حال دریافت اطلاعات...');
    
    try {
      const remoteData = await downloadBackup();
      if (!remoteData) {
        notifyStatus('no_data', 'فایل پشتیبانی یافت نشد');
        return null;
      }
      notifyStatus('downloaded', 'اطلاعات دریافت شد');
      return remoteData;
    } catch (err) {
      console.error('Download error:', err);
      if (err.message === 'TOKEN_EXPIRED') return null;
      notifyStatus('error', 'خطا در دریافت: ' + err.message);
      return null;
    } finally {
      syncInProgress = false;
    }
  }

  async function fullSync() {
    if (!isLoggedIn()) {
      notifyStatus('not_logged', 'ابتدا وارد شوید');
      return;
    }

    syncInProgress = true;
    notifyStatus('syncing', 'در حال همگام‌سازی...');

    try {
      // 1. Download remote data
      const remoteData = await downloadBackup();
      
      if (!remoteData) {
        // No remote data — upload local data
        const data = buildBackupData();
        await uploadBackup(data);
        notifyStatus('synced', '✅ اولین پشتیبان‌گیری انجام شد');
        return;
      }

      // 2. Merge: remote words into local
      const localWords = state.words || [];
      const localLongTerm = state.longTerm || [];
      const remoteWords = remoteData.words || [];
      const remoteLongTerm = remoteData.longTerm || [];
      
      let newWordsCount = 0;
      let updatedCount = 0;
      
      // Add remote words that don't exist locally
      for (const rw of remoteWords) {
        const existing = localWords.find(lw => 
          lw.word && rw.word && lw.word.toLowerCase() === rw.word.toLowerCase()
        );
        if (!existing) {
          localWords.push(rw);
          newWordsCount++;
        } else {
          // Update if remote is newer (has more reviews or higher box)
          if ((rw.reviews || 0) > (existing.reviews || 0) || 
              (rw.box || 0) > (existing.box || 0)) {
            Object.assign(existing, rw);
            updatedCount++;
          }
        }
      }
      
      // Merge longTerm
      for (const rw of remoteLongTerm) {
        const exists = localLongTerm.find(lw => 
          lw.word && rw.word && lw.word.toLowerCase() === rw.word.toLowerCase()
        );
        if (!exists) {
          localLongTerm.push(rw);
        }
      }

      // 3. Merge categories
      if (remoteData.categories) {
        remoteData.categories.forEach(c => {
          if (!state.categories.includes(c)) state.categories.push(c);
        });
      }

      // 4. Merge achievements
      if (remoteData.achievements) {
        state.achievements = { ...state.achievements, ...remoteData.achievements };
      }

      // 5. Keep the better stats
      if (remoteData.stats) {
        state.stats = {
          totalReviews: Math.max(state.stats.totalReviews || 0, remoteData.stats.totalReviews || 0),
          totalCorrect: Math.max(state.stats.totalCorrect || 0, remoteData.stats.totalCorrect || 0)
        };
      }

      // 6. Keep higher streak
      if (remoteData.streak && remoteData.streak > (state.streak || 0)) {
        state.streak = remoteData.streak;
      }

      // 7. Update state
      state.words = localWords;
      state.longTerm = localLongTerm;

      // 8. Save to IndexedDB
      if (typeof dbPutAll === 'function') {
        await dbPutAll(state.words);
      }
      if (typeof dbPutStat === 'function') {
        await dbPutStat('categories', state.categories);
        await dbPutStat('stats', state.stats);
        await dbPutStat('achievements', state.achievements);
        await dbPutStat('streak', state.streak);
      }

      // 9. Upload merged data back
      const mergedData = buildBackupData();
      await uploadBackup(mergedData);

      // 10. Report
      let msg = '✅ همگام‌سازی کامل شد';
      if (newWordsCount > 0) msg += ` — ${newWordsCount} لغت جدید`;
      if (updatedCount > 0) msg += ` — ${updatedCount} لغت بروزرسانی شد`;
      notifyStatus('synced', msg);

      // Refresh UI
      if (typeof renderHome === 'function') renderHome();
      if (typeof renderLibrary === 'function') renderLibrary();

    } catch (err) {
      console.error('Full sync error:', err);
      if (err.message === 'TOKEN_EXPIRED') return;
      notifyStatus('error', 'خطا در همگام‌سازی: ' + err.message);
    } finally {
      syncInProgress = false;
      localStorage.setItem('leitner-gdrive-last-sync', new Date().toISOString());
    }
  }

  // ── Debounced auto-sync ──
  function scheduleAutoSync() {
    clearTimeout(autoSyncTimer);
    autoSyncTimer = setTimeout(() => {
      if (isLoggedIn()) {
        syncToDrive();
      }
    }, 3000); // 3 seconds after last change
  }

  // ── Status notification ──
  function notifyStatus(status, message) {
    if (onStatusChange) onStatusChange(status, message);
    // Also dispatch custom event
    window.dispatchEvent(new CustomEvent('gdrive-status', { 
      detail: { status, message } 
    }));
  }

  // ── Config UI ──
  function showConfigSheet() {
    const currentId = getClientId();
    if (typeof openSheet === 'function') {
      openSheet(`
        <div style="text-align:center;margin-bottom:20px">
          <div style="font-size:3rem;margin-bottom:10px">⚙️</div>
          <h3 style="font-size:1.1rem;font-weight:800">تنظیم Google Drive</h3>
          <p style="color:var(--text2);font-size:.8rem;margin-top:8px">
            برای ذخیره‌سازی ابری، Google Client ID نیاز است
          </p>
        </div>
        
        <div class="field">
          <label class="label">Google Client ID</label>
          <input type="text" id="gdrive-client-id-input" 
                 value="${currentId}"
                 placeholder="xxxx.apps.googleusercontent.com"
                 style="direction:ltr;font-size:.8rem">
        </div>
        
        <div class="card" style="background:var(--glass);font-size:.78rem;color:var(--text2);line-height:1.8">
          <strong>📋 راهنمای دریافت Client ID:</strong><br>
          ۱. به <a href="https://console.cloud.google.com" target="_blank">console.cloud.google.com</a> بروید<br>
          ۲. یک پروژه جدید بسازید<br>
          ۳. Google Drive API را فعال کنید<br>
          ۴. بخش OAuth consent screen → External<br>
          ۵. بخش Credentials → Create OAuth Client ID<br>
          ۶. نوع: Web application<br>
          ۷. Authorized JavaScript origins: ا域名 اپ خود را اضافه کنید
        </div>
        
        <button class="btn btn-primary btn-block" onclick="GDriveSync.saveClientId()" style="margin-top:16px">
          💾 ذخیره
        </button>
      `);
    }
  }

  function saveClientId() {
    const input = document.getElementById('gdrive-client-id-input');
    if (input && input.value.trim()) {
      setClientId(input.value.trim());
      if (typeof closeSheet === 'function') closeSheet();
      if (typeof toast === 'function') toast('✅ Client ID ذخیره شد', 'success');
      notifyStatus('configured', 'تنظیمات ذخیره شد');
    } else {
      if (typeof toast === 'function') toast('لطفاً Client ID را وارد کنید', 'danger');
    }
  }

  // ── Status display in UI ──
  function getStatusText() {
    if (!getClientId()) return '⚠️ تنظیم نشده';
    if (!isLoggedIn()) return '🔒 خارج از حساب';
    const lastSync = localStorage.getItem('leitner-gdrive-last-sync');
    if (lastSync) {
      const d = new Date(lastSync);
      const now = new Date();
      const diffMin = Math.floor((now - d) / 60000);
      if (diffMin < 1) return '🟢 همین الان';
      if (diffMin < 60) return `🟢 ${diffMin} دقیقه پیش`;
      const diffHour = Math.floor(diffMin / 60);
      if (diffHour < 24) return `🟡 ${diffHour} ساعت پیش`;
      return `🔴 ${Math.floor(diffHour / 24)} روز پیش`;
    }
    return '🟢 متصل (بدون سابقه)';
  }

  // ── Init: restore token from localStorage on page load ──
  function init() {
    const stored = getStoredToken();
    if (stored) {
      accessToken = stored.token;
      tokenExpiry = stored.expiry;
      // Also make sure state is set
      if (localStorage.getItem(STATE_KEY) !== 'logged_in') {
        localStorage.setItem(STATE_KEY, 'logged_in');
      }
    } else {
      // Token expired or missing — clear state
      if (localStorage.getItem(STATE_KEY) === 'logged_in') {
        clearToken();
      }
    }
  }
  init(); // Run on module load

  // ── Public API ──
  return {
    signIn,
    signOut,
    fullSync,
    syncToDrive,
    syncFromDrive,
    scheduleAutoSync,
    showConfigSheet,
    saveClientId,
    getStatusText,
    isLoggedIn,
    getClientId,
    setClientId,
    buildBackupData,
    
    // For external use
    set onStatusChange(fn) { onStatusChange = fn; },
    get isReady() { return !!getClientId(); },
    get isConnected() { return isLoggedIn(); },
    get lastSync() { return localStorage.getItem('leitner-gdrive-last-sync'); }
  };
})();

// Make it globally accessible
window.GDriveSync = GDriveSync;
