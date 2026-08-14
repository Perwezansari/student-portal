// ============================================================
// Admin portal logic
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

auth.onAuthStateChanged((user) => {
  loginError.textContent = '';
  if (user) {
    loginView.style.display = 'none';
    dashboardView.style.display = 'block';
    loadStudents();
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
    await auth.signInWithEmailAndPassword(email, password);
  } catch (err) {
    loginError.textContent = friendlyError(err.code) || 'Login nahi ho paya.';
  } finally {
    btn.disabled = false;
  }
});

logoutBtn.addEventListener('click', () => auth.signOut());

// --- Add student -------------------------------------------------
// Naya login banane ke liye ek "secondary" Firebase app instance
// use karte hain, taaki admin ka apna session logged-in rahe
// (warna createUserWithEmailAndPassword khud admin ko sign out
// karke naye student ke account mein switch kar deta).

addForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const submitBtn = addForm.querySelector('button');
  submitBtn.disabled = true;
  addStatus.textContent = 'Adding...';
  addStatus.className = 'status';

  const name = document.getElementById('sName').value.trim();
  const admissionDate = document.getElementById('sDate').value;
  const totalFee = Number(document.getElementById('sTotal').value) || 0;
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
      name, admissionDate, totalFee, paidFee
    });

    addStatus.textContent = `"${name}" add ho gaya. Login diya: ${email}`;
    addStatus.className = 'status success';
    addForm.reset();
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

// --- List + update students ---------------------------------------

async function loadStudents() {
  permissionError.style.display = 'none';
  studentsBody.innerHTML = '<tr><td colspan="6" class="muted">Loading...</td></tr>';
  try {
    const snap = await db.collection('students').orderBy('name').get();
    if (snap.empty) {
      studentsBody.innerHTML = '<tr><td colspan="6" class="muted">Abhi koi student add nahi hua.</td></tr>';
      return;
    }
    studentsBody.innerHTML = '';
    snap.forEach((doc) => studentsBody.appendChild(renderRow(doc)));
  } catch (err) {
    studentsBody.innerHTML = '';
    permissionError.style.display = 'block';
  }
}

function renderRow(doc) {
  const d = doc.data();
  const total = Number(d.totalFee) || 0;
  const paid = Number(d.paidFee) || 0;
  const due = total - paid;

  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td>${escapeHtml(d.name || '-')}</td>
    <td>${d.admissionDate || '-'}</td>
    <td>₹${total.toLocaleString('en-IN')}</td>
    <td>₹${paid.toLocaleString('en-IN')}</td>
    <td class="${due > 0 ? 'danger' : 'success'}">₹${due.toLocaleString('en-IN')}</td>
    <td class="actions">
      <input type="number" class="paidInput" min="0" step="1" placeholder="New paid ₹" style="width:100px">
      <button class="btn small primary updateBtn" type="button">Save</button>
      <button class="btn small danger removeBtn" type="button">Remove</button>
    </td>
  `;

  tr.querySelector('.updateBtn').addEventListener('click', async () => {
    const val = tr.querySelector('.paidInput').value;
    if (val === '') return;
    await db.collection('students').doc(doc.id).update({ paidFee: Number(val) });
    loadStudents();
  });

  tr.querySelector('.removeBtn').addEventListener('click', async () => {
    const ok = confirm(
      `"${d.name}" ka record remove karein?\n\n` +
      `Note: isse sirf unka fee record hatega. Unka login (Authentication) active rahega ` +
      `— use bhi hatane ke liye Firebase Console > Authentication mein jaakar manually delete karein.`
    );
    if (!ok) return;
    await db.collection('students').doc(doc.id).delete();
    loadStudents();
  });

  return tr;
}

function friendlyError(code) {
  switch (code) {
    case 'auth/email-already-in-use': return 'Ye login email pehle se use ho raha hai.';
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
