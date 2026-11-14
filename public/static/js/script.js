function initUI() {
    const toggle = document.querySelector('[data-nav-toggle]');
    toggle?.addEventListener('click', () => {
        const expanded = toggle.getAttribute('aria-expanded') !== 'true';
        toggle.setAttribute('aria-expanded', String(expanded));
        document.getElementById(toggle.getAttribute('aria-controls')).classList.toggle('hidden', !expanded);
    });
    document.addEventListener('click', event => {
        document.querySelectorAll('[data-disclosure][open]').forEach(menu => {
            if (!menu.contains(event.target)) menu.open = false;
        });
    });
    document.addEventListener('keydown', event => {
        if (event.key !== 'Escape') return;
        document.querySelectorAll('[data-disclosure][open]').forEach(menu => {
            menu.open = false;
            menu.querySelector('summary').focus();
        });
        if (toggle?.getAttribute('aria-expanded') === 'true') {
            toggle.click();
            toggle.focus();
        }
    });
    // Server-side flash messages arrive as hidden nodes; show them through the same toaster.
    document.querySelectorAll('[data-flash]').forEach(flash => {
        showToast(flash.textContent.trim(), flash.dataset.flash || 'error');
        flash.remove();
    });
}

/**
 * Toasts: stacked in the top-right corner, slide in, auto-dismiss, pause while hovered.
 */
const TOAST_STYLES = {
    success: { icon: 'circle-check', tone: 'text-green-600', accent: 'bg-green-600' },
    error: { icon: 'circle-alert', tone: 'text-red-600', accent: 'bg-red-600' },
    info: { icon: 'info', tone: 'text-amber-600', accent: 'bg-amber-500' },
};
const TOAST_DURATION = 5000;

function toastHost() {
    let host = document.getElementById('toast-container');
    if (!host) {
        host = document.createElement('div');
        host.id = 'toast-container';
        document.body.append(host);
    }
    host.className = 'pointer-events-none fixed top-4 right-4 z-50 flex w-[calc(100vw-2rem)] max-w-sm flex-col gap-3';
    return host;
}

function showToast(text, type = 'success') {
    const style = TOAST_STYLES[type] || TOAST_STYLES.info;
    const toast = document.createElement('div');
    toast.className = 'toast pointer-events-auto relative flex translate-x-4 items-start gap-3 overflow-hidden rounded-xl '
        + 'border border-gray-200 bg-white p-4 pl-5 text-sm text-gray-900 opacity-0 shadow-lg ring-1 ring-black/5 '
        + 'transition-all duration-300 ease-out motion-reduce:transition-none';
    toast.setAttribute('role', type === 'error' ? 'alert' : 'status');
    toast.setAttribute('aria-live', type === 'error' ? 'assertive' : 'polite');
    toast.setAttribute('aria-atomic', 'true');
    toast.innerHTML = `
        <span class="absolute inset-y-0 left-0 w-1 ${style.accent}" aria-hidden="true"></span>
        <svg class="icon mt-0.5 size-5 shrink-0 ${style.tone}" aria-hidden="true"><use href="/static/img/icons.svg#${style.icon}"></use></svg>
        <div class="toast-text min-w-0 flex-1 leading-snug break-words"></div>
        <button type="button" class="-m-1 shrink-0 rounded-md p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
                data-dismiss-toast aria-label="Close notification">
            <svg class="icon" aria-hidden="true"><use href="/static/img/icons.svg#x"></use></svg>
        </button>`;
    toast.querySelector('.toast-text').textContent = text;

    let timer;
    const dismiss = () => {
        clearTimeout(timer);
        toast.classList.add('opacity-0', 'translate-x-4');
        const remove = () => toast.remove();
        toast.addEventListener('transitionend', remove, { once: true });
        setTimeout(remove, 400);
    };
    const schedule = () => { clearTimeout(timer); timer = setTimeout(dismiss, TOAST_DURATION); };
    toast.querySelector('[data-dismiss-toast]').addEventListener('click', dismiss);
    toast.addEventListener('mouseenter', () => clearTimeout(timer));
    toast.addEventListener('mouseleave', schedule);
    toast.addEventListener('focusin', () => clearTimeout(timer));
    toast.addEventListener('focusout', schedule);

    toastHost().append(toast);
    requestAnimationFrame(() => requestAnimationFrame(() => toast.classList.remove('opacity-0', 'translate-x-4')));
    schedule();
    return toast;
}

function errorToast(text) { showToast(text, 'error'); }
function successToast(text) { showToast(text, 'success'); }
function infoToast(text) { showToast(text, 'info'); }

/**
 * Forms
 */
function submitForm(formEl) {
    formEl.addEventListener('submit', (e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const formData = new FormData(form);
        const submitBtn = form.querySelector('button[type="submit"]');

        submitBtn.disabled = true;
        fetch(form.action, {
            method: form.method,
            body: formData
        })
            .then(response => response.json())
            .then(json => {
                if (json.success) {
                    successToast(json.message);
                } else {
                    errorToast(json.message);
                }

                if (json.redirectUrl) {
                    setTimeout(() => {
                        document.location.href = json.redirectUrl;
                    }, 1000);
                }

                setTimeout(() => {
                    submitBtn.disabled = false;
                }, 1000);
            })
            .catch(() => {
                errorToast('Unable to complete the request. Please try again.');
                submitBtn.disabled = false;
            });
    });
}

function initFormSubmits() {
    var formElList = document.querySelectorAll('form');
    return [...formElList].map(formEl => submitForm(formEl));
}

/**
 * Timestamps
 */
function relativeTime(date) {
    const units = [['year', 31536000], ['month', 2592000], ['week', 604800],
                   ['day', 86400], ['hour', 3600], ['minute', 60]];
    const seconds = (date.getTime() - Date.now()) / 1000;
    const formatter = new Intl.RelativeTimeFormat(undefined, {numeric: 'auto'});
    for (const [unit, size] of units) {
        if (Math.abs(seconds) >= size) {
            return formatter.format(Math.round(seconds / size), unit);
        }
    }
    return formatter.format(Math.round(seconds), 'second');
}

function initRelativeTimes() {
    document.querySelectorAll('time[data-relative][datetime]').forEach(timeEl => {
        const date = new Date(timeEl.getAttribute('datetime'));
        if (isNaN(date.getTime())) return; // Keep the server-rendered fallback.
        timeEl.title = date.toLocaleString();
        timeEl.textContent = relativeTime(date);
    });
}

/**
 * Repo and branch
 */
async function fetchBranches(url, defaultBranch) {
    const branchSelect = document.getElementById('branchSelect');

    try {
        const response = await fetch(url);
        if (!response.ok) {
            errorToast('Error fetching branches');
            throw new Error(`Error fetching branches: ${response.statusText}`);
        }
        const branches = await response.json();

        // Clear previous options
        branchSelect.innerHTML = '<option value="" selected disabled>Select a branch</option>';

        // Populate the branch dropdown
        branches.forEach(branch => {
            const option = document.createElement('option');
            option.value = branch.name;
            option.textContent = branch.name;
            if (branch.name === defaultBranch) {
                option.selected = true;
            }
            branchSelect.appendChild(option);
        });

        // Enable the branch dropdown
        branchSelect.disabled = false;
    } catch (error) {
        console.error('Error fetching branches:', error);
    }
}
