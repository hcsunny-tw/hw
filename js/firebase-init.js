// js/firebase-init.js
(function () {
  const FIREBASE_CONFIG_KEY = 'homeworkFirebaseConfig';

  // 登入頁元素
  const loginView = document.getElementById('login-view');
  const mainApp = document.querySelector('.main-app');
  const btnShowConfig = document.getElementById('btn-show-config');
  const firebaseConfigTextarea = document.getElementById('firebaseConfig');
  const btnGoogleLogin = document.getElementById('btn-google-login');

  // 提供給 app.js 的橋接
  window.__appState = {
    getUid: () => firebase.auth().currentUser?.uid,
    db: () => firebase.firestore(),
    onSignedInReady: null, // 由 app.js 指派
  };

  // 初始 Firebase（從 textarea 或 localStorage）
  function initFirebase(callback) {
    let configStr = localStorage.getItem(FIREBASE_CONFIG_KEY);
    if (firebaseConfigTextarea.value.trim()) configStr = firebaseConfigTextarea.value.trim();

    if (!configStr) {
      firebaseConfigTextarea.style.display = 'block';
      alert('首次使用，請貼上您的 Firebase 設定檔。');
      return;
    }

    try {
      // 清掉多餘字串，只保留 JSON 主體
      const i = configStr.indexOf('{');
      const j = configStr.lastIndexOf('}');
      if (i === -1 || j === -1) throw new Error('設定檔格式不正確。');
      configStr = configStr.substring(i, j + 1);

      const cfg = JSON.parse(configStr);
      if (!firebase.apps.length) firebase.initializeApp(cfg);
      localStorage.setItem(FIREBASE_CONFIG_KEY, configStr);
      firebaseConfigTextarea.style.display = 'none';

      callback && callback();
    } catch (e) {
      console.error('Firebase 初始化失敗:', e);
      alert('Firebase 初始化失敗，請檢查設定檔是否正確。');
    }
  }

  function signInWithGoogle() {
    initFirebase(() => {
      const provider = new firebase.auth.GoogleAuthProvider();
      firebase.auth().signInWithPopup(provider).catch(err => {
        console.error('Google 登入失敗:', err);
        alert('Google 登入失敗：' + err.message);
      });
    });
  }

  function signOut() {
    firebase.auth().signOut();
  }

  // UI：首次設定按鈕／Google 登入按鈕
  btnShowConfig.addEventListener('click', () => {
    firebaseConfigTextarea.style.display = 'block';
  });
  btnGoogleLogin.addEventListener('click', signInWithGoogle);

  // 監聽 Auth 狀態（先切畫面，再給 app.js 初始化）
  document.addEventListener('DOMContentLoaded', () => {
    initFirebase(() => {
      firebase.auth().onAuthStateChanged(async (user) => {
        if (user) {
          // ✅ 先切畫面，避免後續任何錯誤遮住主畫面
          loginView.style.display = 'none';
          mainApp.style.display = 'block';

          // 交給 app.js 建立主畫面與事件
          if (typeof window.__appState.onSignedInReady === 'function') {
            try { await window.__appState.onSignedInReady(user); }
            catch (e) {
              console.error('初始化主畫面時發生錯誤：', e);
              alert('初始化時發生錯誤，請開發者工具查看錯誤訊息。');
            }
          }
        } else {
          // 未登入
          mainApp.style.display = 'none';
          loginView.style.display = 'block';
          mainApp.innerHTML = ''; // 清空殘留
        }
      });
    });
  });

  // 讓 app.js 可呼叫登出
  window.__auth = { signOut };
})();
