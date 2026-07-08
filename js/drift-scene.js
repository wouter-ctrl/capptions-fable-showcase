/* ============================================================
   Drift Field — Three.js hero centerpiece.
   ~5000 particles + two ribbon lines. Two driver values, set from
   scroll progress in main.js:
     uDrift  1 = fully diverged/chaotic (the risk)  0 = calm
     uOrder  0 = wandering                          1 = snapped to
             the 7-node lattice (the fix)
   Positions are computed on CPU each frame (curl-ish noise mixed
   toward lattice targets) — no GLSL needed for this look, and it
   stays debuggable in one file.
   ============================================================ */
(function () {
  'use strict';
  var mount = document.getElementById('drift-3d');
  if (!mount || !window.THREE) return;

  var THREE = window.THREE;
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x0a0e27, 0.045);

  var camera = new THREE.PerspectiveCamera(42, mount.clientWidth / mount.clientHeight, 0.1, 100);
  camera.position.set(0, 0, 9);

  var renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(mount.clientWidth, mount.clientHeight);
  mount.appendChild(renderer.domElement);

  var TEAL = new THREE.Color(0x28e0c8);
  var VIOLET = new THREE.Color(0x6c4cf0);
  var GOLD = new THREE.Color(0xf5c36b);

  var isSmallViewport = window.innerWidth < 760;
  var COUNT = reduced ? 0 : (isSmallViewport ? 2400 : 5200);
  var positions = new Float32Array(COUNT * 3);
  var colors = new Float32Array(COUNT * 3);
  var seeds = new Float32Array(COUNT);
  var lattice = new Float32Array(COUNT * 3); // 7-node target per particle

  var NODES = 7;
  var nodePos = [];
  for (var n = 0; n < NODES; n++) {
    var a = (n / NODES) * Math.PI * 2 - Math.PI / 2;
    nodePos.push([Math.cos(a) * 3.2, Math.sin(a) * 3.2, 0]);
  }

  for (var i = 0; i < COUNT; i++) {
    var s = Math.random();
    seeds[i] = s;
    positions[i * 3 + 0] = (Math.random() - 0.5) * 14;
    positions[i * 3 + 1] = (Math.random() - 0.5) * 8;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 6;

    var node = nodePos[i % NODES];
    var jitter = 0.18;
    lattice[i * 3 + 0] = node[0] + (Math.random() - 0.5) * jitter;
    lattice[i * 3 + 1] = node[1] + (Math.random() - 0.5) * jitter;
    lattice[i * 3 + 2] = node[2] + (Math.random() - 0.5) * jitter;

    var c = TEAL.clone().lerp(VIOLET, Math.random());
    colors[i * 3 + 0] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
  }

  var geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  var material = new THREE.PointsMaterial({
    size: 0.05,
    transparent: true,
    opacity: 0.9,
    vertexColors: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });

  var points = new THREE.Points(geo, material);
  scene.add(points);

  // Two ribbon lines (documented regulation / shop-floor reality) —
  // start merged at top, diverge downward as uDrift rises.
  function makeRibbon(colorHex) {
    var pts = [];
    for (var k = 0; k <= 40; k++) pts.push(new THREE.Vector3(0, 0, 0));
    var g = new THREE.BufferGeometry().setFromPoints(pts);
    var m = new THREE.LineBasicMaterial({ color: colorHex, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending });
    return new THREE.Line(g, m);
  }
  var ribbonA = makeRibbon(0x28e0c8); // teal — regulation
  var ribbonB = makeRibbon(0xff6b54); // coral — shop floor
  scene.add(ribbonA, ribbonB);

  var uDrift = 0, uOrder = 0;
  var targetDrift = 0, targetOrder = 0;
  function setDrift(v) { targetDrift = Math.max(0, Math.min(1, v)); }
  function setOrder(v) { targetOrder = Math.max(0, Math.min(1, v)); }
  window.__driftScene = { setDrift: setDrift, setOrder: setOrder };

  function updateRibbon(line, sign) {
    var pos = line.geometry.attributes.position.array;
    for (var k = 0; k <= 40; k++) {
      var t = k / 40;
      var y = 4 - t * 8;
      var spread = sign * uDrift * (0.3 + t * 2.4);
      var x = spread + Math.sin(t * 6 + performance.now() * 0.0003) * 0.08 * uDrift;
      pos[k * 3 + 0] = x;
      pos[k * 3 + 1] = y;
      pos[k * 3 + 2] = -1;
    }
    line.geometry.attributes.position.needsUpdate = true;
  }

  if (reduced) {
    renderer.render(scene, camera);
  } else {
    (function tick() {
      uDrift += (targetDrift - uDrift) * 0.05;
      uOrder += (targetOrder - uOrder) * 0.05;
      var t = performance.now() * 0.00018;
      var pos = geo.attributes.position.array;
      for (var i = 0; i < COUNT; i++) {
        var s = seeds[i];
        var wanderX = Math.sin(t * 3 + s * 30) * 2.2 * (1 - uOrder);
        var wanderY = Math.cos(t * 2.4 + s * 24) * 1.6 * (1 - uOrder);
        var wanderZ = Math.sin(t * 1.7 + s * 18) * 1.4 * (1 - uOrder);
        var baseX = (s - 0.5) * 14 * (1 - uOrder * 0.6);
        var baseY = (((s * 7) % 1) - 0.5) * 8 * (1 - uOrder * 0.6);
        var baseZ = (((s * 13) % 1) - 0.5) * 6 * (1 - uOrder * 0.6);
        pos[i * 3 + 0] = baseX * (1 - uOrder) + lattice[i * 3 + 0] * uOrder + wanderX;
        pos[i * 3 + 1] = baseY * (1 - uOrder) + lattice[i * 3 + 1] * uOrder + wanderY;
        pos[i * 3 + 2] = baseZ * (1 - uOrder) + lattice[i * 3 + 2] * uOrder + wanderZ;
      }
      geo.attributes.position.needsUpdate = true;
      updateRibbon(ribbonA, 1);
      updateRibbon(ribbonB, -1);
      // keep the 7-node ring legibly face-on at full order - too much
      // y-rotation turns 7 distinguishable nodes into a squashed ellipse
      points.rotation.y = Math.sin(t * 0.6) * 0.1 * (1 - uOrder) + uOrder * 0.06;
      renderer.render(scene, camera);
      requestAnimationFrame(tick);
    })();
  }

  window.addEventListener('resize', function () {
    camera.aspect = mount.clientWidth / mount.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(mount.clientWidth, mount.clientHeight);
  });
})();
