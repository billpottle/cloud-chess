(function() {
    const BOARD_SIZE = 10;
    const STORAGE_KEY = 'cloudChessRenderMode';
    const LIGHT_COLOR = 0xc8d5c2;
    const DARK_COLOR = 0x55758c;
    const SELECT_COLOR = 0xffd166;
    const MOVE_COLOR = 0x7dd3fc;
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
            this.squareMeshes = [];
            this.pieceMeshes = [];
            this.mode = localStorage.getItem(STORAGE_KEY) === '3d' ? '3d' : '2d';
            this.dragging = false;
            this.lastPointer = null;
            this.orbitAngle = -Math.PI / 4;
            this.elevation = 1.18;
            this.radius = 20;
            this.animationFrame = null;
            this.resizeObserver = null;
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
            } else {
                this.wrapper.insertBefore(toggle, this.wrapper.firstChild);
            }

            toggle.addEventListener('click', (event) => {
                const button = event.target.closest('[data-render-mode]');
                if (!button) return;
                this.setMode(button.dataset.renderMode);
            });
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

            this.scene = new THREE.Scene();
            this.scene.background = new THREE.Color(0xedf4f6);
            this.scene.fog = new THREE.Fog(0xedf4f6, 18, 38);

            this.camera = new THREE.PerspectiveCamera(52, 1, 0.1, 100);
            this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true });
            this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
            this.renderer.outputEncoding = THREE.sRGBEncoding;
            this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
            this.renderer.toneMappingExposure = 0.88;
            this.renderer.shadowMap.enabled = true;
            this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
            this.container.appendChild(this.renderer.domElement);

            this.raycaster = new THREE.Raycaster();
            this.pointer = new THREE.Vector2();
            this.boardGroup = new THREE.Group();
            this.pieceGroup = new THREE.Group();
            this.scene.add(this.boardGroup);
            this.scene.add(this.pieceGroup);

            const ambient = new THREE.HemisphereLight(0xffffff, 0x708090, 1.2);
            this.scene.add(ambient);

            const key = new THREE.DirectionalLight(0xffffff, 2.4);
            key.position.set(4, 9, 5);
            key.castShadow = true;
            key.shadow.mapSize.width = 1024;
            key.shadow.mapSize.height = 1024;
            this.scene.add(key);

            const base = new THREE.Mesh(
                new THREE.BoxGeometry(11.4, 0.35, 11.4),
                new THREE.MeshStandardMaterial({ color: 0x344256, roughness: 0.8, metalness: 0.05 })
            );
            base.position.y = -0.25;
            base.receiveShadow = true;
            this.scene.add(base);

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
                        roughness: 0.65,
                        metalness: 0.04
                    });
                    const square = new THREE.Mesh(new THREE.BoxGeometry(1, 0.16, 1), material);
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
                this.dragging = false;
                this.lastPointer = { x: event.clientX, y: event.clientY };
                this.container.setPointerCapture(event.pointerId);
            });

            this.container.addEventListener('pointermove', (event) => {
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

            const color = info.color === 'white' ? 0xf7f2e8 : 0x1f2937;
            const accent = info.color === 'white' ? 0xc0a86b : 0x6fb6ff;
            const material = new THREE.MeshStandardMaterial({
                color,
                roughness: 0.46,
                metalness: info.color === 'white' ? 0.12 : 0.18
            });
            const accentMaterial = new THREE.MeshStandardMaterial({ color: accent, roughness: 0.42, metalness: 0.18 });

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
                    const bow = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.02, 8, 28, Math.PI), accentMaterial);
                    bow.rotation.z = Math.PI / 2;
                    bow.position.set(0.24, 0.48, 0);
                    add(bow);
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
                const head = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.56, 5), material);
                head.position.set(0.07, 0.76, 0);
                head.rotation.z = -0.45;
                add(head);
            } else if (info.type === 'bishop') {
                const body = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.25, 0.65, 24), material);
                body.position.y = 0.44;
                add(body);
                const cap = new THREE.Mesh(new THREE.ConeGeometry(0.23, 0.36, 24), material);
                cap.position.y = 0.94;
                add(cap);
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
                const body = new THREE.Mesh(new THREE.ConeGeometry(0.33, 0.9, 5), material);
                body.position.y = 0.56;
                body.rotation.y = Math.PI / 4;
                add(body);
                const leftWing = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.05, 0.2), accentMaterial);
                leftWing.position.set(-0.28, 0.55, 0);
                leftWing.rotation.z = 0.45;
                add(leftWing);
                const rightWing = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.05, 0.2), accentMaterial);
                rightWing.position.set(0.28, 0.55, 0);
                rightWing.rotation.z = -0.45;
                add(rightWing);
            }

            this.pieceGroup.add(group);
        }

        pieceInfo(symbol) {
            if (symbol === 'dragon-white') return { type: 'dragon', color: 'white' };
            if (symbol === 'dragon-black') return { type: 'dragon', color: 'black' };
            const color = '♔♕♖♗♘♙'.includes(String(symbol).charAt(0)) ? 'white' : 'black';
            if (String(symbol).includes('⇡') || String(symbol).includes('⇣')) return { type: 'archer', color };
            const map = {
                '♔': 'king', '♚': 'king',
                '♕': 'queen', '♛': 'queen',
                '♖': 'rook', '♜': 'rook',
                '♗': 'bishop', '♝': 'bishop',
                '♘': 'knight', '♞': 'knight',
                '♙': 'pawn', '♟': 'pawn'
            };
            return { type: map[String(symbol).charAt(0)] || 'pawn', color };
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

        setMode(mode) {
            this.mode = mode === '3d' && window.THREE ? '3d' : '2d';
            localStorage.setItem(STORAGE_KEY, this.mode);
            this.applyMode();
            this.resize();
        }

        applyMode() {
            const board = document.getElementById('board');
            if (!board || !this.container) return;
            const active = this.mode === '3d';
            document.body.classList.toggle('three-mode-active', active);
            board.setAttribute('aria-hidden', active ? 'true' : 'false');
            this.container.hidden = !active;
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
            this.animationFrame = requestAnimationFrame(() => this.renderLoop());
            if (this.mode === '3d' && this.renderer && this.scene && this.camera) {
                const t = performance.now() * 0.001;
                this.pieceGroup.children.forEach((piece, index) => {
                    piece.position.y = 0.18 + Math.sin(t * 1.6 + index * 0.35) * 0.015;
                });
                this.updateHighlights();
                this.renderer.render(this.scene, this.camera);
            }
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
