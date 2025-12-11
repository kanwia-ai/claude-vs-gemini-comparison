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
