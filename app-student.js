// ============================================================
// Student Portal Logic (Fast Login + Verifying State + Direct Reset)
// ============================================================

const loginView = document.getElementById('loginView');
const dashboardView = document.getElementById('dashboardView');
const loginForm = document.getElementById('loginForm');
const loginError = document.getElementById('loginError');
const logoutBtn = document.getElementById('logoutBtn');
const dashboardContent = document.getElementById('dashboardContent');
const welcomeStudentName = document.getElementById('welcomeStudentName');
const resultSectionContent = document.getElementById('resultSectionContent');
const btnPrintReceipt = document.getElementById('btnPrintReceipt');

let loggedInStudentData = null;

// Background Persistence
auth.setPersistence(firebase.auth.Auth.Persistence.SESSION).catch(() => {});

// Helper function: Button ko har haal me "Login to Dashboard" par reset karega
function resetStudentLoginForm() {
  loginForm.reset();
  const btn = loginForm.querySelector('button');
  if (btn) {
    btn.disabled = false;
    btn.textContent = 'Login to Dashboard';
  }
}

// --- Auth State Verification ---
auth.onAuthStateChanged(async (user) => {
  loginError.textContent = '';
  if (user) {
    await loadStudentData(user.uid);
  } else {
    loggedInStudentData = null;
    dashboardView.style.display = 'none';
    loginView.style.display = 'flex';
    resetStudentLoginForm();
  }
});

// --- Login Handler ---
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  loginError.textContent = '';
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const btn = loginForm.querySelector('button');

  btn.disabled = true;
  btn.textContent = 'Verifying...';

  try {
    await auth.signInWithEmailAndPassword(email, password);
  } catch (err) {
    loginError.textContent = friendlyError(err.code) || 'Login nahi ho paya.';
  } finally {
    // Ye block HAR HAAL ME chalega taaki logout ke baad ya error aane par "Login to Dashboard" wapas aa jaye
    btn.disabled = false;
    btn.textContent = 'Login to Dashboard';
  }
});

logoutBtn.addEventListener('click', async () => {
  resetStudentLoginForm();
  await auth.signOut();
});

// --- Load Student Dashboard ---
async function loadStudentData(uid) {
  try {
    const doc = await db.collection('students').doc(uid).get();

    if (!doc.exists) {
      await auth.signOut();
      loginError.textContent = 'Yeh account Student list mein nahi hai. Kripya Student ID se login karein.';
      dashboardView.style.display = 'none';
      loginView.style.display = 'flex';
      resetStudentLoginForm();
      return;
    }

    const d = doc.data();
    loggedInStudentData = d;

    loginView.style.display = 'none';
    dashboardView.style.display = 'block';

    welcomeStudentName.textContent = d.name || 'Student';

    const total = Number(d.totalFee) || 0;
    const discount = Number(d.discount) || 0;
    const netPayable = Math.max(0, total - discount);
    const paid = Number(d.paidFee) || 0;
    const due = Math.max(0, netPayable - paid);
    const admissionDate = formatDate(d.admissionDate);

    // Ledger Rows
    dashboardContent.innerHTML = `
      <div class="info-row">
        <span>Student Name</span>
        <strong class="name-value">${escapeHtml(d.name || '-')}</strong>
      </div>
      <div class="info-row">
        <span>Admission Date</span>
        <strong>${admissionDate}</strong>
      </div>
      <div class="info-row">
        <span>Total Course Fee</span>
        <strong>₹${total.toLocaleString('en-IN')}</strong>
      </div>
      <div class="info-row">
        <span>Discount Concession</span>
        <strong style="color: var(--gold);">-₹${discount.toLocaleString('en-IN')}</strong>
      </div>
      <div class="info-row">
        <span>Net Payable Fee</span>
        <strong>₹${netPayable.toLocaleString('en-IN')}</strong>
      </div>
      <div class="info-row">
        <span>Amount Paid</span>
        <strong class="success">₹${paid.toLocaleString('en-IN')}</strong>
      </div>
      <div class="info-row">
        <span>Due Balance</span>
        <strong class="${due > 0 ? 'danger' : 'success'}">
          ₹${due.toLocaleString('en-IN')}
          <span class="stamp ${due > 0 ? 'danger' : 'success'}">${due > 0 ? 'Due' : 'Cleared'}</span>
        </strong>
      </div>
    `;

    // Exam Result Section
    if (d.result && d.result.isPublished) {
      resultSectionContent.innerHTML = `
        <div class="result-card-box">
          <div class="result-grid-display">
            <div class="result-stat-item">
              <span>Marks Obtained</span>
              <strong>${escapeHtml(d.result.marks || '-')}</strong>
            </div>
            <div class="result-stat-item">
              <span>Grade</span>
              <strong style="color: var(--gold);">${escapeHtml(d.result.grade || '-')}</strong>
            </div>
            <div class="result-stat-item">
              <span>Status</span>
              <div>
                <span class="${d.result.status === 'PASS' ? 'badge-pass' : 'badge-fail'}">
                  ${escapeHtml(d.result.status || 'PASS')}
                </span>
              </div>
            </div>
          </div>
        </div>
      `;
    } else {
      resultSectionContent.innerHTML = `
        <div class="result-card-box" style="text-align: center; color: var(--muted); padding: 24px;">
          <p style="font-size: 15px; margin: 0;">⏳ <strong>Abhi result ghoshit nahi kiya gaya hai.</strong></p>
          <span style="font-size: 12px;">Exam hone ke baad instructor dwara result yahan update kiya jayega.</span>
        </div>
      `;
    }
  } catch (err) {
    await auth.signOut();
    dashboardView.style.display = 'none';
    loginView.style.display = 'flex';
    resetStudentLoginForm();
    loginError.textContent = 'Data verify nahi ho paya. Dobara login karein.';
  }
}

// --- Universal Receipt Print / Download ---
btnPrintReceipt.addEventListener('click', () => {
  if (!loggedInStudentData) return;

  const d = loggedInStudentData;
  const total = Number(d.totalFee) || 0;
  const discount = Number(d.discount) || 0;
  const net = Math.max(0, total - discount);
  const paid = Number(d.paidFee) || 0;
  const due = Math.max(0, net - paid);
  const admDate = formatDate(d.admissionDate);
  const todayDate = new Date().toLocaleDateString('en-IN');

  const receiptWindow = window.open('', '_blank');
  if (!receiptWindow) {
    alert('Pop-up block ho gaya hai. Browser me pop-ups allow karein.');
    return;
  }

  receiptWindow.document.open();
  receiptWindow.document.write(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Fee Receipt - ${escapeHtml(d.name || 'Student')}</title>
      <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
          font-family: 'Plus Jakarta Sans', sans-serif;
          background: #FAF7F2;
          color: #2D2424;
          padding: 24px 12px;
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        .action-bar {
          width: 100%;
          max-width: 500px;
          display: flex;
          gap: 10px;
          margin-bottom: 16px;
        }
        .btn-action {
          flex: 1;
          padding: 12px;
          background: #78202B;
          color: #fff;
          border: none;
          border-radius: 8px;
          font-size: 15px;
          font-weight: 700;
          cursor: pointer;
        }
        .btn-close {
          padding: 12px 20px;
          background: #E8E2D9;
          color: #333;
          border: none;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
        }
        .receipt-card {
          width: 100%;
          max-width: 500px;
          background: #fff;
          border: 2px solid #C49A45;
          border-radius: 12px;
          padding: 28px 24px;
          box-shadow: 0 4px 20px rgba(0,0,0,0.06);
        }
        .header {
          text-align: center;
          border-bottom: 2px solid #F0EAE1;
          padding-bottom: 14px;
          margin-bottom: 18px;
        }
        .brand-title {
          color: #78202B;
          font-size: 22px;
          font-weight: 800;
        }
        .brand-sub {
          font-size: 11px;
          font-weight: 700;
          color: #C49A45;
          letter-spacing: 2px;
          text-transform: uppercase;
          margin-top: 4px;
        }
        .meta-table, .data-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 16px;
        }
        .meta-table td {
          padding: 6px 0;
          font-size: 13.5px;
        }
        .meta-label { color: #7A6E65; font-weight: 600; }
        .meta-val { text-align: right; font-weight: 700; color: #111; }
        .data-table th {
          background: #FAF7F2;
          padding: 8px 10px;
          text-align: left;
          font-size: 12px;
          color: #78202B;
          border-top: 1px solid #EADBCC;
          border-bottom: 1px solid #EADBCC;
        }
        .data-table th.right, .data-table td.right { text-align: right; }
        .data-table td {
          padding: 9px 10px;
          font-size: 13.5px;
          border-bottom: 1px dashed #F0EAE1;
        }
        .due-row td {
          color: ${due > 0 ? '#B22222' : '#2E7D32'};
          font-weight: 800;
          font-size: 15px;
          border-top: 1.5px solid #EADBCC;
          border-bottom: 1.5px solid #EADBCC;
          background: #FFF9F9;
        }
        .footer {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          margin-top: 24px;
        }
        .status-badge {
          font-size: 11px;
          font-weight: 700;
          padding: 4px 8px;
          border-radius: 4px;
          background: #E8F5E9;
          color: #2E7D32;
        }
        .signature-line {
          text-align: center;
          border-top: 1px solid #7A6E65;
          padding-top: 4px;
          width: 140px;
          font-size: 11px;
          font-weight: 600;
          color: #7A6E65;
        }
        @media print {
          body { background: #fff; padding: 0; }
          .action-bar { display: none !important; }
          .receipt-card {
            border: 1.5px solid #78202B;
            box-shadow: none;
            max-width: 100%;
            padding: 20px;
          }
        }
      </style>
    </head>
    <body>
      <div class="action-bar">
        <button class="btn-action" onclick="window.print()">📥 Save as PDF / Print</button>
        <button class="btn-close" onclick="window.close()">Close</button>
      </div>

      <div class="receipt-card">
        <div class="header">
          <div class="brand-title">Shama Henna Classes</div>
          <div class="brand-sub">Official Fee Receipt</div>
        </div>

        <table class="meta-table">
          <tr>
            <td class="meta-label">Student Name:</td>
            <td class="meta-val">${escapeHtml(d.name || '-')}</td>
          </tr>
          <tr>
            <td class="meta-label">Admission Date:</td>
            <td class="meta-val">${admDate}</td>
          </tr>
          <tr>
            <td class="meta-label">Receipt Date:</td>
            <td class="meta-val">${todayDate}</td>
          </tr>
        </table>

        <table class="data-table">
          <thead>
            <tr>
              <th>Description</th>
              <th class="right">Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Course Total Fee</td>
              <td class="right">₹${total.toLocaleString('en-IN')}</td>
            </tr>
            <tr>
              <td>Special Discount / Concession</td>
              <td class="right" style="color:#C49A45;">-₹${discount.toLocaleString('en-IN')}</td>
            </tr>
            <tr>
              <td><strong>Net Payable Fee</strong></td>
              <td class="right"><strong>₹${net.toLocaleString('en-IN')}</strong></td>
            </tr>
            <tr>
              <td style="color:#2E7D32;">Total Amount Paid</td>
              <td class="right" style="color:#2E7D32; font-weight:700;">₹${paid.toLocaleString('en-IN')}</td>
            </tr>
            <tr class="due-row">
              <td>Remaining Balance (Due)</td>
              <td class="right">₹${due.toLocaleString('en-IN')}</td>
            </tr>
          </tbody>
        </table>

        <div class="footer">
          <div>
            <span class="status-badge">Status: ${due > 0 ? 'PARTIAL / DUE' : 'FULLY PAID'}</span>
          </div>
          <div class="signature-line">
            Authorized Signature
          </div>
        </div>
      </div>
    </body>
    </html>
  `);
  receiptWindow.document.close();
});

// --- Helpers ---
function formatDate(value) {
  if (!value) return '-';
  const d = new Date(value);
  if (isNaN(d.getTime())) return value;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
}

function friendlyError(code) {
  switch (code) {
    case 'auth/invalid-email': return 'Email sahi format mein nahi hai.';
    case 'auth/missing-password': return 'Password daalein.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Email ya password galat hai.';
    case 'auth/too-many-requests':
      return 'Bahut zyada attempts ho gaye. Thodi der baad try karein.';
    case 'auth/network-request-failed':
      return 'Internet connection check karein.';
    default:
      return 'Login nahi ho paya. Dobara try karein.';
  }
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}