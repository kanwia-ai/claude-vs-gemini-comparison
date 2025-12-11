import json
import re
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
    if not documents_content or not documents_content.strip():
        raise ValueError("documents_content cannot be empty")
    if not user_prompt or not user_prompt.strip():
        raise ValueError("user_prompt cannot be empty")

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
