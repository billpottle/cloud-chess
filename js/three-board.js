(function() {
    const BOARD_SIZE = 10;
    const STORAGE_KEY = 'cloudChessRenderMode';
    const PIECE_SET_KEY = 'cloudChess3DPieceSet';
    const LIGHT_COLOR = 0xd8b77a;
    const DARK_COLOR = 0x8a5632;
    const EDGE_COLOR = 0x4c2f1f;
    const SELECT_COLOR = 0xffd166;
    const MOVE_COLOR = 0x2f9e44;
    const ILLEGAL_COLOR = 0xef476f;
    const AR_DEFAULT_SCALE = 0.065;
    const AR_MIN_SCALE = 0.035;
    const AR_MAX_SCALE = 0.18;
    const AR_BOARD_HALF_SIZE = 5.7;
    const REALISTIC_MODEL_PATHS = {
        pawn: 'assets/models/realistic/pawn.glb',
        rook: 'assets/models/realistic/rook.glb',
        knight: 'assets/models/realistic/knight.glb',
        bishop: 'assets/models/realistic/bishop.glb',
        queen: 'assets/models/realistic/queen.glb',
        king: 'assets/models/realistic/king.glb'
    };

    class CloudChess3D {
        constructor() {
            this.game = null;
            this.wrapper = null;
            this.container = null;
            this.scene = null;
            this.camera = null;
            this.renderer = null;
            this.raycaster = null;
            this.pointer = null;
            this.boardGroup = null;
            this.pieceGroup = null;
            this.boardRoot = null;
            this.boardPickMesh = null;
            this.squareMeshes = [];
            this.pieceMeshes = [];
            this.mode = localStorage.getItem(STORAGE_KEY) === '3d' ? '3d' : '2d';
            this.pieceSet = ['sculpted', 'realistic'].includes(localStorage.getItem(PIECE_SET_KEY))
                ? localStorage.getItem(PIECE_SET_KEY)
                : 'marked';
            this.dragging = false;
            this.lastPointer = null;
            this.orbitAngle = -Math.PI / 4;
            this.elevation = 1.08;
            this.radius = 15.5;
            this.animationFrame = null;
            this.resizeObserver = null;
            this.arSession = null;
            this.arSupported = false;
            this.arSupportChecked = false;
            this.arHitTestSource = null;
            this.arHitTestSourceRequested = false;
            this.arViewerSpace = null;
            this.arReticle = null;
            this.arPlaced = false;
            this.xrController = null;
            this.xrControllers = [];
            this.arActiveController = null;
            this.arCursor = null;
            this.arPointerLines = [];
            this.arHandlesGroup = null;
            this.arHandleMeshes = [];
            this.arDrag = null;
            this.arSelectSuppressed = false;
            this.arLastHit = null;
            this.normalSceneBackground = null;
            this.normalSceneFog = null;
            this.modelLoader = null;
            this.modelCache = {};
            this.modelPromises = {};
            this.modelFailures = new Set();
            this.modelRefreshQueued = new Set();
        }

        attach(game) {
            this.game = game;
            this.wrapper = document.querySelector('.board-wrapper');
            const board = document.getElementById('board');
            if (!this.wrapper || !board || !window.THREE) {
                return;
            }

            this.createToggle();
            this.createScene();
            this.syncFromGame(game);
            this.applyMode();
        }

        createToggle() {
            if (document.getElementById('render-mode-toggle')) {
                return;
            }

            const toggle = document.createElement('div');
            toggle.className = 'render-mode-toggle segmented-control';
            toggle.id = 'render-mode-toggle';
            toggle.setAttribute('role', 'group');
            toggle.setAttribute('aria-label', 'Board view');
            toggle.innerHTML = `
                <button type="button" class="render-mode-option" data-render-mode="2d">2D</button>
                <button type="button" class="render-mode-option" data-render-mode="3d">3D</button>
            `;

            const actions = document.querySelector('.game-actions');
            if (actions) {
                actions.insertBefore(toggle, actions.firstChild);
                if (!document.getElementById('piece-set-select')) {
                    const setSelect = document.createElement('select');
                    setSelect.id = 'piece-set-select';
                    setSelect.className = 'piece-set-select';
                    setSelect.setAttribute('aria-label', '3D piece set');
                    setSelect.innerHTML = `
                        <option value="marked">Marked set</option>
                        <option value="sculpted">Sculpted set</option>
                        <option value="realistic">Realistic beta</option>
                    `;
                    setSelect.value = this.pieceSet;
                    setSelect.addEventListener('change', () => this.setPieceSet(setSelect.value));
                    actions.insertBefore(setSelect, toggle.nextSibling);
                }
                if (!document.getElementById('three-fullscreen-btn')) {
                    const fullButton = document.createElement('button');
                    fullButton.type = 'button';
                    fullButton.id = 'three-fullscreen-btn';
                    fullButton.className = 'game-btn three-fullscreen-btn';
                    fullButton.textContent = 'Full screen';
                    fullButton.addEventListener('click', () => this.toggleFullScreen());
                    actions.insertBefore(fullButton, document.getElementById('piece-set-select')?.nextSibling || toggle.nextSibling);
                    document.addEventListener('fullscreenchange', () => this.updateFullScreenState());
                }
                if (!document.getElementById('three-ar-btn')) {
                    const arButton = document.createElement('button');
                    arButton.type = 'button';
                    arButton.id = 'three-ar-btn';
                    arButton.className = 'game-btn three-ar-btn';
                    arButton.textContent = 'AR';
                    arButton.disabled = true;
                    arButton.title = 'Checking AR support';
                    arButton.addEventListener('click', () => this.toggleAR());
                    actions.insertBefore(arButton, document.getElementById('three-fullscreen-btn')?.nextSibling || toggle.nextSibling);
                }
            } else {
                this.wrapper.insertBefore(toggle, this.wrapper.firstChild);
                if (!document.getElementById('piece-set-select')) {
                    const setSelect = document.createElement('select');
                    setSelect.id = 'piece-set-select';
                    setSelect.className = 'piece-set-select';
                    setSelect.setAttribute('aria-label', '3D piece set');
                    setSelect.innerHTML = `
                        <option value="marked">Marked set</option>
                        <option value="sculpted">Sculpted set</option>
                        <option value="realistic">Realistic beta</option>
                    `;
                    setSelect.value = this.pieceSet;
                    setSelect.addEventListener('change', () => this.setPieceSet(setSelect.value));
                    toggle.insertAdjacentElement('afterend', setSelect);
                }
                if (!document.getElementById('three-fullscreen-btn')) {
                    const fullButton = document.createElement('button');
                    fullButton.type = 'button';
                    fullButton.id = 'three-fullscreen-btn';
                    fullButton.className = 'game-btn three-fullscreen-btn';
                    fullButton.textContent = 'Full screen';
                    fullButton.addEventListener('click', () => this.toggleFullScreen());
                    document.getElementById('piece-set-select')?.insertAdjacentElement('afterend', fullButton);
                    document.addEventListener('fullscreenchange', () => this.updateFullScreenState());
                }
                if (!document.getElementById('three-ar-btn')) {
                    const arButton = document.createElement('button');
                    arButton.type = 'button';
                    arButton.id = 'three-ar-btn';
                    arButton.className = 'game-btn three-ar-btn';
                    arButton.textContent = 'AR';
                    arButton.disabled = true;
                    arButton.title = 'Checking AR support';
                    arButton.addEventListener('click', () => this.toggleAR());
                    document.getElementById('three-fullscreen-btn')?.insertAdjacentElement('afterend', arButton);
                }
            }

            toggle.addEventListener('click', (event) => {
                const button = event.target.closest('[data-render-mode]');
                if (!button) return;
                this.setMode(button.dataset.renderMode);
            });
            this.checkARSupport();
        }

        createScene() {
            if (this.container) {
                return;
            }

            this.container = document.createElement('div');
            this.container.id = 'three-board';
            this.container.className = 'three-board';
            this.container.setAttribute('aria-label', '3D chess board');
            this.container.tabIndex = 0;

            const board = document.getElementById('board');
            board.insertAdjacentElement('afterend', this.container);

            const exitButton = document.createElement('button');
            exitButton.type = 'button';
            exitButton.id = 'three-board-exit-btn';
            exitButton.className = 'three-board-exit-btn';
            exitButton.textContent = 'Exit full screen';
            exitButton.addEventListener('click', () => this.toggleFullScreen());
            this.container.appendChild(exitButton);

            this.scene = new THREE.Scene();
            this.scene.background = new THREE.Color(0xf2eadf);
            this.scene.fog = new THREE.Fog(0xf2eadf, 18, 38);
            this.normalSceneBackground = this.scene.background;
            this.normalSceneFog = this.scene.fog;

            this.camera = new THREE.PerspectiveCamera(52, 1, 0.1, 100);
            this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
            this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
            this.renderer.outputEncoding = THREE.sRGBEncoding;
            this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
            this.renderer.toneMappingExposure = 0.88;
            this.renderer.shadowMap.enabled = true;
            this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
            this.renderer.xr.enabled = true;
            this.container.appendChild(this.renderer.domElement);

            this.raycaster = new THREE.Raycaster();
            this.pointer = new THREE.Vector2();
            this.boardRoot = new THREE.Group();
            this.boardGroup = new THREE.Group();
            this.pieceGroup = new THREE.Group();
            this.boardRoot.add(this.boardGroup);
            this.boardRoot.add(this.pieceGroup);
            this.scene.add(this.boardRoot);

            const ambient = new THREE.HemisphereLight(0xfff8ec, 0x61442e, 1.15);
            this.scene.add(ambient);

            const key = new THREE.DirectionalLight(0xfff7eb, 2.35);
            key.position.set(4, 9, 5);
            key.castShadow = true;
            key.shadow.mapSize.width = 1024;
            key.shadow.mapSize.height = 1024;
            this.scene.add(key);

            const base = new THREE.Mesh(
                new THREE.BoxGeometry(11.4, 0.35, 11.4),
                new THREE.MeshStandardMaterial({ color: EDGE_COLOR, roughness: 0.74, metalness: 0.05 })
            );
            base.position.y = -0.25;
            base.receiveShadow = true;
            this.boardRoot.add(base);

            const rim = new THREE.Mesh(
                new THREE.BoxGeometry(10.7, 0.25, 10.7),
                new THREE.MeshStandardMaterial({ color: 0x6f4225, roughness: 0.7, metalness: 0.03 })
            );
            rim.position.y = -0.06;
            rim.receiveShadow = true;
            this.boardRoot.add(rim);

            this.arReticle = new THREE.Mesh(
                new THREE.RingGeometry(0.28, 0.34, 32).rotateX(-Math.PI / 2),
                new THREE.MeshBasicMaterial({ color: 0x77d284, transparent: true, opacity: 0.92 })
            );
            this.arReticle.matrixAutoUpdate = false;
            this.arReticle.visible = false;
            this.scene.add(this.arReticle);

            this.arCursor = new THREE.Mesh(
                new THREE.SphereGeometry(0.075, 18, 12),
                new THREE.MeshBasicMaterial({ color: 0x20d37a, transparent: true, opacity: 0.94 })
            );
            this.arCursor.visible = false;
            this.scene.add(this.arCursor);

            this.createARHandles();
            this.createARControllers();

            this.createBoardSquares();
            this.bindInput();
            this.resizeObserver = new ResizeObserver(() => this.resize());
            this.resizeObserver.observe(this.container);
            window.addEventListener('resize', () => this.resize());
            this.resize();
            this.renderLoop();
        }

        createBoardSquares() {
            for (let row = 0; row < BOARD_SIZE; row++) {
                this.squareMeshes[row] = [];
                for (let col = 0; col < BOARD_SIZE; col++) {
                    const material = new THREE.MeshStandardMaterial({
                        color: (row + col) % 2 === 0 ? LIGHT_COLOR : DARK_COLOR,
                        roughness: 0.58,
                        metalness: 0.04
                    });
                    const square = new THREE.Mesh(new THREE.BoxGeometry(0.98, 0.18, 0.98), material);
                    square.position.set(this.colToX(col), 0, this.rowToZ(row));
                    square.userData = { row, col, baseColor: material.color.clone(), square: true };
                    square.receiveShadow = true;
                    square.castShadow = false;
                    this.boardGroup.add(square);
                    this.squareMeshes[row][col] = square;
                }
            }

            this.boardPickMesh = new THREE.Mesh(
                new THREE.BoxGeometry(10, 0.04, 10),
                new THREE.MeshBasicMaterial({
                    transparent: true,
                    opacity: 0,
                    depthWrite: false,
                    colorWrite: false
                })
            );
            this.boardPickMesh.position.y = 0.15;
            this.boardPickMesh.userData = { boardPick: true };
            this.boardGroup.add(this.boardPickMesh);
        }

        createARHandles() {
            this.arHandlesGroup = new THREE.Group();
            this.arHandlesGroup.visible = false;
            this.boardRoot.add(this.arHandlesGroup);

            const cornerMaterial = new THREE.MeshStandardMaterial({
                color: 0xffd166,
                roughness: 0.35,
                metalness: 0.15,
                emissive: 0x442800,
                emissiveIntensity: 0.3
            });
            const moveMaterial = new THREE.MeshStandardMaterial({
                color: 0x20d37a,
                roughness: 0.38,
                metalness: 0.08,
                emissive: 0x06391f,
                emissiveIntensity: 0.32
            });
            const corners = [
                { id: 'nw', x: -AR_BOARD_HALF_SIZE, z: -AR_BOARD_HALF_SIZE },
                { id: 'ne', x: AR_BOARD_HALF_SIZE, z: -AR_BOARD_HALF_SIZE },
                { id: 'se', x: AR_BOARD_HALF_SIZE, z: AR_BOARD_HALF_SIZE },
                { id: 'sw', x: -AR_BOARD_HALF_SIZE, z: AR_BOARD_HALF_SIZE }
            ];

            corners.forEach((corner) => {
                const handle = new THREE.Mesh(new THREE.SphereGeometry(0.68, 24, 16), cornerMaterial);
                handle.position.set(corner.x, 0.72, corner.z);
                handle.userData = {
                    arHandle: true,
                    handleType: 'resize',
                    corner: corner.id,
                    local: new THREE.Vector3(corner.x, 0, corner.z)
                };
                handle.castShadow = true;
                handle.receiveShadow = true;
                this.arHandlesGroup.add(handle);
                this.arHandleMeshes.push(handle);
            });

            const moveHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.92, 0.92, 0.1, 40), moveMaterial);
            moveHandle.position.set(0, 0.5, AR_BOARD_HALF_SIZE + 0.66);
            moveHandle.userData = { arHandle: true, handleType: 'move', local: new THREE.Vector3(0, 0, AR_BOARD_HALF_SIZE + 0.66) };
            moveHandle.castShadow = true;
            moveHandle.receiveShadow = true;
            this.arHandlesGroup.add(moveHandle);
            this.arHandleMeshes.push(moveHandle);
        }

        createARControllers() {
            const pointerGeometry = new THREE.BufferGeometry().setFromPoints([
                new THREE.Vector3(0, 0, 0),
                new THREE.Vector3(0, 0, -1.2)
            ]);
            const pointerMaterial = new THREE.LineBasicMaterial({ color: 0x20d37a, transparent: true, opacity: 0.85 });

            for (let index = 0; index < 2; index++) {
                const controller = this.renderer.xr.getController(index);
                controller.addEventListener('selectstart', (event) => this.handleARSelectStart(event));
                controller.addEventListener('selectend', (event) => this.handleARSelectEnd(event));
                controller.addEventListener('select', (event) => this.handleARSelect(event));

                const line = new THREE.Line(pointerGeometry.clone(), pointerMaterial.clone());
                line.name = `ar-pointer-${index}`;
                line.visible = false;
                controller.add(line);

                this.scene.add(controller);
                this.xrControllers.push(controller);
                this.arPointerLines.push(line);
            }
            this.xrController = this.xrControllers[0] || null;
        }

        bindInput() {
            this.container.addEventListener('pointerdown', (event) => {
                if (event.target.closest('button, select')) return;
                this.dragging = false;
                this.lastPointer = { x: event.clientX, y: event.clientY };
                this.container.setPointerCapture(event.pointerId);
            });

            this.container.addEventListener('pointermove', (event) => {
                if (event.target.closest('button, select')) return;
                if (!this.lastPointer) return;
                const dx = event.clientX - this.lastPointer.x;
                const dy = event.clientY - this.lastPointer.y;
                if (Math.abs(dx) + Math.abs(dy) > 3) {
                    this.dragging = true;
                    this.orbitAngle -= dx * 0.008;
                    this.elevation = Math.max(0.45, Math.min(1.25, this.elevation + dy * 0.004));
                    this.updateCamera();
                }
                this.lastPointer = { x: event.clientX, y: event.clientY };
            });

            this.container.addEventListener('pointerup', (event) => {
                if (event.target.closest('button, select')) return;
                this.container.releasePointerCapture(event.pointerId);
                const wasDragging = this.dragging;
                this.dragging = false;
                this.lastPointer = null;
                if (!wasDragging) {
                    this.handlePick(event);
                }
            });

            this.container.addEventListener('wheel', (event) => {
                event.preventDefault();
                this.radius = Math.max(8.2, Math.min(22, this.radius + event.deltaY * 0.01));
                this.updateCamera();
            }, { passive: false });
        }

        handlePick(event) {
            if (!this.game || this.mode !== '3d') return;
            const rect = this.renderer.domElement.getBoundingClientRect();
            this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
            this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
            this.raycaster.setFromCamera(this.pointer, this.camera);

            const hits = this.raycaster.intersectObjects([...this.pieceMeshes, ...this.boardGroup.children], true);
            const hit = hits.find((item) => item.object.userData && (item.object.userData.row !== undefined || item.object.userData.boardPick));
            if (!hit) return;

            const { row, col } = hit.object.userData.boardPick
                ? this.pointToBoardSquare(hit.point)
                : hit.object.userData;
            const square = document.querySelector(`[data-row="${row}"][data-col="${col}"]`);
            if (!square) return;

            this.game.handleSquareClick({ target: square });
            this.scheduleSync(this.game);
        }

        pointToBoardSquare(point) {
            const local = this.boardRoot.worldToLocal(point.clone());
            return {
                row: Math.max(0, Math.min(BOARD_SIZE - 1, Math.floor(local.z + BOARD_SIZE / 2))),
                col: Math.max(0, Math.min(BOARD_SIZE - 1, Math.floor(local.x + BOARD_SIZE / 2)))
            };
        }

        syncFromGame(game) {
            if (!game || !this.scene || !this.pieceGroup) {
                return;
            }
            this.game = game;
            this.clearPieces();
            const board = this.readBoardFromDOM() || game.gameBoard || game.createInitialBoard();
            for (let row = 0; row < BOARD_SIZE; row++) {
                for (let col = 0; col < BOARD_SIZE; col++) {
                    const symbol = board[row] ? board[row][col] : '';
                    if (symbol) {
                        this.addPiece(symbol, row, col);
                    }
                }
            }
            this.updateHighlights();
            this.applyMode();
        }

        readBoardFromDOM() {
            const board = [];
            let foundSquare = false;
            for (let row = 0; row < BOARD_SIZE; row++) {
                board[row] = [];
                for (let col = 0; col < BOARD_SIZE; col++) {
                    const square = document.querySelector(`[data-row="${row}"][data-col="${col}"]`);
                    if (!square) continue;
                    foundSquare = true;
                    const piece = square.querySelector('.piece');
                    board[row][col] = piece ? this.symbolFromPieceElement(piece) : '';
                }
            }
            return foundSquare ? board : null;
        }

        symbolFromPieceElement(piece) {
            const type = piece.dataset.type || '';
            const color = piece.dataset.color || (piece.classList.contains('white-piece') ? 'white' : 'black');
            if (type === 'dragon' || piece.classList.contains('dragon-piece')) {
                return color === 'black' ? 'dragon-black' : 'dragon-white';
            }
            if (type === 'archer' || piece.classList.contains('archer-piece')) {
                if (piece.dataset.symbol) return piece.dataset.symbol;
                if (piece.dataset.base && piece.dataset.arrow) {
                    return `${piece.dataset.base}${piece.dataset.arrow === '↑' ? '⇡' : '⇣'}`;
                }
                return color === 'black' ? '♟⇣' : '♙⇡';
            }
            return piece.dataset.symbol || piece.textContent.trim();
        }

        scheduleSync(game = this.game) {
            if (!game) return;
            this.syncFromGame(game);
            requestAnimationFrame(() => this.syncFromGame(game));
            setTimeout(() => this.syncFromGame(game), 80);
            setTimeout(() => this.syncFromGame(game), 650);
        }

        clearPieces() {
            while (this.pieceGroup.children.length) {
                const child = this.pieceGroup.children.pop();
                child.traverse((node) => {
                    if (node.userData?.assetClone) return;
                    if (node.geometry) node.geometry.dispose();
                    if (node.material) node.material.dispose();
                });
            }
            this.pieceMeshes = [];
        }

        addPiece(symbol, row, col) {
            const info = this.pieceInfo(symbol);
            const group = new THREE.Group();
            group.position.set(this.colToX(col), 0.18, this.rowToZ(row));
            group.userData = { row, col, piece: true };

            const color = info.color === 'white' ? 0xfff3dc : 0x171b22;
            const accent = info.color === 'white' ? 0xd6a330 : 0x7db7ff;
            const trim = info.color === 'white' ? 0x5d4127 : 0xf4dfbd;
            const dragonRed = 0xb5162b;
            const archerGreen = 0x238558;
            const material = new THREE.MeshStandardMaterial({
                color,
                roughness: 0.38,
                metalness: info.color === 'white' ? 0.18 : 0.28
            });
            const accentMaterial = new THREE.MeshStandardMaterial({ color: accent, roughness: 0.42, metalness: 0.18 });
            const trimMaterial = new THREE.MeshStandardMaterial({ color: trim, roughness: 0.45, metalness: 0.12 });
            const dragonMaterial = new THREE.MeshStandardMaterial({ color: dragonRed, roughness: 0.44, metalness: 0.16 });
            const archerMaterial = new THREE.MeshStandardMaterial({ color: archerGreen, roughness: 0.44, metalness: 0.12 });

            if (this.pieceSet === 'realistic' && REALISTIC_MODEL_PATHS[info.type]) {
                const realisticPiece = this.createRealisticPiece(info, row, col);
                if (realisticPiece) {
                    group.add(realisticPiece);
                    this.pieceGroup.add(group);
                    return;
                }
                if (!this.modelRefreshQueued.has(info.type)) {
                    this.modelRefreshQueued.add(info.type);
                    this.loadRealisticModel(info.type).then((model) => {
                        this.modelRefreshQueued.delete(info.type);
                        if (model && this.pieceSet === 'realistic') {
                            this.scheduleSync(this.game);
                        }
                    });
                }
            }

            const add = (mesh) => {
                mesh.castShadow = true;
                mesh.receiveShadow = true;
                mesh.userData = { row, col, piece: true };
                group.add(mesh);
                this.pieceMeshes.push(mesh);
            };

            const base = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.34, 0.14, 28), material);
            base.position.y = 0.08;
            add(base);

            if (info.type === 'pawn' || info.type === 'archer') {
                const body = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.24, 0.45, 24), material);
                body.position.y = 0.38;
                add(body);
                const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 24, 18), material);
                head.position.y = 0.7;
                add(head);
                if (info.type === 'archer') {
                    const bow = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.025, 8, 28, Math.PI), archerMaterial);
                    bow.rotation.z = Math.PI / 2;
                    bow.position.set(0.28, 0.5, 0);
                    add(bow);
                    const arrow = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.58, 8), trimMaterial);
                    arrow.position.set(0.0, 0.68, 0.17);
                    arrow.rotation.x = Math.PI / 2;
                    add(arrow);
                    const arrowHead = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.16, 12), archerMaterial);
                    arrowHead.position.set(0.0, 0.68, 0.48);
                    arrowHead.rotation.x = Math.PI / 2;
                    add(arrowHead);
                }
            } else if (info.type === 'rook') {
                const body = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.27, 0.62, 6), material);
                body.position.y = 0.44;
                add(body);
                const crown = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.14, 0.48), material);
                crown.position.y = 0.82;
                add(crown);
            } else if (info.type === 'knight') {
                const body = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.27, 0.52, 18), material);
                body.position.y = 0.38;
                add(body);
                const head = new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.62, 5), material);
                head.position.set(0.07, 0.76, 0);
                head.rotation.z = -0.45;
                add(head);
                const mane = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.28, 0.24), trimMaterial);
                mane.position.set(-0.05, 0.88, -0.08);
                mane.rotation.z = -0.35;
                add(mane);
            } else if (info.type === 'bishop') {
                const body = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.25, 0.65, 24), material);
                body.position.y = 0.44;
                add(body);
                const cap = new THREE.Mesh(new THREE.ConeGeometry(0.23, 0.36, 24), material);
                cap.position.y = 0.94;
                add(cap);
                const slash = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.28, 0.2), trimMaterial);
                slash.position.set(0.07, 1.0, 0);
                slash.rotation.z = -0.7;
                add(slash);
            } else if (info.type === 'queen') {
                const body = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, 0.72, 28), material);
                body.position.y = 0.48;
                add(body);
                for (let i = 0; i < 6; i++) {
                    const gem = new THREE.Mesh(new THREE.SphereGeometry(0.055, 12, 8), accentMaterial);
                    const angle = (i / 6) * Math.PI * 2;
                    gem.position.set(Math.cos(angle) * 0.22, 0.9, Math.sin(angle) * 0.22);
                    add(gem);
                }
            } else if (info.type === 'king') {
                const body = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, 0.75, 28), material);
                body.position.y = 0.5;
                add(body);
                const vertical = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.36, 0.08), accentMaterial);
                vertical.position.y = 1.0;
                add(vertical);
                const horizontal = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.07, 0.07), accentMaterial);
                horizontal.position.y = 1.05;
                add(horizontal);
            } else if (info.type === 'dragon') {
                const body = new THREE.Mesh(new THREE.ConeGeometry(0.36, 0.92, 5), material);
                body.position.y = 0.56;
                body.rotation.y = Math.PI / 4;
                add(body);
                const leftWing = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.06, 0.24), dragonMaterial);
                leftWing.position.set(-0.28, 0.55, 0);
                leftWing.rotation.z = 0.45;
                add(leftWing);
                const rightWing = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.06, 0.24), dragonMaterial);
                rightWing.position.set(0.28, 0.55, 0);
                rightWing.rotation.z = -0.45;
                add(rightWing);
                const crest = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.28, 4), dragonMaterial);
                crest.position.set(0, 1.02, 0.06);
                add(crest);
            }

            if (this.pieceSet === 'marked') {
                this.addPieceBadge(group, info, row, col);
            }
            this.pieceGroup.add(group);
        }

        createRealisticPiece(info, row, col) {
            const cached = this.modelCache[info.type];
            if (!cached) return null;

            const model = cached.clone(true);
            const pieceColor = info.color === 'white' ? 0xf6ead7 : 0x14171c;
            const accentColor = info.color === 'white' ? 0xb88743 : 0x6f93c4;
            const material = new THREE.MeshStandardMaterial({
                color: pieceColor,
                roughness: info.color === 'white' ? 0.34 : 0.42,
                metalness: info.color === 'white' ? 0.22 : 0.34,
                envMapIntensity: 0.8
            });
            const accentMaterial = new THREE.MeshStandardMaterial({
                color: accentColor,
                roughness: 0.38,
                metalness: 0.28
            });

            model.traverse((node) => {
                node.userData = { ...node.userData, row, col, piece: true, assetClone: true };
                if (node.isMesh) {
                    node.castShadow = true;
                    node.receiveShadow = true;
                    node.material = material;
                    this.pieceMeshes.push(node);
                }
            });

            const box = new THREE.Box3().setFromObject(model);
            const size = box.getSize(new THREE.Vector3());
            const maxAxis = Math.max(size.x, size.y, size.z) || 1;
            const scale = 0.92 / maxAxis;
            model.scale.setScalar(scale);
            model.rotation.y = info.color === 'white' ? Math.PI : 0;

            const normalizedBox = new THREE.Box3().setFromObject(model);
            const center = normalizedBox.getCenter(new THREE.Vector3());
            const minY = normalizedBox.min.y;
            model.position.set(-center.x, 0.07 - minY, -center.z);

            const base = new THREE.Mesh(new THREE.CylinderGeometry(0.31, 0.37, 0.12, 40), material);
            base.position.y = 0.06;
            base.userData = { row, col, piece: true };
            base.castShadow = true;
            base.receiveShadow = true;
            this.pieceMeshes.push(base);

            const trim = new THREE.Mesh(new THREE.TorusGeometry(0.31, 0.022, 10, 40), accentMaterial);
            trim.position.y = 0.13;
            trim.userData = { row, col, piece: true };
            trim.castShadow = true;
            trim.receiveShadow = true;
            this.pieceMeshes.push(trim);

            const root = new THREE.Group();
            root.userData = { row, col, piece: true };
            root.add(base);
            root.add(trim);
            root.add(model);
            return root;
        }

        loadRealisticModel(type) {
            if (this.modelCache[type]) {
                return Promise.resolve(this.modelCache[type]);
            }
            if (this.modelPromises[type]) {
                return this.modelPromises[type];
            }
            if (this.modelFailures.has(type) || !window.THREE?.GLTFLoader || !REALISTIC_MODEL_PATHS[type]) {
                return Promise.resolve(null);
            }

            if (!this.modelLoader) {
                this.modelLoader = new THREE.GLTFLoader();
            }
            this.modelPromises[type] = new Promise((resolve) => {
                this.modelLoader.load(
                    REALISTIC_MODEL_PATHS[type],
                    (gltf) => {
                        this.modelCache[type] = gltf.scene;
                        resolve(gltf.scene);
                    },
                    undefined,
                    (error) => {
                        console.warn(`Failed to load realistic ${type} model`, error);
                        this.modelFailures.add(type);
                        resolve(null);
                    }
                );
            });
            return this.modelPromises[type];
        }

        addPieceBadge(group, info, row, col) {
            const canvas = document.createElement('canvas');
            canvas.width = 128;
            canvas.height = 128;
            const ctx = canvas.getContext('2d');
            const fill = info.color === 'white' ? '#fff8e8' : '#12161d';
            const stroke = info.type === 'dragon' ? '#c81932' : info.type === 'archer' ? '#1f8a5b' : '#d6a330';
            const text = info.letter;

            ctx.clearRect(0, 0, 128, 128);
            ctx.beginPath();
            ctx.arc(64, 64, 44, 0, Math.PI * 2);
            ctx.fillStyle = fill;
            ctx.fill();
            ctx.lineWidth = info.type === 'dragon' || info.type === 'archer' ? 10 : 7;
            ctx.strokeStyle = stroke;
            ctx.stroke();
            ctx.font = '700 58px Arial, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = info.color === 'white' ? '#2d241a' : '#f7eddc';
            ctx.fillText(text, 64, 66);

            const texture = new THREE.CanvasTexture(canvas);
            texture.anisotropy = 4;
            const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
                map: texture,
                transparent: true,
                depthWrite: false
            }));
            sprite.position.set(0, 1.28, 0);
            sprite.scale.set(0.52, 0.52, 0.52);
            sprite.userData = { row, col, piece: true };
            group.add(sprite);
            this.pieceMeshes.push(sprite);
        }

        pieceInfo(symbol) {
            if (symbol === 'dragon-white') return { type: 'dragon', color: 'white', letter: 'D' };
            if (symbol === 'dragon-black') return { type: 'dragon', color: 'black', letter: 'D' };
            const color = '♔♕♖♗♘♙'.includes(String(symbol).charAt(0)) ? 'white' : 'black';
            if (String(symbol).includes('⇡') || String(symbol).includes('⇣')) return { type: 'archer', color, letter: 'A' };
            const map = {
                '♔': ['king', 'K'], '♚': ['king', 'K'],
                '♕': ['queen', 'Q'], '♛': ['queen', 'Q'],
                '♖': ['rook', 'R'], '♜': ['rook', 'R'],
                '♗': ['bishop', 'B'], '♝': ['bishop', 'B'],
                '♘': ['knight', 'N'], '♞': ['knight', 'N'],
                '♙': ['pawn', 'P'], '♟': ['pawn', 'P']
            };
            const piece = map[String(symbol).charAt(0)] || ['pawn', 'P'];
            return { type: piece[0], color, letter: piece[1] };
        }

        updateHighlights() {
            for (let row = 0; row < BOARD_SIZE; row++) {
                for (let col = 0; col < BOARD_SIZE; col++) {
                    const mesh = this.squareMeshes[row][col];
                    mesh.material.color.copy(mesh.userData.baseColor);
                    const square = document.querySelector(`[data-row="${row}"][data-col="${col}"]`);
                    if (!square) continue;
                    if (square.classList.contains('selected')) {
                        mesh.material.color.setHex(SELECT_COLOR);
                    } else if (square.classList.contains('valid-move')) {
                        mesh.material.color.setHex(MOVE_COLOR);
                    } else if (square.classList.contains('illegal-move')) {
                        mesh.material.color.setHex(ILLEGAL_COLOR);
                    }
                }
            }
        }

        checkARSupport() {
            const button = document.getElementById('three-ar-btn');
            if (!button || this.arSupportChecked) return;
            this.arSupportChecked = true;

            if (!window.isSecureContext || !navigator.xr) {
                this.arSupported = false;
                button.disabled = true;
                button.title = 'AR requires a secure mobile browser with WebXR support';
                return;
            }

            navigator.xr.isSessionSupported('immersive-ar')
                .then((supported) => {
                    this.arSupported = Boolean(supported);
                    button.disabled = !this.arSupported;
                    button.title = this.arSupported ? 'Place the 3D board on a real surface' : 'AR is not available in this browser';
                })
                .catch(() => {
                    this.arSupported = false;
                    button.disabled = true;
                    button.title = 'AR is not available in this browser';
                });
        }

        async toggleAR() {
            if (this.arSession) {
                await this.arSession.end();
                return;
            }
            await this.startAR();
        }

        async startAR() {
            if (!this.renderer || !navigator.xr || !this.arSupported) {
                this.showARStatus('AR is not available on this browser.');
                return;
            }

            try {
                if (this.mode !== '3d') {
                    this.setMode('3d');
                }
                this.setExpanded(false);

                const session = await navigator.xr.requestSession('immersive-ar', {
                    requiredFeatures: ['hit-test'],
                    optionalFeatures: ['dom-overlay', 'local-floor', 'hand-tracking'],
                    domOverlay: { root: document.body }
                });
                this.arSession = session;
                session.addEventListener('end', () => this.endAR());

                if (this.animationFrame) {
                    cancelAnimationFrame(this.animationFrame);
                    this.animationFrame = null;
                }

                await this.renderer.xr.setSession(session);
                this.prepareARScene();
                this.renderer.setAnimationLoop((time, frame) => this.renderScene(time, frame));
            } catch (error) {
                this.arSession = null;
                this.showARStatus('AR could not start on this device.');
                console.warn('Cloud Chess AR start failed', error);
                this.renderLoop();
            }
        }

        prepareARScene() {
            this.arPlaced = false;
            this.arHitTestSource = null;
            this.arHitTestSourceRequested = false;
            this.arViewerSpace = null;
            if (this.boardRoot) {
                this.boardRoot.visible = false;
                this.boardRoot.position.set(0, -100, 0);
                this.boardRoot.rotation.set(0, 0, 0);
                this.boardRoot.scale.setScalar(AR_DEFAULT_SCALE);
            }
            if (this.scene) {
                this.scene.background = null;
                this.scene.fog = null;
            }
            if (this.arReticle) {
                this.arReticle.visible = false;
            }
            if (this.arCursor) {
                this.arCursor.visible = false;
            }
            if (this.arHandlesGroup) {
                this.arHandlesGroup.visible = false;
            }
            this.arPointerLines.forEach((line) => {
                line.visible = false;
            });
            this.arDrag = null;
            this.arSelectSuppressed = false;
            this.arLastHit = null;
            this.container?.classList.add('is-ar-active');
            const button = document.getElementById('three-ar-btn');
            if (button) {
                button.textContent = 'Exit AR';
                button.disabled = false;
            }
            this.showARStatus('Move your device until a ring appears, then tap to place the board.');
        }

        endAR() {
            this.arSession = null;
            if (this.arHitTestSource && typeof this.arHitTestSource.cancel === 'function') {
                this.arHitTestSource.cancel();
            }
            this.arHitTestSource = null;
            this.arHitTestSourceRequested = false;
            this.arViewerSpace = null;
            this.arPlaced = false;

            if (this.arReticle) {
                this.arReticle.visible = false;
            }
            if (this.arCursor) {
                this.arCursor.visible = false;
            }
            if (this.arHandlesGroup) {
                this.arHandlesGroup.visible = false;
            }
            this.arPointerLines.forEach((line) => {
                line.visible = false;
            });
            this.arDrag = null;
            this.arSelectSuppressed = false;
            this.arLastHit = null;
            if (this.boardRoot) {
                this.boardRoot.visible = true;
                this.boardRoot.position.set(0, 0, 0);
                this.boardRoot.rotation.set(0, 0, 0);
                this.boardRoot.scale.setScalar(1);
            }
            if (this.scene) {
                this.scene.background = this.normalSceneBackground;
                this.scene.fog = this.normalSceneFog;
            }

            this.container?.classList.remove('is-ar-active');
            const button = document.getElementById('three-ar-btn');
            if (button) {
                button.textContent = 'AR';
                button.disabled = !this.arSupported;
            }
            this.showARStatus('');
            this.renderer?.setAnimationLoop(null);
            this.resize();
            this.renderLoop();
        }

        showARStatus(message) {
            let status = document.getElementById('three-ar-status');
            if (!this.container || !message) {
                status?.remove();
                return;
            }
            if (!status) {
                status = document.createElement('div');
                status.id = 'three-ar-status';
                status.className = 'three-ar-status';
                this.container.appendChild(status);
            }
            status.textContent = message;
        }

        updateARFrame(frame) {
            if (!this.arSession || !frame) return;
            const session = this.renderer.xr.getSession();
            const referenceSpace = this.renderer.xr.getReferenceSpace();

            if (!this.arHitTestSourceRequested) {
                this.arHitTestSourceRequested = true;
                session.requestReferenceSpace('viewer')
                    .then((viewerSpace) => {
                        this.arViewerSpace = viewerSpace;
                        return session.requestHitTestSource({ space: viewerSpace });
                    })
                    .then((source) => {
                        this.arHitTestSource = source;
                    })
                    .catch(() => {
                        this.showARStatus('Surface detection is not available in this AR session.');
                    });
            }

            if (this.arPlaced) {
                this.updateARPointer();
                this.updateARDrag();
                return;
            }
            if (!this.arHitTestSource || !referenceSpace) return;
            const hits = frame.getHitTestResults(this.arHitTestSource);
            if (hits.length > 0) {
                const pose = hits[0].getPose(referenceSpace);
                this.arReticle.visible = true;
                this.arReticle.matrix.fromArray(pose.transform.matrix);
            } else {
                this.arReticle.visible = false;
            }
        }

        handleARSelectStart(event) {
            if (!this.arSession || !this.arPlaced) return;
            this.arActiveController = event?.target || this.xrController;
            const hit = this.getARRaycastHit({ controller: this.arActiveController, includeHandles: true });
            if (!hit?.handle) return;

            this.arSelectSuppressed = true;
            if (hit.handle.userData.handleType === 'move') {
                const point = this.getBoardPlaneIntersection(this.arActiveController) || hit.point;
                this.arDrag = {
                    type: 'move',
                    startPoint: point.clone(),
                    startPosition: this.boardRoot.position.clone(),
                    moved: false
                };
                this.showARStatus('Drag the green front handle to move the board.');
                return;
            }

            const activeLocal = hit.handle.userData.local.clone();
            const oppositeLocal = activeLocal.clone().multiplyScalar(-1);
            this.arDrag = {
                type: 'resize',
                activeLocal,
                oppositeLocal,
                oppositeWorld: this.localToWorldNoScale(oppositeLocal, this.boardRoot.scale.x),
                moved: false
            };
            this.showARStatus('Drag a gold corner to resize the board.');
        }

        handleARSelectEnd() {
            if (this.arDrag) {
                this.arSelectSuppressed = true;
                this.arDrag = null;
                this.showARStatus('Aim at a piece or square and tap to play. Drag the green front handle to move; drag gold corners to resize.');
                setTimeout(() => {
                    this.arSelectSuppressed = false;
                }, 250);
            }
            this.arActiveController = null;
        }

        handleARSelect(event) {
            if (!this.arSession || !this.boardRoot) return;
            this.arActiveController = event?.target || this.xrController;
            if (!this.arPlaced && this.arReticle?.visible) {
                this.boardRoot.position.setFromMatrixPosition(this.arReticle.matrix);
                this.boardRoot.quaternion.setFromRotationMatrix(this.arReticle.matrix);
                this.boardRoot.scale.setScalar(AR_DEFAULT_SCALE);
                this.boardRoot.visible = true;
                this.arPlaced = true;
                this.arReticle.visible = false;
                if (this.arHandlesGroup) {
                    this.arHandlesGroup.visible = true;
                }
                this.showARStatus('Aim at a piece or square and tap to play. Drag the green front handle to move; drag gold corners to resize.');
                return;
            }
            if (this.arSelectSuppressed) {
                this.arSelectSuppressed = false;
                return;
            }
            this.handleARBoardPick(this.arActiveController);
        }

        handleARBoardPick(controller = this.xrController) {
            if (!this.game) return;
            const hit = this.getARRaycastHit({ controller, includeHandles: false });
            const target = hit?.square || hit?.piece;
            if (!target) {
                this.showARStatus('Aim the green dot at a piece or square, then tap.');
                return;
            }

            const { row, col } = target.object.userData;
            const square = document.querySelector(`[data-row="${row}"][data-col="${col}"]`);
            if (!square) return;

            this.game.handleSquareClick({ target: square });
            this.scheduleSync(this.game);
        }

        updateARPointer() {
            if (!this.arPlaced) return;
            const hit = this.getARRaycastHit({ controller: this.arActiveController || this.xrController, includeHandles: true });
            this.arLastHit = hit;

            this.arPointerLines.forEach((line) => {
                line.visible = true;
            });

            if (!this.arCursor || !hit?.point) {
                if (this.arCursor) {
                    this.arCursor.visible = false;
                }
                return;
            }

            this.arCursor.visible = true;
            this.arCursor.position.copy(hit.point);
            const material = this.arCursor.material;
            if (hit.handle) {
                material.color.setHex(hit.handle.userData.handleType === 'move' ? 0x20d37a : 0xffd166);
                this.arCursor.scale.setScalar(1.45);
            } else {
                material.color.setHex(0x20d37a);
                this.arCursor.scale.setScalar(1);
            }
        }

        updateARDrag() {
            if (!this.arDrag || !this.boardRoot) return;
            const controller = this.arActiveController || this.xrController;
            const point = this.getBoardPlaneIntersection(controller);
            if (!point) return;

            if (this.arDrag.type === 'move') {
                const delta = point.clone().sub(this.arDrag.startPoint);
                if (delta.length() > 0.01) {
                    this.arDrag.moved = true;
                }
                this.boardRoot.position.copy(this.arDrag.startPosition).add(delta);
                return;
            }

            const inverseRotation = this.boardRoot.quaternion.clone().invert();
            const diagonal = point.clone().sub(this.arDrag.oppositeWorld).applyQuaternion(inverseRotation);
            const localDelta = this.arDrag.activeLocal.clone().sub(this.arDrag.oppositeLocal);
            const xScale = Math.abs(diagonal.x / localDelta.x);
            const zScale = Math.abs(diagonal.z / localDelta.z);
            const nextScale = Math.max(AR_MIN_SCALE, Math.min(AR_MAX_SCALE, Math.max(xScale, zScale)));
            if (Math.abs(nextScale - this.boardRoot.scale.x) > 0.002) {
                this.arDrag.moved = true;
            }
            this.boardRoot.scale.setScalar(nextScale);
            const offset = this.arDrag.oppositeLocal.clone().multiplyScalar(nextScale).applyQuaternion(this.boardRoot.quaternion);
            this.boardRoot.position.copy(this.arDrag.oppositeWorld).sub(offset);
        }

        getARRaycastHit({ controller = this.xrController, includeHandles = true } = {}) {
            const rays = this.getARRays(controller);
            for (const ray of rays) {
                const hit = this.intersectARRay(ray, includeHandles);
                if (hit) return hit;
            }
            return null;
        }

        getARRays(controller = this.xrController) {
            const rays = [];
            if (controller) {
                controller.updateMatrixWorld(true);
                const rotation = new THREE.Matrix4();
                rotation.extractRotation(controller.matrixWorld);
                const origin = new THREE.Vector3().setFromMatrixPosition(controller.matrixWorld);
                const direction = new THREE.Vector3(0, 0, -1).applyMatrix4(rotation).normalize();
                if (Number.isFinite(origin.x) && direction.lengthSq() > 0.5) {
                    rays.push(new THREE.Ray(origin, direction));
                }
            }

            const xrCamera = this.renderer?.xr?.isPresenting ? this.renderer.xr.getCamera(this.camera) : this.camera;
            if (xrCamera) {
                xrCamera.updateMatrixWorld(true);
                const origin = new THREE.Vector3().setFromMatrixPosition(xrCamera.matrixWorld);
                const direction = new THREE.Vector3(0, 0, -1).applyQuaternion(xrCamera.quaternion).normalize();
                rays.push(new THREE.Ray(origin, direction));
            }
            return rays;
        }

        intersectARRay(ray, includeHandles = true) {
            this.raycaster.ray.copy(ray);
            this.raycaster.camera = this.renderer?.xr?.isPresenting ? this.renderer.xr.getCamera(this.camera) : this.camera;
            if (includeHandles && this.arHandlesGroup?.visible) {
                const handleHits = this.raycaster.intersectObjects(this.arHandleMeshes, true);
                if (handleHits.length) {
                    return { handle: handleHits[0].object, point: handleHits[0].point, ray };
                }
            }
            const hits = this.raycaster.intersectObjects([...this.pieceMeshes, ...this.boardGroup.children], true);
            const hit = hits.find((item) => item.object.userData && (item.object.userData.row !== undefined || item.object.userData.boardPick));
            if (!hit) return null;
            if (hit.object.userData.boardPick) {
                const { row, col } = this.pointToBoardSquare(hit.point);
                return {
                    point: hit.point,
                    square: { object: { userData: { row, col, square: true } } },
                    piece: null,
                    ray
                };
            }
            return {
                point: hit.point,
                piece: hit.object.userData.piece ? hit : null,
                square: hit.object.userData.square ? hit : null,
                ray
            };
        }

        getBoardPlaneIntersection(controller = this.xrController) {
            if (!this.boardRoot) return null;
            const normal = new THREE.Vector3(0, 1, 0).applyQuaternion(this.boardRoot.quaternion).normalize();
            const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, this.boardRoot.position);
            for (const ray of this.getARRays(controller)) {
                const point = new THREE.Vector3();
                if (ray.intersectPlane(plane, point)) {
                    return point;
                }
            }
            return null;
        }

        localToWorldNoScale(local, scale) {
            return local.clone()
                .multiplyScalar(scale)
                .applyQuaternion(this.boardRoot.quaternion)
                .add(this.boardRoot.position);
        }

        setMode(mode) {
            this.mode = mode === '3d' && window.THREE ? '3d' : '2d';
            localStorage.setItem(STORAGE_KEY, this.mode);
            this.applyMode();
            this.resize();
        }

        setPieceSet(value) {
            this.pieceSet = ['sculpted', 'realistic'].includes(value) ? value : 'marked';
            localStorage.setItem(PIECE_SET_KEY, this.pieceSet);
            const select = document.getElementById('piece-set-select');
            if (select) {
                select.value = this.pieceSet;
            }
            this.syncFromGame(this.game);
        }

        toggleFullScreen() {
            if (!this.container) return;
            this.setExpanded(!this.container.classList.contains('is-expanded'));
        }

        setExpanded(expanded) {
            this.container?.classList.toggle('is-expanded', Boolean(expanded));
            this.updateFullScreenState();
            setTimeout(() => this.resize(), 50);
        }

        updateFullScreenState() {
            const isExpanded = Boolean(this.container?.classList.contains('is-expanded'));
            document.body.classList.toggle('three-board-fullscreen', isExpanded);
            const button = document.getElementById('three-fullscreen-btn');
            if (button) {
                button.textContent = isExpanded ? 'Exit full screen' : 'Full screen';
            }
            const exitButton = document.getElementById('three-board-exit-btn');
            if (exitButton) {
                exitButton.textContent = isExpanded ? 'Exit full screen' : 'Full screen';
            }
            setTimeout(() => this.resize(), 80);
        }

        applyMode() {
            const board = document.getElementById('board');
            if (!board || !this.container) return;
            const active = this.mode === '3d';
            document.body.classList.toggle('three-mode-active', active);
            board.setAttribute('aria-hidden', active ? 'true' : 'false');
            this.container.hidden = !active;
            document.getElementById('piece-set-select')?.classList.toggle('is-visible', active);
            document.getElementById('three-fullscreen-btn')?.classList.toggle('is-visible', active);
            document.getElementById('three-ar-btn')?.classList.toggle('is-visible', active);
            document.querySelectorAll('[data-render-mode]').forEach((button) => {
                const pressed = button.dataset.renderMode === this.mode;
                button.classList.toggle('is-active', pressed);
                button.setAttribute('aria-pressed', pressed ? 'true' : 'false');
            });
            if (active) {
                this.updateCamera();
            }
        }

        resize() {
            if (!this.container || !this.renderer || !this.camera) return;
            const width = Math.max(280, this.container.clientWidth || 520);
            const height = Math.max(280, this.container.clientHeight || width * 0.86);
            this.renderer.setSize(width, height, false);
            this.camera.aspect = width / height;
            this.camera.updateProjectionMatrix();
            this.updateCamera();
        }

        updateCamera() {
            if (!this.camera) return;
            const horizontal = Math.cos(this.elevation) * this.radius;
            const y = Math.sin(this.elevation) * this.radius;
            this.camera.position.set(Math.cos(this.orbitAngle) * horizontal, y, Math.sin(this.orbitAngle) * horizontal);
            this.camera.lookAt(0, 0, 0);
        }

        renderLoop() {
            if (this.arSession || this.animationFrame) return;
            this.animationFrame = requestAnimationFrame((time) => {
                this.animationFrame = null;
                if (this.arSession) return;
                this.renderScene(time, null);
                this.renderLoop();
            });
        }

        renderScene(time, frame) {
            if (this.mode !== '3d' || !this.renderer || !this.scene || !this.camera || !this.pieceGroup) return;
            const t = time * 0.001;
            this.pieceGroup.children.forEach((piece, index) => {
                piece.position.y = 0.18 + Math.sin(t * 1.6 + index * 0.35) * 0.015;
            });
            this.updateHighlights();
            this.updateARFrame(frame);
            this.renderer.render(this.scene, this.camera);
        }

        colToX(col) {
            return col - 4.5;
        }

        rowToZ(row) {
            return row - 4.5;
        }
    }

    const manager = new CloudChess3D();
    window.cloudChess3D = manager;

    const patchChessGame = () => {
        if (typeof ChessGame === 'undefined' || ChessGame.prototype.__cloudChess3DPatched) {
            return;
        }
        const originalInitialize = ChessGame.prototype.initializeBoard;
        ChessGame.prototype.initializeBoard = function(...args) {
            const result = originalInitialize.apply(this, args);
            setTimeout(() => window.cloudChess3D?.attach(this), 0);
            return result;
        };

        const originalMovePiece = ChessGame.prototype.movePiece;
        ChessGame.prototype.movePiece = function(...args) {
            const result = originalMovePiece.apply(this, args);
            window.cloudChess3D?.scheduleSync(this);
            return result;
        };

        const originalHandleSquareClick = ChessGame.prototype.handleSquareClick;
        ChessGame.prototype.handleSquareClick = function(...args) {
            const result = originalHandleSquareClick.apply(this, args);
            window.cloudChess3D?.scheduleSync(this);
            return result;
        };

        const originalTryMove = ChessGame.prototype.tryMove;
        ChessGame.prototype.tryMove = function(...args) {
            const result = originalTryMove.apply(this, args);
            window.cloudChess3D?.scheduleSync(this);
            return result;
        };

        const originalMakeAIMove = ChessGame.prototype.makeAIMove;
        ChessGame.prototype.makeAIMove = function(...args) {
            const result = originalMakeAIMove.apply(this, args);
            window.cloudChess3D?.scheduleSync(this);
            return result;
        };

        const originalClearValidMoves = ChessGame.prototype.clearValidMoves;
        ChessGame.prototype.clearValidMoves = function(...args) {
            const result = originalClearValidMoves.apply(this, args);
            window.cloudChess3D?.updateHighlights();
            return result;
        };

        const originalClearHighlights = ChessGame.prototype.clearHighlights;
        ChessGame.prototype.clearHighlights = function(...args) {
            const result = originalClearHighlights.apply(this, args);
            window.cloudChess3D?.updateHighlights();
            return result;
        };

        const originalSetBoardDisabled = ChessGame.prototype.setBoardDisabled;
        ChessGame.prototype.setBoardDisabled = function(disabled, ...args) {
            const result = originalSetBoardDisabled.call(this, disabled, ...args);
            document.getElementById('three-board')?.classList.toggle('board-disabled', Boolean(disabled));
            return result;
        };

        ChessGame.prototype.__cloudChess3DPatched = true;
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', patchChessGame);
    } else {
        patchChessGame();
    }
})();
