document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const graphSvg = document.getElementById('graph-svg');
    const statusText = document.getElementById('status-text');

    // Buttons
    const addNodeBtn = document.getElementById('add-node-btn');
    const removeNodeBtn = document.getElementById('remove-node-btn');
    const addEdgeBtn = document.getElementById('add-edge-btn');
    const removeEdgeBtn = document.getElementById('remove-edge-btn');
    const selectNodeBtn = document.getElementById('select-node-btn'); // Added
    const setStartBtn = document.getElementById('set-start-btn');
    const setEndBtn = document.getElementById('set-end-btn');
    const runBtn = document.getElementById('run-btn');
    const resetBtn = document.getElementById('reset-btn');

    // State
    let mode = 'none'; // 'add-node', 'remove-node', 'add-edge', 'set-start', 'set-end', 'select-node', 'remove-edge'
    let nodeCount = 0;
    let nodes = {}; // { id: { x, y, edges: [], element, textElement } }
    let edges = {}; // { 'node1-node2': { weight, element, textElement } }
    let startNodeId = null;
    let endNodeId = null;
    let edgeFromNode = null;
    let isDragging = false; // Added
    let draggedNodeId = null; // Added
    let offsetX, offsetY; // Added

    const buttons = {
        'add-node': addNodeBtn,
        'remove-node': removeNodeBtn,
        'add-edge': addEdgeBtn,
        'remove-edge': removeEdgeBtn,
        'select-node': selectNodeBtn, // Added
        'set-start': setStartBtn,
        'set-end': setEndBtn
    };

    function setMode(newMode) {
        // Deactivate previous button
        if (mode && buttons[mode]) {
            buttons[mode].classList.remove('active');
        }
        
        // If clicking the same button, toggle it off
        if (mode === newMode) {
            mode = 'none';
            statusText.textContent = '상태: 대기 중';
        } else {
            mode = newMode;
            // Activate new button
            if (buttons[mode]) {
                buttons[mode].classList.add('active');
            }
            statusText.textContent = `상태: ${getModeText(mode)}`;
        }
        edgeFromNode = null; // Reset edge selection on mode change
    }

    function getModeText(mode) {
        switch (mode) {
            case 'add-node': return '노드 추가 - 그래프 영역을 클릭하세요.';
            case 'remove-node': return '노드 삭제 - 삭제할 노드를 클릭하세요.';
            case 'add-edge': return '간선 연결 - 시작 노드를 클릭하세요.';
            case 'select-node': return '노드 선택 - 노드를 드래그하여 이동하세요.'; // Added
            case 'set-start': return '시작점 선택 - 시작 노드를 클릭하세요.';
            case 'set-end': return '종료점 선택 - 종료 노드를 클릭하세요.';
            case 'remove-edge': return '간선 제거 - 제거할 간선을 클릭하세요.';
            default: return '대기 중';
        }
    }

    // Event Listeners for buttons
    addNodeBtn.addEventListener('click', () => setMode('add-node'));
    removeNodeBtn.addEventListener('click', () => setMode('remove-node'));
    addEdgeBtn.addEventListener('click', () => setMode('add-edge'));
    removeEdgeBtn.addEventListener('click', () => setMode('remove-edge'));
    selectNodeBtn.addEventListener('click', () => setMode('select-node')); // Added
    setStartBtn.addEventListener('click', () => setMode('set-start'));
    setEndBtn.addEventListener('click', () => setMode('set-end'));
    runBtn.addEventListener('click', runDijkstra);
    resetBtn.addEventListener('click', resetGraph);

    graphSvg.addEventListener('click', (e) => {
        if (e.target.id !== 'graph-svg') return; // Click on background only
        if (mode === 'add-node') {
            const { x, y } = getSVGCoordinates(e);
            addNode(x, y);
        }
    });

    // Added mousemove, mouseup, mouseleave listeners to graphSvg for dragging
    graphSvg.addEventListener('mousemove', drag);
    document.addEventListener('mouseup', endDrag);
    document.addEventListener('mouseleave', endDrag);

    function getSVGCoordinates(e) {
        const pt = graphSvg.createSVGPoint();
        pt.x = e.clientX;
        pt.y = e.clientY;
        return pt.matrixTransform(graphSvg.getScreenCTM().inverse());
    }

    function addNode(x, y) {
        const nodeId = ++nodeCount;
        
        const nodeElement = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        nodeElement.setAttribute('id', `node-${nodeId}`);
        nodeElement.setAttribute('cx', x);
        nodeElement.setAttribute('cy', y);
        nodeElement.classList.add('node');

        const textElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textElement.setAttribute('x', x);
        textElement.setAttribute('y', y);
        textElement.textContent = nodeId;
        textElement.classList.add('node-label');

        graphSvg.appendChild(nodeElement);
        graphSvg.appendChild(textElement);

        nodes[nodeId] = { id: nodeId, x, y, edges: [], element: nodeElement, textElement };

        // Add event listener to the new node
        nodeElement.addEventListener('click', (e) => onNodeClick(nodeId, e)); // Modified
        nodeElement.addEventListener('mousedown', (e) => startDrag(nodeId, e)); // Modified
    }

    function onNodeClick(nodeId, e) { // Modified
        if (isDragging) return; // Prevent click event after drag
        e.stopPropagation(); // Prevent graphSvg click event // Added
        switch (mode) {
            case 'remove-node':
                removeNode(nodeId);
                break;
            case 'add-edge':
                if (!edgeFromNode) {
                    edgeFromNode = nodeId;
                    nodes[nodeId].element.style.fill = '#ffc107'; // Highlight selected node
                    statusText.textContent = '상태: 간선 연결 - 끝 노드를 클릭하세요.';
                } else {
                    if (edgeFromNode !== nodeId) {
                        const weight = prompt("간선 가중치를 입력하세요 (숫자):", "1");
                        if (weight && !isNaN(weight)) {
                            const parsedWeight = parseInt(weight);
                            if (parsedWeight <= 0) {
                                alert("음수 가중치는 허용되지 않습니다. 0 보다 큰 값을 입력해주세요.");
                            } else {
                                addEdge(edgeFromNode, nodeId, parsedWeight);
                            }
                        }
                    }
                    // Reset selection
                    nodes[edgeFromNode].element.style.fill = ''; // Reset color
                    edgeFromNode = null;
                    statusText.textContent = `상태: ${getModeText(mode)}`;
                }
                break;
            case 'set-start':
                setStartNode(nodeId);
                break;
            case 'set-end':
                setEndNode(nodeId);
                break;
        }
    }

    function removeNode(nodeId) {
        // Remove edges connected to this node
        const edgesToRemove = Object.keys(edges).filter(edgeKey => edgeKey.split('-').includes(String(nodeId)));
        edgesToRemove.forEach(removeEdgeByKey);

        // Remove node elements
        graphSvg.removeChild(nodes[nodeId].element);
        graphSvg.removeChild(nodes[nodeId].textElement);

        // Remove node from data
        delete nodes[nodeId];
    }
    
    function removeEdgeByKey(edgeKey) {
        if (edges[edgeKey]) {
            graphSvg.removeChild(edges[edgeKey].element);
            graphSvg.removeChild(edges[edgeKey].textElement);

            // Remove edge from connected nodes' edges array
            const [node1Id, node2Id] = edgeKey.split('-').map(Number);

            // Remove edge from connected nodes' edges array
            if (nodes[node1Id] && nodes[node1Id].edges) {
                nodes[node1Id].edges = nodes[node1Id].edges.filter(edge => edge.key !== edgeKey);
            }
            if (nodes[node2Id] && nodes[node2Id].edges) {
                nodes[node2Id].edges = nodes[node2Id].edges.filter(edge => edge.key !== edgeKey);
            }

            delete edges[edgeKey];
        }
    }


    function addEdge(node1Id, node2Id, weight) {
        const edgeKey = `${Math.min(node1Id, node2Id)}-${Math.max(node1Id, node2Id)}`;
        if (edges[edgeKey]) {
            alert('이미 두 노드 사이에 간선이 존재합니다.');
            return;
        }

        const node1 = nodes[node1Id];
        const node2 = nodes[node2Id];

        const edgeElement = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        edgeElement.setAttribute('x1', node1.x);
        edgeElement.setAttribute('y1', node1.y);
        edgeElement.setAttribute('x2', node2.x);
        edgeElement.setAttribute('y2', node2.y);
        edgeElement.classList.add('edge');
        
        const textX = (node1.x + node2.x) / 2;
        const textY = (node1.y + node2.y) / 2;
        const edgeLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        edgeLabel.setAttribute('x', textX);
        edgeLabel.setAttribute('y', textY);
        edgeLabel.textContent = weight;
        edgeLabel.classList.add('edge-label');

        // Insert edge behind nodes
        graphSvg.insertBefore(edgeElement, graphSvg.firstChild);
        graphSvg.insertBefore(edgeLabel, edgeElement.nextSibling);

        edgeElement.addEventListener('click', (e) => onEdgeClick(edgeKey, e));

        const edgeData = { weight, element: edgeElement, textElement: edgeLabel };
        edges[edgeKey] = edgeData;
        nodes[node1Id].edges.push({ to: node2Id, weight, key: edgeKey });
        nodes[node2Id].edges.push({ to: node1Id, weight, key: edgeKey });
    }

    function onEdgeClick(edgeKey, e) {
        e.stopPropagation(); // Prevent graphSvg click event
        if (mode === 'remove-edge') {
            removeEdgeByKey(edgeKey);
            setMode('none'); // Reset mode after removing edge
        }
    
        if (startNodeId) {
            nodes[startNodeId].element.classList.remove('start');
        }
        startNodeId = nodeId;
        nodes[nodeId].element.classList.add('start');
        statusText.textContent = `시작점: 노드 ${nodeId}`;
        setMode('none');
    }

    function setEndNode(nodeId) {
        if (endNodeId) {
            nodes[endNodeId].element.classList.remove('end');
        }
        endNodeId = nodeId;
        nodes[nodeId].element.classList.add('end');
        statusText.textContent = `시작점: 노드 ${startNodeId}, 종료점: 노드 ${endNodeId}`;
        setMode('none');
    }

    function resetGraph() {
        // Clear SVG
        while (graphSvg.firstChild) {
            graphSvg.removeChild(graphSvg.firstChild);
        }
        // Reset all state variables
        nodes = {};
        edges = {};
        nodeCount = 0;
        startNodeId = null;
        endNodeId = null;
        edgeFromNode = null;
        setMode('none');
        statusText.textContent = '상태: 모든 내용이 초기화되었습니다.';
    }
    
    runBtn.addEventListener('click', runDijkstra);

    function dijkstra(startId, endId) {
        let distances = {};
        let prev = {};
        let pq = new PriorityQueue();
        let visitedOrder = [];

        // Initialize distances and priority queue
        for (let id in nodes) {
            distances[id] = Infinity;
            prev[id] = null;
        }
        distances[startId] = 0;
        pq.enqueue(startId, 0);

        while (!pq.isEmpty()) {
            let { element: u } = pq.dequeue();
            visitedOrder.push(u);

            if (u == endId) break; // Found the end node

            nodes[u].edges.forEach(edge => {
                let v = edge.to;
                let weight = edge.weight;
                let newDist = distances[u] + weight;

                if (newDist < distances[v]) {
                    distances[v] = newDist;
                    prev[v] = u;
                    pq.enqueue(v, newDist);
                }
            });
        }
        
        // Reconstruct path
        let path = [];
        let current = endId;
        while (current !== null && prev[current] !== undefined) {
            path.unshift(current);
            if(current == startId) break;
            current = prev[current];
        }
        
        // Ensure the start node is in the path if a path exists
        if (path[0] != startId && prev[path[0]] == startId) {
             path.unshift(startId);
        }

        return { visitedOrder, path: path[0] == startId ? path : [] };
    }

    async function runDijkstra() {
        if (!startNodeId || !endNodeId) {
            alert('시작점과 종료점을 모두 선택해야 합니다.');
            return;
        }
        clearVisuals();

        const { visitedOrder, path } = dijkstra(startNodeId, endNodeId);

        // Animate visited nodes
        for (let i = 0; i < visitedOrder.length; i++) {
            const nodeId = visitedOrder[i];
            if (nodeId != startNodeId && nodeId != endNodeId) {
                nodes[nodeId].element.style.fill = 'orange';
                await new Promise(resolve => setTimeout(resolve, 150)); // Animation delay
            }
        }

        // Animate the final path
        if (path.length > 0) {
            for (let i = 0; i < path.length - 1; i++) {
                const u = path[i];
                const v = path[i + 1];
                const edgeKey = `${Math.min(u, v)}-${Math.max(u, v)}`;
                if (edges[edgeKey]) {
                    edges[edgeKey].element.classList.add('path');
                    await new Promise(resolve => setTimeout(resolve, 150));
                }
            }
            statusText.textContent = "최단 경로를 찾았습니다!";
        } else {
            statusText.textContent = "경로를 찾을 수 없습니다.";
        }
    }

    function clearVisuals() {
        for (let id in nodes) {
            const node = nodes[id];
            if (id != startNodeId && id != endNodeId) {
                node.element.style.fill = ''; // Reset to default
            }
        }
        for (let key in edges) {
            edges[key].element.classList.remove('path');
        }
    }
    
    // Node Dragging Functions
    function startDrag(nodeId, e) {
        if (mode !== 'select-node') return; // Only allow dragging when 'select-node' mode is active
        e.stopPropagation(); // Prevent graphSvg click event
        isDragging = true;
        draggedNodeId = nodeId;
        const node = nodes[nodeId];
        const svgCoords = getSVGCoordinates(e);
        offsetX = svgCoords.x - node.x;
        offsetY = svgCoords.y - node.y;
    }

    function drag(e) {
        if (!isDragging) return;
        e.preventDefault(); // Prevent default browser drag behavior

        const svgCoords = getSVGCoordinates(e);
        const newX = svgCoords.x - offsetX;
        const newY = svgCoords.y - offsetY;

        const node = nodes[draggedNodeId];
        node.x = newX;
        node.y = newY;

        node.element.setAttribute('cx', newX);
        node.element.setAttribute('cy', newY);
        node.textElement.setAttribute('x', newX);
        node.textElement.setAttribute('y', newY);

        updateEdgesForNode(draggedNodeId);
    }

    function endDrag() {
        isDragging = false;
        draggedNodeId = null;
    }

    function updateEdgesForNode(nodeId) {
        // Update all edges connected to this node
        for (const edgeKey in edges) {
            const [id1, id2] = edgeKey.split('-').map(Number);
            const edgeData = edges[edgeKey];

            if (id1 === nodeId || id2 === nodeId) {
                const node1 = nodes[id1];
                const node2 = nodes[id2];

                edgeData.element.setAttribute('x1', node1.x);
                edgeData.element.setAttribute('y1', node1.y);
                edgeData.element.setAttribute('x2', node2.x);
                edgeData.element.setAttribute('y2', node2.y);

                // Update edge label position
                const textX = (node1.x + node2.x) / 2;
                const textY = (node1.y + node2.y) / 2;
                edgeData.textElement.setAttribute('x', textX);
                edgeData.textElement.setAttribute('y', textY);
            }
        }
    }

    // Simple Priority Queue implementation
    class PriorityQueue {
        constructor() {
            this.collection = [];
        }
        enqueue(element, priority) {
            let contain = false;
            for (let i = 0; i < this.collection.length; i++) {
                if (this.collection[i].priority > priority) {
                    this.collection.splice(i, 0, { element, priority });
                    contain = true;
                    break;
                }
            }
            if (!contain) {
                this.collection.push({ element, priority });
            }
        }
        dequeue() {
            return this.collection.shift();
        }
        isEmpty() {
            return this.collection.length === 0;
        }
    }
});
