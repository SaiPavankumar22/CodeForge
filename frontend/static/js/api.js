// ============================================
// CODEFORGE API CLIENT
// ============================================

// Same host as the UI when served by FastAPI (e.g. Docker); fall back for file:// or tooling
const API_BASE =
  (typeof window !== 'undefined' && window.location && window.location.protocol !== 'file:')
    ? `${window.location.origin}/api`
    : 'http://localhost:8000/api';

const API = {
  // ---- AUTH ----
  async adminLogin(email, password) {
    return await _post('/auth/admin/login', { email, password });
  },

  // ---- QUESTIONS ----
  async getQuestions() {
    return await _get('/questions');
  },

  async getAllQuestionsAdmin() {
    return await _get('/questions/all', true);
  },

  async getQuestion(id) {
    return await _get(`/questions/${id}`);
  },

  async createQuestion(data) {
    return await _post('/questions', data, true);
  },

  async updateQuestion(id, data) {
    return await _put(`/questions/${id}`, data, true);
  },

  async deleteQuestion(id) {
    return await _delete(`/questions/${id}`, true);
  },

  // ---- CODE ----
  async runCode(questionId, language, code) {
    return await _post('/code/run', { question_id: questionId, language, code });
  },

  async submitCode(questionId, language, code, userIdentifier = 'anonymous') {
    return await _post('/code/submit', {
      question_id: questionId,
      language,
      code,
      user_identifier: userIdentifier
    });
  },

  async getSubmissions(questionId) {
    return await _get(`/code/submissions/${questionId}`);
  },
};

// ---- Internal helpers ----

async function _get(path, auth = false) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: _headers(auth),
  });
  return _handle(res);
}

async function _post(path, body, auth = false) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ..._headers(auth) },
    body: JSON.stringify(body),
  });
  return _handle(res);
}

async function _put(path, body, auth = false) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ..._headers(auth) },
    body: JSON.stringify(body),
  });
  return _handle(res);
}

async function _delete(path, auth = false) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'DELETE',
    headers: _headers(auth),
  });
  return _handle(res);
}

function _headers(auth = false) {
  const h = {};
  if (auth) {
    const token = localStorage.getItem('cf_admin_token');
    if (token) h['Authorization'] = `Bearer ${token}`;
  }
  return h;
}

async function _handle(res) {
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const err = await res.json();
      msg = err.detail || msg;
    } catch {}
    throw new Error(msg);
  }
  return res.json();
}

// Auth helpers
const Auth = {
  isAdmin() {
    return !!localStorage.getItem('cf_admin_token');
  },
  setToken(token) {
    localStorage.setItem('cf_admin_token', token);
  },
  clearToken() {
    localStorage.removeItem('cf_admin_token');
  },
  requireAdmin() {
    if (!this.isAdmin()) {
      window.location.href = 'index.html';
    }
  }
};
