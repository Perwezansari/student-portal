// ============================================================
// Admin Portal Core Application Logic (With Batch & Premium Animations)
// ============================================================

// Dynamically inject SweetAlert2 so admin.html doesn't need changes if missing
if (typeof Swal === 'undefined') {
  const script = document.createElement('script');
  script.src = "https://cdn.jsdelivr.net/npm/sweetalert2@11";
  document.head.appendChild(script);
}

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
const batchFilter = document.getElementById('batchFilter'); 
const searchStoreInput = document.getElementById('searchStoreInput');
const storeBatchFilter = document.getElementById('storeBatchFilter'); // Naya Store Batch Filter

let allStudentsCache = [];
let allProductsCache = []; 
let allStoreStudentsCache = [];

auth.setPersistence(firebase.auth.Auth.Persistence.SESSION).catch(() => {});

// --- Navigation Controllers ---
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

function resetAdminLoginForm() {
  if (loginForm) loginForm.reset();
  const submitBtn = loginForm ? loginForm.querySelector('button[type="submit"]') : null;
  if (submitBtn) {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Login to Admin Panel';
  }
}

// --- Authentication State Observer ---
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

// NAYA: Animated Logout Confirmation
if (logoutBtn) {
  logoutBtn.addEventListener('click', () => {
    if(typeof Swal !== 'undefined') {
      Swal.fire({
        title: 'Logout?',
        text: "Are you sure you want to exit the admin panel?",
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#78202B',
        cancelButtonColor: '#7A6E6D',
        confirmButtonText: 'Yes, Logout'
      }).then(async (result) => {
        if (result.isConfirmed) {
          resetAdminLoginForm();
          await auth.signOut();
        }
      });
    } else {
      if(confirm('Are you sure you want to exit?')){
        resetAdminLoginForm();
        auth.signOut();
      }
    }
  });
}

// --- Helper: Update Batch Dropdowns ---
function updateBatchDropdown() {
  const uniqueBatches = [...new Set(allStudentsCache.map(s => s.batch || 'Batch A'))].sort();
  
  // 1. Main Dashboard Batch Filter
  if (batchFilter) {
    const currentVal = batchFilter.value;
    batchFilter.innerHTML = '<option value="ALL">All Batches</option>';
    uniqueBatches.forEach(b => {
      const opt = document.createElement('option');
      opt.value = b;
      opt.textContent = `📁 ${b}`;
      batchFilter.appendChild(opt);
    });
    batchFilter.value = (uniqueBatches.includes(currentVal) || currentVal === 'ALL') ? currentVal : 'ALL';
  }

  // 2. Store Dashboard Batch Filter
  if (storeBatchFilter) {
    const currentStoreVal = storeBatchFilter.value;
    storeBatchFilter.innerHTML = '<option value="ALL">All Batches</option>';
    uniqueBatches.forEach(b => {
      const opt = document.createElement('option');
      opt.value = b;
      opt.textContent = `📁 ${b}`;
      storeBatchFilter.appendChild(opt);
    });
    storeBatchFilter.value = (uniqueBatches.includes(currentStoreVal) || currentStoreVal === 'ALL') ? currentStoreVal : 'ALL';
  }
}

// --- Student Registration Logic ---
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
    const batch = document.getElementById('sBatch').value.trim() || 'Batch A'; 
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

      const newStudentData = {
        name, batch, admissionDate, totalFee, discount, paidFee,
        email, password, result: null, storeItems: [], storePaid: 0
      };

      await db.collection('students').doc(uid).set(newStudentData);

      if (addStatus) {
        addStatus.textContent = `Student ${name} successfully enrolled.`;
        addStatus.className = 'status success';
      }
      addForm.reset();
      
      const discElem = document.getElementById('sDiscount');
      const paidElem = document.getElementById('sPaid');
      if (discElem) discElem.value = 0;
      if (paidElem) paidElem.value = 0;
      
      allStudentsCache.push({ id: uid, ...newStudentData });
      updateBatchDropdown();
      applyFilters(); 
      
      if(typeof Swal !== 'undefined') Swal.fire({ title: 'Success!', text: 'Student enrolled successfully.', icon: 'success', timer: 2000, showConfirmButton: false });
    } catch (err) {
      if (addStatus) {
        addStatus.textContent = formatAuthErrorMessage(err.code) || 'Unable to register student.';
        addStatus.className = 'status danger';
      }
      if(typeof Swal !== 'undefined') Swal.fire('Error', formatAuthErrorMessage(err.code), 'error');
    } finally {
      if (secondaryApp) {
        try { await secondaryApp.delete(); } catch (_) {}
      }
      if (submitBtn) submitBtn.disabled = false;
    }
  });
}

async function loadStudents() {
  if (!studentsBody) return;
  if (allStudentsCache.length === 0) {
    studentsBody.innerHTML = '<tr><td colspan="8" class="muted">Loading records...</td></tr>';
  }
  try {
    const snapshot = await db.collection('students').orderBy('name').get();
    allStudentsCache = [];
    snapshot.forEach((doc) => {
      allStudentsCache.push({ id: doc.id, ...doc.data() });
    });
    updateBatchDropdown();
    applyFilters(); 
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
  
  updateSummaryMetrics(students);

  if (students.length === 0) {
    studentsBody.innerHTML = '<tr><td colspan="8" class="muted">No records found for selected filter.</td></tr>';
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
    const displayBatch = d.batch || 'Batch A'; 

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>
        <strong>${serialNumber}. ${sanitizeOutput(d.name || '-')}</strong>
        <div class="table-sub-email" style="color:var(--gold); font-weight:700;">🏷️ ${sanitizeOutput(displayBatch)}</div>
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
            <button class="btn small ghost certBtn" type="button" title="Issue Certificate" style="color:#C49A45; border-color:#C49A45;">🎓 Cert</button>
            <button class="btn small danger removeBtn" type="button" title="Delete Record">✕</button>
          </div>
        </div>
      </td>
    `;

    tr.querySelector('.updateBtn').addEventListener('click', async () => {
      const valInput = tr.querySelector('.paidInput').value;
      if (valInput === '') return;
      const newPayment = Number(valInput) || 0;
      d.paidFee = paid + newPayment;
      applyFilters();
      db.collection('students').doc(d.id).update({ paidFee: d.paidFee });
    });

    tr.querySelector('.resultBtn').addEventListener('click', () => { openResultEditor(d); });
    tr.querySelector('.editBtn').addEventListener('click', () => { openEditModal(d); });
    tr.querySelector('.certBtn').addEventListener('click', () => { openCertModal(d); });
    
    tr.querySelector('.removeBtn').addEventListener('click', () => {
      if(typeof Swal !== 'undefined') {
        Swal.fire({
          title: 'Delete Student?',
          text: `Remove records for ${d.name}? (Certificate will remain active)`,
          icon: 'warning',
          showCancelButton: true,
          confirmButtonColor: '#B22222',
          cancelButtonColor: '#7A6E6D',
          confirmButtonText: 'Yes, delete it!'
        }).then((result) => {
          if (result.isConfirmed) {
            allStudentsCache = allStudentsCache.filter(s => s.id !== d.id);
            updateBatchDropdown();
            applyFilters();
            db.collection('students').doc(d.id).delete();
            Swal.fire('Deleted!', `${d.name}'s portal records have been removed.`, 'success');
          }
        });
      } else {
        if (confirm(`Remove records for ${d.name}?`)) {
          allStudentsCache = allStudentsCache.filter(s => s.id !== d.id);
          updateBatchDropdown();
          applyFilters();
          db.collection('students').doc(d.id).delete();
        }
      }
    });
    studentsBody.appendChild(tr);
  });
}

// --- Master Search & Batch Filter Logic ---
function applyFilters() {
  const query = searchInput ? searchInput.value.toLowerCase().trim() : '';
  const batch = batchFilter ? batchFilter.value : 'ALL';

  const filtered = allStudentsCache.filter(s => {
    const matchQuery = (s.name || '').toLowerCase().includes(query) || (s.email || '').toLowerCase().includes(query);
    const matchBatch = (batch === 'ALL') || ((s.batch || 'Batch A') === batch);
    return matchQuery && matchBatch;
  });
  renderStudentsLedger(filtered);
}

if (searchInput) searchInput.addEventListener('input', applyFilters);
if (batchFilter) batchFilter.addEventListener('change', applyFilters);

// --- NAYA: Store Master Search & Batch Filter Logic ---
function applyStoreFilters() {
  const query = searchStoreInput ? searchStoreInput.value.toLowerCase().trim() : '';
  const batch = storeBatchFilter ? storeBatchFilter.value : 'ALL';

  const filtered = allStoreStudentsCache.filter(s => {
    const matchQuery = (s.name || '').toLowerCase().includes(query);
    const matchBatch = (batch === 'ALL') || ((s.batch || 'Batch A') === batch);
    return matchQuery && matchBatch;
  });
  renderStoreStudentsTable(filtered);
}

if (searchStoreInput) searchStoreInput.addEventListener('input', applyStoreFilters);
if (storeBatchFilter) storeBatchFilter.addEventListener('change', applyStoreFilters);

// --- Store Inventory & Ledgers ---
const productsBody = document.getElementById('productsBody');
const storeStudentsBody = document.getElementById('storeStudentsBody');
const addProductForm = document.getElementById('addProductForm');

async function loadStoreData() {
  if (productsBody && allProductsCache.length === 0) productsBody.innerHTML = '<tr><td colspan="3" class="muted">Loading catalog...</td></tr>';
  try {
    const pSnap = await db.collection('products').orderBy('name').get();
    allProductsCache = [];
    pSnap.forEach((doc) => allProductsCache.push({ id: doc.id, ...doc.data() }));
    renderProductsTable();
  } catch (err) { }
  
  if (storeStudentsBody && allStoreStudentsCache.length === 0) storeStudentsBody.innerHTML = '<tr><td colspan="6" class="muted">Loading store transactions...</td></tr>';
  try {
    const sSnap = await db.collection('students').orderBy('name').get();
    allStoreStudentsCache = [];
    sSnap.forEach((doc) => allStoreStudentsCache.push({ id: doc.id, ...doc.data() }));
    applyStoreFilters(); // Render with filters applied
  } catch (err) { }
}

if (addProductForm) {
  addProductForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('pName').value.trim();
    const price = Number(document.getElementById('pPrice').value);
    const btn = addProductForm.querySelector('button');
    if (btn) btn.disabled = true;
    try {
      const docRef = await db.collection('products').add({ name, price });
      allProductsCache.push({ id: docRef.id, name, price });
      renderProductsTable();
      addProductForm.reset();
      if(typeof Swal !== 'undefined') Swal.fire({ title: 'Added', text: 'Product added successfully', icon: 'success', timer: 1500, showConfirmButton: false });
    } catch (err) {}
    if (btn) btn.disabled = false;
  });
}

function renderProductsTable() {
  if (!productsBody) return;
  productsBody.innerHTML = allProductsCache.length === 0 ? '<tr><td colspan="3" class="muted">Inventory catalog is empty.</td></tr>' : '';
  allProductsCache.forEach((p) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td class="text-bold">${sanitizeOutput(p.name)}</td><td>₹${p.price}</td><td><button class="btn small danger" onclick="deleteProduct('${p.id}', '${sanitizeOutput(p.name)}')">Delete</button></td>`;
    productsBody.appendChild(tr);
  });
}

async function deleteProduct(id, name) {
  if(typeof Swal !== 'undefined') {
    Swal.fire({ title: 'Delete Product?', text: `Remove ${name}?`, icon: 'warning', showCancelButton: true, confirmButtonColor: '#B22222', confirmButtonText: 'Yes, delete it!' })
      .then((result) => { if (result.isConfirmed) { allProductsCache = allProductsCache.filter(p => p.id !== id); renderProductsTable(); db.collection('products').doc(id).delete(); } });
  } else {
    if(confirm(`Remove ${name}?`)) { allProductsCache = allProductsCache.filter(p => p.id !== id); renderProductsTable(); db.collection('products').doc(id).delete(); }
  }
}

function renderStoreStudentsTable(students) {
  if (!storeStudentsBody) return;
  storeStudentsBody.innerHTML = students.length === 0 ? '<tr><td colspan="6" class="muted">No student records found.</td></tr>' : '';
  students.forEach((student, index) => {
    const items = student.storeItems || [];
    const existingStorePaid = Number(student.storePaid) || 0;
    const displayBatch = student.batch || 'Batch A'; // Show batch in store

    let storeTotalBill = 0;
    items.forEach(i => storeTotalBill += Number(i.price));
    const storeDue = Math.max(0, storeTotalBill - existingStorePaid);
    
    let itemsText = items.length > 0 ? items.map((item, itemIdx) => `<span class="store-item-badge" style="display:inline-flex; align-items:center; background:#F8F4EE; border:1px solid #EADBCC; padding:4px 10px; border-radius:20px; font-size:11.5px; font-weight:600; margin:3px; color:var(--primary);">${sanitizeOutput(item.productName)} <span style="opacity:0.65; font-weight:500; margin-left:3px;">(₹${item.price})</span><button type="button" class="removeStoreItemBtn" data-student-id="${student.id}" data-item-index="${itemIdx}" style="background:transparent; border:none; color:#B22222; font-weight:bold; cursor:pointer; font-size:15px; margin-left:6px; padding:0; line-height:1; display:flex; align-items:center; opacity:0.6; transition:0.2s;">×</button></span>`).join('') : '<span class="muted table-text-muted">No items</span>';

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>
        <strong>${index + 1}. ${sanitizeOutput(student.name)}</strong>
        <div style="font-size:11px; font-weight:bold; color:var(--gold); margin-top:2px;">🏷️ ${sanitizeOutput(displayBatch)}</div>
      </td>
      <td>${itemsText}</td>
      <td class="text-bold">₹${storeTotalBill}</td>
      <td class="success text-bold">₹${existingStorePaid}</td>
      <td class="${storeDue > 0 ? 'danger' : 'success'} text-bold">₹${storeDue}</td>
      <td>
        <input type="number" class="storePaidInput input-ledger-action" min="0" step="1" placeholder="+ Add ₹">
        <button class="btn small primary storeUpdateBtn" title="Add Payment">Add</button> 
        <button class="btn small ghost assignBtn" title="Assign Item">🛍️ Assign</button>
      </td>
    `;
    
    tr.querySelector('.storeUpdateBtn').addEventListener('click', () => {
      const valInput = tr.querySelector('.storePaidInput').value;
      if (valInput === '') return;
      student.storePaid = existingStorePaid + (Number(valInput) || 0);
      applyStoreFilters();
      db.collection('students').doc(student.id).update({ storePaid: student.storePaid });
    });

    tr.querySelectorAll('.removeStoreItemBtn').forEach(btn => {
      btn.addEventListener('click', () => {
        const sId = btn.getAttribute('data-student-id');
        const idx = Number(btn.getAttribute('data-item-index'));
        const action = () => { const t = allStoreStudentsCache.find(s => s.id === sId); if(t && t.storeItems) { t.storeItems.splice(idx, 1); if(t.storeItems.length === 0) t.storePaid = 0; applyStoreFilters(); db.collection('students').doc(sId).update({ storeItems: t.storeItems, storePaid: t.storePaid }); } };
        if(typeof Swal !== 'undefined') Swal.fire({ title: 'Remove Item?', text: 'Remove from account?', icon: 'question', showCancelButton: true, confirmButtonColor: '#C49A45', confirmButtonText: 'Yes' }).then((r) => { if(r.isConfirmed) action(); });
        else if (confirm('Remove this product?')) action();
      });
    });
    tr.querySelector('.assignBtn').addEventListener('click', () => { openAssignModal(student); });
    storeStudentsBody.appendChild(tr);
  });
}

function openAssignModal(student) {
  if (allProductsCache.length === 0) {
    if(typeof Swal !== 'undefined') Swal.fire('Notice', 'Please register inventory items before assigning.', 'info');
    else alert('Please register inventory items before assigning.');
    return;
  }
  document.getElementById('assignStudentId').value = student.id;
  document.getElementById('assignModalStudentName').textContent = `Assign to: ${student.name}`;
  const select = document.getElementById('assignProductSelect');
  select.innerHTML = '<option value="">-- Select Product --</option>';
  allProductsCache.forEach((p) => {
    const opt = document.createElement('option'); opt.value = `${p.name}|${p.price}`; opt.textContent = `${p.name} - ₹${p.price}`; select.appendChild(opt);
  });
  document.getElementById('assignProductModal').style.display = 'flex';
}
function closeAssignModal() { document.getElementById('assignProductModal').style.display = 'none'; }

const assignProductForm = document.getElementById('assignProductForm');
if (assignProductForm) {
  assignProductForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const studentId = document.getElementById('assignStudentId').value;
    const productVal = document.getElementById('assignProductSelect').value;
    if (!productVal) return;
    const [pName, pPrice] = productVal.split('|');
    const newItem = { productName: pName, price: Number(pPrice), date: new Date().toISOString() };
    
    closeAssignModal();
    const targetStudent = allStoreStudentsCache.find(s => s.id === studentId);
    if (targetStudent) { 
      if (!targetStudent.storeItems) targetStudent.storeItems = []; 
      targetStudent.storeItems.push(newItem); 
      applyStoreFilters(); 
    }
    db.collection('students').doc(studentId).update({ storeItems: firebase.firestore.FieldValue.arrayUnion(newItem) }).then(() => {
      // NAYA: Animation on successful assignment
      if(typeof Swal !== 'undefined') Swal.fire({ title: 'Assigned!', text: `${pName} added to student's account.`, icon: 'success', timer: 1500, showConfirmButton: false });
    }).catch(err => {
      if(typeof Swal !== 'undefined') Swal.fire('Error', 'Failed to sync.', 'error'); else alert('Failed to sync.');
    });
  });
}

// --- Dynamic Entity Update (Includes Editable Batch) ---
function openEditModal(student) {
  document.getElementById('editStudentId').value = student.id;
  document.getElementById('editName').value = student.name || '';
  document.getElementById('editBatch').value = student.batch || 'Batch A'; 
  document.getElementById('editDate').value = student.admissionDate || '';
  document.getElementById('editEmail').value = student.email || '';
  document.getElementById('editPassword').value = student.password || '';
  document.getElementById('editTotalFee').value = student.totalFee || 0;
  document.getElementById('editDiscount').value = student.discount || 0;
  document.getElementById('editPaidFee').value = student.paidFee || 0;
  document.getElementById('editStudentModal').style.display = 'flex';
}

function closeEditModal() { document.getElementById('editStudentModal').style.display = 'none'; }

async function updateStudentDatabase() {
  const id = document.getElementById('editStudentId').value;
  const newName = document.getElementById('editName').value.trim();
  const newBatch = document.getElementById('editBatch').value.trim() || 'Batch A';
  const newDate = document.getElementById('editDate').value;
  const newEmail = document.getElementById('editEmail').value.trim();
  const newPassword = document.getElementById('editPassword').value;
  const newTotalFee = Number(document.getElementById('editTotalFee').value);
  const newDiscount = Number(document.getElementById('editDiscount').value);
  const newPaidFee = Number(document.getElementById('editPaidFee').value);

  closeEditModal();

  const studentObj = allStudentsCache.find(s => s.id === id);
  if (studentObj) {
    studentObj.name = newName;
    studentObj.batch = newBatch;
    studentObj.admissionDate = newDate;
    studentObj.email = newEmail;
    studentObj.password = newPassword;
    studentObj.totalFee = newTotalFee;
    studentObj.discount = newDiscount;
    studentObj.paidFee = newPaidFee; 
    
    updateBatchDropdown();
    applyFilters();
  }
  const storeStudentObj = allStoreStudentsCache.find(s => s.id === id);
  if (storeStudentObj) {
    storeStudentObj.name = newName;
    storeStudentObj.batch = newBatch;
    applyStoreFilters();
  }

  db.collection('students').doc(id).update({
    name: newName, batch: newBatch, admissionDate: newDate, email: newEmail, password: newPassword, totalFee: newTotalFee, discount: newDiscount, paidFee: newPaidFee
  }).then(() => {
    if(typeof Swal !== 'undefined') Swal.fire({ title: 'Updated!', text: 'Records updated.', icon: 'success', timer: 1500, showConfirmButton: false });
  }).catch(error => {
    if(typeof Swal !== 'undefined') Swal.fire('Error', "Sync failed.", 'error');
  });
}

// --- Examination Result Controllers ---
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
if (closeResultModalBtn) { closeResultModalBtn.addEventListener('click', () => { if (resultModalDialog) resultModalDialog.style.display = 'none'; }); }

const resultForm = document.getElementById('resultForm');
if (resultForm) {
  resultForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const id = document.getElementById('resultStudentId').value;
    const newResult = { marks: document.getElementById('rMarks').value.trim(), grade: document.getElementById('rGrade').value.trim().toUpperCase(), status: document.getElementById('rStatus').value, isPublished: true };
    if (resultModalDialog) resultModalDialog.style.display = 'none';
    const target = allStudentsCache.find(s => s.id === id);
    if (target) { target.result = newResult; applyFilters(); }
    db.collection('students').doc(id).update({ result: newResult }).then(() => {
      if(typeof Swal !== 'undefined') Swal.fire({ title: 'Published!', text: 'Result saved.', icon: 'success', timer: 1500, showConfirmButton: false });
    });
  });
}

const btnRemoveResult = document.getElementById('btnRemoveResult');
if (btnRemoveResult) {
  btnRemoveResult.addEventListener('click', () => {
    const id = document.getElementById('resultStudentId').value;
    const action = () => {
      if (resultModalDialog) resultModalDialog.style.display = 'none';
      const target = allStudentsCache.find(s => s.id === id);
      if (target) { target.result = null; applyFilters(); }
      db.collection('students').doc(id).update({ result: null });
      if(typeof Swal !== 'undefined') Swal.fire('Cleared!', 'Result unpublished.', 'success');
    };
    if(typeof Swal !== 'undefined') Swal.fire({ title: 'Unpublish Result?', text: 'Clear results?', icon: 'warning', showCancelButton: true, confirmButtonColor: '#B22222', confirmButtonText: 'Yes' }).then((r) => { if(r.isConfirmed) action(); });
    else if (confirm('Clear examination results?')) action();
  });
}

// ============================================================
// Certificate Generation Logic (Smart Edit & Delete)
// ============================================================
const certModal = document.getElementById('certModal');
const certForm = document.getElementById('certForm');
const certLinkResult = document.getElementById('certLinkResult');
const certGeneratedLink = document.getElementById('certGeneratedLink');
const btnDeleteCert = document.getElementById('btnDeleteCert');

function closeCertModal() {
  if (certModal) certModal.style.display = 'none';
  if (certLinkResult) certLinkResult.style.display = 'none';
}

function openCertModal(student) {
  document.getElementById('certStudentId').value = student.id;
  document.getElementById('certStudentNameInput').value = student.name;
  document.getElementById('certModalStudentName').textContent = `Issue to: ${student.name}`;
  
  const submitBtn = certForm.querySelector('button[type="submit"]');
  const existIdInput = document.getElementById('existingCertId');

  if (student.certificate) {
    if (existIdInput) existIdInput.value = student.certificate.id;
    document.getElementById('certNumber').value = student.certificate.certNumber || '';
    document.getElementById('certCourse').value = student.certificate.courseName || '';
    document.getElementById('certDate').value = student.certificate.issueDate || '';
    
    certGeneratedLink.value = student.certificate.url || '';
    certLinkResult.style.display = 'flex';
    if (submitBtn) submitBtn.textContent = 'Update Certificate';
    if (btnDeleteCert) btnDeleteCert.style.display = 'block';
  } else {
    if (existIdInput) existIdInput.value = '';
    document.getElementById('certNumber').value = '';
    document.getElementById('certCourse').value = '';
    document.getElementById('certDate').value = new Date().toISOString().split('T')[0];
    
    certLinkResult.style.display = 'none';
    if (submitBtn) submitBtn.textContent = 'Generate & Save Certificate';
    if (btnDeleteCert) btnDeleteCert.style.display = 'none';
  }
  certModal.style.display = 'flex';
}

if (certForm) {
  certForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = certForm.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = 'Processing...';

    const studentId = document.getElementById('certStudentId').value;
    const sName = document.getElementById('certStudentNameInput').value;
    const rawCertNo = document.getElementById('certNumber').value.trim();
    const sCourse = document.getElementById('certCourse').value.trim();
    const sDate = document.getElementById('certDate').value;
    
    const existIdInput = document.getElementById('existingCertId');
    const existingId = existIdInput ? existIdInput.value : '';
    
    const generateSecureId = () => {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
      let r = ''; for (let i = 0; i < 16; i++) r += chars.charAt(Math.floor(Math.random() * chars.length)); return 'VERIFY-' + r; 
    };
    const secureDocId = existingId ? existingId : generateSecureId();

    try {
      const baseUrl = window.location.href.split('/').slice(0, -1).join('/');
      const verifyLink = `${baseUrl}/verify.html?id=${secureDocId}`;

      await db.collection('certificates').doc(secureDocId).set({ certNumber: rawCertNo, studentName: sName, courseName: sCourse, issueDate: sDate, timestamp: firebase.firestore.FieldValue.serverTimestamp() });

      const certDataObj = { id: secureDocId, certNumber: rawCertNo, courseName: sCourse, issueDate: sDate, url: verifyLink };
      await db.collection('students').doc(studentId).update({ certificate: certDataObj });

      const targetStudent = allStudentsCache.find(s => s.id === studentId);
      if (targetStudent) targetStudent.certificate = certDataObj;
      
      if (existIdInput) existIdInput.value = secureDocId;
      certGeneratedLink.value = verifyLink;
      certLinkResult.style.display = 'flex';
      certGeneratedLink.select();
      if (btnDeleteCert) btnDeleteCert.style.display = 'block';
      
      if(typeof Swal !== 'undefined') Swal.fire({ title: 'Success!', text: 'Certificate saved.', icon: 'success', timer: 1500, showConfirmButton: false });
    } catch (error) {
      if(typeof Swal !== 'undefined') Swal.fire('Error', "Process failed: " + error.message, 'error'); else alert("Error: " + error.message);
    } finally {
      btn.disabled = false;
      btn.textContent = existingId ? 'Update Certificate' : 'Generate & Save Certificate';
    }
  });
}

if (btnDeleteCert) {
  btnDeleteCert.addEventListener('click', () => {
    const studentId = document.getElementById('certStudentId').value;
    const existingId = document.getElementById('existingCertId').value;

    const action = async () => {
      btnDeleteCert.textContent = "Deleting...";
      try {
        await db.collection('certificates').doc(existingId).delete();
        await db.collection('students').doc(studentId).update({ certificate: firebase.firestore.FieldValue.delete() });
        const targetStudent = allStudentsCache.find(s => s.id === studentId);
        if (targetStudent) delete targetStudent.certificate;
        closeCertModal();
        if(typeof Swal !== 'undefined') Swal.fire('Revoked!', 'Certificate deleted.', 'success'); else alert('Certificate deleted.');
      } catch (error) {
        if(typeof Swal !== 'undefined') Swal.fire('Error', error.message, 'error'); else alert(error.message);
      } finally {
        btnDeleteCert.textContent = "🗑️ Revoke & Delete Certificate";
      }
    };

    if(typeof Swal !== 'undefined') {
      Swal.fire({ title: 'Revoke Certificate?', text: "Permanent Action! QR will stop working.", icon: 'warning', showCancelButton: true, confirmButtonColor: '#B22222', confirmButtonText: 'Yes, Revoke it!' }).then((result) => { if (result.isConfirmed) action(); });
    } else {
      if(confirm("QR Code will stop working permanently. Proceed?")) action();
    }
  });
}

function formatAuthErrorMessage(code) {
  switch (code) {
    case 'auth/email-already-in-use': return 'Email already registered.';
    case 'auth/invalid-email': return 'Malformed email address.';
    case 'auth/weak-password': return 'Password must be min 6 characters.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential': return 'Invalid credentials.';
    default: return 'Authentication failed.';
  }
}

function sanitizeOutput(str) {
  const container = document.createElement('div');
  container.textContent = str;
  return container.innerHTML;
}