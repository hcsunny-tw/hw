// js/app.js
(function () {
  const THEME_KEY = 'homeworkSystemTheme';
  const LOCAL_DATA_KEY_PREFIX = 'homeworkSystemData_';

  // 狀態
  let data = { roster: [], assignments: [] };
  let currentAssignmentId = null;
  let sortState = { key: 'id', direction: 'desc' };
  let currentFilter = 'all';
  let firebaseUnsubscribes = [];

  // DOM（登入頁有的）
  const mainApp = document.querySelector('.main-app');

  // DOM（登入後才會生成）
  let userInfo, userName, btnLogout, themeToggle, teacherFilter, views,
      navDashboardBtn, navRosterBtn, navStudentStatusBtn,
      ipTeacherSelect, ipTeacherCustom, ipTitle, ipDate, btnCreate,
      assignmentList, assignmentTableHead, btnExport, fileImport,
      detailTitle, gridContainer, rangeSize, rosterEditor,
      taRosterPaste, btnLoadFromPaste, btnApplyRoster, studentStatusContainer;

  const mainAppHTML = `
    <header>
      <div class="brand">
        <div class="logo">💎</div>
        <div>
          <h1><i class="bi bi-journal-check"></i> 作業繳交系統</h1>
          <div class="muted">狀態循環：灰＝未繳 → 黃＝已繳 → 橘＝需訂正 → 綠＝完成 →（回到）灰</div>
        </div>
      </div>
      <div class="actions">
        <div class="user-info">
          <span id="user-name" class="badge"></span>
          <button class="btn warn sm" id="btn-logout">登出</button>
        </div>
        <button class="btn ghost" id="theme-toggle" title="切換深色模式"><i class="bi bi-moon-stars-fill"></i></button>
      </div>
    </header>

    <section id="view-dashboard" class="view show">
      <div class="card">
        <h2><i class="bi bi-plus-circle-dotted"></i> 建立新作業</h2>
        <div class="row">
          <div class="field sm-4">
            <label for="ipTeacherSelect">老師姓名</label>
            <select id="ipTeacherSelect">
              <option>彭老師</option><option>謝老師</option><option>石老師</option>
              <option value="custom">自行輸入...</option>
            </select>
            <input id="ipTeacherCustom" type="text" placeholder="請輸入老師姓名" style="display:none;margin-top:8px;">
          </div>
          <div class="field sm-5"><label for="ipTitle">作業名稱</label><input id="ipTitle" type="text" placeholder="例：GOING SEVENTEEN 觀後感" /></div>
          <div class="field sm-3"><label for="ipDate">日期</label><input id="ipDate" type="date" /></div>
        </div>
        <div class="actions">
          <button class="btn" id="btnCreate"><i class="bi bi-plus-circle"></i> 建立作業</button>
          <button class="btn ghost" id="btnExport"><i class="bi bi-download"></i> 匯出 JSON</button>
          <label class="btn ghost" for="fileImport" style="cursor:pointer;"><i class="bi bi-upload"></i> 匯入 JSON</label>
          <input id="fileImport" type="file" accept="application/json" hidden />
        </div>
      </div>

      <div class="card">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
          <h2><i class="bi bi-list-task"></i> 作業列表</h2>
          <div class="field" style="max-width:200px;">
            <label for="teacherFilter">依老師篩選</label>
            <select id="teacherFilter"></select>
          </div>
        </div>
        <div class="table-wrap">
          <table id="assignmentTable">
            <thead>
              <tr>
                <th data-sort="date">日期 <i class="bi"></i></th>
                <th data-sort="title">作業名稱 <i class="bi"></i></th>
                <th data-sort="teacher">老師 <i class="bi"></i></th>
                <th>繳交進度</th><th></th>
              </tr>
            </thead>
            <tbody id="assignmentList"></tbody>
          </table>
        </div>
      </div>
    </section>

    <section id="view-detail" class="view">
      <div class="card">
        <div class="assignment-bar">
          <div class="title" id="detailTitle"></div>
          <div class="legend">
            <div><span class="dot s0"></span>未繳</div>
            <div><span class="dot s1"></span>已繳</div>
            <div><span class="dot s2"></span>需訂正</div>
            <div><span class="dot s3"></span>完成</div>
          </div>
        </div>
        <div class="row" style="align-items:center;">
          <div class="field sm-6">
            <label for="rangeSize">調整顯示大小</label>
            <input type="range" id="rangeSize" min="40" max="100" value="56">
          </div>
        </div>
        <div id="gridContainer" class="grid"></div>
      </div>
    </section>

    <section id="view-roster" class="view">
      <div class="card">
        <h2><i class="bi bi-person-lines-fill"></i> 編輯學生名單</h2>
        <div class="roster-wrapper"><div class="roster-grid" id="rosterEditor"></div></div>
        <details>
          <summary>或從文字一次貼上 (一行一個姓名)</summary>
          <textarea id="taRosterPaste" rows="10" style="width:100%; margin-top:10px;" placeholder="S.Coups&#10;淨漢..."></textarea>
          <div class="actions" style="justify-content:flex-end;">
            <button class="btn secondary sm" id="btnLoadFromPaste"><i class="bi bi-clipboard-plus"></i> 從上方文字更新列表</button>
          </div>
        </details>
        <div class="actions"><button class="btn" id="btnApplyRoster"><i class="bi bi-check-circle"></i> 確認並儲存名單</button></div>
      </div>
    </section>

    <section id="view-student-status" class="view">
      <div class="card">
        <h2><i class="bi bi-clipboard2-check"></i> 學生待辦事項</h2>
        <div id="studentStatusContainer"></div>
      </div>
    </section>
  `;

  // 工具
  const getLocalDataKey = (uid) => `${LOCAL_DATA_KEY_PREFIX}${uid}`;
  const loadData = (uid) => {
    const saved = localStorage.getItem(getLocalDataKey(uid));
    data = saved ? JSON.parse(saved) : { roster: [], assignments: [] };
  };
  const saveData = (uid) => { if (uid) localStorage.setItem(getLocalDataKey(uid), JSON.stringify(data)); };

  // Firebase 便捷
  const db = () => window.__appState.db();
  const getUid = () => window.__appState.getUid();

  // Firestore 監聽
  function attachFirebaseListeners(userId) {
    // 清掉舊監聽
    firebaseUnsubscribes.forEach(u => u && u());
    firebaseUnsubscribes = [];

    const rosterUnsub = db()
      .collection('users').doc(userId)
      .collection('data').doc('roster')
      .onSnapshot(doc => {
        data.roster = doc.exists && doc.data().list ? doc.data().list : [];
        saveData(userId);
        renderAll();
      }, err => console.error('Roster listener error:', err));

    const assignmentsUnsub = db()
      .collection('users').doc(userId)
      .collection('assignments')
      .onSnapshot(snap => {
        snap.docChanges().forEach(ch => {
          const d = ch.doc.data();
          const i = data.assignments.findIndex(a => a.id == d.id);
          if (ch.type === 'added' && i === -1) data.assignments.push(d);
          else if (ch.type === 'modified' && i > -1) data.assignments[i] = d;
          else if (ch.type === 'removed' && i > -1) data.assignments.splice(i, 1);
        });
        saveData(userId);
        renderAll();
      }, err => console.error('Assignments listener error:', err));

    firebaseUnsubscribes.push(rosterUnsub, assignmentsUnsub);
  }

  // CRUD
  async function saveRosterToFirebase(newRoster) {
    const uid = getUid(); if (!uid) return;
    await db().collection('users').doc(uid).collection('data').doc('roster').set({ list: newRoster });
  }
  async function addAssignmentToFirebase(assignment) {
    const uid = getUid(); if (!uid) return;
    await db().collection('users').doc(uid).collection('assignments').doc(String(assignment.id)).set(assignment);
  }
  async function deleteAssignmentFromFirebase(assignmentId) {
    const uid = getUid(); if (!uid) return;
    await db().collection('users').doc(uid).collection('assignments').doc(String(assignmentId)).delete();
  }
  async function updateAssignmentFieldInFirebase(assignmentId, field, value) {
    const uid = getUid(); if (!uid) return;
    await db().collection('users').doc(uid).collection('assignments').doc(String(assignmentId)).update({ [field]: value });
  }

  // 畫面渲染
  function renderAll() {
    if (!getUid()) return;
    const currentView = document.querySelector('.main-app .view.show');
    const viewId = currentView ? currentView.id : 'view-dashboard';
    switch (viewId) {
      case 'view-dashboard':
        populateTeacherFilter();
        renderDashboard();
        break;
      case 'view-detail':
        renderDetail(currentAssignmentId);
        break;
      case 'view-roster':
        renderRosterEditor();
        break;
      case 'view-student-status':
        renderStudentStatus();
        break;
    }
  }

  function populateTeacherFilter() {
    const teachers = ['all', ...new Set(data.assignments.map(a => a.teacher))];
    if (teacherFilter) {
      teacherFilter.innerHTML = teachers.map(t => `<option value="${t}">${t === 'all' ? '所有老師' : t}</option>`).join('');
      teacherFilter.value = currentFilter;
    }
  }

  function renderDashboard() {
    let list = [...data.assignments];
    if (currentFilter !== 'all') list = list.filter(a => a.teacher === currentFilter);
    list.sort((a, b) => {
      const av = a[sortState.key]; const bv = b[sortState.key];
      if (av < bv) return sortState.direction === 'asc' ? -1 : 1;
      if (av > bv) return sortState.direction === 'asc' ? 1 : -1;
      return 0;
    });

    // 標頭排序圖示
    if (assignmentTableHead) {
      assignmentTableHead.querySelectorAll('th[data-sort]').forEach(th => {
        const icon = th.querySelector('i');
        th.style.color = 'var(--text-main)';
        if (icon) icon.style.opacity = '0.3';
        if (th.dataset.sort === sortState.key) {
          if (icon) {
            icon.className = sortState.direction === 'asc' ? 'bi bi-sort-up' : 'bi bi-sort-down';
            icon.style.opacity = '1';
          }
          th.style.color = 'var(--primary)';
        } else if (icon) {
          icon.className = 'bi bi-arrow-down-up';
        }
      });
    }

    if (!assignmentList) return;
    assignmentList.innerHTML = '';
    if (list.length === 0) {
      assignmentList.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:20px;">沒有符合條件的作業。</td></tr>';
      return;
    }

    list.forEach(a => {
      const doneCount = (a.statuses || []).filter(s => s === 3).length;
      const total = data.roster.length;
      const progress = total > 0 ? (doneCount / total) * 100 : 0;

      const tr = document.createElement('tr');
      tr.dataset.id = a.id;
      tr.innerHTML = `
        <td>${new Date(a.id).toLocaleDateString()}</td>
        <td>${a.title}</td>
        <td>${a.teacher}</td>
        <td>
          <div style="display:flex;align-items:center;gap:8px;">
            <progress value="${progress}" max="100"></progress>
            <span>${doneCount}/${total}</span>
          </div>
        </td>
        <td><button class="btn warn sm btn-delete" data-id="${a.id}"><i class="bi bi-trash3"></i></button></td>
      `;
      assignmentList.appendChild(tr);
    });
  }

  function renderDetail(assignmentId) {
    const a = data.assignments.find(x => x.id == assignmentId);
    if (!a) { switchView('view-dashboard'); return; }
    currentAssignmentId = assignmentId;
    if (detailTitle) detailTitle.innerHTML = `<i class="bi bi-journal-bookmark-fill"></i> ${a.title} <span class="chip">${a.date}</span> <span class="chip">${a.teacher}</span>`;

    if (!gridContainer) return;
    gridContainer.innerHTML = '';
    data.roster.forEach((name, idx) => {
      const status = (a.statuses || [])[idx] || 0;
      const seatItem = document.createElement('div');
      seatItem.className = 'seatItem';
      seatItem.innerHTML = `
        <div class="seat s${status}" data-index="${idx}">${idx + 1}</div>
        <div class="seatName"><span class="seatNo">${idx + 1}.</span> ${name}</div>
      `;
      gridContainer.appendChild(seatItem);
    });
  }

  function renderRosterEditor() {
    if (!rosterEditor) return;
    rosterEditor.innerHTML = '';
    data.roster.forEach((name, idx) => {
      const item = document.createElement('div');
      item.className = 'roster-item';
      item.innerHTML = `<div class="badge-no">${idx + 1}</div><input type="text" value="${name}" data-index="${idx}" class="roster-name-input">`;
      rosterEditor.appendChild(item);
    });
    if (taRosterPaste) taRosterPaste.value = '';
  }

  function renderStudentStatus() {
    if (!studentStatusContainer) return;
    studentStatusContainer.innerHTML = '';
    if (data.roster.length === 0) {
      studentStatusContainer.innerHTML = '<p>名單中沒有學生。</p>';
      return;
    }

    const pending = [];
    const allDoneNos = [];

    data.roster.forEach((studentName, studentIndex) => {
      const mine = [];
      let hasPending = false;
      data.assignments.forEach(assn => {
        const st = (assn.statuses || [])[studentIndex];
        if (st === 0 || st === 2) { hasPending = true; mine.push({ id: assn.id, title: assn.title, status: st }); }
      });
      if (hasPending) pending.push({ name: studentName, index: studentIndex, assignments: mine });
      else allDoneNos.push(studentIndex + 1);
    });

    const summaryCard = document.createElement('div');
    summaryCard.className = 'card';
    summaryCard.style.marginBottom = '20px';
    let summaryHTML = '<h2><i class="bi bi-check2-all"></i> 完成狀況</h2>';
    if (allDoneNos.length > 0) {
      summaryHTML += `<p style="color: var(--success); font-weight: bold; margin: 8px 0; font-size: 15px;">已完成所有作業的學生座號： ${allDoneNos.join('、')}</p>`;
    } else summaryHTML += '<p style="margin: 8px 0;">目前沒有學生完成所有作業。</p>';
    summaryCard.innerHTML = summaryHTML;
    studentStatusContainer.appendChild(summaryCard);

    if (pending.length > 0) {
      const title = document.createElement('h2');
      title.style.cssText = 'font-size: 16px; margin-bottom: 12px;';
      title.innerHTML = '<i class="bi bi-exclamation-triangle"></i> 尚有作業待完成';
      studentStatusContainer.appendChild(title);

      const gridWrapper = document.createElement('div');
      gridWrapper.className = 'student-status-grid';

      pending.forEach(s => {
        const card = document.createElement('div');
        card.className = 'card';
        card.style.marginBottom = '0';
        let lis = '<ul class="student-status-list">';
        s.assignments.forEach(pa => {
          const statusText = pa.status === 0 ? '未繳' : '需訂正';
          const pill = pa.status === 0 ? 'p-gray' : 'p-orange';
          lis += `<li data-assignment-id="${pa.id}" data-student-index="${s.index}">${pa.title} <span class="pill ${pill}">${statusText}</span></li>`;
        });
        lis += '</ul>';
        card.innerHTML = `<h2 style="font-size:18px;margin-bottom:4px;font-weight:bold;"><i class="bi bi-person"></i> <span style="color: var(--danger);">${s.index + 1}.</span> ${s.name}</h2>${lis}`;
        gridWrapper.appendChild(card);
      });

      studentStatusContainer.appendChild(gridWrapper);
    } else {
      const msg = document.createElement('div');
      msg.innerHTML = '<p style="text-align:center;font-size:18px;font-weight:bold;margin-top:20px;">🎉 太棒了！全班都完成了所有作業！ 🎉</p>';
      studentStatusContainer.appendChild(msg);
    }
  }

  function switchView(targetId) {
    if (!views) return;
    views.forEach(v => v.classList.toggle('show', v.id === targetId));
  }

  // 綁定事件（全部先做「存在才綁」）
  function addMainAppEventListeners() {
    if (btnLogout) btnLogout.addEventListener('click', () => window.__auth.signOut());

    if (navDashboardBtn) navDashboardBtn.addEventListener('click', () => switchView('view-dashboard'));
    if (navRosterBtn) navRosterBtn.addEventListener('click', () => { renderRosterEditor(); switchView('view-roster'); });
    if (navStudentStatusBtn) navStudentStatusBtn.addEventListener('click', () => { renderStudentStatus(); switchView('view-student-status'); });

    if (ipTeacherSelect) {
      ipTeacherSelect.addEventListener('change', () => {
        if (ipTeacherCustom) ipTeacherCustom.style.display = ipTeacherSelect.value === 'custom' ? 'block' : 'none';
      });
    }

    if (btnCreate) {
      btnCreate.addEventListener('click', () => {
        const teacher = (ipTeacherSelect && ipTeacherSelect.value === 'custom')
          ? (ipTeacherCustom?.value.trim() || '')
          : (ipTeacherSelect?.value || '');
        const title = (ipTitle?.value || '').trim();
        const date = ipDate?.value;
        if (!teacher || !title || !date) { alert('老師姓名、作業名稱和日期為必填項目！'); return; }
        const newA = { id: Date.now(), teacher, title, date, statuses: Array(data.roster.length).fill(0) };
        addAssignmentToFirebase(newA);
        if (ipTitle) ipTitle.value = '';
        if (ipTeacherSelect) ipTeacherSelect.selectedIndex = 0;
        if (ipTeacherCustom) { ipTeacherCustom.value = ''; ipTeacherCustom.style.display = 'none'; }
      });
    }

    if (assignmentList) {
      assignmentList.addEventListener('click', (e) => {
        const del = e.target.closest('.btn-delete');
        const tr = e.target.closest('tr');
        if (del) {
          if (confirm('確定要刪除這份作業嗎？')) deleteAssignmentFromFirebase(del.dataset.id);
        } else if (tr) {
          currentAssignmentId = tr.dataset.id;
          switchView('view-detail');
          renderDetail(currentAssignmentId);
        }
      });
    }

    if (gridContainer) {
      gridContainer.addEventListener('click', (e) => {
        const seat = e.target.closest('.seat'); if (!seat) return;
        const idx = parseInt(seat.dataset.index, 10);
        const a = data.assignments.find(x => x.id == currentAssignmentId); if (!a) return;
        const cur = (a.statuses || [])[idx] || 0;
        const next = (cur + 1) % 4;
        const newStatuses = [...(a.statuses || Array(data.roster.length).fill(0))];
        newStatuses[idx] = next;
        updateAssignmentFieldInFirebase(currentAssignmentId, 'statuses', newStatuses);
      });
    }

    if (studentStatusContainer) {
      studentStatusContainer.addEventListener('click', (e) => {
        const li = e.target.closest('.student-status-list li'); if (!li) return;
        const assignmentId = li.dataset.assignmentId;
        const sIdx = parseInt(li.dataset.studentIndex, 10);
        const a = data.assignments.find(x => x.id == assignmentId); if (!a) return;
        const cur = (a.statuses || [])[sIdx] || 0;
        const next = (cur + 1) % 4;
        const newStatuses = [...(a.statuses || [])];
        newStatuses[sIdx] = next;
        updateAssignmentFieldInFirebase(assignmentId, 'statuses', newStatuses);
      });
    }

    if (assignmentTableHead) {
      assignmentTableHead.addEventListener('click', (e) => {
        const th = e.target.closest('th'); if (!th || !th.dataset.sort) return;
        const key = th.dataset.sort;
        if (sortState.key === key) sortState.direction = sortState.direction === 'asc' ? 'desc' : 'asc';
        else { sortState.key = key; sortState.direction = 'asc'; }
        renderDashboard();
      });
    }

    if (teacherFilter) teacherFilter.addEventListener('change', (e) => { currentFilter = e.target.value; renderDashboard(); });

    if (themeToggle) {
      themeToggle.addEventListener('click', () => {
        const newTheme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem(THEME_KEY, newTheme);
        updateThemeIcon(newTheme);
      });
    }

    if (rangeSize) {
      rangeSize.addEventListener('input', (e) => {
        const v = e.target.value;
        document.documentElement.style.setProperty('--seat', `${v}px`);
        document.documentElement.style.setProperty('--seat-font', `${Math.floor(v * 0.3)}px`);
      });
    }

    if (btnLoadFromPaste) {
      btnLoadFromPaste.addEventListener('click', () => {
        const t = (taRosterPaste?.value || '').trim();
        if (!t) return;
        const newRoster = t.split('\n').map(x => x.trim()).filter(Boolean);
        if (!rosterEditor) return;
        rosterEditor.innerHTML = '';
        newRoster.forEach((name, idx) => {
          const item = document.createElement('div');
          item.className = 'roster-item';
          item.innerHTML = `<div class="badge-no">${idx + 1}</div><input type="text" value="${name}" data-index="${idx}" class="roster-name-input">`;
          rosterEditor.appendChild(item);
        });
        if (taRosterPaste) taRosterPaste.value = '';
        alert('列表已更新，請確認後儲存。');
      });
    }

    if (btnApplyRoster) {
      btnApplyRoster.addEventListener('click', async () => {
        const inputs = document.querySelectorAll('.roster-name-input');
        const newRoster = Array.from(inputs).map(ip => ip.value.trim()).filter(Boolean);
        if (!confirm('更新名單會影響所有作業，是否繼續？')) return;
        const uid = getUid(); if (!uid) { alert('請先連接 Firebase'); return; }

        const batch = db().batch();
        data.assignments.forEach(a => {
          const old = [...(a.statuses || [])];
          const next = Array(newRoster.length).fill(0);
          for (let i = 0; i < newRoster.length; i++) if (old[i] !== undefined) next[i] = old[i];
          const ref = db().collection('users').doc(uid).collection('assignments').doc(String(a.id));
          batch.update(ref, { statuses: next });
        });
        await saveRosterToFirebase(newRoster);
        await batch.commit();
        alert('名單已更新並同步！');
      });
    }

    if (btnExport) {
      btnExport.addEventListener('click', () => {
        const json = JSON.stringify({ roster: data.roster, assignments: data.assignments }, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = 'homework-data.json'; a.click();
        URL.revokeObjectURL(url);
      });
    }

    if (fileImport) {
      fileImport.addEventListener('change', (e) => {
        const file = e.target.files[0]; if (!file) return;
        const reader = new FileReader();
        reader.onload = async (ev) => {
          try {
            const imported = JSON.parse(ev.target.result);
            if (!(imported.roster && imported.assignments)) { alert('檔案格式不符。'); return; }
            if (!confirm('匯入資料將覆蓋雲端備份，確定嗎？')) return;
            const uid = getUid(); if (!uid) { alert('請先連接 Firebase'); return; }
            const assignmentsRef = db().collection('users').doc(uid).collection('assignments');
            const snap = await assignmentsRef.get();
            const batch = db().batch();
            snap.docs.forEach(doc => batch.delete(doc.ref));
            imported.assignments.forEach(a => batch.set(assignmentsRef.doc(String(a.id)), a));
            await saveRosterToFirebase(imported.roster);
            await batch.commit();
            alert('資料匯入並同步成功！');
          } catch (err) {
            console.error(err);
            alert('讀取檔案錯誤。');
          }
        };
        reader.readAsText(file);
        e.target.value = '';
      });
    }
  }

  function updateThemeIcon(theme) {
    if (themeToggle) {
      themeToggle.innerHTML = theme === 'dark'
        ? '<i class="bi bi-sun-fill"></i>'
        : '<i class="bi bi-moon-stars-fill"></i>';
    }
  }

  function reselectElements() {
    userInfo = document.querySelector('.user-info');
    userName = document.getElementById('user-name');
    btnLogout = document.getElementById('btn-logout');
    themeToggle = document.getElementById('theme-toggle');
    teacherFilter = document.getElementById('teacherFilter');
    views = document.querySelectorAll('.main-app .view');
    navDashboardBtn = document.getElementById('btnNavDashboard');
    navRosterBtn = document.getElementById('btnNavRoster');
    navStudentStatusBtn = document.getElementById('btnNavStudentStatus');
    ipTeacherSelect = document.getElementById('ipTeacherSelect');
    ipTeacherCustom = document.getElementById('ipTeacherCustom');
    ipTitle = document.getElementById('ipTitle');
    ipDate = document.getElementById('ipDate');
    btnCreate = document.getElementById('btnCreate');
    assignmentList = document.getElementById('assignmentList');
    assignmentTableHead = document.querySelector('#assignmentTable thead');
    btnExport = document.getElementById('btnExport');
    fileImport = document.getElementById('fileImport');
    detailTitle = document.getElementById('detailTitle');
    gridContainer = document.getElementById('gridContainer');
    rangeSize = document.getElementById('rangeSize');
    rosterEditor = document.getElementById('rosterEditor');
    taRosterPaste = document.getElementById('taRosterPaste');
    btnLoadFromPaste = document.getElementById('btnLoadFromPaste');
    btnApplyRoster = document.getElementById('btnApplyRoster');
    studentStatusContainer = document.getElementById('studentStatusContainer');
  }

  // 讓 firebase-init 在登入後呼叫
  window.__appState.onSignedInReady = async (user) => {
    // 寫入主畫面骨架
    mainApp.innerHTML = mainAppHTML;

    // 主題初始化
    const savedTheme = localStorage.getItem(THEME_KEY) || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);

    // 取代後選取元素並綁定事件
    reselectElements();
    addMainAppEventListeners();

    // 顯示使用者名稱
    if (userName) userName.textContent = user.displayName || user.email;
    if (userInfo) userInfo.style.display = 'flex';

    // 日期預設今天
    if (ipDate) ipDate.value = new Date().toISOString().slice(0, 10);

    // 載入本地資料 + 接上雲端監聽
    loadData(user.uid);
    attachFirebaseListeners(user.uid);
  };
})();
