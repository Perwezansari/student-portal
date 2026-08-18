// Student Portal Application Logic
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

auth.setPersistence(firebase.auth.Auth.Persistence.SESSION).catch(() => {});

function resetLoginFormState() {
  loginForm.reset();
  const btn = loginForm.querySelector('button[type="submit"]');
  if (btn) {
    btn.disabled = false;
    btn.textContent = 'Login to Dashboard';
  }
}

// Session State Observer
auth.onAuthStateChanged(async (user) => {
  loginError.textContent = '';
  if (user && user.email) {
    await fetchStudentProfile(user.uid);
  } else {
    loggedInStudentData = null;
    dashboardView.classList.add('view-state-hidden');
    loginView.classList.remove('view-state-hidden');
    resetLoginFormState();
  }
});

// Authentication Submission
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  loginError.textContent = '';
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const btn = loginForm.querySelector('button[type="submit"]');

  btn.disabled = true;
  btn.textContent = 'Verifying...';

  try {
    await auth.signInWithEmailAndPassword(email, password);
  } catch (err) {
    loginError.textContent = formatAuthErrorMessage(err.code) || 'Authentication failed.';
  } finally {
    btn.disabled = false;
    btn.textContent = 'Login to Dashboard';
  }
});

logoutBtn.addEventListener('click', async () => {
  resetLoginFormState();
  await auth.signOut();
});

// Profile Loader and View Hydration
async function fetchStudentProfile(uid) {
  try {
    const doc = await db.collection('students').doc(uid).get();

    if (!doc.exists) {
      await auth.signOut();
      loginError.textContent = 'No associated student record found for this profile.';
      dashboardView.classList.add('view-state-hidden');
      loginView.classList.remove('view-state-hidden');
      resetLoginFormState();
      return;
    }

    const data = doc.data();
    loggedInStudentData = data;
    loginView.classList.add('view-state-hidden');
    dashboardView.classList.remove('view-state-hidden');
    welcomeStudentName.textContent = data.name || 'Student';

    // Account Summary Computations
    const total = Number(data.totalFee) || 0;
    const discount = Number(data.discount) || 0;
    const netPayable = Math.max(0, total - discount);
    const paid = Number(data.paidFee) || 0;
    const due = Math.max(0, netPayable - paid);
    const formattedAdmissionDate = formatDisplayDate(data.admissionDate);

    dashboardContent.innerHTML = `
      <div class="info-row"><span>Student Name</span><strong class="name-value">${sanitizeOutput(data.name || '-')}</strong></div>
      <div class="info-row"><span>Admission Date</span><strong>${formattedAdmissionDate}</strong></div>
      <div class="info-row"><span>Total Course Fee</span><strong>₹${total.toLocaleString('en-IN')}</strong></div>
      <div class="info-row"><span>Discount Concession</span><strong class="gold-text">-₹${discount.toLocaleString('en-IN')}</strong></div>
      <div class="info-row"><span>Net Payable Fee</span><strong>₹${netPayable.toLocaleString('en-IN')}</strong></div>
      <div class="info-row"><span>Amount Paid</span><strong class="success">₹${paid.toLocaleString('en-IN')}</strong></div>
      <div class="info-row">
        <span>Due Balance</span>
        <strong class="${due > 0 ? 'danger' : 'success'}">₹${due.toLocaleString('en-IN')}
          <span class="stamp ${due > 0 ? 'danger' : 'success'}">${due > 0 ? 'Due' : 'Cleared'}</span>
        </strong>
      </div>
    `;

    // Examination Record
    if (data.result && data.result.isPublished) {
      resultSectionContent.innerHTML = `
        <div class="result-card-box">
          <div class="result-grid-display">
            <div class="result-stat-item"><span>Marks Obtained</span><strong>${sanitizeOutput(data.result.marks || '-')}</strong></div>
            <div class="result-stat-item"><span>Grade</span><strong class="result-stat-grade">${sanitizeOutput(data.result.grade || '-')}</strong></div>
            <div class="result-stat-item"><span>Status</span><div><span class="${data.result.status === 'PASS' ? 'badge-pass' : 'badge-fail'}">${sanitizeOutput(data.result.status || 'PASS')}</span></div></div>
          </div>
        </div>
      `;
    } else {
      resultSectionContent.innerHTML = `<div class="result-card-box pending-state-box"><p class="pending-state-title">⏳ <strong>Examination results have not been published yet.</strong></p></div>`;
    }
  } catch (err) {
    await auth.signOut();
    dashboardView.classList.add('view-state-hidden');
    loginView.classList.remove('view-state-hidden');
    resetLoginFormState();
    loginError.textContent = 'Session validation error. Please log in again.';
  }
}

// Receipt Document Generator
btnPrintReceipt.addEventListener('click', () => {
  if (!loggedInStudentData) return;
  const data = loggedInStudentData;
  const total = Number(data.totalFee) || 0;
  const discount = Number(data.discount) || 0;
  const net = Math.max(0, total - discount);
  const paid = Number(data.paidFee) || 0;
  const due = Math.max(0, net - paid);
  const admDate = formatDisplayDate(data.admissionDate);
  const printDate = new Date().toLocaleDateString('en-IN');

  const receiptWindow = window.open('', '_blank');
  if (!receiptWindow) {
    alert('Pop-up blocked. Please enable browser pop-ups to print receipts.');
    return;
  }

  receiptWindow.document.open();
  receiptWindow.document.write(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>Fee Receipt - ${sanitizeOutput(data.name || 'Student')}</title>
      <link rel="stylesheet" href="style.css">
      <style>
        body { background: #FAF7F2; padding: 24px 12px; display: flex; flex-direction: column; align-items: center; }
        .receipt-action-bar { width: 100%; max-width: 500px; display: flex; gap: 10px; margin-bottom: 16px; }
        .receipt-card { width: 100%; max-width: 500px; background: #fff; border: 2px solid #C49A45; border-radius: 12px; padding: 28px 24px; }
        .receipt-header { text-align: center; border-bottom: 2px solid #F0EAE1; padding-bottom: 14px; margin-bottom: 18px; }
        .receipt-brand-title { color: #78202B; font-size: 22px; font-weight: 800; }
        .receipt-brand-sub { font-size: 11px; font-weight: 700; color: #C49A45; letter-spacing: 2px; text-transform: uppercase; margin-top: 4px; }
        .meta-table, .data-table { width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 13.5px; }
        .meta-label { color: #7A6E65; font-weight: 600; }
        .meta-val { text-align: right; font-weight: 700; color: #111; }
        .data-table th { background: #FAF7F2; padding: 8px 10px; text-align: left; font-size: 12px; color: #78202B; border-top: 1px solid #EADBCC; border-bottom: 1px solid #EADBCC; }
        .data-table td { padding: 9px 10px; border-bottom: 1px dashed #F0EAE1; }
        .text-right { text-align: right; }
        .due-row td { color: ${due > 0 ? '#B22222' : '#2E7D32'}; font-weight: 800; font-size: 15px; border-top: 1.5px solid #EADBCC; border-bottom: 1.5px solid #EADBCC; background: #FFF9F9; }
        .receipt-footer { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 24px; }
        .receipt-badge { font-size: 11px; font-weight: 700; padding: 4px 8px; border-radius: 4px; background: #E8F5E9; color: #2E7D32; }
        .signature-line { text-align: center; border-top: 1px solid #7A6E65; padding-top: 4px; width: 140px; font-size: 11px; font-weight: 600; color: #7A6E65; }
        @media print {
          .receipt-action-bar { display: none !important; }
          .receipt-card { border: 1.5px solid #78202B; max-width: 100%; padding: 20px; }
        }
      </style>
    </head>
    <body>
      <div class="receipt-action-bar">
        <button class="btn primary btn-flex-fill" onclick="window.print()">📥 Save as PDF / Print</button>
        <button class="btn ghost" onclick="window.close()">Close</button>
      </div>
      <div class="receipt-card">
        <div class="receipt-header">
          <div class="receipt-brand-title">Shama Henna Classes</div>
          <div class="receipt-brand-sub">Official Fee Receipt</div>
        </div>
        <table class="meta-table">
          <tr><td class="meta-label">Student Name:</td><td class="meta-val">${sanitizeOutput(data.name || '-')}</td></tr>
          <tr><td class="meta-label">Admission Date:</td><td class="meta-val">${admDate}</td></tr>
          <tr><td class="meta-label">Receipt Date:</td><td class="meta-val">${printDate}</td></tr>
        </table>
        <table class="data-table">
          <thead><tr><th>Description</th><th class="text-right">Amount</th></tr></thead>
          <tbody>
            <tr><td>Course Total Fee</td><td class="text-right">₹${total.toLocaleString('en-IN')}</td></tr>
            <tr><td>Special Discount / Concession</td><td class="text-right gold-text">-₹${discount.toLocaleString('en-IN')}</td></tr>
            <tr><td><strong>Net Payable Fee</strong></td><td class="text-right"><strong>₹${net.toLocaleString('en-IN')}</strong></td></tr>
            <tr><td class="success">Total Amount Paid</td><td class="text-right success text-bold">₹${paid.toLocaleString('en-IN')}</td></tr>
            <tr class="due-row"><td>Remaining Balance (Due)</td><td class="text-right">₹${due.toLocaleString('en-IN')}</td></tr>
          </tbody>
        </table>
        <div class="receipt-footer">
          <div><span class="receipt-badge">Status: ${due > 0 ? 'PARTIAL / DUE' : 'FULLY PAID'}</span></div>
          <div class="signature-line">Authorized Signature</div>
        </div>
      </div>
    </body>
    </html>
  `);
  receiptWindow.document.close();
});

// Formatters
function formatDisplayDate(val) {
  if (!val) return '-';
  const d = new Date(val);
  if (isNaN(d.getTime())) return val;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
}

function formatAuthErrorMessage(code) {
  switch (code) {
    case 'auth/invalid-email': return 'Invalid email format.';
    case 'auth/missing-password': return 'Password is required.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential': return 'Invalid email or password.';
    case 'auth/network-request-failed': return 'Network connection unavailable.';
    default: return 'Authentication unsuccessful.';
  }
}

function sanitizeOutput(str) {
  const container = document.createElement('div');
  container.textContent = str;
  return container.innerHTML;
}