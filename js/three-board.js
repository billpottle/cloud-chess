(function() {
    const BOARD_SIZE = 10;
    const STORAGE_KEY = 'cloudChessRenderMode';
    const PIECE_SET_KEY = 'cloudChess3DPieceSet';
    const LIGHT_COLOR = 0xd8b77a;
    const DARK_COLOR = 0x8a5632;
    const EDGE_COLOR = 0x4c2f1f;
    const SELECT_COLOR = 0xffd166;
    const MOVE_COLOR = 0x77d284;
    const ILLEGAL_COLOR = 0xef476f;

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
            this.squareMeshes = [];
            this.pieceMeshes = [];
            this.mode = localStorage.getItem(STORAGE_KEY) === '3d' ? '3d' : '2d';
            this.pieceSet = localStorage.getItem(PIECE_SET_KEY) === 'sculpted' ? 'sculpted' : 'marked';
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
            this.normalSceneBackground = null;
            this.normalSceneFog = null;
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

            this.xrController = this.renderer.xr.getController(0);
            this.xrController.addEventListener('select', () => this.handleARSelect());
            this.scene.add(this.xrController);

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
            const hit = hits.find((item) => item.object.userData && item.object.userData.row !== undefined);
            if (!hit) return;

            const { row, col } = hit.object.userData;
            const square = document.querySelector(`[data-row="${row}"][data-col="${col}"]`);
            if (!square) return;

            this.game.handleSquareClick({ target: square });
            this.syncFromGame(this.game);
        }

        syncFromGame(game) {
            if (!game || !this.scene || !this.pieceGroup) {
                return;
            }
            this.game = game;
            this.clearPieces();
            const board = game.gameBoard || game.createInitialBoard();
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

        clearPieces() {
            while (this.pieceGroup.children.length) {
                const child = this.pieceGroup.children.pop();
                child.traverse((node) => {
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
                    optionalFeatures: ['dom-overlay', 'local-floor'],
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
                this.boardRoot.scale.setScalar(0.065);
            }
            if (this.scene) {
                this.scene.background = null;
                this.scene.fog = null;
            }
            if (this.arReticle) {
                this.arReticle.visible = false;
            }
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

            if (!this.arHitTestSource || !referenceSpace || this.arPlaced) return;
            const hits = frame.getHitTestResults(this.arHitTestSource);
            if (hits.length > 0) {
                const pose = hits[0].getPose(referenceSpace);
                this.arReticle.visible = true;
                this.arReticle.matrix.fromArray(pose.transform.matrix);
            } else {
                this.arReticle.visible = false;
            }
        }

        handleARSelect() {
            if (!this.arSession || !this.boardRoot) return;
            if (!this.arPlaced && this.arReticle?.visible) {
                this.boardRoot.position.setFromMatrixPosition(this.arReticle.matrix);
                this.boardRoot.quaternion.setFromRotationMatrix(this.arReticle.matrix);
                this.boardRoot.scale.setScalar(0.065);
                this.boardRoot.visible = true;
                this.arPlaced = true;
                this.arReticle.visible = false;
                this.showARStatus('Board placed. Tap pieces and squares to play, or use Exit AR.');
                return;
            }
            this.handleARBoardPick();
        }

        handleARBoardPick() {
            if (!this.game || !this.xrController) return;
            const rotation = new THREE.Matrix4();
            rotation.extractRotation(this.xrController.matrixWorld);
            this.raycaster.ray.origin.setFromMatrixPosition(this.xrController.matrixWorld);
            this.raycaster.ray.direction.set(0, 0, -1).applyMatrix4(rotation);

            const hits = this.raycaster.intersectObjects([...this.pieceMeshes, ...this.boardGroup.children], true);
            const hit = hits.find((item) => item.object.userData && item.object.userData.row !== undefined);
            if (!hit) return;

            const { row, col } = hit.object.userData;
            const square = document.querySelector(`[data-row="${row}"][data-col="${col}"]`);
            if (!square) return;

            this.game.handleSquareClick({ target: square });
            this.syncFromGame(this.game);
        }

        setMode(mode) {
            this.mode = mode === '3d' && window.THREE ? '3d' : '2d';
            localStorage.setItem(STORAGE_KEY, this.mode);
            this.applyMode();
            this.resize();
        }

        setPieceSet(value) {
            this.pieceSet = value === 'sculpted' ? 'sculpted' : 'marked';
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
            window.cloudChess3D?.syncFromGame(this);
            window.cloudChess3D?.updateHighlights();
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
