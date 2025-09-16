// js/firebase-init.js
(function () {
  const FIREBASE_CONFIG_KEY = 'homeworkFirebaseConfig';

  // 取得元素（登入畫面）
  const loginView = document.getElementById('login-view');
  const mainApp = document.querySelector('.main-app');
  const btnShowConfig = document.getElementById('btn-show-config');
  const firebaseConfigTextarea = document.getElementById('firebaseConfig');
  const btnGoogleLogin = document.getElementById('btn-google-login');

  // 對外可用的全域函式（讓 app.js 可以使用）
  window.__appState = {
    getUid: () => firebase.auth().currentUser?.uid,
    db: () => firebase.firestore(),
    onSignedInReady: null, // 由 app.js 指派
  };

  function initFirebase(callback) {
    let configStr = localStorage.getItem(FIREBASE_CONFIG_KEY);
    if (firebaseConfigTextarea.value.trim()) configStr = firebaseConfigTextarea.value.trim();

    if (!configStr) {
      firebaseConfigTextarea.style.display = 'block';
      alert('首次使用，請貼上您的 Firebase 設定檔。');
      return;
    }

    try {
      // 清掉多餘字串，保留 JSON 主體
      const startIndex = configStr.indexOf('{');
      const endIndex = configStr.lastIndexOf('}');
      if (startIndex === -1 || endIndex === -1) throw new Error("設定檔格式不正確。");
      configStr = configStr.substring(startIndex, endIndex + 1);

      const config = JSON.parse(configStr);
      if (!firebase.apps.length) firebase.initializeApp(config);
      localStorage.setItem(FIREBASE_CONFIG_KEY, configStr);
      firebaseConfigTextarea.style.display = 'none';

      callback && callback();
    } catch (err) {
      console.error('Firebase 初始化失敗:', err);
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

  // 事件：登入畫面按鈕
  btnShowConfig.addEventListener('click', () => {
    firebaseConfigTextarea.style.display = 'block';
  });
  btnGoogleLogin.addEventListener('click', signInWithGoogle);

  // 初始化 + 監聽登入狀態
  document.addEventListener('DOMContentLoaded', () => {
    initFirebase(() => {
      firebase.auth().onAuthStateChanged(async (user) => {
        if (user) {
          // 先切換顯示，避免之後任何初始事件綁定失敗造成畫面沒切換
          loginView.style.display = 'none';
          mainApp.style.display = 'block';

          // 交給 app.js 做主畫面初始化（寫入 HTML、綁定事件、載入資料）
          if (typeof window.__appState.onSignedInReady === 'function') {
            try {
              await window.__appState.onSignedInReady(user);
            } catch (e) {
              console.error('初始化主畫面時發生錯誤：', e);
              alert('初始化時發生錯誤，請開發者工具查看錯誤訊息。');
            }
          }
        } else {
          // 未登入或已登出
          mainApp.style.display = 'none';
          loginView.style.display = 'block';
          mainApp.innerHTML = ''; // 清空主畫面（避免殘留）
        }
      });
    });
  });

  // 讓 app.js 能呼叫
  window.__auth = { signOut };
})();
