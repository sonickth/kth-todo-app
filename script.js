import { initializeApp } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js";
import {
  getFirestore,
  collection,
  doc,
  getDocs,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  writeBatch
} from "https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyB-x_RCS-39zKj3ZnHDvOTkvESX8tTm9Fk",
  authDomain: "kth-todo-app.firebaseapp.com",
  projectId: "kth-todo-app",
  storageBucket: "kth-todo-app.firebasestorage.app",
  messagingSenderId: "1007367468065",
  appId: "1:1007367468065:web:d890920142d108b390df60"
};

const STORAGE_KEY = "dayform.tasks.v1";
const MIGRATED_KEY = "dayform.firestore-migrated.v1";
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const today = new Date();
const todayKey = toDateKey(today);
let visibleMonth = new Date(today.getFullYear(), today.getMonth(), 1);
let selectedDate = todayKey;
let tasks = [];
let editingId = null;
let activeUser = null;
let stopListening = null;

const elements = {
  topbarDate: document.getElementById("topbar-date-value"),
  topbarTime: document.getElementById("topbar-time"),
  syncStatus: document.getElementById("sync-status"),
  syncStatusText: document.getElementById("sync-status-text"),
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
  deleteButton: document.getElementById("delete-task"),
  saveButton: document.querySelector(".save-button")
};

function toDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDateKey(key) {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function getLegacyTasks() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    if (!Array.isArray(stored)) return [];
    return stored.filter((task) => task && typeof task.id === "string" && typeof task.title === "string" && /^\d{4}-\d{2}-\d{2}$/.test(task.date)).map((task) => ({
      id: task.id,
      title: task.title.slice(0, 100),
      date: task.date,
      completed: Boolean(task.completed),
      createdAt: Number(task.createdAt) || Date.now()
    }));
  } catch {
    return [];
  }
}

function formatDate(date, options) {
  return new Intl.DateTimeFormat("ko-KR", options).format(date);
}

function setSyncStatus(message, isError = false) {
  elements.syncStatusText.textContent = message;
  elements.syncStatus.classList.toggle("is-error", isError);
}

function showSaveError(error) {
  console.error("Firestore operation failed:", error);
  elements.formError.textContent = error.code === "permission-denied"
    ? "Firestore 보안 규칙이 이 작업을 허용하지 않습니다. 규칙을 배포했는지 확인해주세요."
    : "저장하지 못했습니다. 네트워크와 Firebase 설정을 확인한 뒤 다시 시도해주세요.";
  setSyncStatus("CLOUD ERROR", true);
}

async function migrateLegacyTasks(user) {
  if (localStorage.getItem(MIGRATED_KEY) === "true") return;
  const legacyTasks = getLegacyTasks();
  const userTasks = collection(db, "users", user.uid, "tasks");
  const remoteTasks = await getDocs(userTasks);
  if (remoteTasks.empty && legacyTasks.length) {
    for (let start = 0; start < legacyTasks.length; start += 450) {
      const batch = writeBatch(db);
      legacyTasks.slice(start, start + 450).forEach((task) => {
        batch.set(doc(userTasks, task.id), {
          title: task.title,
          date: task.date,
          completed: task.completed,
          createdAt: task.createdAt
        });
      });
      await batch.commit();
    }
  }
  localStorage.setItem(MIGRATED_KEY, "true");
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
    checkbox.addEventListener("change", () => updateTask(task.id, { completed: checkbox.checked }));
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

async function updateTask(taskId, changes) {
  if (!activeUser) return;
  try {
    await updateDoc(doc(db, "users", activeUser.uid, "tasks", taskId), changes);
    setSyncStatus("CLOUD SYNCED");
  } catch (error) {
    showSaveError(error);
  }
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
document.getElementById("close-dialog").addEventListener("click", () => elements.dialog.close());
elements.dialog.addEventListener("click", (event) => {
  if (event.target === elements.dialog) elements.dialog.close();
});

elements.form.addEventListener("submit", async (event) => {
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
  if (!activeUser) {
    elements.formError.textContent = "Firebase 연결 중입니다. 잠시 후 다시 시도해주세요.";
    return;
  }
  elements.saveButton.disabled = true;
  elements.formError.textContent = "";
  try {
    const userTasks = collection(db, "users", activeUser.uid, "tasks");
    if (editingId) {
      await updateDoc(doc(userTasks, editingId), { title, date });
    } else {
      await addDoc(userTasks, { title, date, completed: false, createdAt: Date.now() });
    }
    selectedDate = date;
    const selected = parseDateKey(date);
    visibleMonth = new Date(selected.getFullYear(), selected.getMonth(), 1);
    elements.dialog.close();
    setSyncStatus("CLOUD SYNCED");
  } catch (error) {
    showSaveError(error);
  } finally {
    elements.saveButton.disabled = false;
  }
});

elements.deleteButton.addEventListener("click", async () => {
  if (!activeUser || !editingId) return;
  elements.deleteButton.disabled = true;
  try {
    await deleteDoc(doc(db, "users", activeUser.uid, "tasks", editingId));
    elements.dialog.close();
    setSyncStatus("CLOUD SYNCED");
  } catch (error) {
    showSaveError(error);
  } finally {
    elements.deleteButton.disabled = false;
  }
});

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    setSyncStatus("CLOUD CONNECTING");
    return;
  }
  activeUser = user;
  try {
    await migrateLegacyTasks(user);
    if (stopListening) stopListening();
    const userTasks = collection(db, "users", user.uid, "tasks");
    stopListening = onSnapshot(userTasks, (snapshot) => {
      tasks = snapshot.docs.map((taskDoc) => ({ id: taskDoc.id, ...taskDoc.data() }));
      render();
      setSyncStatus("CLOUD SYNCED");
    }, (error) => {
      console.error("Firestore listener failed:", error);
      setSyncStatus("CLOUD ERROR", true);
    });
  } catch (error) {
    console.error("Firebase initialization failed:", error);
    setSyncStatus("CLOUD ERROR", true);
    elements.formError.textContent = "Firebase 연결에 실패했습니다. Authentication과 Firestore 설정을 확인해주세요.";
  }
});

signInAnonymously(auth).catch((error) => {
  console.error("Anonymous sign-in failed:", error);
  setSyncStatus("CLOUD ERROR", true);
});

renderHeader();
window.setInterval(updateClock, 1000);
render();
