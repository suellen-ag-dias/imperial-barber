/* 
  Imperial Barber — Core Logic
  Armazenamento local via localStorage.
*/

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const STORAGE = {
  users: "imperial_users",
  session: "imperial_session",
  bookings: "imperial_bookings",
  reviews: "imperial_reviews"
};

const services = [
  { 
    id: "corte", 
    name: "Corte masculino", 
    price: 45, 
    description: "Corte tradicional ou moderno, com acabamento profissional.", 
    duration: 45, 
    symbol: "✂" 
  },
  { 
    id: "barba", 
    name: "Barba", 
    price: 30, 
    description: "Modelagem, toalha quente e acabamento cuidadoso.", 
    duration: 30, 
    symbol: "▤" 
  },
  { 
    id: "combo", 
    name: "Cabelo + barba", 
    price: 65, 
    description: "Uma experiência completa para renovar seu visual.", 
    duration: 75, 
    symbol: "✦" 
  },
  { 
    id: "sobrancelha", 
    name: "Sobrancelha", 
    price: 15, 
    description: "Ajuste e limpeza para valorizar sua expressão.", 
    duration: 15, 
    symbol: "⌁" 
  },
  { 
    id: "pezinho", 
    name: "Acabamento", 
    price: 15, 
    description: "Contorno, pezinho e pequenos ajustes no corte.", 
    duration: 15, 
    symbol: "⌖" 
  },
  { 
    id: "pigmentacao", 
    name: "Pigmentação", 
    price: 25, 
    description: "Realce de contornos e preenchimento com efeito natural.", 
    duration: 30, 
    symbol: "◈" 
  }
];

let currentUser = null;
let selectedDate = null;
let selectedTime = null;
let selectedRating = 0;
let calendarMonth = new Date(); 
calendarMonth.setDate(1);
let toastTimer;

// Helpers de Storage e Formatação
function read(key, fallback = []) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function money(value) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function dateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function fromKey(key) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d, 12);
}

function formatDate(key) {
  return fromKey(key).toLocaleDateString("pt-BR", { 
    day: "2-digit", 
    month: "long", 
    year: "numeric" 
  });
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[c]));
}

function notify(message) {
  const el = $("#toast");
  el.textContent = message;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 3000);
}

function userBookings() {
  return read(STORAGE.bookings, []).filter(item => item.userId === currentUser?.id);
}

function saveBookings(items) {
  const all = read(STORAGE.bookings, []).filter(item => item.userId !== currentUser.id);
  write(STORAGE.bookings, [...all, ...items]);
}

// Auth e Navegação
function showAuth(mode = "login") {
  $("#loginPanel").hidden = mode !== "login";
  $("#registerPanel").hidden = mode !== "register";
}

function enterApp(user) {
  currentUser = user;
  write(STORAGE.session, { id: user.id });
  $("#authOverlay").classList.add("hidden");
  
  const first = user.name.trim().split(/\s+/)[0];
  $("#greetingName").textContent = first;
  $("#sidebarName").textContent = user.name;
  $("#userAvatar").textContent = first[0].toUpperCase();
  $("#mobileAvatar").textContent = first[0].toUpperCase();
  
  renderAppointments();
  renderReviews();
  renderCalendar();
  navigate("home");
}

function logout() {
  currentUser = null;
  localStorage.removeItem(STORAGE.session);
  $("#authOverlay").classList.remove("hidden");
  $("#loginForm").reset();
  $("#loginMessage").textContent = "";
  $("#sidebar").classList.remove("open");
  showAuth("login");
}

function navigate(name) {
  if (!currentUser && name !== "login") return;
  
  $$(".page").forEach(page => page.classList.toggle("active", page.id === `page-${name}`));
  $$(".nav-link[data-nav]").forEach(button => button.classList.toggle("active", button.dataset.nav === name));
  $("#sidebar").classList.remove("open");
  
  if (name === "booking") { renderCalendar(); updateSummary(); }
  if (name === "appointments") renderAppointments();
  if (name === "services") renderServices();
  if (name === "reviews") renderReviews();
  
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// Serviços
function renderServices() {
  $("#serviceSelect").innerHTML = services.map(s => 
    `<option value="${s.id}">${s.name} — ${money(s.price)}</option>`
  ).join("");
  
  $("#servicesGrid").innerHTML = services.map(s => `
    <article class="service-card">
      <span class="service-symbol">${s.symbol}</span>
      <h3>${s.name}</h3>
      <p>${s.description}</p>
      <strong>${money(s.price)}</strong>
      <small style="color:#888;font-size:10px">${s.duration} minutos</small>
    </article>
  `).join("");
  
  updateServiceInfo();
}

function updateServiceInfo() {
  const service = services.find(s => s.id === $("#serviceSelect").value) || services[0];
  $("#serviceDescription").textContent = service.description;
  $("#servicePrice").textContent = money(service.price);
  updateSummary();
}

// Calendário
function renderCalendar() {
  const year = calendarMonth.getFullYear();
  const month = calendarMonth.getMonth();
  
  $("#monthLabel").textContent = calendarMonth.toLocaleDateString("pt-BR", { 
    month: "long", 
    year: "numeric" 
  });
  
  const first = new Date(year, month, 1).getDay();
  const last = new Date(year, month + 1, 0).getDate();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const days = [];
  for (let i = 0; i < first; i++) {
    days.push(`<span></span>`);
  }
  
  for (let day = 1; day <= last; day++) {
    const date = new Date(year, month, day, 12);
    const key = dateKey(date);
    const disabled = date < today || date.getDay() === 0;
    
    days.push(`
      <button class="calendar-day ${selectedDate === key ? "selected" : ""}" data-date="${key}" ${disabled ? "disabled" : ""}>
        ${day}
      </button>
    `);
  }
  
  $("#calendarDays").innerHTML = days.join("");
  
  $$("#calendarDays [data-date]").forEach(button => 
    button.addEventListener("click", () => selectDate(button.dataset.date))
  );
  
  $("#prevMonth").disabled = year === today.getFullYear() && month <= today.getMonth();
}

function selectDate(key) {
  selectedDate = key;
  selectedTime = null;
  renderCalendar();
  renderSlots();
  updateSummary();
}

function availableTimes(key) {
  const day = fromKey(key).getDay();
  if (day === 0) return [];
  
  const hours = day === 6 
    ? ["09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "12:00", "13:00"]
    : ["09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30", "17:00", "17:30"];
  
  const booked = read(STORAGE.bookings, []).filter(b => b.date === key && b.status === "Confirmado").map(b => b.time);
  const now = new Date();
  
  return hours.map(time => ({
    time,
    disabled: booked.includes(time) || (key === dateKey(now) && time <= `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`)
  }));
}

function renderSlots() {
  if (!selectedDate) {
    $("#selectedDateLabel").textContent = "Escolha uma data";
    $("#timeSlots").innerHTML = '<p class="empty-hint">Selecione uma data para visualizar os horários.</p>';
    return;
  }
  
  $("#selectedDateLabel").textContent = formatDate(selectedDate);
  const slots = availableTimes(selectedDate);
  
  $("#timeSlots").innerHTML = slots.length 
    ? slots.map(s => `
        <button class="slot ${selectedTime === s.time ? "selected" : ""}" data-time="${s.time}" ${s.disabled ? "disabled" : ""}>
          ${s.time}
        </button>
      `).join("")
    : '<p class="empty-hint">Não há horários disponíveis para este dia.</p>';
    
  $$("#timeSlots [data-time]").forEach(button => 
    button.addEventListener("click", () => {
      selectedTime = button.dataset.time;
      renderSlots();
      updateSummary();
    })
  );
}

function updateSummary() {
  const service = services.find(s => s.id === $("#serviceSelect").value) || services[0];
  const date = selectedDate ? formatDate(selectedDate) : "data não selecionada";
  const time = selectedTime || "horário não selecionado";
  $("#summaryText").textContent = `${date} • ${time} • ${service.name}`;
}

// Agendamentos
function confirmBooking() {
  if (!selectedDate || !selectedTime) {
    notify("Selecione uma data e um horário.");
    return;
  }
  
  const service = services.find(s => s.id === $("#serviceSelect").value) || services[0];
  const bookings = read(STORAGE.bookings, []);
  
  if (bookings.some(b => b.date === selectedDate && b.time === selectedTime && b.status === "Confirmado")) {
    notify("Este horário acabou de ser reservado. Escolha outro.");
    renderSlots();
    return;
  }
  
  const booking = {
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
    userId: currentUser.id,
    date: selectedDate,
    time: selectedTime,
    serviceId: service.id,
    serviceName: service.name,
    price: service.price,
    status: "Confirmado",
    createdAt: new Date().toISOString()
  };
  
  bookings.push(booking);
  write(STORAGE.bookings, bookings);
  
  $("#confirmationDetails").innerHTML = `
    <div class="detail-row"><span>▦</span><small>Data</small><strong>${formatDate(booking.date)}</strong></div>
    <div class="detail-row"><span>◷</span><small>Horário</small><strong>${booking.time}</strong></div>
    <div class="detail-row"><span>✂</span><small>Serviço</small><strong>${escapeHTML(booking.serviceName)}</strong></div>
    <div class="detail-row"><span>＄</span><small>Valor</small><strong>${money(booking.price)}</strong></div>
  `;
  
  selectedDate = null;
  selectedTime = null;
  navigate("confirmation");
}

function renderAppointments() {
  const items = userBookings().sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  
  if (!items.length) {
    $("#appointmentsList").innerHTML = `
      <div class="empty-state">
        <strong>Você ainda não tem agendamentos.</strong>
        Que tal reservar seu próximo horário?<br><br>
        <button class="btn btn-gold" data-nav="booking">Agendar agora →</button>
      </div>
    `;
    return;
  }
  
  $("#appointmentsList").innerHTML = items.map(item => `
    <article class="appointment-card">
      <div class="date-badge">
        <strong>${fromKey(item.date).getDate()}</strong>
        <small>${fromKey(item.date).toLocaleDateString("pt-BR", { month: "short" }).replace(".", "").toUpperCase()}</small>
      </div>
      <div class="appointment-info">
        <h3>${escapeHTML(item.serviceName)}</h3>
        <p>${formatDate(item.date)} às ${item.time} • ${money(item.price)}</p>
        <span class="status">${item.status.toUpperCase()}</span>
      </div>
      ${item.status === "Confirmado" && item.date >= dateKey(new Date()) ? `<button class="cancel-btn" data-cancel="${item.id}">Cancelar</button>` : ""}
    </article>
  `).join("");
  
  $$("[data-cancel]").forEach(button => 
    button.addEventListener("click", () => cancelBooking(button.dataset.cancel))
  );
}

function cancelBooking(id) {
  if (!confirm("Deseja realmente cancelar este agendamento?")) return;
  
  const all = read(STORAGE.bookings, []);
  const item = all.find(b => b.id === id && b.userId === currentUser.id);
  if (item) item.status = "Cancelado";
  
  write(STORAGE.bookings, all);
  renderAppointments();
  notify("Agendamento cancelado.");
}

// Avaliações
function renderReviews() {
  const reviews = read(STORAGE.reviews, []).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  
  $("#reviewsList").innerHTML = reviews.length 
    ? reviews.map(r => `
        <article class="review-item">
          <div class="review-stars">${"★".repeat(r.rating)}${"☆".repeat(5 - r.rating)}</div>
          <p>${escapeHTML(r.text)}</p>
          <small>${escapeHTML(r.name)} • ${new Date(r.createdAt).toLocaleDateString("pt-BR")}</small>
        </article>
      `).join("")
    : '<div class="empty-state"><strong>Seja a primeira avaliação!</strong>Seu comentário aparecerá aqui.</div>';
}

// Event Listeners e Inicialização
function setupEvents() {
  document.addEventListener("click", event => {
    const nav = event.target.closest("[data-nav]");
    if (nav) {
      event.preventDefault();
      navigate(nav.dataset.nav);
    }
  });
  
  $("#menuToggle").addEventListener("click", () => $("#sidebar").classList.toggle("open"));
  $("#logoutBtn").addEventListener("click", logout);
  
  $("#showRegister").addEventListener("click", () => showAuth("register"));
  $("#showLogin").addEventListener("click", () => showAuth("login"));
  
  $("#loginForm").addEventListener("submit", event => {
    event.preventDefault();
    const email = $("#loginEmail").value.trim().toLowerCase();
    const password = $("#loginPassword").value;
    
    const user = read(STORAGE.users, []).find(u => u.email === email && u.password === password);
    if (!user) {
      $("#loginMessage").textContent = "E-mail ou senha incorretos. Verifique seus dados ou cadastre-se.";
      return;
    }
    enterApp(user);
  });
  
  $("#registerForm").addEventListener("submit", event => {
    event.preventDefault();
    const name = $("#registerName").value.trim();
    const email = $("#registerEmail").value.trim().toLowerCase();
    const password = $("#registerPassword").value;
    
    const users = read(STORAGE.users, []);
    if (users.some(u => u.email === email)) {
      $("#registerMessage").textContent = "Este e-mail já possui cadastro.";
      return;
    }
    
    const user = {
      id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
      name,
      email,
      password
    };
    
    users.push(user);
    write(STORAGE.users, users);
    $("#registerForm").reset();
    enterApp(user);
    notify("Conta criada com sucesso!");
  });
  
  $("#prevMonth").addEventListener("click", () => {
    calendarMonth.setMonth(calendarMonth.getMonth() - 1);
    renderCalendar();
  });
  
  $("#nextMonth").addEventListener("click", () => {
    calendarMonth.setMonth(calendarMonth.getMonth() + 1);
    renderCalendar();
  });
  
  $("#serviceSelect").addEventListener("change", updateServiceInfo);
  $("#confirmBooking").addEventListener("click", confirmBooking);
  
  $$("#ratingPicker button").forEach(button => 
    button.addEventListener("click", () => {
      selectedRating = Number(button.dataset.rating);
      $$("#ratingPicker button").forEach(b => 
        b.classList.toggle("active", Number(b.dataset.rating) <= selectedRating)
      );
    })
  );
  
  $("#reviewForm").addEventListener("submit", event => {
    event.preventDefault();
    if (!selectedRating) {
      $("#reviewMessage").textContent = "Escolha uma nota de 1 a 5 estrelas.";
      return;
    }
    
    const reviews = read(STORAGE.reviews, []);
    reviews.push({
      id: String(Date.now()),
      userId: currentUser.id,
      name: currentUser.name,
      rating: selectedRating,
      text: $("#reviewText").value.trim(),
      createdAt: new Date().toISOString()
    });
    
    write(STORAGE.reviews, reviews);
    $("#reviewForm").reset();
    selectedRating = 0;
    $$("#ratingPicker button").forEach(b => b.classList.remove("active"));
    $("#reviewMessage").textContent = "Obrigado! Sua avaliação foi registrada.";
    renderReviews();
  });
}

function init() {
  $("#year").textContent = new Date().getFullYear();
  renderServices();
  setupEvents();
  
  const session = read(STORAGE.session, null);
  const user = session && read(STORAGE.users, []).find(u => u.id === session.id);
  
  if (user) {
    enterApp(user);
  } else {
    $("#authOverlay").classList.remove("hidden");
    showAuth("login");
  }
}

init();