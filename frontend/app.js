// State
let currentMapData = null;
let panZoomInstance = null;

// DOM Elements
const fileInput = document.getElementById('fileInput');
const uploadBtn = document.getElementById('uploadBtn');
const clearDocsBtn = document.getElementById('clearDocsBtn');
const uploadStatus = document.getElementById('uploadStatus');
const promptInput = document.getElementById('promptInput');
const generateBtn = document.getElementById('generateBtn');
const viewSelect = document.getElementById('viewSelect');
const loadViewBtn = document.getElementById('loadViewBtn');
const deleteViewBtn = document.getElementById('deleteViewBtn');
const viewNameInput = document.getElementById('viewNameInput');
const saveViewBtn = document.getElementById('saveViewBtn');
const mapTitle = document.getElementById('mapTitle');
const mermaidOutput = document.getElementById('mermaidOutput');
const loading = document.getElementById('loading');
const zoomInBtn = document.getElementById('zoomInBtn');
const zoomOutBtn = document.getElementById('zoomOutBtn');
const resetZoomBtn = document.getElementById('resetZoomBtn');

// Initialize Mermaid
mermaid.initialize({
    startOnLoad: false,
    theme: 'default',
    flowchart: {
        useMaxWidth: false,
        htmlLabels: true,
        curve: 'basis'
    }
});

// API Functions
async function uploadFiles(files) {
    const formData = new FormData();
    for (const file of files) {
        formData.append('files', file);
    }

    const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Upload failed');
    }

    return response.json();
}

async function clearDocuments() {
    const response = await fetch('/api/documents', { method: 'DELETE' });
    return response.json();
}

async function generateMindMap(prompt) {
    const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Generation failed');
    }

    return response.json();
}

async function getViews() {
    const response = await fetch('/api/views');
    return response.json();
}

async function saveView(name, prompt, mapData) {
    const response = await fetch('/api/views', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, prompt, map_data: mapData })
    });
    return response.json();
}

async function loadView(viewId) {
    const response = await fetch(`/api/views/${viewId}`);
    if (!response.ok) {
        throw new Error('Failed to load view');
    }
    return response.json();
}

async function deleteView(viewId) {
    const response = await fetch(`/api/views/${viewId}`, { method: 'DELETE' });
    return response.json();
}

// Convert mind map data to Mermaid syntax
function toMermaidSyntax(mapData) {
    let mermaid = 'flowchart TD\n';

    // Add nodes
    for (const node of mapData.nodes) {
        const label = node.label.replace(/"/g, "'");
        const desc = node.description ? `<br/><small>${node.description.replace(/"/g, "'")}</small>` : '';
        mermaid += `    ${node.id}["${label}${desc}"]\n`;
    }

    // Add edges
    for (const edge of mapData.edges) {
        const rel = edge.relationship ? `|${edge.relationship.replace(/"/g, "'")}|` : '';
        mermaid += `    ${edge.source} -->${rel} ${edge.target}\n`;
    }

    return mermaid;
}

// Render mind map
async function renderMindMap(mapData) {
    currentMapData = mapData;
    mapTitle.textContent = mapData.title || 'Mind Map';

    const mermaidSyntax = toMermaidSyntax(mapData);
    console.log('Mermaid syntax:', mermaidSyntax);

    // Clear previous content and pan-zoom
    if (panZoomInstance) {
        panZoomInstance.destroy();
        panZoomInstance = null;
    }
    mermaidOutput.innerHTML = '';

    // Create a unique ID for this render
    const id = 'mermaid-' + Date.now();

    try {
        const { svg } = await mermaid.render(id, mermaidSyntax);
        mermaidOutput.innerHTML = svg;

        // Initialize pan-zoom on the SVG
        const svgElement = mermaidOutput.querySelector('svg');
        if (svgElement) {
            svgElement.style.width = '100%';
            svgElement.style.height = '100%';

            panZoomInstance = svgPanZoom(svgElement, {
                zoomEnabled: true,
                controlIconsEnabled: false,
                fit: true,
                center: true,
                minZoom: 0.1,
                maxZoom: 10
            });
        }
    } catch (error) {
        console.error('Mermaid render error:', error);
        mermaidOutput.innerHTML = `<p style="color: red; padding: 20px;">Error rendering mind map: ${error.message}</p>`;
    }
}

// Update views dropdown
async function refreshViews() {
    const { views } = await getViews();
    viewSelect.innerHTML = '<option value="">-- Select a saved view --</option>';
    for (const view of views) {
        const option = document.createElement('option');
        option.value = view.id;
        option.textContent = view.name;
        viewSelect.appendChild(option);
    }
}

// Event Handlers
uploadBtn.addEventListener('click', async () => {
    const files = fileInput.files;
    if (files.length === 0) {
        alert('Please select files to upload');
        return;
    }

    try {
        uploadBtn.disabled = true;
        uploadStatus.textContent = 'Uploading...';

        const result = await uploadFiles(files);
        uploadStatus.textContent = `Uploaded ${result.uploaded.length} files (${result.total_documents} total)`;
        fileInput.value = '';
    } catch (error) {
        uploadStatus.textContent = `Error: ${error.message}`;
    } finally {
        uploadBtn.disabled = false;
    }
});

clearDocsBtn.addEventListener('click', async () => {
    if (confirm('Clear all uploaded documents?')) {
        await clearDocuments();
        uploadStatus.textContent = 'All documents cleared';
    }
});

generateBtn.addEventListener('click', async () => {
    const prompt = promptInput.value.trim();
    if (!prompt) {
        alert('Please enter a prompt');
        return;
    }

    try {
        generateBtn.disabled = true;
        loading.classList.remove('hidden');

        const mapData = await generateMindMap(prompt);
        await renderMindMap(mapData);
    } catch (error) {
        alert(`Error: ${error.message}`);
    } finally {
        generateBtn.disabled = false;
        loading.classList.add('hidden');
    }
});

saveViewBtn.addEventListener('click', async () => {
    const name = viewNameInput.value.trim();
    if (!name) {
        alert('Please enter a view name');
        return;
    }
    if (!currentMapData) {
        alert('No mind map to save');
        return;
    }

    try {
        await saveView(name, promptInput.value, currentMapData);
        viewNameInput.value = '';
        await refreshViews();
        alert('View saved!');
    } catch (error) {
        alert(`Error saving view: ${error.message}`);
    }
});

loadViewBtn.addEventListener('click', async () => {
    const viewId = viewSelect.value;
    if (!viewId) {
        alert('Please select a view');
        return;
    }

    try {
        const view = await loadView(viewId);
        promptInput.value = view.prompt;
        await renderMindMap(view.map_data);
    } catch (error) {
        alert(`Error loading view: ${error.message}`);
    }
});

deleteViewBtn.addEventListener('click', async () => {
    const viewId = viewSelect.value;
    if (!viewId) {
        alert('Please select a view');
        return;
    }

    if (confirm('Delete this view?')) {
        await deleteView(viewId);
        await refreshViews();
    }
});

// Zoom controls
zoomInBtn.addEventListener('click', () => {
    if (panZoomInstance) panZoomInstance.zoomIn();
});

zoomOutBtn.addEventListener('click', () => {
    if (panZoomInstance) panZoomInstance.zoomOut();
});

resetZoomBtn.addEventListener('click', () => {
    if (panZoomInstance) {
        panZoomInstance.reset();
        panZoomInstance.fit();
        panZoomInstance.center();
    }
});

// Initialize
refreshViews();
