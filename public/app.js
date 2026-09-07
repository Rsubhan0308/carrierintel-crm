

// GLOBAL WINDOW CLICK HANDLERS FOR IMPORT & STOP SCRAPER (FIXED WITH .active CLASS & OVERLAY VISIBILITY)
window.openImportModal = function() {
  const modal = document.getElementById('import-leads-modal');
  if (modal) {
    modal.classList.add('active');
    modal.style.display = 'flex';
    modal.style.opacity = '1';
    modal.style.visibility = 'visible';
  }
};

window.closeImportModal = function() {
  const modal = document.getElementById('import-leads-modal');
  if (modal) {
    modal.classList.remove('active');
    modal.style.display = 'none';
    modal.style.opacity = '0';
    modal.style.visibility = 'hidden';
  }
};

window.stopScraperJob = async function() {
  try {
    if (state && state.scrapeInterval) clearInterval(state.scrapeInterval);
    const jobId = (state && state.currentJobId) ? state.currentJobId : '';
    const token = (state && state.sessionToken) ? state.sessionToken : localStorage.getItem('session_token') || '';
    
    await fetch('/api/scraper/stop', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : ''
      },
      body: JSON.stringify({ jobId })
    });
    
    const stopBtn = document.getElementById('stop-scraper-btn');
    if (stopBtn) stopBtn.style.display = 'none';
    const percentText = document.getElementById('crawler-percent-text');
    if (percentText) percentText.innerText = 'STOPPED';
    if (typeof showToast === 'function') showToast('Scraper job stopped!', 'info');
    if (typeof loadCarriers === 'function') loadCarriers();
  } catch (err) {
    console.error('Error stopping scraper:', err);
    if (typeof showToast === 'function') showToast('Scraper job stopped!', 'info');
  }
};


window.submitImportLeads = async function() {
  const fileInput = document.getElementById('import-file-input');
  const textInput = document.getElementById('import-text-input');
  const textContent = textInput ? textInput.value : '';

  const parseCsvSmart = (text) => {
    if (!text || !text.trim()) return [];

    // Split CSV lines taking into account quoted newlines
    const rawLines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (rawLines.length === 0) return [];

    // Helper to split CSV row handling quoted fields
    const parseRow = (rowStr) => {
      const result = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < rowStr.length; i++) {
        const char = rowStr[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          result.push(current.trim().replace(/^"|"$/g, ''));
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current.trim().replace(/^"|"$/g, ''));
      return result;
    };

    const firstRowCols = parseRow(rawLines[0]).map(c => c.toLowerCase());
    const hasHeader = firstRowCols.some(c => c.includes('usdot') || c.includes('mc') || c.includes('company') || c.includes('phone') || c.includes('name'));

    // Header index map
    const headerMap = {};
    if (hasHeader) {
      firstRowCols.forEach((col, idx) => {
        if (col.includes('usdot') || col.includes('dot')) headerMap.usdot = idx;
        else if (col.includes('mc') || col.includes('docket')) headerMap.mcNumber = idx;
        else if (col.includes('company') || col.includes('legal') || col.includes('name') && !col.includes('owner') && !col.includes('rep')) headerMap.companyName = idx;
        else if (col.includes('owner') || col.includes('contact')) headerMap.ownerName = idx;
        else if (col.includes('phone') || col.includes('tel')) headerMap.phone = idx;
        else if (col.includes('email') || col.includes('mail')) headerMap.email = idx;
        else if (col.includes('power') || col.includes('unit') || col.includes('fleet') || col.includes('truck')) headerMap.powerUnits = idx;
        else if (col.includes('equip') || col.includes('trailer')) headerMap.equipment = idx;
        else if (col.includes('city') || col.includes('address') || col.includes('street')) headerMap.city = idx;
        else if (col.includes('state')) headerMap.state = idx;
        else if (col.includes('status') || col.includes('crm')) headerMap.crmStatus = idx;
        else if (col.includes('rep') || col.includes('assigned')) headerMap.assignedRep = idx;
        else if (col.includes('date') || col.includes('grant') || col.includes('authority')) headerMap.authorityDate = idx;
      });
    }

    const dataLines = hasHeader ? rawLines.slice(1) : rawLines;
    const leads = [];

    dataLines.forEach((lineStr, idx) => {
      const cols = parseRow(lineStr);
      if (cols.length === 0) return;

      if (cols.length === 1 && !hasHeader) {
        const val = cols[0];
        const isMc = /^mc-?\d+/i.test(val);
        const dot = val.replace(/[^0-9]/g, '');
        if (dot) {
          leads.push({
            usdot: dot,
            mcNumber: isMc ? (val.startsWith('MC-') ? val : `MC-${val}`) : `MC-${dot}`,
            companyName: `CARRIER USDOT ${dot}`,
            entityType: 'CARRIER',
            state: 'TX',
            crmStatus: 'New Lead'
          });
        }
      } else {
        const getValue = (key, fallbackIdx, defaultVal = '') => {
          if (headerMap[key] !== undefined && cols[headerMap[key]] !== undefined) {
            return cols[headerMap[key]];
          }
          return cols[fallbackIdx] || defaultVal;
        };

        const rawDot = getValue('usdot', 0);
        const dot = rawDot.replace(/[^0-9]/g, '') || `38${Math.floor(10000 + Math.random() * 90000)}`;

        let rawMc = getValue('mcNumber', 1);
        if (!rawMc || rawMc.length < 3) rawMc = `MC-${Math.floor(100000 + Math.random() * 900000)}`;
        else if (!rawMc.toUpperCase().startsWith('MC')) rawMc = `MC-${rawMc}`;

        const companyName = getValue('companyName', 2) || `CARRIER ENTERPRISE ${dot}`;
        const ownerName = getValue('ownerName', 3) || '';
        const phone = getValue('phone', 4) || '';
        const email = getValue('email', 5) || '';
        const powerUnits = parseInt(getValue('powerUnits', 6, '1').replace(/[^0-9]/g, '') || '1', 10);
        const equipmentStr = getValue('equipment', 7, 'Dry Van');
        const city = getValue('city', 8, '');
        const stateVal = getValue('state', 9, 'TX').substring(0, 2).toUpperCase();
        const crmStatus = getValue('crmStatus', 10, 'New Lead');
        const assignedRep = getValue('assignedRep', 11, 'Unassigned');
        const authorityDate = getValue('authorityDate', 12, '');

        let authorityDaysOld = 120;
        if (authorityDate) {
          const parsedDt = new Date(authorityDate);
          if (!isNaN(parsedDt.getTime())) {
            authorityDaysOld = Math.max(0, Math.floor((new Date() - parsedDt) / (1000 * 60 * 60 * 24)));
          }
        }

        leads.push({
          usdot: dot,
          mcNumber: rawMc,
          companyName: companyName,
          ownerName: ownerName,
          phone: phone,
          email: email,
          powerUnits: powerUnits,
          drivers: powerUnits,
          equipment: equipmentStr.includes('/') ? equipmentStr.split('/').map(s => s.trim()) : [equipmentStr],
          city: city,
          state: stateVal,
          crmStatus: crmStatus,
          assignedRep: assignedRep,
          authorityGrantDate: authorityDate || new Date().toISOString().split('T')[0],
          authorityDaysOld: authorityDaysOld
        });
      }
    });

    return leads;
  };

  const processImport = async (text) => {
    const leads = parseCsvSmart(text);
    if (leads.length === 0) {
      if (typeof showToast === 'function') showToast('Please upload a valid CSV file or paste MC/USDOT numbers', 'warning');
      return;
    }

    try {
      const token = (state && state.sessionToken) ? state.sessionToken : localStorage.getItem('session_token') || '';
      const res = await fetch('/api/database/import', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify({ leads })
      });
      const data = await res.json();
      if (typeof showToast === 'function') showToast(data.message || `Successfully imported ${leads.length} leads!`, 'success');
      window.closeImportModal();
      if (textInput) textInput.value = '';
      if (fileInput) fileInput.value = '';
      if (typeof loadCarriers === 'function') loadCarriers();
    } catch (err) {
      if (typeof showToast === 'function') showToast('Error importing leads', 'error');
    }
  };

  if (fileInput && fileInput.files && fileInput.files[0]) {
    const reader = new FileReader();
    reader.onload = (e) => processImport(e.target.result);
    reader.readAsText(fileInput.files[0]);
  } else {
    processImport(textContent);
  }
};




// Helper to format MC number without duplicate MC- or MC MC- prefixes
function formatMC(mc) {
  if (!mc) return '';
  const clean = mc.toString().replace(/^MC-?/i, '').trim();
  return clean ? `MC-${clean}` : '';
}

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
    hasEmail: false,
    hasPhone: false,
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
  initExportButton();

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
          fetchUsers();
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
      fetchUsers();
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
  const addSysAudioBtn = document.getElementById('btn-add-system-audio');

  if (stopSaveBtn) stopSaveBtn.addEventListener('click', stopAndSaveCallRecording);
  if (floatingEndCallBtn) floatingEndCallBtn.addEventListener('click', stopAndSaveCallRecording);
  
  if (minimizeBtn) minimizeBtn.addEventListener('click', minimizeCallRecorderModal);
  if (minimizeFooterBtn) minimizeFooterBtn.addEventListener('click', minimizeCallRecorderModal);
  if (expandBtn) expandBtn.addEventListener('click', expandCallRecorderModal);
  if (pitchBtn) pitchBtn.addEventListener('click', openPitchScriptFromCall);
  if (addSysAudioBtn) addSysAudioBtn.addEventListener('click', addSystemAudioStream);
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

async function addSystemAudioStream() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
    showToast('System audio capture is not supported in this browser.', 'warning');
    return;
  }

  try {
    const displayStream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, suppressLocalAudioPlayback: false }
    });

    const sysAudioTracks = displayStream.getAudioTracks();
    if (sysAudioTracks.length === 0) {
      showToast('⚠️ No recipient audio track selected. Make sure to check "Share Audio" in the browser popup!', 'warning');
      return;
    }

    state.displayStream = displayStream;

    if (state.recordingAudioCtx && state.recordingDestNode) {
      const sysSourceNode = state.recordingAudioCtx.createMediaStreamSource(new MediaStream([sysAudioTracks[0]]));
      sysSourceNode.connect(state.recordingDestNode);
    }

    const subText = document.querySelector('.rec-sub');
    if (subText) {
      subText.innerHTML = '<i class="fa-solid fa-headset"></i> <span style="color:#10b981; font-weight:bold;">🟢 2-Way Both-Sides Active (Mic + Recipient Headphone Audio Linked)</span>';
    }

    const recStatusNotice = document.getElementById('rec-status-notice');
    if (recStatusNotice) {
      recStatusNotice.innerHTML = '<i class="fa-solid fa-circle-check" style="color:#10b981;"></i> Recipient headphone voice stream digitally connected!';
    }

    showToast('✅ Recipient & Softphone audio stream linked successfully!', 'success');
  } catch (err) {
    console.log('System audio capture cancelled or skipped:', err);
  }
}
window.addSystemAudioStream = addSystemAudioStream;

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

  // Trigger Phone / VoIP Launch
  const cleanPhone = (phoneNum || carrier.phone || '').replace(/\D/g, '');
  if (cleanPhone) {
    window.open(`tel:${cleanPhone}`, '_self');
  }

  try {
    let recorderStream;

            // 1. Capture Microphone Stream with High Sensitivity
    const micStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: true
      }
    });
    state.micStream = micStream;

    // 2. Setup Web Audio API AudioContext with Gain Boost & Dynamics Compressor
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const destNode = audioCtx.createMediaStreamDestination();
    state.recordingAudioCtx = audioCtx;
    state.recordingDestNode = destNode;

    const micSourceNode = audioCtx.createMediaStreamSource(micStream);
    const gainNode = audioCtx.createGain();
    gainNode.gain.value = 2.0;

    const compressorNode = audioCtx.createDynamicsCompressor();
    compressorNode.threshold.value = -35;
    compressorNode.knee.value = 10;
    compressorNode.ratio.value = 12;
    compressorNode.attack.value = 0.003;
    compressorNode.release.value = 0.25;

    micSourceNode.connect(gainNode);
    gainNode.connect(compressorNode);
    compressorNode.connect(destNode);

    // Auto-connect any active web page / WebRTC audio elements automatically
    document.querySelectorAll('audio, video').forEach(mediaElem => {
      try {
        if (mediaElem.srcObject || mediaElem.src) {
          const stream = mediaElem.srcObject || (mediaElem.captureStream ? mediaElem.captureStream() : null);
          if (stream && stream.getAudioTracks().length > 0) {
            const sourceNode = audioCtx.createMediaStreamSource(stream);
            sourceNode.connect(destNode);
            console.log('Connected page audio element to recorder destination node');
          }
        }
      } catch (e) {
        console.log('Could not connect media element:', e);
      }
    });

    state.mediaRecorder = new MediaRecorder(destNode.stream);
    state.mediaRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) state.audioChunks.push(event.data);
    };

    state.mediaRecorder.start(1000);

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
    showToast('🎙️ 2-Way Both-Sides Call Recording Active!', 'success');

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
          showToast('Both-sides call recording saved successfully!', 'success');
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

    // Clean up & stop all audio streams and context
    if (state.micStream) {
      state.micStream.getTracks().forEach(track => track.stop());
      state.micStream = null;
    }
    if (state.displayStream) {
      state.displayStream.getTracks().forEach(track => track.stop());
      state.displayStream = null;
    }
    if (state.recordingAudioCtx) {
      state.recordingAudioCtx.close();
      state.recordingAudioCtx = null;
      state.recordingDestNode = null;
    }
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
  if (!state.sessionUser) return;

  try {
    const res = await fetch('/api/users', {
      headers: { 'Authorization': `Bearer ${state.sessionToken}` }
    });
    if (!res.ok) return;

    const users = await res.json();
    if (state.sessionUser.role === 'ADMIN') {
      renderUserTable(users);
    }
    populateRepDropdowns(users);
  } catch (err) {
    console.error('Failed to fetch users:', err);
  }
}

function populateRepDropdowns(users) {
  if (!users || !Array.isArray(users)) return;

  const repUsers = users.filter(u => u.role === 'SALES_REP' || u.role === 'ADMIN');
  const repNames = repUsers.map(u => u.name);

  // 1. Bulk Assign Rep Dropdown (bulk-rep-select-input)
  const bulkSelect = document.getElementById('bulk-rep-select-input');
  if (bulkSelect) {
    const currentVal = bulkSelect.value;
    let html = repNames.map(name => `<option value="${name}">${name}</option>`).join('');
    html += `<option value="Unassigned">Unassigned (Reset Assignment)</option>`;
    bulkSelect.innerHTML = html;
    if (repNames.includes(currentVal) || currentVal === 'Unassigned') {
      bulkSelect.value = currentVal;
    }
  }

  // 2. Carrier Details Modal Assigned Rep Dropdown (modal-assigned-rep-select)
  const modalSelect = document.getElementById('modal-assigned-rep-select');
  if (modalSelect) {
    const currentVal = modalSelect.value;
    let html = repNames.map(name => `<option value="${name}">${name}</option>`).join('');
    html += `<option value="Unassigned">Unassigned</option>`;
    modalSelect.innerHTML = html;
    if (repNames.includes(currentVal) || currentVal === 'Unassigned') {
      modalSelect.value = currentVal;
    }
  }

  // 3. Activity Tracker Filter Dropdown (tracker-rep-filter)
  const trackerSelect = document.getElementById('tracker-rep-filter');
  if (trackerSelect) {
    const currentVal = trackerSelect.value;
    let html = `<option value="ALL">All Sales Reps</option>`;
    html += repNames.map(name => `<option value="${name}">${name}</option>`).join('');
    trackerSelect.innerHTML = html;
    if (repNames.includes(currentVal) || currentVal === 'ALL') {
      trackerSelect.value = currentVal;
    }
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
      <td style="text-align: right;">
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
  else if (tabId === 'reminders') fetchReminders();
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

    const dotTag = carrier.usdot ? `<span class="id-pill">DOT ${carrier.usdot}</span>` : '';
    const mcTag = carrier.mcNumber ? `<span class="id-pill">${formatMC(carrier.mcNumber)}</span>` : '';

    const equipList = Array.isArray(carrier.equipment) ? carrier.equipment : ['Dry Van'];
    const equipBadges = equipList.map(eq => `<span class="equipment-badge equip-dryvan">${eq}</span>`).join(' ');

    let statusClass = 'badge-blue';
    if (carrier.crmStatus === 'New Lead') statusClass = 'badge-hot';
    if (carrier.crmStatus === 'Onboarded') statusClass = 'badge-green';

    const rawPhone = carrier.phone || '';
    const cleanPhone = rawPhone.replace(/\D/g, '');
    const phoneHtml = cleanPhone 
      ? `<button class="call-btn-link" onclick="startMandatoryCallRecorder('${carrier.id}', '${cleanPhone}')" title="Call Carrier"><i class="fa-solid fa-phone"></i> ${rawPhone}</button>` 
      : `<span style="font-size:0.73rem; color:var(--text-dim);">No Phone</span>`;
    
    const emailHtml = carrier.email 
      ? `<a href="mailto:${carrier.email}" class="email-link" title="${carrier.email}"><i class="fa-solid fa-envelope"></i> ${carrier.email}</a>` 
      : `<span style="font-size:0.73rem; color:var(--text-dim);">No Email</span>`;

    const initials = (carrier.companyName || 'CC')
      .split(' ')
      .filter(w => w.length > 0)
      .slice(0, 2)
      .map(w => w[0].toUpperCase())
      .join('') || 'TR';

    tr.innerHTML = `
      <td><input type="checkbox" class="carrier-checkbox" data-id="${carrier.id}" ${isChecked ? 'checked' : ''}></td>
      <td>
        <div class="company-cell-wrapper">
          <div class="company-avatar">${initials}</div>
          <div class="company-cell">
            <span class="comp-name" title="${carrier.companyName}">${carrier.companyName}</span>
            <div class="comp-ids">${dotTag} ${mcTag}</div>
          </div>
        </div>
      </td>
      <td>
        <div class="contact-cell">
          <span class="contact-owner">${carrier.ownerName || 'Unknown Owner'}</span>
          <div>${phoneHtml}</div>
          <div>${emailHtml}</div>
        </div>
      </td>
      <td>
        <div class="location-cell">
          <span class="loc-city">${carrier.city || ''}, ${carrier.state || ''}</span>
          <span class="loc-address" title="${carrier.address || ''}">${carrier.address || carrier.zip || ''}</span>
        </div>
      </td>
      <td>
        <div class="fleet-cell">
          <span class="fleet-units"><i class="fa-solid fa-truck-front"></i> <strong>${carrier.powerUnits || 0}</strong> Units</span>
          <div class="equip-badges">${equipBadges}</div>
        </div>
      </td>
      <td>
        <div class="authority-cell">
          <span class="auth-date">${carrier.authorityDate || 'N/A'}</span>
          <span class="${carrier.isFreshMC ? 'auth-age-fresh' : 'auth-age-standard'}">${carrier.authorityDaysOld}d old</span>
        </div>
      </td>
      <td>
        <div class="status-cell">
          <span class="badge ${statusClass}">${carrier.crmStatus}</span>
          <div class="rep-tag">Rep: ${carrier.assignedRep || 'Unassigned'}</div>
        </div>
      </td>
      <td style="text-align: right;">
        <div class="actions-cell">
          <button class="btn btn-xs btn-outline view-details-btn" data-id="${carrier.id}" title="View Details"><i class="fa-solid fa-eye"></i> Details</button>
          <button class="btn btn-xs btn-accent open-script-btn" data-id="${carrier.id}" title="Pitch Script"><i class="fa-solid fa-scroll"></i> Pitch</button>
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
      updateSelectedCountDisplay();
    });
  });

  document.querySelectorAll('.view-details-btn').forEach(btn => {
    btn.addEventListener('click', () => openCarrierModal(btn.getAttribute('data-id')));
  });

  document.querySelectorAll('.open-script-btn').forEach(btn => {
    btn.addEventListener('click', () => openScriptModal(btn.getAttribute('data-id')));
  });

  updateSelectedCountDisplay();
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

  const emailCb = document.getElementById('filter-email-only');
  const phoneCb = document.getElementById('filter-phone-only');

  if (emailCb) {
    emailCb.addEventListener('change', (e) => {
      state.filters.hasEmail = e.target.checked;
      fetchCarriers(1);
    });
  }
  if (phoneCb) {
    phoneCb.addEventListener('change', (e) => {
      state.filters.hasPhone = e.target.checked;
      fetchCarriers(1);
    });
  }

  resetBtn.addEventListener('click', () => {
    stateSel.value = 'ALL';
    equipSel.value = 'ALL';
    fleetSel.value = 'ALL';
    ageSel.value = 'ALL';
    crmSel.value = 'ALL';
    if (emailCb) emailCb.checked = false;
    if (phoneCb) phoneCb.checked = false;
    const searchInput = document.getElementById('global-search');
    if (searchInput) searchInput.value = '';
    state.filters = { q: '', state: 'ALL', equipment: 'ALL', minPowerUnits: '', maxPowerUnits: '', freshMcDays: 'ALL', hasEmail: false, hasPhone: false, crmStatus: 'ALL', assignedRep: state.sessionUser && state.sessionUser.role === 'SALES_REP' ? state.sessionUser.name : 'ALL' };
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
    updateSelectedCountDisplay();
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
        <p style="font-family: var(--font-mono); font-size: 0.8rem; color: var(--text-muted); margin-bottom: 12px;">${formatMC(c.mcNumber) || 'MC-N/A'} • DOT: ${c.usdot}</p>
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

    const stateFilter = document.getElementById('scraper-state-filter') ? document.getElementById('scraper-state-filter').value : 'ALL';
    const equipFilter = document.getElementById('scraper-equip-filter') ? document.getElementById('scraper-equip-filter').value : 'ALL';
    const ageFilter = document.getElementById('scraper-age-filter') ? document.getElementById('scraper-age-filter').value : 'ALL';
    const maxRecords = document.getElementById('scraper-max-records') ? document.getElementById('scraper-max-records').value : 25;
    const skipDuplicates = document.getElementById('scraper-skip-duplicates') ? document.getElementById('scraper-skip-duplicates').checked : true;
    const proxyEnrichment = document.getElementById('scraper-proxy-enrichment') ? document.getElementById('scraper-proxy-enrichment').checked : true;

    try {
      const res = await fetch('/api/scraper/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${state.sessionToken}` },
        body: JSON.stringify({ dotList, stateFilter, equipFilter, ageFilter, maxRecords, skipDuplicates, proxyEnrichment })
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
  const percentText = document.getElementById('crawler-percent-text');

  if (consoleBox) consoleBox.innerHTML = '';
  let lastLogIndex = 0;

  state.scrapeInterval = setInterval(async () => {
    try {
      const res = await fetch(`/api/scraper/status/${jobId}`);
      if (!res.ok) return;
      const job = await res.json();

      if (progressBar) progressBar.style.width = `${job.progress || 0}%`;
      if (percentText) percentText.innerText = `${job.status}: ${job.progress || 0}% (${job.scrapedCount || 0} Extracted)`;

      if (consoleBox && job.logs && job.logs.length > lastLogIndex) {
        for (let i = lastLogIndex; i < job.logs.length; i++) {
          const logLine = job.logs[i];
          const div = document.createElement('div');
          div.className = 'terminal-line';
          if (logLine.includes('[SUCCESS]') || logLine.includes('[COMPLETE]')) div.className += ' success-line';
          else if (logLine.includes('[INIT]') || logLine.includes('[FETCH]')) div.className += ' system-line';
          div.textContent = logLine;
          consoleBox.appendChild(div);
        }
        lastLogIndex = job.logs.length;
        consoleBox.scrollTop = consoleBox.scrollHeight;
      }

      if (job.status === 'COMPLETED' || job.status === 'ERROR') {
        clearInterval(state.scrapeInterval);
        fetchStats();
        fetchCarriers(1);
      }
    } catch (err) {}
  }, 250);
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
  const emailPitchBtn = document.getElementById('modal-email-pitch-btn');
  const closeEmailBtn = document.getElementById('close-email-modal-btn');
  const emailModal = document.getElementById('email-template-modal');
  const closeScriptBtn = document.getElementById('close-script-modal-btn');
  const scriptModal = document.getElementById('script-modal');

  closeBtn.onclick = () => modal.classList.remove('active');
  modal.onclick = (e) => { if (e.target === modal) modal.classList.remove('active'); };

  if (scriptBtn) scriptBtn.onclick = () => { if (state.activeCarrier) openScriptModal(state.activeCarrier.id); };
  if (closeScriptBtn) closeScriptBtn.onclick = () => closeScriptModal();
  if (scriptModal) scriptModal.onclick = (e) => { if (e.target === scriptModal) closeScriptModal(); };

  if (emailPitchBtn) emailPitchBtn.onclick = () => { if (state.activeCarrier) openEmailPitchModal(state.activeCarrier.id); };
  if (closeEmailBtn) closeEmailBtn.onclick = () => emailModal.classList.remove('active');
  if (emailModal) emailModal.onclick = (e) => { if (e.target === emailModal) emailModal.classList.remove('active'); };

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
    const callbackDt = document.getElementById('modal-callback-datetime').value;
    const callbackNote = document.getElementById('modal-callback-note').value.trim();

    try {
      const payload = { crmStatus: newStatus, assignedRep: newRep };
      if (callbackDt) {
        payload.followUpDate = callbackDt;
        payload.followUpNote = callbackNote;
        payload.followUpStatus = 'PENDING';
      }

      const res = await fetch(`/api/carriers/${state.activeCarrier.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${state.sessionToken}` },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        showToast('Lead status & callback saved successfully!', 'success');
        modal.classList.remove('active');
        fetchCarriers(state.currentPage);
        fetchStats();
        fetchReminders();
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
    document.getElementById('modal-mc-number').innerText = formatMC(c.mcNumber) || 'MC-N/A';
    document.getElementById('modal-dot-number').innerText = `DOT-${c.usdot}`;

    document.getElementById('modal-owner').innerText = c.ownerName || 'Unknown Owner';
    
    const cleanP = (c.phone || '').replace(/\D/g, '');
    const modalPhoneElem = document.getElementById('modal-phone');
    if (cleanP) {
      modalPhoneElem.innerHTML = `<button class="call-btn-link" onclick="startMandatoryCallRecorder('${c.id}', '${cleanP}')" title="Call & Record Carrier"><i class="fa-solid fa-phone"></i> Call & Record (${c.phone})</button>`;
    } else {
      modalPhoneElem.innerHTML = '<span style="color:var(--text-muted);">No Phone Recorded</span>';
    }

    document.getElementById('modal-email').innerHTML = c.email ? `<a href="mailto:${c.email}" class="email-link"><i class="fa-solid fa-envelope"></i> ${c.email}</a>` : '<span style="color:var(--text-muted);">No Email Recorded</span>';
    document.getElementById('modal-website').innerHTML = c.website ? `<a href="${c.website.startsWith('http') ? c.website : 'https://' + c.website}" target="_blank" class="email-link"><i class="fa-solid fa-globe"></i> ${c.website}</a>` : '<span style="color:var(--text-muted);">No Website Recorded</span>';
    
    // Physical Address Format
    const addressStr = c.address || [c.city, c.state, c.zip].filter(Boolean).join(', ') || 'Location N/A';
    document.getElementById('modal-address').innerText = addressStr;

    // FMCSA Specs & Authority Date
    const mcTag = c.mcNumber ? `<span class="id-pill">${formatMC(c.mcNumber)}</span>` : '';
    const dotTag = c.usdot ? `<span class="id-pill">DOT ${c.usdot}</span>` : '';
    document.getElementById('modal-fmcsa-ids').innerHTML = `${dotTag} ${mcTag}`;
    document.getElementById('modal-auth-date').innerText = c.authorityDate || 'N/A';
    document.getElementById('modal-auth-age').innerHTML = `<span class="${c.isFreshMC ? 'auth-age-fresh' : 'auth-age-standard'}">${c.authorityDaysOld || 0} Days Old (${c.isFreshMC ? 'Fresh MC < 30 Days' : 'Established MC'})</span>`;
    document.getElementById('modal-fleet').innerText = `${c.powerUnits || 0} Power Units / ${c.drivers || 0} Drivers`;
    document.getElementById('modal-equipment').innerText = Array.isArray(c.equipment) ? c.equipment.join(' / ') : (c.equipment || 'Dry Van');
    document.getElementById('modal-operating-status').innerHTML = `<span class="badge badge-green"><i class="fa-solid fa-circle-check"></i> Authorized for Hire (Active)</span>`;

    document.getElementById('modal-crm-status-select').value = c.crmStatus;
    document.getElementById('modal-assigned-rep-select').value = c.assignedRep;

    renderModalNotes(c.notes || []);
    document.getElementById('carrier-modal').classList.add('active');
  } catch (err) {
    console.error('Error opening carrier modal:', err);
  }
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

// CSV EXPORT SYSTEM
function updateSelectedCountDisplay() {
  const countEl = document.getElementById('selected-count');
  const exportBtn = document.getElementById('export-selected-btn');
  if (!countEl || !exportBtn) return;

  if (state.selectedCarrierIds.size > 0) {
    countEl.innerText = state.selectedCarrierIds.size;
    exportBtn.title = `Export ${state.selectedCarrierIds.size} Selected Lead(s) to CSV`;
  } else {
    countEl.innerText = 'All';
    exportBtn.title = `Export All Available Leads to CSV`;
  }
}
window.updateSelectedCountDisplay = updateSelectedCountDisplay;

function initExportButton() {
  const exportBtn = document.getElementById('export-selected-btn');
  if (!exportBtn) return;

  exportBtn.addEventListener('click', async () => {
    const selectedIds = Array.from(state.selectedCarrierIds);
    try {
      showToast('Preparing CSV Export file...', 'info');
      const res = await fetch('/api/export/csv', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${state.sessionToken}`
        },
        body: JSON.stringify({
          ids: selectedIds.length > 0 ? selectedIds : null,
          exportType: 'ALL'
        })
      });

      if (!res.ok) {
        showToast('Export failed. Please check permissions or login status.', 'error');
        return;
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = selectedIds.length > 0 
        ? `selected_carrier_leads_${selectedIds.length}_${Date.now()}.csv` 
        : `all_carrier_leads_${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      showToast(`CSV Export downloaded successfully (${selectedIds.length > 0 ? selectedIds.length + ' selected' : 'all'} leads)!`, 'success');
    } catch (err) {
      console.error('Export error:', err);
      showToast('Failed to download CSV export file.', 'error');
    }
  });
}

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

// --- 1-CLICK EMAIL PITCH TEMPLATES ---
let activeEmailCarrier = null;

function openEmailPitchModal(carrierId) {
  let carrier = state.carriers.find(c => c.id === carrierId) || state.freshCarriers.find(c => c.id === carrierId);
  if (!carrier && state.activeCarrier && state.activeCarrier.id === carrierId) {
    carrier = state.activeCarrier;
  }
  if (!carrier) return;

  activeEmailCarrier = carrier;
  document.getElementById('email-modal-company-name').innerText = carrier.companyName;
  document.getElementById('email-modal-address').innerText = carrier.email || 'No email address on file';

  const select = document.getElementById('email-template-select');
  select.onchange = () => populateEmailTemplate(select.value, carrier);
  populateEmailTemplate('DRY_VAN', carrier);

  document.getElementById('email-template-modal').classList.add('active');
}
window.openEmailPitchModal = openEmailPitchModal;

function populateEmailTemplate(templateKey, carrier) {
  const ownerName = carrier.ownerName || 'Owner / Dispatch Manager';
  const repName = state.sessionUser ? state.sessionUser.name : 'Dispatch Sales Desk';
  const phone = carrier.phone || '(205) 722-4524';

  let subject = '';
  let body = '';

  switch (templateKey) {
    case 'DRY_VAN':
      subject = `High-Paying Dedicated Dry Van Lanes Available for ${carrier.companyName} (DOT #${carrier.usdot})`;
      body = `Hi ${ownerName},\n\nI noticed ${carrier.companyName} operates ${carrier.powerUnits || 1} Dry Van unit(s) out of ${carrier.city || 'your area'}, ${carrier.state || ''}.\n\nWe currently have premium-rate dedicated freight lanes running in your region with average rates exceeding $2.75 - $3.20/mile, zero factoring delays, and quick 24-hour pay terms.\n\nWould you have 2 minutes for a quick chat today to see if our lane volume fits your current routes?\n\nBest regards,\n${repName}\nDispatch & Freight Sales Engine\nDirect Phone: ${phone}`;
      break;
    case 'REEFER':
      subject = `Dedicated Temperature-Controlled Reefer Freight for ${carrier.companyName} (${formatMC(carrier.mcNumber) || 'DOT ' + carrier.usdot})`;
      body = `Hello ${ownerName},\n\nOur dispatch network has immediate high-paying reefer loads originating out of ${carrier.state || 'your region'} with top-tier RPM ($3.10 - $3.80/mile).\n\nWe handle all broker negotiation, detention tracking, and paperwork setup so your drivers stay moving without sitting empty.\n\nLet's discuss your preferred origin/destination lanes this week.\n\nBest regards,\n${repName}\nReefer Dispatch Operations\nDirect Phone: ${phone}`;
      break;
    case 'FLATBED':
      subject = `Open Deck & Flatbed Freight Lanes Ready for ${carrier.companyName}`;
      body = `Hi ${ownerName},\n\nWe are looking for active Flatbed / Step Deck carriers like ${carrier.companyName} to handle specialized open deck freight.\n\nWe provide 100% transparent rate confirmations, no forced dispatch, and high-RPM oversize/heavy haul options.\n\nCall or reply to this email to lock in your preferred routes for next week.\n\nBest regards,\n${repName}\nFlatbed Logistics Desk\nDirect Phone: ${phone}`;
      break;
    case 'OWNER_OP':
      subject = `Max Rate Per Mile Dispatch Agreement for ${carrier.companyName} (${carrier.powerUnits || 1} Truck Fleet)`;
      body = `Dear ${ownerName},\n\nAs an owner-operator running ${carrier.companyName}, your time should be spent driving, not negotiating with lowball brokers.\n\nOur full-service dispatch team guarantees:\n• High Average Rate Per Mile ($2.70+ RPM)\n• 24/7 Dedicated Dispatcher\n• Factoring & Setup Packet Management\n• Low 8% Flat Dispatch Fee (No contracts)\n\nReply to this email or call me directly to get onboarded in 15 minutes.\n\nBest regards,\n${repName}\nOwner-Operator Success Team\nDirect Phone: ${phone}`;
      break;
    case 'SETUP_PACKET':
      subject = `Carrier Dispatch Setup Packet Request - ${carrier.companyName} (DOT #${carrier.usdot})`;
      body = `Hi ${ownerName},\n\nFollowing up on our conversation, please send over your setup packet documents so we can complete carrier onboarding:\n\n1. Copy of MC Authority Certificate\n2. Signed W-9 Form\n3. Certificate of Insurance (COI) listing $100k Cargo / $1M Auto Liability\n4. Notice of Assignment (NOA) for Factoring (if applicable)\n\nSend documents back to this email or call us if you have any questions.\n\nBest regards,\n${repName}\nCarrier Onboarding Department\nDirect Phone: ${phone}`;
      break;
  }

  document.getElementById('email-modal-subject').value = subject;
  document.getElementById('email-modal-body').value = body;
}

function copyEmailTemplateBody() {
  const bodyText = document.getElementById('email-modal-body').value;
  navigator.clipboard.writeText(bodyText);
  showToast('Email body text copied to clipboard!', 'success');
}
window.copyEmailTemplateBody = copyEmailTemplateBody;

function launchDefaultMailClient() {
  if (!activeEmailCarrier || !activeEmailCarrier.email) {
    showToast('Carrier email is missing or not provided.', 'error');
    return;
  }
  const subject = encodeURIComponent(document.getElementById('email-modal-subject').value);
  const body = encodeURIComponent(document.getElementById('email-modal-body').value);
  window.open(`mailto:${activeEmailCarrier.email}?subject=${subject}&body=${body}`, '_blank');
}
window.launchDefaultMailClient = launchDefaultMailClient;

// --- SMART CALLBACK & REMINDER SYSTEM ---
async function fetchReminders() {
  try {
    const res = await fetch('/api/reminders', {
      headers: { 'Authorization': `Bearer ${state.sessionToken}` }
    });
    if (!res.ok) return;

    const data = await res.json();
    
    // Update badge in sidebar
    const badge = document.getElementById('nav-callbacks-count');
    if (badge) {
      if (data.dueCount > 0) {
        badge.innerText = data.dueCount;
        badge.style.display = 'inline-block';
      } else {
        badge.style.display = 'none';
      }
    }

    document.getElementById('count-reminders-due').innerText = data.dueNowOrOverdue.length;
    document.getElementById('count-reminders-upcoming').innerText = data.upcoming.length;
    document.getElementById('count-reminders-completed').innerText = data.completed.length;

    renderReminderCards('container-reminders-due', data.dueNowOrOverdue, true);
    renderReminderCards('container-reminders-upcoming', data.upcoming, false);
    renderReminderCards('container-reminders-completed', data.completed, false, true);

  } catch (err) {
    console.error('Failed to fetch reminders:', err);
  }
}
window.fetchReminders = fetchReminders;

function renderReminderCards(containerId, list, isOverdue = false, isCompleted = false) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '';

  if (!list || list.length === 0) {
    container.innerHTML = `<p style="color: var(--text-muted); font-size: 0.85rem; text-align: center; padding: 16px;">No callback reminders in this category.</p>`;
    return;
  }

  list.forEach(c => {
    const card = document.createElement('div');
    card.className = `reminder-card ${isOverdue ? 'card-overdue' : ''}`;
    const dateFormatted = new Date(c.followUpDate).toLocaleString();
    const cleanPhone = (c.phone || '').replace(/\D/g, '');

    card.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px;">
        <span style="font-weight: 800; font-size: 0.92rem;">${c.companyName}</span>
        <span class="badge ${isOverdue ? 'badge-hot' : (isCompleted ? 'badge-green' : 'badge-blue')}">${isOverdue ? '🚨 DUE NOW' : (isCompleted ? 'Completed' : 'Scheduled')}</span>
      </div>
      <div style="font-size: 0.78rem; color: var(--text-muted); margin-bottom: 6px;">DOT #${c.usdot} • ${c.state || ''} • ${c.powerUnits || 1} Units</div>
      <div style="font-size: 0.8rem; color: var(--accent-orange); font-weight: 700; margin-bottom: 6px;">
        <i class="fa-solid fa-clock"></i> ${dateFormatted}
      </div>
      ${c.followUpNote ? `<div style="font-size: 0.8rem; background: rgba(0,0,0,0.3); padding: 6px 10px; border-radius: 6px; margin-bottom: 10px; color: var(--text-main);">${c.followUpNote}</div>` : ''}
      <div style="display: flex; gap: 8px; justify-content: space-between;">
        ${cleanPhone ? `<button class="btn btn-xs btn-primary" onclick="startMandatoryCallRecorder('${c.id}', '${cleanPhone}')"><i class="fa-solid fa-phone"></i> Call Now</button>` : ''}
        ${!isCompleted ? `<button class="btn btn-xs btn-outline-success" onclick="markCallbackCompleted('${c.id}')"><i class="fa-solid fa-check"></i> Complete</button>` : ''}
      </div>
    `;
    container.appendChild(card);
  });
}

function setQuickCallbackPreset(presetKey) {
  const dtInput = document.getElementById('modal-callback-datetime');
  const now = new Date();

  if (presetKey === 'tomorrow') {
    now.setDate(now.getDate() + 1);
    now.setHours(10, 0, 0, 0);
  } else if (presetKey === 'in3days') {
    now.setDate(now.getDate() + 3);
    now.setHours(10, 0, 0, 0);
  } else if (presetKey === 'nextmonday') {
    const day = now.getDay();
    const diff = now.getDate() + (8 - day);
    now.setDate(diff);
    now.setHours(10, 0, 0, 0);
  }

  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const date = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const mins = String(now.getMinutes()).padStart(2, '0');

  dtInput.value = `${year}-${month}-${date}T${hours}:${mins}`;
}
window.setQuickCallbackPreset = setQuickCallbackPreset;

async function markCallbackCompleted(carrierId) {
  try {
    const res = await fetch(`/api/carriers/${carrierId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${state.sessionToken}` },
      body: JSON.stringify({ followUpStatus: 'COMPLETED' })
    });
    if (res.ok) {
      showToast('Callback marked as completed!', 'success');
      fetchReminders();
    }
  } catch (err) {}
}
window.markCallbackCompleted = markCallbackCompleted;


  // STOP SCRAPER BUTTON HANDLER
  const stopScraperBtn = document.getElementById('stop-scraper-btn');
  if (stopScraperBtn) {
    stopScraperBtn.addEventListener('click', async () => {
      try {
        if (state.scrapeInterval) clearInterval(state.scrapeInterval);
        await fetch('/api/scraper/stop', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${state.sessionToken}` },
          body: JSON.stringify({ jobId: state.currentJobId || '' })
        });
        stopScraperBtn.style.display = 'none';
        const percentText = document.getElementById('crawler-percent-text');
        if (percentText) percentText.innerText = 'STOPPED';
        showToast('Scraper job stopped!', 'info');
        loadCarriers();
      } catch (err) {
        showToast('Error stopping scraper job', 'error');
      }
    });
  }

  // IMPORT LEADS MODAL & HANDLER
  const importBtn = document.getElementById('import-leads-btn');
  const importModal = document.getElementById('import-leads-modal');
  const closeImportBtn = document.getElementById('close-import-modal-btn');
  const submitImportBtn = document.getElementById('submit-import-btn');

  if (importBtn && importModal) {
    importBtn.addEventListener('click', () => {
      importModal.style.display = 'flex';
    });
  }

  if (closeImportBtn && importModal) {
    closeImportBtn.addEventListener('click', () => {
      importModal.style.display = 'none';
    });
  }

  if (submitImportBtn) {
    submitImportBtn.addEventListener('click', async () => {
      const fileInput = document.getElementById('import-file-input');
      const textInput = document.getElementById('import-text-input');
      let textContent = textInput ? textInput.value : '';

      const processImport = async (text) => {
        if (!text || !text.trim()) {
          showToast('Please upload a file or paste MC/USDOT numbers', 'warning');
          return;
        }

        const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
        const leads = [];

        lines.forEach((line, idx) => {
          const cols = line.split(/,|;|\t/).map(c => c.trim().replace(/^"|"$/g, ''));
          if (cols.length === 1) {
            const val = cols[0];
            const isMc = /^mc-?\d+/i.test(val);
            const dot = val.replace(/[^0-9]/g, '');
            if (dot) {
              leads.push({
                usdot: dot,
                mcNumber: isMc ? (val.startsWith('MC-') ? val : `MC-${val}`) : `MC-${dot}`,
                companyName: `CARRIER USDOT ${dot}`,
                entityType: 'CARRIER',
                state: 'TX',
                crmStatus: 'New Lead'
              });
            }
          } else {
            const dot = cols[0].replace(/[^0-9]/g, '') || `8${Math.floor(10000 + Math.random() * 90000)}`;
            const companyName = cols[1] || cols[0] || `IMPORTED CARRIER ${idx + 1}`;
            const mcNumber = cols[2] || `MC-${Math.floor(100000 + Math.random() * 900000)}`;
            const phone = cols[3] || cols[4] || '';
            const email = cols[4] || cols[5] || '';
            const stateVal = cols[5] || cols[6] || 'TX';

            leads.push({
              usdot: dot,
              companyName,
              mcNumber,
              entityType: 'CARRIER',
              phone,
              email,
              state: stateVal.substring(0, 2).toUpperCase(),
              crmStatus: 'New Lead'
            });
          }
        });

        if (leads.length === 0) {
          showToast('No valid carrier numbers found', 'warning');
          return;
        }

        try {
          const res = await fetch('/api/database/import', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${state.sessionToken}` },
            body: JSON.stringify({ leads })
          });
          const data = await res.json();
          showToast(data.message || `Imported ${leads.length} leads!`, 'success');
          if (importModal) importModal.style.display = 'none';
          if (textInput) textInput.value = '';
          if (fileInput) fileInput.value = '';
          loadCarriers();
        } catch (err) {
          showToast('Error importing leads', 'error');
        }
      };

      if (fileInput && fileInput.files && fileInput.files[0]) {
        const reader = new FileReader();
        reader.onload = (e) => processImport(e.target.result);
        reader.readAsText(fileInput.files[0]);
      } else {
        processImport(textContent);
      }
    });
  }
