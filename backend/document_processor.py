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
