(() => {
  'use strict';

  const STORAGE_KEY = 'still-focus-v1';
  const DEFAULT_GOAL = 120;
  const DEFAULT_DURATION = 25;
  const MAX_SESSIONS = 500;

  const $ = (id) => document.getElementById(id);
  const els = {
    timerDisplay: $('timerDisplay'), timerHeading: $('timerHeading'), timerSubline: $('timerSubline'),
    timerStatus: $('timerStatus'), startPauseButton: $('startPauseButton'), startPauseLabel: $('startPauseLabel'),
    playSymbol: $('playSymbol'), resetButton: $('resetButton'), presets: [...document.querySelectorAll('.preset')],
    customForm: $('customForm'), customMinutes: $('customMinutes'), goalSelect: $('goalSelect'),
    todayDate: $('todayDate'), todayTotal: $('todayTotal'), todaySessions: $('todaySessions'),
    goalProgress: $('goalProgress'), goalProgressFill: $('goalProgressFill'), goalProgressText: $('goalProgressText'),
    goalRemaining: $('goalRemaining'), weekTotal: $('weekTotal'), weekChart: $('weekChart'), weekAverage: $('weekAverage'),
    sessionList: $('sessionList'), historyMeta: $('historyMeta'), installButton: $('installButton'), toast: $('toast')
  };

  function safeParse(value) {
    try { return JSON.parse(value); } catch { return null; }
  }

  function readSavedState() {
    try {
      const raw = safeParse(localStorage.getItem(STORAGE_KEY) || '');
      if (!raw || typeof raw !== 'object') return null;
      return raw;
    } catch { return null; }
  }

  const saved = readSavedState() || {};
  const state = {
    goalMinutes: [60, 90, 120, 180, 240, 300, 360].includes(Number(saved.goalMinutes)) ? Number(saved.goalMinutes) : DEFAULT_GOAL,
    selectedMinutes: clamp(Number(saved.selectedMinutes) || DEFAULT_DURATION, 1, 180),
    active: normalizeActive(saved.active),
    sessions: Array.isArray(saved.sessions) ? saved.sessions.filter(isValidSession).slice(0, MAX_SESSIONS) : []
  };

  function normalizeActive(active) {
    if (!active || typeof active !== 'object') return null;
    const totalSeconds = Number(active.totalSeconds);
    const elapsedSeconds = Number(active.elapsedSeconds);
    if (!Number.isFinite(totalSeconds) || totalSeconds < 1 || totalSeconds > 10800 || !Number.isFinite(elapsedSeconds)) return null;
    const running = Boolean(active.running && Number.isFinite(Number(active.segmentStartedAt)));
    return {
      totalSeconds: Math.floor(totalSeconds),
      elapsedSeconds: clamp(Math.floor(elapsedSeconds), 0, Math.floor(totalSeconds)),
      startedAt: Number.isFinite(Number(active.startedAt)) ? Number(active.startedAt) : Date.now(),
      segmentStartedAt: running ? Number(active.segmentStartedAt) : null,
      running
    };
  }

  function isValidSession(session) {
    return session && typeof session === 'object' && Number.isFinite(Number(session.durationSeconds)) &&
      Number(session.durationSeconds) > 0 && /^\d{4}-\d{2}-\d{2}$/.test(session.dateKey || '');
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        goalMinutes: state.goalMinutes,
        selectedMinutes: state.selectedMinutes,
        active: state.active,
        sessions: state.sessions.slice(0, MAX_SESSIONS)
      }));
    } catch {
      showToast('Your browser storage is unavailable. Progress may not persist.');
    }
  }

  function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }

  function dateKey(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function dateFromKey(key) {
    const [year, month, day] = key.split('-').map(Number);
    return new Date(year, month - 1, day, 12, 0, 0, 0);
  }

  function formatClock(seconds) {
    const whole = Math.max(0, Math.floor(seconds));
    const minutes = Math.floor(whole / 60);
    const rest = whole % 60;
    return `${String(minutes).padStart(2, '0')}<span>:</span>${String(rest).padStart(2, '0')}`;
  }

  function formatTotal(seconds) {
    const totalMinutes = Math.max(0, Math.floor(seconds / 60));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours}<span>h</span> ${String(minutes).padStart(2, '0')}<span>m</span>`;
  }

  function formatCompact(seconds) {
    const minutes = Math.max(0, Math.round(seconds / 60));
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return rest ? `${hours}h ${rest}m` : `${hours}h`;
  }

  function formatTimestamp(timestamp) {
    return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date(timestamp));
  }

  function getElapsedSeconds() {
    if (!state.active) return 0;
    const active = state.active;
    const liveSegment = active.running && active.segmentStartedAt
      ? Math.max(0, Math.floor((Date.now() - active.segmentStartedAt) / 1000))
      : 0;
    return clamp(active.elapsedSeconds + liveSegment, 0, active.totalSeconds);
  }

  function secondsLeft() {
    return state.active ? Math.max(0, state.active.totalSeconds - getElapsedSeconds()) : state.selectedMinutes * 60;
  }

  function selectedPreset(minutes) {
    els.presets.forEach((button) => {
      const selected = Number(button.dataset.minutes) === minutes;
      button.classList.toggle('is-selected', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
  }

  function setDuration(minutes) {
    if (state.active) {
      showToast('Reset the current session before changing its duration.');
      return;
    }
    state.selectedMinutes = clamp(Math.round(minutes), 1, 180);
    selectedPreset(state.selectedMinutes);
    renderTimer();
    saveState();
  }

  function startTimer() {
    const now = Date.now();
    if (!state.active) {
      state.active = {
        totalSeconds: state.selectedMinutes * 60,
        elapsedSeconds: 0,
        startedAt: now,
        segmentStartedAt: now,
        running: true
      };
    } else {
      state.active.segmentStartedAt = now;
      state.active.running = true;
    }
    saveState();
    renderAll();
  }

  function pauseTimer() {
    if (!state.active || !state.active.running) return;
    state.active.elapsedSeconds = getElapsedSeconds();
    state.active.segmentStartedAt = null;
    state.active.running = false;
    saveState();
    renderAll();
  }

  function commitSession(completed) {
    const active = state.active;
    if (!active) return;
    const elapsed = completed ? active.totalSeconds : getElapsedSeconds();
    if (elapsed >= 60) {
      state.sessions.unshift({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        startedAt: active.startedAt,
        endedAt: Date.now(),
        dateKey: dateKey(new Date()),
        durationSeconds: Math.floor(elapsed),
        plannedSeconds: active.totalSeconds,
        completed: Boolean(completed)
      });
      state.sessions = state.sessions.slice(0, MAX_SESSIONS);
    }
    state.active = null;
    saveState();
    renderAll();
    if (completed) showToast('Session complete. Nice work.');
    else if (elapsed >= 60) showToast('Session saved to your focus log.');
  }

  function resetTimer() {
    if (!state.active) {
      renderTimer();
      return;
    }
    commitSession(false);
    state.active = null;
    saveState();
    renderAll();
  }

  function renderTimer() {
    const left = secondsLeft();
    els.timerDisplay.innerHTML = formatClock(left);
    els.timerDisplay.setAttribute('aria-label', `${Math.floor(left / 60)} minutes ${left % 60} seconds`);
    const active = state.active;
    const isRunning = Boolean(active && active.running);
    const isPaused = Boolean(active && !active.running);

    els.startPauseButton.disabled = false;
    els.playSymbol.textContent = isRunning ? 'Ⅱ' : '▶';
    els.startPauseLabel.textContent = isRunning ? 'Pause focus' : isPaused ? 'Resume focus' : 'Start focus';
    els.timerHeading.textContent = isRunning ? 'STAY WITH IT' : isPaused ? 'PAUSED, NOT LOST' : 'TIME TO FOCUS';
    els.timerSubline.textContent = isRunning ? 'You are here. Keep going.' : isPaused ? 'Pick it back up when you are ready.' : 'A clear start. A single task.';
    els.timerStatus.classList.toggle('is-running', isRunning);
    els.timerStatus.innerHTML = `<span class="status-dot"></span> ${isRunning ? 'FOCUS IN PROGRESS' : isPaused ? 'SESSION PAUSED' : 'READY WHEN YOU ARE'}`;
    els.presets.forEach((button) => { button.disabled = Boolean(active); });
    els.customMinutes.disabled = Boolean(active);
    els.customForm.querySelector('button').disabled = Boolean(active);
    els.resetButton.setAttribute('aria-label', isPaused || isRunning ? 'Save session and reset timer' : 'Reset timer');
  }

  function sumForDate(key) {
    return state.sessions.reduce((sum, session) => sum + (session.dateKey === key ? Number(session.durationSeconds) : 0), 0);
  }

  function currentDaySeconds() {
    const logged = sumForDate(dateKey());
    if (!state.active) return logged;
    return logged + getElapsedSeconds();
  }

  function renderToday() {
    const now = new Date();
    els.todayDate.textContent = new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric' }).format(now).toUpperCase();
    const seconds = currentDaySeconds();
    els.todayTotal.innerHTML = formatTotal(seconds);
    const count = state.sessions.filter((session) => session.dateKey === dateKey()).length + (state.active ? 1 : 0);
    els.todaySessions.textContent = String(count);

    const goalSeconds = state.goalMinutes * 60;
    const ratio = goalSeconds ? seconds / goalSeconds : 0;
    const percent = Math.floor(ratio * 100);
    const boundedPercent = clamp(ratio * 100, 0, 100);
    els.goalProgressFill.style.width = `${boundedPercent}%`;
    els.goalProgress.setAttribute('aria-valuenow', String(Math.round(boundedPercent)));
    els.goalProgressText.textContent = `${percent}% of your goal`;
    const remaining = Math.max(0, goalSeconds - seconds);
    els.goalRemaining.textContent = remaining ? `${formatCompact(remaining)} left` : 'GOAL REACHED';
  }

  function renderWeek() {
    const today = new Date();
    const days = [];
    for (let offset = 6; offset >= 0; offset -= 1) {
      const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() - offset, 12, 0, 0, 0);
      const key = dateKey(date);
      let seconds = sumForDate(key);
      if (key === dateKey(today) && state.active) seconds += getElapsedSeconds();
      days.push({ key, date, seconds, isToday: offset === 0 });
    }
    const maxSeconds = Math.max(state.goalMinutes * 60, ...days.map((day) => day.seconds), 1);
    const total = days.reduce((sum, day) => sum + day.seconds, 0);
    const avgMinutes = Math.round(total / 7 / 60);
    els.weekTotal.textContent = `${formatCompact(total)} total`;
    els.weekAverage.textContent = `AVG. ${avgMinutes} MIN / DAY`;
    els.weekChart.innerHTML = days.map((day) => {
      const height = day.seconds > 0 ? Math.max(4, Math.round((day.seconds / maxSeconds) * 100)) : 2;
      const label = new Intl.DateTimeFormat(undefined, { weekday: 'short' }).format(day.date).slice(0, 2).toUpperCase();
      const title = `${new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'short', day: 'numeric' }).format(day.date)}: ${formatCompact(day.seconds)}`;
      return `<div class="week-day${day.isToday ? ' is-today' : ''}" title="${title}"><div class="week-bar-slot"><div class="week-bar" style="height:${height}%" aria-hidden="true"></div></div><span class="week-day-label">${label}</span></div>`;
    }).join('');
    els.weekChart.setAttribute('aria-label', days.map((day) => `${day.key}: ${formatCompact(day.seconds)}`).join('; '));
  }

  function renderHistory() {
    const recent = state.sessions.slice(0, 6);
    const count = state.sessions.length;
    els.historyMeta.textContent = count ? `${count} SESSION${count === 1 ? '' : 'S'} LOGGED ON THIS DEVICE` : 'YOUR LATEST FOCUS, IN ONE PLACE';
    if (!recent.length) {
      els.sessionList.innerHTML = '<div class="empty-state"><span class="empty-mark">S.</span><div><strong>Your first session starts here.</strong><p>Choose a duration and give one thing your attention.</p></div></div>';
      return;
    }
    els.sessionList.innerHTML = recent.map((session, index) => {
      const date = dateFromKey(session.dateKey);
      const day = session.dateKey === dateKey() ? 'TODAY' : new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(date).toUpperCase();
      const duration = formatCompact(session.durationSeconds);
      const status = session.completed ? 'COMPLETE' : 'ENDED EARLY';
      return `<article class="session-row"><span class="session-number">${String(index + 1).padStart(2, '0')}</span><div class="session-info"><strong>Focus session</strong><span>${day} · ${formatTimestamp(session.endedAt || session.startedAt)}</span></div><span class="session-duration">${duration}</span><span class="session-state${session.completed ? ' complete' : ''}">${status}</span></article>`;
    }).join('');
  }

  function renderAll() {
    renderTimer();
    renderToday();
    renderWeek();
    renderHistory();
  }

  let toastTimeout;
  function showToast(message) {
    els.toast.textContent = message;
    els.toast.classList.add('is-visible');
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => els.toast.classList.remove('is-visible'), 2600);
  }

  els.presets.forEach((button) => button.addEventListener('click', () => setDuration(Number(button.dataset.minutes))));
  els.customForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const value = Number(els.customMinutes.value);
    if (!Number.isInteger(value) || value < 1 || value > 180) {
      showToast('Choose a custom duration from 1 to 180 minutes.');
      els.customMinutes.focus();
      return;
    }
    setDuration(value);
    showToast(`${value}-minute session selected.`);
  });
  els.startPauseButton.addEventListener('click', () => {
    if (state.active && state.active.running) pauseTimer();
    else startTimer();
  });
  els.resetButton.addEventListener('click', resetTimer);
  els.goalSelect.value = String(state.goalMinutes);
  els.goalSelect.addEventListener('change', () => {
    state.goalMinutes = Number(els.goalSelect.value) || DEFAULT_GOAL;
    saveState();
    renderToday();
    renderWeek();
  });

  window.addEventListener('keydown', (event) => {
    if (event.code !== 'Space' || event.repeat || event.altKey || event.ctrlKey || event.metaKey) return;
    const target = event.target;
    if (target && (target.closest('button, input, select, textarea, a') || target.isContentEditable)) return;
    event.preventDefault();
    if (state.active && state.active.running) pauseTimer();
    else startTimer();
  });

  // The absolute timestamp means the countdown catches up after sleep, tab switching, or reload.
  window.setInterval(() => {
    if (state.active && state.active.running && getElapsedSeconds() >= state.active.totalSeconds) {
      commitSession(true);
      return;
    }
    if (state.active && state.active.running) {
      renderTimer();
      renderToday();
      renderWeek();
      saveState();
    }
  }, 1000);

  // Preserve state before the page goes into the background or is closed.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      if (state.active && state.active.running && getElapsedSeconds() >= state.active.totalSeconds) commitSession(true);
      else renderAll();
    } else {
      saveState();
    }
  });
  window.addEventListener('pagehide', saveState);

  let installPrompt = null;
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    installPrompt = event;
    els.installButton.hidden = false;
  });
  els.installButton.addEventListener('click', async () => {
    if (!installPrompt) {
      showToast('On iPhone, open Share → Add to Home Screen in Safari.');
      return;
    }
    installPrompt.prompt();
    try {
      const choice = await installPrompt.userChoice;
      if (choice && choice.outcome === 'accepted') showToast('STILL is ready to install.');
    } catch { /* The browser controls the install prompt. */ }
    installPrompt = null;
    els.installButton.hidden = true;
  });
  window.addEventListener('appinstalled', () => {
    installPrompt = null;
    els.installButton.hidden = true;
    showToast('STILL installed successfully.');
  });

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch(() => {
        // The app still works online if service-worker installation is blocked.
      });
    });
  }

  selectedPreset(state.selectedMinutes);
  renderAll();
})();
