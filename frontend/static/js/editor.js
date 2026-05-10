// ============================================
// EDITOR PAGE — Problem Solving
// ============================================

let monacoEditor = null;
let questionData = null;
let questionId = null;
let timerInterval = null;
let timerSeconds = 0;
/** Keeps a separate buffer per language so switching the dropdown shows the right starter (from DB or defaults). */
let codeByLang = {};
let editorLang = 'python';

const STARTER_CODE = {
  python: `# Read input and write your solution below
import sys
input = sys.stdin.readline

def solve():
    pass

solve()`,
  javascript: `const fs = require('fs');
// stdin works on Windows and Unix (fd 0)
const input = fs.readFileSync(0, 'utf8');

// Write your solution below

`,
  java: `import java.util.*;
import java.io.*;

public class Solution {
    public static void main(String[] args) throws IOException {
        BufferedReader br = new BufferedReader(new InputStreamReader(System.in));
        // Write your solution below
        
    }
}`,
  cpp: `#include <bits/stdc++.h>
using namespace std;

int main() {
    ios_base::sync_with_stdio(false);
    cin.tie(NULL);
    
    // Write your solution below
    
    return 0;
}`
};

const LANG_LABELS = {
  python: 'Python 3',
  javascript: 'JavaScript',
  java: 'Java',
  cpp: 'C++'
};

const MONACO_LANG_MAP = {
  python: 'python',
  javascript: 'javascript',
  java: 'java',
  cpp: 'cpp'
};

// ---- Init ----
document.addEventListener('DOMContentLoaded', async () => {
  const params = new URLSearchParams(window.location.search);
  questionId = params.get('id');

  if (!questionId) {
    window.location.href = 'index.html';
    return;
  }

  startTimer();
  await loadQuestion();
  initTabs();
  initOutputTabs();
  initResizeHandle();
  initSubmitModal();

  document.getElementById('runBtn').addEventListener('click', runCode);
  document.getElementById('submitBtn').addEventListener('click', submitCode);
  document.getElementById('resetBtn').addEventListener('click', resetCode);
  document.getElementById('fullscreenBtn').addEventListener('click', toggleFullscreen);
  document.getElementById('langSelect').addEventListener('change', onLangChange);
});

// ---- Load Question ----
async function loadQuestion() {
  try {
    questionData = await API.getQuestion(questionId);
    renderQuestion();
    initMonaco();
    loadSubmissions();
  } catch (e) {
    document.getElementById('problemBody').innerHTML = `
      <p style="color:var(--accent-red)">Failed to load question: ${e.message}</p>
    `;
  }
}

function renderQuestion() {
  document.title = `${questionData.title} — CodeForge`;
  document.getElementById('problemTitle').textContent = questionData.title;

  // Diff badge
  const badge = document.getElementById('diffBadge');
  badge.textContent = questionData.difficulty;
  badge.className = `diff-badge ${questionData.difficulty}`;

  // Tags
  const tagsEl = document.getElementById('problemTags');
  tagsEl.innerHTML = (questionData.tags || []).map(t =>
    `<span class="tag-chip">${escHtml(t)}</span>`
  ).join('');

  // Body
  const body = document.getElementById('problemBody');
  body.innerHTML = `
    <h1>${escHtml(questionData.title)}</h1>
    <div class="problem-description">${renderMarkdown(questionData.description)}</div>

    <div class="problem-section">
      <div class="problem-section-title">Example</div>
      <div class="example-block">
        <div class="example-row">
          <div class="example-cell">
            <div class="example-cell-label">Input</div>
            <pre>${escHtml(questionData.sample_input)}</pre>
          </div>
          <div class="example-cell">
            <div class="example-cell-label">Output</div>
            <pre>${escHtml(questionData.sample_output)}</pre>
          </div>
        </div>
      </div>
    </div>

    ${questionData.constraints ? `
    <div class="problem-section">
      <div class="problem-section-title">Constraints</div>
      <div class="constraints-block">${escHtml(questionData.constraints)}</div>
    </div>
    ` : ''}

    ${(questionData.public_test_cases || []).length > 0 ? `
    <div class="problem-section">
      <div class="problem-section-title">Test Cases (${questionData.public_test_cases.length} public)</div>
      ${questionData.public_test_cases.map((tc, i) => `
        <div class="example-block">
          <div class="example-row">
            <div class="example-cell">
              <div class="example-cell-label">Case ${i+1} Input</div>
              <pre>${escHtml(tc.input)}</pre>
            </div>
            <div class="example-cell">
              <div class="example-cell-label">Expected Output</div>
              <pre>${escHtml(tc.expected_output)}</pre>
            </div>
          </div>
        </div>
      `).join('')}
    </div>
    ` : ''}
  `;
}

// ---- Monaco Editor ----
function seedCodeBuffers() {
  ['python', 'javascript', 'java', 'cpp'].forEach((l) => {
    codeByLang[l] = getStarterCode(l);
  });
}

function initMonaco() {
  seedCodeBuffers();
  const lang = document.getElementById('langSelect').value;
  editorLang = lang;

  require(['vs/editor/editor.main'], function () {
    // Define custom dark theme
    monaco.editor.defineTheme('codeforge-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '44485a', fontStyle: 'italic' },
        { token: 'keyword', foreground: '7c6af7', fontStyle: 'bold' },
        { token: 'string', foreground: '22d3a8' },
        { token: 'number', foreground: 'f5c842' },
        { token: 'type', foreground: '4a9eff' },
        { token: 'function', foreground: 'e8e8f0' },
        { token: 'variable', foreground: 'a8b4d8' },
        { token: 'delimiter', foreground: '5a5a7a' },
      ],
      colors: {
        'editor.background': '#0a0a0f',
        'editor.foreground': '#e8e8f0',
        'editor.lineHighlightBackground': '#13131a',
        'editor.selectionBackground': '#7c6af733',
        'editorLineNumber.foreground': '#44445a',
        'editorLineNumber.activeForeground': '#8888aa',
        'editorCursor.foreground': '#7c6af7',
        'editor.inactiveSelectionBackground': '#7c6af720',
        'editorIndentGuide.background': '#1e1e2a',
        'editorIndentGuide.activeBackground': '#44445a',
        'scrollbarSlider.background': '#1e1e2a',
        'scrollbarSlider.hoverBackground': '#2a2a3a',
      }
    });

    monacoEditor = monaco.editor.create(document.getElementById('monaco-editor'), {
      value: codeByLang[lang] ?? getStarterCode(lang),
      language: MONACO_LANG_MAP[lang],
      theme: 'codeforge-dark',
      fontFamily: '"JetBrains Mono", "Fira Code", monospace',
      fontSize: 14,
      fontLigatures: true,
      lineHeight: 22,
      tabSize: 4,
      insertSpaces: true,
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      padding: { top: 16, bottom: 16 },
      smoothScrolling: true,
      cursorBlinking: 'smooth',
      cursorSmoothCaretAnimation: 'on',
      renderWhitespace: 'selection',
      bracketPairColorization: { enabled: true },
      suggest: { showKeywords: true },
      quickSuggestions: true,
      wordWrap: 'off',
      scrollbar: {
        useShadows: false,
        verticalScrollbarSize: 6,
        horizontalScrollbarSize: 6,
      }
    });

    // Responsive resize
    window.addEventListener('resize', () => monacoEditor.layout());
  });
}

function getStarterCode(lang) {
  const fromApi = questionData?.starter_code?.[lang];
  if (fromApi != null && String(fromApi).trim() !== '') {
    return String(fromApi);
  }
  return STARTER_CODE[lang] || '';
}

function onLangChange() {
  const lang = document.getElementById('langSelect').value;
  document.getElementById('editorLangLabel').textContent = LANG_LABELS[lang];

  if (monacoEditor) {
    codeByLang[editorLang] = monacoEditor.getValue();
    const model = monacoEditor.getModel();
    monaco.editor.setModelLanguage(model, MONACO_LANG_MAP[lang]);
    monacoEditor.setValue(codeByLang[lang] ?? getStarterCode(lang));
    editorLang = lang;
  }
}

// ---- Run Code ----
async function runCode() {
  const btn = document.getElementById('runBtn');
  const lang = document.getElementById('langSelect').value;
  const code = monacoEditor ? monacoEditor.getValue() : '';

  if (!code.trim()) {
    showToast('Write some code first!', 'error');
    return;
  }

  btn.classList.add('loading');
  btn.disabled = true;
  btn.innerHTML = `<div class="spinner" style="width:12px;height:12px;border-width:1.5px"></div> Running...`;

  // Switch to output
  switchOTab('testcases');
  document.getElementById('testCasesList').innerHTML = `
    <div style="display:flex;align-items:center;gap:.75rem;color:var(--text-muted);font-size:.85rem;padding:1rem 0">
      <div class="spinner" style="width:16px;height:16px;"></div>
      <span>Executing your code...</span>
    </div>
  `;

  try {
    const result = await API.runCode(questionId, lang, code);
    renderRunResults(result);
  } catch (e) {
    document.getElementById('testCasesList').innerHTML = `
      <div style="color:var(--accent-red);font-size:.85rem;padding:1rem 0">
        Error: ${escHtml(e.message)}
      </div>
    `;
  } finally {
    btn.classList.remove('loading');
    btn.disabled = false;
    btn.innerHTML = `<svg viewBox="0 0 16 16" fill="none"><path d="M5 3l9 5-9 5V3z" fill="currentColor"/></svg> Run`;
  }
}

function renderRunResults(result) {
  const container = document.getElementById('testCasesList');
  const outputEl = document.getElementById('outputResult');

  if (!result.test_results || result.test_results.length === 0) {
    container.innerHTML = `<p class="muted-text">No test cases available.</p>`;
    return;
  }

  // Summary line
  const passed = result.passed_tests;
  const total = result.total_tests;
  const allPass = passed === total;

  const summaryColor = allPass ? 'var(--accent-green)' : 'var(--accent-red)';

  container.innerHTML = `
    <div style="margin-bottom:.75rem;padding:.6rem .9rem;background:var(--bg-elevated);border-radius:var(--radius-sm);border:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;">
      <span style="font-weight:600;color:${summaryColor}">${getStatusIcon(result.status)} ${result.status}</span>
      <span style="font-size:.78rem;color:var(--text-muted)">${passed}/${total} passed · ${result.execution_time_ms.toFixed(0)}ms</span>
    </div>
    <div class="test-results-wrap" id="tcResultsWrap"></div>
  `;

  const wrap = document.getElementById('tcResultsWrap');
  result.test_results.forEach((tc, idx) => {
    const cls = tc.passed ? 'pass' : (
      tc.status === 'Runtime Error' || tc.status === 'Compilation Error' ? 'error' :
      tc.status === 'Time Limit Exceeded' ? 'tle' : 'fail'
    );
    const item = document.createElement('div');
    item.className = `test-result-item ${cls}`;
    item.innerHTML = `
      <div class="tc-status-dot"></div>
      <span class="tc-label">Test Case ${tc.test_case_number}</span>
      <span class="tc-status-text">${tc.status}</span>
      <span class="tc-time">${tc.execution_time_ms.toFixed(1)}ms</span>
    `;

    const detail = document.createElement('div');
    detail.className = 'tc-detail';
    detail.innerHTML = `
      <div class="tc-detail-row"><span class="tc-detail-label">Input</span><span class="tc-detail-val">${escHtml(tc.input)}</span></div>
      <div class="tc-detail-row"><span class="tc-detail-label">Expected</span><span class="tc-detail-val">${escHtml(tc.expected_output)}</span></div>
      <div class="tc-detail-row"><span class="tc-detail-label">Got</span><span class="tc-detail-val" style="color:${tc.passed ? 'var(--accent-green)' : 'var(--accent-red)'}">${escHtml(tc.actual_output)}</span></div>
    `;

    item.addEventListener('click', () => {
      detail.classList.toggle('open');
    });

    wrap.appendChild(item);
    wrap.appendChild(detail);
  });

  // Build output tab content
  const errorTc = result.test_results.find(r => r.status === 'Runtime Error' || r.status === 'Compilation Error');
  outputEl.innerHTML = `
    <div class="status-line ${getStatusClass(result.status)}">${getStatusIcon(result.status)} ${result.status}</div>
    ${errorTc ? `<pre class="output-pre" style="color:var(--accent-red)">${escHtml(errorTc.actual_output)}</pre>` : ''}
    ${result.test_results.map(r => r.passed ? '' : `
      <div style="margin:.5rem 0;font-size:.78rem;color:var(--text-muted)">Case ${r.test_case_number}: Got → <code style="color:var(--accent-red)">${escHtml(r.actual_output.slice(0,200))}</code></div>
    `).join('')}
  `;
}

// ---- Submit Code ----
async function submitCode() {
  const btn = document.getElementById('submitBtn');
  const lang = document.getElementById('langSelect').value;
  const code = monacoEditor ? monacoEditor.getValue() : '';

  if (!code.trim()) {
    showToast('Write some code first!', 'error');
    return;
  }

  btn.classList.add('loading');
  btn.disabled = true;
  btn.innerHTML = `<div class="spinner" style="width:12px;height:12px;border-width:1.5px;border-color:white;border-top-color:transparent"></div> Submitting...`;

  try {
    const result = await API.submitCode(questionId, lang, code);
    showSubmitResult(result);
    loadSubmissions(); // refresh
  } catch (e) {
    showToast(`Submission failed: ${e.message}`, 'error');
  } finally {
    btn.classList.remove('loading');
    btn.disabled = false;
    btn.innerHTML = `<svg viewBox="0 0 16 16" fill="none"><path d="M2 8h10M9 5l3 3-3 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg> Submit`;
  }
}

function showSubmitResult(result) {
  const modal = document.getElementById('submitModal');
  const header = document.getElementById('resultHeader');
  const icon = document.getElementById('resultIcon');
  const title = document.getElementById('resultTitle');
  const subtitle = document.getElementById('resultSubtitle');

  const isAccepted = result.status === 'Accepted';
  const statusClass = isAccepted ? 'accepted' : (
    result.status.includes('Runtime') || result.status.includes('Compilation') ? 'error' : 'wrong'
  );

  header.className = `result-header ${statusClass}`;
  icon.textContent = isAccepted ? '🎉' : (statusClass === 'error' ? '⚠️' : '✗');
  title.textContent = result.status;
  subtitle.textContent = isAccepted
    ? 'Your solution passed all test cases!'
    : `${result.passed_tests} of ${result.total_tests} test cases passed`;

  document.getElementById('rsScore').textContent = `${result.score}%`;
  document.getElementById('rsTests').textContent = `${result.passed_tests}/${result.total_tests}`;
  document.getElementById('rsRuntime').textContent = `${result.execution_time_ms.toFixed(0)}ms`;

  modal.classList.remove('hidden');
}

// ---- Submissions ----
async function loadSubmissions() {
  try {
    const subs = await API.getSubmissions(questionId);
    const list = document.getElementById('submissionsList');

    if (!subs || subs.length === 0) {
      list.innerHTML = `<p class="muted-text">No submissions yet.</p>`;
      return;
    }

    list.innerHTML = subs.map(s => `
      <div class="sub-item">
        <div>
          <div class="sub-status ${s.status}">${s.status}</div>
          <div class="sub-meta">${s.language} · Score: ${s.score}% · ${s.passed_tests}/${s.total_tests} passed</div>
        </div>
        <div class="sub-meta">${formatDate(s.submitted_at)}</div>
      </div>
    `).join('');
  } catch {}
}

// ---- Tabs ----
function initTabs() {
  document.querySelectorAll('.ptab').forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.tab;
      document.querySelectorAll('.ptab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
      tab.classList.add('active');
      document.getElementById(`tab-${target}`).classList.remove('hidden');

      if (target === 'submissions') loadSubmissions();
    });
  });
}

function initOutputTabs() {
  document.querySelectorAll('.otab').forEach(tab => {
    tab.addEventListener('click', () => switchOTab(tab.dataset.otab));
  });
}

function switchOTab(name) {
  document.querySelectorAll('.otab').forEach(t => {
    t.classList.toggle('active', t.dataset.otab === name);
  });
  document.querySelectorAll('.otab-content').forEach(c => c.classList.add('hidden'));
  document.getElementById(`otab-${name}`)?.classList.remove('hidden');
}

// ---- Resize Handle ----
function initResizeHandle() {
  const handle = document.getElementById('resizeHandle');
  const left = document.getElementById('leftPanel');
  const layout = document.querySelector('.editor-layout');
  let isDragging = false;
  let startX, startWidth;

  handle.addEventListener('mousedown', (e) => {
    isDragging = true;
    startX = e.clientX;
    startWidth = left.offsetWidth;
    handle.classList.add('active');
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';
  });

  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const dx = e.clientX - startX;
    const newWidth = Math.max(280, Math.min(startWidth + dx, layout.offsetWidth - 400));
    left.style.width = newWidth + 'px';
    if (monacoEditor) monacoEditor.layout();
  });

  document.addEventListener('mouseup', () => {
    if (!isDragging) return;
    isDragging = false;
    handle.classList.remove('active');
    document.body.style.userSelect = '';
    document.body.style.cursor = '';
    if (monacoEditor) monacoEditor.layout();
  });
}

// ---- Submit Modal ----
function initSubmitModal() {
  document.getElementById('closeSubmitModal').addEventListener('click', () => {
    document.getElementById('submitModal').classList.add('hidden');
  });
  document.getElementById('backToListBtn').addEventListener('click', () => {
    window.location.href = 'index.html';
  });
  document.getElementById('tryAgainBtn').addEventListener('click', () => {
    document.getElementById('submitModal').classList.add('hidden');
  });
}

// ---- Timer ----
function startTimer() {
  timerInterval = setInterval(() => {
    timerSeconds++;
    const m = String(Math.floor(timerSeconds / 60)).padStart(2, '0');
    const s = String(timerSeconds % 60).padStart(2, '0');
    document.getElementById('timerText').textContent = `${m}:${s}`;
  }, 1000);
}

// ---- Misc ----
function resetCode() {
  const lang = document.getElementById('langSelect').value;
  const fresh = getStarterCode(lang);
  codeByLang[lang] = fresh;
  if (monacoEditor) {
    monacoEditor.setValue(fresh);
  }
}

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen();
  } else {
    document.exitFullscreen();
  }
}

function getStatusClass(status) {
  const map = {
    'Accepted': 'accepted',
    'Wrong Answer': 'wrong',
    'Runtime Error': 'error',
    'Compilation Error': 'error',
    'Time Limit Exceeded': 'tle',
  };
  return map[status] || 'wrong';
}

function getStatusIcon(status) {
  const map = {
    'Accepted': '✓',
    'Wrong Answer': '✗',
    'Runtime Error': '⚠',
    'Compilation Error': '⚠',
    'Time Limit Exceeded': '⏱',
  };
  return map[status] || '?';
}

function renderMarkdown(text) {
  // Very simple markdown: bold, code, line breaks
  return escHtml(text)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>')
    .replace(/^/, '<p>')
    .replace(/$/, '</p>');
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function escHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function showToast(msg, type = 'info') {
  const t = document.createElement('div');
  t.textContent = msg;
  t.style.cssText = `
    position:fixed;bottom:2rem;right:2rem;z-index:999;
    background:${type === 'error' ? 'var(--accent-red)' : 'var(--accent)'};
    color:white;padding:.75rem 1.25rem;border-radius:8px;font-size:.85rem;
    animation:slide-up .2s ease;box-shadow:0 8px 24px rgba(0,0,0,.4);
  `;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3000);
}
