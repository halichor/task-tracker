(() => {
    // Data keys and current user var
    const LS_USERS_KEY = "tm_users";
    const LS_TASKS_KEY = "tm_tasks";
    const LS_ORIGINS_KEY = "tm_origins";
    const SESSION_USER_KEY = "tm_currentUser";
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
    const archiveDateDisplay = document.getElementById("archive-date-display");
    const archiveTasksList = document.getElementById("archive-tasks-list");

    // --- Helpers ---
    function getUsers() {
        let users = JSON.parse(localStorage.getItem(LS_USERS_KEY));
        if (!users) {
            users = { admin: { password: "adminpass" } };
            localStorage.setItem(LS_USERS_KEY, JSON.stringify(users));
        }
        return users;
    }
    function saveUsers(users) {
        localStorage.setItem(LS_USERS_KEY, JSON.stringify(users));
    }
    function getTasks() {
        return JSON.parse(localStorage.getItem(LS_TASKS_KEY)) || {};
    }
    function saveTasks(tasks) {
        localStorage.setItem(LS_TASKS_KEY, JSON.stringify(tasks));
    }
    const LS_HOLIDAYS_KEY = "tm_holidays";
    function getHolidays() {
        return JSON.parse(localStorage.getItem(LS_HOLIDAYS_KEY)) || [];
    }
    function saveHolidays(holidays) {
        localStorage.setItem(LS_HOLIDAYS_KEY, JSON.stringify(holidays));
    }
    function renderHolidaysList() {
        const holidays = getHolidays();
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
            li.textContent = `${h.name} (${h.date})${h.repeat ? " [Repeats]" : ""}`;
            const delBtn = document.createElement('button');
            delBtn.className = "btn btn-sm btn-danger";
            delBtn.textContent = "Delete";
            delBtn.onclick = () => {
                const arr = getHolidays();
                arr.splice(idx, 1);
                saveHolidays(arr);
                renderHolidaysList();
            };
            li.appendChild(delBtn);
            ul.appendChild(li);
        });
        listDiv.innerHTML = "";
        listDiv.appendChild(ul);
    }

    function ensureAllUsersTaskStructure() {
        const users = getUsers();
        const tasks = getTasks();
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
        if (changed) saveTasks(tasks);
    }

    // --- Origins Management ---
    function getOrigins() {
        return JSON.parse(localStorage.getItem(LS_ORIGINS_KEY)) || [];
    }
    function saveOrigins(origins) {
        localStorage.setItem(LS_ORIGINS_KEY, JSON.stringify(origins));
    }
    function renderOriginsAdmin() {
        const container = document.getElementById("origins-admin-list");
        const origins = getOrigins();
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
            input.addEventListener("change", () => {
                const oldValue = origin.value;
                const newValue = input.value.trim();
                if (!newValue) return;
                // Update all tasks globally
                const tasks = getTasks();
                Object.values(tasks).forEach(user => {
                    user.today?.forEach(t => { if (t.origin === oldValue) t.origin = newValue; });
                    Object.values(user.archive || {}).forEach(arr => arr.forEach(t => { if (t.origin === oldValue) t.origin = newValue; }));
                });
                saveTasks(tasks);
                // Update origin
                origins[idx].value = newValue;
                saveOrigins(origins);
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
            btn.addEventListener("click", () => {
                origins[idx].archived = !origins[idx].archived;
                saveOrigins(origins);
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
        const origins = getOrigins();
        if (origins.some(o => o.value === value)) {
            await showAlertModal("Origin already exists.");
            return;
        }
        origins.push({ value, archived: false });
        saveOrigins(origins);
        input.value = "";
        renderOriginsAdmin();
        populateOriginDropdown();
    });
    function setupOriginsAdminTab() {
        const isAdmin = currentUser === "admin";
        document.getElementById("origins-admin-section").style.display = isAdmin ? "" : "none";
        if (isAdmin) renderOriginsAdmin();
    }
    function populateOriginDropdown() {
        const select = document.getElementById("task-origin-input");
        select.innerHTML = "";
        getOrigins().filter(o => !o.archived).forEach(origin => {
            const opt = document.createElement("option");
            opt.value = origin.value;
            opt.textContent = origin.value;
            select.appendChild(opt);
        });
    }

    // --- Login ---
    function validateLogin(username, password) {
        const users = getUsers();
        return users[username] && users[username].password === password;
    }
    function afterLoginSetup() {
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
    function clearLoginInputs() {
        document.getElementById("login-username").value = "";
        document.getElementById("login-password").value = "";
        loginError.textContent = "";
    }
    function clearSettingsInputs() {
        newUsernameInput.value = "";
        newPasswordInput.value = "";
    }
    function clearTasksDisplay() {
        todayTasksList.innerHTML = "";
        archiveTasksList.innerHTML = "";
        const usersTasksTable = document.getElementById("users-tasks-table-container");
        if (usersTasksTable) usersTasksTable.innerHTML = "";
    }
    function clearAdminUserList() {
        userListUl.innerHTML = "";
    }
    // --- Admin Tab setup ---
    function setupAdminTab() {
        const isAdmin = currentUser === "admin";
        // Only show User Management in settings for admin
        const userMgmtLi = document.getElementById('sidebar-user-mgmt-li');
        const adminUserMgmt = document.getElementById('admin-user-mgmt');
        if (userMgmtLi) userMgmtLi.style.display = isAdmin ? "" : "none";
        if (adminUserMgmt) adminUserMgmt.style.display = isAdmin ? "" : "none";
        if (isAdmin) loadAdminUserList();
    }
    function loadAdminUserList() {
        const users = getUsers();
        userListUl.innerHTML = "";
        Object.keys(users).forEach(username => {
            if (username === "admin") return; // Don't show admin in the list
            const li = document.createElement("li");
            li.className = "list-group-item d-flex justify-content-between align-items-center";
            li.textContent = username;
            const delBtn = document.createElement("button");
            delBtn.className = "btn btn-sm btn-danger";
            delBtn.textContent = "Delete";
            delBtn.onclick = async () => {
                if (await showConfirmModal(`Delete user "${username}"? This cannot be undone.`)) {
                    const users = getUsers();
                    const tasks = getTasks();
                    delete users[username];
                    delete tasks[username];
                    saveUsers(users);
                    saveTasks(tasks);
                    ensureAllUsersTaskStructure();
                    loadAdminUserList();
                }
            };
            li.appendChild(delBtn);
            userListUl.appendChild(li);
        });
    }
    adminCreateUserBtn && adminCreateUserBtn.addEventListener("click", async () => {
        const username = adminNewUsername.value.trim();
        const password = adminNewPassword.value;
        if (!username || !password) {
            await showAlertModal("Please enter a username and password.");
            return;
        }
        if (users[username]) {
            await showAlertModal("User already exists.");
            return;
        }
        users[username] = { password };
        saveUsers(users);
        ensureAllUsersTaskStructure();
        adminNewUsername.value = "";
        adminNewPassword.value = "";
        loadAdminUserList();
    });

    // --- Tasks functions ---
    function addTaskToDate(taskObj, taskDate) {
        if (!taskObj || !taskObj.origin || !taskObj.activity || !taskDate) return;
        const tasks = getTasks();
        if (!tasks[currentUser]) tasks[currentUser] = { today: [], archive: {} };
        const today = new Date();
        const todayStr = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
        const newTask = {
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
        saveTasks(tasks);
    }
    addTaskBtn.addEventListener("click", () => {
        const origin = document.getElementById("task-origin-input").value;
        const activity = document.getElementById("task-activity-input").value.trim();
        const remarks = document.getElementById("task-remarks-input").value.trim();
        let taskDate = document.getElementById("task-date-input").value;
        if (!taskDate) {
            // Default to today if blank
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
        addTaskToDate({ origin, activity, remarks, tags }, taskDate);
        document.getElementById("task-activity-input").value = "";
        document.getElementById("task-remarks-input").value = "";
        $('#task-date-input').datepicker('setDate', new Date());
        loadTodayTasks();
    });
    function loadTodayTasks() {
        if (typeof rerenderTodayTable === "function") {
            rerenderTodayTable();
        }
    }
    function loadArchiveDate(date) {
        if (typeof rerenderArchiveTable === "function") {
            rerenderArchiveTable();
        }
    }
    function applyMassEditorFilter() {
        const tasks = getTasks();
        const user = tasks[massEditorCurrentUser];
        let allTasks = [];
        if (user && user.today) allTasks = allTasks.concat(user.today.map(t => ({ ...t })));
        if (user && user.archive) {
            Object.values(user.archive).forEach(arr => {
                allTasks = allTasks.concat(arr.map(t => ({ ...t })));
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
    function loadUsersTasksForDate() {
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
        const tasks = getTasks();
        if (!todayEditMode) {
            todayEditMode = true;
            window.todayEditOriginal = JSON.parse(JSON.stringify(getTasks()[currentUser].today));
            window.todayEditPending = JSON.parse(JSON.stringify(getTasks()[currentUser].today));
            todayEditBtn.querySelector("#today-edit-btn-label").textContent = "DONE";
            todayDeleteSelectedBtn.style.display = "";
            todaySelectedTasks.clear();
            rerenderTodayTable();
        } else {
            const confirmed = await showConfirmModal("Save all changes to today's tasks?");
            if (confirmed) {
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
                saveTasks(tasks);
            } else {
                tasks[currentUser].today = window.todayEditOriginal;
                saveTasks(tasks);
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
            const tasks = getTasks();
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
            const tasks = getTasks();
            tasks[currentUser].today = arr;
            saveTasks(tasks);
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
        const tasks = getTasks();
        const dateStr = document.getElementById('archive-date-display').textContent;
        if (!archiveEditMode) {
            archiveEditMode = true;
            window.archiveEditOriginal = JSON.parse(JSON.stringify(getTasks()[currentUser].archive[dateStr] || []));
            window.archiveEditPending = JSON.parse(JSON.stringify(getTasks()[currentUser].archive[dateStr] || []));
            archiveEditBtn.querySelector("#archive-edit-btn-label").textContent = "DONE";
            archiveDeleteSelectedBtn.style.display = "";
            archiveSelectedTasks.clear();
            rerenderArchiveTable();
        } else {
            const confirmed = await showConfirmModal("Save all changes to this day's archive?");
            if (confirmed) {
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
                saveTasks(tasks);
            } else {
                tasks[currentUser].archive[dateStr] = window.archiveEditOriginal;
                saveTasks(tasks);
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

        const tasks = getTasks();
        const dateStr = document.getElementById('archive-date-display').textContent;
        let arr;
        if (archiveEditMode && window.archiveEditPending) {
            arr = window.archiveEditPending;
        } else {
            arr = (tasks[currentUser].archive[dateStr] || []).filter(t => t && typeof t === "object");
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
            tasks[currentUser].archive[dateStr] = arr;
            saveTasks(tasks);
        }
        archiveSelectedTasks.clear();
        rerenderArchiveTable();
    });
    // --- On page load, check session ---
    function init() {
        const savedUser = sessionStorage.getItem(SESSION_USER_KEY);
        if (savedUser && getUsers()[savedUser]) {
            currentUser = savedUser;
            afterLoginSetup();
        } else {
            authDiv.style.display = "block";
            appDiv.style.display = "none";
        }
        //Initialize task list
        document.getElementById('today-tab').addEventListener('shown.bs.tab', function () {
            // Always set the date input to today when switching to Today tab
            const today = new Date();
            const todayStr = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
            $('#task-date-input').datepicker('setDate', todayStr);
            document.getElementById("task-date-input").value = todayStr;
            loadTodayTasks();
        });
        document.getElementById('archive-tab').addEventListener('shown.bs.tab', function () {
            loadArchiveDate(document.getElementById('archive-date-display').textContent);
        });
        document.getElementById('view-users-tab').addEventListener('shown.bs.tab', function () {
            loadUsersTasksForDate();
        });
        document.getElementById('settings-tab').addEventListener('shown.bs.tab', function () {
            setupOriginsAdminTab();
        });
        document.getElementById('sidebar-mass-editor-btn').addEventListener('shown.bs.tab', function () {
            setupMassEditorTab();
        });
    }
    init();

    // --- Datepicker and holiday setup ---
    $(document).ready(function () {
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
        }).on('changeDate', function (e) {
            const date = e.format('yyyy-mm-dd');
            document.getElementById('archive-date-display').textContent = date;
            loadArchiveDate(new Date(date));
        });
        // VIEW TASKS datepicker
        $('#view-tasks-date-group').datepicker({
            format: 'yyyy-mm-dd',
            todayHighlight: true,
            autoclose: true,
            orientation: "bottom auto"
        }).on('changeDate', function (e) {
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
        document.getElementById('archive-date-display').textContent = todayArchiveStr;
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
        const holidays = getHolidays();
        holidays.push({ date, name, repeat });
        saveHolidays(holidays);
        renderHolidaysList();
        document.getElementById('holiday-name').value = "";
        document.getElementById('holiday-repeat').checked = false;
    });

    // --- Helper for Holidays ---
    function getHolidayForDate(dateStr) {
        const holidays = getHolidays();
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
    function showConfirmModal(message) {
        return new Promise((resolve) => {
            const modal = new bootstrap.Modal(document.getElementById('confirmModal'));
            document.getElementById('confirmModalBody').textContent = message;
            const okBtn = document.getElementById('confirmModalOk');
            const cancelBtn = document.getElementById('confirmModalCancel');
            function cleanup(result) {
                okBtn.removeEventListener('click', onOk);
                cancelBtn.removeEventListener('click', onCancel);
                document.getElementById('confirmModal').removeEventListener('hidden.bs.modal', onCancel);
                resolve(result);
            }
            function onOk() {
                modal.hide();
                cleanup(true);
            }
            function onCancel() {
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

    function setupMassEditorTab() {
        const isAdmin = currentUser === "admin";
        const userSelectContainer = document.getElementById("mass-editor-user-select-container");
        const userSelect = document.getElementById("mass-editor-user-select");
        userSelectContainer.style.display = isAdmin ? "" : "none";
        if (isAdmin) {
            // Populate user select
            userSelect.innerHTML = "";
            Object.keys(getUsers()).forEach(u => {
                const opt = document.createElement("option");
                opt.value = u;
                opt.textContent = u;
                userSelect.appendChild(opt);
            });
            // Default to first user if not set
            if (!massEditorCurrentUser || !getUsers()[massEditorCurrentUser]) {
                massEditorCurrentUser = userSelect.options[0].value;
            }
            userSelect.value = massEditorCurrentUser;
            userSelect.onchange = () => {
                massEditorCurrentUser = userSelect.value;
                applyMassEditorFilter();
            };
        } else {
            massEditorCurrentUser = currentUser;
        }
        applyMassEditorFilter();
    }

    function updateMassEditorTask(idx, changes) {
        const tasks = getTasks();
        const user = tasks[massEditorCurrentUser];
        let task = massEditorFilteredTasks[idx];
        // Find and update in correct array
        let found = false;
        if (user.today) {
            let tIdx = user.today.findIndex(t => t.origin === task.origin && t.activity === task.activity && t.remarks === task.remarks && t.date === task.date);
            if (tIdx > -1) {
                Object.assign(user.today[tIdx], changes);
                found = true;
            }
        }
        if (!found && user.archive) {
            Object.keys(user.archive).forEach(date => {
                let arr = user.archive[date];
                let tIdx = arr.findIndex(t => t.origin === task.origin && t.activity === task.activity && t.remarks === task.remarks && t.date === task.date);
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
        saveTasks(tasks);
        applyMassEditorFilter();
    }

    const massEditorEditBtn = document.getElementById("mass-editor-edit-btn");
    const massEditorDeleteSelectedBtn = document.getElementById("mass-editor-delete-selected-btn");
    massEditorEditBtn.addEventListener("click", async () => {
        const tasks = getTasks();
        const user = tasks[massEditorCurrentUser];
        // Gather all tasks for the selected user
        let allTasks = [];
        if (user.today) allTasks = allTasks.concat(user.today.map(t => ({ ...t })));
        if (user.archive) {
            Object.values(user.archive).forEach(arr => {
                allTasks = allTasks.concat(arr.map(t => ({ ...t })));
            });
        }
        if (!massEditorEditMode) {
            massEditorEditMode = true;
            const freshTasks = (() => {
                const user = getTasks()[massEditorCurrentUser];
                let all = [];
                if (user && user.today) all = all.concat(user.today.map(t => ({ ...t })));
                if (user && user.archive) Object.values(user.archive).forEach(arr => all = all.concat(arr.map(t => ({ ...t }))));
                return all;
            })();
            window.massEditorEditOriginal = JSON.parse(JSON.stringify(freshTasks));
            window.massEditorEditPending = JSON.parse(JSON.stringify(freshTasks));
            document.getElementById("mass-editor-edit-btn-label").textContent = "DONE";
            massEditorDeleteSelectedBtn.style.display = massEditorEditMode ? "" : "none";
            massEditorDeleteSelectedBtn.style.display = "";
            massEditorSelectedTasks.clear();
            rerenderMassEditorTable();
        } else {
            const confirmed = await showConfirmModal("Save all changes in mass editor?");
            if (confirmed) {
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
                saveTasks(tasks);
            } else {
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
                saveTasks(tasks);
            }
            applyMassEditorFilter();
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
        const tasks = getTasks();
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
        saveTasks(tasks);
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
    document.getElementById("mass-editor-filter-type").addEventListener("change", function () {
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
        beforeShowDay: function (date) {
            // Get currently selected dates as strings
            var selected = $('#mass-editor-range').datepicker('getDates').map(function (d) {
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
    document.getElementById("mass-editor-apply-filter-btn").addEventListener("click", function () {
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
    function uuidv4() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    // Ensure all users and tasks have unique IDs
    function ensureUserAndTaskIDs() {
        const users = getUsers();
        let changed = false;
        Object.keys(users).forEach(username => {
            if (!users[username].id) {
                users[username].id = uuidv4();
                changed = true;
            }
        });
        if (changed) saveUsers(users);

        const tasks = getTasks();
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
        saveTasks(tasks);
    }

    // Call this after login
    function afterLoginSetupWithIDs() {
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
    function setupBackupTab() {
        const isAdmin = currentUser === "admin";
        document.getElementById("backup-admin-section").style.display = isAdmin ? "" : "none";
    }

    // Show tab logic
    document.getElementById('sidebar-backup-btn').addEventListener('shown.bs.tab', function () {
        setupBackupTab();
    });

    // --- Export My Tasks ---
    document.getElementById("export-my-tasks-btn").addEventListener("click", function () {
        const users = getUsers();
        const tasks = getTasks();
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
    document.getElementById("import-my-tasks-btn").addEventListener("click", function () {
        document.getElementById("import-my-tasks-input").click();
    });
    document.getElementById("import-my-tasks-input").addEventListener("change", async function (e) {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async function (evt) {
            try {
                const data = JSON.parse(evt.target.result);
                const users = getUsers();
                if (!data.user || !data.user.id || data.user.id !== users[currentUser].id) {
                    document.getElementById("import-my-tasks-status").textContent = "User ID does not match. Import aborted.";
                    return;
                }
                // Ask to overwrite or merge
                if (await showConfirmModal("Overwrite all your tasks with imported data? Click Cancel to merge (only new tasks will be added).")) {
                    // Overwrite
                    const tasks = getTasks();
                    tasks[currentUser] = data.tasks;
                    saveTasks(tasks);
                    document.getElementById("import-my-tasks-status").textContent = "Tasks imported (overwritten).";
                } else {
                    // Merge: only add tasks with new IDs
                    const tasks = getTasks();
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
                    saveTasks(tasks);
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
        const users = getUsers();
        const tasks = getTasks();
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
    document.getElementById("import-all-users-btn").addEventListener("click", function () {
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
            const users = getUsers();
            const tasks = getTasks();
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
            saveUsers(users);
            saveTasks(tasks);
            statusDiv.innerHTML = importSummary.map(s => `<div>${s}</div>`).join("");
        } else if (file.name.endsWith(".json")) {
            // Single user JSON
            const reader = new FileReader();
            reader.onload = function (evt) {
                try {
                    const data = JSON.parse(evt.target.result);
                    if (!data.user || !data.user.id || !data.user.username) {
                        statusDiv.textContent = "Invalid file.";
                        return;
                    }
                    const uname = data.user.username;
                    const users = getUsers();
                    const tasks = getTasks();
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
                    saveUsers(users);
                    saveTasks(tasks);
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
    function collectAllTags() {
        const tasks = getTasks();
        const tagsSet = new Set();
        Object.values(tasks).forEach(user => {
            user.today?.forEach(t => (t.tags || []).forEach(tag => tagsSet.add(tag)));
            Object.values(user.archive || {}).forEach(arr => arr.forEach(t => (t.tags || []).forEach(tag => tagsSet.add(tag))));
        });
        return Array.from(tagsSet).sort();
    }

    // --- Tag Filter UI ---
    function filterTasksByTags(tasksArray, filterIdPrefix) {
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
    function renderTasksTable(tasksArray, container, options) {

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

        // 4. Render table
        let html = `<table class="table table-sm table-bordered align-middle mb-0"><thead><tr>`;

        if (options.showUser) {
            html += `<th style="position:relative;">User <span class="filter-icon" data-col="user" style="cursor:pointer;">&#x25BC;</span>
<div class="dropdown-menu p-2" data-dropdown="user"></div></th>`;
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

        filtered.forEach((task, idx) => {
            html += `<tr data-row="${idx}">`;

            if (options.showUser) html += `<td>${escapeHTML(task.user || '')}</td>`;

            // Only show Edit col if edit mode is ON
            if (options.editable && editMode) {
                html += `<td>
            <input type="checkbox" class="row-select-checkbox" data-row="${idx}" style="margin-right:8px;">
            <button class="btn btn-sm btn-outline-danger delete-btn" data-row="${idx}">Delete</button>
        </td>`;
            }

            options.columns.forEach(col => {
                // Make fields editable in edit mode
                if (options.editable && editMode) {
                    if (col.key === 'origin') {
                        // Build dropdown for origins
                        const origins = getOrigins().filter(o => !o.archived);
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
                    } else {
                        html += `<td>${escapeHTML(task[col.key] || '')}</td>`;
                    }
                }
            });

            html += `</tr>`;
        });
        html += '</tbody></table>';
        container.innerHTML = html;

        // Inline editing for editable fields in edit mode
        // Inline editing for editable fields in edit mode
        if (options.editable && editMode) {
            container.querySelectorAll('.task-edit-input').forEach(input => {
                input.addEventListener('change', function () {
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
                        const task = pendingArr.find(t =>
                            t.origin === filteredTask.origin &&
                            t.activity === filteredTask.activity &&
                            t.remarks === filteredTask.remarks &&
                            t.date === filteredTask.date &&
                            JSON.stringify(t.tags) === JSON.stringify(filteredTask.tags)
                        );
                        if (task) {
                            task[col] = value;
                        }
                    }
                });
            });
        }

        // 5. Sorting events
        container.querySelectorAll('.sort-btn').forEach(btn => {
            btn.onclick = function (e) {
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
            cb.onchange = function () {
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
            icon.onclick = function (e) {
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
                document.addEventListener('click', function hideDropdown(ev) {
                    if (!dropdown.contains(ev.target) && ev.target !== icon) {
                        dropdown.classList.remove('show');
                        dropdown.style.display = 'none';
                        document.removeEventListener('click', hideDropdown);
                    }
                });

                // Checkbox change (update tempSet only)
                dropdown.querySelectorAll('input[type="checkbox"]').forEach(cb => {
                    cb.onchange = function () {
                        if (this.checked) tempSet.add(this.value);
                        else tempSet.delete(this.value);
                    };
                });

                // Apply filter button
                dropdown.querySelector(`#apply-filter-${colKey}`).onclick = function () {
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
                dropdown.querySelector(`#clear-filter-${colKey}`).onclick = function () {
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
                    sortAscBtn.onclick = function () {
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
                    sortDescBtn.onclick = function () {
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
    function rerenderTodayTable() {
        const tasks = getTasks();
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
                        const tasks = getTasks();
                        arr = (tasks[currentUser] && tasks[currentUser].today) || [];
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
                    if (!todayEditMode) {
                        const tasks = getTasks();
                        tasks[currentUser].today = arr;
                        saveTasks(tasks);
                    }
                    rerenderTodayTable();
                }
            }
        });
    }

    // --- Archive Tab Table ---
    function rerenderArchiveTable() {
        const tasks = getTasks();
        const dateStr = document.getElementById('archive-date-display').textContent;
        let arr;
        if (archiveEditMode && window.archiveEditPending) {
            arr = window.archiveEditPending;
        } else {
            arr = (tasks[currentUser].archive[dateStr] || []).filter(t => t && typeof t === "object");
        }
        const todayObj = new Date();
        const todayStr = todayObj.getFullYear() + "-" +
            String(todayObj.getMonth() + 1).padStart(2, "0") + "-" +
            String(todayObj.getDate()).padStart(2, "0");
        if (dateStr === todayStr && tasks[currentUser].today) {
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
                        arr = (tasks[currentUser].archive[dateStr] || []).filter(t => t && typeof t === "object");
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
                        saveTasks(tasks);
                    }
                    rerenderArchiveTable();
                }
            }
        });
    }

    // --- Mass Editor Table ---
    function rerenderMassEditorTable() {
        let filtered;
        if (massEditorEditMode && window.massEditorEditPending) {
            filtered = window.massEditorEditPending.map(t => ({ ...t }));
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

    function rerenderViewTasksTable() {
        const users = getUsers();
        const tasks = getTasks();
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
            const tasks = getTasks();
            const today = new Date();
            const todayStr = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
            let userTasks = (tasks[currentUser] && tasks[currentUser].today) || [];
            userTasks = userTasks.filter(t => t.date === todayStr);
            Object.assign(userTasks[idx], {
                origin, activity, remarks, date, tags: tags.split(',').map(t => t.trim()).filter(Boolean)
            });
            saveTasks(tasks);
            rerenderTodayTable();
        } else if (tab === 'archive') {
            const tasks = getTasks();
            const dateStr = document.getElementById('archive-date-display').textContent;
            let arr = tasks[currentUser].archive[dateStr] || [];
            Object.assign(arr[idx], {
                origin, activity, remarks, date, tags: tags.split(',').map(t => t.trim()).filter(Boolean)
            });
            saveTasks(tasks);
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

        massEditorSelectedTasks.clear();
        rerenderMassEditorTable();
    });

    // --- Patch: Add tags to mass editor update ---
    const origUpdateMassEditorTask = window.updateMassEditorTask;
    window.updateMassEditorTask = function (idx, changes) {
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
    document.addEventListener('DOMContentLoaded', function () {
        rerenderTodayTable();
        rerenderArchiveTable();
        rerenderMassEditorTable();
        rerenderViewTasksTable();
    });
    // Also run after login
    const origAfterLoginSetup = window.afterLoginSetup;
    window.afterLoginSetup = function () {
        origAfterLoginSetup();
        rerenderTodayTable();
        rerenderArchiveTable();
        rerenderMassEditorTable();
        rerenderViewTasksTable();
    };
})();