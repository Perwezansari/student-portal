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
const storeBatchFilter = document.getElementById('storeBatchFilter');
const exportLedgerBtn = document.getElementById('exportLedgerBtn');

let isMainPendingFilterActive = false;
let isStorePendingFilterActive = false;
const pendingMainFilterBtn = document.getElementById('pendingMainFilterBtn');
const pendingStoreFilterBtn = document.getElementById('pendingStoreFilterBtn');

let allStudentsCache = [];
let allProductsCache = []; 
let allStoreStudentsCache = [];
let currentActiveProfileStudent = null; 

auth.setPersistence(firebase.auth.Auth.Persistence.SESSION).catch(function() {});

const navToStoreBtn = document.getElementById('navToStoreBtn');
if (navToStoreBtn) {
  navToStoreBtn.addEventListener('click', function() {
    if (dashboardView) dashboardView.style.display = 'none';
    if (storeDashboardView) storeDashboardView.style.display = 'block';
    loadStoreData();
  });
}

const navToMainBtn = document.getElementById('navToMainBtn');
if (navToMainBtn) {
  navToMainBtn.addEventListener('click', function() {
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

auth.onAuthStateChanged(async function(user) {
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

loginForm.addEventListener('submit', async function(e) {
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
  logoutBtn.addEventListener('click', function() {
    if (typeof Swal !== 'undefined') {
      Swal.fire({
        title: 'Logout?',
        text: "Are you sure you want to exit the admin panel?",
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#78202B',
        cancelButtonColor: '#7A6E6D',
        confirmButtonText: 'Yes, Logout'
      }).then(async function(result) {
        if (result.isConfirmed) {
          resetAdminLoginForm();
          await auth.signOut();
        }
      });
    } else {
      if (confirm('Are you sure you want to exit?')) {
        resetAdminLoginForm();
        auth.signOut();
      }
    }
  });
}

function updateBatchDropdown() {
  const uniqueBatches = [...new Set(allStudentsCache.map(s => s.batch || 'Batch A'))].sort();
  
  if (batchFilter) {
    const currentVal = batchFilter.value;
    batchFilter.innerHTML = '<option value="ALL">All Batches</option>';
    uniqueBatches.forEach(function(b) {
      const opt = document.createElement('option');
      opt.value = b;
      opt.textContent = `${b}`;
      batchFilter.appendChild(opt);
    });
    batchFilter.value = (uniqueBatches.includes(currentVal) || currentVal === 'ALL') ? currentVal : 'ALL';
  }

  if (storeBatchFilter) {
    const currentStoreVal = storeBatchFilter.value;
    storeBatchFilter.innerHTML = '<option value="ALL">All Batches</option>';
    uniqueBatches.forEach(function(b) {
      const opt = document.createElement('option');
      opt.value = b;
      opt.textContent = `${b}`;
      storeBatchFilter.appendChild(opt);
    });
    storeBatchFilter.value = (uniqueBatches.includes(currentStoreVal) || currentStoreVal === 'ALL') ? currentStoreVal : 'ALL';
  }
}

if (addForm) {
  addForm.addEventListener('submit', async function(e) {
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

      let paymentHistory = [];
      if (paidFee > 0) {
         paymentHistory.push({
             id: 'PAY-' + Date.now(),
             amount: paidFee,
             date: new Date().toISOString(),
             note: 'Initial Registration Payment'
         });
      }

      const newStudentData = {
        name: name,
        batch: batch,
        admissionDate: admissionDate,
        totalFee: totalFee,
        discount: discount,
        paidFee: paidFee,
        email: email,
        password: password,
        result: null,
        storeItems: [],
        storePaid: 0,
        paymentHistory: paymentHistory
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
      
      if (typeof Swal !== 'undefined') {
        Swal.fire({ 
          title: 'Success!', 
          text: 'Student enrolled successfully.', 
          icon: 'success', 
          timer: 2000, 
          showConfirmButton: false 
        });
      }
      
    } catch (err) {
      if (addStatus) {
        addStatus.textContent = formatAuthErrorMessage(err.code) || 'Unable to register student.';
        addStatus.className = 'status danger';
      }
      if (typeof Swal !== 'undefined') {
        Swal.fire('Error', formatAuthErrorMessage(err.code), 'error');
      }
    } finally {
      if (secondaryApp) {
        try { 
          await secondaryApp.delete(); 
        } catch (e) {
        }
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
    
    snapshot.forEach(function(doc) {
      allStudentsCache.push({ id: doc.id, ...doc.data() });
    });
    
    updateBatchDropdown();
    applyFilters(); 
    
  } catch (err) {
    studentsBody.innerHTML = `<tr><td colspan="8" class="danger text-bold">Error loading records: ${err.message}</td></tr>`;
  }
}

function updateSummaryMetrics(students) {
  let totalStudents = students.length;
  let totalPaid = 0;
  let totalDue = 0;
  let totalDiscount = 0;

  students.forEach(function(s) {
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

  students.forEach(function(d, index) {
    const total = Number(d.totalFee) || 0;
    const discount = Number(d.discount) || 0;
    
    let paid = 0;
    if (d.paymentHistory && d.paymentHistory.length > 0) {
       paid = d.paymentHistory.reduce((sum, record) => sum + Number(record.amount), 0);
       d.paidFee = paid; 
    } else {
       paid = Number(d.paidFee) || 0;
    }
    
    const net = Math.max(0, total - discount);
    const due = Math.max(0, net - paid);
    const serialNumber = index + 1;
    const displayBatch = d.batch || 'Batch A'; 

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>
        <strong>${serialNumber}. ${sanitizeOutput(d.name || '-')}</strong>
        <div class="table-sub-email" style="color:var(--gold); font-weight:700;">${sanitizeOutput(displayBatch)}</div>
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
            <input type="number" class="quickPaidInput input-ledger-action" min="1" step="1" placeholder="+ Add ₹" style="width: 80px;">
            <button class="btn small primary quickUpdateBtn" type="button" title="Quick Save Payment">Add</button>
          </div>
          <div class="action-row-group" style="margin-top: 5px;">
            <button class="btn small ghost viewStudentBtn" type="button" title="View Full Profile">View Profile</button>
          </div>
        </div>
      </td>
    `;

    tr.querySelector('.quickUpdateBtn').addEventListener('click', function() {
      const valInput = tr.querySelector('.quickPaidInput').value;
      if (valInput === '') return;
      
      const newPayment = Number(valInput) || 0;
      if (newPayment > 0) {
        processPayment(d.id, newPayment);
      }
    });

    tr.querySelector('.viewStudentBtn').addEventListener('click', function() { 
        openStudentProfileModal(d); 
    });
    
    studentsBody.appendChild(tr);
  });
}

async function processPayment(studentId, amount) {
    const targetStudent = allStudentsCache.find(s => s.id === studentId);
    if (!targetStudent) return;
    
    if (!targetStudent.paymentHistory) {
      targetStudent.paymentHistory = [];
    }
    
    if (targetStudent.paymentHistory.length === 0 && targetStudent.paidFee > 0) {
        targetStudent.paymentHistory.push({
            id: 'SYS-OLD',
            amount: targetStudent.paidFee,
            date: new Date().toISOString(),
            note: 'Previous System Transfer'
        });
    }

    const newPaymentRecord = {
        id: 'PAY-' + Date.now(),
        amount: amount,
        date: new Date().toISOString()
    };

    targetStudent.paymentHistory.push(newPaymentRecord);
    
    targetStudent.paidFee = targetStudent.paymentHistory.reduce((sum, record) => {
      return sum + Number(record.amount);
    }, 0);

    try {
        await db.collection('students').doc(studentId).update({ 
            paymentHistory: targetStudent.paymentHistory,
            paidFee: targetStudent.paidFee 
        });
        
        applyFilters(); 
        
        if (document.getElementById('viewStudentProfileModal').style.display === 'flex') {
             renderPaymentHistory(targetStudent);
        }
        
        if (typeof Swal !== 'undefined') {
          Swal.fire({ 
            title: 'Success', 
            text: `₹${amount} added successfully.`, 
            icon: 'success', 
            timer: 1500, 
            showConfirmButton: false 
          });
        }
    } catch (e) {
        if (typeof Swal !== 'undefined') {
          Swal.fire('Error', "Payment save failed.", 'error');
        }
    }
}

async function undoPayment(studentId, paymentRecordId) {
    if (typeof Swal !== 'undefined') {
        Swal.fire({
          title: 'Undo Payment?',
          text: "Are you sure you want to revert this payment record? This will deduct the amount from total fees.",
          icon: 'warning',
          showCancelButton: true,
          confirmButtonColor: '#B22222',
          cancelButtonColor: '#7A6E6D',
          confirmButtonText: 'Yes, Revert it'
        }).then(async function(result) {
          if (result.isConfirmed) {
              await executeUndoPayment(studentId, paymentRecordId);
          }
        });
    } else {
        if (confirm("Are you sure you want to undo this payment?")) {
            await executeUndoPayment(studentId, paymentRecordId);
        }
    }
}

async function executeUndoPayment(studentId, paymentRecordId) {
     const targetStudent = allStudentsCache.find(s => s.id === studentId);
     
     if (!targetStudent || !targetStudent.paymentHistory) return;

     targetStudent.paymentHistory = targetStudent.paymentHistory.filter(p => p.id !== paymentRecordId);
     
     targetStudent.paidFee = targetStudent.paymentHistory.reduce((sum, record) => {
       return sum + Number(record.amount);
     }, 0);

     try {
        await db.collection('students').doc(studentId).update({ 
            paymentHistory: targetStudent.paymentHistory,
            paidFee: targetStudent.paidFee 
        });
        
        applyFilters();
        
        if (document.getElementById('viewStudentProfileModal').style.display === 'flex') {
             renderPaymentHistory(targetStudent);
        }
        
        if (typeof Swal !== 'undefined') {
          Swal.fire('Reverted!', 'Payment has been successfully reverted.', 'success');
        }
     } catch (e) {
        if (typeof Swal !== 'undefined') {
          Swal.fire('Error', "Revert failed.", 'error');
        }
     }
}

function openStudentProfileModal(student) {
   currentActiveProfileStudent = student; 
   const modal = document.getElementById('viewStudentProfileModal');
   const contentDiv = document.getElementById('studentProfileContent');
   
   contentDiv.innerHTML = `
      <div style="background: #fff; padding: 15px; border-radius: 8px; border: 1px solid #eee; margin-bottom: 15px;">
         <h2 style="margin-top:0; color: var(--primary);">${sanitizeOutput(student.name)}</h2>
         <p style="margin: 5px 0;"><strong>Email ID:</strong> ${sanitizeOutput(student.email)}</p>
         <p style="margin: 5px 0;"><strong>Password:</strong> ${sanitizeOutput(student.password)}</p>
         <p style="margin: 5px 0;"><strong>Batch:</strong> ${sanitizeOutput(student.batch || 'Batch A')}</p>
         <p style="margin: 5px 0;"><strong>Admission Date:</strong> ${sanitizeOutput(student.admissionDate || 'N/A')}</p>
      </div>

      <div style="display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 20px;">
         <button class="btn small ghost" id="btnProfileEdit">Edit Details</button>
         <button class="btn small ghost" id="btnProfileResult">Update Result</button>
         <button class="btn small ghost" id="btnProfileCert" style="color:#C49A45; border-color:#C49A45;">Certificate</button>
         <button class="btn small danger" id="btnProfileDelete">Delete Student</button>
      </div>
   `;

   document.getElementById('btnProfileEdit').addEventListener('click', function() { 
       document.getElementById('viewStudentProfileModal').style.display = 'none'; 
       openEditModal(student); 
   });
   
   document.getElementById('btnProfileResult').addEventListener('click', function() { 
       document.getElementById('viewStudentProfileModal').style.display = 'none'; 
       openResultEditor(student); 
   });
   
   document.getElementById('btnProfileCert').addEventListener('click', function() { 
       document.getElementById('viewStudentProfileModal').style.display = 'none'; 
       openCertModal(student); 
   });
   
   document.getElementById('btnProfileDelete').addEventListener('click', function() {
       closeStudentProfileModal();
       
       if (typeof Swal !== 'undefined') {
        Swal.fire({
          title: 'Delete Student?', 
          text: `Remove all records for ${student.name}?`, 
          icon: 'warning', 
          showCancelButton: true, 
          confirmButtonColor: '#B22222', 
          confirmButtonText: 'Yes, delete it!'
        }).then(function(result) {
          if (result.isConfirmed) {
            allStudentsCache = allStudentsCache.filter(s => s.id !== student.id);
            updateBatchDropdown(); 
            applyFilters(); 
            db.collection('students').doc(student.id).delete();
            Swal.fire('Deleted!', `Records removed permanently.`, 'success');
          }
        });
      }
   });

   document.getElementById('paymentProfileStudentId').value = student.id;
   renderPaymentHistory(student);
   modal.style.display = 'flex';
}

function closeStudentProfileModal() {
   currentActiveProfileStudent = null; 
   document.getElementById('viewStudentProfileModal').style.display = 'none';
}

function renderPaymentHistory(student) {
    const container = document.getElementById('paymentHistoryContainer');
    container.innerHTML = '';
    
    if ((!student.paymentHistory || student.paymentHistory.length === 0) && student.paidFee > 0) {
        student.paymentHistory = [{ 
          id: 'SYS-OLD', 
          amount: student.paidFee, 
          date: student.admissionDate || new Date().toISOString(), 
          note: 'Previous System Data' 
        }];
    }

    if (!student.paymentHistory || student.paymentHistory.length === 0) {
        container.innerHTML = '<p class="muted">No payment records found.</p>';
        return;
    }

    const sortedHistory = [...student.paymentHistory].sort(function(a, b) {
      return new Date(b.date) - new Date(a.date);
    });

    sortedHistory.forEach(function(record) {
        const itemDate = new Date(record.date).toLocaleDateString('en-IN', { 
          year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute:'2-digit' 
        });
        
        const recordDiv = document.createElement('div');
        recordDiv.style.cssText = "display: flex; justify-content: space-between; align-items: center; padding: 8px 10px; background: white; margin-bottom: 5px; border-radius: 4px; border: 1px solid #eee;";
        
        const noteHtml = record.note ? `<span style="font-size:10px; color:#999; display:block;">(${record.note})</span>` : '';
        
        recordDiv.innerHTML = `
           <div>
             <div style="font-weight: 600; font-size: 14px; color: var(--primary);">₹${record.amount.toLocaleString('en-IN')}</div>
             <div style="font-size: 11px; color: #666;">${itemDate}</div>
             ${noteHtml}
           </div>
           <button class="undo-payment-btn" data-record-id="${record.id}" style="background: none; border: none; color: #B22222; cursor: pointer; font-size: 14px; font-weight: bold;" title="Undo Payment">Revert</button>
        `;
        
        const undoBtn = recordDiv.querySelector('.undo-payment-btn');
        
        undoBtn.addEventListener('click', function() {
            undoPayment(student.id, record.id);
        });
        
        container.appendChild(recordDiv);
    });
}

const profilePaymentForm = document.getElementById('addPaymentFormProfile');
if (profilePaymentForm) {
    profilePaymentForm.addEventListener('submit', function(e) {
        e.preventDefault();
        const studentId = document.getElementById('paymentProfileStudentId').value;
        const amountInput = document.getElementById('newPaymentAmount');
        const amount = Number(amountInput.value);
        
        if (amount > 0) {
            processPayment(studentId, amount);
            amountInput.value = ''; 
        }
    });
}

if (exportLedgerBtn) {
  exportLedgerBtn.addEventListener('click', function() {
    if (allStudentsCache.length === 0) {
      if (typeof Swal !== 'undefined') {
        Swal.fire('Empty Data', 'No student records found to export.', 'info');
      } else {
        alert("No records to export.");
      }
      return;
    }

    let csvContent = "Student Name,Batch,Admission Date,Email ID,Total Fee (Rs),Discount (Rs),Paid Amount (Rs),Due Balance (Rs),Result Status\n";

    allStudentsCache.forEach(function(student) {
      const name = `"${(student.name || '').replace(/"/g, '""')}"`;
      const batch = `"${(student.batch || 'Batch A').replace(/"/g, '""')}"`;
      const date = `"${student.admissionDate || ''}"`;
      const email = `"${(student.email || '').replace(/"/g, '""')}"`;
      
      const total = Number(student.totalFee) || 0;
      const discount = Number(student.discount) || 0;
      const paid = Number(student.paidFee) || 0;
      const due = Math.max(0, (total - discount) - paid);
      
      let result = "Not Set";
      if (student.result && student.result.isPublished) {
        result = student.result.status;
      }

      csvContent += `${name},${batch},${date},${email},${total},${discount},${paid},${due},${result}\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `Shama_Henna_Ledger_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    if (typeof Swal !== 'undefined') {
      Swal.fire({ 
        title: 'Exported!', 
        text: 'Excel report downloaded successfully.', 
        icon: 'success', 
        timer: 1500, 
        showConfirmButton: false 
      });
    }
  });
}

if (pendingMainFilterBtn) {
  pendingMainFilterBtn.addEventListener('click', function() {
    isMainPendingFilterActive = !isMainPendingFilterActive;
    if (isMainPendingFilterActive) {
      pendingMainFilterBtn.classList.add('active');
      pendingMainFilterBtn.innerHTML = 'Showing Pending';
    } else {
      pendingMainFilterBtn.classList.remove('active');
      pendingMainFilterBtn.innerHTML = 'Pending Dues';
    }
    applyFilters();
  });
}

function applyFilters() {
  const query = searchInput ? searchInput.value.toLowerCase().trim() : '';
  const batch = batchFilter ? batchFilter.value : 'ALL';

  const filtered = allStudentsCache.filter(function(s) {
    const matchQuery = (s.name || '').toLowerCase().includes(query) || (s.email || '').toLowerCase().includes(query);
    const matchBatch = (batch === 'ALL') || ((s.batch || 'Batch A') === batch);
    
    const total = Number(s.totalFee) || 0;
    const discount = Number(s.discount) || 0;
    const paid = Number(s.paidFee) || 0;
    const due = Math.max(0, (total - discount) - paid);
    
    const matchPending = isMainPendingFilterActive ? (due > 0) : true;

    return matchQuery && matchBatch && matchPending;
  });
  
  renderStudentsLedger(filtered);
}

if (searchInput) {
  searchInput.addEventListener('input', applyFilters);
}
if (batchFilter) {
  batchFilter.addEventListener('change', applyFilters);
}

if (pendingStoreFilterBtn) {
  pendingStoreFilterBtn.addEventListener('click', function() {
    isStorePendingFilterActive = !isStorePendingFilterActive;
    if (isStorePendingFilterActive) {
      pendingStoreFilterBtn.classList.add('active');
      pendingStoreFilterBtn.innerHTML = 'Showing Pending';
    } else {
      pendingStoreFilterBtn.classList.remove('active');
      pendingStoreFilterBtn.innerHTML = 'Pending Dues';
    }
    applyStoreFilters();
  });
}

function applyStoreFilters() {
  const query = searchStoreInput ? searchStoreInput.value.toLowerCase().trim() : '';
  const batch = storeBatchFilter ? storeBatchFilter.value : 'ALL';

  const filtered = allStoreStudentsCache.filter(function(s) {
    const matchQuery = (s.name || '').toLowerCase().includes(query);
    const matchBatch = (batch === 'ALL') || ((s.batch || 'Batch A') === batch);

    const items = s.storeItems || [];
    let storeTotalBill = 0;
    
    items.forEach(function(i) {
      storeTotalBill += Number(i.price);
    });
    
    const existingStorePaid = Number(s.storePaid) || 0;
    const storeDue = Math.max(0, storeTotalBill - existingStorePaid);
    
    const matchPending = isStorePendingFilterActive ? (storeDue > 0) : true;

    return matchQuery && matchBatch && matchPending;
  });
  
  renderStoreStudentsTable(filtered);
}

if (searchStoreInput) {
  searchStoreInput.addEventListener('input', applyStoreFilters);
}
if (storeBatchFilter) {
  storeBatchFilter.addEventListener('change', applyStoreFilters);
}

const productsBody = document.getElementById('productsBody');
const storeStudentsBody = document.getElementById('storeStudentsBody');
const addProductForm = document.getElementById('addProductForm');

async function loadStoreData() {
  if (productsBody && allProductsCache.length === 0) {
    productsBody.innerHTML = '<tr><td colspan="3" class="muted">Loading catalog...</td></tr>';
  }
  
  try {
    const pSnap = await db.collection('products').orderBy('name').get();
    allProductsCache = [];
    pSnap.forEach(function(doc) {
      allProductsCache.push({ id: doc.id, ...doc.data() });
    });
    renderProductsTable();
  } catch (err) {
  }
  
  if (storeStudentsBody && allStoreStudentsCache.length === 0) {
    storeStudentsBody.innerHTML = '<tr><td colspan="6" class="muted">Loading store transactions...</td></tr>';
  }
  
  try {
    const sSnap = await db.collection('students').orderBy('name').get();
    allStoreStudentsCache = [];
    sSnap.forEach(function(doc) {
      allStoreStudentsCache.push({ id: doc.id, ...doc.data() });
    });
    applyStoreFilters(); 
  } catch (err) {
  }
}

if (addProductForm) {
  addProductForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    const name = document.getElementById('pName').value.trim();
    const price = Number(document.getElementById('pPrice').value);
    const btn = addProductForm.querySelector('button');
    
    if (btn) btn.disabled = true;
    
    try {
      const docRef = await db.collection('products').add({ name: name, price: price });
      allProductsCache.push({ id: docRef.id, name: name, price: price });
      renderProductsTable();
      addProductForm.reset();
      
      if (typeof Swal !== 'undefined') {
        Swal.fire({ 
          title: 'Added', 
          text: 'Product added successfully', 
          icon: 'success', 
          timer: 1500, 
          showConfirmButton: false 
        });
      }
    } catch (err) {
    }
    
    if (btn) btn.disabled = false;
  });
}

function renderProductsTable() {
  if (!productsBody) return;
  
  productsBody.innerHTML = allProductsCache.length === 0 ? '<tr><td colspan="3" class="muted">Inventory catalog is empty.</td></tr>' : '';
  
  allProductsCache.forEach(function(p) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td class="text-bold">${sanitizeOutput(p.name)}</td><td>₹${p.price}</td><td><button class="btn small danger" onclick="deleteProduct('${p.id}', '${sanitizeOutput(p.name)}')">Delete</button></td>`;
    productsBody.appendChild(tr);
  });
}

async function deleteProduct(id, name) {
  if (typeof Swal !== 'undefined') {
    Swal.fire({ 
      title: 'Delete Product?', 
      text: `Remove ${name}?`, 
      icon: 'warning', 
      showCancelButton: true, 
      confirmButtonColor: '#B22222', 
      confirmButtonText: 'Yes, delete it!' 
    }).then(function(result) { 
      if (result.isConfirmed) { 
        allProductsCache = allProductsCache.filter(p => p.id !== id); 
        renderProductsTable(); 
        db.collection('products').doc(id).delete(); 
      } 
    });
  } else {
    if (confirm(`Remove ${name}?`)) { 
      allProductsCache = allProductsCache.filter(p => p.id !== id); 
      renderProductsTable(); 
      db.collection('products').doc(id).delete(); 
    }
  }
}

function renderStoreStudentsTable(students) {
  if (!storeStudentsBody) return;
  
  storeStudentsBody.innerHTML = students.length === 0 ? '<tr><td colspan="6" class="muted">No student records found.</td></tr>' : '';
  
  students.forEach(function(student, index) {
    const items = student.storeItems || [];
    const existingStorePaid = Number(student.storePaid) || 0;
    const displayBatch = student.batch || 'Batch A'; 

    let storeTotalBill = 0;
    items.forEach(function(i) {
      storeTotalBill += Number(i.price);
    });
    
    const storeDue = Math.max(0, storeTotalBill - existingStorePaid);
    
    let itemsText = items.length > 0 ? items.map(function(item, itemIdx) {
      return `<span class="store-item-badge" style="display:inline-flex; align-items:center; background:#F8F4EE; border:1px solid #EADBCC; padding:4px 10px; border-radius:20px; font-size:11.5px; font-weight:600; margin:3px; color:var(--primary);">${sanitizeOutput(item.productName)} <span style="opacity:0.65; font-weight:500; margin-left:3px;">(₹${item.price})</span><button type="button" class="removeStoreItemBtn" data-student-id="${student.id}" data-item-index="${itemIdx}" style="background:transparent; border:none; color:#B22222; font-weight:bold; cursor:pointer; font-size:15px; margin-left:6px; padding:0; line-height:1; display:flex; align-items:center; opacity:0.6; transition:0.2s;">✕</button></span>`;
    }).join('') : '<span class="muted table-text-muted">No items</span>';

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>
        <strong>${index + 1}. ${sanitizeOutput(student.name)}</strong>
        <div style="font-size:11px; font-weight:bold; color:var(--gold); margin-top:2px;">${sanitizeOutput(displayBatch)}</div>
      </td>
      <td>${itemsText}</td>
      <td class="text-bold">₹${storeTotalBill}</td>
      <td class="success text-bold">₹${existingStorePaid}</td>
      <td class="${storeDue > 0 ? 'danger' : 'success'} text-bold">₹${storeDue}</td>
      <td>
        <input type="number" class="storePaidInput input-ledger-action" min="0" step="1" placeholder="+ Add ₹">
        <button class="btn small primary storeUpdateBtn" title="Add Payment">Add</button> 
        <button class="btn small ghost assignBtn" title="Assign Item">Assign</button>
      </td>
    `;
    
    tr.querySelector('.storeUpdateBtn').addEventListener('click', function() {
      const valInput = tr.querySelector('.storePaidInput').value;
      if (valInput === '') return;
      
      student.storePaid = existingStorePaid + (Number(valInput) || 0);
      applyStoreFilters();
      db.collection('students').doc(student.id).update({ storePaid: student.storePaid });
    });

    tr.querySelectorAll('.removeStoreItemBtn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        const sId = btn.getAttribute('data-student-id');
        const idx = Number(btn.getAttribute('data-item-index'));
        
        const action = function() { 
          const t = allStoreStudentsCache.find(s => s.id === sId); 
          if (t && t.storeItems) { 
            t.storeItems.splice(idx, 1); 
            if (t.storeItems.length === 0) {
              t.storePaid = 0; 
            }
            applyStoreFilters(); 
            db.collection('students').doc(sId).update({ storeItems: t.storeItems, storePaid: t.storePaid }); 
          } 
        };
        
        if (typeof Swal !== 'undefined') {
          Swal.fire({ 
            title: 'Remove Item?', 
            text: 'Remove from account?', 
            icon: 'question', 
            showCancelButton: true, 
            confirmButtonColor: '#C49A45', 
            confirmButtonText: 'Yes' 
          }).then(function(r) { 
            if (r.isConfirmed) {
              action(); 
            }
          });
        } else {
          if (confirm('Remove this product?')) {
            action();
          }
        }
      });
    });
    
    tr.querySelector('.assignBtn').addEventListener('click', function() { 
      openAssignModal(student); 
    });
    
    storeStudentsBody.appendChild(tr);
  });
}

function openAssignModal(student) {
  if (allProductsCache.length === 0) {
    if (typeof Swal !== 'undefined') {
      Swal.fire('Notice', 'Please register inventory items before assigning.', 'info');
    } else {
      alert('Please register inventory items before assigning.');
    }
    return;
  }
  
  document.getElementById('assignStudentId').value = student.id;
  document.getElementById('assignModalStudentName').textContent = `Assign to: ${student.name}`;
  
  const select = document.getElementById('assignProductSelect');
  select.innerHTML = '<option value="">-- Select Product --</option>';
  
  allProductsCache.forEach(function(p) {
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
  assignProductForm.addEventListener('submit', function(e) {
    e.preventDefault();
    
    const studentId = document.getElementById('assignStudentId').value;
    const productVal = document.getElementById('assignProductSelect').value;
    
    if (!productVal) return;
    
    const parts = productVal.split('|');
    const pName = parts[0];
    const pPrice = parts[1];
    
    const newItem = { 
      productName: pName, 
      price: Number(pPrice), 
      date: new Date().toISOString() 
    };
    
    closeAssignModal();
    
    const targetStudent = allStoreStudentsCache.find(s => s.id === studentId);
    if (targetStudent) { 
      if (!targetStudent.storeItems) {
        targetStudent.storeItems = []; 
      }
      targetStudent.storeItems.push(newItem); 
      applyStoreFilters(); 
    }
    
    db.collection('students').doc(studentId).update({ 
      storeItems: firebase.firestore.FieldValue.arrayUnion(newItem) 
    }).then(function() {
      if (typeof Swal !== 'undefined') {
        Swal.fire({ 
          title: 'Assigned!', 
          text: `${pName} added to student's account.`, 
          icon: 'success', 
          timer: 1500, 
          showConfirmButton: false 
        });
      }
    }).catch(function(err) {
      if (typeof Swal !== 'undefined') {
        Swal.fire('Error', 'Failed to sync.', 'error'); 
      } else {
        alert('Failed to sync.');
      }
    });
  });
}

function openEditModal(student) {
  document.getElementById('editStudentId').value = student.id;
  document.getElementById('editName').value = student.name || '';
  document.getElementById('editBatch').value = student.batch || 'Batch A'; 
  document.getElementById('editDate').value = student.admissionDate || '';
  document.getElementById('editEmail').value = student.email || '';
  document.getElementById('editPassword').value = student.password || '';
  document.getElementById('editTotalFee').value = student.totalFee || 0;
  document.getElementById('editDiscount').value = student.discount || 0;
  document.getElementById('editStudentModal').style.display = 'flex';
}

function closeEditModal() { 
  document.getElementById('editStudentModal').style.display = 'none'; 
  
  if (currentActiveProfileStudent) {
      const freshData = allStudentsCache.find(s => s.id === currentActiveProfileStudent.id);
      if (freshData) {
        openStudentProfileModal(freshData);
      }
  }
}

async function updateStudentDatabase() {
  const id = document.getElementById('editStudentId').value;
  const newName = document.getElementById('editName').value.trim();
  const newBatch = document.getElementById('editBatch').value.trim() || 'Batch A';
  const newDate = document.getElementById('editDate').value;
  const newEmail = document.getElementById('editEmail').value.trim();
  const newPassword = document.getElementById('editPassword').value;
  const newTotalFee = Number(document.getElementById('editTotalFee').value);
  const newDiscount = Number(document.getElementById('editDiscount').value);

  const studentObj = allStudentsCache.find(s => s.id === id);
  if (studentObj) {
    studentObj.name = newName;
    studentObj.batch = newBatch;
    studentObj.admissionDate = newDate;
    studentObj.email = newEmail;
    studentObj.password = newPassword;
    studentObj.totalFee = newTotalFee;
    studentObj.discount = newDiscount;
    
    updateBatchDropdown();
    applyFilters();
  }
  
  const storeStudentObj = allStoreStudentsCache.find(s => s.id === id);
  if (storeStudentObj) {
    storeStudentObj.name = newName;
    storeStudentObj.batch = newBatch;
    applyStoreFilters();
  }

  closeEditModal();

  db.collection('students').doc(id).update({
    name: newName, 
    batch: newBatch, 
    admissionDate: newDate, 
    email: newEmail, 
    password: newPassword, 
    totalFee: newTotalFee, 
    discount: newDiscount
  }).then(function() {
    if (typeof Swal !== 'undefined') {
      Swal.fire({ 
        title: 'Updated!', 
        text: 'Records updated.', 
        icon: 'success', 
        timer: 1500, 
        showConfirmButton: false 
      });
    }
  }).catch(function(error) {
    if (typeof Swal !== 'undefined') {
      Swal.fire('Error', "Sync failed.", 'error');
    }
  });
}

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
  
  if (resultModalDialog) {
    resultModalDialog.style.display = 'flex';
  }
}

const closeResultModalBtn = document.getElementById('closeResultModal');
if (closeResultModalBtn) { 
    closeResultModalBtn.addEventListener('click', function() { 
        if (resultModalDialog) {
          resultModalDialog.style.display = 'none'; 
        }
        
        if (currentActiveProfileStudent) {
            const freshData = allStudentsCache.find(s => s.id === currentActiveProfileStudent.id);
            if (freshData) {
              openStudentProfileModal(freshData);
            }
        }
    }); 
}

const resultForm = document.getElementById('resultForm');
if (resultForm) {
  resultForm.addEventListener('submit', function(e) {
    e.preventDefault();
    const id = document.getElementById('resultStudentId').value;
    
    const newResult = { 
      marks: document.getElementById('rMarks').value.trim(), 
      grade: document.getElementById('rGrade').value.trim().toUpperCase(), 
      status: document.getElementById('rStatus').value, 
      isPublished: true 
    };
    
    if (resultModalDialog) {
      resultModalDialog.style.display = 'none';
    }
    
    const target = allStudentsCache.find(s => s.id === id);
    if (target) { 
      target.result = newResult; 
      applyFilters(); 
    }
    
    if (currentActiveProfileStudent) {
        const freshData = allStudentsCache.find(s => s.id === currentActiveProfileStudent.id);
        if (freshData) {
          openStudentProfileModal(freshData);
        }
    }

    db.collection('students').doc(id).update({ result: newResult }).then(function() {
      if (typeof Swal !== 'undefined') {
        Swal.fire({ 
          title: 'Published!', 
          text: 'Result saved.', 
          icon: 'success', 
          timer: 1500, 
          showConfirmButton: false 
        });
      }
    });
  });
}

const btnRemoveResult = document.getElementById('btnRemoveResult');
if (btnRemoveResult) {
  btnRemoveResult.addEventListener('click', function() {
    const id = document.getElementById('resultStudentId').value;
    
    const action = function() {
      if (resultModalDialog) {
        resultModalDialog.style.display = 'none';
      }
      
      const target = allStudentsCache.find(s => s.id === id);
      if (target) { 
        target.result = null; 
        applyFilters(); 
      }
      
      if (currentActiveProfileStudent) {
          const freshData = allStudentsCache.find(s => s.id === currentActiveProfileStudent.id);
          if (freshData) {
            openStudentProfileModal(freshData);
          }
      }

      db.collection('students').doc(id).update({ result: null });
      
      if (typeof Swal !== 'undefined') {
        Swal.fire('Cleared!', 'Result unpublished.', 'success');
      }
    };
    
    if (typeof Swal !== 'undefined') {
      Swal.fire({ 
        title: 'Unpublish Result?', 
        text: 'Clear results?', 
        icon: 'warning', 
        showCancelButton: true, 
        confirmButtonColor: '#B22222', 
        confirmButtonText: 'Yes' 
      }).then(function(r) { 
        if (r.isConfirmed) {
          action(); 
        }
      });
    } else {
      if (confirm('Clear examination results?')) {
        action();
      }
    }
  });
}

const certModal = document.getElementById('certModal');
const certForm = document.getElementById('certForm');
const certLinkResult = document.getElementById('certLinkResult');
const certGeneratedLink = document.getElementById('certGeneratedLink');
const btnDeleteCert = document.getElementById('btnDeleteCert');

function closeCertModal() {
  if (certModal) {
    certModal.style.display = 'none';
  }
  if (certLinkResult) {
    certLinkResult.style.display = 'none';
  }
  
  if (currentActiveProfileStudent) {
      const freshData = allStudentsCache.find(s => s.id === currentActiveProfileStudent.id);
      if (freshData) {
        openStudentProfileModal(freshData);
      }
  }
}

function openCertModal(student) {
  document.getElementById('certStudentId').value = student.id;
  document.getElementById('certStudentNameInput').value = student.name;
  document.getElementById('certModalStudentName').textContent = `Issue to: ${student.name}`;
  
  const submitBtn = certForm.querySelector('button[type="submit"]');
  const existIdInput = document.getElementById('existingCertId');

  if (student.certificate) {
    if (existIdInput) {
      existIdInput.value = student.certificate.id;
    }
    
    document.getElementById('certNumber').value = student.certificate.certNumber || '';
    document.getElementById('certCourse').value = student.certificate.courseName || '';
    document.getElementById('certDate').value = student.certificate.issueDate || '';
    
    certGeneratedLink.value = student.certificate.url || '';
    
    if (certLinkResult) {
      certLinkResult.style.display = 'flex';
    }
    
    if (submitBtn) {
      submitBtn.textContent = 'Update Certificate';
    }
    
    if (btnDeleteCert) {
      btnDeleteCert.style.display = 'block';
    }
  } else {
    if (existIdInput) {
      existIdInput.value = '';
    }
    
    document.getElementById('certNumber').value = '';
    document.getElementById('certCourse').value = '';
    document.getElementById('certDate').value = new Date().toISOString().split('T')[0];
    
    if (certLinkResult) {
      certLinkResult.style.display = 'none';
    }
    
    if (submitBtn) {
      submitBtn.textContent = 'Generate & Save Certificate';
    }
    
    if (btnDeleteCert) {
      btnDeleteCert.style.display = 'none';
    }
  }
  
  if (certModal) {
    certModal.style.display = 'flex';
  }
}

if (certForm) {
  certForm.addEventListener('submit', async function(e) {
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
    
    const generateSecureId = function() {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
      let r = ''; 
      for (let i = 0; i < 16; i++) {
        r += chars.charAt(Math.floor(Math.random() * chars.length)); 
      }
      return 'VERIFY-' + r; 
    };
    
    const secureDocId = existingId ? existingId : generateSecureId();

    try {
      const verifyLink = `https://shamahennaclasses.vercel.app/verify.html?id=${secureDocId}`;

      await db.collection('certificates').doc(secureDocId).set({ 
        certNumber: rawCertNo, 
        studentName: sName, 
        courseName: sCourse, 
        issueDate: sDate, 
        timestamp: firebase.firestore.FieldValue.serverTimestamp() 
      });

      const certDataObj = { 
        id: secureDocId, 
        certNumber: rawCertNo, 
        courseName: sCourse, 
        issueDate: sDate, 
        url: verifyLink 
      };
      
      await db.collection('students').doc(studentId).update({ 
        certificate: certDataObj 
      });

      const targetStudent = allStudentsCache.find(s => s.id === studentId);
      if (targetStudent) {
        targetStudent.certificate = certDataObj;
      }
      
      if (existIdInput) {
        existIdInput.value = secureDocId;
      }
      
      certGeneratedLink.value = verifyLink;
      
      if (certLinkResult) {
        certLinkResult.style.display = 'flex';
      }
      
      certGeneratedLink.select();
      
      if (btnDeleteCert) {
        btnDeleteCert.style.display = 'block';
      }
      
      if (typeof Swal !== 'undefined') {
        Swal.fire({ 
          title: 'Success!', 
          text: 'Certificate saved.', 
          icon: 'success', 
          timer: 1500, 
          showConfirmButton: false 
        });
      }
    } catch (error) {
      if (typeof Swal !== 'undefined') {
        Swal.fire('Error', "Process failed: " + error.message, 'error'); 
      } else {
        alert("Error: " + error.message);
      }
    } finally {
      btn.disabled = false;
      btn.textContent = existingId ? 'Update Certificate' : 'Generate & Save Certificate';
    }
  });
}

if (btnDeleteCert) {
  btnDeleteCert.addEventListener('click', function() {
    const studentId = document.getElementById('certStudentId').value;
    const existingId = document.getElementById('existingCertId').value;

    const action = async function() {
      btnDeleteCert.textContent = "Deleting...";
      try {
        await db.collection('certificates').doc(existingId).delete();
        await db.collection('students').doc(studentId).update({ 
          certificate: firebase.firestore.FieldValue.delete() 
        });
        
        const targetStudent = allStudentsCache.find(s => s.id === studentId);
        if (targetStudent) {
          delete targetStudent.certificate;
        }
        
        closeCertModal();
        
        if (typeof Swal !== 'undefined') {
          Swal.fire('Revoked!', 'Certificate deleted.', 'success'); 
        } else {
          alert('Certificate deleted.');
        }
      } catch (error) {
        if (typeof Swal !== 'undefined') {
          Swal.fire('Error', error.message, 'error'); 
        } else {
          alert(error.message);
        }
      } finally {
        btnDeleteCert.textContent = "Revoke & Delete Certificate";
      }
    };

    if (typeof Swal !== 'undefined') {
      Swal.fire({ 
        title: 'Revoke Certificate?', 
        text: "Permanent Action! QR will stop working.", 
        icon: 'warning', 
        showCancelButton: true, 
        confirmButtonColor: '#B22222', 
        confirmButtonText: 'Yes, Revoke it!' 
      }).then(function(result) { 
        if (result.isConfirmed) {
          action(); 
        }
      });
    } else {
      if (confirm("QR Code will stop working permanently. Proceed?")) {
        action();
      }
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