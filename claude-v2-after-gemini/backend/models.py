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
