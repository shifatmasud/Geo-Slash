/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { useTheme } from '../../Theme.tsx';
import { GameConfig } from '../../types/index.tsx';
import { motion, AnimatePresence } from 'framer-motion';
import Button from '../Core/Button.tsx';

// --- Types ---

interface GeoSlashGameProps {
    config: GameConfig;
    onScore: (points: number, position: {x: number, y: number}) => void;
    onMiss: () => void;
    onBomb: () => void;
    onRestart: () => void;
}

type MaterialType = 'PLASTIC' | 'GLASS' | 'BOMB_MATTE' | 'BOMB_FUSE' | 'BOMB_CAP' | 'EMISSIVE';

interface GameEntity {
    id: number;
    mesh: THREE.Object3D;
    body: CANNON.Body;
    type: 'TARGET' | 'BOMB' | 'DEBRIS';
    active: boolean;
    fuseTipOffset?: THREE.Vector3;
}

interface Particle {
    position: THREE.Vector3;
    velocity: THREE.Vector3;
    life: number;
    maxLife: number;
    size: number;
    color: THREE.Color;
}

interface TrailNode {
    position: THREE.Vector3;
    life: number;
}

/**
 * ⚔️ GEO-SLASH: ENGINE V7.1 (3D Particles)
 * 
 * Implements:
 * 1. Physics: Cannon.js for rigid body simulation.
 * 2. Visuals: Plastic & Crystal Clear Glass materials.
 * 3. Shatter: Physical debris generation (shards) on slash.
 * 4. Trail: Continuous ribbon trail.
 * 5. Particles: Volumetric sphere particles for explosions and sparks.
 */
const FUSE_TIP_OFFSET = new THREE.Vector3(0.04, 1.1, 0);

const GeoSlashGame: React.FC<GeoSlashGameProps> = ({ config, onScore, onMiss, onBomb, onRestart }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const { theme } = useTheme();
    const [flash, setFlash] = useState<'red' | 'white' | null>(null);

    // --- Engine Refs ---
    const engine = useRef({
        scene: null as THREE.Scene | null,
        camera: null as THREE.PerspectiveCamera | null,
        renderer: null as THREE.WebGLRenderer | null,
        world: null as CANNON.World | null,
        
        entities: [] as GameEntity[],
        particles: [] as Particle[],
        
        // Trail System
        trailNodes: [] as TrailNode[],
        trailMesh: null as THREE.Mesh | null,
        
        // Resources (Pooling)
        geometries: {} as Record<string, THREE.BufferGeometry>,
        materials: {} as Record<string, THREE.Material>,
        
        // Systems
        raycaster: new THREE.Raycaster(),
        mouse: new THREE.Vector2(),
        lastMouse: null as THREE.Vector2 | null,
        
        // State
        lastTime: 0,
        spawnTimer: 0,
        hitStopTimer: 0,
        shakeStrength: 0,
        reqId: 0
    });

    const configRef = useRef(config);
    useEffect(() => { 
        configRef.current = config; 
        if (engine.current.world) {
            engine.current.world.gravity.set(0, config.gravity, 0);
        }
    }, [config]);

    useEffect(() => {
        if (!containerRef.current) return;

        // --- 1. Scene Setup ---
        const width = containerRef.current.clientWidth;
        const height = containerRef.current.clientHeight;

        const scene = new THREE.Scene();
        // Transparent background for "Score behind everything"
        scene.background = null; 

        const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 100);
        camera.position.set(0, 0, 18);
        camera.lookAt(0, 0, 0);

        const renderer = new THREE.WebGLRenderer({ 
            antialias: false, 
            alpha: true, // Enable transparency
            powerPreference: 'high-performance'
        });
        renderer.setSize(width, height);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.0;
        // Make renderer sit above the background text
        renderer.domElement.style.position = 'absolute';
        renderer.domElement.style.top = '0';
        renderer.domElement.style.left = '0';
        renderer.domElement.style.zIndex = '1'; 
        containerRef.current.appendChild(renderer.domElement);

        engine.current.scene = scene;
        engine.current.camera = camera;
        engine.current.renderer = renderer;

        // --- 2. Physics Setup (Cannon.js) ---
        const world = new CANNON.World();
        world.gravity.set(0, configRef.current.gravity, 0);
        const physicsMaterial = new CANNON.Material('physics');
        const physicsContactMaterial = new CANNON.ContactMaterial(physicsMaterial, physicsMaterial, {
            friction: 0.0,
            restitution: 0.3
        });
        world.addContactMaterial(physicsContactMaterial);
        engine.current.world = world;

        // --- 3. Lighting ---
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.8); 
        scene.add(ambientLight);

        const dirLight = new THREE.DirectionalLight(0xfff0dd, 2.5);
        dirLight.position.set(10, 20, 10);
        scene.add(dirLight);

        const hemiLight = new THREE.HemisphereLight(0xddeeff, 0x222222, 0.5);
        scene.add(hemiLight);

        // --- 4. Resources ---
        const geoms = {
            cube: new THREE.BoxGeometry(1, 1, 1),
            // Square based pyramid: Cone with 4 radial segments
            pyramid: new THREE.ConeGeometry(0.8, 1.4, 4, 1), 
            sphere: new THREE.SphereGeometry(0.6, 32, 32),
            // Debris Shards
            shardBox: new THREE.BoxGeometry(0.5, 0.5, 0.5),
            shardTetra: new THREE.TetrahedronGeometry(0.4),
            // BOMB PARTS
            bombBody: new THREE.SphereGeometry(0.65, 32, 32),
            bombCap: new THREE.CylinderGeometry(0.2, 0.25, 0.25, 16),
            bombFuse: new THREE.CylinderGeometry(0.04, 0.04, 0.4, 8),
        };
        geoms.pyramid.rotateX(Math.PI); // Point up naturally
        engine.current.geometries = geoms;

        // --- 5. Particle System ---
        const MAX_PARTICLES = 1000;
        const particleGeo = new THREE.SphereGeometry(0.1, 8, 8); // 3D sphere particles
        const particleMat = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
        });
        const particleMesh = new THREE.InstancedMesh(particleGeo, particleMat, MAX_PARTICLES);
        particleMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        scene.add(particleMesh);

        // --- 6. Trail Mesh ---
        // Using a strip of triangles for a smooth trail
        const TRAIL_LENGTH = 30;
        const trailGeometry = new THREE.BufferGeometry();
        const positions = new Float32Array(TRAIL_LENGTH * 3 * 2); // 2 vertices per segment
        trailGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        const trailMaterial = new THREE.MeshBasicMaterial({
            color: theme.Color.Accent.Content[1],
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.6,
            blending: THREE.AdditiveBlending,
        });
        const trailMesh = new THREE.Mesh(trailGeometry, trailMaterial);
        trailMesh.frustumCulled = false;
        scene.add(trailMesh);
        engine.current.trailMesh = trailMesh;

        // --- Helpers ---

        const getMaterial = (color: string, type: MaterialType): THREE.Material => {
            const key = `${color}_${type}`;
            if (engine.current.materials[key]) return engine.current.materials[key];

            let mat;
            switch (type) {
                case 'GLASS':
                    mat = new THREE.MeshPhysicalMaterial({
                        color: 0xffffff,          // Keep colorless
                        metalness: 0.1,           // Add slight reflection
                        roughness: 0.1,           // Add slight blur/frost
                        transmission: 0.98,       // Near-perfect transparency
                        thickness: 1.5,           // Enhance refraction
                        ior: 1.5,                 // Index of Refraction for glass
                        transparent: true,
                        side: THREE.DoubleSide,
                    });
                    break;
                case 'BOMB_MATTE':
                    mat = new THREE.MeshStandardMaterial({
                        color: 0x222222, // Dark metal
                        roughness: 0.5,  // Less rough
                        metalness: 1.0,  // Fully metallic
                    });
                    break;
                case 'BOMB_CAP':
                     mat = new THREE.MeshStandardMaterial({
                        color: 0xbbbbbb, // A lighter, shinier metal
                        roughness: 0.1,  // Very shiny
                        metalness: 1.0,  // Fully metallic
                    });
                    break;
                case 'BOMB_FUSE':
                     mat = new THREE.MeshStandardMaterial({
                        color: 0x8B4513,
                        roughness: 1.0,
                        metalness: 0.0,
                        emissive: 0xff6600,
                        emissiveIntensity: 2.0,
                    });
                    break;
                case 'EMISSIVE':
                     mat = new THREE.MeshBasicMaterial({ color: color });
                     break;
                case 'PLASTIC':
                default:
                    mat = new THREE.MeshStandardMaterial({
                        color: color,
                        roughness: 0.2,
                        metalness: 0.0,
                    });
                    break;
            }
            engine.current.materials[key] = mat;
            return mat;
        };

        const createBody = (shapeType: 'cube' | 'pyramid' | 'sphere', size: number): CANNON.Body => {
            let shape;
            switch(shapeType) {
                case 'cube':
                    shape = new CANNON.Box(new CANNON.Vec3(size/2, size/2, size/2));
                    break;
                case 'pyramid':
                    // Approximation for pyramid physics
                    shape = new CANNON.Box(new CANNON.Vec3(size/2.5, size/1.5, size/2.5));
                    break;
                case 'sphere':
                default:
                    shape = new CANNON.Sphere(size/2);
                    break;
            }
            const body = new CANNON.Body({
                mass: 1,
                material: physicsMaterial,
                shape: shape
            });
            body.linearDamping = 0.01;
            body.angularDamping = 0.01;
            return body;
        };

        const createBombVisual = () => {
            const group = new THREE.Group();
            const body = new THREE.Mesh(geoms.bombBody, getMaterial('#222222', 'BOMB_MATTE'));
            group.add(body);
            const cap = new THREE.Mesh(geoms.bombCap, getMaterial('#888888', 'BOMB_CAP'));
            cap.position.y = 0.65;
            group.add(cap);
            const fuse = new THREE.Mesh(geoms.bombFuse, getMaterial('#8B4513', 'BOMB_FUSE'));
            fuse.position.y = 0.9;
            fuse.rotation.z = 0.1;
            group.add(fuse);
            return group;
        };

        const spawnEntity = (isDebris = false, debrisProps?: { pos: THREE.Vector3, vel: THREE.Vector3, color: string, isGlass: boolean }) => {
            let mesh: THREE.Object3D;
            let body: CANNON.Body;
            let type: 'TARGET' | 'BOMB' | 'DEBRIS' = 'TARGET';
            let color = '#ffffff';

            if (isDebris && debrisProps) {
                type = 'DEBRIS';
                color = debrisProps.color;
                const shapes = ['shardBox', 'shardTetra'];
                const shapeKey = shapes[Math.floor(Math.random() * shapes.length)];
                // @ts-ignore
                const geometry = geoms[shapeKey];
                const material = getMaterial(color, debrisProps.isGlass ? 'GLASS' : 'PLASTIC');
                mesh = new THREE.Mesh(geometry, material);
                
                const size = 0.5 * (0.5 + Math.random() * 0.5); // Random small size
                mesh.scale.setScalar(size);
                
                // Box approximation for debris physics
                const shape = new CANNON.Box(new CANNON.Vec3(size/2, size/2, size/2));
                body = new CANNON.Body({ mass: 0.5, shape });
                
                body.position.copy(debrisProps.pos as unknown as CANNON.Vec3);
                // Add randomness to spawn position to prevent overlap
                body.position.x += (Math.random() - 0.5) * 0.5;
                body.position.y += (Math.random() - 0.5) * 0.5;
                body.position.z += (Math.random() - 0.5) * 0.5;

                body.velocity.copy(debrisProps.vel as unknown as CANNON.Vec3);
                // Add tumble
                body.angularVelocity.set(Math.random()*10, Math.random()*10, Math.random()*10);

            } else {
                // Spawning Target or Bomb
                const isBomb = Math.random() < 0.15;
                type = isBomb ? 'BOMB' : 'TARGET';
                
                const plasticColors = [
                    theme.Color.Error.Content[1],   // red
                    theme.Color.Success.Content[1], // green
                    theme.Color.Focus.Content[1],   // blue
                    theme.Color.Signal.Content[1],  // purple
                    theme.Color.Warning.Content[1], // orange
                ];
                color = isBomb ? theme.Color.Error.Content[1] : plasticColors[Math.floor(Math.random() * plasticColors.length)];
                
                const isGlass = !isBomb && Math.random() < 0.4;
                const size = configRef.current.objectSize;

                if (isBomb) {
                    mesh = createBombVisual();
                    mesh.scale.setScalar(size);
                    body = createBody('sphere', size * 1.3); // Slightly larger collider for bomb
                } else {
                    const shapes = ['cube', 'pyramid', 'sphere'];
                    const shapeKey = shapes[Math.floor(Math.random() * shapes.length)] as 'cube' | 'pyramid' | 'sphere';
                    const geometry = geoms[shapeKey];
                    const material = getMaterial(color, isGlass ? 'GLASS' : 'PLASTIC');
                    mesh = new THREE.Mesh(geometry, material);
                    mesh.scale.setScalar(size);
                    body = createBody(shapeKey, size);
                }

                // Initial Physics State
                const x = (Math.random() - 0.5) * 10;
                const y = -14; // Start lower
                body.position.set(x, y, 0);

                const targetX = (Math.random() - 0.5) * 6;
                const targetY = 2 + Math.random() * 6;
                const g = Math.abs(configRef.current.gravity);
                
                const vy = Math.sqrt(2 * g * (targetY - y));
                const t = vy / g; 
                const vx = (targetX - x) / t;
                const vz = (Math.random() - 0.5) * 2; 

                body.velocity.set(vx, vy, vz);
                body.angularVelocity.set(Math.random()*5, Math.random()*5, Math.random()*5);
            }

            scene.add(mesh);
            world.addBody(body);

            engine.current.entities.push({
                id: Math.random(),
                mesh,
                body,
                type,
                active: true,
                fuseTipOffset: type === 'BOMB' ? FUSE_TIP_OFFSET : undefined
            });
        };

        const spawnExplosionParticles = (pos: THREE.Vector3) => {
            const explosionColors = [
                new THREE.Color('#FFFFFF'), 
                new THREE.Color('#FFD700'), 
                new THREE.Color('#FFA500'), 
                new THREE.Color('#FF4500')
            ];
            const count = 100;
            for (let i = 0; i < count; i++) {
                const speed = 15 + Math.random() * 15;
                const velocity = new THREE.Vector3(
                    (Math.random() - 0.5),
                    (Math.random() - 0.5),
                    (Math.random() - 0.5)
                ).normalize().multiplyScalar(speed);
                
                const life = 0.5 + Math.random() * 0.5; // Short life

                engine.current.particles.push({
                    position: pos.clone(),
                    velocity: velocity,
                    life: life,
                    maxLife: life,
                    size: 0.3 + Math.random() * 0.4, // Larger particles
                    color: explosionColors[Math.floor(Math.random() * explosionColors.length)]
                });
            }
        };

        const shatterEntity = (entity: GameEntity, hitPoint: THREE.Vector3) => {
            // Remove original
            entity.active = false;
            scene.remove(entity.mesh);
            world.removeBody(entity.body);
            
            const entityPos = new THREE.Vector3(entity.body.position.x, entity.body.position.y, entity.body.position.z);

            if (entity.type === 'BOMB') {
                spawnExplosionParticles(entityPos);
            } else {
                // Determine properties
                let color = '#ffffff';
                let isGlass = false;
                
                if (entity.mesh instanceof THREE.Mesh) {
                    const mat = entity.mesh.material as THREE.MeshStandardMaterial;
                    // @ts-ignore
                    if (mat.color) color = '#' + mat.color.getHexString();
                    isGlass = mat instanceof THREE.MeshPhysicalMaterial;
                }
    
                // Spawn Shards (Debris)
                const shardCount = 4 + Math.floor(Math.random() * 3);
                const originalVel = new THREE.Vector3(entity.body.velocity.x, entity.body.velocity.y, entity.body.velocity.z);
                
                for (let i = 0; i < shardCount; i++) {
                    const spread = 8;
                    const debrisVel = originalVel.clone().add(new THREE.Vector3(
                        (Math.random() - 0.5) * spread,
                        (Math.random() - 0.5) * spread,
                        (Math.random() - 0.5) * spread
                    ));
                    
                    spawnEntity(true, { pos: entityPos, vel: debrisVel, color, isGlass });
                }

                spawnParticles(entityPos, color);
            }
        };

        const spawnParticles = (pos: THREE.Vector3, colorHex: string | number, count: number = 15) => {
            const col = new THREE.Color(colorHex);
            for(let i=0; i<count; i++) {
                engine.current.particles.push({
                    position: pos.clone(),
                    velocity: new THREE.Vector3(
                        (Math.random() - 0.5) * 10,
                        (Math.random() - 0.5) * 10,
                        (Math.random() - 0.5) * 10
                    ),
                    life: 1.0,
                    maxLife: 0.5 + Math.random() * 0.5,
                    size: 0.1 + Math.random() * 0.2,
                    color: col
                });
            }
        };

        // --- Game Loop ---
        const tick = (time: number) => {
            const state = engine.current;
            if (!state.scene || !state.camera || !state.renderer || !state.world) return;

            let dt = Math.min((time - state.lastTime) / 1000, 0.1);
            state.lastTime = time;

            // Physics Step
            if (state.hitStopTimer > 0) {
                state.hitStopTimer -= dt;
                dt *= 0.1; // Slow motion on hit
            }
            state.world.step(1/60, dt, 3);

            // Camera Shake
            if (state.shakeStrength > 0) {
                state.camera.position.x = (Math.random() - 0.5) * state.shakeStrength;
                state.camera.position.y = (Math.random() - 0.5) * state.shakeStrength;
                state.shakeStrength *= 0.9;
                if (state.shakeStrength < 0.01) {
                    state.shakeStrength = 0;
                    state.camera.position.set(0, 0, 18);
                }
            }

            // 1. Spawner
            if (configRef.current.isPlaying && !configRef.current.gameOver) {
                state.spawnTimer += dt * 1000;
                if (state.spawnTimer > configRef.current.spawnRate) {
                    spawnEntity();
                    state.spawnTimer = 0;
                }
            }

            // 2. Entities Sync & Cleanup
            for (let i = state.entities.length - 1; i >= 0; i--) {
                const ent = state.entities[i];
                
                // Sync Visuals
                ent.mesh.position.copy(ent.body.position as unknown as THREE.Vector3);
                ent.mesh.quaternion.copy(ent.body.quaternion as unknown as THREE.Quaternion);

                // Boundary Check
                if (ent.body.position.y < -20) {
                    state.scene.remove(ent.mesh);
                    state.world.removeBody(ent.body);
                    state.entities.splice(i, 1);
                    
                    if (ent.type === 'TARGET' && ent.active && !configRef.current.gameOver && configRef.current.isPlaying) {
                        onMiss();
                    }
                }
            }

            // 2.5 Bomb Fuse Sparks
            const fireColors = [new THREE.Color('#FF2400'), new THREE.Color('#FF4500'), new THREE.Color('#FFA500'), new THREE.Color('#FFD700')];
            const fuseWorldPos = new THREE.Vector3();
            for (const ent of state.entities) {
                if (ent.active && ent.type === 'BOMB' && ent.fuseTipOffset) {
                    // Calculate world position of the fuse tip
                    fuseWorldPos.copy(ent.fuseTipOffset);
                    ent.mesh.localToWorld(fuseWorldPos); // Apply mesh rotation, position and scale
            
                    // Spawn more particles for a more intense flame
                    const spawnCount = 3 + Math.floor(Math.random() * 3);
                    for (let i = 0; i < spawnCount; i++) {
                        const life = 0.4 + Math.random() * 0.4; // longer life for a fuller flame
                        state.particles.push({
                            position: fuseWorldPos.clone(),
                            velocity: new THREE.Vector3(
                                (Math.random() - 0.5) * 0.8,
                                1.5 + Math.random() * 2.0, // more upward velocity
                                (Math.random() - 0.5) * 0.8
                            ),
                            life: life,
                            maxLife: life,
                            size: 0.15 + Math.random() * 0.15, // bigger particles
                            color: fireColors[Math.floor(Math.random() * fireColors.length)]
                        });
                    }
                }
            }

            // 3. Particles
            const dummy = new THREE.Object3D();
            let particleIdx = 0;
            const gravity = configRef.current.gravity;

            for (let i = state.particles.length - 1; i >= 0; i--) {
                const p = state.particles[i];
                p.life -= dt;
                if (p.life <= 0) {
                    state.particles.splice(i, 1);
                    continue;
                }
                
                p.velocity.y += gravity * 0.5 * dt; 
                p.position.add(p.velocity.clone().multiplyScalar(dt));

                dummy.position.copy(p.position);
                const scale = p.size * (p.life / p.maxLife);
                dummy.scale.set(scale, scale, scale);
                dummy.updateMatrix();
                
                particleMesh.setMatrixAt(particleIdx, dummy.matrix);
                particleMesh.setColorAt(particleIdx, p.color);
                particleIdx++;
            }
            particleMesh.count = particleIdx;
            particleMesh.instanceMatrix.needsUpdate = true;
            if (particleMesh.instanceColor) particleMesh.instanceColor.needsUpdate = true;

            // 4. Trail Update
            const trailNodes = state.trailNodes;
             // Age nodes
            for (let i = trailNodes.length - 1; i >= 0; i--) {
                trailNodes[i].life -= dt * 5.0; // Fade speed
                if (trailNodes[i].life <= 0) trailNodes.splice(i, 1);
            }
            // Update Mesh Geometry
            if (state.trailMesh && trailNodes.length > 1) {
                const positions = state.trailMesh.geometry.attributes.position.array as Float32Array;
                let idx = 0;
                for (let i = 0; i < trailNodes.length - 1; i++) {
                    if (idx >= positions.length) break;
                    const curr = trailNodes[i];
                    const next = trailNodes[i+1];
                    // Simple ribbon expansion logic (perpendicular vector)
                    // Simplified: just a thick line approach
                    const w = 0.3 * curr.life;
                    
                    positions[idx++] = curr.position.x;
                    positions[idx++] = curr.position.y - w;
                    positions[idx++] = curr.position.z;

                    positions[idx++] = curr.position.x;
                    positions[idx++] = curr.position.y + w;
                    positions[idx++] = curr.position.z;
                }
                // Zero out remaining
                for (let k = idx; k < positions.length; k++) positions[k] = 0;
                
                state.trailMesh.geometry.attributes.position.needsUpdate = true;
                state.trailMesh.visible = true;
            } else if (state.trailMesh) {
                state.trailMesh.visible = false;
            }

            state.renderer.render(state.scene, state.camera);
            state.reqId = requestAnimationFrame(tick);
        };

        engine.current.reqId = requestAnimationFrame(tick);

        // --- Interaction ---
        const handlePointerMove = (e: MouseEvent | TouchEvent) => {
             const state = engine.current;
             if (!state.camera || !containerRef.current || configRef.current.gameOver) return;

             let cx, cy;
             if (window.TouchEvent && e instanceof TouchEvent) {
                 cx = e.touches[0].clientX;
                 cy = e.touches[0].clientY;
             } else {
                 cx = (e as MouseEvent).clientX;
                 cy = (e as MouseEvent).clientY;
             }

             const rect = containerRef.current.getBoundingClientRect();
             const nx = ((cx - rect.left) / rect.width) * 2 - 1;
             const ny = -((cy - rect.top) / rect.height) * 2 + 1;
             
             // Unproject for 3D Trail
             const vec = new THREE.Vector3(nx, ny, 0.5);
             vec.unproject(state.camera);
             const dir = vec.sub(state.camera.position).normalize();
             const distance = -state.camera.position.z / dir.z; // Intersection with Z=0 plane
             const worldPos = state.camera.position.clone().add(dir.multiplyScalar(distance));

             // Add Trail Node
             state.trailNodes.unshift({ position: worldPos, life: 1.0 });
             if (state.trailNodes.length > 30) state.trailNodes.pop();

             const currentPos = new THREE.Vector2(nx, ny);

             if (!state.lastMouse) {
                 state.lastMouse = currentPos.clone();
                 return;
             }

             // Raycasting
             state.raycaster.setFromCamera(currentPos, state.camera);
             
             // Collect target meshes
             const targets: THREE.Object3D[] = [];
             state.entities.forEach(e => {
                 if (e.active && e.type !== 'DEBRIS') {
                    targets.push(e.mesh instanceof THREE.Group ? e.mesh.children[0] : e.mesh);
                 }
             });

             const hits = state.raycaster.intersectObjects(targets, true); // Recursive true for groups

             if (hits.length > 0) {
                 // Find the parent entity of the hit mesh
                 const hitObj = hits[0].object;
                 const ent = state.entities.find(e => 
                    e.mesh === hitObj || 
                    (e.mesh instanceof THREE.Group && e.mesh.children.includes(hitObj))
                 );

                 if (ent && ent.active) {
                     // HIT
                     if (ent.type === 'BOMB') {
                         onBomb();
                         setFlash('red');
                         setTimeout(() => setFlash(null), 100);
                         state.shakeStrength = 1.2; 
                         shatterEntity(ent, hits[0].point);
                     } else {
                         // Score
                         const p = ent.mesh.position.clone().project(state.camera);
                         const sx = (p.x * 0.5 + 0.5) * rect.width;
                         const sy = (-(p.y * 0.5) + 0.5) * rect.height;
                         
                         let points = 10;
                         // Check material for bonus
                         if (ent.mesh instanceof THREE.Mesh && ent.mesh.material instanceof THREE.MeshPhysicalMaterial) {
                             points = 50; // Glass bonus
                         }
                         onScore(points, {x: sx, y: sy});

                         if (navigator.vibrate) navigator.vibrate(20);
                         state.hitStopTimer = 0.05;
                         state.shakeStrength = 0.1; 
                         
                         shatterEntity(ent, hits[0].point);
                     }
                 }
             }

             state.lastMouse.copy(currentPos);
        };

        const handlePointerLeave = () => {
            const state = engine.current;
            if (!state) return;
            state.trailNodes = [];
            state.lastMouse = null;
        };

        const el = containerRef.current;
        el.addEventListener('mousemove', handlePointerMove);
        el.addEventListener('touchmove', handlePointerMove);
        el.addEventListener('mouseleave', handlePointerLeave);
        el.addEventListener('touchend', handlePointerLeave);

        window.addEventListener('resize', () => {
             if(containerRef.current && engine.current.renderer && engine.current.camera) {
                 const w = containerRef.current.clientWidth;
                 const h = containerRef.current.clientHeight;
                 engine.current.renderer.setSize(w, h);
                 engine.current.camera.aspect = w/h;
                 engine.current.camera.updateProjectionMatrix();
             }
        });

        return () => {
            cancelAnimationFrame(engine.current.reqId);
            el.removeEventListener('mousemove', handlePointerMove);
            el.removeEventListener('touchmove', handlePointerMove);
            el.removeEventListener('mouseleave', handlePointerLeave);
            el.removeEventListener('touchend', handlePointerLeave);
            if (engine.current.renderer) {
                engine.current.renderer.dispose();
                if (containerRef.current) {
                    containerRef.current.removeChild(engine.current.renderer.domElement);
                }
            }
        };
    }, []);

    const formattedScore = String(config.score).padStart(3, '0');

    return (
        <div 
            ref={containerRef} 
            style={{ 
                width: '100%', 
                height: '100%', 
                position: 'relative', 
                overflow: 'hidden', 
                cursor: config.gameOver ? 'default' : 'none',
                backgroundColor: theme.Color.Base.Surface[1]
            }}
        >
            {/* SCORE LAYER - Z-Index 0 (Behind Canvas which is Z-Index 1) */}
            <div style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                zIndex: 0, 
                textAlign: 'center',
                pointerEvents: 'none',
                width: '100%',
            }}>
                 <div
                    style={{ 
                        ...theme.Type.Expressive.Display.L, 
                        fontSize: '30vw', 
                        color: theme.Color.Base.Content[3], // Subtle but fully opaque as requested
                        opacity: 1, 
                        userSelect: 'none'
                    }}
                 >
                    {formattedScore}
                 </div>
            </div>

            {/* Flash Overlay */}
            <AnimatePresence>
                {flash && (
                    <motion.div
                        initial={{ opacity: 0.8 }}
                        animate={{ opacity: 0 }}
                        exit={{ opacity: 0 }}
                        style={{
                            position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                            backgroundColor: flash === 'red' ? theme.Color.Error.Content[1] : 'white',
                            mixBlendMode: 'overlay',
                            pointerEvents: 'none',
                            zIndex: 10
                        }}
                    />
                )}
            </AnimatePresence>

            {/* Lives HUD (Foreground) */}
            <div style={{ 
                position: 'absolute', 
                top: '40px', 
                left: '40px', 
                zIndex: 5,
                display: 'flex', 
                gap: '8px'
            }}>
                {[1,2,3].map(i => (
                    <motion.div 
                        key={i} 
                        animate={{ 
                            scale: i <= config.lives ? 1 : 0.5,
                            backgroundColor: i <= config.lives ? theme.Color.Error.Content[1] : theme.Color.Base.Surface[3],
                            opacity: i <= config.lives ? 1 : 0.2
                        }}
                        style={{ width: '12px', height: '12px', borderRadius: '50%' }}
                    />
                ))}
             </div>

            {/* Game Over */}
            <AnimatePresence>
                {config.gameOver && (
                    <motion.div
                        initial={{ opacity: 0, backdropFilter: 'blur(0px)' }}
                        animate={{ opacity: 1, backdropFilter: 'blur(10px)' }}
                        exit={{ opacity: 0 }}
                        style={{
                            position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                            backgroundColor: 'rgba(0,0,0,0.8)',
                            zIndex: 20
                        }}
                    >
                        <h1 style={{ ...theme.Type.Expressive.Display.L, color: theme.Color.Error.Content[1], marginBottom: '32px' }}>
                            SYSTEM FAILURE
                        </h1>
                        <div style={{ pointerEvents: 'auto' }}>
                             <Button
                                label="RESTART"
                                onClick={onRestart}
                                variant="primary"
                                size="L"
                            />
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default GeoSlashGame;