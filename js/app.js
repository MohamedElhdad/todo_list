		
const taskInput = document.querySelector('.task-input');
const addBtn = document.querySelector('.add');
const clearAll = document.querySelector('.clear');
const tasksDiv = document.querySelector('.task-list');
const empty = document.querySelector('.empty');
const taskCounter = document.querySelector('.task-counter');
const modalOverlay = document.querySelector('.modal-overlay');
const modalYes = document.querySelector('.modal-yes');
const modalNo = document.querySelector('.modal-no');
const themeToggle = document.querySelector('.theme-toggle');
const themeColorMeta = document.querySelector('meta[name="theme-color"]');

//# Theme: dark by default, the choice is saved in localStorage
function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
    themeColorMeta.setAttribute('content', theme === 'light' ? '#E9EFF2' : '#141B1F');
}

applyTheme(localStorage.getItem('theme') || 'dark');

themeToggle.onclick = function () {
    applyTheme(document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light');
};

//# Copy helper (clipboard API with fallback)
function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
        return navigator.clipboard.writeText(text);
    }
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.append(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
    return Promise.resolve();
}

//# Toast helper (native-like notification, optional UNDO action)
function showToast(msg, actionLabel, onAction) {
    let toast = document.querySelector('.toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.className = 'toast';
        document.body.append(toast);
    }
    clearTimeout(showToast._timer);

    toast.textContent = msg;
    toast.classList.toggle('undo', !!actionLabel);

    if (actionLabel) {
        const actionBtn = document.createElement('button');
        actionBtn.className = 'toast-action';
        actionBtn.textContent = actionLabel;
        toast.append(actionBtn);
        // Tapping the whole toast performs the undo
        toast.onclick = function () {
            hideToast();
            if (onAction) onAction();
        };
    } else {
        toast.onclick = null;
    }

    toast.classList.add('show');
    showToast._timer = setTimeout(hideToast, actionLabel ? 5000 : 1500);
}

function hideToast() {
    const toast = document.querySelector('.toast');
    if (toast) {
        toast.classList.remove('show');
    }
}

//# Trash buffer: remembers deleted tasks for UNDO (max 20 entries)
function getTrash() {
    return JSON.parse(localStorage.getItem('trash')) || [];
}

function setTrash(trash) {
    localStorage.setItem('trash', JSON.stringify(trash.slice(-20)));
}

//# Put a restored task back at its original position
function positionTask(div, index) {
    const tasks = Array.from(tasksDiv.querySelectorAll('.task'));
    if (index < tasks.length - 1) {
        tasksDiv.insertBefore(div, tasks[index]);
    }
}

//# Re-apply the strike state of a restored task
function applyStruck(div, struck, text) {
    if (struck) {
        div.children[1].classList.add('line');
        div.children[0].checked = true;
        const lineArr = JSON.parse(localStorage.getItem('line')) || [];
        if (!lineArr.includes(text)) {
            lineArr.push(text);
            localStorage.setItem('line', JSON.stringify(lineArr));
        }
    }
}

//# UNDO: restore the last trash entry (a single task or a whole batch)
function restoreLast() {
    const trash = getTrash();
    const entry = trash.pop();
    if (!entry) return;
    setTrash(trash);

    const items = entry.batch || [entry];
    items.forEach((item) => {
        const div = createTasks(item.text);
        positionTask(div, item.index);
        applyStruck(div, item.struck, item.text);
    });
    localStorageUpdate();
}

//# Kill the native long-press copy menu on task text only
//# (our own highlight + copy replaces it — long-press elsewhere stays normal)
document.addEventListener('contextmenu', function (e) {
    if (e.target.closest && e.target.closest('.task-content')) {
        e.preventDefault();
    }
});



if (sessionStorage.getItem('task-input')) {

    taskInput.value = sessionStorage.getItem('task-input');
}

//# The add button stays disabled until the input has real text (spaces don't count)
const updateAddButton = function () {
    addBtn.disabled = taskInput.value.trim() === '';
};

taskInput.oninput = function () {

    sessionStorage.setItem('task-input', this.value);
    updateAddButton();
}

updateAddButton();


addBtn.onclick = function () {

    const taskText = taskInput.value.trim();

    if (taskText !== '') {

      this.style.color = 'black';
      this.style.backgroundColor = 'var(--soft-green)';

      setTimeout(() => {
        this.style.color = 'white';
        this.style.backgroundColor = 'dimgray';
      }, 130);

      createTasks(taskText);

      sessionStorage.setItem('task-input', '');

      taskInput.value = '';
      updateAddButton();
      taskInput.focus();
    }
}




if (localStorage.getItem('tasks')) {
    
    const tasksArr = JSON.parse(localStorage.getItem('tasks'));
    
    for (const task of tasksArr) {
        
        createTasks(task);
    }
}



function createTasks(task) {
    
    const div = document.createElement('div');
    div.className = 'task';
    div.innerHTML = ` <p class="task-content">${task}</p>`;
    const deleteInput = document.createElement('input');
    deleteInput.type = 'checkbox';
    deleteInput.className = 'state';
    empty.setAttribute('hidden', '');
    div.prepend(deleteInput);
    tasksDiv.append(div);


    localStorageUpdate();

    //# Trash delete button
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete';
    deleteBtn.title = 'Delete';
    deleteBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>';
    div.append(deleteBtn);

    deleteBtn.onclick = function () {

        // Save to trash for UNDO (text, position, strike state)
        const index = Array.from(tasksDiv.querySelectorAll('.task')).indexOf(div);
        const trash = getTrash();
        trash.push({
            text: div.children[1].firstChild.nodeValue.trim(),
            index: index,
            struck: div.children[1].classList.contains('line')
        });
        setTrash(trash);

        div.classList.add('done');

        setTimeout(() => {
            div.remove();
            localStorageUpdate();
            showToast('Task deleted', 'UNDO', restoreLast);
        }, 120);

        if (localStorage.getItem('line')) {
            localStorage.setItem('line', JSON.stringify(JSON.parse(localStorage.getItem('line')).filter(e => e != div.children[1].firstChild.nodeValue.trim())));
        }
    };

   const p = div.children[1];

    //# Line-Through Task (shared by double-click on desktop and double-tap on mobile)
    const toggleLine = function () {

        window.getSelection().removeAllRanges();
        const pValue = this.firstChild.nodeValue.trim()

        let lineArr = JSON.parse(localStorage.getItem('line')) || [];

        if (this.classList.contains('line')) {

            lineArr = lineArr.filter(e => e != pValue);
            this.classList.remove('line');

        } else {

            lineArr.push(pValue);
            this.classList.add('line');
        }

        localStorage.setItem('line', JSON.stringify(lineArr));

        // Keep the checkbox in sync with the strike state
        const checkbox = this.parentElement.children[0];
        checkbox.checked = this.classList.contains('line');

        localStorageUpdate()
    }

    p.ondblclick = toggleLine;

    //# Checkbox behaves like double-click: strike (done), never delete
    deleteInput.onclick = function () {
        toggleLine.call(p);
    };

    //# Mobile: custom long-press (copy) + double-tap (strike)
    let lastTap = 0;
    let pressTimer = null;
    let justCopied = false;

    const copyTask = function () {
        const pValue = p.firstChild.nodeValue.trim();
        copyText(pValue).catch(() => {});
        p.classList.add('copying');
        setTimeout(() => p.classList.remove('copying'), 400);
        showToast('Copied!');
        justCopied = true;
    };

    p.addEventListener('touchstart', function () {
        pressTimer = setTimeout(copyTask, 450);
    }, { passive: true });

    const cancelPress = function () { clearTimeout(pressTimer); };
    p.addEventListener('touchmove', cancelPress, { passive: true });
    p.addEventListener('touchcancel', cancelPress, { passive: true });
    p.addEventListener('touchend', cancelPress, { passive: true });

    div.addEventListener('touchend', function (e) {

        if (e.target.classList.contains('state') || (e.target.closest && e.target.closest('.delete'))) return;

        // Ignore the tap that follows a long-press copy
        if (justCopied) {
            justCopied = false;
            lastTap = 0;
            return;
        }

        const now = Date.now();
        if (now - lastTap <= 300) {
            e.preventDefault();
            toggleLine.call(p);
            lastTap = 0;
        } else {
            lastTap = now;
        }
    }, false);

    return div;
}




//! clear All Button
clearAll.onclick = function () {
    if (document.querySelectorAll('.task').length > 0) {
        modalOverlay.classList.add('show');
    }
}

modalNo.onclick = function () {
    modalOverlay.classList.remove('show');
}

// Tapping the dark overlay itself also closes the popup
modalOverlay.onclick = function (e) {
    if (e.target === modalOverlay) {
        modalOverlay.classList.remove('show');
    }
}

modalYes.onclick = function () {

    // Close the popup immediately so the clear animation is fully visible
    modalOverlay.classList.remove('show');

    const tasks = Array.from(tasksDiv.querySelectorAll('.task'));
    if (tasks.length === 0) return;

    // Snapshot every task into ONE trash entry (for batch UNDO)
    const batch = tasks.map((task, i) => ({
        text: task.children[1].firstChild.nodeValue.trim(),
        index: i,
        struck: task.children[1].classList.contains('line')
    }));
    const trash = getTrash();
    trash.push({ batch: batch });
    setTrash(trash);

    if (JSON.parse(localStorage.getItem('tasks')).length > 0) {

        clearAll.style.color = 'hsl(0, 55%, 50%)';
        clearAll.style.backgroundColor = 'white';

        setTimeout(() => {
            clearAll.style.color = 'white';
            clearAll.style.backgroundColor = 'hsl(0, 55%, 50%)';
        }, 130);
    }

    if (localStorage.getItem('line')) {

        localStorage.setItem('line', '[]');
    }

    tasks.forEach((task, i) => {
        task.classList.add('done');
        task.style.transitionDelay = (20 * i) + 'ms';

        setTimeout(() => {
            task.remove();
            localStorageUpdate();
        }, 130);
    });

    // When everything is really gone, offer UNDO
    setTimeout(() => {
        showToast('All tasks deleted', 'UNDO', restoreLast);
    }, 130 + (20 * (tasks.length - 1)) + 120);
}


//! Add Line-Through To Task If In localStorage.getItem('line');
if (localStorage.getItem('line')) {
    
    tasksDiv.querySelectorAll('.task').forEach(task => {
            
        if (JSON.parse(localStorage.getItem('line')).includes(task.children[1].firstChild.nodeValue.trim())) {
                    
            task.children[1].classList.add('line');
            task.children[0].checked = true; 
        } else { 
            task.children[1].classList.remove('line');
        }
    });
}



//! localStorage Update
function localStorageUpdate() {

    const tasksArr = [];

    document.querySelectorAll('.task').forEach(e => {
        const p = e.children[1];
        const text = (p && p.firstChild) ? p.firstChild.nodeValue.trim() : '';
        if (text) tasksArr.push(text);
    });

    localStorage.setItem('tasks', JSON.stringify(tasksArr));

    let lineLength = 0;
    if (localStorage.getItem('line')) {

        lineLength = JSON.parse(localStorage.getItem('line')).length ;
    }
    
    taskCounter.innerHTML = `You have <span class='count'>${JSON.parse(localStorage.getItem('tasks')).length - lineLength}</span> tasks`;
    
    setTimeout(() => {
       tasksDiv.querySelectorAll('.task').length == 0 ? empty.removeAttribute('hidden') : empty.setAttribute('hidden', '');
    },130);

}


// Register the Service Worker (makes the app installable & offline)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js');
  });
}
