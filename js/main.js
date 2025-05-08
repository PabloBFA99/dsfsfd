import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.176.0/build/three.module.js';

// Depuración - mostrar que el script se cargó correctamente
console.log("Main.js cargado correctamente");
document.getElementById('debugInfo').textContent = 'Script main.js cargado. Inicializando Three.js...';

// Intentar cargar Three.js con manejo de errores
try {
    // Comprobar que THREE está disponible
    if (!THREE) {
        throw new Error("Three.js no está disponible");
    }
    document.getElementById('debugInfo').textContent = 'Three.js cargado. Iniciando juego...';
} catch (error) {
    console.error("Error al cargar Three.js:", error);
    document.getElementById('debugInfo').textContent = 'Error al cargar Three.js: ' + error.message;
}

// Variables globales
let scene, camera, renderer;
let archer, ground;
let archerModel; // Modelo 3D detallado del arquero
let archerAnimations = {}; // Almacena las animaciones
let currentAnimation = null; // Animación actual
let mixer; // Mezclador de animaciones
let bats = [];
let arrows = [];
let aimLine;
let score = 0;
let isGameOver = false;
let clock = new THREE.Clock();
let lastBatTime = 0;
let batSpawnInterval = 2; // Tiempo en segundos entre aparición de murciélagos
let canShoot = true; // Variable para controlar si se puede disparar
let aimDirection = new THREE.Vector3(0, 0, 1); // Dirección de apuntado
let equippedBow; // Arco visible en primera persona
let hands = { left: null, right: null }; // Manos del jugador
let isDrawingBow = false; // Estado de tensado del arco
let bowDrawProgress = 0; // Progreso de tensado del arco
let isMoving = false; // Si el jugador está moviendo al personaje
let isThirdPerson = true; // Modo tercera persona activado por defecto
let playerName = "Jugador"; // Nombre del jugador

// Variables para multijugador
let socket;
let otherPlayers = {}; // Almacena los modelos de otros jugadores

// Configuración
const ARCHER_SIZE = 1;
const BAT_SIZE = 0.5;
const ARROW_SIZE = 0.3;
const GROUND_SIZE = 200; // Mapa mucho más grande
const ARCHER_SPEED = 0.15;
const AIM_SPEED = 0.05; // Velocidad de rotación al apuntar
const BAT_SPEED = 0.05;
const ARROW_SPEED = 0.5;
const AIM_LINE_LENGTH = 10; // Longitud de la línea de apuntado
const SHOOT_COOLDOWN = 0.2; // Tiempo entre disparos en segundos
const CAMERA_HEIGHT = 1.5; // Altura de la cámara en primera persona
const THIRD_PERSON_DISTANCE = 5; // Distancia de la cámara en tercera persona
const THIRD_PERSON_HEIGHT = 3; // Altura de la cámara en tercera persona
const NUM_DUNES = 50; // Número de dunas en el desierto
const NUM_CACTUS = 30; // Número de cactus en el desierto
const NUM_ROCKS = 40; // Número de rocas en el desierto

// Controles
const keys = {
    // Movimiento (WASD)
    w: false,
    a: false,
    s: false,
    d: false,
    // Apuntado (flechas)
    arrowUp: false,
    arrowDown: false,
    arrowLeft: false,
    arrowRight: false,
    // Disparo
    space: false
};

// Iniciar juego automáticamente cuando se carga la página
document.addEventListener('DOMContentLoaded', function() {
    // Iniciar conexión con el servidor
    setupMultiplayer();
    
    // Iniciar juego
    init();
});

// Configurar multijugador
function setupMultiplayer() {
    // Conectar al servidor
    socket = io();
    
    // Manejar eventos del servidor
    socket.on('connect', function() {
        console.log('Conectado al servidor con ID:', socket.id);
    });
    
    // Recibir jugadores actuales
    socket.on('currentPlayers', function(players) {
        // Actualizar número de jugadores
        document.getElementById('players').textContent = `Jugadores: ${Object.keys(players).length}`;
        
        // Crear modelos para los jugadores existentes
        Object.keys(players).forEach(function(id) {
            // No crear modelo para el jugador actual
            if (id !== socket.id) {
                addOtherPlayer(players[id]);
            }
        });
    });
    
    // Nuevo jugador se ha unido
    socket.on('newPlayer', function(playerInfo) {
        console.log('Nuevo jugador conectado:', playerInfo.id);
        // Actualizar número de jugadores
        const currentPlayers = parseInt(document.getElementById('players').textContent.split(': ')[1]);
        document.getElementById('players').textContent = `Jugadores: ${currentPlayers + 1}`;
        
        // Crear modelo para el nuevo jugador
        addOtherPlayer(playerInfo);
    });
    
    // Jugador se ha movido
    socket.on('playerMoved', function(playerInfo) {
        if (otherPlayers[playerInfo.id]) {
            // Actualizar posición y rotación del jugador
            const player = otherPlayers[playerInfo.id];
            // Suavizar el movimiento
            player.position.lerp(
                new THREE.Vector3(
                    playerInfo.position.x,
                    playerInfo.position.y,
                    playerInfo.position.z
                ),
                0.1
            );
            // Suavizar la rotación
            const targetRotation = playerInfo.rotation.y;
            player.rotation.y = targetRotation;
        }
    });
    
    // Jugador ha disparado una flecha
    socket.on('arrowShot', function(arrowInfo) {
        // Crear flecha disparada por otro jugador
        createArrowFromOtherPlayer(arrowInfo);
    });
    
    // Actualización de puntuación
    socket.on('scoreUpdate', function(scoreInfo) {
        if (scoreInfo.id === socket.id) {
            // Actualizar puntuación propia
            score = scoreInfo.score;
            document.getElementById('score').textContent = `Puntuación: ${score}`;
        }
    });
    
    // Jugador se ha desconectado
    socket.on('playerDisconnected', function(playerId) {
        console.log('Jugador desconectado:', playerId);
        // Actualizar número de jugadores
        const currentPlayers = parseInt(document.getElementById('players').textContent.split(': ')[1]);
        document.getElementById('players').textContent = `Jugadores: ${currentPlayers - 1}`;
        
        // Eliminar modelo del jugador
        if (otherPlayers[playerId]) {
            scene.remove(otherPlayers[playerId]);
            delete otherPlayers[playerId];
        }
    });
}

// Añadir otro jugador a la escena
function addOtherPlayer(playerInfo) {
    // Crear grupo para el jugador
    const otherPlayerGroup = new THREE.Group();
    
    // Crear modelo para el otro jugador (simplificado)
    const otherPlayerGeometry = new THREE.BoxGeometry(0.8, 1.8, 0.6);
    const otherPlayerMaterial = new THREE.MeshStandardMaterial({ color: Math.random() * 0xffffff });
    const otherPlayer = new THREE.Mesh(otherPlayerGeometry, otherPlayerMaterial);
    otherPlayerGroup.add(otherPlayer);
    
    // Añadir un indicador visual para la cabeza
    const headGeometry = new THREE.SphereGeometry(0.3, 16, 16);
    const headMaterial = new THREE.MeshStandardMaterial({ color: 0xE0AC69 });
    const head = new THREE.Mesh(headGeometry, headMaterial);
    head.position.y = 0.9;
    otherPlayerGroup.add(head);
    
    // Crear un canvas para el nombre del jugador
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.width = 256;
    canvas.height = 64;
    context.fillStyle = 'white';
    context.font = '24px Arial';
    context.textAlign = 'center';
    context.fillText(playerInfo.name || 'Jugador', canvas.width / 2, canvas.height / 2);
    
    // Crear textura y sprite para el nombre
    const nameTexture = new THREE.CanvasTexture(canvas);
    const nameMaterial = new THREE.SpriteMaterial({ map: nameTexture });
    const nameSprite = new THREE.Sprite(nameMaterial);
    nameSprite.position.y = 2;
    nameSprite.scale.set(2, 0.5, 1);
    otherPlayerGroup.add(nameSprite);
    
    // Establecer posición del jugador
    otherPlayerGroup.position.set(
        playerInfo.position.x,
        playerInfo.position.y,
        playerInfo.position.z
    );
    
    // Establecer rotación
    otherPlayerGroup.rotation.y = playerInfo.rotation.y;
    
    // Añadir a la escena y guardar referencia
    scene.add(otherPlayerGroup);
    otherPlayers[playerInfo.id] = otherPlayerGroup;
}

// Crear flecha disparada por otro jugador
function createArrowFromOtherPlayer(arrowInfo) {
    // Crear flecha similar a la función shootArrow
    const arrowGeometry = new THREE.CylinderGeometry(ARROW_SIZE / 10, ARROW_SIZE / 10, ARROW_SIZE, 8);
    const arrowMaterial = new THREE.MeshStandardMaterial({ color: 0x8B4513 });
    const arrow = new THREE.Mesh(arrowGeometry, arrowMaterial);
    
    // Añadir punta a la flecha
    const tipGeometry = new THREE.ConeGeometry(ARROW_SIZE / 8, ARROW_SIZE / 4, 8);
    const tipMaterial = new THREE.MeshStandardMaterial({ color: 0x555555 });
    const tip = new THREE.Mesh(tipGeometry, tipMaterial);
    tip.position.y = ARROW_SIZE / 2 + ARROW_SIZE / 8;
    arrow.add(tip);
    
    // Añadir plumas a la flecha (igual que en shootArrow)
    const featherGeometry = new THREE.BoxGeometry(ARROW_SIZE / 5, ARROW_SIZE / 20, ARROW_SIZE / 5);
    const featherMaterial = new THREE.MeshStandardMaterial({ color: 0xFFFFFF });
    
    const feather1 = new THREE.Mesh(featherGeometry, featherMaterial);
    feather1.position.y = -ARROW_SIZE / 2 + ARROW_SIZE / 10;
    feather1.rotation.x = Math.PI / 4;
    arrow.add(feather1);
    
    const feather2 = new THREE.Mesh(featherGeometry, featherMaterial);
    feather2.position.y = -ARROW_SIZE / 2 + ARROW_SIZE / 10;
    feather2.rotation.x = -Math.PI / 4;
    arrow.add(feather2);
    
    // Posición inicial de la flecha
    arrow.position.set(
        arrowInfo.position.x,
        arrowInfo.position.y,
        arrowInfo.position.z
    );
    
    // Dirección de la flecha
    const direction = new THREE.Vector3(
        arrowInfo.direction.x,
        arrowInfo.direction.y,
        arrowInfo.direction.z
    ).normalize();
    
    // Rotar la flecha para que apunte en la dirección correcta
    arrow.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
    
    // Añadir la flecha a la escena y al array de flechas
    scene.add(arrow);
    arrows.push({
        mesh: arrow,
        direction: direction.clone().multiplyScalar(arrowInfo.power || 1),
        created: clock.getElapsedTime()
    });
}

// Inicialización
function init() {
    try {
        console.log("Iniciando función init()");
        document.getElementById('debugInfo').textContent = 'Inicializando componentes del juego...';
        
        // Crear escena
        scene = new THREE.Scene();
        scene.background = new THREE.Color(0x0A1020); // Cielo nocturno oscuro
        
        console.log("Escena creada");
        document.getElementById('debugInfo').textContent = 'Escena creada. Configurando cámara...';
        
        // Niebla para simular horizonte desértico (más tenue para la noche)
        scene.fog = new THREE.FogExp2(0x0A1020, 0.004); // Niebla nocturna
        
        // Crear cámara
        createCamera();
        console.log("Cámara creada");
        
        // Crear renderizador
        renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        document.body.appendChild(renderer.domElement);
        console.log("Renderizador creado y añadido al DOM");
        document.getElementById('debugInfo').textContent = 'Renderizador creado. Configurando luces...';
        
        // Luces
        // Luz ambiental nocturna (tenue)
        const ambientLight = new THREE.AmbientLight(0x102030, 0.3);
        scene.add(ambientLight);
        
        // Luz de la luna (direccional)
        const moonLight = new THREE.DirectionalLight(0xCCDDFF, 0.6);
        moonLight.position.set(0.5, 1, 0.5);
        scene.add(moonLight);
        console.log("Luces creadas");
        
        document.getElementById('debugInfo').textContent = 'Luces añadidas. Creando elementos del juego...';
        
        // Crear luna
        createMoon();
        console.log("Luna creada");
        
        // Crear estrellas
        createStars();
        console.log("Estrellas creadas");
        
        // Crear suelo del desierto
        createDesert();
        console.log("Desierto creado");
        
        // Crear arquero detallado
        createDetailedArcher();
        console.log("Arquero creado");
        
        // Crear arco equipado (para primera persona)
        createEquippedBow();
        console.log("Arco creado");
        
        // Eventos
        window.addEventListener('resize', onWindowResize);
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        
        // Asignar explícitamente el evento de click
        document.addEventListener('click', function(event) {
            shootArrow();
        });
        console.log("Eventos registrados");
        
        document.getElementById('debugInfo').textContent = 'Juego inicializado. ¡Listo para jugar!';
        
        // Crear línea de apuntado
        const aimLineGeometry = new THREE.BufferGeometry();
        const aimLinePoints = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, AIM_LINE_LENGTH)];
        aimLineGeometry.setFromPoints(aimLinePoints);
        const aimLineMaterial = new THREE.LineBasicMaterial({ color: 0xFF0000 });
        aimLine = new THREE.Line(aimLineGeometry, aimLineMaterial);
        scene.add(aimLine);
        console.log("Línea de apuntado creada");
        
        // Iniciar animación
        animate();
        console.log("Animación iniciada");
    } catch (error) {
        console.error("Error en init():", error);
        document.getElementById('debugInfo').textContent = 'Error al inicializar el juego: ' + error.message;
    }
}

// Crear la luna
function createMoon() {
    const moonGeometry = new THREE.SphereGeometry(15, 32, 32);
    const moonMaterial = new THREE.MeshBasicMaterial({ 
        color: 0xFFFFFF
    });
    const moon = new THREE.Mesh(moonGeometry, moonMaterial);
    
    // Posicionar la luna en el cielo
    moon.position.set(100, 80, -150);
    
    // Agregar resplandor alrededor de la luna
    const moonGlow = new THREE.PointLight(0xCCDDFF, 1, 300);
    moonGlow.position.copy(moon.position);
    scene.add(moonGlow);
    
    scene.add(moon);
}

// Crear estrellas
function createStars() {
    const starsGeometry = new THREE.BufferGeometry();
    const starsCount = 2000;
    const positions = new Float32Array(starsCount * 3);
    const sizes = new Float32Array(starsCount);
    
    for (let i = 0; i < starsCount; i++) {
        // Posición aleatoria en una esfera
        const radius = 400;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        
        positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
        positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta) + 100; // Elevar un poco
        positions[i * 3 + 2] = radius * Math.cos(phi);
        
        sizes[i] = Math.random() * 2;
    }
    
    starsGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    starsGeometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    
    const starsMaterial = new THREE.PointsMaterial({
        color: 0xFFFFFF,
        size: 0.5,
        transparent: true,
        sizeAttenuation: true,
        opacity: 0.8
    });
    
    const stars = new THREE.Points(starsGeometry, starsMaterial);
    scene.add(stars);
}

// Crear el desierto
function createDesert() {
    // Crear suelo base (más liso)
    const groundGeometry = new THREE.PlaneGeometry(GROUND_SIZE, GROUND_SIZE, 50, 50);
    
    // Usar un color plano en lugar de una textura
    const groundMaterial = new THREE.MeshStandardMaterial({ 
        color: 0xAA8866, // Color arena nocturno
        roughness: 0.9,
        metalness: 0.1
    });
    
    ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.1;
    scene.add(ground);
    
    // Crear unas pocas dunas suaves (menos y más dispersas)
    for (let i = 0; i < 20; i++) {
        createNightDune();
    }
    
    // Crear cactus reducidos
    for (let i = 0; i < 15; i++) {
        createCactus();
    }
    
    // Crear rocas (pocas)
    for (let i = 0; i < 20; i++) {
        createRock();
    }
}

// Crear una duna de arena (nocturna, más suave)
function createNightDune() {
    const duneGeometry = new THREE.SphereGeometry(Math.random() * 4 + 2, 8, 8, 0, Math.PI * 2, 0, Math.PI / 2);
    const duneMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x998877, // Color arena nocturno
        roughness: 1,
        metalness: 0
    });
    const dune = new THREE.Mesh(duneGeometry, duneMaterial);
    
    // Posicionar aleatoriamente en el mapa (más dispersas)
    const halfSize = GROUND_SIZE / 2 - 10;
    dune.position.set(
        Math.random() * GROUND_SIZE * 1.2 - halfSize,
        -Math.random() * 0.2 - 0.1,
        Math.random() * GROUND_SIZE * 1.2 - halfSize
    );
    
    // Escalar y aplanar mucho más para que sea más sutil
    dune.scale.set(
        Math.random() * 0.7 + 1,
        Math.random() * 0.1 + 0.05,  // Muy aplanada
        Math.random() * 0.7 + 1
    );
    dune.rotation.y = Math.random() * Math.PI * 2;
    
    scene.add(dune);
}

// Crear un cactus
function createCactus() {
    const cactusGroup = new THREE.Group();
    
    // Tronco principal
    const trunkGeometry = new THREE.CylinderGeometry(0.3, 0.4, 2 + Math.random() * 3, 8);
    const cactusMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x2E8B57,
        roughness: 0.8,
        metalness: 0.2
    });
    const trunk = new THREE.Mesh(trunkGeometry, cactusMaterial);
    trunk.position.y = trunkGeometry.parameters.height / 2;
    cactusGroup.add(trunk);
    
    // Añadir brazos al cactus (50% de probabilidad)
    if (Math.random() > 0.5) {
        // Brazo izquierdo
        const leftArmGeometry = new THREE.CylinderGeometry(0.2, 0.25, 1 + Math.random() * 1.5, 8);
        const leftArm = new THREE.Mesh(leftArmGeometry, cactusMaterial);
        leftArm.position.set(-0.4, 1 + Math.random(), 0);
        leftArm.rotation.z = Math.PI / 4 + Math.random() * 0.2;
        cactusGroup.add(leftArm);
        
        // Brazo derecho
        if (Math.random() > 0.3) {
            const rightArmGeometry = new THREE.CylinderGeometry(0.2, 0.25, 1 + Math.random() * 1.5, 8);
            const rightArm = new THREE.Mesh(rightArmGeometry, cactusMaterial);
            rightArm.position.set(0.4, 0.7 + Math.random(), 0);
            rightArm.rotation.z = -Math.PI / 4 - Math.random() * 0.2;
            cactusGroup.add(rightArm);
        }
    }
    
    // Posicionar aleatoriamente en el mapa
    const halfSize = GROUND_SIZE / 2 - 10;
    cactusGroup.position.set(
        Math.random() * GROUND_SIZE - halfSize,
        0,
        Math.random() * GROUND_SIZE - halfSize
    );
    
    // Rotar aleatoriamente
    cactusGroup.rotation.y = Math.random() * Math.PI * 2;
    
    scene.add(cactusGroup);
}

// Crear una roca
function createRock() {
    const rockGeometry = new THREE.DodecahedronGeometry(Math.random() * 1 + 0.5, 0);
    const rockMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x808080, 
        roughness: 0.9,
        metalness: 0.1
    });
    const rock = new THREE.Mesh(rockGeometry, rockMaterial);
    
    // Posicionar aleatoriamente en el mapa
    const halfSize = GROUND_SIZE / 2 - 10;
    rock.position.set(
        Math.random() * GROUND_SIZE - halfSize,
        rockGeometry.parameters.radius / 2,
        Math.random() * GROUND_SIZE - halfSize
    );
    
    // Escalar y rotar aleatoriamente
    rock.scale.set(
        Math.random() * 0.5 + 0.8,
        Math.random() * 0.3 + 0.6,
        Math.random() * 0.5 + 0.8
    );
    rock.rotation.set(
        Math.random() * Math.PI,
        Math.random() * Math.PI,
        Math.random() * Math.PI
    );
    
    scene.add(rock);
}

// Crear arquero detallado con animaciones
function createDetailedArcher() {
    // Primero creamos un modelo básico para tener algo visible mientras se carga el modelo detallado
    const basicArcherGeometry = new THREE.ConeGeometry(ARCHER_SIZE / 2, ARCHER_SIZE, 8);
    const basicArcherMaterial = new THREE.MeshStandardMaterial({ color: 0x8B4513 });
    archer = new THREE.Mesh(basicArcherGeometry, basicArcherMaterial);
    archer.position.y = ARCHER_SIZE / 2;
    
    // Asegurarse de que el arquero mire hacia adelante (hacia -Z)
    archer.rotation.x = 0;
    archer.rotation.y = 0;
    archer.rotation.z = 0;
    
    scene.add(archer);
    
    // Crear modelo detallado del arquero
    createArcherModel();
}

// Crear modelo detallado del arquero usando geometrías
function createArcherModel() {
    // Grupo principal para el modelo completo
    archerModel = new THREE.Group();
    
    // Material para la piel
    const skinMaterial = new THREE.MeshStandardMaterial({ color: 0xE0AC69 });
    // Material para la ropa
    const clothMaterial = new THREE.MeshStandardMaterial({ color: 0x2E4172 });
    // Material para el pelo
    const hairMaterial = new THREE.MeshStandardMaterial({ color: 0x3A2412 });
    
    // Cabeza
    const head = new THREE.Mesh(
        new THREE.SphereGeometry(0.25, 16, 16),
        skinMaterial
    );
    head.position.y = 1.6;
    archerModel.add(head);
    
    // Pelo
    const hair = new THREE.Mesh(
        new THREE.SphereGeometry(0.26, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2),
        hairMaterial
    );
    hair.position.y = 1.65;
    hair.rotation.x = -Math.PI / 8;
    archerModel.add(hair);
    
    // Torso
    const torso = new THREE.Mesh(
        new THREE.BoxGeometry(0.6, 0.7, 0.3),
        clothMaterial
    );
    torso.position.y = 1.15;
    archerModel.add(torso);
    
    // Piernas
    const createLeg = (isLeft) => {
        const legGroup = new THREE.Group();
        
        // Muslo
        const thigh = new THREE.Mesh(
            new THREE.CylinderGeometry(0.12, 0.1, 0.45, 8),
            clothMaterial
        );
        thigh.position.y = -0.225;
        legGroup.add(thigh);
        
        // Pantorrilla
        const calf = new THREE.Mesh(
            new THREE.CylinderGeometry(0.1, 0.08, 0.45, 8),
            clothMaterial
        );
        calf.position.y = -0.675;
        legGroup.add(calf);
        
        // Pie
        const foot = new THREE.Mesh(
            new THREE.BoxGeometry(0.15, 0.1, 0.3),
            new THREE.MeshStandardMaterial({ color: 0x654321 })
        );
        foot.position.set(0, -0.95, 0.05);
        legGroup.add(foot);
        
        // Posicionar la pierna
        legGroup.position.set(isLeft ? -0.2 : 0.2, 0.8, 0);
        
        // Guardar referencia para animaciones
        if (isLeft) {
            archerModel.leftLeg = legGroup;
        } else {
            archerModel.rightLeg = legGroup;
        }
        
        return legGroup;
    };
    
    // Crear piernas
    const leftLeg = createLeg(true);
    const rightLeg = createLeg(false);
    archerModel.add(leftLeg);
    archerModel.add(rightLeg);
    
    // Brazos
    const createArm = (isLeft) => {
        const armGroup = new THREE.Group();
        
        // Parte superior del brazo
        const upperArm = new THREE.Mesh(
            new THREE.CylinderGeometry(0.1, 0.09, 0.4, 8),
            skinMaterial
        );
        upperArm.position.y = -0.2;
        armGroup.add(upperArm);
        
        // Antebrazo
        const forearm = new THREE.Mesh(
            new THREE.CylinderGeometry(0.09, 0.08, 0.4, 8),
            skinMaterial
        );
        forearm.position.y = -0.6;
        armGroup.add(forearm);
        
        // Mano
        const hand = new THREE.Mesh(
            new THREE.BoxGeometry(0.1, 0.15, 0.05),
            skinMaterial
        );
        hand.position.y = -0.85;
        armGroup.add(hand);
        
        // Posicionar el brazo
        const xPos = isLeft ? -0.35 : 0.35;
        armGroup.position.set(xPos, 1.35, 0);
        
        // Guardar referencia para animaciones
        if (isLeft) {
            archerModel.leftArm = armGroup;
        } else {
            archerModel.rightArm = armGroup;
        }
        
        return armGroup;
    };
    
    // Crear brazos
    const leftArm = createArm(true);
    const rightArm = createArm(false);
    archerModel.add(leftArm);
    archerModel.add(rightArm);
    
    // Arco (sostenido por la mano izquierda)
    const bow = new THREE.Group();
    
    // Parte principal del arco
    const bowCurve = new THREE.Mesh(
        new THREE.TorusGeometry(0.3, 0.02, 16, 32, Math.PI),
        new THREE.MeshStandardMaterial({ color: 0x8B4513 })
    );
    bowCurve.rotation.y = Math.PI / 2;
    bow.add(bowCurve);
    
    // Cuerda
    const string = new THREE.Mesh(
        new THREE.CylinderGeometry(0.005, 0.005, 0.6, 8),
        new THREE.MeshStandardMaterial({ color: 0xEEEEEE })
    );
    string.position.x = 0.3;
    bow.add(string);
    
    // Añadir arco a la mano izquierda
    bow.position.set(0, -0.85, 0.2);
    leftArm.add(bow);
    archerModel.bow = bow;
    
    // Posicionar modelo
    archerModel.position.copy(archer.position);
    archerModel.rotation.y = 0; // Mirando hacia el frente (-Z)
    
    // Añadir modelo a la escena
    scene.add(archerModel);
    
    // Configurar animaciones
    setupArcherAnimations();
}

// Configurar animaciones para el arquero
function setupArcherAnimations() {
    // Definir animaciones
    
    // Animación de idle (parado)
    archerAnimations.idle = {
        play: function(time) {
            // Pequeño movimiento arriba/abajo
            const idleY = Math.sin(time * 1.5) * 0.02;
            archerModel.position.y = ARCHER_SIZE / 2 + idleY;
            
            // Restablecer rotaciones
            if (archerModel.leftLeg) {
                archerModel.leftLeg.rotation.x = 0;
                archerModel.rightLeg.rotation.x = 0;
                archerModel.leftArm.rotation.x = 0;
                archerModel.rightArm.rotation.x = 0;
            }
        }
    };
    
    // Animación de caminar
    archerAnimations.walk = {
        play: function(time) {
            if (!archerModel.leftLeg) return;
            
            const walkSpeed = 10;
            const legRotation = Math.sin(time * walkSpeed) * 0.4;
            const armRotation = Math.sin(time * walkSpeed) * 0.2;
            
            // Piernas alternando
            archerModel.leftLeg.rotation.x = legRotation;
            archerModel.rightLeg.rotation.x = -legRotation;
            
            // Brazos alternando
            archerModel.leftArm.rotation.x = -armRotation;
            archerModel.rightArm.rotation.x = armRotation;
            
            // Pequeño rebote
            archerModel.position.y = ARCHER_SIZE / 2 + Math.abs(Math.sin(time * walkSpeed)) * 0.05;
        }
    };
    
    // Animación de disparo
    archerAnimations.draw = {
        play: function(time, progress) {
            if (!archerModel.rightArm) return;
            
            // Levantar brazo derecho para tensar el arco
            archerModel.rightArm.rotation.x = -Math.PI/4 - progress * Math.PI/4;
            archerModel.rightArm.rotation.z = progress * Math.PI/6;
            
            // Levantar ligeramente el brazo izquierdo
            archerModel.leftArm.rotation.x = -Math.PI/6;
            
            // Rotar ligeramente el torso
            archerModel.rotation.y = Math.PI + progress * Math.PI/12;
        }
    };
    
    // Animación de disparar
    archerAnimations.shoot = {
        play: function(time, progress) {
            if (!archerModel.rightArm) return;
            
            // Regresar el brazo derecho a la posición normal
            archerModel.rightArm.rotation.x = -Math.PI/2 + progress * Math.PI/2;
            archerModel.rightArm.rotation.z = (1 - progress) * Math.PI/6;
            
            // Regresar el torso
            archerModel.rotation.y = Math.PI + (1 - progress) * Math.PI/12;
        },
        duration: 0.3
    };
    
    // Establecer animación actual como idle
    currentAnimation = archerAnimations.idle;
}

// Actualizar animaciones
function updateAnimation(delta) {
    const time = clock.getElapsedTime();
    
    // Determinar qué animación reproducir
    if (isDrawingBow) {
        // Animación de tensar arco
        currentAnimation = archerAnimations.draw;
        currentAnimation.play(time, bowDrawProgress);
    } else if (isMoving) {
        // Animación de caminar
        currentAnimation = archerAnimations.walk;
        currentAnimation.play(time);
    } else {
        // Animación de reposo
        currentAnimation = archerAnimations.idle;
        currentAnimation.play(time);
    }
    
    // Actualizar posición del modelo
    if (archerModel) {
        archerModel.position.x = archer.position.x;
        archerModel.position.z = archer.position.z;
        
        // Sincronizar la rotación del modelo con el objeto archer
        archerModel.rotation.y = archer.rotation.y;
        
        // Si está en movimiento, ajustar la rotación según la dirección
        if (isMoving && moveDirectionTemp && moveDirectionTemp.length() > 0) {
            const targetRotation = Math.atan2(moveDirectionTemp.x, moveDirectionTemp.z);
            // Aplicar la misma rotación al objeto archer y al modelo
            archer.rotation.y = targetRotation;
            archerModel.rotation.y = targetRotation;
        }
    }
}

// Variable temporal para almacenar la dirección de movimiento
let moveDirectionTemp = new THREE.Vector3();

// Actualizar posiciones
function update() {
    const delta = clock.getDelta();
    
    // Mover arquero (WASD) - CORREGIDO: direcciones correctas
    const moveDirection = new THREE.Vector3(0, 0, 0);
    
    // Obtener la dirección a la que apunta la cámara
    const cameraDirection = new THREE.Vector3(0, 0, -1);
    cameraDirection.applyQuaternion(camera.quaternion);
    cameraDirection.y = 0; // Mantener el movimiento en el plano horizontal
    cameraDirection.normalize();
    
    // Vector perpendicular para movimientos laterales
    const cameraSideDirection = new THREE.Vector3(-cameraDirection.z, 0, cameraDirection.x);
    
    // Aplicar movimientos relativos a la dirección de la cámara
    if (keys.w) moveDirection.add(cameraDirection);
    if (keys.s) moveDirection.sub(cameraDirection);
    if (keys.a) moveDirection.sub(cameraSideDirection);
    if (keys.d) moveDirection.add(cameraSideDirection);
    
    // Marcar si el personaje está moviéndose
    isMoving = moveDirection.length() > 0;
    
    if (isMoving) {
        moveDirection.normalize();
        archer.position.x += moveDirection.x * ARCHER_SPEED;
        archer.position.z += moveDirection.z * ARCHER_SPEED;
        
        // Guardar dirección de movimiento para animaciones
        moveDirectionTemp.copy(moveDirection);
        
        // Limitar posición del arquero al suelo
        const groundHalfSize = GROUND_SIZE / 2;
        archer.position.x = Math.max(-groundHalfSize, Math.min(groundHalfSize, archer.position.x));
        archer.position.z = Math.max(-groundHalfSize, Math.min(groundHalfSize, archer.position.z));
        
        // Enviar posición al servidor si está conectado
        if (socket) {
            socket.emit('playerMovement', {
                position: {
                    x: archer.position.x,
                    y: archer.position.y,
                    z: archer.position.z
                },
                rotation: {
                    y: archer.rotation.y
                }
            });
        }
    }
    
    // Rotar arquero (flechas del teclado)
    let rotateAmount = 0;
    
    if (keys.arrowLeft) {
        rotateAmount -= AIM_SPEED;
    }
    if (keys.arrowRight) {
        rotateAmount += AIM_SPEED;
    }
    
    if (rotateAmount !== 0) {
        archer.rotation.y += rotateAmount;
        
        // Asegurar que el modelo siga la rotación del archer
        if (archerModel) {
            archerModel.rotation.y = archer.rotation.y;
        }
        
        // Actualizar la rotación en el servidor
        if (socket) {
            socket.emit('playerMovement', {
                position: {
                    x: archer.position.x,
                    y: archer.position.y,
                    z: archer.position.z
                },
                rotation: {
                    y: archer.rotation.y
                }
            });
        }
    }
    
    // Actualizar línea de apuntado
    updateAimLine();
    
    // Actualizar la cámara para tercera persona
    updateCamera();
    
    // Actualizar animaciones
    updateAnimation(delta);
    
    // Ocultar manos en tercera persona
    if (hands.left) hands.left.visible = !isThirdPerson;
    if (hands.right) hands.right.visible = !isThirdPerson;
    
    // Ocultar arco equipado en tercera persona (ya que el modelo tiene su propio arco)
    if (equippedBow) equippedBow.visible = !isThirdPerson;
    
    // Ocultar modelo básico y mostrar solo el modelo detallado
    if (archerModel) archer.visible = false;
    
    // Mover murciélagos
    for (const bat of bats) {
        // Calcular dirección hacia el arquero
        const direction = new THREE.Vector3();
        direction.subVectors(archer.position, bat.mesh.position);
        direction.normalize();
        
        // Actualizar dirección del murciélago
        bat.direction.lerp(direction, 0.02);
        bat.direction.normalize();
        
        // Mover murciélago
        bat.mesh.position.add(bat.direction.clone().multiplyScalar(BAT_SPEED));
        
        // Rotar murciélago hacia el arquero
        bat.mesh.lookAt(archer.position);
        
        // Animar alas
        bat.wingAngle += 5 * delta;
        bat.wings.left.rotation.z = Math.sin(bat.wingAngle) * 0.5;
        bat.wings.right.rotation.z = -Math.sin(bat.wingAngle) * 0.5;
    }
    
    // Generar nuevos murciélagos
    const currentTime = clock.getElapsedTime();
    if (currentTime - lastBatTime > batSpawnInterval && !isGameOver) {
        createBat();
        lastBatTime = currentTime;
        
        // Aumentar dificultad reduciendo el intervalo de aparición
        batSpawnInterval = Math.max(0.5, batSpawnInterval * 0.98);
    }
    
    // Comprobar colisiones
    checkCollisions();
}

// Actualizar la cámara según el modo (primera o tercera persona)
function updateCamera() {
    if (isThirdPerson) {
        // Vista en tercera persona
        // Posición de la cámara detrás del personaje
        const idealOffset = new THREE.Vector3(0, THIRD_PERSON_HEIGHT, THIRD_PERSON_DISTANCE);
        idealOffset.applyAxisAngle(new THREE.Vector3(0, 1, 0), archer.rotation.y);
        
        // Crear vector de posición para la cámara
        const targetCamPos = new THREE.Vector3();
        targetCamPos.copy(archer.position).add(idealOffset);
        
        // Suavizar movimiento de la cámara
        camera.position.lerp(targetCamPos, 0.1);
        
        // Hacer que la cámara mire al personaje
        const lookAtPos = new THREE.Vector3();
        lookAtPos.copy(archer.position).add(new THREE.Vector3(0, 1, 0)); // Mirar un poco más arriba del centro del personaje
        camera.lookAt(lookAtPos);
    } else {
        // Vista en primera persona
        camera.position.copy(archer.position);
        camera.position.y = CAMERA_HEIGHT;
        
        // Crear un vector de dirección hacia donde mira el arquero
        const direction = new THREE.Vector3(0, 0, -1).applyQuaternion(archer.quaternion);
        
        // Calcular punto hacia donde mirar (frente al arquero)
        const target = new THREE.Vector3();
        target.copy(camera.position);
        target.add(direction);
        
        // Hacer que la cámara mire hacia ese punto
        camera.lookAt(target);
    }
}

// Crear murciélago
function createBat() {
    const batGeometry = new THREE.SphereGeometry(BAT_SIZE / 2, 8, 8);
    const batMaterial = new THREE.MeshStandardMaterial({ color: 0x000000 });
    const bat = new THREE.Mesh(batGeometry, batMaterial);
    
    // Posicionar murciélago en los bordes del mapa
    const side = Math.floor(Math.random() * 4);
    const offset = GROUND_SIZE / 3; // Ajustar para mapa más grande
    
    switch(side) {
        case 0: // Top
            bat.position.set(Math.random() * GROUND_SIZE/2 - GROUND_SIZE/4, BAT_SIZE, -offset);
            break;
        case 1: // Right
            bat.position.set(offset, BAT_SIZE, Math.random() * GROUND_SIZE/2 - GROUND_SIZE/4);
            break;
        case 2: // Bottom
            bat.position.set(Math.random() * GROUND_SIZE/2 - GROUND_SIZE/4, BAT_SIZE, offset);
            break;
        case 3: // Left
            bat.position.set(-offset, BAT_SIZE, Math.random() * GROUND_SIZE/2 - GROUND_SIZE/4);
            break;
    }
    
    // Añadir alas al murciélago
    const wingGeometry = new THREE.BoxGeometry(BAT_SIZE, BAT_SIZE / 10, BAT_SIZE / 2);
    const wingMaterial = new THREE.MeshStandardMaterial({ color: 0x222222 });
    
    const leftWing = new THREE.Mesh(wingGeometry, wingMaterial);
    leftWing.position.set(-BAT_SIZE / 2, 0, 0);
    bat.add(leftWing);
    
    const rightWing = new THREE.Mesh(wingGeometry, wingMaterial);
    rightWing.position.set(BAT_SIZE / 2, 0, 0);
    bat.add(rightWing);
    
    scene.add(bat);
    bats.push({
        mesh: bat,
        wings: {
            left: leftWing,
            right: rightWing
        },
        direction: new THREE.Vector3(),
        wingAngle: 0
    });
}

// Crear arco equipado (visible en primera persona)
function createEquippedBow() {
    // Crear el arco
    const bowGroup = new THREE.Group();
    
    // Parte principal del arco (curva)
    const bowCurveGeometry = new THREE.TorusGeometry(0.3, 0.03, 16, 32, Math.PI);
    const bowMaterial = new THREE.MeshStandardMaterial({ color: 0x8B4513 });
    const bowCurve = new THREE.Mesh(bowCurveGeometry, bowMaterial);
    bowCurve.rotation.x = Math.PI / 2;
    bowGroup.add(bowCurve);
    
    // Cuerda del arco
    const stringGeometry = new THREE.CylinderGeometry(0.005, 0.005, 0.6, 8);
    const stringMaterial = new THREE.MeshStandardMaterial({ color: 0xEEEEEE });
    const string = new THREE.Mesh(stringGeometry, stringMaterial);
    string.position.z = 0.3; // Posición de la cuerda
    bowGroup.add(string);
    
    // Mango del arco
    const handleGeometry = new THREE.CylinderGeometry(0.04, 0.04, 0.2, 8);
    const handleMaterial = new THREE.MeshStandardMaterial({ color: 0x654321 });
    const handle = new THREE.Mesh(handleGeometry, handleMaterial);
    handle.rotation.x = Math.PI / 2;
    bowGroup.add(handle);
    
    // Ajustar posición y rotación del arco
    bowGroup.rotation.y = Math.PI / 2;
    
    // Añadir arco a la escena
    equippedBow = bowGroup;
    scene.add(equippedBow);
    
    // Crear manos
    createHands();
}

// Crear manos del jugador
function createHands() {
    // Material para la piel
    const skinMaterial = new THREE.MeshStandardMaterial({ color: 0xE0AC69 });
    
    // Mano izquierda (sostiene el arco)
    const leftHandGroup = new THREE.Group();
    
    // Palma de la mano
    const palmGeometry = new THREE.BoxGeometry(0.08, 0.15, 0.03);
    const leftPalm = new THREE.Mesh(palmGeometry, skinMaterial);
    leftHandGroup.add(leftPalm);
    
    // Dedos
    const fingerGeometry = new THREE.BoxGeometry(0.02, 0.08, 0.02);
    
    for (let i = 0; i < 4; i++) {
        const finger = new THREE.Mesh(fingerGeometry, skinMaterial);
        finger.position.y = 0.12;
        finger.position.x = -0.03 + 0.02 * i;
        leftHandGroup.add(finger);
    }
    
    // Pulgar
    const thumbGeometry = new THREE.BoxGeometry(0.02, 0.06, 0.02);
    const thumb = new THREE.Mesh(thumbGeometry, skinMaterial);
    thumb.position.set(-0.05, 0.05, 0);
    thumb.rotation.z = Math.PI / 6;
    leftHandGroup.add(thumb);
    
    // Mano derecha (tensa la cuerda)
    const rightHandGroup = new THREE.Group();
    
    // Palma
    const rightPalm = new THREE.Mesh(palmGeometry, skinMaterial);
    rightHandGroup.add(rightPalm);
    
    // Dedos para la mano derecha
    for (let i = 0; i < 3; i++) {
        const finger = new THREE.Mesh(fingerGeometry, skinMaterial);
        finger.position.y = 0.12;
        finger.position.x = -0.02 + 0.02 * i;
        rightHandGroup.add(finger);
    }
    
    // Añadir manos a la escena
    hands.left = leftHandGroup;
    hands.right = rightHandGroup;
    scene.add(leftHandGroup);
    scene.add(rightHandGroup);
}

// Animación de tensado del arco
function updateBowDrawing() {
    if (isDrawingBow) {
        // Incrementar progreso de tensado
        bowDrawProgress = Math.min(bowDrawProgress + 0.05, 1);
        
        // Mover la mano derecha hacia atrás a medida que se tensa
        const drawDistance = 0.3 * bowDrawProgress;
        hands.right.position.z = hands.left.position.z - drawDistance;
    } else {
        // Regresar a posición normal
        bowDrawProgress = Math.max(bowDrawProgress - 0.1, 0);
        hands.right.position.z = hands.left.position.z;
    }
}

// Manejar eventos de teclado
function handleKeyDown(event) {
    switch(event.key.toLowerCase()) {
        // Movimiento (WASD) - corregidos
        case 'w':
            keys.w = true;
            break;
        case 'a':
            keys.a = true;
            break;
        case 's':
            keys.s = true;
            break;
        case 'd':
            keys.d = true;
            break;
        // Apuntado (flechas)
        case 'arrowup':
            keys.arrowUp = true;
            break;
        case 'arrowdown':
            keys.arrowDown = true;
            break;
        case 'arrowleft':
            keys.arrowLeft = true;
            break;
        case 'arrowright':
            keys.arrowRight = true;
            break;
        // Disparo
        case ' ': // Espacio
            keys.space = true;
            isDrawingBow = true; // Comenzar a tensar el arco
            break;
        // Cambiar vista
        case 'v':
            isThirdPerson = !isThirdPerson; // Alternar entre primera y tercera persona
            break;
    }
}

function handleKeyUp(event) {
    switch(event.key.toLowerCase()) {
        // Movimiento (WASD)
        case 'w':
            keys.w = false;
            break;
        case 'a':
            keys.a = false;
            break;
        case 's':
            keys.s = false;
            break;
        case 'd':
            keys.d = false;
            break;
        // Apuntado (flechas)
        case 'arrowup':
            keys.arrowUp = false;
            break;
        case 'arrowdown':
            keys.arrowDown = false;
            break;
        case 'arrowleft':
            keys.arrowLeft = false;
            break;
        case 'arrowright':
            keys.arrowRight = false;
            break;
        // Disparo
        case ' ': // Espacio
            keys.space = false;
            if (isDrawingBow) {
                shootArrow();
                isDrawingBow = false;
            }
            break;
    }
}

// Actualizar tamaño de ventana
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// Comprobar colisiones
function checkCollisions() {
    // Comprobar colisiones entre flechas y murciélagos
    for (let i = arrows.length - 1; i >= 0; i--) {
        const arrow = arrows[i];
        
        for (let j = bats.length - 1; j >= 0; j--) {
            const bat = bats[j];
            
            const distance = arrow.mesh.position.distanceTo(bat.mesh.position);
            
            if (distance < BAT_SIZE) {
                // Eliminar murciélago y flecha
                scene.remove(bat.mesh);
                scene.remove(arrow.mesh);
                bats.splice(j, 1);
                arrows.splice(i, 1);
                
                // Aumentar puntuación
                score += 10;
                document.getElementById('score').textContent = `Puntuación: ${score}`;
                
                // Emitir evento al servidor
                if (socket) {
                    socket.emit('batKilled', { score: score });
                }
                
                break;
            }
        }
    }
    
    // Comprobar colisiones entre murciélagos y arquero
    for (let i = bats.length - 1; i >= 0; i--) {
        const bat = bats[i];
        const distance = bat.mesh.position.distanceTo(archer.position);
        
        if (distance < ARCHER_SIZE + BAT_SIZE / 2) {
            // Game over
            isGameOver = true;
            document.getElementById('gameOver').style.display = 'block';
            break;
        }
    }
}

// Actualizar línea de apuntado
function updateAimLine() {
    // Posicionar la línea en la posición del arquero
    aimLine.position.copy(archer.position);
    aimLine.position.y = 0.1; // Elevar ligeramente la línea para que sea visible
    
    // Obtener la dirección actual del arquero
    const archerDirection = new THREE.Vector3(0, 0, -1).applyQuaternion(archer.quaternion);
    
    // Crear puntos de la línea (origen y final)
    const startPoint = new THREE.Vector3(0, 0, 0);
    const endPoint = new THREE.Vector3(
        archerDirection.x * AIM_LINE_LENGTH,
        0,
        archerDirection.z * AIM_LINE_LENGTH
    );
    
    // Actualizar geometría de la línea
    aimLine.geometry.setFromPoints([startPoint, endPoint]);
    
    // Asegurar que en tercera persona, el modelo del arquero se alinee con la rotación del objeto archer
    if (isThirdPerson && archerModel) {
        archerModel.rotation.y = archer.rotation.y;
    }
}

// Disparar flecha
function shootArrow() {
    if (isGameOver || !canShoot) return;
    
    console.log("Disparando flecha");
    
    // Establecer tiempo de recarga
    canShoot = false;
    setTimeout(() => {
        canShoot = true;
    }, SHOOT_COOLDOWN * 1000);
    
    // Factor de potencia basado en cuánto se tensó el arco
    const powerFactor = 0.5 + bowDrawProgress * 0.5;
    
    // Crear geometría y material de la flecha
    const arrowGeometry = new THREE.CylinderGeometry(ARROW_SIZE / 10, ARROW_SIZE / 10, ARROW_SIZE, 8);
    const arrowMaterial = new THREE.MeshStandardMaterial({ color: 0x8B4513 });
    const arrow = new THREE.Mesh(arrowGeometry, arrowMaterial);
    
    // Añadir punta a la flecha
    const tipGeometry = new THREE.ConeGeometry(ARROW_SIZE / 8, ARROW_SIZE / 4, 8);
    const tipMaterial = new THREE.MeshStandardMaterial({ color: 0x555555 });
    const tip = new THREE.Mesh(tipGeometry, tipMaterial);
    tip.position.y = ARROW_SIZE / 2 + ARROW_SIZE / 8;
    arrow.add(tip);
    
    // Añadir plumas a la flecha
    const featherGeometry = new THREE.BoxGeometry(ARROW_SIZE / 5, ARROW_SIZE / 20, ARROW_SIZE / 5);
    const featherMaterial = new THREE.MeshStandardMaterial({ color: 0xFFFFFF });
    
    const feather1 = new THREE.Mesh(featherGeometry, featherMaterial);
    feather1.position.y = -ARROW_SIZE / 2 + ARROW_SIZE / 10;
    feather1.rotation.x = Math.PI / 4;
    arrow.add(feather1);
    
    const feather2 = new THREE.Mesh(featherGeometry, featherMaterial);
    feather2.position.y = -ARROW_SIZE / 2 + ARROW_SIZE / 10;
    feather2.rotation.x = -Math.PI / 4;
    arrow.add(feather2);
    
    // Posición de disparo desde el arco del personaje
    if (isThirdPerson && archerModel && archerModel.bow) {
        // Obtener posición mundial del arco
        const bowWorldPos = new THREE.Vector3();
        archerModel.bow.getWorldPosition(bowWorldPos);
        arrow.position.copy(bowWorldPos);
    } else {
        // Posición desde primera persona
        arrow.position.copy(equippedBow.position);
    }
    
    // Obtener dirección de disparo
    let direction;
    if (isThirdPerson) {
        // En tercera persona, usar la dirección a la que mira el archer (no el modelo)
        direction = new THREE.Vector3(0, 0, -1).applyQuaternion(archer.quaternion);
        
        // Sincronizar la rotación del modelo con el archer para evitar desajustes
        if (archerModel) {
            archerModel.rotation.y = archer.rotation.y;
        }
    } else {
        // En primera persona, usar la dirección de la cámara
        direction = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    }
    
    // Ajustar la altura para que apunte a la altura de los murciélagos
    // Mantener el componente Y original para permitir apuntar en altura
    const originalY = direction.y;
    direction.y = 0;
    direction.normalize();
    // Restaurar parcialmente el componente Y para permitir alguna elevación
    direction.y = originalY * 0.5;
    direction.normalize();
    
    // Ajustar altura de la flecha para que coincida con la de los murciélagos
    arrow.position.y = BAT_SIZE;
    
    // Rotar la flecha para que apunte en la dirección correcta
    arrow.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
    
    // Añadir la flecha a la escena y al array de flechas
    scene.add(arrow);
    arrows.push({
        mesh: arrow,
        direction: direction.clone().multiplyScalar(powerFactor), // Aplicar factor de potencia
        created: clock.getElapsedTime()
    });
    
    // Emitir evento de disparo al servidor
    if (socket) {
        socket.emit('arrowShot', {
            position: {
                x: arrow.position.x,
                y: arrow.position.y,
                z: arrow.position.z
            },
            direction: {
                x: direction.x,
                y: direction.y,
                z: direction.z
            },
            power: powerFactor
        });
    }
    
    // Reproducir animación de disparo
    if (archerAnimations.shoot) {
        const shootAnim = archerAnimations.shoot;
        
        // Función para animar el disparo con un tiempo específico
        let shootProgress = 0;
        const shootDuration = shootAnim.duration || 0.3;
        
        function animateShoot() {
            shootProgress += 0.05;
            if (shootProgress <= 1) {
                shootAnim.play(0, shootProgress);
                requestAnimationFrame(animateShoot);
            }
        }
        
        // Iniciar animación
        animateShoot();
    }
}

// Función de animación
function animate() {
    requestAnimationFrame(animate);
    
    if (!isGameOver) {
        update();
        
        // Hacer que algunas estrellas parpadeen
        const time = Date.now() * 0.001;
        scene.children.forEach(child => {
            if (child instanceof THREE.Points) {
                const sizes = child.geometry.attributes.size;
                for (let i = 0; i < sizes.count; i++) {
                    // Hacer parpadear aleatoriamente algunas estrellas
                    if (Math.random() > 0.9995) {
                        sizes.array[i] = Math.random() * 2;
                    }
                }
                sizes.needsUpdate = true;
            }
        });
    }
    
    renderer.render(scene, camera);
}

// Función para crear cámara
function createCamera() {
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, THIRD_PERSON_HEIGHT, THIRD_PERSON_DISTANCE); // Empezar en tercera persona
    camera.lookAt(0, 0, 0);
} 