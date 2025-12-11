# Claude vs Gemini: AI Coding Comparison

An experiment comparing code output from Claude Code and Gemini for the same task: building a prompt-guided mind map generator.

## The Task

Build a mind map generator that:
- Accepts document uploads (PDF, TXT, MD, DOCX)
- Takes a user prompt to guide analysis (e.g., "map all workflows mentioned")
- Generates an interactive, zoomable mind map
- Allows saving multiple "views" of the same data

## Directory Structure

```
├── claude-v1-initial/       # Claude Code's first attempt (vanilla JS + Mermaid)
│   ├── backend/             # FastAPI backend with document processing
│   └── frontend/            # Simple HTML/CSS/JS with Mermaid.js
│
├── claude-v2-after-gemini/  # Claude Code after seeing Gemini's approach
│   ├── backend/             # Same FastAPI backend
│   └── frontend-react/      # React + Tailwind with custom canvas
│
├── gemini-original/         # Gemini's original output
│   └── src/                 # React component (frontend-only)
│
└── docs/                    # Project documentation and plans
```

## Comparison Summary

| Feature | Claude v1 | Claude v2 | Gemini |
|---------|-----------|-----------|--------|
| Framework | Vanilla JS | React + Tailwind | React + Tailwind |
| Visualization | Mermaid.js | Custom Canvas | Custom Canvas (SVG) |
| Pan/Zoom | Mermaid native | Mouse events | Mouse + wheel events |
| UI Design | Basic functional | DeckSense-inspired | Polished sidebar + canvas |
| Node Interaction | Click to highlight | Selection + detail panel | Selection + detail panel |
| Node Types | Generic | 5 color-coded types | 3 types (root/category/leaf) |
| Layout Algorithm | Mermaid auto | BFS hierarchical | Custom tree layout |
| Undo/History | No | Yes | Yes |
| Deep Dive/Refine | No | Yes | Yes (with global toggle) |
| AI Integration | Claude API | Claude API | Gemini API (native) |
| Lines of Code | ~300 | ~920 | ~750 |

## Key Observations

### Claude v1 (Initial)
- Built a working MVP in ~1 hour
- Functional but visually basic
- Used Mermaid.js for quick graph rendering
- Simple file upload and prompt interface

### Claude v2 (After Seeing Gemini)
- Rebuilt frontend with React + Vite + Tailwind
- Custom node/edge rendering with color-coded types
- Added sophisticated interactions (deep dive, refine)
- Inspired by DeckSense UI mockup

### Gemini (Original)
- Clean, polished UI out of the box
- Custom horizontal tree layout algorithm
- Collapsible nodes with expand/collapse buttons
- "AI Reasoning" tooltips explaining connections
- Global vs local refine toggle
- Frontend-only (calls Gemini API directly)
- Example data button for quick testing

## Running the Projects

### Claude v1
```bash
cd claude-v1-initial
pip install -r backend/requirements.txt
uvicorn backend.main:app --reload --port 8000
# Open frontend/index.html in browser
```

### Claude v2
```bash
cd claude-v2-after-gemini
pip install -r backend/requirements.txt
uvicorn backend.main:app --reload --port 8000

cd frontend-react
npm install
npm run dev
# Opens at http://localhost:5173
```

### Gemini
```bash
cd gemini-original
# This is a React component - integrate into a React project
# Requires: npm install lucide-react
# Set your Gemini API key in the component
```

## Context

This comparison explores how different AI coding assistants approach the same problem, and how seeing alternative solutions can improve output quality.

The prompt given was intentionally open-ended to see how each AI interprets requirements and makes design decisions.

## Notable Differences

| Aspect | Claude's Approach | Gemini's Approach |
|--------|-------------------|-------------------|
| Architecture | Full-stack (FastAPI + React) | Frontend-only (direct API calls) |
| File Processing | Server-side (PyMuPDF, OCR) | Client-side (FileReader) |
| Layout | BFS with manual positioning | Recursive tree algorithm |
| Edges | Straight lines | Bezier curves |
| Node Shape | Rectangles | Pill/capsule shape |
| Animations | CSS transitions | CSS + cubic-bezier easing |
