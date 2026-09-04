// Sample initial transactions data
let transactions = [
  {
    id: 1,
    merchant: "Apple Store Inc.",
    icon: "laptop",
    category: "Shopping",
    date: "Today, 02:45 PM",
    card: "SpendWise Black (••• 8842)",
    amount: -129.00,
    status: "Completed"
  },
  {
    id: 2,
    merchant: "Starbucks Reserve",
    icon: "coffee",
    category: "Food & Dining",
    date: "Today, 09:12 AM",
    card: "SpendWise Black (••• 8842)",
    amount: -8.75,
    status: "Completed"
  },
  {
    id: 3,
    merchant: "GitHub Enterprise",
    icon: "code",
    category: "Software",
    date: "Yesterday",
    card: "SpendWise Black (••• 8842)",
    amount: -21.00,
    status: "Completed"
  },
  {
    id: 4,
    merchant: "Uber Technologies",
    icon: "car",
    category: "Travel",
    date: "Sep 02, 2026",
    card: "Travel Rewards (••• 3019)",
    amount: -34.50,
    status: "Completed"
  },
  {
    id: 5,
    merchant: "AWS Cloud Services",
    icon: "server",
    category: "Software",
    date: "Sep 01, 2026",
    card: "SpendWise Black (••• 8842)",
    amount: -245.80,
    status: "Completed"
  }
];

// Initialize UI and Chart
let expenseChart = null;

document.addEventListener("DOMContentLoaded", () => {
  renderLucide();
  initExpenseChart();
  renderTransactions();
  setupModalEvents();
  setupFilterEvents();
});

function renderLucide() {
  if (window.lucide) {
    window.lucide.createIcons();
  }
}

// Chart.js Setup
function initExpenseChart() {
  const ctx = document.getElementById('expenseChart').getContext('2d');
  
  const gradient = ctx.createLinearGradient(0, 0, 0, 300);
  gradient.addColorStop(0, 'rgba(99, 102, 241, 0.4)');
  gradient.addColorStop(1, 'rgba(99, 102, 241, 0.0)');

  expenseChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      datasets: [
        {
          label: 'Spending ($)',
          data: [240, 180, 480, 320, 690, 420, 350],
          borderColor: '#6366f1',
          backgroundColor: gradient,
          fill: true,
          tension: 0.4,
          borderWidth: 3,
          pointBackgroundColor: '#818cf8',
          pointRadius: 4,
          pointHoverRadius: 6
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#1e293b',
          titleColor: '#f8fafc',
          bodyColor: '#cbd5e1',
          padding: 10,
          borderColor: '#334155',
          borderWidth: 1,
          displayColors: false,
          callbacks: {
            label: (context) => `$${context.parsed.y}`
          }
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: { color: '#94a3b8' }
        },
        y: {
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: { 
            color: '#94a3b8',
            callback: (val) => `$${val}`
          }
        }
      }
    }
  });
}

// Render Transactions in Table
function renderTransactions() {
  const tbody = document.getElementById("transactionTableBody");
  const searchQuery = (document.getElementById("searchTransactions")?.value || "").toLowerCase();
  const selectedCategory = document.getElementById("categoryFilter")?.value || "ALL";

  const filtered = transactions.filter(t => {
    const matchesSearch = t.merchant.toLowerCase().includes(searchQuery) || t.category.toLowerCase().includes(searchQuery);
    const matchesCategory = selectedCategory === "ALL" || t.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="px-6 py-8 text-center text-slate-500 text-sm">
          No transactions found matching your criteria.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filtered.map(item => `
    <tr class="hover:bg-slate-800/30 transition duration-150">
      <td class="px-6 py-4 font-medium text-white flex items-center gap-3">
        <div class="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700/60 flex items-center justify-center text-indigo-400">
          <i data-lucide="${item.icon || 'shopping-bag'}" class="w-4 h-4"></i>
        </div>
        <span>${item.merchant}</span>
      </td>
      <td class="px-6 py-4">
        <span class="px-2.5 py-1 text-xs rounded-lg font-medium ${getCategoryBadge(item.category)}">
          ${item.category}
        </span>
      </td>
      <td class="px-6 py-4 text-xs text-slate-400">${item.date}</td>
      <td class="px-6 py-4 text-xs text-slate-300">${item.card}</td>
      <td class="px-6 py-4 text-right font-semibold text-white tracking-tight">
        -$${Math.abs(item.amount).toFixed(2)}
      </td>
      <td class="px-6 py-4 text-center">
        <span class="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
          <span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
          ${item.status}
        </span>
      </td>
    </tr>
  `).join('');

  renderLucide();
}

function getCategoryBadge(category) {
  switch (category) {
    case 'Shopping':
      return 'bg-violet-500/10 text-violet-400 border border-violet-500/20';
    case 'Food & Dining':
      return 'bg-amber-500/10 text-amber-400 border border-amber-500/20';
    case 'Software':
      return 'bg-sky-500/10 text-sky-400 border border-sky-500/20';
    case 'Travel':
      return 'bg-pink-500/10 text-pink-400 border border-pink-500/20';
    default:
      return 'bg-slate-700/50 text-slate-300 border border-slate-600/30';
  }
}

// Modal handling
function setupModalEvents() {
  const modal = document.getElementById("expenseModal");
  const modalCard = document.getElementById("modalCard");
  const quickAddBtn = document.getElementById("quickAddBtn");
  const closeModalBtn = document.getElementById("closeModalBtn");
  const cancelModalBtn = document.getElementById("cancelModalBtn");
  const addExpenseForm = document.getElementById("addExpenseForm");

  const openModal = () => {
    modal.classList.remove("hidden");
    setTimeout(() => {
      modal.classList.remove("opacity-0");
      modalCard.classList.remove("scale-95");
      modalCard.classList.add("scale-100");
    }, 10);
  };

  const closeModal = () => {
    modal.classList.add("opacity-0");
    modalCard.classList.remove("scale-100");
    modalCard.classList.add("scale-95");
    setTimeout(() => {
      modal.classList.add("hidden");
    }, 200);
  };

  quickAddBtn.addEventListener("click", openModal);
  closeModalBtn.addEventListener("click", closeModal);
  cancelModalBtn.addEventListener("click", closeModal);

  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeModal();
  });

  addExpenseForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const merchant = document.getElementById("expenseMerchant").value.trim();
    const amount = parseFloat(document.getElementById("expenseAmount").value);
    const category = document.getElementById("expenseCategory").value;
    const card = document.getElementById("expenseCard").value;

    let icon = "shopping-bag";
    if (category === "Food & Dining") icon = "coffee";
    if (category === "Software") icon = "code";
    if (category === "Travel") icon = "car";
    if (category === "Utilities") icon = "zap";

    const newTx = {
      id: Date.now(),
      merchant,
      icon,
      category,
      date: "Just now",
      card,
      amount: -Math.abs(amount),
      status: "Completed"
    };

    transactions.unshift(newTx);
    renderTransactions();

    // Update stats
    const spentEl = document.getElementById("statSpent");
    const currentSpent = parseFloat(spentEl.innerText.replace('$', '').replace(',', ''));
    spentEl.innerText = `$${(currentSpent + amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    addExpenseForm.reset();
    closeModal();
  });
}

function setupFilterEvents() {
  const searchInput = document.getElementById("searchTransactions");
  const categoryFilter = document.getElementById("categoryFilter");

  if (searchInput) {
    searchInput.addEventListener("input", renderTransactions);
  }
  if (categoryFilter) {
    categoryFilter.addEventListener("change", renderTransactions);
  }
}
