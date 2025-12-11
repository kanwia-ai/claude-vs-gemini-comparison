import io
from pathlib import Path
import fitz  # PyMuPDF
from docx import Document as DocxDocument
import pytesseract
from PIL import Image


def extract_text_from_txt(content: bytes) -> str:
    """Extract text from .txt or .md files."""
    try:
        return content.decode("utf-8", errors="ignore")
    except Exception as e:
        raise ValueError(f"Failed to decode text file: {str(e)}")


def extract_text_from_docx(content: bytes) -> str:
    """Extract text from .docx files."""
    try:
        doc = DocxDocument(io.BytesIO(content))
        paragraphs = [p.text for p in doc.paragraphs]
        return "\n".join(paragraphs)
    except Exception as e:
        raise ValueError(f"Failed to extract text from DOCX file: {str(e)}")


def extract_text_from_pdf(content: bytes) -> str:
    """Extract text from PDF, falling back to OCR if needed."""
    doc = None
    try:
        doc = fitz.open(stream=content, filetype="pdf")
        text_parts = []

        for page_num, page in enumerate(doc):
            try:
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
            except Exception as e:
                raise ValueError(f"Failed to extract text from PDF page {page_num + 1}: {str(e)}")

        return "\n\n".join(text_parts)
    except Exception as e:
        if "Failed to extract text from PDF page" in str(e):
            raise
        raise ValueError(f"Failed to process PDF file: {str(e)}")
    finally:
        if doc is not None:
            doc.close()


def extract_text(filename: str, content: bytes) -> str:
    """Extract text from a file based on its extension."""
    ext = Path(filename).suffix.lower()

    if ext in [".txt", ".md"]:
        extracted_text = extract_text_from_txt(content)
    elif ext == ".docx":
        extracted_text = extract_text_from_docx(content)
    elif ext == ".pdf":
        extracted_text = extract_text_from_pdf(content)
    else:
        raise ValueError(f"Unsupported file type: {ext}")

    # Validate that content is not empty
    if not extracted_text or not extracted_text.strip():
        raise ValueError(f"No text content could be extracted from {filename}")

    return extracted_text


def get_supported_extensions() -> list[str]:
    """Return list of supported file extensions."""
    return [".txt", ".md", ".docx", ".pdf"]
