let toastTimer;

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
    document.querySelector('[data-dismiss-toast]')?.addEventListener('click', () => {
        clearTimeout(toastTimer);
        document.getElementById('toast-container').classList.add('hidden');
    });
    document.querySelectorAll('[data-flash]').forEach(flash => {
        flash.querySelector('[data-dismiss-flash]').addEventListener('click', () => flash.remove());
        setTimeout(() => flash.remove(), 5000);
    });
}

function showToast(text, error = false) {
    const toast = document.getElementById('toast-container');
    clearTimeout(toastTimer);
    toast.classList.remove('hidden', 'bg-red-700', 'bg-green-700');
    toast.classList.add(error ? 'bg-red-700' : 'bg-green-700');
    document.getElementById('toast-text').textContent = text;
    toastTimer = setTimeout(() => toast.classList.add('hidden'), 5000);
}

function errorToast(text) { showToast(text, true); }
function successToast(text) { showToast(text); }

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
