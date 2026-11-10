const renderFullHtml = (previewEl, title, html, style) => {
    var iframeDocument = previewEl.contentDocument || previewEl.contentWindow.document;
    iframeDocument.open();
    iframeDocument.write(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <title>${title}</title>
            <style>${style}</style>
        </head>
        <body>
            ${html}
        </body>
        </html>`);
    iframeDocument.close()
}

/**
 * Tooltips
 */
function initTooltips() {
    var tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'))
    return tooltipTriggerList.map( (tooltipTriggerEl) =>  new bootstrap.Tooltip(tooltipTriggerEl));
}

/**
 * Toast
 */
function initToasts() {
    var toastElList = document.querySelectorAll('.toast');
    return [...toastElList].map(toastEl => new bootstrap.Toast(toastEl, {}));
}

function showToast(text, bgColor) {
    const toastContentEl = document.getElementById("toast-text");

    const toastContainerEl = document.getElementById("toast-container");
    const toast = bootstrap.Toast.getOrCreateInstance(toastContainerEl);

    toastContainerEl.classList.remove("text-bg-primary", "text-bg-danger");
    toastContainerEl.classList.add("text-bg-" + bgColor);

    toastContentEl.textContent = text;
    toast.show();
}

function errorToast(text) {
    showToast(text, "danger");
}

function successToast(text) {
    showToast(text, "success");
}


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
 * PDF
 */
function downloadPdf() {
    const title = nameTextEl.textContent;
    const content = contentEditor.getValue();
    const html = marked.parse(content);
    const style = styleEditor.getValue();

    renderFullHtml(previewEl, title, html, style);

    if (previewEl.contentWindow) {
        previewEl.contentWindow.print();
    } else {
        // For older browsers, use a try-catch block
        try {
            previewEl.contentDocument.execCommand('print', false, null);
        } catch (e) {
            window.print();
        }
    }
}

/*Name input*/
function enableEditing() {
    nameInputEl.value = nameTextEl.textContent;
    nameTextEl.classList.add('d-none');
    nameInputEl.classList.remove('d-none');
    nameInputEl.focus();
}

function saveEditing() {
    nameTextEl.textContent = nameInputEl.value;
    nameInputEl.classList.add('d-none');
    nameTextEl.classList.remove('d-none');
}

function adjustInputWidth(input) {
    const span = document.createElement('span');
    span.style.visibility = 'hidden';
    span.style.position = 'absolute';
    span.style.whiteSpace = 'pre';
    span.textContent = input.value || input.placeholder;

    document.body.appendChild(span);
    const width = Math.max(200, span.offsetWidth + 2) + 24; // minimal width is 200px + padding
    console.log(width);
    input.style.width = `${width}px`;
    document.body.removeChild(span);
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
