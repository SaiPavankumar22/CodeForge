// ============================================
// ADMIN PANEL
// ============================================

let editingQuestionId = null;
let testCases = [];
let allQuestions = [];

document.addEventListener('DOMContentLoaded', () => {
  // Redirect if not admin
  Auth.requireAdmin();

  initSidebar();
  loadQuestions();

  // Buttons
  document.getElementById('logoutBtn').addEventListener('click', () => {
    Auth.clearToken();
    window.location.href = 'index.html';
  });

  document.getElementById('createNewBtn').addEventListener('click', () => showCreateForm());
  document.getElementById('cancelFormBtn').addEventListener('click', showQuestionsList);
  document.getElementById('cancelFormBtn2').addEventListener('click', showQuestionsList);
  document.getElementById('saveProblemBtn').addEventListener('click', saveProblem);

  document.getElementById('addPublicTC').addEventListener('click', () => addTestCase(true));
  document.getElementById('addPrivateTC').addEventListener('click', () => addTestCase(false));

  // Starter code tabs
  document.querySelectorAll('.stab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.stab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      document.querySelectorAll('.starter-editors textarea').forEach(t => t.classList.add('hidden'));
      document.getElementById(`starter-${tab.dataset.lang}`).classList.remove('hidden');
    });
  });
});

// ---- Sidebar Navigation ----
function initSidebar() {
  document.querySelectorAll('.sidebar-item').forEach(item => {
    item.addEventListener('click', () => {
      document.querySelectorAll('.sidebar-item').forEach(i => i.classList.remove('active'));
      item.classList.add('active');
      const section = item.dataset.section;
      if (section === 'create') {
        showCreateForm();
      } else {
        showQuestionsList();
      }
    });
  });
}

// ---- Load Questions ----
async function loadQuestions() {
  const tbody = document.getElementById('questionsTableBody');
  try {
    allQuestions = await API.getAllQuestionsAdmin();
    if (!allQuestions.length) {
      tbody.innerHTML = `<tr><td colspan="7" class="table-loading">No problems yet. <a href="#" onclick="showCreateForm();return false;" style="color:var(--accent)">Create one!</a></td></tr>`;
      return;
    }

    tbody.innerHTML = allQuestions.map((q, i) => `
      <tr>
        <td class="table-num">${i + 1}</td>
        <td class="table-title">${escHtml(q.title)}</td>
        <td><span class="diff-badge ${q.difficulty}">${q.difficulty}</span></td>
        <td>${(q.tags || []).slice(0, 3).map(t => `<span class="tag-chip">${escHtml(t)}</span>`).join(' ')}</td>
        <td style="color:var(--text-muted)">${q.total_submissions || 0}</td>
        <td><span class="status-badge ${q.is_active ? 'active' : 'inactive'}">${q.is_active ? 'Active' : 'Hidden'}</span></td>
        <td>
          <div class="table-actions">
            <button class="table-btn edit" onclick="editQuestion('${q.id}')">Edit</button>
            <button class="table-btn toggle-${q.is_active ? 'on' : 'off'}" onclick="toggleQuestion('${q.id}', ${!q.is_active})">${q.is_active ? 'Hide' : 'Show'}</button>
            <button class="table-btn delete" onclick="deleteQuestion('${q.id}', '${escHtml(q.title)}')">Delete</button>
          </div>
        </td>
      </tr>
    `).join('');
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="7" class="table-loading" style="color:var(--accent-red)">Error: ${escHtml(e.message)}</td></tr>`;
  }
}

// ---- Section Switching ----
function showQuestionsList() {
  document.getElementById('section-questions').classList.remove('hidden');
  document.getElementById('section-questions').classList.add('active');
  document.getElementById('section-create').classList.remove('active');
  document.getElementById('section-create').classList.add('hidden');
  loadQuestions();

  document.querySelectorAll('.sidebar-item').forEach(i => i.classList.remove('active'));
  document.querySelector('[data-section="questions"]').classList.add('active');
}

function showCreateForm(questionData = null) {
  editingQuestionId = questionData ? questionData.id : null;
  testCases = [];

  document.getElementById('section-questions').classList.remove('active');
  document.getElementById('section-questions').classList.add('hidden');
  document.getElementById('section-create').classList.remove('hidden');
  document.getElementById('section-create').classList.add('active');
  document.getElementById('formTitle').textContent = editingQuestionId ? 'Edit Problem' : 'Create New Problem';
  document.getElementById('saveBtnText').textContent = editingQuestionId ? 'Save Changes' : 'Create Problem';

  document.querySelectorAll('.sidebar-item').forEach(i => i.classList.remove('active'));
  document.querySelector('[data-section="create"]').classList.add('active');

  if (questionData) {
    populateForm(questionData);
  } else {
    resetForm();
  }
}

function resetForm() {
  document.getElementById('fTitle').value = '';
  document.getElementById('fDifficulty').value = 'Medium';
  document.getElementById('fTags').value = '';
  document.getElementById('fTimeLimit').value = '5';
  document.getElementById('fMemoryLimit').value = '256';
  document.getElementById('fDescription').value = '';
  document.getElementById('fConstraints').value = '';
  document.getElementById('fSampleInput').value = '';
  document.getElementById('fSampleOutput').value = '';
  ['python', 'javascript', 'java', 'cpp'].forEach(lang => {
    document.getElementById(`starter-${lang}`).value = '';
  });
  testCases = [];
  renderTestCasesForm();
}

function populateForm(q) {
  document.getElementById('fTitle').value = q.title || '';
  document.getElementById('fDifficulty').value = q.difficulty || 'Medium';
  document.getElementById('fTags').value = (q.tags || []).join(', ');
  document.getElementById('fTimeLimit').value = q.time_limit_seconds || 5;
  document.getElementById('fMemoryLimit').value = q.memory_limit_mb || 256;
  document.getElementById('fDescription').value = q.description || '';
  document.getElementById('fConstraints').value = q.constraints || '';
  document.getElementById('fSampleInput').value = q.sample_input || '';
  document.getElementById('fSampleOutput').value = q.sample_output || '';

  if (q.starter_code) {
    ['python', 'javascript', 'java', 'cpp'].forEach(lang => {
      document.getElementById(`starter-${lang}`).value = q.starter_code[lang] || '';
    });
  }

  // For edit: we need all test cases — fetch full question data
  if (q.public_test_cases) {
    testCases = q.public_test_cases.map(tc => ({ ...tc }));
  }
  renderTestCasesForm();
}

// ---- Test Cases ----
function addTestCase(isPublic) {
  testCases.push({ input: '', expected_output: '', is_public: isPublic, description: '' });
  renderTestCasesForm();
}

function renderTestCasesForm() {
  const list = document.getElementById('testCasesFormList');
  const noMsg = document.getElementById('noTCMsg');

  if (testCases.length === 0) {
    list.innerHTML = `<p class="muted-text" id="noTCMsg">No test cases added yet. Click + Public or + Private to add.</p>`;
    return;
  }

  list.innerHTML = testCases.map((tc, i) => `
    <div class="tc-form-item" id="tc-item-${i}">
      <div class="tc-form-header">
        <span class="tc-form-label">${tc.is_public ? '🔓 Public' : '🔒 Private'} Test Case ${i + 1}</span>
        <div style="display:flex;align-items:center;gap:.75rem">
          <label class="tc-visibility">
            <input type="checkbox" ${tc.is_public ? 'checked' : ''} onchange="toggleTCVisibility(${i}, this.checked)">
            Public
          </label>
          <button class="tc-form-remove" onclick="removeTestCase(${i})">✕ Remove</button>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group flex-1">
          <label>Input</label>
          <textarea class="form-textarea mono" rows="3" placeholder="Input for this test case" 
            onchange="updateTC(${i}, 'input', this.value)">${escHtml(tc.input)}</textarea>
        </div>
        <div class="form-group flex-1">
          <label>Expected Output</label>
          <textarea class="form-textarea mono" rows="3" placeholder="Expected output"
            onchange="updateTC(${i}, 'expected_output', this.value)">${escHtml(tc.expected_output)}</textarea>
        </div>
      </div>
    </div>
  `).join('');
}

function updateTC(idx, field, value) {
  if (testCases[idx]) testCases[idx][field] = value;
}

function toggleTCVisibility(idx, isPublic) {
  if (testCases[idx]) testCases[idx].is_public = isPublic;
}

function removeTestCase(idx) {
  testCases.splice(idx, 1);
  renderTestCasesForm();
}

// ---- Save Problem ----
async function saveProblem() {
  const btn = document.getElementById('saveProblemBtn');
  const title = document.getElementById('fTitle').value.trim();

  if (!title) { showAlert('Title is required'); return; }
  if (!document.getElementById('fDescription').value.trim()) { showAlert('Description is required'); return; }

  // Collect starter code
  const starterCode = {};
  ['python', 'javascript', 'java', 'cpp'].forEach(lang => {
    const val = document.getElementById(`starter-${lang}`).value.trim();
    if (val) starterCode[lang] = val;
  });

  // Collect current test case values from DOM
  testCases.forEach((tc, i) => {
    const item = document.getElementById(`tc-item-${i}`);
    if (item) {
      const textareas = item.querySelectorAll('textarea');
      if (textareas[0]) tc.input = textareas[0].value;
      if (textareas[1]) tc.expected_output = textareas[1].value;
    }
  });

  const data = {
    title,
    difficulty: document.getElementById('fDifficulty').value,
    tags: document.getElementById('fTags').value.split(',').map(t => t.trim()).filter(Boolean),
    time_limit_seconds: parseInt(document.getElementById('fTimeLimit').value) || 5,
    memory_limit_mb: parseInt(document.getElementById('fMemoryLimit').value) || 256,
    description: document.getElementById('fDescription').value.trim(),
    constraints: document.getElementById('fConstraints').value.trim(),
    sample_input: document.getElementById('fSampleInput').value.trim(),
    sample_output: document.getElementById('fSampleOutput').value.trim(),
    starter_code: starterCode,
    test_cases: testCases,
  };

  btn.disabled = true;
  document.getElementById('saveBtnText').textContent = editingQuestionId ? 'Saving...' : 'Creating...';

  try {
    if (editingQuestionId) {
      await API.updateQuestion(editingQuestionId, data);
      showAlert('Problem updated successfully!', 'success');
    } else {
      await API.createQuestion(data);
      showAlert('Problem created successfully!', 'success');
    }
    setTimeout(showQuestionsList, 1000);
  } catch (e) {
    showAlert(`Error: ${e.message}`, 'error');
  } finally {
    btn.disabled = false;
    document.getElementById('saveBtnText').textContent = editingQuestionId ? 'Save Changes' : 'Create Problem';
  }
}

// ---- Edit / Delete / Toggle ----
async function editQuestion(id) {
  try {
    const q = await API.getQuestion(id);
    showCreateForm(q);
    editingQuestionId = id;
  } catch (e) {
    showAlert(`Error loading question: ${e.message}`, 'error');
  }
}

async function deleteQuestion(id, title) {
  if (!confirm(`Delete "${title}"? This cannot be undone.`)) return;
  try {
    await API.deleteQuestion(id);
    loadQuestions();
  } catch (e) {
    showAlert(`Error: ${e.message}`, 'error');
  }
}

async function toggleQuestion(id, active) {
  try {
    await API.updateQuestion(id, { is_active: active });
    loadQuestions();
  } catch (e) {
    showAlert(`Error: ${e.message}`, 'error');
  }
}

// ---- Helpers ----
function showAlert(msg, type = 'error') {
  const el = document.createElement('div');
  el.textContent = msg;
  const color = type === 'success' ? 'var(--accent-green)' : type === 'error' ? 'var(--accent-red)' : 'var(--accent)';
  el.style.cssText = `
    position:fixed;bottom:2rem;right:2rem;z-index:999;
    background:${color};color:white;
    padding:.75rem 1.5rem;border-radius:8px;font-size:.875rem;
    box-shadow:0 8px 24px rgba(0,0,0,.4);
    animation:slide-up .2s ease;
  `;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

function escHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
