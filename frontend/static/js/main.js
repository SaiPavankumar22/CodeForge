// ============================================
// MAIN PAGE — Problem List
// ============================================

let allProblems = [];
let currentFilter = 'all';

// ---- Init ----
document.addEventListener('DOMContentLoaded', async () => {
  initAdminModal();
  await loadProblems();

  document.getElementById('searchInput').addEventListener('input', renderProblems);
  document.querySelectorAll('.pill').forEach(pill => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('.pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      currentFilter = pill.dataset.filter;
      renderProblems();
    });
  });
});

async function loadProblems() {
  try {
    allProblems = await API.getQuestions();
    renderProblems();

    // Update stats
    const totalSubs = allProblems.reduce((s, p) => s + (p.total_submissions || 0), 0);
    document.getElementById('totalProblems').textContent = allProblems.length;
    document.getElementById('totalSubmissions').textContent = totalSubs.toLocaleString();
  } catch (e) {
    document.getElementById('loadingState').innerHTML = `
      <div style="color: var(--accent-red); padding: 2rem; text-align:center;">
        <div style="font-size:1.5rem;margin-bottom:.5rem;">⚠️</div>
        <p>Could not load problems. Is the backend running?</p>
        <p style="font-size:0.8rem;color:var(--text-muted);margin-top:.5rem;">${e.message}</p>
      </div>
    `;
  }
}

function renderProblems() {
  const query = document.getElementById('searchInput').value.toLowerCase();
  const grid = document.getElementById('problemsGrid');
  const loadState = document.getElementById('loadingState');
  const emptyState = document.getElementById('emptyState');

  loadState.classList.add('hidden');

  let filtered = allProblems.filter(p => {
    const matchSearch = !query ||
      p.title.toLowerCase().includes(query) ||
      (p.tags || []).some(t => t.toLowerCase().includes(query));
    const matchDiff = currentFilter === 'all' || p.difficulty === currentFilter;
    return matchSearch && matchDiff;
  });

  if (filtered.length === 0) {
    grid.innerHTML = '';
    emptyState.classList.remove('hidden');
    return;
  }

  emptyState.classList.add('hidden');

  grid.innerHTML = filtered.map((p, idx) => {
    const acc = p.total_submissions > 0
      ? Math.round((p.accepted_submissions / p.total_submissions) * 100)
      : null;

    return `
      <a href="problem.html?id=${p.id}" class="problem-card">
        <div class="problem-num">${idx + 1}</div>
        <div class="problem-info">
          <div class="problem-name">${escHtml(p.title)}</div>
          ${p.tags && p.tags.length ? `
            <div class="problem-tags-row">
              ${p.tags.slice(0, 4).map(t => `<span class="tag-chip">${escHtml(t)}</span>`).join('')}
            </div>
          ` : ''}
        </div>
        <div class="problem-meta-right">
          <span class="diff-badge ${p.difficulty}">${p.difficulty}</span>
          ${acc !== null ? `<span class="acceptance-rate">${acc}% accepted</span>` : ''}
        </div>
      </a>
    `;
  }).join('');
}

// ---- Admin Modal ----
function initAdminModal() {
  const modal = document.getElementById('adminModal');
  const openBtn = document.getElementById('adminNavBtn');
  const closeBtn = document.getElementById('closeModal');

  openBtn.addEventListener('click', (e) => {
    e.preventDefault();
    if (Auth.isAdmin()) {
      window.location.href = 'admin.html';
    } else {
      modal.classList.remove('hidden');
    }
  });

  closeBtn.addEventListener('click', () => modal.classList.add('hidden'));
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.classList.add('hidden');
  });

  document.getElementById('loginBtn').addEventListener('click', handleLogin);
  document.getElementById('adminPassword').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleLogin();
  });
}

async function handleLogin() {
  const email = document.getElementById('adminEmail').value.trim();
  const password = document.getElementById('adminPassword').value;
  const errEl = document.getElementById('loginError');
  const btn = document.getElementById('loginBtn');

  errEl.classList.add('hidden');
  btn.textContent = 'Signing in...';
  btn.disabled = true;

  try {
    const resp = await API.adminLogin(email, password);
    Auth.setToken(resp.token);
    window.location.href = 'admin.html';
  } catch (e) {
    errEl.textContent = 'Invalid email or password';
    errEl.classList.remove('hidden');
    btn.textContent = 'Sign In';
    btn.disabled = false;
  }
}

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
