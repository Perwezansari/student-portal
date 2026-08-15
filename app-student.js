// ============================================================
// Student portal logic (Strict Verification + Responsive Receipt)
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

// --- Auth State Verification ---
auth.onAuthStateChanged(async (user) => {
  loginError.textContent = '';
  if (user) {
    // Check if this UID really belongs to a student
    await loadStudentData(user.uid);
  } else {
    // Agar koi logged-in nahi hai, hamesha login screen dikhao
    loggedInStudentData = null;
    dashboardView.style.display = 'none';
    loginView.style.display = 'flex';
    loginForm.reset();
  }
});

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  loginError.textContent = '';
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const btn = loginForm.querySelector('button');
  btn.disabled = true;
  try {
    await auth.setPersistence(firebase.auth.Auth.Persistence.SESSION);
    await auth.signInWithEmailAndPassword(email, password);
  } catch (err) {
    loginError.textContent = friendlyError(err.code) || 'Login nahi ho paya.';
  } finally {
    btn.disabled = false;
  }
});

logoutBtn.addEventListener('click', () => auth.signOut());

async function loadStudentData(uid) {
  try {
    const doc = await db.collection('students').doc(uid).get();
    
    // Security check: Agar student collection me ye UID nahi mila (e.g. Admin logged in)
    if (!doc.exists) {
      await auth.signOut();
      loginError.textContent = 'Yeh account Student list mein nahi hai. Kripya Student ID se login karein.';
      dashboardView.style.display = 'none';
      loginView.style.display = 'flex';
      return;
    }

    // Valid student record found
    const d = doc.data();
    loggedInStudentData = d;

    // Show dashboard
    loginView.style.display = 'none';
    dashboardView.style.display = 'block';

    // Welcome Greeting
    welcomeStudentName.textContent = d.name || 'Student';

    const total = Number(d.totalFee) || 0;
    const discount = Number(d.discount) || 0;
    const netPayable = Math.max(0, total - discount);
    const paid = Number(d.paidFee) || 0;
    const due = Math.max(0, netPayable - paid);
    const admissionDate = formatDate(d.admissionDate);

    // Render Ledger
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

    // Render Result Section
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
    loginError.textContent = 'Data verify nahi ho paya. Dobara login karein.';
  }
}

// --- Universal 1-Click PDF Downloader ---
btnPrintReceipt.addEventListener('click', () => {
  if (!loggedInStudentData) return;

  const d = loggedInStudentData;
  const total = Number(d.totalFee) || 0;
  const discount = Number(d.discount) || 0;
  const net = Math.max(0, total - discount);
  const paid = Number(d.paidFee) || 0;
  const due = Math.max(0, net - paid);

  // Fill receipt fields
  document.getElementById('rcptName').textContent = d.name || '-';
  document.getElementById('rcptDate').textContent = formatDate(d.admissionDate);
  document.getElementById('rcptCurrentDate').textContent = new Date().toLocaleDateString('en-IN');
  document.getElementById('rcptTotal').textContent = '₹' + total.toLocaleString('en-IN');
  document.getElementById('rcptDiscount').textContent = '-₹' + discount.toLocaleString('en-IN');
  document.getElementById('rcptNet').textContent = '₹' + net.toLocaleString('en-IN');
  document.getElementById('rcptPaid').textContent = '₹' + paid.toLocaleString('en-IN');
  document.getElementById('rcptDue').textContent = '₹' + due.toLocaleString('en-IN');

  const receiptElement = document.getElementById('receiptContent');
  const originalDisplay = receiptElement.style.display;

  // Temporarily show element for snapshot
  receiptElement.style.display = 'block';
  btnPrintReceipt.disabled = true;
  btnPrintReceipt.textContent = 'Generating PDF...';

  const cleanName = (d.name || 'Student').replace(/[^a-zA-Z0-9]/g, '_');
  const opt = {
    margin:       [10, 10, 10, 10],
    filename:     Fee_Receipt_${cleanName}.pdf,
    image:        { type: 'jpeg', quality: 0.98 },
    html2canvas:  { scale: 2, useCORS: true, logging: false },
    jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
  };

  html2pdf()
    .set(opt)
    .from(receiptElement)
    .save()
    .then(() => {
      receiptElement.style.display = originalDisplay;
      btnPrintReceipt.disabled = false;
      btnPrintReceipt.textContent = '📄 Download / Print Fee Receipt';
    })
    .catch((err) => {
      console.error('PDF Generation Error:', err);
      receiptElement.style.display = originalDisplay;
      btnPrintReceipt.disabled = false;
      btnPrintReceipt.textContent = '📄 Download / Print Fee Receipt';
      alert('PDF generate nahi ho paya. Dobara try karein.');
    });
});

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