(function () {
  "use strict";

  const STORAGE_KEY = "dayform.tasks.v1";
  const today = new Date();
  const todayKey = toDateKey(today);
  let visibleMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  let selectedDate = todayKey;
  let tasks = loadTasks();
  let editingId = null;

  const elements = {
    topbarDate: document.getElementById("topbar-date-value"),
    topbarTime: document.getElementById("topbar-time"),
    footerYear: document.getElementById("footer-year"),
    monthTitle: document.getElementById("month-title"),
    calendarGrid: document.getElementById("calendar-grid"),
    taskList: document.getElementById("task-list"),
    taskCount: document.getElementById("task-count"),
    selectedDate: document.getElementById("selected-date"),
    tasksHeading: document.getElementById("tasks-heading"),
    progressFill: document.getElementById("progress-fill"),
    progressLabel: document.getElementById("progress-label"),
    emptyState: document.getElementById("empty-state"),
    dialog: document.getElementById("task-dialog"),
    form: document.getElementById("task-form"),
    titleInput: document.getElementById("task-title"),
    dateInput: document.getElementById("task-date"),
    dialogTitle: document.getElementById("dialog-title"),
    formError: document.getElementById("form-error"),
    deleteButton: document.getElementById("delete-task")
  };

  function toDateKey(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  function parseDateKey(key) {
    const [year, month, day] = key.split("-").map(Number);
    return new Date(year, month - 1, day);
  }

  function loadTasks() {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      if (!Array.isArray(stored)) return [];
      return stored.filter((task) => task && typeof task.id === "string" && typeof task.title === "string" && /^\d{4}-\d{2}-\d{2}$/.test(task.date)).map((task) => ({
        id: task.id,
        title: task.title.slice(0, 100),
        date: task.date,
        completed: Boolean(task.completed),
        createdAt: Number(task.createdAt) || 0
      }));
    } catch (error) {
      return [];
    }
  }

  function saveTasks() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    } catch (error) {
      elements.formError.textContent = "저장 공간을 사용할 수 없습니다. 브라우저 설정을 확인해주세요.";
    }
  }

  function formatDate(date, options) {
    return new Intl.DateTimeFormat("ko-KR", options).format(date);
  }

  function renderHeader() {
    elements.footerYear.textContent = String(today.getFullYear());
    updateClock();
  }

  function updateClock() {
    const now = new Date();
    elements.topbarDate.textContent = formatDate(now, { year: "numeric", month: "2-digit", day: "2-digit", weekday: "short" }).replace(/\.\s*/g, ". ");
    elements.topbarTime.textContent = formatDate(now, { hour: "2-digit", minute: "2-digit", hour12: false });
  }

  function renderCalendar() {
    const year = visibleMonth.getFullYear();
    const month = visibleMonth.getMonth();
    elements.monthTitle.textContent = `${year}년 ${String(month + 1).padStart(2, "0")}월`;
    elements.calendarGrid.replaceChildren();

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const previousMonthDays = new Date(year, month, 0).getDate();
    const cellCount = Math.ceil((firstDay + daysInMonth) / 7) * 7;

    for (let index = 0; index < cellCount; index += 1) {
      let date;
      let isOutside = false;
      if (index < firstDay) {
        date = new Date(year, month - 1, previousMonthDays - firstDay + index + 1);
        isOutside = true;
      } else if (index >= firstDay + daysInMonth) {
        date = new Date(year, month + 1, index - firstDay - daysInMonth + 1);
        isOutside = true;
      } else {
        date = new Date(year, month, index - firstDay + 1);
      }

      const key = toDateKey(date);
      const dayTasks = tasks.filter((task) => task.date === key);
      const button = document.createElement("button");
      button.type = "button";
      button.className = "calendar-day";
      button.setAttribute("role", "gridcell");
      button.setAttribute("aria-pressed", String(key === selectedDate));
      button.setAttribute("aria-label", `${formatDate(date, { year: "numeric", month: "long", day: "numeric", weekday: "long" })}${dayTasks.length ? `, 할 일 ${dayTasks.length}개` : ""}${key === todayKey ? ", 오늘" : ""}`);
      if (isOutside) button.classList.add("is-outside");
      if (index % 7 === 0) button.classList.add("is-sunday");
      if (key === todayKey) button.classList.add("is-today");
      if (key === selectedDate) button.classList.add("is-selected");

      const number = document.createElement("span");
      number.className = "day-number";
      number.textContent = String(date.getDate());
      button.append(number);

      const dots = document.createElement("span");
      dots.className = "day-dots";
      dots.setAttribute("aria-hidden", "true");
      dayTasks.slice(0, 3).forEach((task) => {
        const dot = document.createElement("i");
        dot.className = `day-dot${task.completed ? " done" : ""}`;
        dots.append(dot);
      });
      button.append(dots);
      button.addEventListener("click", () => {
        selectedDate = key;
        if (isOutside) visibleMonth = new Date(date.getFullYear(), date.getMonth(), 1);
        render();
      });
      elements.calendarGrid.append(button);
    }
  }

  function renderTasks() {
    const selected = parseDateKey(selectedDate);
    const dayTasks = tasks.filter((task) => task.date === selectedDate).sort((a, b) => a.createdAt - b.createdAt);
    const doneCount = dayTasks.filter((task) => task.completed).length;
    const percent = dayTasks.length ? Math.round((doneCount / dayTasks.length) * 100) : 0;
    elements.tasksHeading.textContent = selectedDate === todayKey ? "오늘의 할 일" : "할 일 목록";
    elements.selectedDate.textContent = formatDate(selected, { year: "numeric", month: "long", day: "numeric", weekday: "long" });
    elements.taskCount.textContent = `${String(dayTasks.length).padStart(2, "0")} ITEMS`;
    elements.progressFill.style.width = `${percent}%`;
    elements.progressLabel.textContent = `${percent}%`;
    elements.progressFill.parentElement.setAttribute("aria-valuenow", String(percent));
    elements.progressFill.parentElement.setAttribute("role", "progressbar");
    elements.progressFill.parentElement.setAttribute("aria-valuemin", "0");
    elements.progressFill.parentElement.setAttribute("aria-valuemax", "100");
    elements.taskList.replaceChildren();
    elements.emptyState.hidden = dayTasks.length > 0;

    dayTasks.forEach((task, index) => {
      const item = document.createElement("li");
      item.className = `task-item${task.completed ? " is-complete" : ""}`;
      item.style.animationDelay = `${Math.min(index * 35, 210)}ms`;

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.className = "task-check";
      checkbox.checked = task.completed;
      checkbox.setAttribute("aria-label", `${task.title} 완료`);
      checkbox.addEventListener("change", () => {
        task.completed = checkbox.checked;
        saveTasks();
        render();
      });

      const title = document.createElement("span");
      title.className = "task-title";
      title.textContent = task.title;

      const edit = document.createElement("button");
      edit.type = "button";
      edit.className = "edit-task";
      edit.setAttribute("aria-label", `${task.title} 수정`);
      edit.textContent = "···";
      edit.addEventListener("click", () => openDialog(task));

      item.append(checkbox, title, edit);
      elements.taskList.append(item);
    });
  }

  function render() {
    renderCalendar();
    renderTasks();
  }

  function openDialog(task) {
    editingId = task ? task.id : null;
    elements.form.reset();
    elements.formError.textContent = "";
    elements.dialogTitle.textContent = task ? "할 일 수정" : "할 일 추가";
    elements.deleteButton.hidden = !task;
    elements.titleInput.value = task ? task.title : "";
    elements.dateInput.value = task ? task.date : selectedDate;
    elements.dialog.showModal();
    window.requestAnimationFrame(() => elements.titleInput.focus());
  }

  function closeDialog() {
    elements.dialog.close();
  }

  document.getElementById("prev-month").addEventListener("click", () => {
    visibleMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() - 1, 1);
    renderCalendar();
  });
  document.getElementById("next-month").addEventListener("click", () => {
    visibleMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1);
    renderCalendar();
  });
  document.getElementById("add-task").addEventListener("click", () => openDialog(null));
  document.getElementById("empty-add").addEventListener("click", () => openDialog(null));
  document.getElementById("close-dialog").addEventListener("click", closeDialog);
  elements.dialog.addEventListener("click", (event) => {
    if (event.target === elements.dialog) closeDialog();
  });
  elements.form.addEventListener("submit", (event) => {
    event.preventDefault();
    const title = elements.titleInput.value.trim();
    const date = elements.dateInput.value;
    if (!title) {
      elements.formError.textContent = "할 일 제목을 입력해주세요.";
      elements.titleInput.focus();
      return;
    }
    if (!date) {
      elements.formError.textContent = "날짜를 선택해주세요.";
      elements.dateInput.focus();
      return;
    }
    if (editingId) {
      const task = tasks.find((item) => item.id === editingId);
      if (task) {
        task.title = title;
        task.date = date;
      }
    } else {
      tasks.push({ id: createId(), title, date, completed: false, createdAt: Date.now() });
    }
    selectedDate = date;
    const selected = parseDateKey(date);
    visibleMonth = new Date(selected.getFullYear(), selected.getMonth(), 1);
    saveTasks();
    closeDialog();
    render();
  });
  elements.deleteButton.addEventListener("click", () => {
    if (!editingId) return;
    tasks = tasks.filter((task) => task.id !== editingId);
    saveTasks();
    closeDialog();
    render();
  });

  function createId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") return window.crypto.randomUUID();
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  }

  renderHeader();
  window.setInterval(updateClock, 1000);
  render();
})();
