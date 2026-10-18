(() => {
  "use strict";

  const STORAGE_KEY = "florball-coach-web-v1";
  const DAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Нд"];
  const FULL_DAYS = ["Понеділок", "Вівторок", "Середа", "Четвер", "П’ятниця", "Субота", "Неділя"];
  const STARTER_NORMS = [
    { id: "ball-control", title: "Ведення м’яча", description: "Контроль м’яча між конусами", target: 5, unit: "кіл", done: 0, reminderEnabled: false, reminderHour: 18, reminderMinute: 0 },
    { id: "shots", title: "Кидки по воротах", description: "Точність і швидкість кидка", target: 30, unit: "кидків", done: 0, reminderEnabled: false, reminderHour: 18, reminderMinute: 0 },
    { id: "sprint", title: "Спринт 20 м", description: "Стартова швидкість гравця", target: 6, unit: "спроб", done: 0, reminderEnabled: false, reminderHour: 18, reminderMinute: 0 },
    { id: "plank", title: "Планка", description: "Стабільність корпусу", target: 60, unit: "сек", done: 0, reminderEnabled: false, reminderHour: 18, reminderMinute: 0 }
  ];
  const ROUTINES = [
    { title: "Контроль м’яча", focus: "Техніка та координація", icon: "🏑", steps: [
      { title: "Розминка з ключкою", seconds: 120, description: "Легке ведення м’яча на місці та в русі." },
      { title: "Змійка між конусами", seconds: 180, description: "Проведи м’яч між конусами, контролюй обидві сторони." },
      { title: "Ведення на швидкість", seconds: 120, description: "Прискорюйся з м’ячем, не втрачаючи контроль." },
      { title: "Спокійне завершення", seconds: 60, description: "Знизь темп і віднови дихання." }
    ] },
    { title: "Кидки та точність", focus: "Кидок і завершення атаки", icon: "🎯", steps: [
      { title: "Розминка кистей", seconds: 90, description: "Підготуй кисті та плечі легкими рухами." },
      { title: "Кидки в кути воріт", seconds: 240, description: "Виконуй серії кидків у різні кути та рахуй влучання." },
      { title: "Кидок після ведення", seconds: 180, description: "Прокинь м’яч і швидко виконай кидок." },
      { title: "Відновлення", seconds: 60, description: "Зроби паузу та запиши кількість точних кидків." }
    ] },
    { title: "Швидкість і витривалість", focus: "Рух на майданчику", icon: "⚡", steps: [
      { title: "Динамічна розминка", seconds: 180, description: "Легкий біг і рухливість гомілок та стегон." },
      { title: "Спринт 20 метрів", seconds: 180, description: "Виконай швидкі відрізки з повним відпочинком." },
      { title: "Переміщення в стійці", seconds: 180, description: "Рухайся вбік у флорбольній стійці, зберігай баланс." },
      { title: "Заминка", seconds: 120, description: "Пройдися та легко розтягни м’язи без болю." }
    ] }
  ];

  const app = document.getElementById("app");
  const modalRoot = document.getElementById("modal-root");
  const toastRoot = document.getElementById("toast-root");
  let deferredInstallPrompt = null;
  let toastTimeout = null;
  let timerInterval = null;
  let state = loadState();

  function defaultState() {
    return {
      profile: null,
      norms: JSON.parse(JSON.stringify(STARTER_NORMS)),
      sessions: [],
      trainingDays: [0, 2, 4],
      reminderLog: {},
      page: "plan",
      modal: null,
      timer: null
    };
  }

  function loadState() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (!saved || typeof saved !== "object") return defaultState();
      const fresh = defaultState();
      return {
        ...fresh,
        profile: saved.profile && typeof saved.profile.name === "string" ? saved.profile : null,
        norms: Array.isArray(saved.norms) ? saved.norms : fresh.norms,
        sessions: Array.isArray(saved.sessions) ? saved.sessions : [],
        trainingDays: Array.isArray(saved.trainingDays) ? saved.trainingDays : fresh.trainingDays,
        reminderLog: saved.reminderLog && typeof saved.reminderLog === "object" ? saved.reminderLog : {}
      };
    } catch (_) {
      return defaultState();
    }
  }

  function saveState() {
    const { profile, norms, sessions, trainingDays, reminderLog } = state;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ profile, norms, sessions, trainingDays, reminderLog }));
    } catch (_) {
      showToast("Не вдалося зберегти дані. Перевір вільне місце в браузері.");
    }
  }

  function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  }

  function progress(norm) {
    const target = Number(norm.target);
    if (!Number.isFinite(target) || target <= 0) return 0;
    return Math.min(1, Math.max(0, Number(norm.done || 0) / target));
  }

  function fmtDate(timestamp, includeTime = true) {
    const date = new Date(timestamp);
    return new Intl.DateTimeFormat("uk-UA", includeTime ? { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" } : { day: "2-digit", month: "2-digit" }).format(date);
  }

  function dateKey(date = new Date()) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }

  function mondayIndex(date = new Date()) {
    return (date.getDay() + 6) % 7;
  }

  function showToast(message) {
    clearTimeout(toastTimeout);
    toastRoot.innerHTML = `<div class="toast">${esc(message)}</div>`;
    toastTimeout = setTimeout(() => { toastRoot.innerHTML = ""; }, 2800);
  }

  function setModal(modal) {
    if (modal?.type !== "timer" && state.timer) stopTimer();
    state.modal = modal;
    renderModal();
  }

  function render() {
    if (!state.profile) {
      renderLogin();
      return;
    }
    const title = state.page === "stats" ? "Статистика гравця" : state.page === "schedule" ? "Тренувальний тиждень" : state.page === "profile" ? "Профіль гравця" : "План нормативів";
    const main = state.page === "stats" ? renderStats() : state.page === "schedule" ? renderSchedule() : state.page === "profile" ? renderProfile() : renderPlan();
    const install = installBanner();
    app.innerHTML = `
      <header class="topbar">
        <img class="brand-logo" src="assets/logo.svg" alt="">
        <div class="brand-copy"><p class="brand-kicker">Флорбол • Тренування</p><p class="brand-title">Привіт, ${esc(state.profile.name)}!</p></div>
        <button class="icon-button" type="button" data-action="open-profile" aria-label="Профіль гравця">♙</button>
      </header>
      ${install}
      ${main}
      <nav class="bottom-nav" aria-label="Основна навігація">
        <button class="nav-button ${state.page === "plan" ? "active" : ""}" data-page="plan"><span class="nav-icon">🏑</span><span>План</span></button>
        <button class="nav-button ${state.page === "schedule" ? "active" : ""}" data-page="schedule"><span class="nav-icon">⏱</span><span>Розклад</span></button>
        <button class="nav-button ${state.page === "stats" ? "active" : ""}" data-page="stats"><span class="nav-icon">▥</span><span>Статистика</span></button>
      </nav>
      ${state.page === "plan" ? `<button class="fab" type="button" data-action="add-norm" aria-label="Додати норматив">＋</button>` : ""}`;
    renderModal();
  }

  function renderLogin() {
    app.innerHTML = `
      <main class="login-screen">
        <section class="login-card" aria-label="Вхід до Флорбол Тренер">
          <img class="login-logo" src="assets/logo.svg" alt="Логотип Флорбол Тренер">
          <h1 class="login-title">Твій сезон починається</h1>
          <p class="login-subtitle">Плануй тренування. Рости в грі.</p>
          <form id="login-form">
            <div class="field"><label for="player-name">Ім’я гравця</label><input id="player-name" name="name" maxlength="32" autocomplete="nickname" placeholder="Як тебе звати?" required></div>
            <div class="form-error" id="login-error" role="alert"></div>
            <button class="primary-button" type="submit">Створити профіль <span aria-hidden="true">→</span></button>
          </form>
          <p class="login-note">Профіль зберігається тільки в цьому браузері. Це особистий профіль на пристрої, а не онлайн-акаунт.</p>
        </section>
      </main>`;
  }

  function renderPlan() {
    const doneCount = state.norms.filter(norm => progress(norm) >= 1).length;
    const cards = state.norms.map(norm => {
      const pct = Math.round(progress(norm) * 100);
      return `<article class="norm-card">
        <div class="norm-top">
          <div class="norm-mark" aria-hidden="true">🏑</div>
          <div class="norm-title-wrap"><h3 class="norm-title">${esc(norm.title)}</h3><p class="norm-description">${esc(norm.description || "Твій флорбольний норматив")}</p></div>
          ${norm.reminderEnabled ? `<span class="reminder-indicator" title="Нагадування ввімкнено">◷</span>` : ""}
        </div>
        <div class="norm-progress-line"><span>${Number(norm.done || 0)} / ${esc(norm.target)} ${esc(norm.unit)}</span><span class="percent">${pct}%</span></div>
        <div class="progress-track" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><div class="progress-fill" style="width:${pct}%"></div></div>
        <div class="norm-actions">
          <button class="secondary-button" data-action="details" data-id="${esc(norm.id)}">Деталі</button>
          <button class="primary-button" data-action="quick-record" data-id="${esc(norm.id)}">✓ Зарахувати</button>
          <button class="secondary-button delete-action" aria-label="Видалити норматив ${esc(norm.title)}" data-action="delete-norm" data-id="${esc(norm.id)}">⌫</button>
        </div>
      </article>`;
    }).join("");
    return `<main class="page-wrap">
      <section class="welcome-card">
        <p class="eyebrow">Твоя ціль на сьогодні</p>
        <h1 class="welcome-title">Кожне тренування наближає до перемоги, ${esc(state.profile.name)}!</h1>
        <p class="welcome-subtitle">Відмічай прогрес і впевнено грай свій сезон.</p>
        <div class="goal-row"><div class="progress-track"><div class="progress-fill" style="width:${state.norms.length ? Math.round(doneCount / state.norms.length * 100) : 0}%"></div></div><span class="goal-count">${doneCount}/${state.norms.length}</span></div>
      </section>
      <div class="section-heading"><div><h2>Твої нормативи</h2><p>${state.norms.length ? "Відкрий деталі, щоб записати результат." : "Додай перший норматив до свого плану."}</p></div></div>
      ${state.norms.length ? `<section class="norm-list">${cards}</section>` : `<div class="empty-state"><div class="empty-emoji">🏑</div><strong>План поки порожній</strong>Натисни +, щоб додати перший норматив.</div>`}
    </main>`;
  }

  function renderSchedule() {
    const today = mondayIndex();
    const days = DAYS.map((day, index) => `<button class="day-chip ${state.trainingDays.includes(index) ? "selected" : ""} ${today === index ? "today" : ""}" data-action="toggle-day" data-day="${index}" aria-pressed="${state.trainingDays.includes(index)}"><span>${day}</span><span class="day-check">${state.trainingDays.includes(index) ? "✓" : "＋"}</span></button>`).join("");
    const routines = ROUTINES.map((routine, index) => `<article class="routine-card"><div class="routine-symbol" aria-hidden="true">${routine.icon}</div><div class="routine-copy"><strong>${esc(routine.title)}</strong><span>${esc(routine.focus)}</span><span class="routine-duration">${routine.steps.length} етапи · ${Math.round(routine.steps.reduce((sum, step) => sum + step.seconds, 0) / 60)} хв</span></div><button class="primary-button" data-action="start-routine" data-index="${index}">Старт</button></article>`).join("");
    return `<main class="page-wrap">
      <h1 class="page-title">Твій тиждень</h1><p class="page-subtitle">Обери дні тренувань і запускай короткий флорбольний комплекс.</p>
      <section class="welcome-card"><p class="eyebrow">Тижневий план</p><h2 class="welcome-title">Заплануй тренування</h2><p class="welcome-subtitle">Познач дні, коли хочеш виходити на майданчик.</p><div class="day-selector">${days}</div><p class="welcome-subtitle" style="margin:12px 0 0">Обрано ${state.trainingDays.length} ${state.trainingDays.length === 1 ? "день" : "днів"} на тиждень.</p></section>
      <div class="section-heading"><div><h2>Готові комплекси</h2><p>Таймер веде тебе крок за кроком.</p></div></div>
      <section class="routine-list">${routines}</section>
      <p class="disclaimer">Комплекси — загальні приклади вправ. Підлаштуй навантаження під рекомендації тренера та своє самопочуття.</p>
    </main>`;
  }

  function renderStats() {
    const total = state.sessions.reduce((sum, session) => sum + Number(session.amount || 0), 0);
    const uniqueDays = new Set(state.sessions.map(session => dateKey(new Date(session.date))));
    const streak = currentStreak();
    const week = Array.from({ length: 7 }, (_, i) => {
      const date = new Date(); date.setHours(0, 0, 0, 0); date.setDate(date.getDate() - (6 - i));
      const value = state.sessions.filter(session => dateKey(new Date(session.date)) === dateKey(date)).reduce((sum, session) => sum + Number(session.amount || 0), 0);
      return { date, value };
    });
    const max = Math.max(1, ...week.map(day => day.value));
    const bars = week.map(day => `<div class="chart-day"><span class="chart-value">${day.value || ""}</span><div class="chart-bar-wrap"><div class="chart-bar" style="height:${day.value ? Math.max(7, day.value / max * 100) : 3}%"></div></div></div>`).join("");
    const labels = week.map(day => `<span>${DAYS[(day.date.getDay() + 6) % 7]}</span>`).join("");
    const records = state.norms.map(norm => {
      const attempts = state.sessions.filter(session => session.normId === norm.id);
      const best = attempts.reduce((winner, item) => !winner || Number(item.amount) > Number(winner.amount) ? item : winner, null);
      return `<div class="record-row"><div class="norm-mark" aria-hidden="true">🏑</div><div class="row-main"><strong>${esc(norm.title)}</strong><small>Загальний прогрес: ${Number(norm.done || 0)} / ${esc(norm.target)} ${esc(norm.unit)}</small></div><span class="row-value">${best ? `${esc(best.amount)} ${esc(norm.unit)}` : "—"}</span></div>`;
    }).join("");
    const history = state.sessions.slice().sort((a, b) => b.date - a.date).slice(0, 10).map(session => {
      const norm = state.norms.find(item => item.id === session.normId);
      return `<div class="history-row"><span class="history-date">${fmtDate(session.date)}</span><div class="row-main"><strong>${esc(norm?.title || "Норматив")}</strong><small>${esc(session.note || "Тренування")}</small></div><span class="row-value">+${esc(session.amount)}</span></div>`;
    }).join("");
    return `<main class="page-wrap">
      <h1 class="page-title">Статистика гравця</h1><p class="page-subtitle">Твої результати й регулярність тренувань.</p>
      <section class="stat-grid"><article class="stat-card"><div class="stat-value">${total}</div><div class="stat-label">зараховано</div></article><article class="stat-card"><div class="stat-value">${streak}</div><div class="stat-label">днів поспіль</div></article><article class="stat-card"><div class="stat-value">${uniqueDays.size}</div><div class="stat-label">активних днів</div></article></section>
      <section class="surface-card"><h2 class="surface-title">Активність за 7 днів</h2><div class="chart">${bars}</div><div class="chart-labels">${labels}</div></section>
      <section class="surface-card" style="margin-top:12px"><h2 class="surface-title">Особисті рекорди</h2>${records || `<p class="note-text">Додай норматив, щоб бачити свої рекорди.</p>`}</section>
      <section class="surface-card" style="margin-top:12px"><h2 class="surface-title">Що дають вправи</h2>
        <div class="benefit-row"><span class="benefit-icon">⚡</span><div class="row-main"><span class="benefit-title">Швидкість</span><small>Спринти розвивають старт і швидке повернення в гру.</small></div></div>
        <div class="benefit-row"><span class="benefit-icon">🎯</span><div class="row-main"><span class="benefit-title">Точність</span><small>Повторення кидків покращує контроль і влучність.</small></div></div>
        <div class="benefit-row"><span class="benefit-icon">🏑</span><div class="row-main"><span class="benefit-title">Володіння ключкою</span><small>Ведення м’яча допомагає впевнено грати під тиском.</small></div></div>
        <div class="benefit-row"><span class="benefit-icon">💪</span><div class="row-main"><span class="benefit-title">Витривалість</span><small>Планомірні заняття дають сили на весь матч.</small></div></div>
        <p class="disclaimer">Це загальні спортивні переваги вправ; результат залежить від техніки, відпочинку та регулярності.</p>
      </section>
      <section class="surface-card" style="margin-top:12px"><h2 class="surface-title">Останні заняття</h2>${history || `<p class="note-text">Запиши перше виконання нормативу — тут з’явиться історія.</p>`}</section>
    </main>`;
  }

  function renderProfile() {
    return `<main class="page-wrap"><h1 class="page-title">Профіль гравця</h1><p class="page-subtitle">Твій локальний профіль у цьому браузері.</p>
      <section class="profile-header"><img src="assets/logo.svg" alt=""><div><strong>${esc(state.profile.name)}</strong><small>Дані зберігаються на цьому пристрої</small></div></section>
      <section class="surface-card" style="margin-top:12px"><h2 class="surface-title">Змінити ім’я</h2><form id="rename-form"><div class="field"><label for="rename">Ім’я гравця</label><input id="rename" name="name" maxlength="32" value="${esc(state.profile.name)}" required></div><button class="primary-button" type="submit">Зберегти ім’я</button></form></section>
      <section class="surface-card" style="margin-top:12px"><h2 class="surface-title">Нагадування</h2><p class="note-text" style="margin:0">Браузер перевіряє нагадування, коли застосунок відкритий. Якщо дозволені сповіщення, він надішле повідомлення у вибраний час. Для роботи у фоні потрібна окрема серверна push-служба.</p></section>
      <section class="surface-card" style="margin-top:12px"><h2 class="surface-title">Твої дані</h2><p class="note-text" style="margin:0 0 12px">Щоб перенести нормативи й історію на інший пристрій, збережи резервну копію JSON. Не публікуй цей файл: у ньому є твої результати.</p><div class="norm-actions"><button class="secondary-button" data-action="export-data">Зберегти копію</button><button class="secondary-button" data-action="import-data">Завантажити копію</button><input id="import-file" type="file" accept="application/json,.json" hidden></div></section>
      <button class="danger-button" style="width:100%;margin-top:14px" data-action="logout">Вийти з профілю</button>
    </main>`;
  }

  function installBanner() {
    if (window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone) return "";
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    if (!isIos && !deferredInstallPrompt) return "";
    const text = isIos ? "На iPhone натисни «Поділитися», потім «На початковий екран». Так застосунок матиме власну іконку." : "Додай Флорбол Тренер на головний екран для швидкого доступу.";
    return `<div class="page-wrap"><div class="install-banner"><p>${text}</p>${!isIos ? `<button data-action="install">Встановити</button>` : ""}</div></div>`;
  }

  function renderModal() {
    const modal = state.modal;
    if (!modal) { modalRoot.innerHTML = ""; return; }
    if (modal.type === "norm-form") {
      const norm = modal.norm || { title: "", description: "", target: "", unit: "разів" };
      modalRoot.innerHTML = `<div class="modal-backdrop" data-action="backdrop-close"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div class="modal-head"><h2 id="modal-title">${modal.norm ? "Редагувати норматив" : "Новий норматив"}</h2><button class="modal-close" data-action="close-modal" aria-label="Закрити">×</button></div>
        <form id="norm-form"><input type="hidden" name="id" value="${esc(norm.id || "")}"><div class="field"><label for="norm-title">Назва</label><input id="norm-title" name="title" maxlength="48" value="${esc(norm.title)}" required></div>
        <div class="field"><label for="norm-description">Опис вправи</label><textarea id="norm-description" name="description" maxlength="140">${esc(norm.description)}</textarea></div>
        <div class="form-row"><div class="field"><label for="norm-target">Ціль</label><input id="norm-target" name="target" type="number" min="1" max="99999" value="${esc(norm.target)}" required></div><div class="field"><label for="norm-unit">Одиниця</label><input id="norm-unit" name="unit" maxlength="20" value="${esc(norm.unit)}" required></div></div>
        <div class="form-error" id="norm-error" role="alert"></div><div class="modal-actions"><button class="secondary-button" type="button" data-action="close-modal">Скасувати</button><button class="primary-button" type="button" data-action="save-norm">${modal.norm ? "Зберегти" : "Додати"}</button></div></form></section></div>`;
      return;
    }
    if (modal.type === "details") {
      const norm = state.norms.find(item => item.id === modal.id);
      if (!norm) { state.modal = null; return; }
      modalRoot.innerHTML = `<div class="modal-backdrop" data-action="backdrop-close"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div class="modal-head"><h2 id="modal-title">${esc(norm.title)}</h2><button class="modal-close" data-action="close-modal" aria-label="Закрити">×</button></div>
        <p class="page-subtitle">${esc(norm.description || "Твій індивідуальний норматив")}</p>
        <div class="norm-progress-line"><span>${Number(norm.done || 0)} / ${esc(norm.target)} ${esc(norm.unit)}</span><span class="percent">${Math.round(progress(norm) * 100)}%</span></div><div class="progress-track"><div class="progress-fill" style="width:${Math.round(progress(norm) * 100)}%;background:var(--green)"></div></div>
        <form id="record-form" data-id="${esc(norm.id)}"><div class="field"><label for="record-amount">Скільки виконано (${esc(norm.unit)})</label><input id="record-amount" name="amount" type="number" min="1" max="99999" value="1" required></div><div class="field"><label for="record-note">Нотатка або результат</label><textarea id="record-note" name="note" maxlength="140" placeholder="Наприклад, 8 точних кидків"></textarea></div><button class="primary-button" style="width:100%" type="submit">Зберегти виконання</button></form>
        <div class="check-row"><div><strong>Щоденне нагадування</strong><div class="norm-description">Перевіряється, коли застосунок відкритий</div></div><input type="checkbox" id="reminder-enabled" ${norm.reminderEnabled ? "checked" : ""}></div>
        <div class="form-row"><div class="field"><label for="reminder-hour">Година</label><input id="reminder-hour" type="number" min="0" max="23" value="${Number(norm.reminderHour ?? 18)}"></div><div class="field"><label for="reminder-minute">Хвилина</label><input id="reminder-minute" type="number" min="0" max="59" value="${Number(norm.reminderMinute ?? 0)}"></div></div>
        <button class="secondary-button" style="width:100%" data-action="save-reminder" data-id="${esc(norm.id)}">Зберегти нагадування</button>
        <div class="modal-actions"><button class="secondary-button" data-action="edit-norm" data-id="${esc(norm.id)}">Редагувати</button><button class="secondary-button" data-action="close-modal">Закрити</button></div>
        </section></div>`;
      return;
    }
    if (modal.type === "timer") {
      const routine = ROUTINES[modal.index];
      const timer = state.timer || { step: 0, remaining: routine.steps[0].seconds, running: false };
      const current = routine.steps[timer.step];
      modalRoot.innerHTML = `<div class="modal-backdrop" data-action="backdrop-close"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="timer-title"><div class="modal-head"><h2 id="timer-title">${esc(routine.title)}</h2><button class="modal-close" data-action="stop-timer" aria-label="Закрити">×</button></div>
        <p class="timer-step">Етап ${timer.step + 1} із ${routine.steps.length}</p><h3 class="timer-title">${esc(current.title)}</h3><p class="timer-description">${esc(current.description)}</p>
        <div class="timer-face">${String(Math.floor(timer.remaining / 60)).padStart(2, "0")}:${String(timer.remaining % 60).padStart(2, "0")}</div>
        <div class="modal-actions"><button class="secondary-button" data-action="toggle-timer">${timer.running ? "Пауза" : "Старт"}</button><button class="primary-button" data-action="next-step">${timer.step < routine.steps.length - 1 ? "Наступний етап" : "Завершити"}</button></div>
        <button class="text-button" style="width:100%;margin-top:8px" data-action="reset-timer">Почати комплекс спочатку</button></section></div>`;
      return;
    }
  }

  function record(normId, amount, note) {
    const value = Number(amount);
    if (!Number.isInteger(value) || value <= 0) return false;
    const norm = state.norms.find(item => item.id === normId);
    if (!norm) return false;
    norm.done = Number(norm.done || 0) + value;
    state.sessions.push({ normId, date: Date.now(), amount: value, note: String(note || "Тренування").trim() || "Тренування" });
    saveState();
    return true;
  }

  function currentStreak() {
    const days = new Set(state.sessions.map(session => dateKey(new Date(session.date))));
    if (!days.size) return 0;
    const cursor = new Date(); cursor.setHours(0, 0, 0, 0);
    if (!days.has(dateKey(cursor))) cursor.setDate(cursor.getDate() - 1);
    if (!days.has(dateKey(cursor))) return 0;
    let count = 0;
    while (days.has(dateKey(cursor))) { count++; cursor.setDate(cursor.getDate() - 1); }
    return count;
  }

  function openNormForm(norm = null) { setModal({ type: "norm-form", norm: norm ? { ...norm } : null }); }

  function startTimer(index) {
    stopTimer();
    state.timer = { step: 0, remaining: ROUTINES[index].steps[0].seconds, running: false };
    setModal({ type: "timer", index });
  }

  function stopTimer() {
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = null;
    if (state.timer) state.timer.running = false;
  }

  function tickTimer() {
    if (!state.timer?.running || state.modal?.type !== "timer") return;
    state.timer.remaining--;
    if (state.timer.remaining <= 0) {
      const routine = ROUTINES[state.modal.index];
      if (state.timer.step < routine.steps.length - 1) {
        state.timer.step++;
        state.timer.remaining = routine.steps[state.timer.step].seconds;
        showToast(`Наступний етап: ${routine.steps[state.timer.step].title}`);
      } else {
        stopTimer();
        state.timer = null;
        state.modal = null;
        showToast("Комплекс завершено! Гарна робота 🏑");
        render();
        return;
      }
    }
    renderModal();
  }

  function toggleTimer() {
    if (!state.timer) return;
    state.timer.running = !state.timer.running;
    if (state.timer.running) timerInterval = setInterval(tickTimer, 1000);
    else stopTimer();
    renderModal();
  }

  function nextTimerStep() {
    if (!state.timer || state.modal?.type !== "timer") return;
    const routine = ROUTINES[state.modal.index];
    if (state.timer.step >= routine.steps.length - 1) {
      stopTimer(); state.timer = null; state.modal = null; renderModal(); showToast("Комплекс завершено! Гарна робота 🏑"); return;
    }
    state.timer.step++;
    state.timer.remaining = routine.steps[state.timer.step].seconds;
    state.timer.running = false;
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = null;
    renderModal();
  }

  function reminderFor(norm) {
    if (!norm.reminderEnabled) return;
    const today = dateKey();
    const now = new Date();
    const due = Number(norm.reminderHour ?? 18) * 60 + Number(norm.reminderMinute ?? 0);
    const current = now.getHours() * 60 + now.getMinutes();
    const key = `${norm.id}:${today}`;
    if (current < due || state.reminderLog[key]) return;
    state.reminderLog[key] = true;
    saveState();
    const message = `Час тренуватися: ${norm.title}`;
    if ("Notification" in window && Notification.permission === "granted") {
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.ready.then(registration => registration.showNotification("Флорбол Тренер 🏑", { body: message, icon: "assets/icon-192.png", tag: key })).catch(() => showToast(message));
      } else {
        try { new Notification("Флорбол Тренер 🏑", { body: message, icon: "assets/icon-192.png", tag: key }); } catch (_) { showToast(message); }
      }
    } else {
      showToast(message);
    }
  }

  function checkReminders() { state.norms.forEach(reminderFor); }

  async function saveReminder(id) {
    const norm = state.norms.find(item => item.id === id);
    if (!norm) return;
    const enabled = document.getElementById("reminder-enabled").checked;
    const hour = Math.max(0, Math.min(23, Number(document.getElementById("reminder-hour").value) || 0));
    const minute = Math.max(0, Math.min(59, Number(document.getElementById("reminder-minute").value) || 0));
    if (enabled && "Notification" in window && Notification.permission === "default") {
      try { await Notification.requestPermission(); } catch (_) { /* reminders still appear in the app */ }
    }
    norm.reminderEnabled = enabled;
    norm.reminderHour = hour;
    norm.reminderMinute = minute;
    saveState();
    render();
    showToast(enabled ? "Нагадування збережено" : "Нагадування вимкнено");
  }

  function exportData() {
    const payload = { version: 1, exportedAt: new Date().toISOString(), profile: state.profile, norms: state.norms, sessions: state.sessions, trainingDays: state.trainingDays };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a"); link.href = url; link.download = "florball-trainer-backup.json"; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast("Резервну копію збережено");
  }

  function importData(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const backup = JSON.parse(String(reader.result));
        if (!Array.isArray(backup.norms) || !Array.isArray(backup.sessions)) throw new Error("invalid backup");
        if (!window.confirm("Імпорт замінить нормативи й історію на цьому пристрої. Продовжити?")) return;
        state.norms = backup.norms; state.sessions = backup.sessions;
        if (Array.isArray(backup.trainingDays)) state.trainingDays = backup.trainingDays;
        if (backup.profile?.name) state.profile = backup.profile;
        saveState(); render(); showToast("Копію завантажено");
      } catch (_) { showToast("Не вдалося прочитати файл копії"); }
    };
    reader.readAsText(file);
  }

  function handleClick(event) {
    const pageButton = event.target.closest("[data-page]");
    if (pageButton) { state.page = pageButton.dataset.page; render(); return; }
    const button = event.target.closest("[data-action]");
    if (!button) return;
    const action = button.dataset.action;
    if (action === "backdrop-close" && event.target === button) { setModal(null); return; }
    if (action === "close-modal") { setModal(null); return; }
    if (action === "add-norm") { openNormForm(); return; }
    if (action === "save-norm") { saveNormForm(document.getElementById("norm-form")); return; }
    if (action === "details") { setModal({ type: "details", id: button.dataset.id }); return; }
    if (action === "edit-norm") { const norm = state.norms.find(item => item.id === button.dataset.id); setModal(null); openNormForm(norm); return; }
    if (action === "quick-record") {
      if (record(button.dataset.id, 1, "Виконано")) { render(); showToast("Одне виконання зараховано"); }
      return;
    }
    if (action === "delete-norm") {
      const norm = state.norms.find(item => item.id === button.dataset.id);
      if (norm && window.confirm(`Видалити норматив «${norm.title}»? Історія його виконань також зникне.`)) {
        state.norms = state.norms.filter(item => item.id !== norm.id);
        state.sessions = state.sessions.filter(session => session.normId !== norm.id);
        saveState(); render(); showToast("Норматив видалено");
      }
      return;
    }
    if (action === "save-reminder") { saveReminder(button.dataset.id); return; }
    if (action === "toggle-day") {
      const day = Number(button.dataset.day);
      state.trainingDays = state.trainingDays.includes(day) ? state.trainingDays.filter(item => item !== day) : [...state.trainingDays, day].sort();
      saveState(); render(); return;
    }
    if (action === "start-routine") { startTimer(Number(button.dataset.index)); return; }
    if (action === "toggle-timer") { toggleTimer(); return; }
    if (action === "next-step") { nextTimerStep(); return; }
    if (action === "reset-timer") { const index = state.modal.index; startTimer(index); return; }
    if (action === "stop-timer") { state.timer = null; setModal(null); return; }
    if (action === "open-profile") { state.page = "profile"; render(); return; }
    if (action === "logout") { state.profile = null; state.page = "plan"; saveState(); render(); return; }
    if (action === "export-data") { exportData(); return; }
    if (action === "import-data") { document.getElementById("import-file").click(); return; }
    if (action === "install") { if (deferredInstallPrompt) deferredInstallPrompt.prompt(); return; }
  }

  function handleSubmit(event) {
    if (event.target.id === "login-form") {
      event.preventDefault();
      const form = new FormData(event.target);
      const name = String(form.get("name") || "").trim();
      const error = document.getElementById("login-error");
      if (!name) { error.textContent = "Введи ім’я гравця."; return; }
      state.profile = { name };
      saveState(); render(); checkReminders(); return;
    }
    if (event.target.id === "norm-form") {
      event.preventDefault();
      saveNormForm(event.target); return;
    }
    if (event.target.id === "record-form") {
      event.preventDefault();
      const form = new FormData(event.target);
      if (record(event.target.dataset.id, form.get("amount"), form.get("note"))) { setModal(null); render(); showToast("Тренування записано"); }
      return;
    }
    if (event.target.id === "rename-form") {
      event.preventDefault();
      const name = String(new FormData(event.target).get("name") || "").trim();
      if (!name) return;
      state.profile.name = name; saveState(); render(); showToast("Ім’я змінено");
    }
  }

  function saveNormForm(formElement) {
    if (!formElement) return;
    const form = new FormData(formElement);
    const title = String(form.get("title") || "").trim();
    const target = Number(form.get("target"));
    const error = document.getElementById("norm-error");
    if (!title || !Number.isInteger(target) || target < 1) {
      if (error) error.textContent = "Введи назву й ціль, що більша за нуль.";
      return;
    }
    const id = String(form.get("id") || "");
    const existing = id ? state.norms.find(norm => norm.id === id) : null;
    const details = { title, description: String(form.get("description") || "").trim(), target, unit: String(form.get("unit") || "разів").trim() || "разів" };
    if (existing) Object.assign(existing, details);
    else state.norms.push({ id: `norm-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, ...details, done: 0, reminderEnabled: false, reminderHour: 18, reminderMinute: 0 });
    saveState();
    setModal(null);
    render();
    showToast(existing ? "Норматив оновлено" : "Норматив додано");
  }

  app.addEventListener("click", handleClick);
  modalRoot.addEventListener("click", handleClick);
  document.addEventListener("submit", handleSubmit);
  document.addEventListener("change", event => {
    if (event.target.id === "import-file") importData(event.target.files?.[0]);
  });
  document.addEventListener("visibilitychange", () => { if (!document.hidden) checkReminders(); });
  window.addEventListener("focus", checkReminders);
  setInterval(checkReminders, 60_000);
  window.addEventListener("beforeinstallprompt", event => { event.preventDefault(); deferredInstallPrompt = event; render(); });
  window.addEventListener("appinstalled", () => { deferredInstallPrompt = null; showToast("Застосунок додано на головний екран"); render(); });

  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => {}));
  }
  render();
  checkReminders();
})();
