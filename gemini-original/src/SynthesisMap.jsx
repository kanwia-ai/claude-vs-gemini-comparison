import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Loader2,
  Sparkles,
  Search,
  FileText,
  Network,
  Info,
  X,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Move,
  Upload,
  Paperclip,
  Trash2,
  FileImage,
  Layout,
  Plus,
  Minus,
  RefreshCw,
  GitBranch,
  ArrowRight,
  Globe,
  Undo
} from 'lucide-react';

// --- Configuration ---
const MODEL_NAME = "gemini-2.5-flash-preview-09-2025";
const apiKey = ""; // Injected at runtime

// --- Custom Layout Engine (Horizontal Tree) ---
const calculateLayout = (visibleNodes, visibleEdges) => {
  if (visibleNodes.length === 0) return { nodes: [], edges: [], width: 0, height: 0 };

  const NODE_WIDTH = 280;
  const NODE_HEIGHT = 60;
  const LEVEL_GAP = 380;
  const SIBLING_GAP = 30;

  const adj = {};
  const inDegree = {};
  visibleNodes.forEach(n => {
    adj[n.id] = [];
    inDegree[n.id] = 0;
  });
  visibleEdges.forEach(e => {
    if (adj[e.source]) adj[e.source].push(e.target);
    if (inDegree[e.target] !== undefined) inDegree[e.target]++;
  });

  let rootId = visibleNodes.find(n => inDegree[n.id] === 0)?.id || visibleNodes[0].id;

  const levels = {};
  const nodeLevels = {};
  const queue = [{ id: rootId, level: 0 }];
  const visited = new Set([rootId]);

  while (queue.length > 0) {
    const { id, level } = queue.shift();
    nodeLevels[id] = level;
    if (!levels[level]) levels[level] = [];
    levels[level].push(id);

    if (adj[id]) {
      adj[id].forEach(childId => {
        if (!visited.has(childId)) {
          visited.add(childId);
          queue.push({ id: childId, level: level + 1 });
        }
      });
    }
  }

  visibleNodes.forEach(n => {
    if (!visited.has(n.id)) {
      const lvl = 1;
      nodeLevels[n.id] = lvl;
      if (!levels[lvl]) levels[lvl] = [];
      levels[lvl].push(n.id);
    }
  });

  const nodeY = {};
  const layoutNode = (nodeId, startY) => {
    const children = adj[nodeId] || [];
    if (children.length === 0) {
      nodeY[nodeId] = startY + NODE_HEIGHT / 2;
      return NODE_HEIGHT + SIBLING_GAP;
    }
    let totalHeight = 0;
    let childStartY = startY;
    children.forEach(childId => {
      const h = layoutNode(childId, childStartY);
      childStartY += h;
      totalHeight += h;
    });
    const firstChildY = nodeY[children[0]];
    const lastChildY = nodeY[children[children.length - 1]];
    nodeY[nodeId] = (firstChildY + lastChildY) / 2;
    return totalHeight;
  };

  layoutNode(rootId, 0);

  const layoutedNodes = visibleNodes.map(n => {
    const level = nodeLevels[n.id] || 0;
    return {
      ...n,
      x: level * LEVEL_GAP + 50,
      y: nodeY[n.id] || (Math.random() * 500)
    };
  });

  const maxWidth = Math.max(...Object.values(nodeLevels)) * LEVEL_GAP + NODE_WIDTH + 100;
  const maxHeight = Object.keys(nodeY).length * (NODE_HEIGHT + SIBLING_GAP) + 100;

  return { nodes: layoutedNodes, edges: visibleEdges, width: maxWidth, height: maxHeight };
};

// --- Components ---

const Tooltip = ({ x, y, content }) => (
  <div
    className="fixed z-50 max-w-xs bg-white text-slate-700 text-xs p-4 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-slate-100 pointer-events-none animate-in fade-in zoom-in-95 duration-200"
    style={{ left: x + 20, top: y + 20 }}
  >
    <div className="font-bold text-indigo-500 mb-1 uppercase tracking-wider text-[10px] flex items-center">
      <Sparkles className="w-3 h-3 mr-1" /> AI Reasoning
    </div>
    <div className="leading-relaxed font-medium">{content}</div>
  </div>
);

const GraphEdge = ({ source, target }) => {
  const startX = source.x + 240;
  const startY = source.y + 25;
  const endX = target.x;
  const endY = target.y + 25;
  const midX = (startX + endX) / 2;
  const pathData = `M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${endY}, ${endX} ${endY}`;

  return (
    <path
      d={pathData}
      fill="none"
      stroke="#cbd5e1"
      strokeWidth="2"
      strokeLinecap="round"
      className="transition-all duration-500 ease-in-out opacity-60"
    />
  );
};

const GraphNode = ({ node, onClick, onToggle, onHover, selected, hasChildren, isExpanded }) => {
  const isSelected = selected?.id === node.id;
  const isRoot = node.data.type === 'root';
  const isCategory = node.data.type === 'category';

  return (
    <div
      onClick={(e) => { e.stopPropagation(); onClick(node); }}
      onMouseEnter={(e) => onHover(node, e.clientX, e.clientY)}
      onMouseLeave={() => onHover(null)}
      style={{
        transform: `translate(${node.x}px, ${node.y}px)`,
        position: 'absolute',
        width: '260px',
        transition: 'transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)'
      }}
      className={`
        relative px-5 py-3 rounded-full text-left cursor-pointer group flex items-center justify-between
        transition-all duration-300
        ${isRoot
          ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-200 border-2 border-indigo-600'
          : isCategory
            ? 'bg-blue-50 text-blue-900 border border-blue-100 shadow-sm hover:shadow-md hover:bg-white'
            : 'bg-emerald-50 text-emerald-900 border border-emerald-100 shadow-sm hover:shadow-md hover:bg-white'
        }
        ${isSelected ? 'ring-4 ring-indigo-100 scale-105 z-10' : 'z-0'}
      `}
    >
      <div className="text-sm font-medium leading-snug truncate pr-2">
        {node.data.label}
      </div>

      {!isRoot && (
        <div className={`w-2 h-2 rounded-full shrink-0 ${isCategory ? 'bg-blue-400' : 'bg-emerald-400'}`} />
      )}

      {hasChildren && (
        <button
          onClick={(e) => { e.stopPropagation(); onToggle(node.id); }}
          className={`
            absolute -right-3 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full flex items-center justify-center shadow-md border transition-all duration-300 z-20
            ${isExpanded
                ? 'bg-white text-slate-400 border-slate-100 hover:scale-110'
                : 'bg-indigo-500 text-white border-indigo-500 hover:bg-indigo-600 hover:scale-110'
            }
          `}
        >
          {isExpanded ? <Minus className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
        </button>
      )}
    </div>
  );
};

// --- Main App ---
const SynthesisMap = () => {
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [expandedNodes, setExpandedNodes] = useState(new Set());

  // Undo/History State
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const [transcript, setTranscript] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [lensPrompt, setLensPrompt] = useState('');
  const [activeLens, setActiveLens] = useState('');

  // Node Actions State
  const [actionPrompt, setActionPrompt] = useState('');
  const [isProcessingAction, setIsProcessingAction] = useState(false);
  const [activeTab, setActiveTab] = useState('dive');
  const [isGlobalRefine, setIsGlobalRefine] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const [hoveredNode, setHoveredNode] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  const [scale, setScale] = useState(0.85);
  const [pan, setPan] = useState({ x: 50, y: 150 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const fileInputRef = useRef(null);

  // --- Graph Visibility Logic ---
  const visibleGraph = useMemo(() => {
    if (nodes.length === 0) return { nodes: [], edges: [] };

    const visibleNodeIds = new Set();
    const rootNodes = nodes.filter(n => !edges.find(e => e.target === n.id));
    const startNodes = rootNodes.length > 0 ? rootNodes : [nodes[0]];

    const traverse = (nodeId) => {
      visibleNodeIds.add(nodeId);
      if (expandedNodes.has(nodeId)) {
        const children = edges.filter(e => e.source === nodeId).map(e => e.target);
        children.forEach(traverse);
      }
    };

    startNodes.forEach(n => traverse(n.id));

    const vNodes = nodes.filter(n => visibleNodeIds.has(n.id));
    const vEdges = edges.filter(e => visibleNodeIds.has(e.source) && visibleNodeIds.has(e.target));

    return calculateLayout(vNodes, vEdges);
  }, [nodes, edges, expandedNodes]);

  const toggleNode = (nodeId) => {
    setExpandedNodes(prev => {
      const next = new Set(prev);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  };

  const handleNodeHover = (node, x, y) => {
    if (!node) {
      setHoveredNode(null);
      return;
    }
    if (node.data.summary) {
        setHoveredNode(node);
        setTooltipPos({ x, y });
    }
  };

  const hasChildren = (nodeId) => edges.some(e => e.source === nodeId);

  // --- History Management ---
  const pushHistory = (newNodes, newEdges) => {
    // If we are in the middle of history (undo state), cut off the future
    const newHistory = history.slice(0, historyIndex + 1);

    // Push new state
    newHistory.push({ nodes: newNodes, edges: newEdges });

    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      const prevIndex = historyIndex - 1;
      const prevState = history[prevIndex];

      setNodes(prevState.nodes);
      setEdges(prevState.edges);
      setHistoryIndex(prevIndex);

      // Optional: Auto-select/focus logic could go here
    }
  };

  // --- API Interactions ---

  const generateMap = async (overridePrompt = null) => {
    if (!transcript && attachments.length === 0) {
      setError("Please add some text or upload files.");
      return;
    }

    setLoading(true);
    setError(null);
    setSelectedNode(null);

    // Use overridePrompt if checking "Apply to all", otherwise use main lens input
    const effectivePrompt = overridePrompt || lensPrompt;
    const userProvidedLens = effectivePrompt && effectivePrompt.trim().length > 0;

    try {
      let systemPrompt = `
        You are an expert systems thinker creating a hierarchical Mind Map.
        Output MUST follow a strict hierarchy: Root -> Categories -> Leaves.

        CRITICAL: For every node, provide a "reasoning" field explaining WHY this connection was made.

        Output valid JSON:
        {
          "nodes": [{
            "id": "...",
            "label": "...",
            "type": "root|category|leaf",
            "summary": "Full context from source...",
            "reasoning": "Connected because..."
          }],
          "edges": [{ "source": "...", "target": "..." }]
        }
        Keep labels concise (max 5 words).
      `;

      if (userProvidedLens) {
        systemPrompt += `\nFOCUS: Structure the map strictly around this user lens: "${effectivePrompt}"`;
      } else {
        systemPrompt += `\nFOCUS: Identify the most prominent themes, core ideas, and structural connections present in the text. The Root node should be the Main Topic of the documents.`;
      }

      const parts = [];
      if (transcript) parts.push({ text: `TRANSCRIPT/NOTES:\n${transcript}\n\n` });
      attachments.forEach(file => {
        parts.push({ inlineData: { mimeType: file.mimeType, data: file.data } });
      });

      const finalPrompt = userProvidedLens
        ? `LENS PROMPT: ${effectivePrompt}`
        : `Generate a comprehensive mind map of the most important concepts in this data.`;

      parts.push({ text: finalPrompt });

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: parts }],
            systemInstruction: { parts: [{ text: systemPrompt }] },
            generationConfig: { responseMimeType: "application/json" }
          })
        }
      );

      if (!response.ok) throw new Error(`API Error: ${response.status}`);
      const data = await response.json();
      const resultText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      const parsedGraph = JSON.parse(resultText);

      const rawNodes = parsedGraph.nodes.map(n => ({
        id: n.id,
        data: {
            label: n.label,
            type: n.type,
            summary: n.summary,
            reasoning: n.reasoning || "Direct connection found in source text."
        }
      }));

      // Commit to State & History
      setNodes(rawNodes);
      setEdges(parsedGraph.edges);

      // Reset history on a fresh new map generation?
      // Or keep it so they can undo the entire map generation?
      // Let's treat a full generation as a new 'Base', but still undoable if they want to go back to prev map.
      pushHistory(rawNodes, parsedGraph.edges);

      const initialExpanded = new Set();
      const rootNode = rawNodes.find(n => n.data.type === 'root') || rawNodes[0];
      if (rootNode) initialExpanded.add(rootNode.id);

      setExpandedNodes(initialExpanded);

      setActiveLens(userProvidedLens ? effectivePrompt : "General Synthesis");
      setPan({ x: 50, y: 150 });
      setScale(0.9);

    } catch (err) {
      console.error(err);
      setError("Failed to generate map. " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleNodeAction = async () => {
    if (!selectedNode || !actionPrompt) return;

    // CASE 1: GLOBAL REFINE
    if (activeTab === 'refine' && isGlobalRefine) {
        await generateMap(actionPrompt);
        setActionPrompt('');
        return;
    }

    // CASE 2: LOCAL REFINE OR EXPAND
    setIsProcessingAction(true);
    try {
      let systemPrompt = '';
      let userMessage = '';

      if (activeTab === 'dive') {
        systemPrompt = `
          You are a collaborative researcher. The user wants to EXPAND on a node.
          Parent Node ID: "${selectedNode.id}"
          Parent Label: "${selectedNode.data.label}"
          User Query: "${actionPrompt}"

          Generate 3-5 NEW child nodes (leaves) that answer the query.
          Output JSON: { "nodes": [...], "edges": [...] }
          IMPORTANT: New edges must link to "${selectedNode.id}" as the source.
          Ensure new node IDs are unique.
        `;
        userMessage = `Expand on node "${selectedNode.data.label}": ${actionPrompt}`;
      } else {
        systemPrompt = `
          You are a collaborative researcher. The user wants to CORRECT this specific branch.
          Target Node ID: "${selectedNode.id}"
          Target Label: "${selectedNode.data.label}"
          User Correction: "${actionPrompt}"

          Regenerate the children of this node (or the node itself) to reflect the correction.
          Output JSON: { "nodes": [...], "edges": [...] }
          IMPORTANT: Connect new/updated nodes to the original parent of "${selectedNode.data.label}" if you replace the node itself, or to "${selectedNode.id}" if you replace children.
          Ensure connectivity.
        `;
        userMessage = `Correct/Regenerate node "${selectedNode.data.label}": ${actionPrompt}`;
      }

      const parts = [];
      if (transcript) parts.push({ text: `TRANSCRIPT/NOTES:\n${transcript}\n\n` });
      parts.push({ text: userMessage });

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: parts }],
            systemInstruction: { parts: [{ text: systemPrompt }] },
            generationConfig: { responseMimeType: "application/json" }
          })
        }
      );

      if (!response.ok) throw new Error(`API Error: ${response.status}`);
      const data = await response.json();
      const resultText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      const parsedGraph = JSON.parse(resultText);

      const newNodes = parsedGraph.nodes.map(n => ({
        id: n.id,
        data: {
            label: n.label,
            type: n.type,
            summary: n.summary,
            reasoning: n.reasoning
        }
      }));

      let finalNodesList = [];
      let finalEdgesList = [];

      if (activeTab === 'refine') {
         const getDescendants = (rootId, allEdges) => {
            let descendants = new Set();
            let stack = [rootId];
            while (stack.length > 0) {
                const current = stack.pop();
                const children = allEdges.filter(e => e.source === current).map(e => e.target);
                children.forEach(c => {
                    descendants.add(c);
                    stack.push(c);
                });
            }
            return descendants;
         };

         const descendantsToRemove = getDescendants(selectedNode.id, edges);
         const cleanedNodes = nodes.filter(n => !descendantsToRemove.has(n.id));
         const cleanedEdges = edges.filter(e => e.source !== selectedNode.id && !descendantsToRemove.has(e.target));

         const updatedNodeMap = new Map(newNodes.map(n => [n.id, n]));
         finalNodesList = cleanedNodes.map(n => updatedNodeMap.has(n.id) ? updatedNodeMap.get(n.id) : n);

         const existingIds = new Set(finalNodesList.map(n => n.id));
         const trulyNewNodes = newNodes.filter(n => !existingIds.has(n.id));

         finalNodesList = [...finalNodesList, ...trulyNewNodes];
         finalEdgesList = [...cleanedEdges, ...parsedGraph.edges];

      } else {
         finalNodesList = [...nodes, ...newNodes];
         finalEdgesList = [...edges, ...parsedGraph.edges];
      }

      // Update State & History
      setNodes(finalNodesList);
      setEdges(finalEdgesList);
      pushHistory(finalNodesList, finalEdgesList);

      setExpandedNodes(prev => new Set(prev).add(selectedNode.id));
      setActionPrompt('');

    } catch (err) {
      console.error(err);
    } finally {
      setIsProcessingAction(false);
    }
  };

  // --- Handlers ---
  const handleFileSelect = async (e) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      for (const file of newFiles) {
        if (file.type === 'text/plain' || file.name.endsWith('.md') || file.name.endsWith('.txt')) {
           const text = await file.text();
           setTranscript(prev => prev + `\n\n--- FILE: ${file.name} ---\n${text}`);
        } else {
           const reader = new FileReader();
           reader.onload = (e) => {
             const base64Data = e.target.result.split(',')[1];
             setAttachments(prev => [...prev, {
               name: file.name,
               mimeType: file.type,
               data: base64Data,
               size: file.size
             }]);
           };
           reader.readAsDataURL(file);
        }
      }
    }
  };

  return (
    <div className="flex h-screen w-full bg-white font-sans text-slate-900 overflow-hidden select-none">

      {/* Tooltip Overlay */}
      {hoveredNode && <Tooltip x={tooltipPos.x} y={tooltipPos.y} content={hoveredNode.data.reasoning} />}

      {/* --- Sidebar --- */}
      <div
        className={`${
          sidebarOpen ? 'w-[420px]' : 'w-0'
        } bg-white border-r border-slate-100 flex flex-col transition-all duration-300 ease-in-out relative flex-shrink-0 z-30 shadow-2xl shadow-slate-200/50`}
      >
        <div className={`flex flex-col h-full ${!sidebarOpen && 'invisible'}`}>
          <div className="p-8 pb-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="bg-indigo-600 p-2 rounded-xl text-white">
                <Network className="w-6 h-6" />
              </div>
              <div>
                <h1 className="font-bold text-2xl tracking-tight text-slate-900">Synthesis</h1>
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Research Engine</p>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-8 space-y-8 pb-10 scrollbar-hide">

            {/* Step 1 */}
            <div className="space-y-4">
              <label className="flex items-center text-sm font-bold text-slate-800">
                <span className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-xs mr-3">1</span>
                Sources & Files
              </label>

              <div
                onClick={() => fileInputRef.current?.click()}
                className="group border-2 border-dashed border-slate-200 rounded-2xl p-6 text-center hover:bg-slate-50 hover:border-indigo-400 cursor-pointer transition-all duration-300"
              >
                <div className="bg-white p-3 rounded-full inline-block shadow-sm mb-3 group-hover:scale-110 transition-transform">
                   <Upload className="w-6 h-6 text-indigo-500" />
                </div>
                <p className="text-sm text-slate-600 font-medium">Drop files to synthesize</p>
                <p className="text-xs text-slate-400 mt-1">PDF, TXT, Images</p>
                <input type="file" ref={fileInputRef} className="hidden" multiple accept=".txt,.md,.pdf,image/*" onChange={handleFileSelect} />
              </div>

              {attachments.length > 0 && (
                <div className="space-y-2">
                  {attachments.map((file, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs group hover:border-slate-200">
                      <div className="flex items-center truncate max-w-[200px]">
                        <FileImage className="w-4 h-4 mr-3 text-indigo-400" />
                        <span className="truncate text-slate-700 font-medium">{file.name}</span>
                      </div>
                      <button onClick={() => setAttachments(p => p.filter((_, idx) => idx !== i))} className="text-slate-300 hover:text-red-500 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Step 2 */}
            <div className="space-y-4">
              <label className="flex items-center text-sm font-bold text-slate-800">
                <span className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-xs mr-3">2</span>
                Context & Notes
              </label>
              <textarea
                className="w-full h-32 p-4 text-sm border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-50/50 focus:border-indigo-500 outline-none resize-none bg-slate-50 font-medium text-slate-600 transition-all placeholder:text-slate-400"
                placeholder="Paste interview transcripts or notes here..."
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
              />
               <button
                onClick={() => {
                    setTranscript(`Interviewer: Let's talk about where AI isn't being used.\nManager A: In HR, we still screen every resume manually. It takes hours.\nManager B: Agreed. In Legal, we also review every NDA manually, even the standard ones.\nManager A: Our coding team uses CoPilot, but the QA team is fully manual.`);
                    setLensPrompt("Identify all the opportunities where AI is not being used.");
                }}
                className="text-xs text-indigo-600 hover:text-indigo-700 font-bold flex items-center px-2"
              >
                <Sparkles className="w-3 h-3 mr-2" />
                Use Example Data
              </button>
            </div>

            {/* Step 3 */}
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <label className="flex items-center text-sm font-bold text-slate-800">
                  <span className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-xs mr-3">3</span>
                  The Lens
                </label>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide bg-slate-50 px-2 py-1 rounded-md border border-slate-100">Optional</span>
              </div>
              <input
                type="text"
                className="w-full p-4 text-sm border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-50/50 focus:border-indigo-500 outline-none bg-slate-50 font-medium transition-all shadow-sm"
                placeholder="Leave empty for general synthesis..."
                value={lensPrompt}
                onChange={(e) => setLensPrompt(e.target.value)}
              />
            </div>

            {error && (
              <div className="p-4 bg-red-50 text-red-600 text-xs rounded-2xl border border-red-100 font-medium">
                {error}
              </div>
            )}
          </div>

          <div className="p-6 border-t border-slate-50">
            <button
              onClick={() => generateMap()}
              disabled={loading || (!transcript && attachments.length === 0)}
              className={`w-full py-4 px-6 rounded-full flex items-center justify-center font-bold text-white shadow-xl shadow-indigo-200 transition-all transform hover:-translate-y-1 active:scale-95
                ${loading || (!transcript && attachments.length === 0)
                    ? 'bg-slate-300 cursor-not-allowed shadow-none'
                    : 'bg-indigo-600 hover:bg-indigo-700'}`}
            >
              {loading ? (
                <><Loader2 className="w-5 h-5 animate-spin mr-2" />Synthesizing...</>
              ) : (
                <><Sparkles className="w-5 h-5 mr-2" />Generate Map</>
              )}
            </button>
          </div>
        </div>

        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="absolute -right-10 top-8 bg-white border border-slate-100 p-2 rounded-full shadow-lg text-slate-400 hover:text-indigo-600 hover:scale-110 transition-all z-50"
        >
          {sidebarOpen ? <X className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
        </button>
      </div>

      {/* --- Main Canvas Area --- */}
      <div
        className="flex-1 relative h-full overflow-hidden bg-slate-50/50 cursor-move"
        onMouseDown={(e) => {
            if (e.target.tagName !== 'DIV' && e.target.tagName !== 'svg') return;
            setIsDragging(true);
            setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
        }}
        onMouseMove={(e) => {
            if (isDragging) setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
        }}
        onMouseUp={() => setIsDragging(false)}
        onMouseLeave={() => setIsDragging(false)}
        onWheel={(e) => {
            if (e.ctrlKey || e.metaKey) {
                e.preventDefault();
                const s = e.deltaY > 0 ? 0.9 : 1.1;
                setScale(Math.min(Math.max(0.2, scale * s), 2));
            } else {
                setPan(p => ({ x: p.x - e.deltaX, y: p.y - e.deltaY }));
            }
        }}
      >
        {activeLens && (
          <div className="absolute top-8 left-8 right-auto z-20 max-w-xl pointer-events-none">
            <div className="bg-white/80 backdrop-blur-md shadow-sm border border-slate-200 rounded-2xl p-4 flex items-center gap-4 animate-in slide-in-from-top-4 duration-500">
               <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600"><Layout className="w-5 h-5" /></div>
               <div>
                  <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Active Lens</h3>
                  <p className="text-sm font-bold text-slate-800">"{activeLens}"</p>
               </div>
            </div>
          </div>
        )}

        <div
          className="absolute origin-top-left"
          style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`, width: '100%', height: '100%' }}
        >
            <svg className="absolute top-0 left-0 w-[5000px] h-[5000px] pointer-events-none z-0">
                {visibleGraph.edges.map((edge, i) => {
                    const sourceNode = visibleGraph.nodes.find(n => n.id === edge.source);
                    const targetNode = visibleGraph.nodes.find(n => n.id === edge.target);
                    if (!sourceNode || !targetNode) return null;
                    return <GraphEdge key={i} source={sourceNode} target={targetNode} />;
                })}
            </svg>

            <div className="absolute top-0 left-0 w-full h-full z-10">
                {visibleGraph.nodes.map(node => (
                    <GraphNode
                        key={node.id}
                        node={node}
                        onClick={setSelectedNode}
                        onHover={handleNodeHover}
                        selected={selectedNode}
                        hasChildren={hasChildren(node.id)}
                        isExpanded={expandedNodes.has(node.id)}
                        onToggle={toggleNode}
                    />
                ))}
            </div>
        </div>

        {/* Controls */}
        <div className="absolute bottom-8 left-8 flex bg-white rounded-full shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-slate-100 z-20 p-1">
            <button
                className={`p-3 rounded-full transition-colors ${historyIndex > 0 ? 'hover:bg-slate-50 text-slate-500' : 'text-slate-300 cursor-not-allowed'}`}
                onClick={handleUndo}
                disabled={historyIndex <= 0}
            >
                <Undo className="w-5 h-5" />
            </button>
            <div className="w-px bg-slate-100 my-2"></div>
            <button className="p-3 hover:bg-slate-50 text-slate-500 rounded-full transition-colors" onClick={() => setScale(s => s + 0.1)}><ZoomIn className="w-5 h-5" /></button>
            <div className="w-px bg-slate-100 my-2"></div>
            <button className="p-3 hover:bg-slate-50 text-slate-500 rounded-full transition-colors" onClick={() => setScale(s => Math.max(0.2, s - 0.1))}><ZoomOut className="w-5 h-5" /></button>
            <div className="w-px bg-slate-100 my-2"></div>
            <button className="p-3 hover:bg-slate-50 text-slate-500 rounded-full transition-colors" onClick={() => { setPan({x: 50, y: 150}); setScale(0.9); }}><Move className="w-5 h-5" /></button>
        </div>

        {/* Floating Detail Panel - Now with Tabs */}
        {selectedNode && (
          <div className="absolute top-8 right-8 w-96 bg-white rounded-3xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.1)] border border-slate-100 overflow-hidden z-40 animate-in slide-in-from-right-10 fade-in duration-300 flex flex-col max-h-[85vh]">
            {/* Header */}
            <div className="bg-white p-6 pb-4 border-b border-slate-50 flex justify-between items-start shrink-0">
              <div>
                <span className={`inline-block px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide mb-2 ${
                  selectedNode.data.type === 'root' ? 'bg-indigo-100 text-indigo-700' :
                  selectedNode.data.type === 'category' ? 'bg-blue-100 text-blue-700' :
                  'bg-emerald-100 text-emerald-700'
                }`}>
                  {selectedNode.data.type || 'Concept'}
                </span>
                <h3 className="font-bold text-xl text-slate-800 leading-tight">
                  {selectedNode.data.label}
                </h3>
              </div>
              <button onClick={(e) => { e.stopPropagation(); setSelectedNode(null); }} className="p-2 bg-slate-50 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              <p className="text-sm text-slate-600 leading-relaxed font-medium">
                {selectedNode.data.summary || "No summary available."}
              </p>

              <div className="mt-5 p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100/50">
                  <h5 className="text-[10px] font-bold text-indigo-400 uppercase mb-2 flex items-center">
                    <Sparkles className="w-3 h-3 mr-1" /> Why this connects
                  </h5>
                  <p className="text-xs text-indigo-900/70 italic leading-relaxed">"{selectedNode.data.reasoning}"</p>
              </div>

              {/* Action Tabs */}
              <div className="mt-8">
                <div className="flex p-1 bg-slate-100 rounded-full mb-4">
                  <button
                    onClick={() => setActiveTab('dive')}
                    className={`flex-1 py-2 text-xs font-bold rounded-full transition-all ${activeTab === 'dive' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    Deep Dive (Add)
                  </button>
                  <button
                    onClick={() => setActiveTab('refine')}
                    className={`flex-1 py-2 text-xs font-bold rounded-full transition-all ${activeTab === 'refine' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    Refine (Fix)
                  </button>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-2 mb-2 justify-between">
                    <div className="flex items-center gap-2">
                        {activeTab === 'dive' ? (
                        <>
                            <div className="p-1.5 bg-emerald-100 text-emerald-600 rounded-lg"><GitBranch className="w-4 h-4" /></div>
                            <p className="text-xs font-bold text-slate-700">Expand this topic</p>
                        </>
                        ) : (
                        <>
                            <div className="p-1.5 bg-amber-100 text-amber-600 rounded-lg"><RefreshCw className="w-4 h-4" /></div>
                            <p className="text-xs font-bold text-slate-700">Fix/Regenerate</p>
                        </>
                        )}
                    </div>

                    {/* GLOBAL TOGGLE */}
                    {activeTab === 'refine' && (
                        <label className="flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                className="peer sr-only"
                                checked={isGlobalRefine}
                                onChange={(e) => setIsGlobalRefine(e.target.checked)}
                            />
                            <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600 relative"></div>
                            <span className="ml-2 text-xs font-bold text-slate-500 peer-checked:text-indigo-600 flex items-center">
                                <Globe className="w-3 h-3 mr-1" />
                                All
                            </span>
                        </label>
                    )}
                  </div>

                  <textarea
                      value={actionPrompt}
                      onChange={(e) => setActionPrompt(e.target.value)}
                      placeholder={activeTab === 'dive' ? "e.g. 'What specific tools did they mention?'" : (isGlobalRefine ? "e.g. 'Focus entirely on financial risks instead'" : "e.g. 'This is actually a financial risk...'")}
                      className="w-full text-sm border border-slate-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 resize-none h-24 bg-slate-50 transition-all placeholder:text-slate-400"
                  />

                  <button
                      onClick={handleNodeAction}
                      disabled={!actionPrompt || isProcessingAction}
                      className={`w-full py-3 rounded-xl text-white font-bold text-sm shadow-lg transition-all transform active:scale-95 flex items-center justify-center
                        ${!actionPrompt || isProcessingAction
                          ? 'bg-slate-300 shadow-none cursor-not-allowed'
                          : activeTab === 'dive'
                            ? 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200'
                            : 'bg-amber-500 hover:bg-amber-600 shadow-amber-200'
                        }`}
                  >
                      {isProcessingAction ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : (activeTab === 'dive' ? <Plus className="w-4 h-4 mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />)}
                      {activeTab === 'dive' ? 'Add Nodes' : (isGlobalRefine ? 'Regenerate Entire Map' : 'Regenerate Branch')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SynthesisMap;
