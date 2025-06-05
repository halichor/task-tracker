// Spinners and Toasts
function showGlobalSpinner(msg = "Loading...") {
    const spinner = document.getElementById("global-spinner-indicator");
    const text = document.getElementById("global-spinner-text");
    if (spinner && text) {
        text.textContent = msg;
        spinner.style.display = "";
    }
    // Force a short delay so spinner is visible even for fast actions
    window._spinnerLastShown = Date.now();
}
function hideGlobalSpinner() {
    const spinner = document.getElementById("global-spinner-indicator");
    if (spinner) {
        // Ensure spinner is visible for at least 300ms
        const minTime = 300;
        const elapsed = Date.now() - (window._spinnerLastShown || 0);
        if (elapsed < minTime) {
            setTimeout(() => { spinner.style.display = "none"; }, minTime - elapsed);
        } else {
            spinner.style.display = "none";
        }
    }
}

function showGlobalToast(msg = "Done!") {
    // Wait for DOM to be ready
    if (!document.getElementById("global-toast")) {
        document.addEventListener("DOMContentLoaded", () => showGlobalToast(msg));
        return;
    }
    const toastEl = document.getElementById("global-toast");
    const toastBody = document.getElementById("global-toast-body");
    if (toastEl && toastBody) {
        toastBody.textContent = msg;
        // Bootstrap 5: getOrCreateInstance
        const toast = bootstrap.Toast.getOrCreateInstance(toastEl);
        toast.show();
    }
}

window.showGlobalToast = showGlobalToast; function showGlobalToast(msg = "Done!") {
    // Wait for DOM to be ready
    if (!document.getElementById("global-toast")) {
        document.addEventListener("DOMContentLoaded", () => showGlobalToast(msg));
        return;
    }
    const toastEl = document.getElementById("global-toast");
    const toastBody = document.getElementById("global-toast-body");
    if (toastEl && toastBody) {
        toastBody.textContent = msg;
        // Bootstrap 5: getOrCreateInstance
        const toast = bootstrap.Toast.getOrCreateInstance(toastEl);
        toast.show();
    }
}
window.showGlobalToast = showGlobalToast;
function finishWithToast(message, delay = 100) {
    setTimeout(() => {
        hideGlobalSpinner();
        showGlobalToast(message);
    }, delay);
}

// Date formatting
function formatDateYMD(dateInput) {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    let d;
    if (typeof dateInput === "string") {
        // Accepts "YYYY-MM-DD"
        const [y, m, day] = dateInput.split("-");
        d = new Date(Number(y), Number(m) - 1, Number(day));
    } else if (dateInput instanceof Date) {
        d = dateInput;
    } else {
        return "";
    }
    return `${d.getFullYear()} ${months[d.getMonth()]} ${d.getDate()}`;
}

function formatDateFull(dateInput) {
    const months = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ];
    const days = [
        "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"
    ];
    let d;
    if (typeof dateInput === "string") {
        // Accepts "YYYY-MM-DD"
        const [y, m, day] = dateInput.split("-");
        d = new Date(Number(y), Number(m) - 1, Number(day));
    } else if (dateInput instanceof Date) {
        d = dateInput;
    } else {
        return "";
    }
    return `${d.getFullYear()} ${months[d.getMonth()]} ${d.getDate()}, ${days[d.getDay()]}`;
}

(() => {
    // Data keys and current user var
    const LS_USERS_KEY = "tm_users";
    const LS_TASKS_KEY = "tm_tasks";
    const LS_ORIGINS_KEY = "tm_origins";
    const SESSION_USER_KEY = "tm_currentUser";
    const db = window.db;
    let currentUser = null;

    let todaySortKey = 'date', todaySortAsc = true;
    let archiveSortKey = 'date', archiveSortAsc = true;
    let massSortKey = 'date', massSortAsc = true;
    let viewSortKey = 'user', viewSortAsc = true;

    // Elements
    const authDiv = document.getElementById("auth");
    const appDiv = document.getElementById("app");
    const loginBtn = document.getElementById("login-btn");
    const logoutBtn = document.getElementById("logout-btn");
    const loginError = document.getElementById("login-error");
    const currentUserNameSpan = document.getElementById("current-user-name");

    // --- Tag Filter State ---
    const tagFilterState = {
        today: [],
        archive: [],
        mass: [],
        view: []
    };
    const columnFilters = {
        origin: new Set(),
        activity: new Set(),
        remarks: new Set(),
        date: new Set(),
        tags: new Set(),
        user: new Set()
    };

    // Tabs elements
    const addTaskBtn = document.getElementById("add-task-btn");
    const todayTasksList = document.getElementById("today-tasks-list");

    const newUsernameInput = document.getElementById("new-username");
    const newPasswordInput = document.getElementById("new-password");
    const saveSettingsBtn = document.getElementById("save-settings-btn");

    const adminNewUsername = document.getElementById("admin-new-username");
    const adminNewPassword = document.getElementById("admin-new-password");
    const adminCreateUserBtn = document.getElementById("admin-create-user-btn");
    const userListUl = document.getElementById("user-list");

    // Archive
    const archiveTasksList = document.getElementById("archive-tasks-list");

    // Users
    const adminNewSurname = document.getElementById("admin-new-surname");
    const adminNewFirstname = document.getElementById("admin-new-firstname");
    const adminNewMiddlename = document.getElementById("admin-new-middlename");
    const adminNewDesignation = document.getElementById("admin-new-designation");

    // --- Helpers ---
    function wrapAsyncWithSpinnerToast(obj, fnName, { pending, done, fail }) {
        const orig = obj[fnName];
        obj[fnName] = async function (...args) {
            showGlobalSpinner(pending);
            try {
                const result = await orig.apply(this, args);
                hideGlobalSpinner();
                showGlobalToast(done);
                return result;
            } catch (e) {
                hideGlobalSpinner();
                showGlobalToast(fail);
                throw e;
            }
        };
    }

    // Modals
    async function showAlertModal(message) {
        return new Promise((resolve) => {
            const modal = new bootstrap.Modal(document.getElementById('alertModal'));
            document.getElementById('alertModalBody').textContent = message;
            const okBtn = document.getElementById('alertModalOk');
            function cleanup() {
                okBtn.removeEventListener('click', onOk);
                document.getElementById('alertModal').removeEventListener('hidden.bs.modal', onOk);
                resolve();
            }
            function onOk() {
                modal.hide();
                cleanup();
            }
            okBtn.addEventListener('click', onOk);
            document.getElementById('alertModal').addEventListener('hidden.bs.modal', onOk);
            modal.show();
        });
    }

    // Users
    async function getUsers() {
        const snapshot = await db.collection('users').get();
        const users = {};
        snapshot.forEach(doc => users[doc.id] = doc.data());
        return users;
    }
    async function saveUsers(users) {
        // Overwrite all users (simple approach)
        const batch = db.batch();
        const usersRef = db.collection('users');
        // Delete all first (optional, for full overwrite)
        const existing = await usersRef.get();
        existing.forEach(doc => batch.delete(doc.ref));
        Object.entries(users).forEach(([username, data]) => {
            batch.set(usersRef.doc(username), data);
        });
        await batch.commit();
    }
    window.saveUsers = saveUsers;
    wrapAsyncWithSpinnerToast(window, "saveUsers", { pending: "Saving users...", done: "Users saved!", fail: "Failed to save users." });

    // Tasks
    async function getTasks() {
        const snapshot = await db.collection('tasks').get();
        const tasks = {};
        snapshot.forEach(doc => tasks[doc.id] = doc.data());
        return tasks;
    }
    async function saveTasks(tasks) {
        // Overwrite all tasks (simple approach)
        const batch = db.batch();
        const tasksRef = db.collection('tasks');
        const existing = await tasksRef.get();
        existing.forEach(doc => batch.delete(doc.ref));
        Object.entries(tasks).forEach(([username, data]) => {
            batch.set(tasksRef.doc(username), data);
        });
        await batch.commit();
    }
    window.saveTasks = saveTasks;
    wrapAsyncWithSpinnerToast(window, "saveTasks", { pending: "Saving tasks...", done: "Tasks saved!", fail: "Failed to save tasks." });

    // Holidays
    const LS_HOLIDAYS_KEY = "tm_holidays";
    async function getHolidays() {
        const snapshot = await db.collection('holidays').get();
        return snapshot.docs.map(doc => doc.data());
    }
    async function saveHolidays(holidays) {
        const batch = db.batch();
        const holidaysRef = db.collection('holidays');
        const existing = await holidaysRef.get();
        existing.forEach(doc => batch.delete(doc.ref));
        holidays.forEach(holiday => {
            batch.set(holidaysRef.doc(holiday.date + (holiday.name || "")), holiday);
        });
        await batch.commit();
    }
    window.saveHolidays = saveHolidays;
    wrapAsyncWithSpinnerToast(window, "saveHolidays", { pending: "Saving holidays...", done: "Holidays saved!", fail: "Failed to save holidays." });

    async function renderHolidaysList() {
        const holidays = await getHolidays();
        const listDiv = document.getElementById('holidays-list');
        if (!holidays.length) {
            listDiv.innerHTML = "<em>No holidays set.</em>";
            return;
        }
        const ul = document.createElement('ul');
        ul.className = "list-group";
        holidays.forEach((h, idx) => {
            const li = document.createElement('li');
            li.className = "list-group-item d-flex justify-content-between align-items-center";
            li.textContent = `${h.name} (${formatDateYMD(h.date)})${h.repeat ? " [Repeats]" : ""}`;
            const delBtn = document.createElement('button');
            delBtn.className = "btn btn-sm btn-danger";
            delBtn.textContent = "Delete";
            delBtn.onclick = async () => {
                const arr = await getHolidays();
                arr.splice(idx, 1);
                await saveHolidays(arr);
                renderHolidaysList();
            };
            li.appendChild(delBtn);
            ul.appendChild(li);
        });
        listDiv.innerHTML = "";
        listDiv.appendChild(ul);
    }

    async function ensureAllUsersTaskStructure() {
        const users = await getUsers();
        const tasks = await getTasks();
        let changed = false;
        Object.keys(users).forEach(username => {
            if (!tasks[username]) {
                tasks[username] = { today: [], archive: {} };
                changed = true;
            } else {
                if (!tasks[username].today) {
                    tasks[username].today = [];
                    changed = true;
                }
                if (!tasks[username].archive) {
                    tasks[username].archive = {};
                    changed = true;
                }
            }
        });
        if (changed) await saveTasks(tasks);
    }

    // --- Origins Management ---
    async function getOrigins() {
        const snapshot = await db.collection('origins').get();
        return snapshot.docs.map(doc => doc.data());
    }
    async function saveOrigins(origins) {
        const batch = db.batch();
        const originsRef = db.collection('origins');
        const existing = await originsRef.get();
        existing.forEach(doc => batch.delete(doc.ref));
        origins.forEach(origin => {
            batch.set(originsRef.doc(origin.value), origin);
        });
        await batch.commit();
    }
    window.saveOrigins = saveOrigins;
    wrapAsyncWithSpinnerToast(window, "saveOrigins", { pending: "Saving origins...", done: "Origins saved!", fail: "Failed to save origins." });

    async function renderOriginsAdmin() {
        const container = document.getElementById("origins-admin-list");
        const origins = await getOrigins();
        container.innerHTML = "";
        origins.forEach((origin, idx) => {
            const div = document.createElement("div");
            div.className = "d-flex align-items-center mb-2";
            // Origin value (editable)
            const input = document.createElement("input");
            input.type = "text";
            input.value = origin.value;
            input.className = "form-control me-2";
            input.style.maxWidth = "200px";
            input.disabled = origin.archived;
            input.addEventListener("change", async () => {
                const oldValue = origin.value;
                const newValue = input.value.trim();
                if (!newValue) return;
                // Update all tasks globally
                const tasks = await getTasks();
                Object.values(tasks).forEach(user => {
                    user.today?.forEach(t => { if (t.origin === oldValue) t.origin = newValue; });
                    Object.values(user.archive || {}).forEach(arr => arr.forEach(t => { if (t.origin === oldValue) t.origin = newValue; }));
                });
                await saveTasks(tasks);
                // Update origin
                origins[idx].value = newValue;
                await saveOrigins(origins);
                renderOriginsAdmin();
                populateOriginDropdown();
                loadTodayTasks();
                loadArchiveDate(document.getElementById('archive-date-display').textContent);
            });
            div.appendChild(input);
            // Archive/unarchive button
            const btn = document.createElement("button");
            btn.className = "btn btn-sm " + (origin.archived ? "btn-secondary" : "btn-outline-secondary");
            btn.textContent = origin.archived ? "Unarchive" : "Archive";
            btn.addEventListener("click", async () => {
                origins[idx].archived = !origins[idx].archived;
                await saveOrigins(origins);
                renderOriginsAdmin();
                populateOriginDropdown();
            });
            div.appendChild(btn);
            container.appendChild(div);
        });
    }
    document.getElementById("add-origin-btn").addEventListener("click", async () => {
        const input = document.getElementById("new-origin-input");
        const value = input.value.trim();
        if (!value) return;
        const origins = await getOrigins();
        if (origins.some(o => o.value === value)) {
            await showAlertModal("Origin already exists.");
            return;
        }
        origins.push({ value, archived: false });
        await saveOrigins(origins);
        input.value = "";
        renderOriginsAdmin();
        populateOriginDropdown();
    });
    async function setupOriginsAdminTab() {
        const isAdmin = currentUser === "admin";
        document.getElementById("origins-admin-section").style.display = isAdmin ? "" : "none";
        if (isAdmin) renderOriginsAdmin();
    }
    async function populateOriginDropdown() {
        const select = document.getElementById("task-origin-input");
        select.innerHTML = "";
        const origins = (await getOrigins()).filter(o => !o.archived);
        origins.forEach(origin => {
            const opt = document.createElement("option");
            opt.value = origin.value;
            opt.textContent = origin.value;
            select.appendChild(opt);
        });
    }

    // --- Login ---
    async function validateLogin(username, password) {
        const users = await getUsers();
        return users[username] && users[username].password === password;
    }
    async function afterLoginSetup() {
        ensureAllUsersTaskStructure();
        authDiv.style.display = "none";
        appDiv.style.display = "block";
        currentUserNameSpan.textContent = currentUser;
        setupAdminTab();
        setupOriginsAdminTab();
        populateOriginDropdown();
        loadTodayTasks();
        loadArchiveDate(new Date());
        clearLoginInputs();
        clearSettingsInputs();
    }
    loginBtn.addEventListener("click", () => {
        const username = document.getElementById("login-username").value.trim();
        const password = document.getElementById("login-password").value;
        if (!username || !password) {
            loginError.textContent = "Please enter username and password.";
            return;
        }
        if (validateLogin(username, password)) {
            currentUser = username;
            sessionStorage.setItem(SESSION_USER_KEY, currentUser);
            loginError.textContent = "";
            afterLoginSetup();
        } else {
            loginError.textContent = "Invalid username or password.";
        }
    });
    logoutBtn.addEventListener("click", () => {
        currentUser = null;
        sessionStorage.removeItem(SESSION_USER_KEY);
        authDiv.style.display = "block";
        appDiv.style.display = "none";
        clearLoginInputs();
        clearSettingsInputs();
        clearTasksDisplay();
        clearAdminUserList();
    });
    async function clearLoginInputs() {
        document.getElementById("login-username").value = "";
        document.getElementById("login-password").value = "";
        loginError.textContent = "";
    }
    async function clearSettingsInputs() {
        newUsernameInput.value = "";
        newPasswordInput.value = "";
    }
    async function clearTasksDisplay() {
        todayTasksList.innerHTML = "";
        archiveTasksList.innerHTML = "";
        const usersTasksTable = document.getElementById("users-tasks-table-container");
        if (usersTasksTable) usersTasksTable.innerHTML = "";
    }
    async function clearAdminUserList() {
        userListUl.innerHTML = "";
    }
    // --- Admin Tab setup ---
    async function setupAdminTab() {
        const isAdmin = currentUser === "admin";
        // Only show User Management in settings for admin
        const userMgmtLi = document.getElementById('sidebar-user-mgmt-li');
        const adminUserMgmt = document.getElementById('admin-user-mgmt');
        if (userMgmtLi) userMgmtLi.style.display = isAdmin ? "" : "none";
        if (adminUserMgmt) adminUserMgmt.style.display = isAdmin ? "" : "none";
        if (isAdmin) loadAdminUserList();
    }
    async function loadAdminUserList() {
        const users = await getUsers();
        userListUl.innerHTML = "";
        Object.values(users).forEach(user => {
            if (user.username === "admin") return;
            const li = document.createElement("li");
            li.className = "list-group-item";

            // Display row (default)
            const displayDiv = document.createElement("div");
            displayDiv.className = "d-flex align-items-center gap-2";
            displayDiv.innerHTML = `
            <span style="font-weight:bold;">${escapeHTML(user.surname)}, ${escapeHTML(user.firstname)} ${escapeHTML(user.middlename)}</span>
            <span class="text-muted ms-2">${escapeHTML(user.username)}</span>
            <span class="ms-2">${escapeHTML(user.designation)}</span>
        `;
            const manageBtn = document.createElement("button");
            manageBtn.className = "btn btn-sm btn-secondary ms-auto";
            manageBtn.textContent = "Manage";
            displayDiv.appendChild(manageBtn);

            // Edit row (hidden by default)
            const editDiv = document.createElement("div");
            editDiv.className = "align-items-center gap-2"; // No d-flex by default!
            editDiv.style.display = "none";

            // Editable fields
            const surnameInput = document.createElement("input");
            surnameInput.type = "text";
            surnameInput.value = user.surname;
            surnameInput.className = "form-control form-control-sm";
            surnameInput.style.maxWidth = "120px";

            const firstnameInput = document.createElement("input");
            firstnameInput.type = "text";
            firstnameInput.value = user.firstname;
            firstnameInput.className = "form-control form-control-sm";
            firstnameInput.style.maxWidth = "120px";

            const middlenameInput = document.createElement("input");
            middlenameInput.type = "text";
            middlenameInput.value = user.middlename;
            middlenameInput.className = "form-control form-control-sm";
            middlenameInput.style.maxWidth = "120px";

            const usernameInput = document.createElement("input");
            usernameInput.type = "text";
            usernameInput.value = user.username;
            usernameInput.className = "form-control form-control-sm";
            usernameInput.style.maxWidth = "120px";

            const passwordInput = document.createElement("input");
            passwordInput.type = "password";
            passwordInput.placeholder = "New password";
            passwordInput.className = "form-control form-control-sm";
            passwordInput.style.maxWidth = "120px";

            const designationInput = document.createElement("input");
            designationInput.type = "text";
            designationInput.value = user.designation;
            designationInput.className = "form-control form-control-sm";
            designationInput.style.maxWidth = "120px";

            // Save, Cancel, Delete buttons
            const saveBtn = document.createElement("button");
            saveBtn.className = "btn btn-sm btn-primary";
            saveBtn.textContent = "Save";

            const cancelBtn = document.createElement("button");
            cancelBtn.className = "btn btn-sm btn-secondary";
            cancelBtn.textContent = "Cancel";

            const delBtn = document.createElement("button");
            delBtn.className = "btn btn-sm btn-danger";
            delBtn.textContent = "Delete";

            // Save logic
            saveBtn.onclick = async () => {
                const newUsername = usernameInput.value.trim();
                const newPassword = passwordInput.value;
                const surname = surnameInput.value.trim();
                const firstname = firstnameInput.value.trim();
                const middlename = middlenameInput.value.trim();
                const designation = designationInput.value.trim();
                if (!newUsername || !surname || !firstname || !designation) {
                    await showAlertModal("Please fill in all required fields.");
                    return;
                }
                if (newUsername !== user.username && users[newUsername]) {
                    await showAlertModal("Username already exists.");
                    return;
                }
                let msg = `Change username from "${user.username}" to "${newUsername}"?`;
                if (newPassword) msg += `\nPassword will be updated.`;
                if (!await showConfirmModal(msg)) return;

                const usersData = await getUsers();
                // If username changed, move data
                if (newUsername !== user.username) {
                    usersData[newUsername] = { ...usersData[user.username] };
                    usersData[newUsername].surname = surname;
                    usersData[newUsername].firstname = firstname;
                    usersData[newUsername].middlename = middlename;
                    usersData[newUsername].designation = designation;
                    if (newPassword) usersData[newUsername].password = newPassword;
                    delete usersData[user.username];
                    // Move tasks
                    const tasks = await getTasks();
                    if (tasks[user.username]) {
                        tasks[newUsername] = tasks[user.username];
                        delete tasks[user.username];
                        await saveTasks(tasks);
                    }
                } else {
                    usersData[user.username].surname = surname;
                    usersData[user.username].firstname = firstname;
                    usersData[user.username].middlename = middlename;
                    usersData[user.username].designation = designation;
                    if (newPassword) usersData[user.username].password = newPassword;
                }
                await saveUsers(usersData);
                await showAlertModal("User updated.");
                loadAdminUserList();
            };

            // Cancel logic
            cancelBtn.onclick = () => {
                editDiv.style.display = "none";
                editDiv.classList.remove("d-flex"); // Remove d-flex when hiding
                displayDiv.style.display = "";
            };

            // Delete logic
            delBtn.onclick = async () => {
                const uname = usernameInput.value.trim();
                if (uname === "admin") {
                    await showAlertModal("Cannot delete admin user.");
                    return;
                }
                if (await showConfirmModal(`Delete user "${uname}"? This cannot be undone.`)) {
                    const users = await getUsers();
                    const tasks = await getTasks();
                    delete users[uname];
                    delete tasks[uname];
                    await saveUsers(users);
                    await saveTasks(tasks);
                    ensureAllUsersTaskStructure();
                    loadAdminUserList();
                }
            };

            // Add fields/buttons to editDiv
            editDiv.appendChild(surnameInput);
            editDiv.appendChild(firstnameInput);
            editDiv.appendChild(middlenameInput);
            editDiv.appendChild(usernameInput);
            editDiv.appendChild(passwordInput);
            editDiv.appendChild(designationInput);
            editDiv.appendChild(saveBtn);
            editDiv.appendChild(cancelBtn);
            editDiv.appendChild(delBtn);

            manageBtn.onclick = () => {
                displayDiv.style.display = "none";
                editDiv.style.display = "";
                editDiv.classList.add("d-flex"); // Only add d-flex when showing
                passwordInput.value = "";
            };

            li.appendChild(displayDiv);
            li.appendChild(editDiv);
            userListUl.appendChild(li);
        });
    }
    adminCreateUserBtn && adminCreateUserBtn.addEventListener("click", async () => {
        const username = adminNewUsername.value.trim();
        const password = adminNewPassword.value;
        const surname = adminNewSurname.value.trim();
        const firstname = adminNewFirstname.value.trim();
        const middlename = adminNewMiddlename.value.trim();
        const designation = adminNewDesignation.value.trim();
        if (!username || !password || !surname || !firstname || !designation) {
            await showAlertModal("Please fill in all required fields.");
            return;
        }
        const users = await getUsers();
        if (users[username]) {
            await showAlertModal("User already exists.");
            return;
        }
        users[username] = {
            username,
            password,
            surname,
            firstname,
            middlename,
            designation
        };
        await saveUsers(users);
        await ensureAllUsersTaskStructure();
        adminNewUsername.value = "";
        adminNewPassword.value = "";
        adminNewSurname.value = "";
        adminNewFirstname.value = "";
        adminNewMiddlename.value = "";
        adminNewDesignation.value = "";
        loadAdminUserList();
    });

    // --- Tasks functions ---
    async function addTaskToDate(taskObj, taskDate) {
        if (!taskObj || !taskObj.origin || !taskObj.activity || !taskDate) return;
        const tasks = await getTasks();
        if (!tasks[currentUser]) tasks[currentUser] = { today: [], archive: {} };
        const today = new Date();
        const todayStr = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
        const newTask = {
            id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2),
            origin: taskObj.origin,
            activity: taskObj.activity,
            remarks: taskObj.remarks || "",
            date: taskDate,
            tags: Array.isArray(taskObj.tags) ? taskObj.tags : []
        };
        if (taskDate === todayStr) {
            tasks[currentUser].today.push(newTask);
        } else {
            if (!tasks[currentUser].archive[taskDate]) tasks[currentUser].archive[taskDate] = [];
            tasks[currentUser].archive[taskDate].push(newTask);
        }
        await saveTasks(tasks);
        console.log("Saved tasks:", tasks);
    }
    window.addTaskToDate = addTaskToDate;
    wrapAsyncWithSpinnerToast(window, "addTaskToDate", { pending: "Adding task...", done: "Task added!", fail: "Failed to add task." });

    async function ensureAllTasksHaveIDs() {
        const tasks = await getTasks();
        let changed = false;
        Object.values(tasks).forEach(user => {
            if (Array.isArray(user.today)) {
                user.today.forEach(task => {
                    if (!task.id) {
                        task.id = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
                        changed = true;
                    }
                });
            }
            if (user.archive) {
                Object.values(user.archive).forEach(arr => {
                    arr.forEach(task => {
                        if (!task.id) {
                            task.id = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
                            changed = true;
                        }
                    });
                });
            }
        });
        if (changed) await saveTasks(tasks);
    }

    addTaskBtn.addEventListener("click", async () => {
        showGlobalSpinner("Adding task...");
        try {
            const origin = document.getElementById("task-origin-input").value;
            const activity = document.getElementById("task-activity-input").value.trim();
            const remarks = document.getElementById("task-remarks-input").value.trim();
            let taskDate = document.getElementById("task-date-input").value;
            if (!taskDate) {
                const today = new Date();
                taskDate = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
                document.getElementById("task-date-input").value = taskDate;
            }
            const tagsInput = document.getElementById('task-tags-input');
            let tags = [];
            if (tagsInput && tagsInput.value) {
                tags = tagsInput.value.split(',').map(t => t.trim()).filter(Boolean);
            }
            if (!origin || !activity || !taskDate) return;
            await addTaskToDate({ origin, activity, remarks, tags }, taskDate);
            document.getElementById("task-activity-input").value = "";
            document.getElementById("task-remarks-input").value = "";
            $('#task-date-input').datepicker('setDate', new Date());
            await loadTodayTasks();
            finishWithToast("Task added!");
        } catch (e) {
            finishWithToast("Failed to add task!");
        }
    });
    async function loadTodayTasks() {
        if (typeof rerenderTodayTable === "function") {
            rerenderTodayTable();
        }
    }
    async function loadArchiveDate(date) {
        if (typeof rerenderArchiveTable === "function") {
            rerenderArchiveTable();
        }
    }
    async function applyMassEditorFilter() {
        const tasks = await getTasks();
        const user = tasks[massEditorCurrentUser];
        let allTasks = [];
        if (user && Array.isArray(user.today)) allTasks = allTasks.concat(user.today.map(t => ({ ...t })));
        if (user && user.archive) {
            Object.values(user.archive).forEach(arr => {
                if (Array.isArray(arr)) {
                    allTasks = allTasks.concat(arr.map(t => ({ ...t })));
                }
            });
        }

        // Filtering logic
        let filtered = allTasks;
        const filter = massEditorFilter;
        if (filter && filter.type && filter.type !== "all") {
            if (filter.type === "month" && filter.value) {
                // filter.value is "YYYY-MM"
                filtered = filtered.filter(t => t.date && t.date.startsWith(filter.value));
            } else if (filter.type === "week" && filter.value) {
                // filter.value is "YYYY-Www"
                // Convert week to date range
                const [year, week] = filter.value.split("-W");
                if (year && week) {
                    // Get first day of week (Monday)
                    const firstDay = new Date(year, 0, 1 + (week - 1) * 7);
                    // Adjust to Monday
                    const day = firstDay.getDay();
                    const monday = new Date(firstDay);
                    if (day !== 1) {
                        monday.setDate(firstDay.getDate() - ((day + 6) % 7));
                    }
                    // Sunday
                    const sunday = new Date(monday);
                    sunday.setDate(monday.getDate() + 6);
                    const startStr = monday.toISOString().slice(0, 10);
                    const endStr = sunday.toISOString().slice(0, 10);
                    filtered = filtered.filter(t => t.date >= startStr && t.date <= endStr);
                }
            } else if (filter.type === "range" && Array.isArray(filter.value) && filter.value.length) {
                // filter.value is array of dates ["YYYY-MM-DD", ...]
                filtered = filtered.filter(t => filter.value.includes(t.date));
            } else if (filter.type === "daterange" && Array.isArray(filter.value) && filter.value.length === 2) {
                // filter.value is [start, end]
                const [start, end] = filter.value;
                if (start && end) {
                    filtered = filtered.filter(t => t.date >= start && t.date <= end);
                }
            }
        }

        massEditorFilteredTasks = filtered;
        rerenderMassEditorTable();
    }
    async function loadUsersTasksForDate() {
        if (typeof rerenderViewTasksTable === "function") {
            rerenderViewTasksTable();
        }
    }

    // --- Today Tab Edit Mode ---
    window.todayEditMode = false;
    window.todayEditPending = null;
    window.todayEditOriginal = null;
    window.todaySelectedTasks = new Set();
    // --- Today Edit Button Logic ---
    const todayEditBtn = document.getElementById("today-edit-btn");
    const todayDeleteSelectedBtn = document.getElementById("today-delete-selected-btn");
    // --- TODAY ---
    todayEditBtn.addEventListener("click", async () => {
        const tasks = await getTasks();
        if (!todayEditMode) {
            todayEditMode = true;
            window.todayEditOriginal = JSON.parse(JSON.stringify(tasks[currentUser].today));
            window.todayEditPending = JSON.parse(JSON.stringify(tasks[currentUser].today));
            todayEditBtn.querySelector("#today-edit-btn-label").textContent = "DONE";
            todayDeleteSelectedBtn.style.display = "";
            todaySelectedTasks.clear();
            rerenderTodayTable();
        } else {
            const confirmed = await showConfirmModal("Save all changes to today's tasks?");
            if (confirmed) {
                showGlobalSpinner("Saving changes...");
                const today = new Date();
                const todayStr = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
                // Split tasks into those that are still today and those that moved
                const stillToday = [];
                const movedToArchive = {};
                window.todayEditPending.forEach(task => {
                    if (task.date === todayStr) {
                        stillToday.push(task);
                    } else {
                        if (!movedToArchive[task.date]) movedToArchive[task.date] = [];
                        movedToArchive[task.date].push(task);
                    }
                });
                tasks[currentUser].today = stillToday;
                // Move to archive
                Object.entries(movedToArchive).forEach(([date, arr]) => {
                    if (!tasks[currentUser].archive[date]) tasks[currentUser].archive[date] = [];
                    tasks[currentUser].archive[date].push(...arr);
                });
                await saveTasks(tasks);
                finishWithToast("Changes saved!");
            } else {
                showGlobalSpinner("Reverting changes...");
                tasks[currentUser].today = window.todayEditOriginal;
                await saveTasks(tasks);
                finishWithToast("Changes reverted");
            }
            todayEditMode = false;
            window.todayEditPending = null;
            window.todayEditOriginal = null;
            todayEditBtn.querySelector("#today-edit-btn-label").textContent = "EDIT";
            todayDeleteSelectedBtn.style.display = "none";
            todaySelectedTasks.clear();
            rerenderTodayTable();
        }
    });

    todayDeleteSelectedBtn.addEventListener("click", async () => {
        if (todaySelectedTasks.size === 0) {
            await showAlertModal("No tasks selected.");
            return;
        }
        const confirmed = await showConfirmModal("Are you sure you want to delete the selected tasks?");
        if (!confirmed) return;

        // Get the filtered array as shown in the table
        let filtered = [];
        const table = document.getElementById('today-tasks-list');
        table.querySelectorAll('tr[data-row]').forEach((row, idx) => {
            // Each row in the table corresponds to the filtered array in renderTasksTable
            filtered.push(window.lastTodayFiltered[idx]);
        });

        // Get the correct array to delete from
        let arr;
        if (todayEditMode && window.todayEditPending) {
            arr = window.todayEditPending;
        } else {
            const tasks = await getTasks();
            arr = (tasks[currentUser] && tasks[currentUser].today) || [];
        }

        // Remove by matching fields, highest to lowest index
        const idxs = Array.from(todaySelectedTasks).sort((a, b) => b - a);
        idxs.forEach(idx => {
            const toDelete = filtered[idx];
            const delIdx = arr.findIndex(t =>
                t.origin === toDelete.origin &&
                t.activity === toDelete.activity &&
                t.remarks === toDelete.remarks &&
                t.date === toDelete.date &&
                JSON.stringify(t.tags) === JSON.stringify(toDelete.tags)
            );
            if (delIdx > -1) arr.splice(delIdx, 1);
        });

        if (!todayEditMode) {
            showGlobalSpinner("Deleting tasks...");
            const tasks = await getTasks();
            tasks[currentUser].today = arr;
            await saveTasks(tasks);
            finishWithToast("Tasks deleted!");
        }
        todaySelectedTasks.clear();
        rerenderTodayTable();
    });

    // --- Archive Tab Edit Mode ---
    const archiveEditBtn = document.getElementById("archive-edit-btn");
    const archiveDeleteSelectedBtn = document.getElementById("archive-delete-selected-btn");
    window.archiveEditMode = false;
    window.archiveEditPending = null;
    window.archiveEditOriginal = null;
    window.archiveSelectedTasks = new Set();
    archiveEditBtn.addEventListener("click", async () => {
        const dateStr = document.getElementById('archive-date-display').textContent;
        if (!archiveEditMode) {
            archiveEditMode = true; // SET THIS FIRST!
            const tasks = await getTasks();
            window.archiveEditOriginal = JSON.parse(JSON.stringify(tasks[currentUser].archive[dateStr] || []));
            window.archiveEditPending = JSON.parse(JSON.stringify(tasks[currentUser].archive[dateStr] || []));
            archiveEditBtn.querySelector("#archive-edit-btn-label").textContent = "DONE";
            archiveDeleteSelectedBtn.style.display = "";
            archiveSelectedTasks.clear();
            rerenderArchiveTable();
        } else {
            const tasks = await getTasks();
            const confirmed = await showConfirmModal("Save all changes to this day's archive?");
            if (confirmed) {
                showGlobalSpinner("Saving archive...");
                const today = new Date();
                const todayStr = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
                const stillHere = [];
                const moved = {};
                window.archiveEditPending.forEach(task => {
                    if (task.date === dateStr) {
                        stillHere.push(task);
                    } else {
                        if (!moved[task.date]) moved[task.date] = [];
                        moved[task.date].push(task);
                    }
                });
                tasks[currentUser].archive[dateStr] = stillHere;
                // Move to correct archive or today
                Object.entries(moved).forEach(([date, arr]) => {
                    if (date === todayStr) {
                        if (!tasks[currentUser].today) tasks[currentUser].today = [];
                        tasks[currentUser].today.push(...arr);
                    } else {
                        if (!tasks[currentUser].archive[date]) tasks[currentUser].archive[date] = [];
                        tasks[currentUser].archive[date].push(...arr);
                    }
                });
                await saveTasks(tasks);
                finishWithToast("Archive updated!");
            } else {
                showGlobalSpinner("Reverting archive...");
                tasks[currentUser].archive[dateStr] = window.archiveEditOriginal;
                await saveTasks(tasks);
                finishWithToast("Changes reverted.");
            }
            archiveEditMode = false;
            window.archiveEditPending = null;
            window.archiveEditOriginal = null;
            archiveEditBtn.querySelector("#archive-edit-btn-label").textContent = "EDIT";
            archiveDeleteSelectedBtn.style.display = "none";
            archiveSelectedTasks.clear();
            rerenderArchiveTable();
        }
    });
    archiveDeleteSelectedBtn.addEventListener("click", async () => {
        if (archiveSelectedTasks.size === 0) {
            await showAlertModal("No tasks selected.");
            return;
        }
        const confirmed = await showConfirmModal("Are you sure you want to delete the selected tasks?");
        if (!confirmed) return;

        // Get the filtered array as shown in the table
        let filtered = [];
        const table = document.getElementById('archive-tasks-list');
        table.querySelectorAll('tr[data-row]').forEach((row, idx) => {
            filtered.push(window.lastArchiveFiltered[idx]);
        });

        const tasks = await getTasks();
        const dateStr = document.getElementById('archive-date-display').textContent;
        let arr;
        if (archiveEditMode && window.archiveEditPending) {
            arr = window.archiveEditPending;
        } else {
            arr = [];
            if (tasks[currentUser] && tasks[currentUser].archive && tasks[currentUser].archive[dateStr]) {
                arr = tasks[currentUser].archive[dateStr].filter(t => t && typeof t === "object");
            }
        }

        // Remove by matching fields, highest to lowest index
        const idxs = Array.from(archiveSelectedTasks).sort((a, b) => b - a);
        idxs.forEach(idx => {
            const toDelete = filtered[idx];
            const delIdx = arr.findIndex(t =>
                t.origin === toDelete.origin &&
                t.activity === toDelete.activity &&
                t.remarks === toDelete.remarks &&
                t.date === toDelete.date &&
                JSON.stringify(t.tags) === JSON.stringify(toDelete.tags)
            );
            if (delIdx > -1) arr.splice(delIdx, 1);
        });

        if (!archiveEditMode) {
            showGlobalSpinner("Deleting tasks...");
            tasks[currentUser].archive[dateStr] = arr;
            await saveTasks(tasks);
            finishWithToast("Tasks deleted!");
        }
        archiveSelectedTasks.clear();
        rerenderArchiveTable();
    });
    // --- On page load, check session ---
    async function init() {
        const savedUser = sessionStorage.getItem(SESSION_USER_KEY);
        if (savedUser && await getUsers()[savedUser]) {
            currentUser = savedUser;
            afterLoginSetup();
        } else {
            authDiv.style.display = "block";
            appDiv.style.display = "none";
        }
        //Initialize task list
        document.getElementById('today-tab').addEventListener('shown.bs.tab', async function () {
            // Always set the date input to today when switching to Today tab
            const today = new Date();
            const todayStr = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
            $('#task-date-input').datepicker('setDate', todayStr);
            document.getElementById("task-date-input").value = todayStr;
            loadTodayTasks();
        });
        document.getElementById('archive-tab').addEventListener('shown.bs.tab', async function () {
            loadArchiveDate(document.getElementById('archive-date-display').textContent);
        });
        document.getElementById('view-users-tab').addEventListener('shown.bs.tab', async function () {
            loadUsersTasksForDate();
        });
        document.getElementById('settings-tab').addEventListener('shown.bs.tab', async function () {
            setupOriginsAdminTab();
        });
        document.getElementById('sidebar-mass-editor-btn').addEventListener('shown.bs.tab', async function () {
            setupMassEditorTab();
        });
    }
    init();

    // --- Datepicker and holiday setup ---
    $(document).ready(async function () {
        // HOLIDAY datepicker
        $('#holiday-datepicker').datepicker({
            format: 'yyyy-mm-dd',
            todayHighlight: true,
            autoclose: true,
            orientation: "bottom auto"
        });
        // TODAY datepicker
        $('#task-date-input').datepicker({
            format: 'yyyy-mm-dd',
            todayHighlight: true,
            autoclose: true,
            orientation: "bottom auto"
        });
        $('#task-date-input').datepicker('setDate', new Date());
        // ARCHIVE datepicker
        $('#datepicker').datepicker({
            format: 'yyyy-mm-dd',
            todayHighlight: true,
            autoclose: true,
            orientation: "bottom auto"
        }).on('changeDate', async function (e) {
            const date = e.format('yyyy-mm-dd');
            document.getElementById('archive-date-display').textContent = formatDateFull(date);
            loadArchiveDate(new Date(date));
        });
        // VIEW TASKS datepicker
        $('#view-tasks-date-group').datepicker({
            format: 'yyyy-mm-dd',
            todayHighlight: true,
            autoclose: true,
            orientation: "bottom auto"
        }).on('changeDate', async function (e) {
            const date = e.format('yyyy-mm-dd');
            $('#view-tasks-date').val(date);
        });
        // Set initial date for view tasks
        const today = new Date();
        const todayStr = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
        $('#view-tasks-date').val(todayStr);
        // Set initial archive date display
        const todayArchive = new Date();
        const todayArchiveStr = todayArchive.getFullYear() + '-' + String(todayArchive.getMonth() + 1).padStart(2, '0') + '-' + String(todayArchive.getDate()).padStart(2, '0');
        $('#datepicker').datepicker('setDate', todayArchiveStr);
        document.getElementById('archive-date-display').textContent = formatDateFull(todayArchiveStr);
        renderHolidaysList();
        populateOriginDropdown();
    });

    // Add holiday
    document.getElementById('add-holiday-btn').addEventListener('click', async function () {
        const date = $('#holiday-datepicker').datepicker('getFormattedDate');
        const name = document.getElementById('holiday-name').value.trim();
        const repeat = document.getElementById('holiday-repeat').checked;
        if (!date || !name) {
            await showAlertModal("Please select a date and enter a holiday name.");
            return;
        }
        showGlobalSpinner("Adding holiday...");
        const holidays = await getHolidays();
        holidays.push({ date, name, repeat });
        await saveHolidays(holidays);
        renderHolidaysList();
        document.getElementById('holiday-name').value = "";
        document.getElementById('holiday-repeat').checked = false;
        finishWithToast("Holiday added!");
    });

    // --- Helper for Holidays ---
    async function getHolidayForDate(dateStr) {
        const holidays = await getHolidays();
        const [yyyy, mm, dd] = dateStr.split('-');
        return holidays.filter(h => {
            if (h.repeat) {
                // Match month and day
                const [hyyyy, hmm, hdd] = h.date.split('-');
                return hmm === mm && hdd === dd;
            }
            return h.date === dateStr;
        });
    }

    // --- Confirmation Modal ---
    async function showConfirmModal(message) {
        return new Promise((resolve) => {
            const modal = new bootstrap.Modal(document.getElementById('confirmModal'));
            document.getElementById('confirmModalBody').textContent = message;
            const okBtn = document.getElementById('confirmModalOk');
            const cancelBtn = document.getElementById('confirmModalCancel');
            async function cleanup(result) {
                okBtn.removeEventListener('click', onOk);
                cancelBtn.removeEventListener('click', onCancel);
                document.getElementById('confirmModal').removeEventListener('hidden.bs.modal', onCancel);
                resolve(result);
            }
            async function onOk() {
                modal.hide();
                cleanup(true);
            }
            async function onCancel() {
                cleanup(false);
            }
            okBtn.addEventListener('click', onOk);
            cancelBtn.addEventListener('click', onCancel);
            document.getElementById('confirmModal').addEventListener('hidden.bs.modal', onCancel);
            modal.show();
        });
    }

    // --- Mass Task Editor ---
    window.massEditorEditMode = false;
    window.massEditorEditPending = null;
    window.massEditorEditOriginal = null;
    window.massEditorSelectedTasks = new Set();
    let massEditorCurrentUser = null;
    let massEditorFilteredTasks = [];
    let massEditorFilter = { type: "all" };

    async function setupMassEditorTab() {
        const isAdmin = currentUser === "admin";
        const userSelectContainer = document.getElementById("mass-editor-user-select-container");
        const userSelect = document.getElementById("mass-editor-user-select");
        userSelectContainer.style.display = isAdmin ? "" : "none";
        if (isAdmin) {
            // Populate user select
            userSelect.innerHTML = "";
            const usersObj = await getUsers();
            Object.keys(usersObj).forEach(u => {
                const opt = document.createElement("option");
                opt.value = u;
                opt.textContent = u;
                userSelect.appendChild(opt);
            });
            // Default to first user if not set
            if (!massEditorCurrentUser || !usersObj[massEditorCurrentUser]) {
                massEditorCurrentUser = userSelect.options[0]?.value || null;
            }
            userSelect.value = massEditorCurrentUser;
            userSelect.onchange = async () => {
                massEditorCurrentUser = userSelect.value;
                applyMassEditorFilter();
            };
        } else {
            massEditorCurrentUser = currentUser;
        }
        applyMassEditorFilter();
    }

    async function updateMassEditorTask(idx, changes) {
        const tasks = await getTasks();
        const user = tasks[massEditorCurrentUser];
        let task = massEditorFilteredTasks[idx];
        // Find and update in correct array
        let found = false;
        if (user.today) {
            let tIdx = user.today.findIndex(t => t.id === task.id);
            if (tIdx > -1) {
                Object.assign(user.today[tIdx], changes);
                found = true;
            }
        }
        if (!found && user.archive) {
            Object.keys(user.archive).forEach(date => {
                let arr = user.archive[date];
                let tIdx = arr.findIndex(t => t.id === task.id);
                if (tIdx > -1) {
                    Object.assign(arr[tIdx], changes);
                    // If date changed, move to correct archive/today
                    if (changes.date && changes.date !== date) {
                        const movedTask = arr.splice(tIdx, 1)[0];
                        movedTask.date = changes.date;
                        const today = new Date();
                        const todayStr = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
                        if (changes.date === todayStr) {
                            user.today.push(movedTask);
                        } else {
                            if (!user.archive[changes.date]) user.archive[changes.date] = [];
                            user.archive[changes.date].push(movedTask);
                        }
                    }
                    found = true;
                }
            });
        }
        await saveTasks(tasks);
        applyMassEditorFilter();
    }

    const massEditorEditBtn = document.getElementById("mass-editor-edit-btn");
    const massEditorDeleteSelectedBtn = document.getElementById("mass-editor-delete-selected-btn");
    massEditorEditBtn.addEventListener("click", async () => {
        if (!massEditorCurrentUser) {
            await showAlertModal("No user selected for mass editing.");
            return;
        }
        const tasks = await getTasks();
        const userTasks = tasks[massEditorCurrentUser];
        if (!userTasks) {
            await showAlertModal("No tasks found for selected user.");
            return;
        }
        if (!massEditorEditMode) {
            massEditorEditMode = true;
            let freshTasks = [];
            if (Array.isArray(userTasks.today)) {
                freshTasks = freshTasks.concat(userTasks.today.map(t => ({ ...t })));
            }
            if (userTasks.archive) {
                Object.values(userTasks.archive).forEach(arr => {
                    if (Array.isArray(arr)) {
                        freshTasks = freshTasks.concat(arr.map(t => ({ ...t })));
                    }
                });
            }
            window.massEditorEditOriginal = JSON.parse(JSON.stringify(freshTasks));
            window.massEditorEditPending = JSON.parse(JSON.stringify(freshTasks));
            document.getElementById("mass-editor-edit-btn-label").textContent = "DONE";
            massEditorDeleteSelectedBtn.style.display = "";
            massEditorSelectedTasks.clear();
            rerenderMassEditorTable();
        } else {
            const user = userTasks;
            const confirmed = await showConfirmModal("Save all changes in mass editor?");
            if (confirmed) {
                showGlobalSpinner("Saving mass edits...");
                // Save pending edits back to user.today and user.archive
                let pending = window.massEditorEditPending;
                user.today = pending.filter(t => {
                    const today = new Date();
                    const todayStr = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
                    return t.date === todayStr;
                });
                // Clear and rebuild archive
                user.archive = {};
                pending.forEach(t => {
                    const today = new Date();
                    const todayStr = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
                    if (t.date !== todayStr) {
                        if (!user.archive[t.date]) user.archive[t.date] = [];
                        user.archive[t.date].push(t);
                    }
                });
                await saveTasks(tasks);
                finishWithToast("Mass edits saved!");
            } else {
                showGlobalSpinner("Reverting mass edits...");
                // Revert
                let orig = window.massEditorEditOriginal;
                user.today = orig.filter(t => {
                    const today = new Date();
                    const todayStr = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
                    return t.date === todayStr;
                });
                user.archive = {};
                orig.forEach(t => {
                    const today = new Date();
                    const todayStr = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
                    if (t.date !== todayStr) {
                        if (!user.archive[t.date]) user.archive[t.date] = [];
                        user.archive[t.date].push(t);
                    }
                });
                await saveTasks(tasks);
                finishWithToast("Changes reverted.");
            }
            massEditorEditMode = false;
            window.massEditorEditPending = null;
            window.massEditorEditOriginal = null;
            document.getElementById("mass-editor-edit-btn-label").textContent = "EDIT";
            massEditorDeleteSelectedBtn.style.display = "none";
            massEditorSelectedTasks.clear();
            applyMassEditorFilter();
        }
    });

    async function deleteMassEditorTask(idx) {
        const confirmed = await showConfirmModal("Are you sure you want to delete this task?");
        if (!confirmed) return;
        const tasks = await getTasks();
        const user = tasks[massEditorCurrentUser];
        let task = massEditorFilteredTasks[idx];
        let found = false;
        if (user.today) {
            let tIdx = user.today.findIndex(t => t.origin === task.origin && t.activity === task.activity && t.remarks === task.remarks && t.date === task.date);
            if (tIdx > -1) {
                user.today.splice(tIdx, 1);
                found = true;
            }
        }
        if (!found && user.archive) {
            Object.keys(user.archive).forEach(date => {
                let arr = user.archive[date];
                let tIdx = arr.findIndex(t => t.origin === task.origin && t.activity === task.activity && t.remarks === task.remarks && t.date === task.date);
                if (tIdx > -1) {
                    arr.splice(tIdx, 1);
                }
            });
        }
        await saveTasks(tasks);
        applyMassEditorFilter();
    }

    // Mass delete
    document.getElementById("mass-editor-delete-selected-btn").addEventListener("click", async () => {
        if (todaySelectedTasks.size === 0) {
            await showAlertModal("No tasks selected.");
            return;
        }
        const confirmed = await showConfirmModal("Are you sure you want to delete the selected tasks?");
        if (!confirmed) return;
        // Delete in reverse order to avoid reindexing
        const idxs = Array.from(massEditorSelectedTasks).sort((a, b) => b - a);
        if (massEditorEditMode && window.massEditorEditPending) {
            idxs.forEach(idx => window.massEditorEditPending.splice(idx, 1));
        } else {
            idxs.forEach(idx => massEditorFilteredTasks.splice(idx, 1));
        }
        massEditorSelectedTasks.clear();
        rerenderMassEditorTable();
    });


    // Filter UI logic
    document.getElementById("mass-editor-filter-type").addEventListener("change", async function () {
        document.getElementById("mass-editor-filter-month").style.display = this.value === "month" ? "" : "none";
        document.getElementById("mass-editor-filter-week").style.display = this.value === "week" ? "" : "none";
        document.getElementById("mass-editor-filter-range").style.display = this.value === "range" ? "" : "none";
        document.getElementById("mass-editor-filter-daterange").style.display = this.value === "daterange" ? "" : "none";
    });

    $('#mass-editor-range').datepicker({
        format: 'yyyy-mm-dd',
        multidate: true,
        todayHighlight: true,
        autoclose: false,
        orientation: "bottom auto",
        beforeShowDay: async function (date) {
            // Get currently selected dates as strings
            var selected = $('#mass-editor-range').datepicker('getDates').map(async function (d) {
                return d.toISOString().slice(0, 10);
            });
            var thisDate = date.toISOString().slice(0, 10);
            if (selected.includes(thisDate)) {
                // Highlight selected day
                return { classes: 'active' };
            }
            return;
        }
    });

    // Mass Editor: Date range picker
    $('.input-daterange input').datepicker({
        format: 'yyyy-mm-dd',
        todayHighlight: true,
        autoclose: true,
        orientation: "bottom auto"
    });
    document.getElementById("mass-editor-apply-filter-btn").addEventListener("click", async function () {
        const type = document.getElementById("mass-editor-filter-type").value;
        massEditorFilter.type = type;
        if (type === "month") {
            massEditorFilter.value = document.getElementById("mass-editor-month").value;
        } else if (type === "week") {
            massEditorFilter.value = document.getElementById("mass-editor-week").value;
        } else if (type === "range") {
            // Multidate: get selected dates as array
            massEditorFilter.value = $('#mass-editor-range').datepicker('getDates').map(d =>
                d.toISOString().slice(0, 10)
            );
        } else if (type === "daterange") {
            // Date range: get start and end
            const start = document.getElementById("mass-editor-range-start").value;
            const end = document.getElementById("mass-editor-range-end").value;
            massEditorFilter.value = [start, end];
        } else {
            massEditorFilter.value = null;
        }
        applyMassEditorFilter();
    });

    // --- Backup, Import, Export Section ---

    // Helper: UUID generator (simple, not cryptographically secure)
    async function uuidv4() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, async function (c) {
            var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    // Ensure all users and tasks have unique IDs
    async function ensureUserAndTaskIDs() {
        const users = await getUsers();
        let changed = false;
        Object.keys(users).forEach(username => {
            if (!users[username].id) {
                users[username].id = uuidv4();
                changed = true;
            }
        });
        if (changed) await saveUsers(users);

        const tasks = await getTasks();
        Object.keys(tasks).forEach(username => {
            // Today
            if (Array.isArray(tasks[username].today)) {
                tasks[username].today.forEach(task => {
                    if (!task.id) task.id = uuidv4();
                });
            }
            // Archive
            if (tasks[username].archive) {
                Object.values(tasks[username].archive).forEach(arr => {
                    arr.forEach(task => {
                        if (!task.id) task.id = uuidv4();
                    });
                });
            }
        });
        await saveTasks(tasks);
    }

    // Call this after login
    async function afterLoginSetupWithIDs() {
        ensureUserAndTaskIDs();
        afterLoginSetup();
    }

    // Replace afterLoginSetup() with afterLoginSetupWithIDs() in your login logic:
    loginBtn.addEventListener("click", () => {
        const username = document.getElementById("login-username").value.trim();
        const password = document.getElementById("login-password").value;
        if (!username || !password) {
            loginError.textContent = "Please enter username and password.";
            return;
        }
        if (validateLogin(username, password)) {
            currentUser = username;
            sessionStorage.setItem(SESSION_USER_KEY, currentUser);
            loginError.textContent = "";
            afterLoginSetupWithIDs(); // <--- use this
        } else {
            loginError.textContent = "Invalid username or password.";
        }
    });

    // --- UI logic for Backup/Import/Export ---
    async function setupBackupTab() {
        const isAdmin = currentUser === "admin";
        document.getElementById("backup-admin-section").style.display = isAdmin ? "" : "none";
    }

    // Show tab logic
    document.getElementById('sidebar-backup-btn').addEventListener('shown.bs.tab', async function () {
        setupBackupTab();
    });

    // --- Export My Tasks ---
    document.getElementById("export-my-tasks-btn").addEventListener("click", async function () {
        const users = await getUsers();
        const tasks = await getTasks();
        const user = users[currentUser];
        const userTasks = tasks[currentUser] || { today: [], archive: {} };
        const data = {
            user: { id: user.id, username: currentUser },
            tasks: userTasks
        };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${currentUser}-tasks-backup-${(new Date()).toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    });

    // --- Import My Tasks ---
    document.getElementById("import-my-tasks-btn").addEventListener("click", async function () {
        document.getElementById("import-my-tasks-input").click();
    });
    document.getElementById("import-my-tasks-input").addEventListener("change", async function (e) {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async function (evt) {
            try {
                const data = JSON.parse(evt.target.result);
                const users = await getUsers();
                if (!data.user || !data.user.id || data.user.id !== users[currentUser].id) {
                    document.getElementById("import-my-tasks-status").textContent = "User ID does not match. Import aborted.";
                    return;
                }
                // Ask to overwrite or merge
                if (await showConfirmModal("Overwrite all your tasks with imported data? Click Cancel to merge (only new tasks will be added).")) {
                    // Overwrite
                    const tasks = await getTasks();
                    tasks[currentUser] = data.tasks;
                    await saveTasks(tasks);
                    document.getElementById("import-my-tasks-status").textContent = "Tasks imported (overwritten).";
                } else {
                    // Merge: only add tasks with new IDs
                    const tasks = await getTasks();
                    const existingIDs = new Set();
                    tasks[currentUser].today.forEach(t => existingIDs.add(t.id));
                    Object.values(tasks[currentUser].archive).forEach(arr => arr.forEach(t => existingIDs.add(t.id)));
                    // Today
                    data.tasks.today.forEach(t => {
                        if (!existingIDs.has(t.id)) tasks[currentUser].today.push(t);
                    });
                    // Archive
                    Object.entries(data.tasks.archive).forEach(([date, arr]) => {
                        if (!tasks[currentUser].archive[date]) tasks[currentUser].archive[date] = [];
                        arr.forEach(t => {
                            if (!existingIDs.has(t.id)) tasks[currentUser].archive[date].push(t);
                        });
                    });
                    await saveTasks(tasks);
                    document.getElementById("import-my-tasks-status").textContent = "Tasks imported (merged).";
                }
            } catch (err) {
                document.getElementById("import-my-tasks-status").textContent = "Import failed: " + err;
            }
        };
        reader.readAsText(file);
    });

    // --- Export All Users (Admin) ---
    document.getElementById("export-all-users-btn").addEventListener("click", async function () {
        const users = await getUsers();
        const tasks = await getTasks();
        const zip = new JSZip();
        Object.keys(users).forEach(username => {
            const userData = {
                user: { id: users[username].id, username },
                tasks: tasks[username] || { today: [], archive: {} }
            };
            zip.file(`${username}.json`, JSON.stringify(userData, null, 2));
        });
        const blob = await zip.generateAsync({ type: "blob" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `all-users-tasks-backup-${(new Date()).toISOString().slice(0, 10)}.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    });

    // --- Import All Users (Admin) ---
    document.getElementById("import-all-users-btn").addEventListener("click", async function () {
        document.getElementById("import-all-users-input").click();
    });
    document.getElementById("import-all-users-input").addEventListener("change", async function (e) {
        const file = e.target.files[0];
        if (!file) return;
        const statusDiv = document.getElementById("import-all-users-status");
        statusDiv.textContent = "";
        if (file.name.endsWith(".zip")) {
            // ZIP: multiple users
            const zip = await JSZip.loadAsync(file);
            const users = await getUsers();
            const tasks = await getTasks();
            let importSummary = [];
            for (const filename of Object.keys(zip.files)) {
                if (!filename.endsWith(".json")) continue;
                const content = await zip.files[filename].async("string");
                try {
                    const data = JSON.parse(content);
                    if (!data.user || !data.user.id || !data.user.username) continue;
                    const uname = data.user.username;
                    // Ask admin for each user
                    let action = "skip";
                    if (users[uname]) {
                        action = await showPromptModal(`User "${uname}" exists. Type "overwrite" to overwrite, "merge" to merge, or anything else to skip.`, "merge");
                    } else {
                        action = await showPromptModal(`User "${uname}" does not exist. Type "create" to add, or anything else to skip.`, "create");
                    }
                    if (action === "overwrite") {
                        users[uname] = { ...users[uname], id: data.user.id };
                        tasks[uname] = data.tasks;
                        importSummary.push(`User ${uname}: overwritten`);
                    } else if (action === "merge") {
                        if (!users[uname]) users[uname] = { id: data.user.id, password: "" };
                        if (!tasks[uname]) tasks[uname] = { today: [], archive: {} };
                        const existingIDs = new Set();
                        tasks[uname].today.forEach(t => existingIDs.add(t.id));
                        Object.values(tasks[uname].archive).forEach(arr => arr.forEach(t => existingIDs.add(t.id)));
                        // Today
                        data.tasks.today.forEach(t => {
                            if (!existingIDs.has(t.id)) tasks[uname].today.push(t);
                        });
                        // Archive
                        Object.entries(data.tasks.archive).forEach(([date, arr]) => {
                            if (!tasks[uname].archive[date]) tasks[uname].archive[date] = [];
                            arr.forEach(t => {
                                if (!existingIDs.has(t.id)) tasks[uname].archive[date].push(t);
                            });
                        });
                        importSummary.push(`User ${uname}: merged`);
                    } else if (action === "create") {
                        users[uname] = { id: data.user.id, password: "" };
                        tasks[uname] = data.tasks;
                        importSummary.push(`User ${uname}: created`);
                    } else {
                        importSummary.push(`User ${uname}: skipped`);
                    }
                } catch (err) {
                    importSummary.push(`${filename}: import failed (${err})`);
                }
            }
            await saveUsers(users);
            await saveTasks(tasks);
            statusDiv.innerHTML = importSummary.map(s => `<div>${s}</div>`).join("");
        } else if (file.name.endsWith(".json")) {
            // Single user JSON
            const reader = new FileReader();
            reader.onload = async function (evt) {
                try {
                    const data = JSON.parse(evt.target.result);
                    if (!data.user || !data.user.id || !data.user.username) {
                        statusDiv.textContent = "Invalid file.";
                        return;
                    }
                    const uname = data.user.username;
                    const users = await getUsers();
                    const tasks = await getTasks();
                    let action = "skip";
                    if (users[uname]) {
                        action = prompt(`User "${uname}" exists. Type "overwrite" to overwrite, "merge" to merge, or anything else to skip.`, "merge");
                    } else {
                        action = prompt(`User "${uname}" does not exist. Type "create" to add, or anything else to skip.`, "create");
                    }
                    if (action === "overwrite") {
                        users[uname] = { ...users[uname], id: data.user.id };
                        tasks[uname] = data.tasks;
                        statusDiv.textContent = `User ${uname}: overwritten`;
                    } else if (action === "merge") {
                        if (!users[uname]) users[uname] = { id: data.user.id, password: "" };
                        if (!tasks[uname]) tasks[uname] = { today: [], archive: {} };
                        const existingIDs = new Set();
                        tasks[uname].today.forEach(t => existingIDs.add(t.id));
                        Object.values(tasks[uname].archive).forEach(arr => arr.forEach(t => existingIDs.add(t.id)));
                        // Today
                        data.tasks.today.forEach(t => {
                            if (!existingIDs.has(t.id)) tasks[uname].today.push(t);
                        });
                        // Archive
                        Object.entries(data.tasks.archive).forEach(([date, arr]) => {
                            if (!tasks[uname].archive[date]) tasks[uname].archive[date] = [];
                            arr.forEach(t => {
                                if (!existingIDs.has(t.id)) tasks[uname].archive[date].push(t);
                            });
                        });
                        statusDiv.textContent = `User ${uname}: merged`;
                    } else if (action === "create") {
                        users[uname] = { id: data.user.id, password: "" };
                        tasks[uname] = data.tasks;
                        statusDiv.textContent = `User ${uname}: created`;
                    } else {
                        statusDiv.textContent = `User ${uname}: skipped`;
                    }
                    await saveUsers(users);
                    await saveTasks(tasks);
                } catch (err) {
                    statusDiv.textContent = "Import failed: " + err;
                }
            };
            reader.readAsText(file);
        } else {
            statusDiv.textContent = "Unsupported file type.";
        }
    });

    // --- Collect all tags from all tasks ---
    async function collectAllTags() {
        const tasks = await getTasks();
        const tagsSet = new Set();
        Object.values(tasks).forEach(user => {
            user.today?.forEach(t => (t.tags || []).forEach(tag => tagsSet.add(tag)));
            Object.values(user.archive || {}).forEach(arr => arr.forEach(t => (t.tags || []).forEach(tag => tagsSet.add(tag))));
        });
        return Array.from(tagsSet).sort();
    }

    // --- Tag Filter UI ---
    async function filterTasksByTags(tasksArray, filterIdPrefix) {
        const selectedTags = tagFilterState[filterIdPrefix];
        if (!selectedTags.length) return tasksArray;
        return tasksArray.filter(t => t.tags && selectedTags.every(tag => t.tags.includes(tag)));
    }
    function escapeHTML(str) {
        return ('' + str).replace(/[&<>"']/g, function (m) {
            return ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#39;'
            })[m];
        });
    }

    // --- Table Rendering for Tasks ---
    async function renderTasksTable(tasksArray, container, options) {

        // 1. Build unique values for each column for filtering
        const uniqueValues = {};
        options.columns.forEach(col => {
            if (col.key === 'tags') {
                const tagsSet = new Set();
                tasksArray.forEach(t => {
                    if (Array.isArray(t.tags) && t.tags.length) {
                        t.tags.forEach(tag => tagsSet.add(tag));
                    } else {
                        tagsSet.add('');
                    }
                });
                uniqueValues.tags = Array.from(tagsSet).sort();
            } else {
                const vals = new Set();
                tasksArray.forEach(t => {
                    vals.add(t[col.key] || '');
                });
                uniqueValues[col.key] = Array.from(vals).sort();
            }
        });

        // 2. Apply filters
        let filtered = tasksArray.filter(t => {
            return options.columns.every(col => {
                const filterSet = columnFilters[col.key];
                if (!filterSet || filterSet.size === 0) return true;
                if (col.key === 'tags') {
                    if (!Array.isArray(t.tags) || t.tags.length === 0) {
                        return filterSet.has('');
                    }
                    return Array.from(filterSet).some(tag => t.tags.includes(tag));
                } else {
                    return filterSet.has(t[col.key] || '');
                }
            });
        });

        // 3. Sorting
        if (options.sortKey) {
            // Special case for user full name sorting
            if (options.sortKey === 'user') {
                const users = await getUsers();
                filtered.sort((a, b) => {
                    let valA = users[a.user]
                        ? `${users[a.user].surname}, ${users[a.user].firstname} ${users[a.user].middlename}`.toLowerCase()
                        : (a.user || '');
                    let valB = users[b.user]
                        ? `${users[b.user].surname}, ${users[b.user].firstname} ${users[b.user].middlename}`.toLowerCase()
                        : (b.user || '');
                    if (valA < valB) return options.sortAsc ? -1 : 1;
                    if (valA > valB) return options.sortAsc ? 1 : -1;
                    return 0;
                });
            } else {
                filtered.sort((a, b) => {
                    let valA = a[options.sortKey] || '';
                    let valB = b[options.sortKey] || '';
                    if (options.sortKey === 'tags') {
                        valA = (a.tags || []).join(', ');
                        valB = (b.tags || []).join(', ');
                    }
                    if (typeof valA === 'string') valA = valA.toLowerCase();
                    if (typeof valB === 'string') valB = valB.toLowerCase();
                    if (valA < valB) return options.sortAsc ? -1 : 1;
                    if (valA > valB) return options.sortAsc ? 1 : -1;
                    return 0;
                });
            }
        }

        // 4. Render table
        let html = `<table class="table table-sm table-bordered align-middle mb-0"><thead><tr>`;

        if (options.showUser) {
            html += `<th>User</th>`;
        }

        // Determine edit mode for this table
        let editMode = false;
        if (container.id === 'today-tasks-list') editMode = window.todayEditMode;
        else if (container.id === 'archive-tasks-list') editMode = window.archiveEditMode;
        else if (container.id === 'mass-editor-tasks-list') editMode = window.massEditorEditMode;

        // Only show Edit column header if edit mode is ON
        if (options.editable && editMode) {
            html += `<th style="width:70px;">Select</th>`;
        }

        options.columns.forEach(col => {
            // Always show both arrows: sort arrow (▲/▼) and filter arrow (▼)
            let sortArrow = '▲'; // Default sort arrow (you can style it later)
            if (options.sortKey === col.key) {
                sortArrow = options.sortAsc ? '▲' : '▼';
            }
            html += `<th style="position:relative;">
        <span class="sort-btn" data-sort="${col.key}" style="cursor:pointer; user-select:none;">
            ${col.label}
            <span class="sort-arrow" style="margin-left:4px;">${sortArrow}</span>
        </span>
        <span class="filter-icon ms-1" data-col="${col.key}" style="cursor:pointer; margin-left:6px;">&#x25BC;</span>
        <div class="dropdown-menu p-2" data-dropdown="${col.key}"></div>
    </th>`;
        });

        html += `</tr></thead><tbody>`;

        const users = options.showUser ? await getUsers() : {};
        let origins = [];
        if (options.editable && editMode && options.columns.some(col => col.key === 'origin')) {
            origins = (await getOrigins()).filter(o => !o.archived);
        }

        for (let idx = 0; idx < filtered.length; idx++) {
            const task = filtered[idx];
            html += `<tr data-row="${idx}">`;

            if (options.showUser) {
                let userCell = task.user || '';
                if (users[task.user]) {
                    userCell = `${escapeHTML(users[task.user].surname)}, ${escapeHTML(users[task.user].firstname)} ${escapeHTML(users[task.user].middlename)}`;
                }
                html += `<td>${userCell}</td>`;
            }

            if (options.editable && editMode) {
                html += `<td>
            <input type="checkbox" class="row-select-checkbox" data-row="${idx}" style="margin-right:8px;">
            <button class="btn btn-sm btn-outline-danger delete-btn" data-row="${idx}">Delete</button>
        </td>`;
            }

            for (const col of options.columns) {
                if (options.editable && editMode) {
                    if (col.key === 'origin') {
                        html += `<td><select class="form-select form-select-sm task-edit-input" data-col="origin" data-row="${idx}">`;
                        origins.forEach(origin => {
                            const selected = (origin.value === task.origin) ? 'selected' : '';
                            html += `<option value="${escapeHTML(origin.value)}" ${selected}>${escapeHTML(origin.value)}</option>`;
                        });
                        html += `</select></td>`;
                    } else if (col.key === 'activity' || col.key === 'remarks' || col.key === 'date') {
                        html += `<td><input type="text" class="form-control form-control-sm task-edit-input" data-col="${col.key}" data-row="${idx}" value="${escapeHTML(task[col.key] || '')}"></td>`;
                    } else if (col.key === 'tags') {
                        html += `<td><input type="text" class="form-control form-control-sm task-edit-input" data-col="tags" data-row="${idx}" value="${(task.tags || []).map(escapeHTML).join(', ')}"></td>`;
                    } else {
                        html += `<td>${escapeHTML(task[col.key] || '')}</td>`;
                    }
                } else {
                    if (col.key === 'tags') {
                        html += `<td>${(task.tags || []).map(escapeHTML).join(', ')}</td>`;
                    } else if (col.key === 'date') {
                        html += `<td>${escapeHTML(formatDateYMD(task[col.key]) || '')}</td>`;
                    } else {
                        html += `<td>${escapeHTML(task[col.key] || '')}</td>`;
                    }
                }
            }

            html += `</tr>`;
        }
        html += '</tbody></table>';
        container.innerHTML = html;


        // Inline editing for editable fields in edit mode
        // Inline editing for editable fields in edit mode
        if (options.editable && editMode) {
            container.querySelectorAll('.task-edit-input').forEach(input => {
                input.addEventListener('change', async function () {
                    const rowIdx = parseInt(this.getAttribute('data-row'), 10);
                    const col = this.getAttribute('data-col');
                    let value = this.value;
                    if (col === 'tags') {
                        value = value.split(',').map(t => t.trim()).filter(Boolean);
                    }
                    // Find the correct pending array
                    let pendingArr = null;
                    if (container.id === 'today-tasks-list' && todayEditMode && window.todayEditPending) {
                        pendingArr = window.todayEditPending;
                    } else if (container.id === 'archive-tasks-list' && archiveEditMode && window.archiveEditPending) {
                        pendingArr = window.archiveEditPending;
                    } else if (container.id === 'mass-editor-tasks-list' && massEditorEditMode && window.massEditorEditPending) {
                        pendingArr = window.massEditorEditPending;
                    }
                    if (pendingArr) {
                        // Find the task in pendingArr that matches the filtered[rowIdx]
                        const filteredTask = filtered[rowIdx];
                        const task = pendingArr.find(t => t.id === filteredTask.id);
                        if (task) {
                            task[col] = value;
                        }
                    }
                });
            });
        }

        // 5. Sorting events
        container.querySelectorAll('.sort-btn').forEach(btn => {
            btn.onclick = async function (e) {
                e.preventDefault();
                const key = this.getAttribute('data-sort');
                if (container.id === 'today-tasks-list') {
                    if (todaySortKey === key) todaySortAsc = !todaySortAsc;
                    else { todaySortKey = key; todaySortAsc = true; }
                    rerenderTodayTable();
                } else if (container.id === 'archive-tasks-list') {
                    if (archiveSortKey === key) archiveSortAsc = !archiveSortAsc;
                    else { archiveSortKey = key; archiveSortAsc = true; }
                    rerenderArchiveTable();
                } else if (container.id === 'mass-editor-tasks-list') {
                    if (massSortKey === key) massSortAsc = !massSortAsc;
                    else { massSortKey = key; massSortAsc = true; }
                    rerenderMassEditorTable();
                } else if (container.id === 'users-tasks-table-container') {
                    if (viewSortKey === key) viewSortAsc = !viewSortAsc;
                    else { viewSortKey = key; viewSortAsc = true; }
                    rerenderViewTasksTable();
                }
            };
        });

        // 6. Edit/Delete events
        if (options.editable) {
            container.querySelectorAll('.delete-btn').forEach((btn, i) => {
                btn.onclick = () => options.onDelete(filtered[i], i, filtered);
            });
        }

        container.querySelectorAll('.row-select-checkbox').forEach(cb => {
            cb.onchange = async function () {
                const rowIdx = parseInt(this.getAttribute('data-row'), 10);
                if (container.id === 'today-tasks-list') {
                    if (this.checked) window.todaySelectedTasks.add(rowIdx);
                    else window.todaySelectedTasks.delete(rowIdx);
                } else if (container.id === 'archive-tasks-list') {
                    if (this.checked) window.archiveSelectedTasks.add(rowIdx);
                    else window.archiveSelectedTasks.delete(rowIdx);
                } else if (container.id === 'mass-editor-tasks-list') {
                    if (this.checked) window.massEditorSelectedTasks.add(rowIdx);
                    else window.massEditorSelectedTasks.delete(rowIdx);
                }
            };
        });

        // 7. Filter dropdowns (Bootstrap style, togglable, filter on button)
        container.querySelectorAll('.filter-icon').forEach(icon => {
            icon.onclick = async function (e) {
                e.stopPropagation();
                const colKey = this.getAttribute('data-col');
                const dropdown = container.querySelector(`.dropdown-menu[data-dropdown="${colKey}"]`);
                if (!dropdown) return;

                // Toggle dropdown
                const isShown = dropdown.classList.contains('show');
                container.querySelectorAll('.dropdown-menu').forEach(d => {
                    d.classList.remove('show');
                    d.style.display = 'none';
                });
                if (isShown) {
                    dropdown.classList.remove('show');
                    dropdown.style.display = 'none';
                    return;
                }

                // Build dropdown content
                let values = [];
                if (colKey === 'user' && options.showUser) {
                    values = Array.from(new Set(tasksArray.map(t => t.user || ''))).sort();
                } else if (colKey === 'tags') {
                    values = uniqueValues.tags;
                } else {
                    values = uniqueValues[colKey] || [];
                }
                const tempSet = new Set(columnFilters[colKey] ? Array.from(columnFilters[colKey]) : []);
                dropdown.innerHTML = ` 
            ${values.map(val => {
                    const checked = tempSet.has(val) ? 'checked' : '';
                    const label = val === '' ? '<em>[blank]</em>' : escapeHTML(val);
                    return `<label style="display:block;white-space:nowrap;"><input type="checkbox" value="${escapeHTML(val)}" ${checked}> ${label}</label>`;
                }).join('')}
            <div class="mt-2 d-flex gap-2">
                <button type="button" class="btn btn-sm btn-primary" id="apply-filter-${colKey}">Filter</button>
                <button type="button" class="btn btn-sm btn-secondary" id="clear-filter-${colKey}">Clear</button>
            </div>
        `;

                dropdown.style.display = 'block';
                dropdown.classList.add('show');

                // Hide dropdown on click outside
                document.addEventListener('click', async function hideDropdown(ev) {
                    if (!dropdown.contains(ev.target) && ev.target !== icon) {
                        dropdown.classList.remove('show');
                        dropdown.style.display = 'none';
                        document.removeEventListener('click', hideDropdown);
                    }
                });

                // Checkbox change (update tempSet only)
                dropdown.querySelectorAll('input[type="checkbox"]').forEach(cb => {
                    cb.onchange = async function () {
                        if (this.checked) tempSet.add(this.value);
                        else tempSet.delete(this.value);
                    };
                });

                // Apply filter button
                dropdown.querySelector(`#apply-filter-${colKey}`).onclick = async function () {
                    columnFilters[colKey] = new Set(tempSet);
                    dropdown.classList.remove('show');
                    dropdown.style.display = 'none';
                    if (container.id === 'today-tasks-list') {
                        rerenderTodayTable();
                    } else if (container.id === 'archive-tasks-list') {
                        rerenderArchiveTable();
                    } else if (container.id === 'mass-editor-tasks-list') {
                        rerenderMassEditorTable();
                    } else if (container.id === 'users-tasks-table-container') {
                        rerenderViewTasksTable();
                    }
                };
                // Clear filter button
                dropdown.querySelector(`#clear-filter-${colKey}`).onclick = async function () {
                    tempSet.clear();
                    columnFilters[colKey] = new Set();
                    dropdown.classList.remove('show');
                    dropdown.style.display = 'none';
                    if (container.id === 'today-tasks-list') {
                        rerenderTodayTable();
                    } else if (container.id === 'archive-tasks-list') {
                        rerenderArchiveTable();
                    } else if (container.id === 'mass-editor-tasks-list') {
                        rerenderMassEditorTable();
                    } else if (container.id === 'users-tasks-table-container') {
                        rerenderViewTasksTable();
                    }
                };

                // Sort Ascending
                const sortAscBtn = dropdown.querySelector(`#sort-asc-${colKey}`);
                if (sortAscBtn) {
                    sortAscBtn.onclick = async function () {
                        if (container.id === 'today-tasks-list') {
                            todaySortKey = colKey;
                            todaySortAsc = true;
                            rerenderTodayTable();
                        } else if (container.id === 'archive-tasks-list') {
                            archiveSortKey = colKey;
                            archiveSortAsc = true;
                            rerenderArchiveTable();
                        } else if (container.id === 'mass-editor-tasks-list') {
                            massSortKey = colKey;
                            massSortAsc = true;
                            rerenderMassEditorTable();
                        } else if (container.id === 'users-tasks-table-container') {
                            viewSortKey = colKey;
                            viewSortAsc = true;
                            rerenderViewTasksTable();
                        }
                        dropdown.classList.remove('show');
                        dropdown.style.display = 'none';
                    };
                }
                // Sort Descending
                const sortDescBtn = dropdown.querySelector(`#sort-desc-${colKey}`);
                if (sortDescBtn) {
                    sortDescBtn.onclick = async function () {
                        if (container.id === 'today-tasks-list') {
                            todaySortKey = colKey;
                            todaySortAsc = false;
                            rerenderTodayTable();
                        } else if (container.id === 'archive-tasks-list') {
                            archiveSortKey = colKey;
                            archiveSortAsc = false;
                            rerenderArchiveTable();
                        } else if (container.id === 'mass-editor-tasks-list') {
                            massSortKey = colKey;
                            massSortAsc = false;
                            rerenderMassEditorTable();
                        } else if (container.id === 'users-tasks-table-container') {
                            viewSortKey = colKey;
                            viewSortAsc = false;
                            rerenderViewTasksTable();
                        }
                        dropdown.classList.remove('show');
                        dropdown.style.display = 'none';
                    };
                }
            };
        });

        if (container.id === 'today-tasks-list') window.lastTodayFiltered = filtered;
        if (container.id === 'archive-tasks-list') window.lastArchiveFiltered = filtered;
        if (container.id === 'mass-editor-tasks-list') window.lastMassEditorFiltered = filtered;

    }

    // --- Today Tab Table ---
    async function rerenderTodayTable() {
        const tasks = await getTasks();
        const today = new Date();
        const todayStr = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
        let userTasks;
        if (todayEditMode && window.todayEditPending) {
            userTasks = window.todayEditPending.filter(t => t.date === todayStr);
        } else {
            userTasks = ((tasks[currentUser] && tasks[currentUser].today) || []).filter(t => t.date === todayStr);
        }
        console.log('All today tasks:', (tasks[currentUser] && tasks[currentUser].today) || []);
        console.log('todayStr:', todayStr);
        console.log('userTasks for today:', userTasks);
        renderTasksTable(userTasks, document.getElementById('today-tasks-list'), {
            editable: true,
            columns: [
                { key: 'origin', label: 'Origin', sortable: true },
                { key: 'activity', label: 'Activity', sortable: true },
                { key: 'remarks', label: 'Remarks', sortable: true },
                { key: 'date', label: 'Date', sortable: true },
                { key: 'tags', label: 'Tags', sortable: false }
            ],
            sortKey: todaySortKey,
            sortAsc: todaySortAsc,
            onEdit: (task, idx) => showEditModal(task, idx, 'today'),
            onDelete: async (task, idx, filtered) => {
                if (await showConfirmModal('Delete this task?')) {
                    let arr;
                    if (todayEditMode && window.todayEditPending) {
                        arr = window.todayEditPending;
                    } else {
                        const tasks = await getTasks();
                        arr = (tasks[currentUser] && tasks[currentUser].today) || [];
                    }
                    const toDelete = filtered[idx];
                    const delIdx = arr.findIndex(t => t.id === toDelete.id);
                    if (delIdx > -1) arr.splice(delIdx, 1);
                    if (!todayEditMode) {
                        const tasks = await getTasks();
                        tasks[currentUser].today = arr;
                        await saveTasks(tasks);
                    }
                    rerenderTodayTable();
                }
            }
        });
    }

    // --- Archive Tab Table ---
    async function rerenderArchiveTable() {
        const tasks = await getTasks();
        const dateStr = document.getElementById('archive-date-display').textContent;
        let arr;
        if (archiveEditMode && window.archiveEditPending) {
            arr = window.archiveEditPending;
        } else {
            arr = [];
            if (tasks[currentUser] && tasks[currentUser].archive && tasks[currentUser].archive[dateStr]) {
                arr = tasks[currentUser].archive[dateStr].filter(t => t && typeof t === "object");
            }
        }
        const todayObj = new Date();
        const todayStr = todayObj.getFullYear() + "-" +
            String(todayObj.getMonth() + 1).padStart(2, "0") + "-" +
            String(todayObj.getDate()).padStart(2, "0");
        if (dateStr === todayStr && tasks[currentUser] && tasks[currentUser].today) {
            arr = arr.concat(tasks[currentUser].today.filter(t => t.date === todayStr));
        }
        renderTasksTable(arr, document.getElementById('archive-tasks-list'), {
            editable: true,
            columns: [
                { key: 'origin', label: 'Origin', sortable: true },
                { key: 'activity', label: 'Activity', sortable: true },
                { key: 'remarks', label: 'Remarks', sortable: true },
                { key: 'date', label: 'Date', sortable: true },
                { key: 'tags', label: 'Tags', sortable: false }
            ],
            sortKey: archiveSortKey,
            sortAsc: archiveSortAsc,
            onEdit: (task, idx) => showEditModal(task, idx, 'archive'),
            onDelete: async (task, idx, filtered) => {
                if (await showConfirmModal('Delete this task?')) {
                    let arr;
                    if (archiveEditMode && window.archiveEditPending) {
                        arr = window.archiveEditPending;
                    } else {
                        arr = [];
                        if (tasks[currentUser] && tasks[currentUser].archive && tasks[currentUser].archive[dateStr]) {
                            arr = tasks[currentUser].archive[dateStr].filter(t => t && typeof t === "object");
                        }
                    }
                    const toDelete = filtered[idx];
                    const delIdx = arr.findIndex(t =>
                        t.origin === toDelete.origin &&
                        t.activity === toDelete.activity &&
                        t.remarks === toDelete.remarks &&
                        t.date === toDelete.date &&
                        JSON.stringify(t.tags) === JSON.stringify(toDelete.tags)
                    );
                    if (delIdx > -1) arr.splice(delIdx, 1);
                    if (!archiveEditMode) {
                        tasks[currentUser].archive[dateStr] = arr;
                        await saveTasks(tasks);
                    }
                    rerenderArchiveTable();
                }
            }
        });
    }

    // --- Mass Editor Table ---
    async function rerenderMassEditorTable() {
        let filtered;
        if (massEditorEditMode && window.massEditorEditPending) {
            // Apply the same filter logic as in applyMassEditorFilter, but to the pending array
            const filter = massEditorFilter;
            filtered = window.massEditorEditPending.filter(t => {
                if (!filter || !filter.type || filter.type === "all") return true;
                if (filter.type === "month" && filter.value) {
                    return t.date && t.date.startsWith(filter.value);
                } else if (filter.type === "week" && filter.value) {
                    const [year, week] = filter.value.split("-W");
                    if (year && week) {
                        const firstDay = new Date(year, 0, 1 + (week - 1) * 7);
                        const day = firstDay.getDay();
                        const monday = new Date(firstDay);
                        if (day !== 1) {
                            monday.setDate(firstDay.getDate() - ((day + 6) % 7));
                        }
                        const sunday = new Date(monday);
                        sunday.setDate(monday.getDate() + 6);
                        const startStr = monday.toISOString().slice(0, 10);
                        const endStr = sunday.toISOString().slice(0, 10);
                        return t.date >= startStr && t.date <= endStr;
                    }
                    return true;
                } else if (filter.type === "range" && Array.isArray(filter.value) && filter.value.length) {
                    return filter.value.includes(t.date);
                } else if (filter.type === "daterange" && Array.isArray(filter.value) && filter.value.length === 2) {
                    const [start, end] = filter.value;
                    if (start && end) {
                        return t.date >= start && t.date <= end;
                    }
                    return true;
                }
                return true;
            }).map(t => ({ ...t }));
        } else {
            filtered = massEditorFilteredTasks.map(t => ({ ...t }));
        }
        renderTasksTable(filtered, document.getElementById('mass-editor-tasks-list'), {
            editable: true,
            columns: [
                { key: 'origin', label: 'Origin', sortable: true },
                { key: 'activity', label: 'Activity', sortable: true },
                { key: 'remarks', label: 'Remarks', sortable: true },
                { key: 'date', label: 'Date', sortable: true },
                { key: 'tags', label: 'Tags', sortable: false }
            ],
            sortKey: massSortKey,
            sortAsc: massSortAsc,
            onEdit: (task, idx) => showEditModal(task, idx, 'mass'),
            onDelete: async (task, idx, filtered) => {
                if (await showConfirmModal('Delete this task?')) {
                    let arr;
                    if (massEditorEditMode && window.massEditorEditPending) {
                        arr = window.massEditorEditPending;
                    } else {
                        arr = massEditorFilteredTasks;
                    }
                    const toDelete = filtered[idx];
                    const delIdx = arr.findIndex(t =>
                        t.origin === toDelete.origin &&
                        t.activity === toDelete.activity &&
                        t.remarks === toDelete.remarks &&
                        t.date === toDelete.date &&
                        JSON.stringify(t.tags) === JSON.stringify(toDelete.tags)
                    );
                    if (delIdx > -1) arr.splice(delIdx, 1);
                    rerenderMassEditorTable();
                }
            },
            filterIdPrefix: 'mass'
        });
    }

    // --- View Tasks Table ---
    async function rerenderViewTasksTable() {
        const users = await getUsers();
        const tasks = await getTasks();
        const dateStr = document.getElementById('view-tasks-date').value;
        let allRows = [];
        Object.keys(users).forEach(username => {
            let userTasks = [];
            if (tasks[username]) {
                if (tasks[username].archive && tasks[username].archive[dateStr]) {
                    userTasks = userTasks.concat(tasks[username].archive[dateStr]);
                }
                // Include today's tasks if the selected date is today
                const todayObj = new Date();
                const todayStr = todayObj.getFullYear() + "-" +
                    String(todayObj.getMonth() + 1).padStart(2, "0") + "-" +
                    String(todayObj.getDate()).padStart(2, "0");
                if (dateStr === todayStr && tasks[username].today) {
                    userTasks = userTasks.concat(tasks[username].today.filter(t => t.date === todayStr));
                }
            }
            userTasks.forEach(t => allRows.push({ ...t, user: username }));
        });
        renderTasksTable(allRows, document.getElementById('users-tasks-table-container'), {
            editable: false,
            columns: [
                { key: 'origin', label: 'Origin', sortable: true },
                { key: 'activity', label: 'Activity', sortable: true },
                { key: 'remarks', label: 'Remarks', sortable: true },
                { key: 'date', label: 'Date', sortable: true },
                { key: 'tags', label: 'Tags', sortable: false }
            ],
            sortKey: viewSortKey,
            sortAsc: viewSortAsc,
            filterIdPrefix: 'view',
            showUser: true
        });
    }

    // --- Edit Modal ---
    async function showEditModal(task, idx, tab) {
        const origin = await showPromptModal('Origin:', task.origin);
        if (origin === null) return;
        const activity = await showPromptModal('Activity:', task.activity);
        if (activity === null) return;
        const remarks = await showPromptModal('Remarks:', task.remarks || '');
        if (remarks === null) return;
        const date = await showPromptModal('Date (yyyy-mm-dd):', task.date);
        if (date === null) return;
        const tags = await showPromptModal('Tags (comma separated):', (task.tags || []).join(','));
        if (tags === null) return;
        if (tab === 'today') {
            const tasks = await getTasks();
            const today = new Date();
            const todayStr = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
            let userTasks = (tasks[currentUser] && tasks[currentUser].today) || [];
            userTasks = userTasks.filter(t => t.date === todayStr);
            Object.assign(userTasks[idx], {
                origin, activity, remarks, date, tags: tags.split(',').map(t => t.trim()).filter(Boolean)
            });
            await saveTasks(tasks);
            rerenderTodayTable();
        } else if (tab === 'archive') {
            const tasks = await getTasks();
            const dateStr = document.getElementById('archive-date-display').textContent;
            let arr = tasks[currentUser].archive[dateStr] || [];
            const task = arr[idx];
            Object.assign(arr.find(t => t.id === task.id), {
                origin, activity, remarks, date, tags: tags.split(',').map(t => t.trim()).filter(Boolean)
            });
            await saveTasks(tasks);
            rerenderArchiveTable();
        } else if (tab === 'mass') {
            updateMassEditorTask(idx, {
                origin, activity, remarks, date, tags: tags.split(',').map(t => t.trim()).filter(Boolean)
            });
        }
    }

    massEditorDeleteSelectedBtn.addEventListener("click", async () => {
        if (massEditorSelectedTasks.size === 0) {
            await showAlertModal("No tasks selected.");
            return;
        }
        const confirmed = await showConfirmModal("Are you sure you want to delete the selected tasks?");
        if (!confirmed) return;

        // Get the filtered array as shown in the table
        let filtered = [];
        const table = document.getElementById('mass-editor-tasks-list');
        table.querySelectorAll('tr[data-row]').forEach((row, idx) => {
            filtered.push(window.lastMassEditorFiltered[idx]);
        });

        let arr;
        if (massEditorEditMode && window.massEditorEditPending) {
            arr = window.massEditorEditPending;
        } else {
            arr = massEditorFilteredTasks;
        }

        // Remove by matching fields, highest to lowest index
        const idxs = Array.from(massEditorSelectedTasks).sort((a, b) => b - a);
        idxs.forEach(idx => {
            const toDelete = filtered[idx];
            const delIdx = arr.findIndex(t =>
                t.origin === toDelete.origin &&
                t.activity === toDelete.activity &&
                t.remarks === toDelete.remarks &&
                t.date === toDelete.date &&
                JSON.stringify(t.tags) === JSON.stringify(toDelete.tags)
            );
            if (delIdx > -1) arr.splice(delIdx, 1);
        });

        showGlobalSpinner("Deleting tasks...");
        massEditorSelectedTasks.clear();
        rerenderMassEditorTable();
        finishWithToast("Tasks deleted!");
    });

    // --- Patch: Add tags to mass editor update ---
    const origUpdateMassEditorTask = window.updateMassEditorTask;
    window.updateMassEditorTask = async function (idx, changes) {
        if (changes.tags && typeof changes.tags === 'string') {
            changes.tags = changes.tags.split(',').map(t => t.trim()).filter(Boolean);
        }
        origUpdateMassEditorTask(idx, changes);
    };

    // --- Replace all renderings with table-based ---
    window.loadTodayTasks = rerenderTodayTable;
    window.loadArchiveDate = rerenderArchiveTable;
    window.applyMassEditorFilter = applyMassEditorFilter;
    window.loadUsersTasksForDate = rerenderViewTasksTable;
    // --- On page load, setup ---
    document.addEventListener('DOMContentLoaded', async function () {
        rerenderTodayTable();
        rerenderArchiveTable();
        rerenderMassEditorTable();
        rerenderViewTasksTable();
    });
    // Also run after login
    const origAfterLoginSetup = window.afterLoginSetup;
    window.afterLoginSetup = async function () {
        origAfterLoginSetup();
        rerenderTodayTable();
        rerenderArchiveTable();
        rerenderMassEditorTable();
        rerenderViewTasksTable();
    };
})();