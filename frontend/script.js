/**
 * Result Flow — Student Result Portal Script
 * Author: Anushka Yadav
 * Cloud Computing Project — B.Tech CSE
 * (Original logic kept; markup updated for the new theme)
 */

const LOAD_BALANCERS = [
  { id: 'LB-1', url: 'http://localhost:4001' },
  { id: 'LB-2', url: 'http://localhost:4002' },
];

let activeLBs = [];
let lbIndex   = 0;

// ── Load balancer health check ────────────────────────────────────────────────
async function checkLBHealth() {
  const statusBar = document.getElementById('statusBar');
  const btn       = document.getElementById('getResultBtn');
  activeLBs = [];

  for (const lb of LOAD_BALANCERS) {
    try {
      const res = await fetch(`${lb.url}/health`, { signal: AbortSignal.timeout(3000) });
      if (res.ok) activeLBs.push(lb);
    } catch {
      /* unreachable — skip */
    }
  }

  if (activeLBs.length > 0) {
    statusBar.className   = 'status ok';
    statusBar.textContent = `${activeLBs.length} load balancer(s) online. Ready to serve requests.`;
    btn.disabled = false;
  } else {
    statusBar.className   = 'status error';
    statusBar.textContent = 'No load balancers reachable. Run npm start in the load-balancers folder first.';
    btn.disabled = true;
  }
}

function getNextLB() {
  if (activeLBs.length === 0) throw new Error('No load balancers available');
  const lb = activeLBs[lbIndex % activeLBs.length];
  lbIndex++;
  return lb;
}

// ── Main: fetch result ────────────────────────────────────────────────────────
async function getResult() {
  const rollNumber = document.getElementById('rollNumber').value.trim();
  const algorithm  = document.getElementById('algorithm').value;

  if (!rollNumber) {
    showError('Please enter a roll number.', 'The roll number field cannot be empty.');
    return;
  }

  const btn           = document.getElementById('getResultBtn');
  const resultSection = document.getElementById('resultSection');
  btn.disabled        = true;
  btn.innerHTML       = '<span class="loader"></span> Fetching…';
  resultSection.style.display = 'none';

  try {
    const lb = getNextLB();

    // Push selected algorithm to all active load balancers (best-effort, non-blocking)
    for (const activeLB of activeLBs) {
      fetch(`${activeLB.url}/changeAlgorithm`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ algorithm }),
      }).catch(() => {});
    }

    const start    = Date.now();
    const response = await fetch(`${lb.url}/getResult`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ rollNumber }),
    });
    const elapsed = Date.now() - start;
    const data    = await response.json();

    if (!response.ok) {
      showError(
        data.error || `Error ${response.status}`,
        `Roll number "${rollNumber.toUpperCase()}" was not found in the database.`
      );
      return;
    }

    renderResult(data, lb, algorithm, elapsed);
  } catch (err) {
    showError(
      'Connection failed.',
      'Could not reach the load balancer. Make sure all services are running.'
    );
    console.error(err);
  } finally {
    btn.disabled  = false;
    btn.innerHTML = 'Get result';
    checkLBHealth();
  }
}

// ── Render result card ────────────────────────────────────────────────────────
function renderResult(data, lb, algorithm, clientElapsed) {
  const isPass = data.status === 'Pass';

  let subjectRows = '';
  let idx = 1;
  for (const sub of data.subjects) {
    const isLow = sub.marksObtained < 40;
    subjectRows += `
      <tr>
        <td>${idx++}</td>
        <td>${sub.name}</td>
        <td style="text-align:center;">${sub.maxMarks}</td>
        <td class="${isLow ? 'low' : ''}">${sub.marksObtained}${isLow ? ' ⚠' : ''}</td>
      </tr>`;
  }

  const html = `
    <div class="result-head ${isPass ? 'pass' : 'fail'}">
      <div>
        <h3>${data.name}</h3>
        <p>Roll no. ${data.rollNumber} · ${data.course} · Semester ${data.semester}</p>
      </div>
      <div class="badge">${data.status.toUpperCase()}</div>
    </div>

    <div class="stats">
      <div class="stat s1"><div class="num">${data.total}/${data.maxTotal}</div><div class="lbl">Total marks</div></div>
      <div class="stat s0"><div class="num">${data.percentage}%</div><div class="lbl">Percentage</div></div>
      <div class="stat s2"><div class="num">${data.status}</div><div class="lbl">Result</div></div>
      <div class="stat s3"><div class="num">Sem ${data.semester}</div><div class="lbl">Semester</div></div>
    </div>

    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Subject name</th>
          <th style="text-align:center;">Max marks</th>
          <th>Marks obtained</th>
        </tr>
      </thead>
      <tbody>${subjectRows}</tbody>
      <tfoot>
        <tr>
          <td colspan="2">Total</td>
          <td style="text-align:center;">${data.maxTotal}</td>
          <td>${data.total}</td>
        </tr>
      </tfoot>
    </table>

    ${!isPass ? `
      <div class="notice">
        Subjects marked in red are below the minimum passing mark (40).
        The student must reappear in those subjects.
      </div>` : ''}

    <div class="chips">
      <span class="chip">Served by <b>${data.servedBy}</b></span>
      <span class="chip">Algorithm <b>${algorithm}</b></span>
      <span class="chip">Load balancer <b>${lb.id} (${lb.url})</b></span>
      <span class="chip">Response time <b>${clientElapsed} ms</b></span>
      <span class="chip">At <b>${new Date(data.timestamp).toLocaleTimeString()}</b></span>
    </div>`;

  const resultSection = document.getElementById('resultSection');
  resultSection.innerHTML = html;
  resultSection.style.display = 'block';
  resultSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// ── Error display ─────────────────────────────────────────────────────────────
function showError(title, detail) {
  const resultSection = document.getElementById('resultSection');
  resultSection.innerHTML = `
    <div class="error-state">
      <h3>${title}</h3>
      <p>${detail || ''}</p>
    </div>`;
  resultSection.style.display = 'block';
}

// ── Demo roll number chips ────────────────────────────────────────────────────
function buildDemoChips() {
  document.getElementById('topics').innerHTML = Array.from({ length: 15 }, (_, i) => {
    const roll = 'RF21010' + String(i + 1).padStart(2, '0');
    return `<button class="topic c${i % 4}" onclick="pickRoll('${roll}')">${roll}</button>`;
  }).join('');
}

function pickRoll(roll) {
  document.getElementById('rollNumber').value = roll;
  getResult();
}

// ── Keyboard shortcut ─────────────────────────────────────────────────────────
document.getElementById('rollNumber').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') getResult();
});

// ── Init ──────────────────────────────────────────────────────────────────────
buildDemoChips();
checkLBHealth();
setInterval(checkLBHealth, 60000); // re-check every minute