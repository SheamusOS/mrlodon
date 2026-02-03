const svg = document.getElementById("graph");
const undoButton = document.getElementById("undo-btn");
const redoButton = document.getElementById("redo-btn");
const edgePanel = document.getElementById("edge-panel");
const weightSlider = document.getElementById("weight-slider");
const weightValue = document.getElementById("weight-value");

const NODE_WIDTH = 170;
const NODE_HEIGHT = 90;
const PORT_RADIUS = 6;
const PORT_HIT_RADIUS = 16;

let archetypes = {};
let graph = null;
let selectedEdgeId = null;
let dragState = null;
let ghostState = null;

const history = [];
let historyIndex = -1;

const svgNs = "http://www.w3.org/2000/svg";

const deepClone = (value) => JSON.parse(JSON.stringify(value));

const loadData = async () => {
  const [graphRes, archetypeRes] = await Promise.all([
    fetch("../data/graph_aphex_001.json"),
    fetch("../data/archetypes.json"),
  ]);
  const graphData = await graphRes.json();
  const archetypeData = await archetypeRes.json();

  archetypes = Object.fromEntries(
    archetypeData.archetypes.map((type) => [type.id, type])
  );
  graph = graphData;

  pushHistory();
  render();
};

const pushHistory = () => {
  if (!graph) {
    return;
  }
  const snapshot = deepClone(graph);
  history.splice(historyIndex + 1);
  history.push(snapshot);
  historyIndex = history.length - 1;
  updateHistoryButtons();
};

const updateHistoryButtons = () => {
  undoButton.disabled = historyIndex <= 0;
  redoButton.disabled = historyIndex >= history.length - 1;
};

const undo = () => {
  if (historyIndex <= 0) {
    return;
  }
  historyIndex -= 1;
  graph = deepClone(history[historyIndex]);
  selectedEdgeId = null;
  updateHistoryButtons();
  render();
};

const redo = () => {
  if (historyIndex >= history.length - 1) {
    return;
  }
  historyIndex += 1;
  graph = deepClone(history[historyIndex]);
  selectedEdgeId = null;
  updateHistoryButtons();
  render();
};

const createSvgElement = (tag, attrs = {}) => {
  const el = document.createElementNS(svgNs, tag);
  Object.entries(attrs).forEach(([key, value]) => {
    el.setAttribute(key, value);
  });
  return el;
};

const getNodePorts = (node) => {
  const archetype = archetypes[node.type];
  return archetype?.ports ?? [];
};

const getPortPosition = (node, port) => {
  const ports = getNodePorts(node).filter((item) => item.kind === port.kind);
  const index = ports.findIndex((item) => item.id === port.id);
  const total = ports.length;
  const offsetY = ((index + 1) / (total + 1)) * NODE_HEIGHT;
  const x = port.kind === "input" ? node.x : node.x + NODE_WIDTH;
  const y = node.y + offsetY;
  return { x, y };
};

const getPortPositionById = (nodeId, portId) => {
  const node = graph.nodes.find((item) => item.id === nodeId);
  if (!node) {
    return null;
  }
  const port = getNodePorts(node).find((item) => item.id === portId);
  if (!port) {
    return null;
  }
  return getPortPosition(node, port);
};

const getPortFromEvent = (event) => {
  const target = event.target.closest(".port");
  if (!target) {
    return null;
  }
  const nodeId = target.getAttribute("data-node");
  const portId = target.getAttribute("data-port");
  const kind = target.getAttribute("data-kind");
  return { nodeId, portId, kind };
};

const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

const findClosestPort = (point, kind) => {
  let closest = null;
  graph.nodes.forEach((node) => {
    getNodePorts(node)
      .filter((port) => port.kind === kind)
      .forEach((port) => {
        const pos = getPortPosition(node, port);
        const dist = distance(point, pos);
        if (dist <= PORT_HIT_RADIUS && (!closest || dist < closest.distance)) {
          closest = { nodeId: node.id, portId: port.id, kind, distance: dist };
        }
      });
  });
  return closest;
};

const setSelectedEdge = (edgeId) => {
  selectedEdgeId = edgeId;
  const edge = graph.edges.find((item) => item.id === edgeId);
  if (edge) {
    edgePanel.hidden = false;
    weightSlider.value = edge.weight.toFixed(2);
    weightValue.textContent = edge.weight.toFixed(2);
  } else {
    edgePanel.hidden = true;
  }
  render();
};

const render = () => {
  while (svg.firstChild) {
    svg.removeChild(svg.firstChild);
  }

  const edgesGroup = createSvgElement("g", { class: "edges" });
  graph.edges.forEach((edge) => {
    const fromPos = getPortPositionById(edge.from.node, edge.from.port);
    const toPos = getPortPositionById(edge.to.node, edge.to.port);
    if (!fromPos || !toPos) {
      return;
    }
    const midX = (fromPos.x + toPos.x) / 2;
    const path = createSvgElement("path", {
      d: `M ${fromPos.x} ${fromPos.y} C ${midX} ${fromPos.y} ${midX} ${toPos.y} ${toPos.x} ${toPos.y}`,
      class: edge.id === selectedEdgeId ? "edge edge--selected" : "edge",
      "data-edge": edge.id,
    });
    edgesGroup.appendChild(path);

    const weightLabel = createSvgElement("text", {
      x: midX,
      y: (fromPos.y + toPos.y) / 2 - 8,
      class: "edge-weight",
      "text-anchor": "middle",
    });
    weightLabel.textContent = edge.weight.toFixed(2);
    edgesGroup.appendChild(weightLabel);
  });
  svg.appendChild(edgesGroup);

  const nodesGroup = createSvgElement("g", { class: "nodes" });
  graph.nodes.forEach((node) => {
    const nodeGroup = createSvgElement("g", {
      class: "node",
      transform: `translate(${node.x}, ${node.y})`,
      "data-node": node.id,
    });

    const rect = createSvgElement("rect", {
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
    });

    const title = createSvgElement("text", {
      x: 12,
      y: 24,
      class: "node-title",
    });
    title.textContent = node.label;

    const typeLabel = createSvgElement("text", {
      x: 12,
      y: 44,
      fill: "#9aa4c7",
    });
    typeLabel.textContent = archetypes[node.type]?.label ?? node.type;

    nodeGroup.appendChild(rect);
    nodeGroup.appendChild(title);
    nodeGroup.appendChild(typeLabel);

    getNodePorts(node).forEach((port) => {
      const pos = getPortPosition(node, port);
      const portCircle = createSvgElement("circle", {
        cx: pos.x,
        cy: pos.y,
        r: PORT_RADIUS,
        class: `port port--${port.kind}`,
        "data-node": node.id,
        "data-port": port.id,
        "data-kind": port.kind,
      });
      nodesGroup.appendChild(portCircle);

      const portLabel = createSvgElement("text", {
        x: port.kind === "input" ? pos.x + 10 : pos.x - 10,
        y: pos.y + 4,
        "text-anchor": port.kind === "input" ? "start" : "end",
        fill: "#8f97b5",
        "font-size": "11",
      });
      portLabel.textContent = port.label;
      nodesGroup.appendChild(portLabel);
    });

    nodesGroup.appendChild(nodeGroup);
  });
  svg.appendChild(nodesGroup);

  if (ghostState) {
    const ghostPath = createSvgElement("path", {
      d: `M ${ghostState.start.x} ${ghostState.start.y} L ${ghostState.current.x} ${ghostState.current.y}`,
      class: "ghost-edge",
    });
    svg.appendChild(ghostPath);
  }
};

const getPointerPosition = (event) => {
  const rect = svg.getBoundingClientRect();
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  };
};

const beginNodeDrag = (event) => {
  const nodeGroup = event.target.closest(".node");
  if (!nodeGroup) {
    return;
  }
  const nodeId = nodeGroup.getAttribute("data-node");
  const node = graph.nodes.find((item) => item.id === nodeId);
  if (!node) {
    return;
  }
  const pointer = getPointerPosition(event);
  dragState = {
    nodeId,
    offsetX: pointer.x - node.x,
    offsetY: pointer.y - node.y,
  };
};

const beginGhostDrag = (event) => {
  const port = getPortFromEvent(event);
  if (!port || port.kind !== "output") {
    return;
  }
  const node = graph.nodes.find((item) => item.id === port.nodeId);
  if (!node) {
    return;
  }
  const start = getPortPosition(node, { id: port.portId, kind: port.kind });
  ghostState = {
    from: port,
    start,
    current: start,
    hoveredPort: null,
  };
};

const updateGhostDrag = (event) => {
  if (!ghostState) {
    return;
  }
  const pointer = getPointerPosition(event);
  ghostState.current = pointer;
  const closest = findClosestPort(pointer, "input");
  ghostState.hoveredPort = closest;
  render();

  document.querySelectorAll(".port").forEach((port) => {
    port.classList.remove("port--hover");
  });
  if (closest) {
    const selector = `.port[data-node="${closest.nodeId}"][data-port="${closest.portId}"]`;
    const portElement = svg.querySelector(selector);
    if (portElement) {
      portElement.classList.add("port--hover");
    }
  }
};

const endGhostDrag = () => {
  if (!ghostState) {
    return;
  }
  const target = ghostState.hoveredPort;
  if (target) {
    const edgeId = `edge-${Date.now()}`;
    graph.edges.push({
      id: edgeId,
      from: { node: ghostState.from.nodeId, port: ghostState.from.portId },
      to: { node: target.nodeId, port: target.portId },
      weight: 0.5,
    });
    pushHistory();
  }
  ghostState = null;
  document.querySelectorAll(".port").forEach((port) => {
    port.classList.remove("port--hover");
  });
  render();
};

const updateNodeDrag = (event) => {
  if (!dragState) {
    return;
  }
  const pointer = getPointerPosition(event);
  const node = graph.nodes.find((item) => item.id === dragState.nodeId);
  if (!node) {
    return;
  }
  node.x = pointer.x - dragState.offsetX;
  node.y = pointer.y - dragState.offsetY;
  render();
};

const endNodeDrag = () => {
  if (!dragState) {
    return;
  }
  dragState = null;
  pushHistory();
};

const handleEdgeClick = (event) => {
  const path = event.target.closest(".edge");
  if (!path) {
    return;
  }
  const edgeId = path.getAttribute("data-edge");
  if (edgeId) {
    setSelectedEdge(edgeId);
  }
};

const handleCanvasClick = (event) => {
  if (event.target.closest(".edge")) {
    return;
  }
  if (!event.target.closest(".port")) {
    selectedEdgeId = null;
    edgePanel.hidden = true;
    render();
  }
};

undoButton.addEventListener("click", undo);
redoButton.addEventListener("click", redo);

weightSlider.addEventListener("input", (event) => {
  if (!selectedEdgeId) {
    return;
  }
  const edge = graph.edges.find((item) => item.id === selectedEdgeId);
  if (!edge) {
    return;
  }
  const value = Number(event.target.value);
  edge.weight = value;
  weightValue.textContent = value.toFixed(2);
  render();
});

weightSlider.addEventListener("change", () => {
  if (selectedEdgeId) {
    pushHistory();
  }
});

svg.addEventListener("pointerdown", (event) => {
  if (event.target.closest(".port")) {
    beginGhostDrag(event);
    return;
  }
  if (event.target.closest(".node")) {
    beginNodeDrag(event);
    return;
  }
});

svg.addEventListener("pointermove", (event) => {
  updateNodeDrag(event);
  updateGhostDrag(event);
});

svg.addEventListener("pointerup", () => {
  endNodeDrag();
  endGhostDrag();
});

svg.addEventListener("pointerleave", () => {
  endNodeDrag();
  endGhostDrag();
});

svg.addEventListener("click", (event) => {
  handleEdgeClick(event);
  handleCanvasClick(event);
});

loadData();
