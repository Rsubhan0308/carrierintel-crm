// Global State Management
const state = {
  activeTab: 'directory',
  sessionToken: localStorage.getItem('session_token') || null,
  sessionUser: null,
  carriers: [],
  freshCarriers: [],
  selectedCarrierIds: new Set(),
  currentPage: 1,
  totalPages: 1,
  limit: 25,
  activeCarrier: null,
  activeScrapeJobId: null,
  scrapeInterval: null,
  // Call Audio Recorder State
  mediaRecorder: null,
  audioChunks: [],
  recordingTimer: null,
  recordingSeconds: 0,
  activeRecordingCarrier: null,
  filters: {
    q: '',
    state: 'ALL',
    equipment: 'ALL',
    minPowerUnits: '',
    maxPowerUnits: '',
    freshMcDays: 'ALL',
    hasEmail: true,
    hasPhone: true,
    crmStatus: 'ALL',
    assignedRep: 'ALL'
  }
};

// DOM Elements Initialization
document.addEventListener('DOMContentLoaded', () => {
  initAuth();
  initSidebarToggle();
  initNavigation();
  initFilterControls();
  initSearch();
  initModal();
  initScraperForm();
  initCRMFilter();
  initClearDatabaseButton();
  initQuickScrapeButton();
  initBulkAssignRep();
  initCreateUserForm();
  initCallRecorderControls();

  // Initial Hash check
  handleHashChange();
});

// --- AUTHENTICATION & SESSION SYSTEM ---
function initAuth() {
  const loginForm = document.getElementById('login-form');
  const logoutBtn = document.getElementById('logout-btn');

  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('login-email').value;
      const password = document.getElementById('login-password').value;

      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });

        const data = await res.json();
        if (res.ok) {
          state.sessionToken = data.token;
          state.sessionUser = data.user;
          localStorage.setItem('session_token', data.token);

          showToast(`Welcome back, ${data.user.name}!`, 'success');
          document.getElementById('login-screen').style.display = 'none';
          document.getElementById('app-container').style.display = 'flex';

          applyRolePermissions();
          fetchStats();
          fetchCarriers(1);
        } else {
          showToast(data.error || 'Login failed', 'error');
        }
      } catch (err) {
        showToast('Error connecting to authentication server', 'error');
      }
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      if (state.sessionToken) {
        try {
          await fetch('/api/auth/logout', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${state.sessionToken}` }
          });
        } catch (e) {}
      }
      state.sessionToken = null;
      state.sessionUser = null;
      localStorage.removeItem('session_token');

      document.getElementById('app-container').style.display = 'none';
      document.getElementById('login-screen').style.display = 'flex';
      showToast('Logged out successfully', 'info');
    });
  }

  // Verify Session Token on page load
  checkAuthSession();
}

async function checkAuthSession() {
  if (!state.sessionToken) {
    document.getElementById('login-screen').style.display = 'flex';
    document.getElementById('app-container').style.display = 'none';
    return;
  }

  try {
    const res = await fetch('/api/auth/me', {
      headers: { 'Authorization': `Bearer ${state.sessionToken}` }
    });

    if (res.ok) {
      const user = await res.json();
      state.sessionUser = user;
      document.getElementById('login-screen').style.display = 'none';
      document.getElementById('app-container').style.display = 'flex';

      applyRolePermissions();
      fetchStats();
      fetchCarriers(1);
    } else {
      state.sessionToken = null;
      localStorage.removeItem('session_token');
      document.getElementById('login-screen').style.display = 'flex';
      document.getElementById('app-container').style.display = 'none';
    }
  } catch (err) {
    document.getElementById('login-screen').style.display = 'flex';
    document.getElementById('app-container').style.display = 'none';
  }
}

function quickFillLogin(email, password) {
  const emailInput = document.getElementById('login-email');
  const passwordInput = document.getElementById('login-password');
  if (emailInput) emailInput.value = email;
  if (passwordInput) passwordInput.value = password;
  const form = document.getElementById('login-form');
  if (form) {
    if (typeof form.requestSubmit === 'function') {
      form.requestSubmit();
    } else {
      const submitBtn = form.querySelector('button[type="submit"]');
      if (submitBtn) submitBtn.click();
      else form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    }
  }
}
window.quickFillLogin = quickFillLogin;

function applyRolePermissions() {
  if (!state.sessionUser) return;

  const isRoleAdmin = state.sessionUser.role === 'ADMIN';

  document.getElementById('user-display-name').innerText = state.sessionUser.name;
  document.getElementById('user-display-role').innerText = isRoleAdmin ? '👑 ADMIN' : `👤 SALES REP`;

  // Hide/Show Admin-only UI elements
  document.querySelectorAll('.admin-only-element').forEach(el => {
    el.style.display = isRoleAdmin ? '' : 'none';
  });

  if (!isRoleAdmin) {
    state.filters.assignedRep = state.sessionUser.name;
  } else {
    state.filters.assignedRep = 'ALL';
  }
}

// --- MANDATORY CALL AUDIO RECORDER SYSTEM ---
function initCallRecorderControls() {
  const stopSaveBtn = document.getElementById('stop-save-recording-btn');
  const floatingEndCallBtn = document.getElementById('floating-end-call-btn');
  const minimizeBtn = document.getElementById('minimize-recorder-btn');
  const minimizeFooterBtn = document.getElementById('minimize-recorder-footer-btn');
  const expandBtn = document.getElementById('expand-recorder-btn');
  const pitchBtn = document.getElementById('quick-pitch-from-call-btn');

  if (stopSaveBtn) stopSaveBtn.addEventListener('click', stopAndSaveCallRecording);
  if (floatingEndCallBtn) floatingEndCallBtn.addEventListener('click', stopAndSaveCallRecording);
  
  if (minimizeBtn) minimizeBtn.addEventListener('click', minimizeCallRecorderModal);
  if (minimizeFooterBtn) minimizeFooterBtn.addEventListener('click', minimizeCallRecorderModal);
  if (expandBtn) expandBtn.addEventListener('click', expandCallRecorderModal);
  if (pitchBtn) pitchBtn.addEventListener('click', openPitchScriptFromCall);
}

function minimizeCallRecorderModal() {
  document.getElementById('call-recorder-modal').classList.remove('active');
  document.getElementById('floating-call-bar').style.display = 'flex';
  showToast('🗕 Call recording minimized to floating widget. Browse carrier leads & details freely!', 'info');
}

function expandCallRecorderModal() {
  document.getElementById('floating-call-bar').style.display = 'none';
  document.getElementById('call-recorder-modal').classList.add('active');
}

function openPitchScriptFromCall() {
  if (state.activeRecordingCarrier) {
    minimizeCallRecorderModal();
    openScriptModal(state.activeRecordingCarrier.id);
  }
}

async function startMandatoryCallRecorder(carrierId, phoneNum) {
  let carrier = state.carriers.find(c => c.id === carrierId) || state.freshCarriers.find(c => c.id === carrierId);
  if (!carrier && state.activeCarrier && state.activeCarrier.id === carrierId) {
    carrier = state.activeCarrier;
  }
  if (!carrier) return;

  state.activeRecordingCarrier = carrier;
  state.audioChunks = [];
  state.recordingSeconds = 0;

  document.getElementById('recorder-carrier-name').innerText = carrier.companyName;
  document.getElementById('recorder-phone-num').innerText = phoneNum || carrier.phone || 'N/A';
  document.getElementById('rec-timer-display').innerText = '00:00';
  document.getElementById('floating-carrier-name').innerText = carrier.companyName;
  document.getElementById('floating-timer-display').innerText = '00:00';
  document.getElementById('recorder-note-input').value = '';

  // Trigger Google Voice / Phone Call Launch
  const cleanPhone = (phoneNum || carrier.phone || '').replace(/\D/g, '');
  if (cleanPhone) {
    window.open(`tel:${cleanPhone}`, '_self');
  }

  // Request Browser Microphone Stream
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    state.mediaRecorder = new MediaRecorder(stream);

    state.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) state.audioChunks.push(event.data);
    };

    state.mediaRecorder.start();

    // Start Timer Display (Syncs Both Main Modal and Floating Bar)
    if (state.recordingTimer) clearInterval(state.recordingTimer);
    state.recordingTimer = setInterval(() => {
      state.recordingSeconds++;
      const mins = String(Math.floor(state.recordingSeconds / 60)).padStart(2, '0');
      const secs = String(state.recordingSeconds % 60).padStart(2, '0');
      const formattedTime = `${mins}:${secs}`;
      document.getElementById('rec-timer-display').innerText = formattedTime;
      document.getElementById('floating-timer-display').innerText = formattedTime;
    }, 1000);

    document.getElementById('call-recorder-modal').classList.add('active');
    document.getElementById('floating-call-bar').style.display = 'none';
    showToast('🔴 Mandatory Call Audio Recording Active...', 'info');

  } catch (err) {
    console.error('Microphone access error:', err);
    showToast('Please allow microphone permissions to place calls & record audio.', 'error');
  }
}
window.startMandatoryCallRecorder = startMandatoryCallRecorder;

async function stopAndSaveCallRecording() {
  if (!state.mediaRecorder || !state.activeRecordingCarrier) return;

  clearInterval(state.recordingTimer);
  document.getElementById('floating-call-bar').style.display = 'none';
  const status = document.getElementById('recorder-status-select').value;
  const noteText = document.getElementById('recorder-note-input').value.trim();

  state.mediaRecorder.onstop = async () => {
    const audioBlob = new Blob(state.audioChunks, { type: 'audio/webm' });

    // Convert Audio Blob to Base64 string
    const reader = new FileReader();
    reader.readAsDataURL(audioBlob);
    reader.onloadend = async () => {
      const base64Audio = reader.result;

      try {
        const res = await fetch('/api/recordings/upload', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${state.sessionToken}`
          },
          body: JSON.stringify({
            carrierId: state.activeRecordingCarrier.id,
            audioBase64: base64Audio,
            duration: state.recordingSeconds,
            status: status,
            noteText: noteText || `Recorded Call Outcome: "${status}" (${state.recordingSeconds}s)`
          })
        });

        const data = await res.json();
        if (res.ok) {
          showToast('Call audio recording saved and attached to lead!', 'success');
          document.getElementById('call-recorder-modal').classList.remove('active');
          document.getElementById('floating-call-bar').style.display = 'none';

          fetchCarriers(state.currentPage);
          fetchStats();
          if (state.activeCarrier) openCarrierModal(state.activeCarrier.id);
        } else {
          showToast(data.error || 'Failed to save call recording', 'error');
        }
      } catch (e) {
        showToast('Error uploading audio file', 'error');
      }
    };

    // Stop all audio tracks
    state.mediaRecorder.stream.getTracks().forEach(track => track.stop());
  };

  state.mediaRecorder.stop();
}

// --- ADMIN USER MANAGEMENT TAB ---
function initCreateUserForm() {
  const form = document.getElementById('create-user-form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('new-user-name').value;
    const email = document.getElementById('new-user-email').value;
    const password = document.getElementById('new-user-password').value;
    const role = document.getElementById('new-user-role').value;

    try {
      const res = await fetch('/api/users/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${state.sessionToken}`
        },
        body: JSON.stringify({ name, email, password, role })
      });

      const data = await res.json();
      if (res.ok) {
        showToast(data.message, 'success');
        form.reset();
        fetchUsers();
      } else {
        showToast(data.error || 'Failed to create user', 'error');
      }
    } catch (err) {
      showToast('Error creating user account', 'error');
    }
  });
}

async function fetchUsers() {
  if (!state.sessionUser || state.sessionUser.role !== 'ADMIN') return;

  try {
    const res = await fetch('/api/users', {
      headers: { 'Authorization': `Bearer ${state.sessionToken}` }
    });
    if (!res.ok) return;

    const users = await res.json();
    renderUserTable(users);
  } catch (err) {
    console.error('Failed to fetch users:', err);
  }
}

function renderUserTable(users) {
  const tbody = document.getElementById('user-table-body');
  if (!tbody) return;
  tbody.innerHTML = '';

  users.forEach(u => {
    const tr = document.createElement('tr');
    const roleBadge = u.role === 'ADMIN' ? '<span class="badge badge-blue">👑 Admin</span>' : '<span class="badge badge-green">👤 Sales Rep</span>';
    
    tr.innerHTML = `
      <td><strong>${u.name}</strong></td>
      <td>${u.email}</td>
      <td>${roleBadge}</td>
      <td><strong>${u.assignedLeadsCount}</strong> Leads</td>
      <td><strong>${u.callsMade}</strong> Calls</td>
      <td><span class="badge badge-hot">${u.onboardedCount} Onboarded</span></td>
      <td>
        ${u.role !== 'ADMIN' ? `<button class="btn btn-sm btn-outline-danger" onclick="deleteUserAccount('${u.id}')"><i class="fa-solid fa-trash-can"></i> Delete</button>` : '<span style="font-size:0.75rem; color:var(--text-muted);">Main Admin</span>'}
      </td>
    `;
    tbody.appendChild(tr);
  });
}

async function deleteUserAccount(userId) {
  if (!confirm('Are you sure you want to delete this Sales Rep account? Their leads will be unassigned.')) return;

  try {
    const res = await fetch(`/api/users/${userId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${state.sessionToken}` }
    });
    const data = await res.json();
    if (res.ok) {
      showToast(data.message, 'success');
      fetchUsers();
      fetchCarriers(state.currentPage);
    } else {
      showToast(data.error || 'Failed to delete user', 'error');
    }
  } catch (e) {
    showToast('Error deleting user', 'error');
  }
}
window.deleteUserAccount = deleteUserAccount;

// --- ADMIN CALL & ACTIVITY TRACKER STREAM ---
async function fetchAdminActivityLogs() {
  if (!state.sessionUser || state.sessionUser.role !== 'ADMIN') return;

  const repFilter = document.getElementById('tracker-rep-filter') ? document.getElementById('tracker-rep-filter').value : 'ALL';
  try {
    const res = await fetch(`/api/admin/activity-logs?repName=${repFilter}`, {
      headers: { 'Authorization': `Bearer ${state.sessionToken}` }
    });
    if (!res.ok) return;

    const data = await res.json();
    renderActivityLogs(data.logs);
  } catch (err) {
    console.error('Failed to fetch activity logs:', err);
  }
}
window.fetchAdminActivityLogs = fetchAdminActivityLogs;

function renderActivityLogs(logs) {
  const container = document.getElementById('activity-log-stream-container');
  if (!container) return;
  container.innerHTML = '';

  if (!logs || logs.length === 0) {
    container.innerHTML = `<p style="color: var(--text-muted); text-align: center; padding: 20px;">No call recordings or activity logged yet.</p>`;
    return;
  }

  logs.forEach(log => {
    const item = document.createElement('div');
    item.className = 'activity-log-item';
    
    let audioHtml = '';
    if (log.recordingUrl) {
      audioHtml = `
        <div style="margin-top: 10px; padding: 8px; background: rgba(0,0,0,0.3); border-radius: 8px; display: flex; align-items: center; justify-content: space-between; gap: 10px;">
          <audio controls src="${log.recordingUrl}" style="height: 32px; flex: 1;"></audio>
          <button class="btn btn-sm btn-outline-danger admin-only-element" onclick="deleteCallRecording('${log.recordingUrl}')" title="Delete Audio Recording (Admin Only)"><i class="fa-solid fa-trash"></i></button>
        </div>
      `;
    }

    item.innerHTML = `
      <div class="log-item-header">
        <span><strong style="color: var(--accent-cyan);">${log.userName}</strong> (${log.userRole}) • <strong style="color: #fff;">${log.companyName || 'Carrier'}</strong></span>
        <span>${log.displayTime}</span>
      </div>
      <div style="font-size: 0.88rem;">${log.noteText || log.actionType}</div>
      ${audioHtml}
    `;
    container.appendChild(item);
  });
}

async function deleteCallRecording(recUrl) {
  if (!confirm('Admin Confirmation: Are you sure you want to delete this call audio recording?')) return;
  const filename = recUrl.split('/').pop();

  try {
    const res = await fetch(`/api/recordings/${filename}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${state.sessionToken}` }
    });
    if (res.ok) {
      showToast('Recording deleted by Admin', 'success');
      fetchAdminActivityLogs();
      if (state.activeCarrier) openCarrierModal(state.activeCarrier.id);
    }
  } catch (e) {
    showToast('Failed to delete recording', 'error');
  }
}
window.deleteCallRecording = deleteCallRecording;

// --- NAVIGATION & TABS ---
function initSidebarToggle() {
  const toggleBtn = document.getElementById('sidebar-toggle-btn');
  const sidebar = document.querySelector('.sidebar');
  if (!toggleBtn || !sidebar) return;

  const isCollapsed = localStorage.getItem('sidebar_collapsed') === 'true';
  if (isCollapsed) sidebar.classList.add('collapsed');

  toggleBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    sidebar.classList.toggle('collapsed');
    localStorage.setItem('sidebar_collapsed', sidebar.classList.contains('collapsed') ? 'true' : 'false');
  });
}

function handleHashChange() {
  const hash = window.location.hash.replace('#', '');
  const validTabs = ['directory', 'fresh-mc', 'bulk-scraper', 'sales-crm', 'users-management', 'activity-tracker', 'export'];
  if (validTabs.includes(hash)) {
    switchTab(hash);
  }
}
window.addEventListener('hashchange', handleHashChange);

function initNavigation() {
  const navItems = document.querySelectorAll('.nav-item');
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const targetTab = item.getAttribute('data-tab');
      if (targetTab) {
        window.location.hash = `#${targetTab}`;
        switchTab(targetTab);
      }
    });
  });
}

function switchTab(tabId) {
  state.activeTab = tabId;

  document.querySelectorAll('.nav-item').forEach(el => {
    if (el.getAttribute('data-tab') === tabId) el.classList.add('active');
    else el.classList.remove('active');
  });

  document.querySelectorAll('.tab-content').forEach(content => {
    if (content.id === `tab-${tabId}`) {
      content.classList.add('active');
      content.style.display = 'block';
    } else {
      content.classList.remove('active');
      content.style.display = 'none';
    }
  });

  if (tabId === 'fresh-mc') fetchFreshMcs();
  else if (tabId === 'sales-crm') renderKanbanBoard();
  else if (tabId === 'directory') fetchCarriers(state.currentPage);
  else if (tabId === 'users-management') fetchUsers();
  else if (tabId === 'activity-tracker') fetchAdminActivityLogs();
}
window.switchTab = switchTab;

// --- FETCH STATS & CARRIERS ---
async function fetchStats() {
  try {
    const res = await fetch('/api/stats', {
      headers: { 'Authorization': `Bearer ${state.sessionToken}` }
    });
    const data = await res.json();

    document.getElementById('stat-total').innerText = data.totalCarriers.toLocaleString();
    document.getElementById('stat-fresh').innerText = data.freshMCs.toLocaleString();
    document.getElementById('stat-emails').innerText = data.verifiedEmails.toLocaleString();
    document.getElementById('stat-phones').innerText = data.phoneNumbers.toLocaleString();
    document.getElementById('stat-active').innerText = data.activePipelineLeads.toLocaleString();

    document.getElementById('nav-total-count').innerText = data.totalCarriers;
    document.getElementById('nav-fresh-count').innerText = data.freshMCs;
  } catch (err) {
    console.error('Failed to fetch stats:', err);
  }
}

async function fetchCarriers(page = 1) {
  try {
    state.currentPage = page;
    const params = new URLSearchParams();
    params.append('page', page);
    params.append('limit', state.limit);

    if (state.filters.q) params.append('q', state.filters.q);
    if (state.filters.state !== 'ALL') params.append('state', state.filters.state);
    if (state.filters.equipment !== 'ALL') params.append('equipment', state.filters.equipment);
    if (state.filters.minPowerUnits) params.append('minPowerUnits', state.filters.minPowerUnits);
    if (state.filters.maxPowerUnits) params.append('maxPowerUnits', state.filters.maxPowerUnits);
    if (state.filters.freshMcDays !== 'ALL') params.append('freshMcDays', state.filters.freshMcDays);
    if (state.filters.hasEmail) params.append('hasEmail', 'true');
    if (state.filters.hasPhone) params.append('hasPhone', 'true');
    if (state.filters.crmStatus !== 'ALL') params.append('crmStatus', state.filters.crmStatus);
    if (state.filters.assignedRep !== 'ALL') params.append('assignedRep', state.filters.assignedRep);

    const res = await fetch(`/api/carriers?${params.toString()}`, {
      headers: { 'Authorization': `Bearer ${state.sessionToken}` }
    });
    const data = await res.json();

    state.carriers = data.carriers;
    state.totalPages = data.totalPages;

    renderCarrierTable();
    renderPagination(data.page, data.totalPages);
    document.getElementById('results-count-text').innerText = data.total.toLocaleString();
  } catch (err) {
    console.error('Failed to fetch carriers:', err);
  }
}

function renderCarrierTable() {
  const tbody = document.getElementById('carrier-table-body');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (state.carriers.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" style="text-align: center; padding: 40px; color: var(--text-muted);">
          <i class="fa-solid fa-folder-open" style="font-size: 2rem; margin-bottom: 8px;"></i><br>
          No assigned motor carriers found. Try resetting filters.
        </td>
      </tr>
    `;
    return;
  }

  state.carriers.forEach(carrier => {
    const tr = document.createElement('tr');
    const isChecked = state.selectedCarrierIds.has(carrier.id);

    const equipList = Array.isArray(carrier.equipment) ? carrier.equipment : ['Dry Van'];
    const equipBadges = equipList.map(eq => `<span class="equipment-badge equip-dryvan">${eq}</span>`).join(' ');

    let statusClass = 'badge-blue';
    if (carrier.crmStatus === 'New Lead') statusClass = 'badge-hot';
    if (carrier.crmStatus === 'Onboarded') statusClass = 'badge-green';

    const rawPhone = carrier.phone || '';
    const cleanPhone = rawPhone.replace(/\D/g, '');
    const phoneHtml = cleanPhone ? `<button class="btn btn-sm btn-outline" onclick="startMandatoryCallRecorder('${carrier.id}', '${cleanPhone}')" style="color: var(--accent-green); font-weight:600;"><i class="fa-solid fa-phone-volume"></i> ${rawPhone}</button>` : 'N/A';

    tr.innerHTML = `
      <td><input type="checkbox" class="carrier-checkbox" data-id="${carrier.id}" ${isChecked ? 'checked' : ''}></td>
      <td>
        <div class="company-cell">
          <span class="comp-name">${carrier.companyName}</span>
          <div class="comp-ids"><span>DOT: ${carrier.usdot}</span> • <span>${carrier.mcNumber}</span></div>
        </div>
      </td>
      <td>
        <div class="contact-cell">
          <span class="contact-owner">${carrier.ownerName}</span>
          <span class="contact-phone">${phoneHtml}</span>
          <span class="contact-email"><i class="fa-solid fa-envelope"></i> ${carrier.email || 'No email'}</span>
        </div>
      </td>
      <td><strong>${carrier.city}, ${carrier.state}</strong><br><span style="font-size:0.75rem; color:var(--text-muted);">${carrier.zip}</span></td>
      <td><div><strong>${carrier.powerUnits}</strong> Power Units</div><div style="margin-top:4px;">${equipBadges}</div></td>
      <td><span>${carrier.authorityDate}</span><br><span class="${carrier.isFreshMC ? 'badge badge-hot' : ''}" style="font-size:0.72rem;">${carrier.authorityDaysOld} days old</span></td>
      <td><div class="accuracy-badge"><i class="fa-solid fa-circle-check"></i> ${carrier.accuracyScore}%</div></td>
      <td>
        <span class="badge ${statusClass}">${carrier.crmStatus}</span>
        <div style="font-size:0.72rem; color:var(--accent-cyan); margin-top:2px;">Rep: ${carrier.assignedRep}</div>
      </td>
      <td>
        <div style="display: flex; flex-direction: column; gap: 4px;">
          <button class="btn btn-sm btn-outline view-details-btn" data-id="${carrier.id}"><i class="fa-solid fa-eye"></i> Details</button>
          <button class="btn btn-sm btn-accent open-script-btn" data-id="${carrier.id}"><i class="fa-solid fa-scroll"></i> Pitch Script</button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });

  // Attach Table Listeners
  document.querySelectorAll('.carrier-checkbox').forEach(cb => {
    cb.addEventListener('change', (e) => {
      const id = e.target.getAttribute('data-id');
      if (e.target.checked) state.selectedCarrierIds.add(id);
      else state.selectedCarrierIds.delete(id);
      document.getElementById('selected-count').innerText = state.selectedCarrierIds.size;
    });
  });

  document.querySelectorAll('.view-details-btn').forEach(btn => {
    btn.addEventListener('click', () => openCarrierModal(btn.getAttribute('data-id')));
  });

  document.querySelectorAll('.open-script-btn').forEach(btn => {
    btn.addEventListener('click', () => openScriptModal(btn.getAttribute('data-id')));
  });
}

function renderPagination(current, total) {
  document.getElementById('current-page-num').innerText = current;
  document.getElementById('total-pages-num').innerText = total;

  const prevBtn = document.getElementById('prev-page-btn');
  const nextBtn = document.getElementById('next-page-btn');

  prevBtn.disabled = current <= 1;
  nextBtn.disabled = current >= total;

  prevBtn.onclick = () => { if (current > 1) fetchCarriers(current - 1); };
  nextBtn.onclick = () => { if (current < total) fetchCarriers(current + 1); };
}

// --- SEARCH & FILTER CONTROLS ---
function initSearch() {
  const input = document.getElementById('global-search');
  const clearBtn = document.getElementById('clear-search-btn');

  let debounceTimer;
  input.addEventListener('input', (e) => {
    const val = e.target.value;
    clearBtn.style.display = val ? 'inline-block' : 'none';
    state.filters.q = val;
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => fetchCarriers(1), 300);
  });

  clearBtn.addEventListener('click', () => {
    input.value = '';
    clearBtn.style.display = 'none';
    state.filters.q = '';
    fetchCarriers(1);
  });
}

function initFilterControls() {
  const stateSel = document.getElementById('filter-state');
  const equipSel = document.getElementById('filter-equipment');
  const fleetSel = document.getElementById('filter-fleet-size');
  const ageSel = document.getElementById('filter-mc-age');
  const crmSel = document.getElementById('filter-crm-status');
  const resetBtn = document.getElementById('reset-filters-btn');

  stateSel.addEventListener('change', (e) => { state.filters.state = e.target.value; fetchCarriers(1); });
  equipSel.addEventListener('change', (e) => { state.filters.equipment = e.target.value; fetchCarriers(1); });
  ageSel.addEventListener('change', (e) => { state.filters.freshMcDays = e.target.value; fetchCarriers(1); });
  crmSel.addEventListener('change', (e) => { state.filters.crmStatus = e.target.value; fetchCarriers(1); });

  fleetSel.addEventListener('change', (e) => {
    const val = e.target.value;
    if (val === '1-3') { state.filters.minPowerUnits = 1; state.filters.maxPowerUnits = 3; }
    else if (val === '4-10') { state.filters.minPowerUnits = 4; state.filters.maxPowerUnits = 10; }
    else if (val === '50+') { state.filters.minPowerUnits = 50; state.filters.maxPowerUnits = ''; }
    else { state.filters.minPowerUnits = ''; state.filters.maxPowerUnits = ''; }
    fetchCarriers(1);
  });

  resetBtn.addEventListener('click', () => {
    stateSel.value = 'ALL';
    equipSel.value = 'ALL';
    fleetSel.value = 'ALL';
    ageSel.value = 'ALL';
    crmSel.value = 'ALL';
    state.filters = { q: '', state: 'ALL', equipment: 'ALL', minPowerUnits: '', maxPowerUnits: '', freshMcDays: 'ALL', hasEmail: true, hasPhone: true, crmStatus: 'ALL', assignedRep: state.sessionUser && state.sessionUser.role === 'SALES_REP' ? state.sessionUser.name : 'ALL' };
    fetchCarriers(1);
  });

  document.getElementById('select-all-checkbox').addEventListener('change', (e) => {
    const checked = e.target.checked;
    document.querySelectorAll('.carrier-checkbox').forEach(cb => {
      cb.checked = checked;
      const id = cb.getAttribute('data-id');
      if (checked) state.selectedCarrierIds.add(id);
      else state.selectedCarrierIds.delete(id);
    });
    document.getElementById('selected-count').innerText = state.selectedCarrierIds.size;
  });
}

// --- FRESH MC RADAR ---
async function fetchFreshMcs() {
  try {
    const res = await fetch('/api/carriers?freshMcDays=14&limit=30', {
      headers: { 'Authorization': `Bearer ${state.sessionToken}` }
    });
    const data = await res.json();
    state.freshCarriers = data.carriers;

    const container = document.getElementById('fresh-mc-cards-container');
    container.innerHTML = '';

    if (state.freshCarriers.length === 0) {
      container.innerHTML = `<p style="grid-column: 1/-1; text-align: center;">No assigned fresh MCs registered in the last 14 days.</p>`;
      return;
    }

    state.freshCarriers.forEach(c => {
      const card = document.createElement('div');
      card.className = 'fresh-mc-card';
      card.innerHTML = `
        <span class="badge badge-hot fresh-mc-badge">⚡ ${c.authorityDaysOld}d Old</span>
        <h3 style="font-size: 1rem; margin-bottom: 4px;">${c.companyName}</h3>
        <p style="font-family: var(--font-mono); font-size: 0.8rem; color: var(--text-muted); margin-bottom: 12px;">${c.mcNumber} • DOT: ${c.usdot}</p>
        <div style="font-size: 0.85rem; margin-bottom: 12px; display: flex; flex-direction: column; gap: 4px;">
          <div><i class="fa-solid fa-location-dot" style="color: var(--accent-orange);"></i> ${c.city || 'N/A'}, ${c.state || ''}</div>
          <div><i class="fa-solid fa-truck" style="color: var(--accent-blue);"></i> ${c.powerUnits} Power Units</div>
          <div><i class="fa-solid fa-phone" style="color: var(--accent-green);"></i> <strong>${c.phone || 'No Phone'}</strong></div>
        </div>
        <div style="display: flex; gap: 8px; margin-top: 8px;">
          <button class="btn btn-sm btn-primary half" onclick="startMandatoryCallRecorder('${c.id}', '${c.phone.replace(/\D/g, '')}')"><i class="fa-solid fa-phone-volume"></i> Call & Record</button>
          <button class="btn btn-sm btn-accent half" onclick="openScriptModal('${c.id}')"><i class="fa-solid fa-scroll"></i> Cold Script</button>
        </div>
      `;
      container.appendChild(card);
    });
  } catch (err) {
    console.error('Failed to load fresh MCs:', err);
  }
}

// --- BULK SCRAPER & BUTTONS ---
function initScraperForm() {
  const form = document.getElementById('bulk-scraper-form');
  if (!form) return;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const dotsRaw = document.getElementById('scraper-dots-input').value;
    const dotList = dotsRaw.split('\n').map(d => d.trim()).filter(d => d.length > 0);

    try {
      const res = await fetch('/api/scraper/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${state.sessionToken}` },
        body: JSON.stringify({ dotList })
      });
      const data = await res.json();
      showToast(`Scraper job ${data.jobId} started!`, 'success');
      startPollingScrapeStatus(data.jobId);
    } catch (err) {
      showToast('Error launching scraper job', 'error');
    }
  });
}

function startPollingScrapeStatus(jobId) {
  if (state.scrapeInterval) clearInterval(state.scrapeInterval);
  const consoleBox = document.getElementById('terminal-console-output');
  const progressBar = document.getElementById('crawler-progress-fill');

  state.scrapeInterval = setInterval(async () => {
    try {
      const res = await fetch(`/api/scraper/status/${jobId}`);
      if (!res.ok) return;
      const job = await res.json();
      progressBar.style.width = `${job.progress}%`;
      if (job.status === 'COMPLETED') {
        clearInterval(state.scrapeInterval);
        fetchStats();
        fetchCarriers(1);
      }
    } catch (err) {}
  }, 1000);
}

function initCRMFilter() {}

async function renderKanbanBoard() {
  try {
    const res = await fetch('/api/carriers?limit=200', {
      headers: { 'Authorization': `Bearer ${state.sessionToken}` }
    });
    const data = await res.json();
    let carriers = data.carriers;

    const columns = {
      'New Lead': document.getElementById('kanban-new-lead'),
      'Contacted': document.getElementById('kanban-contacted'),
      'In Discussion': document.getElementById('kanban-in-discussion'),
      'Pitch Sent': document.getElementById('kanban-pitch-sent'),
      'Onboarded': document.getElementById('kanban-onboarded')
    };

    Object.values(columns).forEach(col => { if (col) col.innerHTML = ''; });
    const counts = { 'New Lead': 0, 'Contacted': 0, 'In Discussion': 0, 'Pitch Sent': 0, 'Onboarded': 0 };

    carriers.forEach(c => {
      const col = columns[c.crmStatus];
      if (col) {
        counts[c.crmStatus]++;
        const card = document.createElement('div');
        card.className = 'kanban-card';
        card.innerHTML = `
          <div class="kanban-card-title">${c.companyName}</div>
          <div class="kanban-card-meta">DOT #${c.usdot} • ${c.state} • ${c.powerUnits} Trucks</div>
          <div style="font-size: 0.8rem; color: var(--accent-green); margin-bottom: 6px;">
            <i class="fa-solid fa-phone"></i> ${c.phone || 'N/A'}
          </div>
          <div style="font-size: 0.75rem; color: var(--text-muted); display: flex; justify-content: space-between;">
            <span>Rep: <strong>${c.assignedRep}</strong></span>
            <span style="color: var(--accent-orange);">${c.authorityDaysOld}d Old</span>
          </div>
        `;
        card.onclick = () => openCarrierModal(c.id);
        col.appendChild(card);
      }
    });

    document.getElementById('count-new').innerText = counts['New Lead'];
    document.getElementById('count-contacted').innerText = counts['Contacted'];
    document.getElementById('count-discussion').innerText = counts['In Discussion'];
    document.getElementById('count-pitch').innerText = counts['Pitch Sent'];
    document.getElementById('count-onboarded').innerText = counts['Onboarded'];
  } catch (err) {}
}

// --- CARRIER DETAILS MODAL & NOTES ---
function initModal() {
  const modal = document.getElementById('carrier-modal');
  const closeBtn = document.getElementById('close-modal-btn');
  const saveBtn = document.getElementById('modal-save-btn');
  const addNoteBtn = document.getElementById('modal-add-note-btn');
  const scriptBtn = document.getElementById('modal-script-btn');
  const closeScriptBtn = document.getElementById('close-script-modal-btn');
  const scriptModal = document.getElementById('script-modal');

  closeBtn.onclick = () => modal.classList.remove('active');
  modal.onclick = (e) => { if (e.target === modal) modal.classList.remove('active'); };

  if (scriptBtn) scriptBtn.onclick = () => { if (state.activeCarrier) openScriptModal(state.activeCarrier.id); };
  if (closeScriptBtn) closeScriptBtn.onclick = () => closeScriptModal();
  if (scriptModal) scriptModal.onclick = (e) => { if (e.target === scriptModal) closeScriptModal(); };

  document.querySelectorAll('.modal-tab-btn').forEach(btn => {
    btn.onclick = () => {
      const target = btn.getAttribute('data-modaltab');
      document.querySelectorAll('.modal-tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.modal-tab-content').forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(`modaltab-${target}`).classList.add('active');
    };
  });

  saveBtn.onclick = async () => {
    if (!state.activeCarrier) return;
    const newStatus = document.getElementById('modal-crm-status-select').value;
    const newRep = document.getElementById('modal-assigned-rep-select').value;

    try {
      const res = await fetch(`/api/carriers/${state.activeCarrier.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${state.sessionToken}` },
        body: JSON.stringify({ crmStatus: newStatus, assignedRep: newRep })
      });
      if (res.ok) {
        showToast('Lead status updated successfully!', 'success');
        modal.classList.remove('active');
        fetchCarriers(state.currentPage);
        fetchStats();
      }
    } catch (err) {}
  };

  addNoteBtn.onclick = async () => {
    if (!state.activeCarrier) return;
    const textInput = document.getElementById('modal-new-note-text');
    const text = textInput.value.trim();
    if (!text) return;

    try {
      const res = await fetch(`/api/carriers/${state.activeCarrier.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${state.sessionToken}` },
        body: JSON.stringify({ noteText: text })
      });
      if (res.ok) {
        const data = await res.json();
        state.activeCarrier = data.carrier;
        renderModalNotes(data.carrier.notes);
        textInput.value = '';
        showToast('Note saved!', 'success');
      }
    } catch (err) {}
  };
}

async function openCarrierModal(carrierId) {
  try {
    const res = await fetch(`/api/carriers/${carrierId}`, {
      headers: { 'Authorization': `Bearer ${state.sessionToken}` }
    });
    if (!res.ok) return;

    const c = await res.json();
    state.activeCarrier = c;

    document.getElementById('modal-company-name').innerText = c.companyName;
    document.getElementById('modal-mc-number').innerText = c.mcNumber;
    document.getElementById('modal-dot-number').innerText = `DOT-${c.usdot}`;

    document.getElementById('modal-owner').innerText = c.ownerName || 'N/A';
    
    const cleanP = (c.phone || '').replace(/\D/g, '');
    const modalPhoneElem = document.getElementById('modal-phone');
    if (cleanP) {
      modalPhoneElem.innerHTML = `<button class="btn btn-sm btn-outline" onclick="startMandatoryCallRecorder('${c.id}', '${cleanP}')" style="color: var(--accent-green); font-weight:700;"><i class="fa-solid fa-phone-volume"></i> Call & Record (${c.phone})</button>`;
    } else {
      modalPhoneElem.innerText = 'N/A';
    }

    document.getElementById('modal-email').innerHTML = c.email ? `<a href="mailto:${c.email}" class="email-link">${c.email}</a>` : 'N/A';
    document.getElementById('modal-website').innerText = c.website || 'No Website';
    document.getElementById('modal-fleet').innerText = `${c.powerUnits} Power Units / ${c.drivers} Drivers`;
    document.getElementById('modal-equipment').innerText = Array.isArray(c.equipment) ? c.equipment.join(' / ') : (c.equipment || 'Dry Van');

    document.getElementById('modal-crm-status-select').value = c.crmStatus;
    document.getElementById('modal-assigned-rep-select').value = c.assignedRep;

    renderModalNotes(c.notes || []);
    document.getElementById('carrier-modal').classList.add('active');
  } catch (err) {}
}

function renderModalNotes(notes) {
  const container = document.getElementById('modal-notes-timeline');
  document.getElementById('modal-notes-count').innerText = notes.length;
  container.innerHTML = '';

  if (!notes || notes.length === 0) {
    container.innerHTML = '<p style="color: var(--text-muted); font-size: 0.85rem;">No call notes recorded yet.</p>';
    return;
  }

  notes.forEach(note => {
    const item = document.createElement('div');
    item.style.cssText = 'background: var(--bg-sidebar); border: 1px solid var(--border-color); padding: 12px; border-radius: 8px; margin-bottom: 8px; font-size: 0.85rem;';
    
    let audioPlayerHtml = '';
    if (note.recordingUrl) {
      audioPlayerHtml = `
        <div style="margin-top: 8px; padding: 6px 10px; background: rgba(0,0,0,0.3); border-radius: 6px; display: flex; align-items: center; justify-content: space-between; gap: 8px;">
          <audio controls src="${note.recordingUrl}" style="height: 30px; flex: 1;"></audio>
          ${state.sessionUser && state.sessionUser.role === 'ADMIN' ? `<button class="btn btn-sm btn-outline-danger" onclick="deleteCallRecording('${note.recordingUrl}')" title="Delete Recording (Admin Only)"><i class="fa-solid fa-trash"></i></button>` : '<span style="font-size:0.7rem; color:var(--text-muted);"><i class="fa-solid fa-lock"></i> Locked Recording</span>'}
        </div>
      `;
    }

    item.innerHTML = `
      <div style="display: flex; justify-content: space-between; margin-bottom: 4px; color: var(--text-muted); font-size: 0.75rem;">
        <span><strong style="color: var(--accent-blue);">${note.author}</strong></span>
        <span>${note.date} ${note.time || ''}</span>
      </div>
      <div>${note.text}</div>
      ${audioPlayerHtml}
    `;
    container.appendChild(item);
  });
}

function initClearDatabaseButton() {
  const clearBtn = document.getElementById('clear-database-btn');
  if (!clearBtn) return;
  clearBtn.addEventListener('click', async () => {
    if (confirm('Admin Confirmation: Clear ALL carrier leads from database?')) {
      try {
        const res = await fetch('/api/database/clear', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${state.sessionToken}` }
        });
        const data = await res.json();
        showToast(data.message, 'success');
        fetchStats();
        fetchCarriers(1);
      } catch (err) {}
    }
  });
}

function initQuickScrapeButton() {
  const quickBtn = document.getElementById('quick-scrape-btn');
  if (!quickBtn) return;
  quickBtn.addEventListener('click', () => {
    switchTab('bulk-scraper');
    document.getElementById('scraper-dots-input').focus();
  });
}

function initBulkAssignRep() {
  const assignBtn = document.getElementById('bulk-assign-rep-btn');
  const modal = document.getElementById('assign-rep-modal');
  const closeBtn = document.getElementById('close-assign-rep-btn');
  const confirmBtn = document.getElementById('confirm-assign-rep-btn');

  if (!assignBtn || !modal || !confirmBtn) return;

  assignBtn.addEventListener('click', () => {
    const count = state.selectedCarrierIds.size;
    if (count === 0) {
      showToast('Select at least 1 carrier checkbox first!', 'info');
      return;
    }
    document.getElementById('assign-modal-lead-count').innerText = count;
    modal.classList.add('active');
  });

  if (closeBtn) closeBtn.onclick = () => modal.classList.remove('active');
  confirmBtn.onclick = async () => {
    const selectedIds = Array.from(state.selectedCarrierIds);
    const selectedRep = document.getElementById('bulk-rep-select-input').value;

    try {
      const res = await fetch('/api/carriers/bulk-assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${state.sessionToken}` },
        body: JSON.stringify({ carrierIds: selectedIds, assignedRep: selectedRep })
      });
      const data = await res.json();
      if (res.ok) {
        showToast(data.message, 'success');
        modal.classList.remove('active');
        state.selectedCarrierIds.clear();
        fetchCarriers(state.currentPage);
        fetchStats();
      }
    } catch (e) {}
  };
}

// --- COLD CALL SCRIPT GENERATOR ---
function generateColdCallScript(carrier) {
  const owner = carrier.ownerName || 'Owner';
  const cityState = (carrier.city && carrier.state) ? `${carrier.city}, ${carrier.state}` : (carrier.state || 'your area');
  const equipmentList = Array.isArray(carrier.equipment) && carrier.equipment.length > 0 ? carrier.equipment : ['Dry Van'];
  const mainEquip = equipmentList[0];
  const powerUnits = carrier.powerUnits || 1;
  const isFresh = carrier.isFreshMC || (carrier.authorityDaysOld !== undefined && carrier.authorityDaysOld <= 30);
  const daysOld = carrier.authorityDaysOld || 14;

  let introHook = isFresh
    ? `Congratulations on receiving your active USDOT/MC authority ${daysOld === 0 ? 'today' : `${daysOld} days ago`}! I know newly approved carriers get flooded with low-paying load board offers and expensive factoring fees.`
    : `I saw you're operating ${powerUnits} ${powerUnits > 1 ? 'trucks' : 'truck'} running ${equipmentList.join(' / ')} out of ${cityState}. We have premium dedicated shippers looking for reliable equipment on outbound ${cityState} lanes.`;

  let equipmentPitch = `We secure high-paying dedicated freight averaging $2.60 - $3.40/mile, keeping your ${powerUnits > 1 ? 'fleet' : 'truck'} rolling with minimal dwell time.`;

  return {
    opener: `Hi ${owner}, this is [Your Name] with CarrierIntel Dispatch Services. Am I catching you while you're parked or between loads?`,
    valueHook: introHook,
    pitch: `Here's why I'm calling: ${equipmentPitch} We handle all rate negotiations, carrier packets, broker credit checks, and Detention/TONU claims for a flat 5% - 7% per load.`,
    qualifyingQuestions: [
      `1. Are you currently loaded right now, or looking for your next load out of ${cityState}?`,
      `2. What is your minimum target rate per mile for your ${equipmentList.join(' / ')}?`
    ],
    closingCTA: `I'd love to email you our Dispatch Agreement and sample rate sheet for ${carrier.state || 'your region'}. Can I confirm your best email is ${carrier.email || 'the one on file'}?`,
    objections: {
      "I already have a dispatcher": `Totally understand, ${owner}! We don't require binding contracts. Can I email you our lane rate sheet so you can compare when your current team has a dry spell?`,
      "What are your dispatch fees?": `We charge a flat 5% to 7% per booked load with ZERO hidden fees and NO setup costs. If we don't book you a top-paying load you approve of, you pay $0.`
    }
  };
}

async function openScriptModal(carrierId) {
  let carrier = state.carriers.find(c => c.id === carrierId) || state.freshCarriers.find(c => c.id === carrierId);
  if (!carrier) return;

  const script = generateColdCallScript(carrier);
  document.getElementById('script-company-name').innerText = carrier.companyName;

  document.getElementById('script-opener-text').innerHTML = `<strong>Opener:</strong> "${script.opener}"<br><br><strong>Hook:</strong> "${script.valueHook}"`;
  document.getElementById('script-pitch-text').innerText = script.pitch;
  document.getElementById('script-questions-text').innerHTML = script.qualifyingQuestions.map(q => `<div>${q}</div>`).join('');
  document.getElementById('script-closing-text').innerText = script.closingCTA;

  const objContainer = document.getElementById('script-objections-container');
  objContainer.innerHTML = '';
  Object.entries(script.objections).forEach(([title, resp]) => {
    const card = document.createElement('div');
    card.className = 'objection-card';
    card.innerHTML = `<div class="objection-title">Carrier Says: "${title}"</div><div class="objection-response"><strong>Counter:</strong> "${resp}"</div>`;
    objContainer.appendChild(card);
  });

  document.getElementById('script-modal').classList.add('active');
}

function closeScriptModal() { document.getElementById('script-modal').classList.remove('active'); }
function copyScriptText(elementId) {
  navigator.clipboard.writeText(document.getElementById(elementId).innerText);
  showToast('Copied section to clipboard!', 'success');
}
function copyEntireScript() {
  const fullText = `=== DISPATCH COLD CALL SCRIPT ===\n\n${document.getElementById('script-opener-text').innerText}\n\n${document.getElementById('script-pitch-text').innerText}`;
  navigator.clipboard.writeText(fullText);
  showToast('Copied FULL pitch script!', 'success');
}

window.openScriptModal = openScriptModal;
window.closeScriptModal = closeScriptModal;
window.copyScriptText = copyScriptText;
window.copyEntireScript = copyEntireScript;

// CSV EXPORT
async function triggerCsvExport(exportType = 'ALL') {
  try {
    const res = await fetch('/api/export/csv', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${state.sessionToken}` },
      body: JSON.stringify({ exportType })
    });
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `carrier_leads_${exportType.toLowerCase()}_${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    showToast('CSV Export downloaded successfully', 'success');
  } catch (err) {}
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = 'toast';
  let icon = type === 'success' ? 'fa-circle-check' : (type === 'error' ? 'fa-circle-exclamation' : 'fa-circle-info');
  toast.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}
