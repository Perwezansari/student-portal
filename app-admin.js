// ============================================================
// Admin Portal Logic 
// ============================================================

const loginView = document.getElementById('loginView');
const dashboardView = document.getElementById('dashboardView');
const storeDashboardView = document.getElementById('storeDashboardView'); 
const loginForm = document.getElementById('loginForm');
const loginError = document.getElementById('loginError');
const logoutBtn = document.getElementById('logoutBtn');
const addForm = document.getElementById('addStudentForm');
const addStatus = document.getElementById('addStatus');
const studentsBody = document.getElementById('studentsBody');
const searchInput = document.getElementById('searchInput');
const searchStoreInput = document.getElementById('searchStoreInput');

let allStudentsCache = [];
let allProductsCache = []; 
let allStoreStudentsCache = [];

auth.setPersistence(firebase.auth.Auth.Persistence.SESSION).catch(() => {});

// --- Navigation Toggle ---
const navToStoreBtn = document.getElementById('navToStoreBtn');
if (navToStoreBtn) {
  navToStoreBtn.addEventListener('click', () => {
    if (dashboardView) dashboardView.style.display = 'none';
    if (storeDashboardView) storeDashboardView.style.display = 'block';
    loadStoreData();
  });
}

const navToMainBtn = document.getElementById('navToMainBtn');
if (navToMainBtn) {
  navToMainBtn.addEventListener('click', () => {
    if (storeDashboardView) storeDashboardView.style.display = 'none';
    if (dashboardView) dashboardView.style.display = 'block';
    loadStudents();
  });
}

// --- Helper to Reset Admin Login Form State ---
function resetAdminLoginForm() {
  if (loginForm) loginForm.reset();
  const submitBtn = loginForm ? loginForm.querySelector('button[type="submit"]') : null;
  if (submitBtn) {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Login to Admin Panel';
  }
}

// --- Auth State Observer ---
auth.onAuthStateChanged(async (user) => {
  if (loginError) loginError.textContent = '';
  if (user) {
    try {
      const adminDoc = await db.collection('admins').doc(user.uid).get();
      if (adminDoc.exists) {
        if (storeDashboardView) storeDashboardView.style.display = 'none';
        if (loginView) loginView.style.display = 'none';
        if (dashboardView) dashboardView.style.display = 'block';
        loadStudents();
      } else {
        await auth.signOut();
        if (loginError) loginError.textContent = 'Access Denied: Administrative privileges required.';
        if (dashboardView) dashboardView.style.display = 'none';
        if (storeDashboardView) storeDashboardView.style.display = 'none';
        if (loginView) loginView.style.display = 'flex';
        resetAdminLoginForm();
      }
    } catch (err) {
      console.error(err);
      await auth.signOut();
      if (dashboardView) dashboardView.style.display = 'none';
      if (storeDashboardView) storeDashboardView.style.display = 'none';
      if (loginView) loginView.style.display = 'flex';
      resetAdminLoginForm();
    }
  } else {
    if (dashboardView) dashboardView.style.display = 'none';
    if (storeDashboardView) storeDashboardView.style.display = 'none';
    if (loginView) loginView.style.display = 'flex';
    resetAdminLoginForm();
  }
});

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (loginError) loginError.textContent = '';
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const btn = loginForm.querySelector('button[type="submit"]');

  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Verifying...';
  }

  try {
    await auth.signInWithEmailAndPassword(email, password);
  } catch (err) {
    if (loginError) loginError.textContent = formatAuthErrorMessage(err.code) || 'Authentication failed.';
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Login to Admin Panel';
    }
  }
});

if (logoutBtn) {
  logoutBtn.addEventListener('click', async () => {
    resetAdminLoginForm();
    await auth.signOut();
  });
}

// --- Add Student Logic ---
if (addForm) {
  addForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = addForm.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;
    if (addStatus) {
      addStatus.textContent = 'Processing registration...';
      addStatus.className = 'status';
    }

    const name = document.getElementById('sName').value.trim();
    const admissionDate = document.getElementById('sDate').value;
    const totalFee = Number(document.getElementById('sTotal').value) || 0;
    const discount = Number(document.getElementById('sDiscount').value) || 0;
    const paidFee = Number(document.getElementById('sPaid').value) || 0;
    const email = document.getElementById('sEmail').value.trim();
    const password = document.getElementById('sPassword').value;

    let secondaryApp;
    try {
      secondaryApp = firebase.initializeApp(firebaseConfig, 'SecondaryAuthInstance-' + Date.now());
      const credentials = await secondaryApp.auth().createUserWithEmailAndPassword(email, password);
      const uid = credentials.user.uid;
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
        password,
        result: null,
        storeItems: [],
        storePaid: 0
      });

      if (addStatus) {
        addStatus.textContent = `Student ${name} successfully enrolled.`;
        addStatus.className = 'status success';
      }
      addForm.reset();
      const discElem = document.getElementById('sDiscount');
      const paidElem = document.getElementById('sPaid');
      if (discElem) discElem.value = 0;
      if (paidElem) paidElem.value = 0;
      loadStudents();
    } catch (err) {
      if (addStatus) {
        addStatus.textContent = formatAuthErrorMessage(err.code) || 'Unable to register student.';
        addStatus.className = 'status danger';
      }
    } finally {
      if (secondaryApp) {
        try { await secondaryApp.delete(); } catch (_) {}
      }
      if (submitBtn) submitBtn.disabled = false;
    }
  });
}

// --- Fetch & Render Main Students Ledger ---
async function loadStudents() {
  if (!studentsBody) return;
  studentsBody.innerHTML = '<tr><td colspan="8" class="muted">Loading records...</td></tr>';
  try {
    const snapshot = await db.collection('students').orderBy('name').get();
    allStudentsCache = [];
    snapshot.forEach((doc) => {
      allStudentsCache.push({ id: doc.id, ...doc.data() });
    });
    updateSummaryMetrics(allStudentsCache);
    renderStudentsLedger(allStudentsCache);
  } catch (err) {
    console.error(err);
    studentsBody.innerHTML = `<tr><td colspan="8" class="danger text-bold">Error loading records: ${err.message}</td></tr>`;
  }
}

function updateSummaryMetrics(students) {
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

  const statStudents = document.getElementById('statStudents');
  const statCollected = document.getElementById('statCollected');
  const statDue = document.getElementById('statDue');
  const statDiscount = document.getElementById('statDiscount');

  if (statStudents) statStudents.textContent = totalStudents;
  if (statCollected) statCollected.textContent = '₹' + totalPaid.toLocaleString('en-IN');
  if (statDue) statDue.textContent = '₹' + totalDue.toLocaleString('en-IN');
  if (statDiscount) statDiscount.textContent = '₹' + totalDiscount.toLocaleString('en-IN');
}

function renderStudentsLedger(students) {
  if (!studentsBody) return;
  if (students.length === 0) {
    studentsBody.innerHTML = '<tr><td colspan="8" class="muted">No records available.</td></tr>';
    return;
  }
  studentsBody.innerHTML = '';

  students.forEach((d, index) => {
    const total = Number(d.totalFee) || 0;
    const discount = Number(d.discount) || 0;
    const paid = Number(d.paidFee) || 0;
    const net = Math.max(0, total - discount);
    const due = Math.max(0, net - paid);
    const serialNumber = index + 1;

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>
        <strong>${serialNumber}. ${sanitizeOutput(d.name || '-')}</strong>
        <div class="table-sub-email">${sanitizeOutput(d.email || '')}</div>
        <div class="table-sub-pass">Pass: ${sanitizeOutput(d.password || 'N/A')}</div>
      </td>
      <td>${d.admissionDate || '-'}</td>
      <td>₹${total.toLocaleString('en-IN')}</td>
      <td class="text-gold-bold">₹${discount.toLocaleString('en-IN')}</td>
      <td class="success">₹${paid.toLocaleString('en-IN')}</td>
      <td class="${due > 0 ? 'danger' : 'success'} text-bold">₹${due.toLocaleString('en-IN')}</td>
      <td>
        ${d.result && d.result.isPublished ? `<span class="stamp ${d.result.status === 'PASS' ? 'success' : 'danger'}">${d.result.marks}</span>` : `<span class="muted table-text-muted">Not Set</span>`}
      </td>
      <td>
        <div class="actions-cell">
          <div class="action-row-group">
            <input type="number" class="paidInput input-ledger-action" min="0" step="1" placeholder="+ Add ₹">
            <button class="btn small primary updateBtn" type="button" title="Save Payment">Add</button>
          </div>
          <div class="action-row-group">
            <button class="btn small ghost editBtn" type="button" title="Edit Record">✏️ Edit</button>
            <button class="btn small ghost resultBtn" type="button" title="Record Result">📝 Result</button>
            <button class="btn small danger removeBtn" type="button" title="Delete Record">✕</button>
          </div>
        </div>
      </td>
    `;

    tr.querySelector('.updateBtn').addEventListener('click', async () => {
      const valInput = tr.querySelector('.paidInput').value;
      if (valInput === '') return;
      const newPayment = Number(valInput) || 0;
      const updatedTotalPaid = paid + newPayment; 
      await db.collection('students').doc(d.id).update({ paidFee: updatedTotalPaid });
      loadStudents();
    });

    tr.querySelector('.resultBtn').addEventListener('click', () => { openResultEditor(d); });
    tr.querySelector('.editBtn').addEventListener('click', () => { openEditModal(d); });
    tr.querySelector('.removeBtn').addEventListener('click', async () => {
      if (confirm(`Remove records for ${d.name}?`)) {
        await db.collection('students').doc(d.id).delete();
        loadStudents();
      }
    });
    studentsBody.appendChild(tr);
  });
}

// --- Store Inventory and Ledger Controllers ---
const productsBody = document.getElementById('productsBody');
const storeStudentsBody = document.getElementById('storeStudentsBody');
const addProductForm = document.getElementById('addProductForm');

async function loadStoreData() {
  if (productsBody) {
    productsBody.innerHTML = '<tr><td colspan="3" class="muted">Loading catalog...</td></tr>';
    try {
      const pSnap = await db.collection('products').orderBy('name').get();
      allProductsCache = [];
      pSnap.forEach((doc) => allProductsCache.push({ id: doc.id, ...doc.data() }));
      renderProductsTable();
    } catch (err) {
      productsBody.innerHTML = `<tr><td colspan="3" class="danger">Error loading inventory catalog.</td></tr>`;
    }
  }

  if (storeStudentsBody) {
    storeStudentsBody.innerHTML = '<tr><td colspan="6" class="muted">Loading store transactions...</td></tr>';
    try {
      const sSnap = await db.collection('students').orderBy('name').get();
      allStoreStudentsCache = [];
      sSnap.forEach((doc) => allStoreStudentsCache.push({ id: doc.id, ...doc.data() }));
      renderStoreStudentsTable(allStoreStudentsCache);
    } catch (err) {
      storeStudentsBody.innerHTML = `<tr><td colspan="6" class="danger">Error loading store transactions.</td></tr>`;
    }
  }
}

if (addProductForm) {
  addProductForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('pName').value.trim();
    const price = Number(document.getElementById('pPrice').value);
    const btn = addProductForm.querySelector('button');
    if (btn) btn.disabled = true;
    try {
      await db.collection('products').add({ name, price });
      addProductForm.reset();
      loadStoreData();
    } catch (err) {
      alert("Unable to save product.");
    }
    if (btn) btn.disabled = false;
  });
}

function renderProductsTable() {
  if (!productsBody) return;
  if (allProductsCache.length === 0) {
    productsBody.innerHTML = '<tr><td colspan="3" class="muted">Inventory catalog is empty.</td></tr>';
    return;
  }
  productsBody.innerHTML = '';
  allProductsCache.forEach((p) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="text-bold">${sanitizeOutput(p.name)}</td>
      <td>₹${p.price}</td>
      <td><button class="btn small danger" onclick="deleteProduct('${p.id}', '${sanitizeOutput(p.name)}')">Delete</button></td>
    `;
    productsBody.appendChild(tr);
  });
}

async function deleteProduct(id, name) {
  if (confirm(`Delete ${name} from inventory?`)) {
    await db.collection('products').doc(id).delete();
    loadStoreData();
  }
}

function renderStoreStudentsTable(students) {
  if (!storeStudentsBody) return;
  if (students.length === 0) {
    storeStudentsBody.innerHTML = '<tr><td colspan="6" class="muted">No student ledger data found.</td></tr>';
    return;
  }
  storeStudentsBody.innerHTML = '';

  students.forEach((student, index) => {
    const items = student.storeItems || [];
    const existingStorePaid = Number(student.storePaid) || 0;
    
    let storeTotalBill = 0;
    items.forEach(i => storeTotalBill += Number(i.price));
    const storeDue = Math.max(0, storeTotalBill - existingStorePaid);

    let itemsText = '';
    if (items.length > 0) {
      itemsText = items.map((item, itemIdx) => `
        <span class="store-item-badge" style="display:inline-flex; align-items:center; gap:4px; background:#EFE6DD; padding:2px 6px; border-radius:4px; font-size:11px; margin:2px;">
          ${sanitizeOutput(item.productName)} (₹${item.price})
          <button type="button" class="removeStoreItemBtn" data-student-id="${student.id}" data-item-index="${itemIdx}" style="background:none; border:none; color:#B22222; font-weight:bold; cursor:pointer; font-size:12px;" title="Remove Item">✕</button>
        </span>
      `).join('');
    } else {
      itemsText = '<span class="muted table-text-muted">No items</span>';
    }

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${index + 1}. ${sanitizeOutput(student.name)}</strong></td>
      <td>${itemsText}</td>
      <td class="text-bold">₹${storeTotalBill}</td>
      <td class="success">
        ₹${existingStorePaid}
        ${existingStorePaid > 0 ? `<div style="margin-top:4px;"><button class="resetStorePaidBtn" style="background:none; border:none; color:var(--danger); font-size:10px; font-weight:bold; cursor:pointer; padding:0;" title="Reset Paid to Zero">↺ Reset 0</button></div>` : ''}
      </td>
      <td class="${storeDue > 0 ? 'danger' : 'success'} text-bold">₹${storeDue}</td>
      <td>
        <input type="number" class="storePaidInput input-ledger-action" min="0" step="1" placeholder="+ Add ₹">
        <button class="btn small primary storeUpdateBtn" title="Add Payment">Add</button>
        <button class="btn small ghost assignBtn" title="Assign Item">🛍️ Assign</button>
      </td>
    `;

    // 1. Payment Accumulation (Plus karna)
    tr.querySelector('.storeUpdateBtn').addEventListener('click', async () => {
      const valInput = tr.querySelector('.storePaidInput').value;
      if (valInput === '') return;
      const newPayment = Number(valInput) || 0;
      const updatedStorePaid = existingStorePaid + newPayment;

      await db.collection('students').doc(student.id).update({ storePaid: updatedStorePaid });
      loadStoreData(); 
    });

    // 2. Manual Reset Paid Amount Feature
    const resetBtn = tr.querySelector('.resetStorePaidBtn');
    if (resetBtn) {
      resetBtn.addEventListener('click', async () => {
        if (confirm('Kya aap is student ka paid amount zero (0) karna chahte hain?')) {
          await db.collection('students').doc(student.id).update({ storePaid: 0 });
          loadStoreData();
        }
      });
    }

    // 3. Remove Specific Product Feature (AND AUTO-RESET)
    tr.querySelectorAll('.removeStoreItemBtn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const sId = btn.getAttribute('data-student-id');
        const idx = Number(btn.getAttribute('data-item-index'));
        
        if (confirm('Remove this product from student account?')) {
          const targetStudent = allStoreStudentsCache.find(s => s.id === sId);
          if (targetStudent && targetStudent.storeItems) {
            const updatedItems = [...targetStudent.storeItems];
            updatedItems.splice(idx, 1);
            
            // AUTOMATIC RESET LOGIC: Agar saare items delete ho gaye hain, toh paid amount ko bhi 0 kardo
            let updatedPaid = existingStorePaid;
            if (updatedItems.length === 0) {
              updatedPaid = 0; // Sab shuru jaisa ho gaya
            }
            
            await db.collection('students').doc(sId).update({ 
              storeItems: updatedItems,
              storePaid: updatedPaid 
            });
            loadStoreData();
          }
        }
      });
    });

    tr.querySelector('.assignBtn').addEventListener('click', () => {
      openAssignModal(student);
    });

    storeStudentsBody.appendChild(tr);
  });
}

function openAssignModal(student) {
  if (allProductsCache.length === 0) {
    alert('Please register inventory items before assigning.');
    return;
  }
  document.getElementById('assignStudentId').value = student.id;
  document.getElementById('assignModalStudentName').textContent = `Assign to: ${student.name}`;

  const select = document.getElementById('assignProductSelect');
  select.innerHTML = '<option value="">-- Select Product --</option>';
  allProductsCache.forEach((p) => {
    const opt = document.createElement('option');
    opt.value = `${p.name}|${p.price}`;
    opt.textContent = `${p.name} - ₹${p.price}`;
    select.appendChild(opt);
  });

  document.getElementById('assignProductModal').style.display = 'flex';
}

function closeAssignModal() {
  document.getElementById('assignProductModal').style.display = 'none';
}

const assignProductForm = document.getElementById('assignProductForm');
if (assignProductForm) {
  assignProductForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const studentId = document.getElementById('assignStudentId').value;
    const productVal = document.getElementById('assignProductSelect').value;
    if (!productVal) return;

    const [pName, pPrice] = productVal.split('|');
    const newItem = { productName: pName, price: Number(pPrice), date: new Date().toISOString() };

    try {
      await db.collection('students').doc(studentId).update({
        storeItems: firebase.firestore.FieldValue.arrayUnion(newItem)
      });
      closeAssignModal();
      loadStoreData();
    } catch (error) {
      alert('Failed to register product assignment.');
    }
  });
}

// --- Modal Operations and Entity Mutations ---
function openEditModal(student) {
  document.getElementById('editStudentId').value = student.id;
  document.getElementById('editName').value = student.name || '';
  document.getElementById('editDate').value = student.admissionDate || '';
  document.getElementById('editEmail').value = student.email || '';
  document.getElementById('editPassword').value = student.password || '';
  document.getElementById('editTotalFee').value = student.totalFee || 0;
  document.getElementById('editDiscount').value = student.discount || 0;

  document.getElementById('editStudentModal').style.display = 'flex';
}

function closeEditModal() {
  document.getElementById('editStudentModal').style.display = 'none';
}

async function updateStudentDatabase() {
  const id = document.getElementById('editStudentId').value;
  const newName = document.getElementById('editName').value;
  const newDate = document.getElementById('editDate').value;
  const newEmail = document.getElementById('editEmail').value;
  const newPassword = document.getElementById('editPassword').value;
  const newTotalFee = Number(document.getElementById('editTotalFee').value);
  const newDiscount = Number(document.getElementById('editDiscount').value);

  try {
    await db.collection('students').doc(id).update({
      name: newName,
      admissionDate: newDate,
      email: newEmail,
      password: newPassword,
      totalFee: newTotalFee,
      discount: newDiscount
    });
    closeEditModal();
    loadStudents();
  } catch (error) {
    alert("Unable to update student records.");
  }
}

// --- Search Filter Handlers ---
if (searchInput) {
  searchInput.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase().trim();
    const filtered = allStudentsCache.filter((s) => {
      return (s.name || '').toLowerCase().includes(query) || (s.email || '').toLowerCase().includes(query);
    });
    renderStudentsLedger(filtered);
  });
}

if (searchStoreInput) {
  searchStoreInput.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase().trim();
    const filtered = allStoreStudentsCache.filter((s) => {
      return (s.name || '').toLowerCase().includes(query);
    });
    renderStoreStudentsTable(filtered);
  });
}

// --- Examination Result Management ---
const resultModalDialog = document.getElementById('resultModal');
function openResultEditor(student) {
  document.getElementById('resultStudentId').value = student.id;
  if (student.result && student.result.isPublished) {
    document.getElementById('rMarks').value = student.result.marks || '';
    document.getElementById('rGrade').value = student.result.grade || '';
    document.getElementById('rStatus').value = student.result.status || 'PASS';
  } else {
    document.getElementById('rMarks').value = '';
    document.getElementById('rGrade').value = '';
    document.getElementById('rStatus').value = 'PASS';
  }
  if (resultModalDialog) resultModalDialog.style.display = 'flex';
}

const closeResultModalBtn = document.getElementById('closeResultModal');
if (closeResultModalBtn) {
  closeResultModalBtn.addEventListener('click', () => {
    if (resultModalDialog) resultModalDialog.style.display = 'none';
  });
}

const resultForm = document.getElementById('resultForm');
if (resultForm) {
  resultForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('resultStudentId').value;
    await db.collection('students').doc(id).update({
      result: {
        marks: document.getElementById('rMarks').value.trim(),
        grade: document.getElementById('rGrade').value.trim().toUpperCase(),
        status: document.getElementById('rStatus').value,
        isPublished: true
      }
    });
    if (resultModalDialog) resultModalDialog.style.display = 'none';
    loadStudents();
  });
}

const btnRemoveResult = document.getElementById('btnRemoveResult');
if (btnRemoveResult) {
  btnRemoveResult.addEventListener('click', async () => {
    const id = document.getElementById('resultStudentId').value;
    if (confirm('Unpublish and clear examination results?')) {
      await db.collection('students').doc(id).update({ result: null });
      if (resultModalDialog) resultModalDialog.style.display = 'none';
      loadStudents();
    }
  });
}

// --- Sanitization and Error Translation Helpers ---
function formatAuthErrorMessage(code) {
  switch (code) {
    case 'auth/email-already-in-use': return 'The provided email is already registered.';
    case 'auth/invalid-email': return 'Malformed email address provided.';
    case 'auth/weak-password': return 'Password must be at least 6 characters.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential': return 'Invalid email or password.';
    default: return 'Unable to process authentication request.';
  }
}

function sanitizeOutput(str) {
  const container = document.createElement('div');
  container.textContent = str;
  return container.innerHTML;
}
