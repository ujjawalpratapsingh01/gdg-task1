const STORAGE_KEY = "finora_transactions_v1";
const THEME_KEY = "finora_theme_v1";

let transactions = loadTransactions();
let deleteId = null;

const $ = id => document.getElementById(id);
const form = $("transactionForm");

function loadTransactions() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function saveTransactions() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
}

function money(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency", currency: "INR", maximumFractionDigits: 2
  }).format(value);
}

function formatDate(date) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit", month: "short", year: "numeric"
  }).format(new Date(date + "T00:00:00"));
}

function getType() {
  return document.querySelector('input[name="type"]:checked').value;
}

function updateSummary() {
  const income = transactions.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const expense = transactions.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  const balance = income - expense;

  $("income").textContent = money(income);
  $("expenses").textContent = money(expense);
  $("balance").textContent = money(balance);
  $("balanceHint").textContent = balance >= 0 ? "You're currently in the positive" : "Expenses are above income";
}

function updateCategoryFilter() {
  const current = $("categoryFilter").value;
  const categories = [...new Set(transactions.map(t => t.category))].sort();
  $("categoryFilter").innerHTML = '<option value="all">All categories</option>' +
    categories.map(c => `<option value="${escapeHTML(c)}">${escapeHTML(c)}</option>`).join("");
  if (categories.includes(current)) $("categoryFilter").value = current;
}

function getFilteredTransactions() {
  const search = $("search").value.trim().toLowerCase();
  const type = $("typeFilter").value;
  const category = $("categoryFilter").value;
  const sort = $("sortFilter").value;

  let result = transactions.filter(t => {
    const matchesSearch = t.title.toLowerCase().includes(search);
    const matchesType = type === "all" || t.type === type;
    const matchesCategory = category === "all" || t.category === category;
    return matchesSearch && matchesType && matchesCategory;
  });

  result.sort((a, b) => {
    if (sort === "date-desc") return b.date.localeCompare(a.date) || b.createdAt - a.createdAt;
    if (sort === "date-asc") return a.date.localeCompare(b.date) || a.createdAt - b.createdAt;
    if (sort === "amount-desc") return b.amount - a.amount;
    return a.amount - b.amount;
  });
  return result;
}

function renderTransactions() {
  const list = $("transactionList");
  const filtered = getFilteredTransactions();
  $("transactionCount").textContent = `${filtered.length} transaction${filtered.length === 1 ? "" : "s"}`;

  if (!filtered.length) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">◌</div>
        <h3>${transactions.length ? "No matching transactions" : "No transactions yet"}</h3>
        <p>${transactions.length ? "Try changing your search or filters." : "Add your first income or expense to get started."}</p>
      </div>`;
    return;
  }

  list.innerHTML = filtered.map(t => `
    <article class="transaction">
      <div class="tx-icon ${t.type}">${t.type === "income" ? "↗" : "↘"}</div>
      <div>
        <div class="tx-title">${escapeHTML(t.title)}</div>
        <div class="tx-meta">${escapeHTML(t.category)} • ${formatDate(t.date)}</div>
      </div>
      <div class="tx-amount ${t.type}">${t.type === "income" ? "+" : "−"}${money(t.amount)}</div>
      <div class="tx-actions">
        <button class="small-btn" title="Edit" aria-label="Edit ${escapeHTML(t.title)}" data-edit="${t.id}">✎</button>
        <button class="small-btn" title="Delete" aria-label="Delete ${escapeHTML(t.title)}" data-delete="${t.id}">⌫</button>
      </div>
    </article>
  `).join("");
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, ch => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#039;"
  }[ch]));
}

function clearErrors() {
  ["titleError", "amountError", "categoryError", "dateError"].forEach(id => $(id).textContent = "");
}

function validate() {
  clearErrors();
  let valid = true;
  const title = $("title").value.trim();
  const amount = Number($("amount").value);
  const category = $("category").value;
  const date = $("date").value;

  if (!title) { $("titleError").textContent = "Please enter a description."; valid = false; }
  if (!amount || amount <= 0) { $("amountError").textContent = "Enter an amount greater than ₹0."; valid = false; }
  if (!category) { $("categoryError").textContent = "Please choose a category."; valid = false; }
  if (!date) { $("dateError").textContent = "Please select a date."; valid = false; }
  return valid;
}

function resetForm() {
  form.reset();
  $("date").value = new Date().toISOString().split("T")[0];
  $("editId").value = "";
  $("formTitle").textContent = "Add transaction";
  $("submitBtn").textContent = "Add transaction";
  $("cancelEdit").classList.add("hidden");
  clearErrors();
}

function startEdit(id) {
  const t = transactions.find(item => item.id === id);
  if (!t) return;
  $("editId").value = t.id;
  $("title").value = t.title;
  $("amount").value = t.amount;
  $("category").value = t.category;
  $("date").value = t.date;
  document.querySelector(`input[name="type"][value="${t.type}"]`).checked = true;
  $("formTitle").textContent = "Edit transaction";
  $("submitBtn").textContent = "Save changes";
  $("cancelEdit").classList.remove("hidden");
  clearErrors();
  $("formPanel").scrollIntoView({ behavior: "smooth", block: "start" });
}

function askDelete(id) {
  deleteId = id;
  $("deleteModal").classList.remove("hidden");
}

function closeDelete() {
  deleteId = null;
  $("deleteModal").classList.add("hidden");
}

form.addEventListener("submit", e => {
  e.preventDefault();
  if (!validate()) return;

  const existingId = $("editId").value;
  const item = {
    id: existingId || crypto.randomUUID(),
    title: $("title").value.trim(),
    amount: Number($("amount").value),
    type: getType(),
    category: $("category").value,
    date: $("date").value,
    createdAt: existingId ? (transactions.find(t => t.id === existingId)?.createdAt || Date.now()) : Date.now()
  };

  if (existingId) {
    transactions = transactions.map(t => t.id === existingId ? item : t);
  } else {
    transactions.push(item);
  }

  saveTransactions();
  updateSummary();
  updateCategoryFilter();
  renderTransactions();
  resetForm();
});

$("cancelEdit").addEventListener("click", resetForm);
$("addTopBtn").addEventListener("click", () => {
  resetForm();
  $("formPanel").scrollIntoView({ behavior: "smooth", block: "start" });
  $("title").focus();
});

$("transactionList").addEventListener("click", e => {
  const edit = e.target.closest("[data-edit]");
  const del = e.target.closest("[data-delete]");
  if (edit) startEdit(edit.dataset.edit);
  if (del) askDelete(del.dataset.delete);
});

["search", "typeFilter", "categoryFilter", "sortFilter"].forEach(id => {
  $(id).addEventListener(id === "search" ? "input" : "change", renderTransactions);
});

$("keepBtn").addEventListener("click", closeDelete);
$("deleteModal").addEventListener("click", e => {
  if (e.target === $("deleteModal")) closeDelete();
});
$("confirmDelete").addEventListener("click", () => {
  if (!deleteId) return;
  transactions = transactions.filter(t => t.id !== deleteId);
  saveTransactions();
  updateSummary();
  updateCategoryFilter();
  renderTransactions();
  closeDelete();
  if ($("editId").value === deleteId) resetForm();
});

$("themeToggle").addEventListener("click", () => {
  document.body.classList.toggle("dark");
  localStorage.setItem(THEME_KEY, document.body.classList.contains("dark") ? "dark" : "light");
  $("themeToggle").textContent = document.body.classList.contains("dark") ? "☀" : "☾";
});

if (localStorage.getItem(THEME_KEY) === "dark") {
  document.body.classList.add("dark");
  $("themeToggle").textContent = "☀";
}

$("date").value = new Date().toISOString().split("T")[0];

// Lightweight pointer interaction: gives glass cards a subtle 3D floating feel.
if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  document.querySelectorAll('.summary-card, .panel').forEach(card => {
    card.addEventListener('pointermove', e => {
      const r = card.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - .5;
      const y = (e.clientY - r.top) / r.height - .5;
      card.style.transform = `translateY(-4px) perspective(700px) rotateX(${(-y * 2).toFixed(2)}deg) rotateY(${(x * 2).toFixed(2)}deg)`;
    });
    card.addEventListener('pointerleave', () => card.style.transform = '');
  });
}

updateSummary();
updateCategoryFilter();
renderTransactions();