# Prompt-Guided Mind Map Generator MVP Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a localhost web app that generates prompt-guided mind maps from uploaded research documents (PDF with OCR, txt, md, docx).

**Architecture:** FastAPI backend handles document upload, text extraction (including OCR for scanned PDFs), and Claude API calls to generate structured mind map JSON. Vanilla JS frontend renders maps using Mermaid.js with zoom/pan support. Views are stored in-memory for the session.

**Tech Stack:** Python 3.11+, FastAPI, PyMuPDF, pytesseract, python-docx, Anthropic SDK, Mermaid.js, svg-pan-zoom

---

## Task 1: Project Setup & Dependencies

**Files:**
- Create: `backend/requirements.txt`
- Create: `backend/__init__.py`
- Create: `frontend/index.html` (placeholder)

**Step 1: Create project directory structure**

```bash
cd /Users/kyraatekwana/mindmap-generator
mkdir -p backend frontend
touch backend/__init__.py
```

**Step 2: Create requirements.txt**

Create `backend/requirements.txt`:

```
fastapi==0.109.0
uvicorn==0.27.0
python-multipart==0.0.6
pymupdf==1.23.8
pytesseract==0.3.10
python-docx==1.1.0
anthropic==0.18.0
pydantic==2.5.3
Pillow==10.2.0
```

**Step 3: Install dependencies**

Run: `pip install -r backend/requirements.txt`

**Step 4: Verify Tesseract is installed**

Run: `tesseract --version`

If not installed, run: `brew install tesseract`

**Step 5: Commit**

```bash
git init
git add .
git commit -m "chore: initial project setup with dependencies"
```

---

## Task 2: Pydantic Models

**Files:**
- Create: `backend/models.py`

**Step 1: Create models.py with all data structures**

Create `backend/models.py`:

```python
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
import uuid


class Document(BaseModel):
    id: str
    filename: str
    content: str
    uploaded_at: datetime

    @classmethod
    def create(cls, filename: str, content: str) -> "Document":
        return cls(
            id=str(uuid.uuid4()),
            filename=filename,
            content=content,
            uploaded_at=datetime.now()
        )


class Node(BaseModel):
    id: str
    label: str
    description: Optional[str] = None


class Edge(BaseModel):
    source: str  # 'from' is reserved in Mermaid, using 'source'
    target: str  # 'to' -> 'target' for consistency
    relationship: Optional[str] = None


class MindMapData(BaseModel):
    title: str
    nodes: list[Node]
    edges: list[Edge]


class View(BaseModel):
    id: str
    name: str
    prompt: str
    map_data: MindMapData
    created_at: datetime

    @classmethod
    def create(cls, name: str, prompt: str, map_data: MindMapData) -> "View":
        return cls(
            id=str(uuid.uuid4()),
            name=name,
            prompt=prompt,
            map_data=map_data,
            created_at=datetime.now()
        )


class GenerateRequest(BaseModel):
    prompt: str


class ViewCreate(BaseModel):
    name: str
    prompt: str
    map_data: MindMapData
```

**Step 2: Verify syntax**

Run: `python -c "from backend.models import *; print('Models OK')"`
Expected: `Models OK`

**Step 3: Commit**

```bash
git add backend/models.py
git commit -m "feat: add Pydantic models for documents, views, and mind maps"
```

---

## Task 3: Document Processor

**Files:**
- Create: `backend/document_processor.py`

**Step 1: Create document processor with text extraction for all file types**

Create `backend/document_processor.py`:

```python
import io
from pathlib import Path
import fitz  # PyMuPDF
from docx import Document as DocxDocument
import pytesseract
from PIL import Image


def extract_text_from_txt(content: bytes) -> str:
    """Extract text from .txt or .md files."""
    return content.decode("utf-8", errors="ignore")


def extract_text_from_docx(content: bytes) -> str:
    """Extract text from .docx files."""
    doc = DocxDocument(io.BytesIO(content))
    paragraphs = [p.text for p in doc.paragraphs]
    return "\n".join(paragraphs)


def extract_text_from_pdf(content: bytes) -> str:
    """Extract text from PDF, falling back to OCR if needed."""
    doc = fitz.open(stream=content, filetype="pdf")
    text_parts = []

    for page_num, page in enumerate(doc):
        # Try direct text extraction first
        text = page.get_text()

        if text.strip():
            text_parts.append(text)
        else:
            # Fall back to OCR for scanned pages
            pix = page.get_pixmap(matrix=fitz.Matrix(2, 2))  # 2x scale for better OCR
            img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
            ocr_text = pytesseract.image_to_string(img)
            text_parts.append(ocr_text)

    doc.close()
    return "\n\n".join(text_parts)


def extract_text(filename: str, content: bytes) -> str:
    """Extract text from a file based on its extension."""
    ext = Path(filename).suffix.lower()

    if ext in [".txt", ".md"]:
        return extract_text_from_txt(content)
    elif ext == ".docx":
        return extract_text_from_docx(content)
    elif ext == ".pdf":
        return extract_text_from_pdf(content)
    else:
        raise ValueError(f"Unsupported file type: {ext}")


def get_supported_extensions() -> list[str]:
    """Return list of supported file extensions."""
    return [".txt", ".md", ".docx", ".pdf"]
```

**Step 2: Verify imports work**

Run: `python -c "from backend.document_processor import extract_text; print('Processor OK')"`
Expected: `Processor OK`

**Step 3: Commit**

```bash
git add backend/document_processor.py
git commit -m "feat: add document processor with PDF/OCR/DOCX/TXT support"
```

---

## Task 4: LLM Processor

**Files:**
- Create: `backend/llm_processor.py`

**Step 1: Create LLM processor for mind map generation**

Create `backend/llm_processor.py`:

```python
import json
import os
from anthropic import Anthropic
from backend.models import MindMapData, Node, Edge


SYSTEM_PROMPT = """You are a research synthesis assistant. Your job is to analyze
interview transcripts and other research documents, then generate structured
mind maps based on the user's analytical focus.

You MUST return ONLY valid JSON with no additional text, markdown, or explanation.
The JSON must follow this exact structure:
{
  "title": "descriptive title for this view",
  "nodes": [
    {"id": "unique_id", "label": "short label", "description": "brief description"}
  ],
  "edges": [
    {"source": "node_id", "target": "node_id", "relationship": "describes the connection"}
  ]
}

Guidelines:
- Create meaningful hierarchical relationships
- Use the edge "relationship" field to explain WHY nodes connect
- Limit to 30-50 nodes for readability
- Group related concepts under parent nodes
- Node IDs should be simple strings like "node1", "node2", etc.
- Every edge must reference existing node IDs"""


def generate_mindmap(documents_content: str, user_prompt: str) -> MindMapData:
    """Generate a mind map from documents using Claude."""
    client = Anthropic()

    user_message = f"""I have uploaded research documents. Here is the combined content:

---
{documents_content}
---

My request: {user_prompt}

Generate a mind map that addresses my request. Return ONLY valid JSON."""

    response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=4096,
        system=SYSTEM_PROMPT,
        messages=[
            {"role": "user", "content": user_message}
        ]
    )

    # Extract text content from response
    response_text = response.content[0].text

    # Parse JSON response
    try:
        data = json.loads(response_text)
    except json.JSONDecodeError:
        # Try to extract JSON from response if wrapped in markdown
        import re
        json_match = re.search(r'\{[\s\S]*\}', response_text)
        if json_match:
            data = json.loads(json_match.group())
        else:
            raise ValueError(f"Failed to parse LLM response as JSON: {response_text[:200]}")

    # Convert to MindMapData
    nodes = [Node(**n) for n in data.get("nodes", [])]
    edges = [Edge(**e) for e in data.get("edges", [])]

    return MindMapData(
        title=data.get("title", "Mind Map"),
        nodes=nodes,
        edges=edges
    )
```

**Step 2: Verify imports work (won't run without API key)**

Run: `python -c "from backend.llm_processor import generate_mindmap; print('LLM Processor OK')"`
Expected: `LLM Processor OK`

**Step 3: Commit**

```bash
git add backend/llm_processor.py
git commit -m "feat: add LLM processor for Claude-powered mind map generation"
```

---

## Task 5: FastAPI Main Application

**Files:**
- Create: `backend/main.py`

**Step 1: Create FastAPI app with all endpoints**

Create `backend/main.py`:

```python
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from typing import List
import os

from backend.models import Document, View, GenerateRequest, ViewCreate, MindMapData
from backend.document_processor import extract_text, get_supported_extensions
from backend.llm_processor import generate_mindmap

app = FastAPI(title="Mind Map Generator")

# Enable CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory storage
documents: dict[str, Document] = {}
views: dict[str, View] = {}
current_map: MindMapData | None = None


@app.get("/")
async def root():
    """Serve the frontend."""
    return FileResponse("frontend/index.html")


@app.post("/api/upload")
async def upload_documents(files: List[UploadFile] = File(...)):
    """Upload and process documents."""
    global documents

    supported = get_supported_extensions()
    uploaded = []

    for file in files:
        ext = os.path.splitext(file.filename)[1].lower()
        if ext not in supported:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported file type: {ext}. Supported: {supported}"
            )

        content = await file.read()
        try:
            text = extract_text(file.filename, content)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Failed to process {file.filename}: {str(e)}")

        doc = Document.create(filename=file.filename, content=text)
        documents[doc.id] = doc
        uploaded.append({"id": doc.id, "filename": doc.filename, "chars": len(text)})

    return {"uploaded": uploaded, "total_documents": len(documents)}


@app.get("/api/documents")
async def list_documents():
    """List all uploaded documents."""
    return {
        "documents": [
            {"id": d.id, "filename": d.filename, "chars": len(d.content)}
            for d in documents.values()
        ]
    }


@app.delete("/api/documents")
async def clear_documents():
    """Clear all uploaded documents."""
    global documents
    documents = {}
    return {"status": "cleared"}


@app.post("/api/generate")
async def generate_map(request: GenerateRequest):
    """Generate a mind map from uploaded documents."""
    global current_map

    if not documents:
        raise HTTPException(status_code=400, detail="No documents uploaded")

    # Combine all document content
    combined_content = "\n\n---\n\n".join([
        f"[{doc.filename}]\n{doc.content}"
        for doc in documents.values()
    ])

    try:
        current_map = generate_mindmap(combined_content, request.prompt)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate mind map: {str(e)}")

    return current_map.model_dump()


@app.get("/api/views")
async def list_views():
    """List all saved views."""
    return {
        "views": [
            {"id": v.id, "name": v.name, "prompt": v.prompt}
            for v in views.values()
        ]
    }


@app.post("/api/views")
async def save_view(view_create: ViewCreate):
    """Save the current view."""
    view = View.create(
        name=view_create.name,
        prompt=view_create.prompt,
        map_data=view_create.map_data
    )
    views[view.id] = view
    return {"id": view.id, "name": view.name}


@app.get("/api/views/{view_id}")
async def get_view(view_id: str):
    """Get a specific saved view."""
    if view_id not in views:
        raise HTTPException(status_code=404, detail="View not found")
    return views[view_id].model_dump()


@app.delete("/api/views/{view_id}")
async def delete_view(view_id: str):
    """Delete a saved view."""
    if view_id not in views:
        raise HTTPException(status_code=404, detail="View not found")
    del views[view_id]
    return {"status": "deleted"}


# Serve static files (frontend)
app.mount("/static", StaticFiles(directory="frontend"), name="static")
```

**Step 2: Verify the app can be imported**

Run: `python -c "from backend.main import app; print('FastAPI OK')"`
Expected: `FastAPI OK`

**Step 3: Commit**

```bash
git add backend/main.py
git commit -m "feat: add FastAPI app with upload, generate, and views endpoints"
```

---

## Task 6: Frontend HTML Structure

**Files:**
- Create: `frontend/index.html`

**Step 1: Create the complete HTML file**

Create `frontend/index.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Mind Map Generator</title>
    <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/svg-pan-zoom@3.6.1/dist/svg-pan-zoom.min.js"></script>
    <link rel="stylesheet" href="/static/style.css">
</head>
<body>
    <div class="container">
        <header>
            <h1>Mind Map Generator</h1>
            <p>Upload research documents and generate prompt-guided mind maps</p>
        </header>

        <div class="controls">
            <div class="upload-section">
                <h2>1. Upload Documents</h2>
                <input type="file" id="fileInput" multiple accept=".pdf,.txt,.md,.docx">
                <button id="uploadBtn">Upload</button>
                <button id="clearDocsBtn">Clear All</button>
                <div id="uploadStatus"></div>
            </div>

            <div class="prompt-section">
                <h2>2. Enter Analysis Prompt</h2>
                <textarea id="promptInput" placeholder="e.g., Build a mind map of all workflows mentioned across these transcripts"></textarea>
                <button id="generateBtn">Generate Mind Map</button>
            </div>

            <div class="views-section">
                <h2>3. Saved Views</h2>
                <div class="view-controls">
                    <select id="viewSelect">
                        <option value="">-- Select a saved view --</option>
                    </select>
                    <button id="loadViewBtn">Load</button>
                    <button id="deleteViewBtn">Delete</button>
                </div>
                <div class="save-view">
                    <input type="text" id="viewNameInput" placeholder="View name">
                    <button id="saveViewBtn">Save Current View</button>
                </div>
            </div>
        </div>

        <div class="map-container">
            <h2 id="mapTitle">Mind Map</h2>
            <div id="mapWrapper">
                <div id="mermaidOutput"></div>
            </div>
            <div class="zoom-controls">
                <button id="zoomInBtn">Zoom In</button>
                <button id="zoomOutBtn">Zoom Out</button>
                <button id="resetZoomBtn">Reset</button>
            </div>
        </div>

        <div id="loading" class="hidden">
            <div class="spinner"></div>
            <p>Generating mind map...</p>
        </div>
    </div>

    <script src="/static/app.js"></script>
</body>
</html>
```

**Step 2: Commit**

```bash
git add frontend/index.html
git commit -m "feat: add frontend HTML structure"
```

---

## Task 7: Frontend CSS

**Files:**
- Create: `frontend/style.css`

**Step 1: Create the stylesheet**

Create `frontend/style.css`:

```css
* {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
}

body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: #f5f5f5;
    color: #333;
    line-height: 1.6;
}

.container {
    max-width: 1400px;
    margin: 0 auto;
    padding: 20px;
}

header {
    text-align: center;
    margin-bottom: 30px;
}

header h1 {
    color: #2c3e50;
    margin-bottom: 10px;
}

header p {
    color: #666;
}

.controls {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 20px;
    margin-bottom: 30px;
}

.controls > div {
    background: white;
    padding: 20px;
    border-radius: 8px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.controls h2 {
    font-size: 1rem;
    color: #2c3e50;
    margin-bottom: 15px;
    padding-bottom: 10px;
    border-bottom: 2px solid #3498db;
}

input[type="file"] {
    display: block;
    margin-bottom: 10px;
}

button {
    background: #3498db;
    color: white;
    border: none;
    padding: 10px 20px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
    margin-right: 5px;
    margin-bottom: 5px;
}

button:hover {
    background: #2980b9;
}

button:disabled {
    background: #bdc3c7;
    cursor: not-allowed;
}

#clearDocsBtn, #deleteViewBtn {
    background: #e74c3c;
}

#clearDocsBtn:hover, #deleteViewBtn:hover {
    background: #c0392b;
}

#uploadStatus {
    margin-top: 10px;
    font-size: 14px;
    color: #666;
}

textarea {
    width: 100%;
    height: 100px;
    padding: 10px;
    border: 1px solid #ddd;
    border-radius: 4px;
    resize: vertical;
    margin-bottom: 10px;
    font-family: inherit;
}

select {
    width: 100%;
    padding: 10px;
    border: 1px solid #ddd;
    border-radius: 4px;
    margin-bottom: 10px;
    font-size: 14px;
}

.view-controls {
    margin-bottom: 15px;
}

.save-view input {
    width: calc(100% - 150px);
    padding: 10px;
    border: 1px solid #ddd;
    border-radius: 4px;
    margin-right: 10px;
}

.map-container {
    background: white;
    border-radius: 8px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    padding: 20px;
    min-height: 500px;
}

.map-container h2 {
    margin-bottom: 15px;
    color: #2c3e50;
}

#mapWrapper {
    width: 100%;
    height: 600px;
    border: 1px solid #ddd;
    border-radius: 4px;
    overflow: hidden;
    background: #fafafa;
}

#mermaidOutput {
    width: 100%;
    height: 100%;
}

#mermaidOutput svg {
    width: 100%;
    height: 100%;
}

.zoom-controls {
    margin-top: 15px;
    text-align: center;
}

.zoom-controls button {
    background: #95a5a6;
}

.zoom-controls button:hover {
    background: #7f8c8d;
}

#loading {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(255,255,255,0.9);
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    z-index: 1000;
}

#loading.hidden {
    display: none;
}

.spinner {
    width: 50px;
    height: 50px;
    border: 5px solid #ddd;
    border-top-color: #3498db;
    border-radius: 50%;
    animation: spin 1s linear infinite;
}

@keyframes spin {
    to { transform: rotate(360deg); }
}

/* Mermaid diagram styling */
.node rect {
    fill: #3498db !important;
    stroke: #2980b9 !important;
}

.node .label {
    color: white !important;
}

.edgeLabel {
    background: white;
    padding: 2px 5px;
    font-size: 12px;
}
```

**Step 2: Commit**

```bash
git add frontend/style.css
git commit -m "feat: add frontend CSS styling"
```

---

## Task 8: Frontend JavaScript

**Files:**
- Create: `frontend/app.js`

**Step 1: Create the JavaScript application logic**

Create `frontend/app.js`:

```javascript
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
```

**Step 2: Commit**

```bash
git add frontend/app.js
git commit -m "feat: add frontend JavaScript with upload, generate, views, and zoom"
```

---

## Task 9: Integration Test

**Files:**
- None (manual testing)

**Step 1: Start the server**

Run from project root:
```bash
cd /Users/kyraatekwana/mindmap-generator
ANTHROPIC_API_KEY=your_key_here uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
```

**Step 2: Open browser**

Navigate to: `http://localhost:8000`

**Step 3: Test upload**

- Upload a .txt file with sample interview content
- Verify upload status shows success

**Step 4: Test generation**

- Enter prompt: "Map the main topics discussed"
- Click Generate
- Verify mind map renders with nodes and edges

**Step 5: Test zoom**

- Click Zoom In/Out/Reset
- Verify map responds to zoom controls

**Step 6: Test views**

- Enter a name and save the current view
- Change prompt and generate new map
- Load the saved view from dropdown
- Delete the view

**Step 7: Final commit**

```bash
git add -A
git commit -m "feat: complete MVP mind map generator"
```

---

## Task 10: Create README

**Files:**
- Create: `README.md`

**Step 1: Create README with usage instructions**

Create `README.md` at project root:

```markdown
# Prompt-Guided Mind Map Generator

Generate mind maps from research documents (PDFs, transcripts, notes) with custom analytical prompts.

## Quick Start

1. Install dependencies:
   ```bash
   pip install -r backend/requirements.txt
   brew install tesseract  # for PDF OCR
   ```

2. Set your Anthropic API key:
   ```bash
   export ANTHROPIC_API_KEY=your_key_here
   ```

3. Run the server:
   ```bash
   uvicorn backend.main:app --reload --port 8000
   ```

4. Open http://localhost:8000

## Usage

1. **Upload Documents**: Select PDF, TXT, MD, or DOCX files
2. **Enter Prompt**: Describe what connections you want to see (e.g., "Map all workflows mentioned")
3. **Generate**: Click to create the mind map
4. **Save Views**: Save different "cuts" of your data to compare perspectives

## Supported File Types

- `.pdf` (text-based and scanned with OCR)
- `.txt`
- `.md`
- `.docx`
```

**Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add README with usage instructions"
```

---

## Summary

10 tasks total covering:
1. Project setup & dependencies
2. Pydantic models
3. Document processor (with OCR)
4. LLM processor (Claude integration)
5. FastAPI application
6. Frontend HTML
7. Frontend CSS
8. Frontend JavaScript
9. Integration testing
10. README documentation

Each task follows TDD principles where applicable and includes commit steps.
