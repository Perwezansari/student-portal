// ============================================================
// Admin portal logic (Secured + Real-time Search + Summary + Results)
// ============================================================

const loginView = document.getElementById('loginView');
const dashboardView = document.getElementById('dashboardView');
const loginForm = document.getElementById('loginForm');
const loginError = document.getElementById('loginError');
const logoutBtn = document.getElementById('logoutBtn');
const addForm = document.getElementById('addStudentForm');
const addStatus = document.getElementById('addStatus');
const studentsBody = document.getElementById('studentsBody');
const permissionError = document.getElementById('permissionError');
const searchInput = document.getElementById('searchInput');

// Result Modal elements
const resultModal = document.getElementById('resultModal');
const closeResultModal = document.getElementById('closeResultModal');
const resultForm = document.getElementById('resultForm');
const resultStudentId = document.getElementById('resultStudentId');
const resultModalStudentName = document.getElementById('resultModalStudentName');
const rMarks = document.getElementById('rMarks');
const rGrade = document.getElementById('rGrade');
const rStatus = document.getElementById('rStatus');
const btnRemoveResult = document.getElementById('btnRemoveResult');

let allStudentsCache = [];

// --- Auth State Verification (Restricts Student UID) ---
auth.onAuthStateChanged(async (user) => {
  loginError.textContent = '';
  if (user) {
    try {
      const adminDoc = await db.collection('admins').doc(user.uid).get();
      if (adminDoc.exists) {
        loginView.style.display = 'none';
        dashboardView.style.display = 'block';
        loadStudents();
      } else {
        await auth.signOut();
        loginError.textContent = 'Access Denied: Sirf Admin account se login kar sakte hain.';
        alert('Access Denied: Student account se admin dashboard open nahi kiya ja sakta!');
        loginView.style.display = 'flex';
        dashboardView.style.display = 'none';
      }
    } catch (err) {
      await auth.signOut();
      loginError.textContent = 'Verification error. Dobara try karein.';
      loginView.style.display = 'flex';
      dashboardView.style.display = 'none';
    }
  } else {
    loginView.style.display = 'flex';
    dashboardView.style.display = 'none';
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

// --- Add Student Logic ---
addForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const submitBtn = addForm.querySelector('button');
  submitBtn.disabled = true;
  addStatus.textContent = 'Adding...';
  addStatus.className = 'status';

  const name = document.getElementById('sName').value.trim();
  const admissionDate = document.getElementById('sDate').value;
  const totalFee = Number(document.getElementById('sTotal').value) || 0;
  const discount = Number(document.getElementById('sDiscount').value) || 0;
  const paidFee = Number(document.getElementById('sPaid').value) || 0;
  const email = document.getElementById('sEmail').value.trim();
  const password = document.getElementById('sPassword').value;

  let secondaryApp;
  try {
    secondaryApp = firebase.initializeApp(firebaseConfig, 'Secondary-' + Date.now());
    const cred = await secondaryApp.auth().createUserWithEmailAndPassword(email, password);
    const uid = cred.user.uid;
    await secondaryApp.auth().signOut();
    await secondaryApp.delete();
    secondaryApp = null;

    await db.collection('students').doc(uid).set({
      name,
      admissionDate,
      totalFee,
      discount,
      paidFee,
      email,
      result: null
    });

    addStatus.textContent = `"${name}" enroll ho gaya! Login ID: ${email}`;
    addStatus.className = 'status success';
    addForm.reset();
    document.getElementById('sDiscount').value = 0;
    document.getElementById('sPaid').value = 0;
    loadStudents();
  } catch (err) {
    addStatus.textContent = friendlyError(err.code) || 'Kuch galat hua, dobara try karein.';
    addStatus.className = 'status danger';
  } finally {
    if (secondaryApp) { try { await secondaryApp.delete(); } catch (_) {} }
    submitBtn.disabled = false;
  }
});

// --- Fetch & Render Students ---
async function loadStudents() {
  permissionError.style.display = 'none';
  studentsBody.innerHTML = '<tr><td colspan="8" class="muted">Loading students ledger...</td></tr>';
  try {
    const snap = await db.collection('students').orderBy('name').get();
    allStudentsCache = [];
    snap.forEach((doc) => {
      allStudentsCache.push({ id: doc.id, ...doc.data() });
    });

    updateSummaryCards(allStudentsCache);
    renderTable(allStudentsCache);
  } catch (err) {
    studentsBody.innerHTML = '';
    permissionError.style.display = 'block';
  }
}

function updateSummaryCards(students) {
  let totalStudents = students.length;
  let totalPaid = 0;
  let totalDue = 0;
  let totalDiscount = 0;

  students.forEach((s) => {
    const total = Number(s.totalFee) || 0;
    const disc = Number(s.discount) || 0;
    const paid = Number(s.paidFee) || 0;
    const net = Math.max(0, total - disc);
    const due = Math.max(0, net - paid);

    totalPaid += paid;
    totalDue += due;
    totalDiscount += disc;
  });

  document.getElementById('statStudents').textContent = totalStudents;
  document.getElementById('statCollected').textContent = '₹' + totalPaid.toLocaleString('en-IN');
  document.getElementById('statDue').textContent = '₹' + totalDue.toLocaleString('en-IN');
  document.getElementById('statDiscount').textContent = '₹' + totalDiscount.toLocaleString('en-IN');
}

function renderTable(students) {
  if (students.length === 0) {
    studentsBody.innerHTML = '<tr><td colspan="8" class="muted">Koi record nahi mila.</td></tr>';
    return;
  }

  studentsBody.innerHTML = '';
  students.forEach((d) => {
    const total = Number(d.totalFee) || 0;
    const discount = Number(d.discount) || 0;
    const paid = Number(d.paidFee) || 0;
    const net = Math.max(0, total - discount);
    const due = Math.max(0, net - paid);

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>
        <strong>${escapeHtml(d.name || '-')}</strong>
        <div style="font-size:11px; color:var(--muted);">${escapeHtml(d.email || '')}</div>
      </td>
      <td>${d.admissionDate || '-'}</td>
      <td>₹${total.toLocaleString('en-IN')}</td>
      <td style="color:var(--gold); font-weight:600;">₹${discount.toLocaleString('en-IN')}</td>
      <td class="success">₹${paid.toLocaleString('en-IN')}</td>
      <td class="${due > 0 ? 'danger' : 'success'}" style="font-weight:700;">₹${due.toLocaleString('en-IN')}</td>
      <td>
        ${d.result && d.result.isPublished ? 
          `<span class="stamp ${d.result.status === 'PASS' ? 'success' : 'danger'}">${d.result.marks} (${d.result.grade})</span>` : 
          `<span class="muted" style="font-size:12px;">Not Set</span>`}
      </td>
      <td class="actions">
        <input type="number" class="paidInput" min="0" step="1" placeholder="₹ Paid" style="width:85px; padding:6px 8px; font-size:12px;">
        <button class="btn small primary updateBtn" type="button">Save</button>
        <button class="btn small ghost resultBtn" type="button">📝 Result</button>
        <button class="btn small danger removeBtn" type="button">✕</button>
      </td>
    `;

    tr.querySelector('.updateBtn').addEventListener('click', async () => {
      const val = tr.querySelector('.paidInput').value;
      if (val === '') return;
      await db.collection('students').doc(d.id).update({ paidFee: Number(val) });
      loadStudents();
    });

    tr.querySelector('.resultBtn').addEventListener('click', () => {
      openResultEditor(d);
    });

    tr.querySelector('.removeBtn').addEventListener('click', async () => {
      const ok = confirm(`"${d.name}" ka record delete karein?`);
      if (!ok) return;
      await db.collection('students').doc(d.id).delete();
      loadStudents();
    });

    studentsBody.appendChild(tr);
  });
}

searchInput.addEventListener('input', (e) => {
  const query = e.target.value.toLowerCase().trim();
  const filtered = allStudentsCache.filter((s) => {
    const nameMatch = (s.name || '').toLowerCase().includes(query);
    const emailMatch = (s.email || '').toLowerCase().includes(query);
    return nameMatch || emailMatch;
  });
  renderTable(filtered);
});

function openResultEditor(student) {
  resultStudentId.value = student.id;
  resultModalStudentName.textContent = `Student: ${student.name}`;
  if (student.result && student.result.isPublished) {
    rMarks.value = student.result.marks || '';
    rGrade.value = student.result.grade || '';
    rStatus.value = student.result.status || 'PASS';
  } else {
    rMarks.value = '';
    rGrade.value = '';
    rStatus.value = 'PASS';
  }
  resultModal.style.display = 'flex';
}

closeResultModal.addEventListener('click', () => {
  resultModal.style.display = 'none';
});

resultForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = resultStudentId.value;
  await db.collection('students').doc(id).update({
    result: {
      marks: rMarks.value.trim(),
      grade: rGrade.value.trim().toUpperCase(),
      status: rStatus.value,
      isPublished: true
    }
  });
  resultModal.style.display = 'none';
  loadStudents();
});

btnRemoveResult.addEventListener('click', async () => {
  const id = resultStudentId.value;
  if (!confirm('Exam result unpublish/delete karein?')) return;
  await db.collection('students').doc(id).update({
    result: null
  });
  resultModal.style.display = 'none';
  loadStudents();
});

function friendlyError(code) {
  switch (code) {
    case 'auth/email-already-in-use': return 'Ye email pehle se use ho raha hai.';
    case 'auth/invalid-email': return 'Email sahi format mein nahi hai.';
    case 'auth/weak-password': return 'Password kam se kam 6 characters ka hona chahiye.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential': return 'Email ya password galat hai.';
    case 'auth/too-many-requests': return 'Bahut zyada attempts ho gaye. Thodi der baad try karein.';
    case 'auth/network-request-failed': return 'Internet connection check karein.';
    default: return null;
  }
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}