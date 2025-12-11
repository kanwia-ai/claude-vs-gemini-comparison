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
