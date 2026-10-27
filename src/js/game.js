    // ============================================================================
    // 1. CAR CATALOG & CONFIGURATIONS
    // ============================================================================
    const CAR_SPECS = [
      {
        id: 0,
        name: 'Garuda GT-X',
        type: 'Seimbang (All-Rounder)',
        colorHex: 0xef4444,
        accentHex: 0xfef08a,
        badgeBg: 'from-rose-500 to-red-600',
        maxSpeed: 64,         // internal units/sec (~256 KM/J)
        nitroBonus: 20,
        accel: 34,
        handling: 2.55,
        driftChargeRate: 28,
        statsUI: { speed: 84, accel: 85, handling: 88 },
        desc: 'Stabil di tikungan cepat maupun lintasan lurus.'
      },
      {
        id: 1,
        name: 'Halilintar V8',
        type: 'Kecepatan Tinggi (Top Speed)',
        colorHex: 0x0ea5e9,
        accentHex: 0x38bdf8,
        badgeBg: 'from-sky-400 to-blue-600',
        maxSpeed: 70,         // (~280 KM/J)
        nitroBonus: 23,
        accel: 30,
        handling: 2.25,
        driftChargeRate: 25,
        statsUI: { speed: 96, accel: 78, handling: 76 },
        desc: 'Mesin V8 bertenaga besar untuk mendominasi trek lurus.'
      },
      {
        id: 2,
        name: 'Kancil Drift RS',
        type: 'Akselerasi & Drift (Agile)',
        colorHex: 0xf59e0b,
        accentHex: 0xfde047,
        badgeBg: 'from-amber-400 to-orange-500',
        maxSpeed: 61,         // (~244 KM/J)
        nitroBonus: 24,
        accel: 40,
        handling: 2.9,
        driftChargeRate: 38,
        statsUI: { speed: 78, accel: 96, handling: 95 },
        desc: 'Gesit di tikungan tajam & mengisi Nitro ekstra cepat saat Drift.'
      }
    ];

    const AI_DRIVERS = [
      { name: 'Raka (Elang)', colorHex: 0xa855f7, accentHex: 0xe9d5ff, speedFactor: 0.94, laneOffset: -3.2 },
      { name: 'Bima (Badai)', colorHex: 0x10b981, accentHex: 0xa7f3d0, speedFactor: 0.91, laneOffset: 3.2 },
      { name: 'Sinta (Kilat)', colorHex: 0xec4899, accentHex: 0xfbcfe8, speedFactor: 0.88, laneOffset: -1.2 }
    ];

    // ============================================================================
    // 2. WEB AUDIO SYNTHESIZER (Continuous Engine, Drift Screech, Nitro & Beeps)
    // ============================================================================
    let audioEnabled = true;
    let audioCtx = null;
    let engineOsc = null;
    let engineGain = null;
    let noiseNode = null;
    let driftGain = null;

    function initAudioEngine() {
      if (audioCtx) return;
      try {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        audioCtx = new AudioContextClass();

        // Engine Sawtooth Oscillator
        engineOsc = audioCtx.createOscillator();
        engineGain = audioCtx.createGain();
        engineOsc.type = 'sawtooth';
        engineOsc.frequency.value = 55;
        engineGain.gain.value = 0.0;

        // Lowpass filter for warm muffled sports car exhaust
        const filter = audioCtx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 280;

        engineOsc.connect(filter);
        filter.connect(engineGain);
        engineGain.connect(audioCtx.destination);
        engineOsc.start();

        // White Noise buffer for Drift Tire Screech / Nitro Whoosh
        const bufferSize = audioCtx.sampleRate * 2;
        const noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
        const output = noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          output[i] = Math.random() * 2 - 1;
        }
        noiseNode = audioCtx.createBufferSource();
        noiseNode.buffer = noiseBuffer;
        noiseNode.loop = true;

        const bandpass = audioCtx.createBiquadFilter();
        bandpass.type = 'bandpass';
        bandpass.frequency.value = 1100;
        bandpass.Q.value = 2.5;

        driftGain = audioCtx.createGain();
        driftGain.gain.value = 0.0;

        noiseNode.connect(bandpass);
        bandpass.connect(driftGain);
        driftGain.connect(audioCtx.destination);
        noiseNode.start();
      } catch (e) {
        console.warn('Web Audio API tidak diizinkan:', e);
      }
    }

    function updateEngineSound(speedRatio, isDrifting, isNitro, activeRacing) {
      if (!audioCtx || !engineGain) return;
      if (!audioEnabled || !activeRacing) {
        engineGain.gain.setTargetAtTime(0.0, audioCtx.currentTime, 0.08);
        driftGain.gain.setTargetAtTime(0.0, audioCtx.currentTime, 0.08);
        return;
      }
      if (audioCtx.state === 'suspended') audioCtx.resume();

      // Simulate gear shifts in frequency
      const gearMod = (speedRatio * 4) % 1;
      const baseFreq = 48 + speedRatio * 115 + gearMod * 38 + (isNitro ? 35 : 0);
      engineOsc.frequency.setTargetAtTime(baseFreq, audioCtx.currentTime, 0.05);
      engineGain.gain.setTargetAtTime(0.045 + speedRatio * 0.04, audioCtx.currentTime, 0.05);

      const targetNoise = (isDrifting && speedRatio > 0.25) ? 0.05 : (isNitro ? 0.04 : 0.0);
      driftGain.gain.setTargetAtTime(targetNoise, audioCtx.currentTime, 0.06);
    }

    function playSFX(type) {
      if (!audioEnabled) return;
      initAudioEngine();
      if (!audioCtx) return;
      if (audioCtx.state === 'suspended') audioCtx.resume();

      const now = audioCtx.currentTime;
      const osc = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      osc.connect(g);
      g.connect(audioCtx.destination);

      if (type === 'beep') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, now);
        g.gain.setValueAtTime(0.15, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
        osc.start(now);
        osc.stop(now + 0.23);
      } else if (type === 'go') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(880, now);
        g.gain.setValueAtTime(0.22, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
        osc.start(now);
        osc.stop(now + 0.46);
      } else if (type === 'lap') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(587.33, now);
        osc.frequency.setValueAtTime(880, now + 0.1);
        g.gain.setValueAtTime(0.18, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
        osc.start(now);
        osc.stop(now + 0.36);
      } else if (type === 'win') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(523.25, now);
        osc.frequency.setValueAtTime(659.25, now + 0.12);
        osc.frequency.setValueAtTime(783.99, now + 0.24);
        osc.frequency.setValueAtTime(1046.5, now + 0.36);
        g.gain.setValueAtTime(0.22, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.75);
        osc.start(now);
        osc.stop(now + 0.76);
      }
    }

    function toggleAudio() {
      audioEnabled = !audioEnabled;
      document.getElementById('hud-sound-icon').textContent = audioEnabled ? '🔊' : '🔇';
      if (audioEnabled) playSFX('beep');
    }

    // ============================================================================
    // 3. GAME STATE & INPUT CONTROLLER
    // ============================================================================
    const TOTAL_LAPS = 3;
    const TRACK_SAMPLES = 400;
    const ROAD_HALF_WIDTH = 9.5; // Total road width = 19 units
    const IS_MOBILE = window.matchMedia('(pointer: coarse)').matches || window.innerWidth <= 900;

    let orientationHintDismissed = false;

    const gameState = {
      selectedCarIdx: 0,
      isNight: true,
      cameraMode: 0, // 0: Chase Cam, 1: Dekat/Bumper, 2: Top-Down Isometric
      cameraModeNames: ['Chase Cam', 'Kamera Dekat', 'Isometrik Atas'],
      phase: 'garage', // 'garage' | 'countdown' | 'racing' | 'finished'
      raceTime: 0,
      lapStartTime: 0,
      bestLapTime: Infinity,
      topSpeedKmh: 0,
      racers: [] // [playerRacer, ai1, ai2, ai3]
    };

    const inputState = {
      gas: false,
      brake: false,
      left: false,
      right: false,
      drift: false,
      nitro: false
    };

    function resetInputState() {
      Object.keys(inputState).forEach(key => { inputState[key] = false; });
      document.querySelectorAll('.touch-btn').forEach(btn => {
        if (typeof btn._releaseControl === 'function') btn._releaseControl();
        btn.classList.remove('active');
      });
    }

    function getViewportSize() {
      const viewport = window.visualViewport;
      return {
        width: Math.round(viewport ? viewport.width : window.innerWidth),
        height: Math.round(viewport ? viewport.height : window.innerHeight)
      };
    }

    function syncViewport() {
      const { width, height } = getViewportSize();
      document.documentElement.style.setProperty('--app-height', `${height}px`);

      if (typeof renderer !== 'undefined' && renderer && typeof camera !== 'undefined' && camera) {
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height, false);
      }

      updateOrientationHint();
    }

    function updateOrientationHint() {
      const hint = document.getElementById('orientation-hint');
      if (!hint) return;

      const { width, height } = getViewportSize();
      const raceIsActive = gameState.phase === 'countdown' || gameState.phase === 'racing';
      const shouldShow = IS_MOBILE && raceIsActive && height > width && !orientationHintDismissed;
      hint.classList.toggle('hidden', !shouldShow);
    }

    function dismissOrientationHint() {
      orientationHintDismissed = true;
      updateOrientationHint();
    }

    function requestMobileExperience() {
      if (!IS_MOBILE) return;

      const lockLandscape = () => {
        if (screen.orientation && screen.orientation.lock) {
          screen.orientation.lock('landscape').catch(() => {});
        }
      };

      const root = document.documentElement;
      if (!document.fullscreenElement && root.requestFullscreen) {
        root.requestFullscreen({ navigationUI: 'hide' })
          .then(lockLandscape)
          .catch(lockLandscape);
      } else {
        lockLandscape();
      }
    }

    // Setup keyboard and robust multi-touch controls.
    function setupInputs() {
      window.addEventListener('keydown', (e) => {
        const code = e.code;
        if (code === 'KeyW' || code === 'ArrowUp') inputState.gas = true;
        if (code === 'KeyS' || code === 'ArrowDown') inputState.brake = true;
        if (code === 'KeyA' || code === 'ArrowLeft') inputState.left = true;
        if (code === 'KeyD' || code === 'ArrowRight') inputState.right = true;
        if (code === 'Space') {
          inputState.drift = true;
          if (gameState.phase === 'racing') e.preventDefault();
        }
        if (code === 'ShiftLeft' || code === 'ShiftRight') inputState.nitro = true;
        if (code === 'KeyC') cycleCameraMode();
      });

      window.addEventListener('keyup', (e) => {
        const code = e.code;
        if (code === 'KeyW' || code === 'ArrowUp') inputState.gas = false;
        if (code === 'KeyS' || code === 'ArrowDown') inputState.brake = false;
        if (code === 'KeyA' || code === 'ArrowLeft') inputState.left = false;
        if (code === 'KeyD' || code === 'ArrowRight') inputState.right = false;
        if (code === 'Space') inputState.drift = false;
        if (code === 'ShiftLeft' || code === 'ShiftRight') inputState.nitro = false;
      });

      const bindHoldButton = (btnId, keyName, extraKey = null) => {
        const btn = document.getElementById(btnId);
        if (!btn) return;

        let activePointerId = null;
        const release = () => {
          inputState[keyName] = false;
          if (extraKey) inputState[extraKey] = false;
          btn.classList.remove('active');
          activePointerId = null;
        };
        btn._releaseControl = release;

        const activate = (ev) => {
          ev.preventDefault();
          if (activePointerId !== null) return;
          activePointerId = ev.pointerId;
          if (btn.setPointerCapture) btn.setPointerCapture(ev.pointerId);
          inputState[keyName] = true;
          if (extraKey) inputState[extraKey] = true;
          btn.classList.add('active');
          if (navigator.vibrate) navigator.vibrate(10);
        };
        const deactivate = (ev) => {
          if (activePointerId !== null && ev.pointerId !== activePointerId) return;
          ev.preventDefault();
          release();
        };

        btn.addEventListener('pointerdown', activate);
        btn.addEventListener('pointerup', deactivate);
        btn.addEventListener('pointercancel', deactivate);
        btn.addEventListener('lostpointercapture', deactivate);
        btn.addEventListener('contextmenu', e => e.preventDefault());
      };

      bindHoldButton('btn-touch-left', 'left');
      bindHoldButton('btn-touch-right', 'right');
      bindHoldButton('btn-touch-gas', 'gas');
      bindHoldButton('btn-touch-brake', 'drift', 'brake');
      bindHoldButton('btn-touch-nitro', 'nitro');

      window.addEventListener('blur', resetInputState);
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) resetInputState();
      });
      window.addEventListener('resize', syncViewport, { passive: true });
      window.addEventListener('orientationchange', () => setTimeout(syncViewport, 150), { passive: true });
      if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', syncViewport, { passive: true });
      }
    }

    // ============================================================================
    // 4. THREE.JS SCENE, CIRCUIT & LOW-POLY WORLD GENERATION
    // ============================================================================
    let scene, camera, renderer;
    let ambientLight, sunLight, groundMesh;
    let trackCurve = null;
    let trackSamples = []; // Pre-sampled { pt, tangent, normal, t }
    const streetLightObjects = [];
    const particlePool = [];

    function initThreeWorld() {
      const container = document.getElementById('canvas-container');
      const { width, height } = getViewportSize();
      scene = new THREE.Scene();

      camera = new THREE.PerspectiveCamera(58, width / height, 0.5, 900);
      camera.position.set(0, 18, -35);

      renderer = new THREE.WebGLRenderer({
        antialias: !IS_MOBILE,
        powerPreference: 'high-performance'
      });
      renderer.setSize(width, height, false);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, IS_MOBILE ? 1.25 : 2));
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = IS_MOBILE ? THREE.BasicShadowMap : THREE.PCFSoftShadowMap;
      container.appendChild(renderer.domElement);

      // Lighting
      ambientLight = new THREE.AmbientLight(0x334155, 0.85);
      scene.add(ambientLight);

      sunLight = new THREE.DirectionalLight(0x93c5fd, 0.9);
      sunLight.position.set(120, 180, 90);
      sunLight.castShadow = true;
      const shadowMapSize = IS_MOBILE ? 1024 : 2048;
      sunLight.shadow.mapSize.width = shadowMapSize;
      sunLight.shadow.mapSize.height = shadowMapSize;
      const d = 240;
      sunLight.shadow.camera.left = -d;
      sunLight.shadow.camera.right = d;
      sunLight.shadow.camera.top = d;
      sunLight.shadow.camera.bottom = -d;
      sunLight.shadow.camera.near = 10;
      sunLight.shadow.camera.far = 500;
      scene.add(sunLight);

      // Ground Grass Plane
      const groundGeo = new THREE.PlaneGeometry(1400, 1400);
      groundGeo.rotateX(-Math.PI / 2);
      const groundMat = new THREE.MeshStandardMaterial({ color: 0x162e26, roughness: 0.95 });
      groundMesh = new THREE.Mesh(groundGeo, groundMat);
      groundMesh.receiveShadow = true;
      scene.add(groundMesh);

      buildRacingCircuit();
      buildStartFinishGantry();
      buildEnvironmentProps();
      applyDayNightVisuals();
      syncViewport();
    }

    function buildRacingCircuit() {
      // Closed Grand Prix Circuit control points (clockwise loop)
      const controlPts = [
        new THREE.Vector3(0, 0, 0),         // Start/Finish Straight
        new THREE.Vector3(0, 0, 110),       // End of main straight
        new THREE.Vector3(45, 0, 175),      // Turn 1 Sweeper
        new THREE.Vector3(135, 0, 190),     // North Straight
        new THREE.Vector3(210, 0, 145),     // Turn 2 Hairpin entry
        new THREE.Vector3(225, 0, 65),      // Turn 3 Chicane
        new THREE.Vector3(165, 0, 15),      // Infield S-Curve 1
        new THREE.Vector3(155, 0, -55),     // Infield S-Curve 2
        new THREE.Vector3(215, 0, -125),    // East Fast Bend
        new THREE.Vector3(170, 0, -195),    // South-East Hairpin
        new THREE.Vector3(65, 0, -185),     // South Straight
        new THREE.Vector3(-15, 0, -130),    // Final Corner Entry
        new THREE.Vector3(-5, 0, -65)       // Final Straight alignment
      ];

      trackCurve = new THREE.CatmullRomCurve3(controlPts, true, 'catmullrom', 0.5);

      // Sample points for fast physics projection & rendering
      trackSamples = [];
      for (let i = 0; i < TRACK_SAMPLES; i++) {
        const t = i / TRACK_SAMPLES;
        const pt = trackCurve.getPointAt(t);
        const tangent = trackCurve.getTangentAt(t).normalize();
        const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
        trackSamples.push({ pt, tangent, normal, t, index: i });
      }

      // Build continuous Road Ribbon Mesh, Red-White Curbs, and Center Dashed Lines
      const roadPositions = [];
      const roadNormals = [];
      const roadIndices = [];

      const curbWidth = 1.6;
      const curbPositions = [];
      const curbColors = [];
      const curbIndices = [];

      for (let i = 0; i <= TRACK_SAMPLES; i++) {
        const sample = trackSamples[i % TRACK_SAMPLES];
        const leftEdge = sample.pt.clone().addScaledVector(sample.normal, -ROAD_HALF_WIDTH);
        const rightEdge = sample.pt.clone().addScaledVector(sample.normal, ROAD_HALF_WIDTH);

        roadPositions.push(leftEdge.x, 0.06, leftEdge.z);
        roadPositions.push(rightEdge.x, 0.06, rightEdge.z);
        roadNormals.push(0, 1, 0, 0, 1, 0);

        if (i < TRACK_SAMPLES) {
          const base = i * 2;
          roadIndices.push(base, base + 1, base + 2);
          roadIndices.push(base + 1, base + 3, base + 2);

          // Build Left & Right Red/White Curbs per segment
          const nextSample = trackSamples[(i + 1) % TRACK_SAMPLES];
          const isRed = i % 2 === 0;
          const col = isRed ? new THREE.Color(0xef4444) : new THREE.Color(0xf8fafc);

          [-1, 1].forEach(side => {
            const inner1 = sample.pt.clone().addScaledVector(sample.normal, side * ROAD_HALF_WIDTH);
            const outer1 = sample.pt.clone().addScaledVector(sample.normal, side * (ROAD_HALF_WIDTH + curbWidth));
            const inner2 = nextSample.pt.clone().addScaledVector(nextSample.normal, side * ROAD_HALF_WIDTH);
            const outer2 = nextSample.pt.clone().addScaledVector(nextSample.normal, side * (ROAD_HALF_WIDTH + curbWidth));

            const cBase = curbPositions.length / 3;
            curbPositions.push(
              inner1.x, 0.12, inner1.z,
              outer1.x, 0.15, outer1.z,
              inner2.x, 0.12, inner2.z,
              outer2.x, 0.15, outer2.z
            );
            for (let k = 0; k < 4; k++) {
              curbColors.push(col.r, col.g, col.b);
            }
            curbIndices.push(cBase, cBase + 1, cBase + 2, cBase + 1, cBase + 3, cBase + 2);
          });

          // Dashed center line every 3rd segment
          if (i % 3 === 0 && i > 4 && i < TRACK_SAMPLES - 4) {
            const mid = sample.pt.clone().lerp(nextSample.pt, 0.5);
            const angle = Math.atan2(sample.tangent.x, sample.tangent.z);
            const dashGeo = new THREE.PlaneGeometry(0.35, 3.2);
            dashGeo.rotateX(-Math.PI / 2);
            const dashMesh = new THREE.Mesh(dashGeo, new THREE.MeshBasicMaterial({ color: 0x94a3b8 }));
            dashMesh.position.set(mid.x, 0.09, mid.z);
            dashMesh.rotation.y = angle;
            scene.add(dashMesh);
          }
        }
      }

      const roadGeo = new THREE.BufferGeometry();
      roadGeo.setAttribute('position', new THREE.Float32BufferAttribute(roadPositions, 3));
      roadGeo.setAttribute('normal', new THREE.Float32BufferAttribute(roadNormals, 3));
      roadGeo.setIndex(roadIndices);
      const roadMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.85, side: THREE.DoubleSide });
      const roadMesh = new THREE.Mesh(roadGeo, roadMat);
      roadMesh.receiveShadow = true;
      scene.add(roadMesh);

      const curbGeo = new THREE.BufferGeometry();
      curbGeo.setAttribute('position', new THREE.Float32BufferAttribute(curbPositions, 3));
      curbGeo.setAttribute('color', new THREE.Float32BufferAttribute(curbColors, 3));
      curbGeo.setIndex(curbIndices);
      curbGeo.computeVertexNormals();
      const curbMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, side: THREE.DoubleSide });
      const curbMesh = new THREE.Mesh(curbGeo, curbMat);
      curbMesh.receiveShadow = true;
      scene.add(curbMesh);
    }

    function buildStartFinishGantry() {
      const s0 = trackSamples[0];
      const gantryGroup = new THREE.Group();
      gantryGroup.position.copy(s0.pt);
      gantryGroup.rotation.y = Math.atan2(s0.tangent.x, s0.tangent.z);

      // Checkered Start/Finish Line on Asphalt
      const tiles = 16;
      const tileW = (ROAD_HALF_WIDTH * 2) / tiles;
      for (let r = 0; r < 2; r++) {
        for (let c = 0; c < tiles; c++) {
          const isWhite = (r + c) % 2 === 0;
          const tile = new THREE.Mesh(
            new THREE.PlaneGeometry(tileW, 1.2),
            new THREE.MeshBasicMaterial({ color: isWhite ? 0xffffff : 0x0f172a })
          );
          tile.rotation.x = -Math.PI / 2;
          tile.position.set(-ROAD_HALF_WIDTH + tileW * (c + 0.5), 0.09, (r - 0.5) * 1.2);
          gantryGroup.add(tile);
        }
      }

      // Left & Right Gantry Towers
      const pillarMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.4 });
      const accentMat = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.4 });
      [-ROAD_HALF_WIDTH - 1.8, ROAD_HALF_WIDTH + 1.8].forEach(px => {
        const pillar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 9.5, 1.2), pillarMat);
        pillar.position.set(px, 4.75, 0);
        pillar.castShadow = true;
        gantryGroup.add(pillar);

        const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.3, 2.0, 1.3), accentMat);
        stripe.position.set(px, 7.5, 0);
        gantryGroup.add(stripe);
      });

      // Overhead Banner Bridge
      const bridge = new THREE.Mesh(
        new THREE.BoxGeometry(ROAD_HALF_WIDTH * 2 + 5.2, 2.2, 1.6),
        new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.3 })
      );
      bridge.position.set(0, 9.2, 0);
      bridge.castShadow = true;
      gantryGroup.add(bridge);

      // Glowing Banner Strip
      const neonStrip = new THREE.Mesh(
        new THREE.BoxGeometry(ROAD_HALF_WIDTH * 2 + 2, 0.45, 1.72),
        new THREE.MeshBasicMaterial({ color: 0xf59e0b })
      );
      neonStrip.position.set(0, 9.2, 0);
      gantryGroup.add(neonStrip);

      // 5 Starting Lights Boxes
      for (let i = -2; i <= 2; i++) {
        const lightBox = new THREE.Mesh(
          new THREE.CylinderGeometry(0.35, 0.35, 0.2, 12),
          new THREE.MeshBasicMaterial({ color: 0xef4444 })
        );
        lightBox.rotation.x = Math.PI / 2;
        lightBox.position.set(i * 1.6, 7.8, -0.85);
        gantryGroup.add(lightBox);
      }

      scene.add(gantryGroup);
    }

    function createLowPolyTree(x, z, type = 0) {
      const group = new THREE.Group();
      group.position.set(x, 0, z);
      const scale = 0.85 + Math.random() * 0.55;

      const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.35, 0.55, 2.6, 6),
        new THREE.MeshStandardMaterial({ color: 0x5c4033, flatShading: true })
      );
      trunk.position.y = 1.3;
      trunk.castShadow = true;
      group.add(trunk);

      if (type === 0) {
        // Pine / Cypress style
        const colors = [0x15803d, 0x166534, 0x14532d];
        for (let i = 0; i < 3; i++) {
          const cone = new THREE.Mesh(
            new THREE.ConeGeometry(2.4 - i * 0.5, 3.2 - i * 0.4, 7),
            new THREE.MeshStandardMaterial({ color: colors[i], flatShading: true })
          );
          cone.position.y = 3.0 + i * 1.7;
          cone.castShadow = true;
          group.add(cone);
        }
      } else {
        // Round Deciduous Low-Poly Tree
        const crown = new THREE.Mesh(
          new THREE.DodecahedronGeometry(2.4, 0),
          new THREE.MeshStandardMaterial({ color: 0x22c55e, flatShading: true })
        );
        crown.position.y = 4.2;
        crown.castShadow = true;
        group.add(crown);
      }

      group.scale.setScalar(scale);
      scene.add(group);
    }

    function createGrandstand(sampleIdx, side, colorHex) {
      const s = trackSamples[sampleIdx % TRACK_SAMPLES];
      const standGroup = new THREE.Group();
      const offsetDist = ROAD_HALF_WIDTH + 14;
      const pos = s.pt.clone().addScaledVector(s.normal, side * offsetDist);
      standGroup.position.copy(pos);

      // Face towards the road
      const lookTarget = s.pt.clone();
      standGroup.lookAt(lookTarget);

      // Tiered steps
      const stepMat = new THREE.MeshStandardMaterial({ color: 0x334155, flatShading: true });
      for (let tier = 0; tier < 4; tier++) {
        const bench = new THREE.Mesh(new THREE.BoxGeometry(26, 1.2, 2.2), stepMat);
        bench.position.set(0, 0.6 + tier * 1.2, -tier * 2.0);
        bench.castShadow = true;
        bench.receiveShadow = true;
        standGroup.add(bench);

        // Colorful low-poly spectator blocks
        for (let p = -10; p <= 10; p += 2.5) {
          if (Math.random() > 0.25) {
            const specColor = [0xfef08a, 0x38bdf8, 0xf43f5e, 0x4ade80, 0xffffff][Math.floor(Math.random() * 5)];
            const person = new THREE.Mesh(
              new THREE.BoxGeometry(0.6, 0.8, 0.6),
              new THREE.MeshBasicMaterial({ color: specColor })
            );
            person.position.set(p + (Math.random() - 0.5) * 0.5, 1.5 + tier * 1.2, -tier * 2.0);
            standGroup.add(person);
          }
        }
      }

      // Canopy Roof
      const roof = new THREE.Mesh(
        new THREE.BoxGeometry(28, 0.5, 11),
        new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.5 })
      );
      roof.position.set(0, 7.2, -3.5);
      roof.rotation.x = 0.15;
      roof.castShadow = true;
      standGroup.add(roof);

      scene.add(standGroup);
    }

    function createTrackStreetlight(sample, side) {
      const lampGroup = new THREE.Group();
      const pos = sample.pt.clone().addScaledVector(sample.normal, side * (ROAD_HALF_WIDTH + 2.8));
      lampGroup.position.copy(pos);
      lampGroup.lookAt(sample.pt);

      const poleMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.4, roughness: 0.5 });
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.24, 7.5, 6), poleMat);
      pole.position.y = 3.75;
      lampGroup.add(pole);

      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.25, 2.6), poleMat);
      arm.position.set(0, 7.4, 1.1);
      lampGroup.add(arm);

      const bulb = new THREE.Mesh(
        new THREE.BoxGeometry(0.6, 0.18, 0.9),
        new THREE.MeshBasicMaterial({ color: 0xfef08a })
      );
      bulb.position.set(0, 7.28, 2.1);
      lampGroup.add(bulb);

      // Ground Glow Circle (visible at night)
      const glowGeo = new THREE.CircleGeometry(6.5, 16);
      glowGeo.rotateX(-Math.PI / 2);
      const glowMat = new THREE.MeshBasicMaterial({
        color: 0xfde047,
        transparent: true,
        opacity: 0.16,
        depthWrite: false
      });
      const glowMesh = new THREE.Mesh(glowGeo, glowMat);
      glowMesh.position.set(0, 0.08, 3.2);
      lampGroup.add(glowMesh);

      streetLightObjects.push({ bulb, glowMesh });
      scene.add(lampGroup);
    }

    function buildEnvironmentProps() {
      // 1. Place Streetlights along the circuit
      for (let i = 0; i < TRACK_SAMPLES; i += 14) {
        const side = (i % 28 === 0) ? -1 : 1;
        createTrackStreetlight(trackSamples[i], side);
      }

      // 2. Place Grandstands near main straight and key corners
      createGrandstand(12, -1, 0xef4444);
      createGrandstand(26, 1, 0x0ea5e9);
      createGrandstand(145, -1, 0xf59e0b);
      createGrandstand(290, 1, 0x10b981);
      createGrandstand(382, -1, 0x8b5cf6);

      // 3. Place Pit Building & Control Tower along main straight
      const pitSample = trackSamples[390];
      const pitBuilding = new THREE.Group();
      pitBuilding.position.copy(pitSample.pt).addScaledVector(pitSample.normal, ROAD_HALF_WIDTH + 13);
      pitBuilding.rotation.y = Math.atan2(pitSample.tangent.x, pitSample.tangent.z);

      const bldgBody = new THREE.Mesh(
        new THREE.BoxGeometry(9, 10, 38),
        new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.6 })
      );
      bldgBody.position.y = 5;
      bldgBody.castShadow = true;
      pitBuilding.add(bldgBody);

      // Glowing windows on Pit Building
      const winStrip = new THREE.Mesh(
        new THREE.BoxGeometry(9.2, 2.2, 34),
        new THREE.MeshBasicMaterial({ color: 0x38bdf8 })
      );
      winStrip.position.y = 7.2;
      pitBuilding.add(winStrip);
      scene.add(pitBuilding);

      // 4. Scatter Low-Poly Trees & Hills safely away from the asphalt road.
      // Mobile devices use fewer meshes to reduce GPU and memory pressure.
      const treeCount = IS_MOBILE ? 85 : 170;
      for (let t = 0; t < treeCount; t++) {
        const sample = trackSamples[Math.floor(Math.random() * TRACK_SAMPLES)];
        const side = Math.random() > 0.5 ? 1 : -1;
        const dist = ROAD_HALF_WIDTH + 18 + Math.random() * 75;
        const candidate = sample.pt.clone().addScaledVector(sample.normal, side * dist);

        // Verify candidate is not too close to any other part of the track
        let tooClose = false;
        for (let k = 0; k < TRACK_SAMPLES; k += 8) {
          if (candidate.distanceToSquared(trackSamples[k].pt) < (ROAD_HALF_WIDTH + 8) ** 2) {
            tooClose = true;
            break;
          }
        }
        if (!tooClose) {
          createLowPolyTree(candidate.x, candidate.z, t % 2);
        }
      }

      // 5. Distant Low-Poly Mountains Ring
      const mountainCount = IS_MOBILE ? 14 : 24;
      for (let m = 0; m < mountainCount; m++) {
        const ang = (m / mountainCount) * Math.PI * 2;
        const rad = 360 + Math.random() * 80;
        const mx = Math.cos(ang) * rad + 80;
        const mz = Math.sin(ang) * rad;
        const mh = 45 + Math.random() * 55;
        const mGeo = new THREE.ConeGeometry(45 + Math.random() * 25, mh, 6);
        const mMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, flatShading: true, roughness: 0.9 });
        const mountain = new THREE.Mesh(mGeo, mMat);
        mountain.position.set(mx, mh / 2 - 2, mz);
        scene.add(mountain);
      }
    }

    function applyDayNightVisuals() {
      const isNight = gameState.isNight;
      if (isNight) {
        scene.background = new THREE.Color(0x070b14);
        scene.fog = new THREE.FogExp2(0x070b14, 0.0022);
        ambientLight.color.setHex(0x3b4d71);
        ambientLight.intensity = 0.72;
        sunLight.color.setHex(0x60a5fa);
        sunLight.intensity = 0.65;
        groundMesh.material.color.setHex(0x0f221d);
      } else {
        scene.background = new THREE.Color(0x38bdf8);
        scene.fog = new THREE.FogExp2(0x7dd3fc, 0.0015);
        ambientLight.color.setHex(0xffffff);
        ambientLight.intensity = 0.95;
        sunLight.color.setHex(0xfffbeb);
        sunLight.intensity = 1.35;
        groundMesh.material.color.setHex(0x1f4d36);
      }

      streetLightObjects.forEach(obj => {
        obj.glowMesh.visible = isNight;
        obj.bulb.material.color.setHex(isNight ? 0xfef08a : 0x94a3b8);
      });

      // Toggle car headlight cones
      gameState.racers.forEach(r => {
        if (r.headlightCones) {
          r.headlightCones.visible = isNight;
        }
      });

      // Update UI badges
      document.getElementById('hud-time-icon').textContent = isNight ? '🌙' : '☀️';
      document.getElementById('hud-time-label').textContent = isNight ? 'Malam' : 'Siang';

      const btnDay = document.getElementById('btn-garage-day');
      const btnNight = document.getElementById('btn-garage-night');
      if (btnDay && btnNight) {
        btnDay.className = !isNight
          ? 'px-3.5 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 bg-amber-400 text-slate-950 shadow'
          : 'px-3.5 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 text-slate-300 hover:text-white';
        btnNight.className = isNight
          ? 'px-3.5 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 bg-cyan-400 text-slate-950 shadow'
          : 'px-3.5 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 text-slate-300 hover:text-white';
      }
    }

    function toggleDayNight() {
      gameState.isNight = !gameState.isNight;
      applyDayNightVisuals();
      playSFX('beep');
    }

    function setTimeOfDay(nightBool) {
      gameState.isNight = nightBool;
      applyDayNightVisuals();
      playSFX('beep');
    }

    function cycleCameraMode() {
      gameState.cameraMode = (gameState.cameraMode + 1) % 3;
      document.getElementById('hud-cam-label').textContent = gameState.cameraModeNames[gameState.cameraMode];
      playSFX('beep');
    }

    // ============================================================================
    // 5. 3D LOW-POLY SPORTS CAR BUILDER & PARTICLE SYSTEM
    // ============================================================================
    function createSportsCarMesh(bodyHex, accentHex, isPlayer = false) {
      const root = new THREE.Group();
      const visualBody = new THREE.Group(); // Allows drift slip yaw & roll tilt
      root.add(visualBody);

      const bodyMat = new THREE.MeshStandardMaterial({ color: bodyHex, roughness: 0.3, metalness: 0.25, flatShading: true });
      const accentMat = new THREE.MeshStandardMaterial({ color: accentHex, roughness: 0.35 });
      const darkMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.5 });

      // Lower Aerodynamic Chassis
      const lowerChassis = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.55, 4.4), bodyMat);
      lowerChassis.position.y = 0.55;
      lowerChassis.castShadow = true;
      lowerChassis.receiveShadow = true;
      visualBody.add(lowerChassis);

      // Racing Center Stripe / Side Skirts
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.57, 4.42), accentMat);
      stripe.position.y = 0.55;
      visualBody.add(stripe);

      // Sloped Cabin Canopy
      const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.65, 0.52, 2.1), darkMat);
      cabin.position.set(0, 1.05, -0.2);
      cabin.castShadow = true;
      visualBody.add(cabin);

      // Rear Racing Spoiler Wing
      const wingBlade = new THREE.Mesh(new THREE.BoxGeometry(2.15, 0.12, 0.55), accentMat);
      wingBlade.position.set(0, 1.28, -2.0);
      visualBody.add(wingBlade);
      [-0.75, 0.75].forEach(wx => {
        const strut = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.45, 0.3), darkMat);
        strut.position.set(wx, 1.02, -1.95);
        visualBody.add(strut);
      });

      // Front Headlights + Volumetric Light Cones
      const hlMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });
      const headlightCones = new THREE.Group();
      [-0.7, 0.7].forEach(hx => {
        const hl = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.18, 0.1), hlMat);
        hl.position.set(hx, 0.62, 2.21);
        visualBody.add(hl);

        const coneGeo = new THREE.ConeGeometry(1.3, 9.5, 12, 1, true);
        coneGeo.rotateX(Math.PI / 2);
        const coneMat = new THREE.MeshBasicMaterial({
          color: 0xfef9c3,
          transparent: true,
          opacity: isPlayer ? 0.18 : 0.11,
          side: THREE.DoubleSide,
          depthWrite: false
        });
        const cone = new THREE.Mesh(coneGeo, coneMat);
        cone.position.set(hx, 0.35, 6.9);
        headlightCones.add(cone);
      });
      headlightCones.visible = gameState.isNight;
      visualBody.add(headlightCones);

      // Rear Brake / Tail Lights (Material brightness changes when braking!)
      const brakeMat = new THREE.MeshBasicMaterial({ color: 0x7f1d1d });
      [-0.7, 0.7].forEach(bx => {
        const tl = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.18, 0.1), brakeMat);
        tl.position.set(bx, 0.65, -2.21);
        visualBody.add(tl);
      });

      // 4 Wheels
      const wheels = [];
      const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.36, 14);
      wheelGeo.rotateZ(Math.PI / 2);
      const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.8 });
      const wheelCoords = [
        [-1.08, 0.42, 1.35],
        [1.08, 0.42, 1.35],
        [-1.08, 0.42, -1.35],
        [1.08, 0.42, -1.35]
      ];
      wheelCoords.forEach(([wx, wy, wz]) => {
        const wMesh = new THREE.Mesh(wheelGeo, wheelMat);
        wMesh.position.set(wx, wy, wz);
        wMesh.castShadow = true;
        visualBody.add(wMesh);
        wheels.push(wMesh);
      });

      return { root, visualBody, brakeMat, headlightCones, wheels };
    }

    // Spawn 3D Smoke or Nitro Flame Particle behind a car
    function spawnCarParticle(worldPos, type = 'smoke') {
      const geo = new THREE.DodecahedronGeometry(type === 'nitro' ? 0.32 : 0.38, 0);
      const col = type === 'nitro'
        ? (Math.random() > 0.4 ? 0x38bdf8 : 0xf97316)
        : 0xcbd5e1;
      const mat = new THREE.MeshBasicMaterial({
        color: col,
        transparent: true,
        opacity: type === 'nitro' ? 0.88 : 0.55
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.copy(worldPos);
      mesh.position.x += (Math.random() - 0.5) * 0.8;
      mesh.position.y += 0.25 + Math.random() * 0.2;
      mesh.position.z += (Math.random() - 0.5) * 0.8;
      scene.add(mesh);

      particlePool.push({
        mesh,
        type,
        life: 1.0,
        decay: type === 'nitro' ? 4.5 : 2.2,
        velY: type === 'nitro' ? 0.5 : 1.4
      });
    }

    function updateParticles(dt) {
      for (let i = particlePool.length - 1; i >= 0; i--) {
        const p = particlePool[i];
        p.life -= dt * p.decay;
        if (p.life <= 0) {
          scene.remove(p.mesh);
          p.mesh.geometry.dispose();
          p.mesh.material.dispose();
          particlePool.splice(i, 1);
        } else {
          p.mesh.position.y += p.velY * dt;
          const s = p.type === 'nitro' ? p.life : (1.8 - p.life * 0.8);
          p.mesh.scale.setScalar(s);
          p.mesh.material.opacity = p.life * 0.6;
        }
      }
    }

    // ============================================================================
    // 6. RACER INITIALIZATION & TRACK PROGRESS / PHYSICS ENGINE
    // ============================================================================
    function clearExistingRacers() {
      gameState.racers.forEach(r => {
        if (r.meshGroup) scene.remove(r.meshGroup);
      });
      gameState.racers = [];
    }

    function setupRaceGrid() {
      clearExistingRacers();

      const chosenSpec = CAR_SPECS[gameState.selectedCarIdx];
      const startSampleIdx = TRACK_SAMPLES - 6; // Just before Start/Finish line

      // Create Player Racer (Grid Slot 4 - Back right, ready to overtake!)
      const pCar = createSportsCarMesh(chosenSpec.colorHex, chosenSpec.accentHex, true);
      scene.add(pCar.root);

      const playerRacer = {
        isPlayer: true,
        name: `Kamu (${chosenSpec.name})`,
        colorHex: chosenSpec.colorHex,
        spec: chosenSpec,
        meshGroup: pCar.root,
        visualBody: pCar.visualBody,
        brakeMat: pCar.brakeMat,
        headlightCones: pCar.headlightCones,
        wheels: pCar.wheels,
        pos: new THREE.Vector3(),
        heading: 0,
        speed: 0,
        driftAngle: 0,
        nitro: 100,
        lap: 1,
        passedHalfway: false,
        trackIdx: startSampleIdx,
        totalProgress: 0,
        finished: false,
        finishTime: 0
      };

      // Create 3 AI Racers
      const allRacers = [playerRacer];
      AI_DRIVERS.forEach((aiDef, idx) => {
        const aiCar = createSportsCarMesh(aiDef.colorHex, aiDef.accentHex, false);
        scene.add(aiCar.root);

        allRacers.push({
          isPlayer: false,
          name: aiDef.name,
          colorHex: aiDef.colorHex,
          laneOffset: aiDef.laneOffset,
          speedFactor: aiDef.speedFactor,
          meshGroup: aiCar.root,
          visualBody: aiCar.visualBody,
          brakeMat: aiCar.brakeMat,
          headlightCones: aiCar.headlightCones,
          wheels: aiCar.wheels,
          pos: new THREE.Vector3(),
          heading: 0,
          speed: 0,
          t: (TRACK_SAMPLES - 3 - idx * 1.2) / TRACK_SAMPLES,
          lap: 1,
          passedHalfway: false,
          trackIdx: startSampleIdx,
          totalProgress: 0,
          finished: false,
          finishTime: 0
        });
      });

      // Position all 4 cars on the 2x2 starting grid before the finish line
      const gridOffsets = [
        { sampleBack: 7, lateral: 3.0 },  // Player (P4)
        { sampleBack: 3, lateral: -3.0 }, // AI 1 (P1)
        { sampleBack: 4, lateral: 3.0 },  // AI 2 (P2)
        { sampleBack: 6, lateral: -3.0 }  // AI 3 (P3)
      ];

      allRacers.forEach((racer, idx) => {
        const g = gridOffsets[idx];
        const sIdx = (TRACK_SAMPLES - g.sampleBack) % TRACK_SAMPLES;
        const s = trackSamples[sIdx];
        racer.pos.copy(s.pt).addScaledVector(s.normal, g.lateral);
        racer.heading = Math.atan2(s.tangent.x, s.tangent.z);
        racer.trackIdx = sIdx;
        racer.t = sIdx / TRACK_SAMPLES;
        racer.meshGroup.position.copy(racer.pos);
        racer.meshGroup.rotation.y = racer.heading;
      });

      gameState.racers = allRacers;
      applyDayNightVisuals();
    }

    // Find closest track sample index near a world position
    function findNearestTrackSample(pos, hintIdx) {
      let bestIdx = hintIdx;
      let bestDistSq = Infinity;
      // Search window around hintIdx first for speed
      const searchRange = 35;
      for (let d = -searchRange; d <= searchRange; d++) {
        const idx = (hintIdx + d + TRACK_SAMPLES) % TRACK_SAMPLES;
        const distSq = pos.distanceToSquared(trackSamples[idx].pt);
        if (distSq < bestDistSq) {
          bestDistSq = distSq;
          bestIdx = idx;
        }
      }
      return { index: bestIdx, sample: trackSamples[bestIdx], distSq: bestDistSq };
    }

    function updatePlayerPhysics(player, dt) {
      const spec = player.spec;
      const canDrive = gameState.phase === 'racing' && !player.finished;

      const gas = canDrive && inputState.gas;
      const brake = canDrive && inputState.brake;
      const left = canDrive && inputState.left;
      const right = canDrive && inputState.right;
      const wantsDrift = canDrive && inputState.drift && Math.abs(player.speed) > 18;
      const wantsNitro = canDrive && inputState.nitro && player.nitro > 2 && gas;

      // Nitro consumption & recharge
      let activeNitro = false;
      if (wantsNitro) {
        activeNitro = true;
        player.nitro = Math.max(0, player.nitro - dt * 32);
      } else if (canDrive) {
        const recharge = wantsDrift ? spec.driftChargeRate : 4.5;
        player.nitro = Math.min(100, player.nitro + dt * recharge);
      }

      // Dynamic Camera FOV effect for Nitro
      const targetFov = activeNitro ? 68 : 58;
      camera.fov += (targetFov - camera.fov) * dt * 6;
      camera.updateProjectionMatrix();

      // Acceleration, Braking & Drag
      const currentMaxSpeed = spec.maxSpeed + (activeNitro ? spec.nitroBonus : 0);
      if (gas) {
        const accelBoost = activeNitro ? spec.accel * 1.65 : spec.accel;
        player.speed += accelBoost * dt;
      } else if (brake && !wantsDrift) {
        if (player.speed > 2) {
          player.speed -= 52 * dt;
        } else {
          player.speed -= 22 * dt; // Reverse
        }
      } else {
        // Natural rolling resistance
        player.speed *= (1 - 1.15 * dt);
      }

      if (wantsDrift) {
        player.speed *= (1 - 0.45 * dt);
      }

      player.speed = Math.max(-18, Math.min(currentMaxSpeed, player.speed));

      // Brake Light Glow
      player.brakeMat.color.setHex((brake || wantsDrift) ? 0xff1e1e : 0x6b1111);

      // Steering & Drift Slip Angle
      const steerDir = (left ? 1 : 0) - (right ? 1 : 0);
      if (Math.abs(player.speed) > 0.5) {
        const revSign = player.speed >= 0 ? 1 : -1;
        const speedFactor = Math.min(1, Math.abs(player.speed) / 22);
        const turnRate = spec.handling * (wantsDrift ? 1.32 : 1.0) * speedFactor;
        player.heading += steerDir * turnRate * revSign * dt;
      }

      // Smooth visual drift angle & body roll
      const targetDriftAngle = (wantsDrift && steerDir !== 0) ? steerDir * 0.34 : 0;
      player.driftAngle += (targetDriftAngle - player.driftAngle) * dt * 8;
      player.visualBody.rotation.y = player.driftAngle;
      player.visualBody.rotation.z = -steerDir * Math.min(0.08, Math.abs(player.speed) * 0.0012);

      // Move Car Forward
      player.pos.x += Math.sin(player.heading) * player.speed * dt;
      player.pos.z += Math.cos(player.heading) * player.speed * dt;

      // Track Boundary Check & Gentle Barrier Pushback
      const prevIdx = player.trackIdx;
      const nearest = findNearestTrackSample(player.pos, prevIdx);
      player.trackIdx = nearest.index;
      const s = nearest.sample;

      const offsetVec = new THREE.Vector3().subVectors(player.pos, s.pt);
      const lateralOffset = offsetVec.dot(s.normal);
      const maxAllowedOffset = ROAD_HALF_WIDTH + 1.2;

      if (Math.abs(lateralOffset) > maxAllowedOffset) {
        const clampedLat = Math.sign(lateralOffset) * maxAllowedOffset;
        player.pos.copy(s.pt).addScaledVector(s.normal, clampedLat);
        player.speed *= (1 - 2.2 * dt); // Off-road curb friction
      }

      // Check Lap Progression (Checkpoints)
      if (player.trackIdx > TRACK_SAMPLES * 0.42 && player.trackIdx < TRACK_SAMPLES * 0.65) {
        player.passedHalfway = true;
      }
      if (prevIdx > TRACK_SAMPLES * 0.85 && player.trackIdx < TRACK_SAMPLES * 0.15 && player.passedHalfway) {
        player.passedHalfway = false;
        const completedLapTime = gameState.raceTime - gameState.lapStartTime;
        if (completedLapTime > 5 && completedLapTime < gameState.bestLapTime) {
          gameState.bestLapTime = completedLapTime;
        }
        gameState.lapStartTime = gameState.raceTime;

        if (player.lap < TOTAL_LAPS) {
          player.lap += 1;
          playSFX('lap');
          showCenterAnnouncement(`PUTARAN ${player.lap}/${TOTAL_LAPS}`, player.lap === TOTAL_LAPS ? 'Putaran Terakhir! Gas Pol!' : '');
        } else if (!player.finished) {
          player.finished = true;
          player.finishTime = gameState.raceTime;
          onPlayerFinishedRace();
        }
      }

      player.totalProgress = (player.lap - 1) + (player.trackIdx / TRACK_SAMPLES);

      // Update 3D Transform & Wheels
      player.meshGroup.position.copy(player.pos);
      player.meshGroup.rotation.y = player.heading;
      player.wheels.forEach(w => { w.rotation.x += player.speed * dt * 0.8; });

      // Spawn Exhaust / Drift Particles
      if (activeNitro) {
        const backPos = player.pos.clone().add(new THREE.Vector3(-Math.sin(player.heading) * 2.3, 0.2, -Math.cos(player.heading) * 2.3));
        spawnCarParticle(backPos, 'nitro');
      } else if (wantsDrift && Math.abs(player.speed) > 22) {
        const backPos = player.pos.clone().add(new THREE.Vector3(-Math.sin(player.heading) * 2.1, 0.1, -Math.cos(player.heading) * 2.1));
        spawnCarParticle(backPos, 'smoke');
      }

      // Status Banner UI (Drift / Nitro)
      const banner = document.getElementById('hud-status-banner');
      if (activeNitro) {
        banner.textContent = '⚡ NITRO BOOST AKTIF!';
        banner.className = 'glass-pill px-4 py-1.5 rounded-full text-xs sm:text-sm font-extrabold tracking-wider uppercase text-cyan-300 border border-cyan-400/50 shadow-lg';
        banner.classList.remove('hidden');
      } else if (wantsDrift && steerDir !== 0) {
        banner.textContent = '🔥 DRIFTING! +ISI NITRO';
        banner.className = 'glass-pill px-4 py-1.5 rounded-full text-xs sm:text-sm font-extrabold tracking-wider uppercase text-amber-300 border border-amber-400/50 shadow-lg';
        banner.classList.remove('hidden');
      } else {
        banner.classList.add('hidden');
      }

      // Track Top Speed KM/H
      const kmh = Math.round(Math.abs(player.speed) * 4.0);
      if (kmh > gameState.topSpeedKmh) gameState.topSpeedKmh = kmh;

      // Update Web Audio Engine Pitch
      updateEngineSound(
        Math.min(1, Math.abs(player.speed) / spec.maxSpeed),
        wantsDrift && steerDir !== 0,
        activeNitro,
        gameState.phase === 'racing'
      );
    }

    function updateAIRacers(dt) {
      if (gameState.phase !== 'racing') return;

      const player = gameState.racers[0];

      for (let i = 1; i < gameState.racers.length; i++) {
        const ai = gameState.racers[i];
        if (ai.finished) continue;

        // Calculate curvature ahead to slow down slightly on tight corners
        const idxNow = Math.floor(ai.t * TRACK_SAMPLES) % TRACK_SAMPLES;
        const idxAhead = (idxNow + 8) % TRACK_SAMPLES;
        const turnDot = trackSamples[idxNow].tangent.dot(trackSamples[idxAhead].tangent);
        const cornerSlowdown = turnDot < 0.85 ? 0.78 : 1.0;

        // Gentle rubber-banding so AI stays competitive and exciting
        const progressDiff = player.totalProgress - ai.totalProgress;
        const rubberBand = Math.max(0.88, Math.min(1.12, 1.0 + progressDiff * 0.25));

        const targetSpeed = 61 * ai.speedFactor * cornerSlowdown * rubberBand;
        ai.speed += (targetSpeed - ai.speed) * dt * 2.5;

        // Advance parameter t along the closed spline (circuit length ~ 1250 units)
        const circuitLengthApprox = 1260;
        const prevT = ai.t;
        ai.t = (ai.t + (ai.speed * dt) / circuitLengthApprox) % 1.0;

        const pt = trackCurve.getPointAt(ai.t);
        const tangent = trackCurve.getTangentAt(ai.t).normalize();
        const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();

        ai.pos.copy(pt).addScaledVector(normal, ai.laneOffset);
        ai.heading = Math.atan2(tangent.x, tangent.z);
        ai.trackIdx = Math.floor(ai.t * TRACK_SAMPLES);

        if (ai.t > 0.4 && ai.t < 0.65) ai.passedHalfway = true;
        if (prevT > 0.85 && ai.t < 0.15 && ai.passedHalfway) {
          ai.passedHalfway = false;
          if (ai.lap < TOTAL_LAPS) {
            ai.lap += 1;
          } else {
            ai.finished = true;
            ai.finishTime = gameState.raceTime;
          }
        }

        ai.totalProgress = (ai.lap - 1) + ai.t;
        ai.meshGroup.position.copy(ai.pos);
        ai.meshGroup.rotation.y = ai.heading;
      }

      // Simple Car-to-Car Collision Push-apart
      for (let a = 0; a < gameState.racers.length; a++) {
        for (let b = a + 1; b < gameState.racers.length; b++) {
          const rA = gameState.racers[a];
          const rB = gameState.racers[b];
          const dx = rB.pos.x - rA.pos.x;
          const dz = rB.pos.z - rA.pos.z;
          const dist = Math.hypot(dx, dz);
          const minDist = 2.6;
          if (dist > 0.01 && dist < minDist) {
            const overlap = (minDist - dist) * 0.5;
            const nx = dx / dist;
            const nz = dz / dist;
            rA.pos.x -= nx * overlap;
            rA.pos.z -= nz * overlap;
            rB.pos.x += nx * overlap;
            rB.pos.z += nz * overlap;
          }
        }
      }
    }

    // ============================================================================
    // 7. CAMERA CONTROLLER, HUD & MINIMAP RENDERER
    // ============================================================================
    const camCurrentPos = new THREE.Vector3(0, 12, -25);
    const camLookTarget = new THREE.Vector3();

    function updateCamera(dt) {
      if (gameState.phase === 'garage') {
        // Orbit around Start/Finish gantry in background
        const angle = performance.now() * 0.0003;
        camera.position.set(Math.cos(angle) * 42, 18, Math.sin(angle) * 42 + 10);
        camera.lookAt(0, 2, 15);
        return;
      }

      const player = gameState.racers[0];
      if (!player) return;

      const forwardX = Math.sin(player.heading);
      const forwardZ = Math.cos(player.heading);

      let desiredPos = new THREE.Vector3();
      let desiredLook = new THREE.Vector3();

      if (gameState.cameraMode === 0) {
        // 0: Dynamic Chase Cam
        desiredPos.set(
          player.pos.x - forwardX * 11.5,
          player.pos.y + 4.8,
          player.pos.z - forwardZ * 11.5
        );
        desiredLook.set(
          player.pos.x + forwardX * 10,
          player.pos.y + 1.4,
          player.pos.z + forwardZ * 10
        );
      } else if (gameState.cameraMode === 1) {
        // 1: Close Hood / Action Cam
        desiredPos.set(
          player.pos.x - forwardX * 6.2,
          player.pos.y + 2.6,
          player.pos.z - forwardZ * 6.2
        );
        desiredLook.set(
          player.pos.x + forwardX * 16,
          player.pos.y + 1.1,
          player.pos.z + forwardZ * 16
        );
      } else {
        // 2: Top-Down Isometric Cam
        desiredPos.set(
          player.pos.x - 22,
          player.pos.y + 38,
          player.pos.z - 22
        );
        desiredLook.copy(player.pos);
      }

      camCurrentPos.lerp(desiredPos, Math.min(1, dt * 10));
      camLookTarget.lerp(desiredLook, Math.min(1, dt * 14));
      camera.position.copy(camCurrentPos);
      camera.lookAt(camLookTarget);
    }

    function formatRaceTime(sec) {
      if (!isFinite(sec) || sec < 0) return '--:--.-';
      const mins = Math.floor(sec / 60);
      const rem = sec % 60;
      const secs = Math.floor(rem);
      const tenths = Math.floor((rem - secs) * 10);
      return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${tenths}`;
    }

    function updateHUDAndMinimap() {
      const player = gameState.racers[0];
      if (!player) return;

      // Sort standings by totalProgress descending
      const sorted = [...gameState.racers].sort((a, b) => {
        if (a.finished && b.finished) return a.finishTime - b.finishTime;
        if (a.finished) return -1;
        if (b.finished) return 1;
        return b.totalProgress - a.totalProgress;
      });
      const playerRank = sorted.findIndex(r => r.isPlayer) + 1;

      document.getElementById('hud-position').textContent = playerRank;
      document.getElementById('hud-lap').textContent = Math.min(TOTAL_LAPS, player.lap);
      document.getElementById('hud-time-total').textContent = formatRaceTime(gameState.raceTime);
      document.getElementById('hud-time-best').textContent = formatRaceTime(gameState.bestLapTime);

      const kmh = Math.round(Math.abs(player.speed) * 4.0);
      document.getElementById('hud-speed').textContent = kmh;

      // Gear & RPM calculation
      let gear = '1';
      if (player.speed < -1) gear = 'R';
      else if (kmh > 215) gear = '5';
      else if (kmh > 165) gear = '4';
      else if (kmh > 110) gear = '3';
      else if (kmh > 55) gear = '2';
      document.getElementById('hud-gear').textContent = gear;

      const rpmPct = Math.min(100, Math.max(8, ((kmh % 62) / 62) * 85 + (kmh > 220 ? 15 : 0)));
      document.getElementById('hud-rpm-bar').style.width = `${rpmPct}%`;

      const nitroPct = Math.round(player.nitro);
      document.getElementById('hud-nitro-bar').style.width = `${nitroPct}%`;
      document.getElementById('hud-nitro-pct').textContent = `${nitroPct}%`;

      // Draw 2D Circuit Minimap
      const canvas = document.getElementById('minimap-canvas');
      const ctx = canvas.getContext('2d');
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      // Map world coordinates X: [-40..250], Z: [-220..220] into [14..w-14]
      const mapPoint = (wx, wz) => {
        const nx = (wx - (-35)) / 280;
        const nz = (wz - (-215)) / 430;
        return {
          x: 14 + nx * (w - 28),
          y: h - (14 + nz * (h - 28))
        };
      };

      // Draw Track Loop
      ctx.beginPath();
      for (let i = 0; i < TRACK_SAMPLES; i += 4) {
        const p = mapPoint(trackSamples[i].pt.x, trackSamples[i].pt.z);
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      }
      ctx.closePath();
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.45)';
      ctx.lineWidth = 6;
      ctx.stroke();

      // Start/Finish marker dot
      const sf = mapPoint(trackSamples[0].pt.x, trackSamples[0].pt.z);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(sf.x - 3, sf.y - 3, 6, 6);

      // Draw AI Cars
      for (let i = 1; i < gameState.racers.length; i++) {
        const ai = gameState.racers[i];
        const mp = mapPoint(ai.pos.x, ai.pos.z);
        ctx.beginPath();
        ctx.arc(mp.x, mp.y, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#' + ai.colorHex.toString(16).padStart(6, '0');
        ctx.fill();
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // Draw Player Car Dot (Larger with white pulsing ring)
      const pp = mapPoint(player.pos.x, player.pos.z);
      ctx.beginPath();
      ctx.arc(pp.x, pp.y, 5.5, 0, Math.PI * 2);
      ctx.fillStyle = '#38bdf8';
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // ============================================================================
    // 8. UI FLOW: GARAGE, COUNTDOWN, ANNOUNCEMENTS & PODIUM RESULTS
    // ============================================================================
    function renderGarageCards() {
      const container = document.getElementById('car-selection-grid');
      container.innerHTML = '';

      CAR_SPECS.forEach((car, index) => {
        const isSelected = index === gameState.selectedCarIdx;
        const card = document.createElement('div');
        card.onclick = () => {
          gameState.selectedCarIdx = index;
          playSFX('beep');
          renderGarageCards();
        };
        card.className = `cursor-pointer rounded-2xl p-4 transition-all border-2 ${
          isSelected
            ? 'bg-slate-800/95 border-amber-400 shadow-xl shadow-amber-500/10 scale-[1.02]'
            : 'bg-slate-900/75 border-slate-700/70 hover:border-slate-500'
        }`;

        const hexStr = '#' + car.colorHex.toString(16).padStart(6, '0');
        card.innerHTML = `
          <div class="flex items-center justify-between mb-2">
            <span class="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-gradient-to-r ${car.badgeBg} text-white">
              ${car.type}
            </span>
            ${isSelected ? '<span class="text-xs font-extrabold text-amber-400">✓ DIPILIH</span>' : ''}
          </div>

          <!-- Stylized Car Visual Header -->
          <div class="h-20 rounded-xl bg-slate-950/90 border border-slate-800 flex items-center justify-center my-2 relative overflow-hidden">
            <div class="w-28 h-8 rounded-lg shadow-lg flex items-center justify-center relative" style="background-color: ${hexStr}">
              <div class="w-12 h-5 bg-slate-900 rounded"></div>
              <div class="absolute -bottom-1.5 left-3 w-5 h-5 rounded-full bg-slate-950 border-2 border-slate-400"></div>
              <div class="absolute -bottom-1.5 right-3 w-5 h-5 rounded-full bg-slate-950 border-2 border-slate-400"></div>
            </div>
          </div>

          <h3 class="font-racing text-lg font-black text-white mt-2">${car.name}</h3>
          <p class="text-xs text-slate-400 mb-3">${car.desc}</p>

          <!-- Stat Bars -->
          <div class="space-y-2 text-xs">
            <div>
              <div class="flex justify-between mb-0.5">
                <span class="text-slate-300 font-semibold">Kecepatan Puncak</span>
                <span class="font-racing font-bold text-amber-300">${car.statsUI.speed}%</span>
              </div>
              <div class="w-full h-1.5 bg-slate-950 rounded-full overflow-hidden">
                <div class="h-full bg-amber-400 rounded-full" style="width: ${car.statsUI.speed}%"></div>
              </div>
            </div>
            <div>
              <div class="flex justify-between mb-0.5">
                <span class="text-slate-300 font-semibold">Akselerasi</span>
                <span class="font-racing font-bold text-emerald-400">${car.statsUI.accel}%</span>
              </div>
              <div class="w-full h-1.5 bg-slate-950 rounded-full overflow-hidden">
                <div class="h-full bg-emerald-400 rounded-full" style="width: ${car.statsUI.accel}%"></div>
              </div>
            </div>
            <div>
              <div class="flex justify-between mb-0.5">
                <span class="text-slate-300 font-semibold">Handling & Drift</span>
                <span class="font-racing font-bold text-cyan-400">${car.statsUI.handling}%</span>
              </div>
              <div class="w-full h-1.5 bg-slate-950 rounded-full overflow-hidden">
                <div class="h-full bg-cyan-400 rounded-full" style="width: ${car.statsUI.handling}%"></div>
              </div>
            </div>
          </div>
        `;
        container.appendChild(card);
      });
    }

    function openGarageModal() {
      gameState.phase = 'garage';
      resetInputState();
      updateEngineSound(0, false, false, false);
      document.getElementById('results-modal').classList.add('hidden');
      document.getElementById('race-hud').classList.add('hidden');
      document.getElementById('garage-modal').classList.remove('hidden');
      renderGarageCards();
      applyDayNightVisuals();
      updateOrientationHint();
    }

    function startRaceFromGarage() {
      requestMobileExperience();
      initAudioEngine();
      resetInputState();
      document.getElementById('garage-modal').classList.add('hidden');
      document.getElementById('results-modal').classList.add('hidden');
      document.getElementById('race-hud').classList.remove('hidden');

      setupRaceGrid();
      gameState.raceTime = 0;
      gameState.lapStartTime = 0;
      gameState.bestLapTime = Infinity;
      gameState.topSpeedKmh = 0;
      gameState.phase = 'countdown';
      updateOrientationHint();

      // Snap camera behind player immediately.
      const p = gameState.racers[0];
      camCurrentPos.set(p.pos.x, p.pos.y + 6, p.pos.z - 14);
      camLookTarget.copy(p.pos);

      runStartCountdown();
    }

    function restartRaceImmediate() {
      startRaceFromGarage();
    }

    function showCenterAnnouncement(mainText, subText = '', duration = 1300) {
      const textEl = document.getElementById('countdown-text');
      const subEl = document.getElementById('countdown-sub');
      textEl.textContent = mainText;
      subEl.textContent = subText;
      textEl.classList.remove('countdown-pop');
      void textEl.offsetWidth;
      textEl.classList.add('countdown-pop');

      clearTimeout(window._announceTimer);
      window._announceTimer = setTimeout(() => {
        if (gameState.phase === 'racing') {
          textEl.textContent = '';
          subEl.textContent = '';
        }
      }, duration);
    }

    function runStartCountdown() {
      const steps = [
        { text: '3', sub: 'Siapkan Mesinmu...', sfx: 'beep' },
        { text: '2', sub: 'Fokus Pada Tikungan Pertama', sfx: 'beep' },
        { text: '1', sub: 'Tahan Gas!', sfx: 'beep' },
        { text: 'MULAI!', sub: 'Taklukkan 3 Putaran!', sfx: 'go' }
      ];

      let idx = 0;
      const tick = () => {
        if (gameState.phase !== 'countdown') return;
        const step = steps[idx];
        playSFX(step.sfx);
        showCenterAnnouncement(step.text, step.sub, 950);

        if (idx === steps.length - 1) {
          gameState.phase = 'racing';
          gameState.raceTime = 0;
          gameState.lapStartTime = 0;
        } else {
          idx++;
          setTimeout(tick, 950);
        }
      };
      tick();
    }

    function onPlayerFinishedRace() {
      gameState.phase = 'finished';
      resetInputState();
      updateOrientationHint();
      updateEngineSound(0, false, false, false);
      playSFX('win');

      // Estimate finish times for any AI cars still on track
      const sorted = [...gameState.racers].sort((a, b) => {
        if (a.finished && b.finished) return a.finishTime - b.finishTime;
        if (a.finished) return -1;
        if (b.finished) return 1;
        return b.totalProgress - a.totalProgress;
      });

      sorted.forEach((r, idx) => {
        if (!r.finished) {
          const remainingRatio = Math.max(0.02, TOTAL_LAPS - r.totalProgress);
          r.finishTime = gameState.raceTime + remainingRatio * 18 + idx * 0.6;
          r.finished = true;
        }
      });

      const playerRank = sorted.findIndex(r => r.isPlayer) + 1;
      const trophies = ['🏆', '🥈', '🥉', '🏁'];
      const titles = ['JUARA 1 PODIUM UTAMA!', 'JUARA 2 PODIUM PERAK!', 'JUARA 3 PODIUM PERUNGGU!', 'FINIS POSISI KE-4!'];

      document.getElementById('result-trophy-icon').textContent = trophies[playerRank - 1] || '🏁';
      document.getElementById('result-title').textContent = titles[playerRank - 1];
      document.getElementById('result-total-time').textContent = formatRaceTime(gameState.racers[0].finishTime);
      document.getElementById('result-best-lap').textContent = formatRaceTime(gameState.bestLapTime);
      document.getElementById('result-top-speed').textContent = `${gameState.topSpeedKmh} KM/J`;

      const listEl = document.getElementById('result-standings-list');
      listEl.innerHTML = sorted.map((r, i) => `
        <div class="flex items-center justify-between px-3 py-2 rounded-xl ${r.isPlayer ? 'bg-amber-500/20 border border-amber-400/50 font-bold text-white' : 'bg-slate-800/60 text-slate-300'}">
          <div class="flex items-center gap-2.5">
            <span class="font-racing font-black w-5 text-amber-400">#${i + 1}</span>
            <span>${r.name}</span>
          </div>
          <span class="font-racing text-xs font-bold text-emerald-400">${formatRaceTime(r.finishTime)}</span>
        </div>
      `).join('');

      document.getElementById('results-modal').classList.remove('hidden');
    }

    // ============================================================================
    // 9. MAIN ANIMATION & SIMULATION LOOP
    // ============================================================================
    let prevTime = performance.now();

    function animateLoop(now) {
      requestAnimationFrame(animateLoop);
      const dt = Math.min((now - prevTime) / 1000, 0.05);
      prevTime = now;

      if (gameState.phase === 'racing') {
        gameState.raceTime += dt;
      }

      if (gameState.racers.length > 0 && gameState.phase !== 'garage') {
        updatePlayerPhysics(gameState.racers[0], dt);
        updateAIRacers(dt);
        updateHUDAndMinimap();
      }

      updateParticles(dt);
      updateCamera(dt);
      renderer.render(scene, camera);
    }

    window.onload = function () {
      setupInputs();
      initThreeWorld();
      renderGarageCards();
      requestAnimationFrame(animateLoop);
    };
