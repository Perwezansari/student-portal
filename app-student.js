// ============================================================
// Student Portal Application Logic (Stable & Error-Free)
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

auth.setPersistence(firebase.auth.Auth.Persistence.SESSION).catch(() => {});

function resetLoginFormState() {
  if (loginForm) loginForm.reset();
  const submitButton = loginForm ? loginForm.querySelector('button[type="submit"]') : null;
  if (submitButton) {
    submitButton.disabled = false;
    submitButton.textContent = 'Login to Dashboard';
  }
}

auth.onAuthStateChanged(async (user) => {
  if (loginError) loginError.textContent = '';
  if (user && user.email) {
    await fetchStudentProfile(user.uid);
  } else {
    loggedInStudentData = null;
    if (dashboardView) dashboardView.style.display = 'none';
    if (loginView) loginView.style.display = 'flex';
    resetLoginFormState();
  }
});

if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (loginError) loginError.textContent = '';
    
    const emailField = document.getElementById('email');
    const passwordField = document.getElementById('password');
    if (!emailField || !passwordField) return;

    const email = emailField.value.trim();
    const password = passwordField.value;
    const submitButton = loginForm.querySelector('button[type="submit"]');

    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = 'Verifying...';
    }

    try {
      await auth.signInWithEmailAndPassword(email, password);
      // Success par 'onAuthStateChanged' khud dashboard open kar dega
    } catch (error) {
      if (loginError) loginError.textContent = formatAuthErrorMessage(error.code) || 'Authentication failed.';
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = 'Login to Dashboard';
      }
    }
  });
}

if (logoutBtn) {
  logoutBtn.addEventListener('click', async () => {
    resetLoginFormState();
    await auth.signOut();
  });
}

async function fetchStudentProfile(uid) {
  try {
    const documentSnapshot = await db.collection('students').doc(uid).get();

    if (!documentSnapshot.exists) {
      await auth.signOut();
      if (loginError) loginError.textContent = 'No student record found. Access denied.';
      if (dashboardView) dashboardView.style.display = 'none';
      if (loginView) loginView.style.display = 'flex';
      resetLoginFormState();
      return;
    }

    const dataPayload = documentSnapshot.data();
    loggedInStudentData = dataPayload;
    
    if (loginView) loginView.style.display = 'none';
    if (dashboardView) dashboardView.style.display = 'block';
    if (welcomeStudentName) welcomeStudentName.textContent = dataPayload.name || 'Student';

    // Financial Metrics Calculation
    const totalAmount = Number(dataPayload.totalFee) || 0;
    const discountAmount = Number(dataPayload.discount) || 0;
    const netPayableAmount = Math.max(0, totalAmount - discountAmount);
    const paidAmount = Number(dataPayload.paidFee) || 0;
    const dueAmount = Math.max(0, netPayableAmount - paidAmount);
    const formattedAdmissionDate = formatDisplayDate(dataPayload.admissionDate);

    if (dashboardContent) {
      dashboardContent.innerHTML = `
        <div class="info-row"><span>Student Name</span><strong class="name-value">${sanitizeOutput(dataPayload.name || '-')}</strong></div>
        <div class="info-row"><span>Admission Date</span><strong>${formattedAdmissionDate}</strong></div>
        <div class="info-row"><span>Total Course Fee</span><strong>₹${totalAmount.toLocaleString('en-IN')}</strong></div>
        <div class="info-row"><span>Discount Concession</span><strong class="gold-text">-₹${discountAmount.toLocaleString('en-IN')}</strong></div>
        <div class="info-row"><span>Net Payable Fee</span><strong>₹${netPayableAmount.toLocaleString('en-IN')}</strong></div>
        <div class="info-row"><span>Amount Paid</span><strong class="success">₹${paidAmount.toLocaleString('en-IN')}</strong></div>
        <div class="info-row">
          <span>Due Balance</span>
          <strong class="${dueAmount > 0 ? 'danger' : 'success'}">₹${dueAmount.toLocaleString('en-IN')}
            <span class="stamp ${dueAmount > 0 ? 'danger' : 'success'}">${dueAmount > 0 ? 'Due' : 'Cleared'}</span>
          </strong>
        </div>
      `;
    }

    if (resultSectionContent) {
      if (dataPayload.result && dataPayload.result.isPublished) {
        resultSectionContent.innerHTML = `
          <div class="result-card-box">
            <div class="result-grid-display">
              <div class="result-stat-item"><span>Marks Obtained</span><strong>${sanitizeOutput(dataPayload.result.marks || '-')}</strong></div>
              <div class="result-stat-item"><span>Grade</span><strong class="result-stat-grade">${sanitizeOutput(dataPayload.result.grade || '-')}</strong></div>
              <div class="result-stat-item"><span>Status</span><div><span class="${dataPayload.result.status === 'PASS' ? 'badge-pass' : 'badge-fail'}">${sanitizeOutput(dataPayload.result.status || 'PASS')}</span></div></div>
            </div>
          </div>
        `;
      } else {
        resultSectionContent.innerHTML = `<div class="result-card-box pending-state-box"><p class="pending-state-title">⏳ <strong>Examination results have not been published yet.</strong></p></div>`;
      }
    }
  } catch (error) {
    console.error(error);
    await auth.signOut();
    if (dashboardView) dashboardView.style.display = 'none';
    if (loginView) loginView.style.display = 'flex';
    resetLoginFormState();
    if (loginError) loginError.textContent = 'Session error. Please log in again.';
  }
}

if (btnPrintReceipt) {
  btnPrintReceipt.addEventListener('click', () => {
    if (!loggedInStudentData) return;
    
    const studentRecord = loggedInStudentData;
    const courseTotal = Number(studentRecord.totalFee) || 0;
    const courseDiscount = Number(studentRecord.discount) || 0;
    const courseNet = Math.max(0, courseTotal - courseDiscount);
    const coursePaid = Number(studentRecord.paidFee) || 0;
    const courseDue = Math.max(0, courseNet - coursePaid);
    
    const admissionDisplayDate = formatDisplayDate(studentRecord.admissionDate);
    const currentPrintDate = new Date().toLocaleDateString('en-IN');

    const documentWindow = window.open('', '_blank');
    if (!documentWindow) {
      alert('Pop-up blocked. Please enable browser pop-ups to print receipts.');
      return;
    }

    documentWindow.document.open();
    documentWindow.document.write(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        <title>Fee Receipt - ${sanitizeOutput(studentRecord.name || 'Student')}</title>
        <link rel="stylesheet" href="style.css">
        <style>
          * { box-sizing: border-box; }
          body { background: #FAF7F2; padding: 16px; display: flex; flex-direction: column; align-items: center; margin: 0; font-family: 'Plus Jakarta Sans', sans-serif; }
          .receipt-action-bar { width: 100%; max-width: 500px; display: flex; gap: 10px; margin-bottom: 16px; }
          .receipt-card { width: 100%; max-width: 500px; background: #fff; border: 2px solid #C49A45; border-radius: 12px; padding: 24px 18px; }
          .receipt-header { text-align: center; border-bottom: 2px solid #F0EAE1; padding-bottom: 14px; margin-bottom: 18px; }
          .receipt-brand-title { color: #78202B; font-size: 22px; font-weight: 800; }
          .receipt-brand-sub { font-size: 11px; font-weight: 700; color: #C49A45; letter-spacing: 2px; text-transform: uppercase; margin-top: 4px; }
          .meta-table, .data-table { width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 13.5px; }
          .meta-label { color: #7A6E65; font-weight: 600; }
          .meta-val { text-align: right; font-weight: 700; color: #111; }
          .data-table th { background: #FAF7F2; padding: 8px 10px; text-align: left; font-size: 12px; color: #78202B; border-top: 1px solid #EADBCC; border-bottom: 1px solid #EADBCC; }
          .data-table td { padding: 9px 10px; border-bottom: 1px dashed #F0EAE1; }
          .text-right { text-align: right; }
          .due-row td { color: ${courseDue > 0 ? '#B22222' : '#2E7D32'}; font-weight: 800; font-size: 15px; border-top: 1.5px solid #EADBCC; border-bottom: 1.5px solid #EADBCC; background: #FFF9F9; }
          .receipt-footer { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 24px; }
          .receipt-badge { font-size: 11px; font-weight: 700; padding: 4px 8px; border-radius: 4px; background: #E8F5E9; color: #2E7D32; }
          .signature-line { text-align: center; border-top: 1px solid #7A6E65; padding-top: 4px; width: 140px; font-size: 11px; font-weight: 600; color: #7A6E65; }
          @media print {
            .receipt-action-bar { display: none !important; }
            .receipt-card { border: 1.5px solid #78202B; max-width: 100%; padding: 20px; }
            body { background: white; padding: 0; }
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
            <tr><td class="meta-label">Student Name:</td><td class="meta-val">${sanitizeOutput(studentRecord.name || '-')}</td></tr>
            <tr><td class="meta-label">Admission Date:</td><td class="meta-val">${admissionDisplayDate}</td></tr>
            <tr><td class="meta-label">Receipt Date:</td><td class="meta-val">${currentPrintDate}</td></tr>
          </table>
          <table class="data-table">
            <thead><tr><th>Description</th><th class="text-right">Amount</th></tr></thead>
            <tbody>
              <tr><td>Course Total Fee</td><td class="text-right">₹${courseTotal.toLocaleString('en-IN')}</td></tr>
              <tr><td>Special Discount / Concession</td><td class="text-right gold-text">-₹${courseDiscount.toLocaleString('en-IN')}</td></tr>
              <tr><td><strong>Net Payable Fee</strong></td><td class="text-right"><strong>₹${courseNet.toLocaleString('en-IN')}</strong></td></tr>
              <tr><td class="success">Total Amount Paid</td><td class="text-right success text-bold">₹${coursePaid.toLocaleString('en-IN')}</td></tr>
              <tr class="due-row"><td>Remaining Balance (Due)</td><td class="text-right">₹${courseDue.toLocaleString('en-IN')}</td></tr>
            </tbody>
          </table>
          <div class="receipt-footer">
            <div><span class="receipt-badge">Status: ${courseDue > 0 ? 'PARTIAL / DUE' : 'FULLY PAID'}</span></div>
            <div class="signature-line">Authorized Signature</div>
          </div>
        </div>
      </body>
      </html>
    `);
    documentWindow.document.close();
  });
}

function formatDisplayDate(dateString) {
  if (!dateString) return '-';
  const parsedDate = new Date(dateString);
  if (isNaN(parsedDate.getTime())) return dateString;
  return parsedDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
}

function formatAuthErrorMessage(errorCode) {
  switch (errorCode) {
    case 'auth/invalid-email': return 'Invalid email format provided.';
    case 'auth/missing-password': return 'Password field cannot be empty.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential': return 'Incorrect login credentials.';
    case 'auth/network-request-failed': return 'Network connection unavailable.';
    default: return 'Authentication processing failed.';
  }
}

function sanitizeOutput(inputString) {
  const domContainer = document.createElement('div');
  domContainer.textContent = inputString;
  return domContainer.innerHTML;
}
