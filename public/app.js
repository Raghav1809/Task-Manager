const authSection = document.getElementById('auth-section');
const appSection = document.getElementById('app-section');
const loginTab = document.getElementById('login-tab');
const registerTab = document.getElementById('register-tab');
const authForm = document.getElementById('auth-form');
const authStatus = document.getElementById('auth-status');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const logoutBtn = document.getElementById('logout-btn');
const taskForm = document.getElementById('task-form');
const taskIdInput = document.getElementById('task-id');
const taskTitle = document.getElementById('task-title');
const taskDesc = document.getElementById('task-desc');
const taskDue = document.getElementById('task-due');
const taskStatus = document.getElementById('task-status');
const taskSubmit = document.getElementById('task-submit');
const taskClear = document.getElementById('task-clear');
const taskStatusMessage = document.getElementById('task-message');
const tasksContainer = document.getElementById('tasks');

let isLoginMode = true;

function setTabMode(loginMode) {
  isLoginMode = loginMode;
  loginTab.classList.toggle('active', loginMode);
  registerTab.classList.toggle('active', !loginMode);
  taskForm.reset();
  authStatus.textContent = '';
}

loginTab.addEventListener('click', () => setTabMode(true));
registerTab.addEventListener('click', () => setTabMode(false));

function getToken() {
  return localStorage.getItem('taskapp_token');
}

function setToken(token) {
  if (token) {
    localStorage.setItem('taskapp_token', token);
  } else {
    localStorage.removeItem('taskapp_token');
  }
}

function api(path, options = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return fetch(`/api${path}`, {
    ...options,
    headers,
  }).then(async (res) => {
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(body.message || 'Request failed');
    }
    return body;
  });
}

function showApp() {
  authSection.classList.add('hidden');
  appSection.classList.remove('hidden');
  loadTasks();
}

function showAuth() {
  authSection.classList.remove('hidden');
  appSection.classList.add('hidden');
}

function handleAuthSubmit(event) {
  event.preventDefault();
  authStatus.textContent = 'Working...';

  const email = emailInput.value.trim();
  const password = passwordInput.value.trim();
  const route = isLoginMode ? '/auth/login' : '/auth/register';

  api(route, {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
    .then((data) => {
      setToken(data.token);
      showApp();
    })
    .catch((error) => {
      authStatus.textContent = error.message;
    });
}

function loadTasks() {
  taskStatusMessage.textContent = 'Loading tasks...';
  api('/tasks')
    .then((tasks) => {
      renderTasks(tasks);
      taskStatusMessage.textContent = '';
    })
    .catch((error) => {
      taskStatusMessage.textContent = error.message;
      if (error.message.toLowerCase().includes('unauthorized')) {
        setToken(null);
        showAuth();
      }
    });
}

function renderTasks(tasks) {
  if (!tasks.length) {
    tasksContainer.innerHTML = '<p>No tasks yet — add one to get started.</p>';
    return;
  }

  tasksContainer.innerHTML = tasks
    .map((task) => {
      const due = task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'No due date';
      const status = task.status || 'pending';
      const created = new Date(task.createdAt).toLocaleString();
      return `
        <div class="task-item">
          <div class="task-header">
            <h4 class="task-title">${escapeHtml(task.title)}</h4>
            <span>${escapeHtml(status)}</span>
          </div>
          <div class="task-meta">
            <span>${escapeHtml(due)}</span>
            <span>Created ${escapeHtml(created)}</span>
          </div>
          <p>${escapeHtml(task.description || '')}</p>
          <div class="task-actions">
            <button class="btn-edit" data-action="edit" data-id="${task.id}">Edit</button>
            <button class="btn-delete" data-action="delete" data-id="${task.id}">Delete</button>
          </div>
        </div>
      `;
    })
    .join('');
}

function escapeHtml(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function handleTaskFormSubmit(event) {
  event.preventDefault();
  taskStatusMessage.textContent = 'Saving task...';

  const id = taskIdInput.value;
  const payload = {
    title: taskTitle.value.trim(),
    description: taskDesc.value.trim(),
    dueDate: taskDue.value,
    status: taskStatus.value,
  };

  if (!payload.title) {
    taskStatusMessage.textContent = 'Task title is required.';
    return;
  }

  const method = id ? 'PUT' : 'POST';
  const path = id ? `/tasks/${id}` : '/tasks';

  api(path, {
    method,
    body: JSON.stringify(payload),
  })
    .then(() => {
      taskStatusMessage.textContent = 'Task saved successfully.';
      taskForm.reset();
      taskIdInput.value = '';
      taskSubmit.textContent = 'Save Task';
      loadTasks();
    })
    .catch((error) => {
      taskStatusMessage.textContent = error.message;
    });
}

function handleTaskClick(event) {
  const button = event.target.closest('button');
  if (!button) return;

  const action = button.dataset.action;
  const id = button.dataset.id;
  if (!action || !id) return;

  if (action === 'edit') {
    api('/tasks')
      .then((tasks) => {
        const task = tasks.find((taskItem) => String(taskItem.id) === id);
        if (!task) return;
        taskIdInput.value = task.id;
        taskTitle.value = task.title;
        taskDesc.value = task.description;
        taskDue.value = task.dueDate || '';
        taskStatus.value = task.status || 'pending';
        taskSubmit.textContent = 'Update Task';
        taskStatusMessage.textContent = 'Editing task. Save or clear to continue.';
      })
      .catch((error) => {
        taskStatusMessage.textContent = error.message;
      });
  }

  if (action === 'delete') {
    if (!confirm('Delete this task?')) return;
    taskStatusMessage.textContent = 'Deleting task...';
    api(`/tasks/${id}`, { method: 'DELETE' })
      .then(() => {
        taskStatusMessage.textContent = 'Task deleted.';
        if (taskIdInput.value === id) {
          taskForm.reset();
          taskIdInput.value = '';
          taskSubmit.textContent = 'Save Task';
        }
        loadTasks();
      })
      .catch((error) => {
        taskStatusMessage.textContent = error.message;
      });
  }
}

function clearTaskForm() {
  taskForm.reset();
  taskIdInput.value = '';
  taskSubmit.textContent = 'Save Task';
  taskStatusMessage.textContent = '';
}

function checkAuthState() {
  if (getToken()) {
    showApp();
  } else {
    showAuth();
  }
}

authForm.addEventListener('submit', handleAuthSubmit);
logoutBtn.addEventListener('click', () => {
  setToken(null);
  showAuth();
});
taskForm.addEventListener('submit', handleTaskFormSubmit);
taskClear.addEventListener('click', clearTaskForm);
tasksContainer.addEventListener('click', handleTaskClick);

checkAuthState();
