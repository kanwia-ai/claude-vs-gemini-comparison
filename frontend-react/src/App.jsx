import { useState, useRef, useCallback, useEffect } from 'react'
import {
  Network, Upload, FileText, Trash2, Sparkles, Loader2,
  X, ChevronRight, ZoomIn, ZoomOut, Move, Layout,
  GitBranch, RefreshCw, Plus, Globe, Undo
} from 'lucide-react'

// API Functions
const api = {
  async uploadFiles(files) {
    const formData = new FormData()
    for (const file of files) {
      formData.append('files', file)
    }
    const res = await fetch('/api/upload', { method: 'POST', body: formData })
    if (!res.ok) throw new Error((await res.json()).detail || 'Upload failed')
    return res.json()
  },

  async clearDocuments() {
    const res = await fetch('/api/documents', { method: 'DELETE' })
    return res.json()
  },

  async getDocuments() {
    const res = await fetch('/api/documents')
    return res.json()
  },

  async generateMindMap(prompt) {
    const res = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt })
    })
    if (!res.ok) throw new Error((await res.json()).detail || 'Generation failed')
    return res.json()
  },

  async getViews() {
    const res = await fetch('/api/views')
    return res.json()
  },

  async saveView(name, prompt, mapData) {
    const res = await fetch('/api/views', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, prompt, map_data: mapData })
    })
    return res.json()
  },

  async loadView(viewId) {
    const res = await fetch(`/api/views/${viewId}`)
    if (!res.ok) throw new Error('Failed to load view')
    return res.json()
  },

  async deleteView(viewId) {
    const res = await fetch(`/api/views/${viewId}`, { method: 'DELETE' })
    return res.json()
  }
}

// Calculate node positions in a hierarchical layout
function calculateNodePositions(nodes, edges) {
  if (!nodes.length) return []

  // Build adjacency map
  const children = {}
  const parents = {}
  nodes.forEach(n => { children[n.id] = []; parents[n.id] = null })
  edges.forEach(e => {
    if (children[e.source]) children[e.source].push(e.target)
    if (parents[e.target] !== undefined) parents[e.target] = e.source
  })

  // Find root nodes (no parents)
  const roots = nodes.filter(n => !parents[n.id])
  if (roots.length === 0 && nodes.length > 0) roots.push(nodes[0])

  // BFS to assign levels
  const levels = {}
  const queue = roots.map(r => ({ id: r.id, level: 0 }))
  const visited = new Set()

  while (queue.length > 0) {
    const { id, level } = queue.shift()
    if (visited.has(id)) continue
    visited.add(id)
    levels[id] = level

    ;(children[id] || []).forEach(childId => {
      if (!visited.has(childId)) {
        queue.push({ id: childId, level: level + 1 })
      }
    })
  }

  // Handle unvisited nodes
  nodes.forEach(n => {
    if (!visited.has(n.id)) {
      levels[n.id] = 0
    }
  })

  // Group by level
  const byLevel = {}
  Object.entries(levels).forEach(([id, level]) => {
    if (!byLevel[level]) byLevel[level] = []
    byLevel[level].push(id)
  })

  // Assign positions
  const positions = {}
  const startX = 400
  const startY = 100
  const levelGapX = 320
  const nodeGapY = 140

  Object.entries(byLevel).forEach(([level, ids]) => {
    const totalHeight = (ids.length - 1) * nodeGapY
    const startYOffset = -totalHeight / 2

    ids.forEach((id, idx) => {
      positions[id] = {
        x: startX + parseInt(level) * levelGapX,
        y: startY + 300 + startYOffset + idx * nodeGapY
      }
    })
  })

  return nodes.map(n => ({
    ...n,
    position: positions[n.id] || { x: 400, y: 300 }
  }))
}

// Graph Node Component
function GraphNode({ node, onClick, onHover, selected, isRoot }) {
  const isSelected = selected?.id === node.id

  return (
    <div
      className={`absolute cursor-pointer transition-all duration-200 ${isSelected ? 'z-20' : 'z-10'}`}
      style={{
        left: node.position.x,
        top: node.position.y,
        transform: 'translate(-50%, -50%)'
      }}
      onClick={(e) => { e.stopPropagation(); onClick(node) }}
      onMouseEnter={() => onHover(node)}
      onMouseLeave={() => onHover(null)}
    >
      <div className={`
        px-5 py-3 rounded-2xl border-2 shadow-lg transition-all duration-200
        ${isRoot
          ? 'bg-indigo-600 border-indigo-700 text-white min-w-[180px]'
          : 'bg-white border-slate-200 text-slate-800 hover:border-indigo-400 hover:shadow-xl min-w-[160px]'
        }
        ${isSelected ? 'ring-4 ring-indigo-200 scale-105' : ''}
      `}>
        <p className={`font-semibold text-sm text-center ${isRoot ? 'text-white' : 'text-slate-800'}`}>
          {node.label}
        </p>
        {node.description && (
          <p className={`text-xs mt-1 text-center ${isRoot ? 'text-indigo-200' : 'text-slate-500'}`}>
            {node.description.length > 50 ? node.description.slice(0, 50) + '...' : node.description}
          </p>
        )}
      </div>
    </div>
  )
}

// Graph Edge Component
function GraphEdge({ source, target, label }) {
  if (!source.position || !target.position) return null

  const x1 = source.position.x
  const y1 = source.position.y
  const x2 = target.position.x
  const y2 = target.position.y

  // Calculate control points for curved line
  const midX = (x1 + x2) / 2
  const midY = (y1 + y2) / 2
  const dx = x2 - x1
  const curvature = Math.min(Math.abs(dx) * 0.2, 50)

  const path = `M ${x1} ${y1} Q ${midX} ${y1 + curvature} ${x2} ${y2}`

  return (
    <g>
      <path
        d={path}
        fill="none"
        stroke="#cbd5e1"
        strokeWidth="2"
        markerEnd="url(#arrowhead)"
      />
      {label && (
        <text
          x={midX}
          y={midY - 10}
          textAnchor="middle"
          className="text-xs fill-slate-400"
          style={{ fontSize: '10px' }}
        >
          {label}
        </text>
      )}
    </g>
  )
}

// Tooltip Component
function Tooltip({ x, y, content }) {
  if (!content) return null

  return (
    <div
      className="fixed z-50 bg-slate-900 text-white text-xs px-3 py-2 rounded-lg shadow-xl max-w-xs pointer-events-none"
      style={{ left: x + 15, top: y + 15 }}
    >
      {content}
    </div>
  )
}

// Main App Component
function App() {
  // State
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [documents, setDocuments] = useState([])
  const [prompt, setPrompt] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [mapData, setMapData] = useState(null)
  const [views, setViews] = useState([])
  const [selectedView, setSelectedView] = useState('')
  const [viewName, setViewName] = useState('')
  const [selectedNode, setSelectedNode] = useState(null)
  const [hoveredNode, setHoveredNode] = useState(null)
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 })
  const [activeLens, setActiveLens] = useState('')

  // Canvas state
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [scale, setScale] = useState(0.9)
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })

  // Action panel state
  const [activeTab, setActiveTab] = useState('dive')
  const [actionPrompt, setActionPrompt] = useState('')
  const [isProcessingAction, setIsProcessingAction] = useState(false)
  const [isGlobalRefine, setIsGlobalRefine] = useState(false)

  // History for undo
  const [history, setHistory] = useState([])
  const [historyIndex, setHistoryIndex] = useState(-1)

  const fileInputRef = useRef(null)

  // Calculate positioned nodes
  const positionedNodes = mapData
    ? calculateNodePositions(mapData.nodes, mapData.edges)
    : []

  // Find root node
  const rootNodeId = positionedNodes.length > 0 ? positionedNodes[0].id : null

  // Load views on mount
  useEffect(() => {
    loadViews()
    loadDocuments()
  }, [])

  // Track mouse for tooltip
  useEffect(() => {
    const handleMouseMove = (e) => {
      setTooltipPos({ x: e.clientX, y: e.clientY })
    }
    window.addEventListener('mousemove', handleMouseMove)
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [])

  const loadViews = async () => {
    try {
      const data = await api.getViews()
      setViews(data.views || [])
    } catch (e) {
      console.error('Failed to load views:', e)
    }
  }

  const loadDocuments = async () => {
    try {
      const data = await api.getDocuments()
      setDocuments(data.documents || [])
    } catch (e) {
      console.error('Failed to load documents:', e)
    }
  }

  const handleFileSelect = async (e) => {
    const files = Array.from(e.target.files)
    if (files.length === 0) return

    setError(null)
    setLoading(true)

    try {
      await api.uploadFiles(files)
      await loadDocuments()
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
      e.target.value = ''
    }
  }

  const handleRemoveDocument = async (docId) => {
    // For now, clear all since backend doesn't have single delete
    await api.clearDocuments()
    await loadDocuments()
  }

  const handleClearAll = async () => {
    await api.clearDocuments()
    setDocuments([])
  }

  const handleGenerate = async () => {
    if (!prompt.trim() && documents.length === 0) {
      setError('Please upload documents or enter context')
      return
    }

    setError(null)
    setLoading(true)
    setActiveLens(prompt)

    try {
      const data = await api.generateMindMap(prompt || 'Create a comprehensive mind map of the key concepts')
      setMapData(data)
      setSelectedNode(null)

      // Add to history
      setHistory(prev => [...prev.slice(0, historyIndex + 1), data])
      setHistoryIndex(prev => prev + 1)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSaveView = async () => {
    if (!viewName.trim() || !mapData) return

    try {
      await api.saveView(viewName, prompt, mapData)
      setViewName('')
      await loadViews()
    } catch (e) {
      setError(e.message)
    }
  }

  const handleLoadView = async () => {
    if (!selectedView) return

    try {
      const view = await api.loadView(selectedView)
      setPrompt(view.prompt)
      setMapData(view.map_data)
      setActiveLens(view.prompt)
    } catch (e) {
      setError(e.message)
    }
  }

  const handleDeleteView = async () => {
    if (!selectedView) return

    try {
      await api.deleteView(selectedView)
      setSelectedView('')
      await loadViews()
    } catch (e) {
      setError(e.message)
    }
  }

  const handleUndo = () => {
    if (historyIndex > 0) {
      setHistoryIndex(prev => prev - 1)
      setMapData(history[historyIndex - 1])
    }
  }

  const handleNodeAction = async () => {
    if (!actionPrompt.trim() || !selectedNode) return

    setIsProcessingAction(true)
    setError(null)

    try {
      // Create a refined prompt based on the action
      let refinedPrompt = ''
      if (activeTab === 'dive') {
        refinedPrompt = `Based on the concept "${selectedNode.label}", expand on: ${actionPrompt}. Add new related nodes.`
      } else {
        if (isGlobalRefine) {
          refinedPrompt = actionPrompt
        } else {
          refinedPrompt = `Refine the concept "${selectedNode.label}": ${actionPrompt}`
        }
      }

      const data = await api.generateMindMap(refinedPrompt)

      if (activeTab === 'dive' && !isGlobalRefine) {
        // Merge new nodes with existing
        const newNodes = [...mapData.nodes]
        const newEdges = [...mapData.edges]

        data.nodes.forEach(n => {
          if (!newNodes.find(existing => existing.id === n.id)) {
            newNodes.push(n)
            // Connect to selected node
            newEdges.push({ source: selectedNode.id, target: n.id, relationship: 'expands' })
          }
        })

        const mergedData = { ...mapData, nodes: newNodes, edges: newEdges }
        setMapData(mergedData)
        setHistory(prev => [...prev.slice(0, historyIndex + 1), mergedData])
        setHistoryIndex(prev => prev + 1)
      } else {
        setMapData(data)
        setHistory(prev => [...prev.slice(0, historyIndex + 1), data])
        setHistoryIndex(prev => prev + 1)
      }

      setActionPrompt('')
    } catch (e) {
      setError(e.message)
    } finally {
      setIsProcessingAction(false)
    }
  }

  // Canvas mouse handlers
  const handleCanvasMouseDown = (e) => {
    if (e.target.closest('.node-element')) return
    setIsDragging(true)
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y })
    setSelectedNode(null)
  }

  const handleCanvasMouseMove = (e) => {
    if (isDragging) {
      setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y })
    }
  }

  const handleCanvasMouseUp = () => {
    setIsDragging(false)
  }

  const handleWheel = (e) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault()
      const delta = e.deltaY > 0 ? 0.9 : 1.1
      setScale(prev => Math.min(Math.max(0.2, prev * delta), 2))
    } else {
      setPan(prev => ({ x: prev.x - e.deltaX, y: prev.y - e.deltaY }))
    }
  }

  const resetView = () => {
    setPan({ x: 0, y: 0 })
    setScale(0.9)
  }

  return (
    <div className="flex h-screen w-screen bg-slate-50 overflow-hidden">
      {/* Tooltip */}
      {hoveredNode && (
        <Tooltip
          x={tooltipPos.x}
          y={tooltipPos.y}
          content={hoveredNode.description || hoveredNode.label}
        />
      )}

      {/* Sidebar */}
      <div className={`${sidebarOpen ? 'w-[420px]' : 'w-0'} bg-white border-r border-slate-100 flex flex-col transition-all duration-300 ease-in-out relative flex-shrink-0 z-30 shadow-2xl shadow-slate-200/50`}>
        <div className={`flex flex-col h-full ${!sidebarOpen && 'invisible'}`}>
          {/* Header */}
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

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto px-8 space-y-8 pb-10 scrollbar-hide">
            {/* Step 1: Upload */}
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
                <p className="text-xs text-slate-400 mt-1">PDF, TXT, MD, DOCX</p>
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  multiple
                  accept=".txt,.md,.pdf,.docx"
                  onChange={handleFileSelect}
                />
              </div>

              {documents.length > 0 && (
                <div className="space-y-2">
                  {documents.map((doc, i) => (
                    <div key={doc.id || i} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs group hover:border-slate-200">
                      <div className="flex items-center truncate max-w-[200px]">
                        <FileText className="w-4 h-4 mr-3 text-indigo-400" />
                        <span className="truncate text-slate-700 font-medium">{doc.filename}</span>
                      </div>
                      <button
                        onClick={() => handleRemoveDocument(doc.id)}
                        className="text-slate-300 hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={handleClearAll}
                    className="text-xs text-red-500 hover:text-red-600 font-medium"
                  >
                    Clear All
                  </button>
                </div>
              )}
            </div>

            {/* Step 2: Prompt */}
            <div className="space-y-4">
              <label className="flex items-center text-sm font-bold text-slate-800">
                <span className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-xs mr-3">2</span>
                Analysis Lens
              </label>
              <textarea
                className="w-full h-28 p-4 text-sm border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-50/50 focus:border-indigo-500 outline-none resize-none bg-slate-50 font-medium text-slate-600 transition-all placeholder:text-slate-400"
                placeholder="e.g., Map all workflows mentioned across these transcripts..."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
              />
            </div>

            {/* Step 3: Saved Views */}
            <div className="space-y-4">
              <label className="flex items-center text-sm font-bold text-slate-800">
                <span className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-xs mr-3">3</span>
                Saved Views
              </label>

              <select
                value={selectedView}
                onChange={(e) => setSelectedView(e.target.value)}
                className="w-full p-3 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 outline-none bg-slate-50"
              >
                <option value="">-- Select a saved view --</option>
                {views.map(v => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </select>

              <div className="flex gap-2">
                <button
                  onClick={handleLoadView}
                  disabled={!selectedView}
                  className="flex-1 py-2 px-4 text-xs font-bold rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 disabled:opacity-50 transition-all"
                >
                  Load
                </button>
                <button
                  onClick={handleDeleteView}
                  disabled={!selectedView}
                  className="py-2 px-4 text-xs font-bold rounded-lg bg-red-50 text-red-500 hover:bg-red-100 disabled:opacity-50 transition-all"
                >
                  Delete
                </button>
              </div>

              {mapData && (
                <div className="flex gap-2 mt-4 pt-4 border-t border-slate-100">
                  <input
                    type="text"
                    placeholder="View name..."
                    value={viewName}
                    onChange={(e) => setViewName(e.target.value)}
                    className="flex-1 p-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-100 outline-none"
                  />
                  <button
                    onClick={handleSaveView}
                    disabled={!viewName.trim()}
                    className="py-2 px-4 text-xs font-bold rounded-lg bg-indigo-100 text-indigo-600 hover:bg-indigo-200 disabled:opacity-50 transition-all"
                  >
                    Save
                  </button>
                </div>
              )}
            </div>

            {/* Error */}
            {error && (
              <div className="p-4 bg-red-50 text-red-600 text-xs rounded-2xl border border-red-100 font-medium">
                {error}
              </div>
            )}
          </div>

          {/* Generate Button */}
          <div className="p-6 border-t border-slate-50">
            <button
              onClick={handleGenerate}
              disabled={loading || documents.length === 0}
              className={`w-full py-4 px-6 rounded-full flex items-center justify-center font-bold text-white shadow-xl shadow-indigo-200 transition-all transform hover:-translate-y-1 active:scale-95
                ${loading || documents.length === 0
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

        {/* Sidebar Toggle */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="absolute -right-10 top-8 bg-white border border-slate-100 p-2 rounded-full shadow-lg text-slate-400 hover:text-indigo-600 hover:scale-110 transition-all z-50"
        >
          {sidebarOpen ? <X className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
        </button>
      </div>

      {/* Main Canvas */}
      <div
        className="flex-1 relative h-full overflow-hidden bg-slate-50/50 cursor-move"
        onMouseDown={handleCanvasMouseDown}
        onMouseMove={handleCanvasMouseMove}
        onMouseUp={handleCanvasMouseUp}
        onMouseLeave={handleCanvasMouseUp}
        onWheel={handleWheel}
      >
        {/* Active Lens Badge */}
        {activeLens && (
          <div className="absolute top-8 left-8 z-20 max-w-xl pointer-events-none">
            <div className="bg-white/80 backdrop-blur-md shadow-sm border border-slate-200 rounded-2xl p-4 flex items-center gap-4">
              <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
                <Layout className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Active Lens</h3>
                <p className="text-sm font-bold text-slate-800 truncate max-w-[300px]">"{activeLens}"</p>
              </div>
            </div>
          </div>
        )}

        {/* Canvas Content */}
        <div
          className="absolute origin-top-left"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
            width: '100%',
            height: '100%'
          }}
        >
          {/* SVG for edges */}
          <svg className="absolute top-0 left-0 w-[5000px] h-[5000px] pointer-events-none z-0">
            <defs>
              <marker
                id="arrowhead"
                markerWidth="10"
                markerHeight="7"
                refX="9"
                refY="3.5"
                orient="auto"
              >
                <polygon points="0 0, 10 3.5, 0 7" fill="#cbd5e1" />
              </marker>
            </defs>
            {positionedNodes.length > 0 && mapData?.edges.map((edge, i) => {
              const sourceNode = positionedNodes.find(n => n.id === edge.source)
              const targetNode = positionedNodes.find(n => n.id === edge.target)
              if (!sourceNode || !targetNode) return null
              return (
                <GraphEdge
                  key={i}
                  source={sourceNode}
                  target={targetNode}
                  label={edge.relationship}
                />
              )
            })}
          </svg>

          {/* Nodes */}
          <div className="absolute top-0 left-0 w-full h-full z-10">
            {positionedNodes.map(node => (
              <GraphNode
                key={node.id}
                node={node}
                onClick={setSelectedNode}
                onHover={setHoveredNode}
                selected={selectedNode}
                isRoot={node.id === rootNodeId}
              />
            ))}
          </div>
        </div>

        {/* Empty State */}
        {!mapData && !loading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <div className="bg-slate-100 p-6 rounded-full inline-block mb-4">
                <Network className="w-12 h-12 text-slate-300" />
              </div>
              <h3 className="text-lg font-bold text-slate-400">No mind map yet</h3>
              <p className="text-sm text-slate-400 mt-1">Upload documents and generate to see your synthesis</p>
            </div>
          </div>
        )}

        {/* Zoom Controls */}
        <div className="absolute bottom-8 left-8 flex bg-white rounded-full shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-slate-100 z-20 p-1">
          <button
            className={`p-3 rounded-full transition-colors ${historyIndex > 0 ? 'hover:bg-slate-50 text-slate-500' : 'text-slate-300 cursor-not-allowed'}`}
            onClick={handleUndo}
            disabled={historyIndex <= 0}
          >
            <Undo className="w-5 h-5" />
          </button>
          <div className="w-px bg-slate-100 my-2"></div>
          <button
            className="p-3 hover:bg-slate-50 text-slate-500 rounded-full transition-colors"
            onClick={() => setScale(s => Math.min(2, s + 0.1))}
          >
            <ZoomIn className="w-5 h-5" />
          </button>
          <div className="w-px bg-slate-100 my-2"></div>
          <button
            className="p-3 hover:bg-slate-50 text-slate-500 rounded-full transition-colors"
            onClick={() => setScale(s => Math.max(0.2, s - 0.1))}
          >
            <ZoomOut className="w-5 h-5" />
          </button>
          <div className="w-px bg-slate-100 my-2"></div>
          <button
            className="p-3 hover:bg-slate-50 text-slate-500 rounded-full transition-colors"
            onClick={resetView}
          >
            <Move className="w-5 h-5" />
          </button>
        </div>

        {/* Node Detail Panel */}
        {selectedNode && (
          <div className="absolute top-8 right-8 w-96 bg-white rounded-3xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.1)] border border-slate-100 overflow-hidden z-40 flex flex-col max-h-[85vh]">
            {/* Header */}
            <div className="bg-white p-6 pb-4 border-b border-slate-50 flex justify-between items-start shrink-0">
              <div>
                <span className="inline-block px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide mb-2 bg-indigo-100 text-indigo-700">
                  Concept
                </span>
                <h3 className="font-bold text-xl text-slate-800 leading-tight">
                  {selectedNode.label}
                </h3>
              </div>
              <button
                onClick={() => setSelectedNode(null)}
                className="p-2 bg-slate-50 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto flex-1">
              <p className="text-sm text-slate-600 leading-relaxed font-medium">
                {selectedNode.description || "No description available."}
              </p>

              {/* Action Tabs */}
              <div className="mt-8">
                <div className="flex p-1 bg-slate-100 rounded-full mb-4">
                  <button
                    onClick={() => setActiveTab('dive')}
                    className={`flex-1 py-2 text-xs font-bold rounded-full transition-all ${activeTab === 'dive' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    Deep Dive
                  </button>
                  <button
                    onClick={() => setActiveTab('refine')}
                    className={`flex-1 py-2 text-xs font-bold rounded-full transition-all ${activeTab === 'refine' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    Refine
                  </button>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-2 mb-2 justify-between">
                    <div className="flex items-center gap-2">
                      {activeTab === 'dive' ? (
                        <>
                          <div className="p-1.5 bg-emerald-100 text-emerald-600 rounded-lg">
                            <GitBranch className="w-4 h-4" />
                          </div>
                          <p className="text-xs font-bold text-slate-700">Expand this topic</p>
                        </>
                      ) : (
                        <>
                          <div className="p-1.5 bg-amber-100 text-amber-600 rounded-lg">
                            <RefreshCw className="w-4 h-4" />
                          </div>
                          <p className="text-xs font-bold text-slate-700">Fix/Regenerate</p>
                        </>
                      )}
                    </div>

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
                    placeholder={activeTab === 'dive'
                      ? "e.g., 'What specific tools did they mention?'"
                      : (isGlobalRefine
                        ? "e.g., 'Focus entirely on financial risks instead'"
                        : "e.g., 'This is actually a financial risk...'")}
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
                    {isProcessingAction ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : activeTab === 'dive' ? (
                      <Plus className="w-4 h-4 mr-2" />
                    ) : (
                      <RefreshCw className="w-4 h-4 mr-2" />
                    )}
                    {activeTab === 'dive' ? 'Add Nodes' : (isGlobalRefine ? 'Regenerate Map' : 'Regenerate Branch')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default App
