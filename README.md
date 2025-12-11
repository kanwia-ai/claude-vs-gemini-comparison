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
├── gemini-original/         # [Coming soon] Gemini's original output
│
└── docs/                    # Project documentation and plans
```

## Comparison Summary

| Feature | Claude v1 | Claude v2 | Gemini |
|---------|-----------|-----------|--------|
| Framework | Vanilla JS | React + Tailwind | TBD |
| Visualization | Mermaid.js | Custom Canvas | TBD |
| Pan/Zoom | Mermaid native | Mouse events | TBD |
| UI Design | Basic functional | DeckSense-inspired | TBD |
| Node Interaction | Click to highlight | Selection + detail panel | TBD |
| Lines of Code | ~300 | ~920 | TBD |

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
*Coming soon*

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

## Context

This comparison explores how different AI coding assistants approach the same problem, and how seeing alternative solutions can improve output quality.

The prompt given was intentionally open-ended to see how each AI interprets requirements and makes design decisions.
