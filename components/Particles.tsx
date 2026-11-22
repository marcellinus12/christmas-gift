'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { GPUComputationRenderer } from 'three/examples/jsm/misc/GPUComputationRenderer.js';
import { COUNT, HEIGHT, IDLE_INDEX, WIDTH, buildAllShapes } from '@/lib/shapes';
import { GESTURES, IDLE_LOOK } from '@/lib/meta';
import { input } from '@/lib/input';
import { particleFragment, particleVertex, positionShader, velocityShader } from '@/lib/shaders';

function dataTexture(data: Float32Array) {
  const t = new THREE.DataTexture(data, WIDTH, HEIGHT, THREE.RGBAFormat, THREE.FloatType);
  t.minFilter = THREE.NearestFilter;
  t.magFilter = THREE.NearestFilter;
  t.needsUpdate = true;
  return t;
}

export default function Particles() {
  const { gl } = useThree();

  const sim = useMemo(() => {
    const gpu = new GPUComputationRenderer(WIDTH, HEIGHT, gl);
    if (!gl.getContext().getExtension('EXT_color_buffer_float')) {
      gpu.setDataType(THREE.HalfFloatType); // fallback for older devices
    }

    const posTex = gpu.createTexture();
    const velTex = gpu.createTexture();
    const pd = posTex.image.data as unknown as Float32Array;
    for (let i = 0; i < COUNT; i++) {
      pd[i * 4] = (Math.random() - 0.5) * 36;
      pd[i * 4 + 1] = (Math.random() - 0.5) * 20;
      pd[i * 4 + 2] = (Math.random() - 0.5) * 18;
      pd[i * 4 + 3] = Math.random(); // per-particle seed
    }

    const velVar = gpu.addVariable('textureVelocity', velocityShader, velTex);
    const posVar = gpu.addVariable('texturePosition', positionShader, posTex);
    gpu.setVariableDependencies(velVar, [posVar, velVar]);
    gpu.setVariableDependencies(posVar, [posVar, velVar]);

    const shapes = buildAllShapes();
    const targets = shapes.map((s) => dataTexture(s.pos));
    const colors = shapes.map((s) => dataTexture(s.col));

    const vu = velVar.material.uniforms;
    vu.uTime = { value: 0 };
    vu.uDelta = { value: 0.016 };
    vu.uForm = { value: 0 };
    vu.uKick = { value: 0 };
    vu.uKickSeed = { value: 0 };
    vu.uSway = { value: IDLE_LOOK.sway };
    vu.uBob = { value: IDLE_LOOK.bob };
    vu.uBobY = { value: IDLE_LOOK.bobY };
    vu.uLevel = { value: 0 };
    vu.tTarget = { value: targets[IDLE_INDEX] };
    vu.uHand = { value: new THREE.Vector3() };
    vu.uHandActive = { value: 0 };
    vu.uOffset = { value: new THREE.Vector3() };

    const pu = posVar.material.uniforms;
    pu.uDelta = { value: 0.016 };
    pu.uForm = { value: 0 };
    pu.tTarget = { value: targets[IDLE_INDEX] };

    const err = gpu.init();
    if (err) console.error(err);

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(COUNT * 3), 3));
    const ref = new Float32Array(COUNT * 2);
    for (let i = 0; i < COUNT; i++) {
      ref[i * 2] = ((i % WIDTH) + 0.5) / WIDTH;
      ref[i * 2 + 1] = (Math.floor(i / WIDTH) + 0.5) / HEIGHT;
    }
    geometry.setAttribute('reference', new THREE.BufferAttribute(ref, 2));

    // Two layers: crisp core points + a big, faint halo layer for the glow.
    const makeMaterial = (sizeMul: number, alphaMul: number, soft: boolean) =>
      new THREE.ShaderMaterial({
        uniforms: {
          tPos: { value: gpu.getCurrentRenderTarget(posVar).texture },
          tColor: { value: colors[IDLE_INDEX] },
          uForm: { value: 0 },
          uSize: { value: 2.4 * IDLE_LOOK.size },
          uPixelRatio: { value: gl.getPixelRatio() },
          uTime: { value: 0 },
          uLevel: { value: 0 },
          uFlash: { value: 0 },
          uSizeMul: { value: sizeMul },
          uAlphaMul: { value: alphaMul },
          uGlow: { value: IDLE_LOOK.glow },
          uSoft: { value: soft ? 1 : 0 },
        },
        vertexShader: particleVertex,
        fragmentShader: particleFragment,
        // core = solid opaque discs (depth tested), halo = faint additive glow
        transparent: soft,
        depthWrite: !soft,
        blending: soft ? THREE.AdditiveBlending : THREE.NormalBlending,
      });
    const core = makeMaterial(1, 1, false);
    const halo = makeMaterial(3.6, 0.07, true);

    return { gpu, posVar, vu, pu, targets, colors, geometry, core, halo };
  }, [gl]);

  useEffect(
    () => () => {
      sim.geometry.dispose();
      sim.core.dispose();
      sim.halo.dispose();
      sim.targets.forEach((t) => t.dispose());
      sim.colors.forEach((t) => t.dispose());
      (sim.gpu as unknown as { dispose?: () => void }).dispose?.();
    },
    [sim],
  );

  const st = useRef({
    count: 0,
    form: 0,
    kick: 0,
    hand: new THREE.Vector3(),
    offset: new THREE.Vector3(),
    goal: new THREE.Vector3(),
  });

  useFrame(({ clock, camera }, delta) => {
    const dt = Math.min(delta, 1 / 30);
    const s = st.current;
    const want = input.count;

    // switch shape (0 fingers / no hand = idle "Merry Christmas" text)
    if (want !== s.count) {
      s.count = want;
      const idx = want > 0 ? want - 1 : IDLE_INDEX;
      const look = want > 0 ? GESTURES[idx] : IDLE_LOOK;
      sim.vu.tTarget.value = sim.targets[idx];
      sim.pu.tTarget.value = sim.targets[idx];
      sim.vu.uSway.value = look.sway;
      sim.vu.uBob.value = look.bob;
      sim.vu.uBobY.value = look.bobY;
      sim.vu.uKickSeed.value = Math.random() * 100;
      for (const m of [sim.core, sim.halo]) {
        m.uniforms.tColor.value = sim.colors[idx];
        m.uniforms.uGlow.value = look.glow;
        m.uniforms.uSize.value = 2.4 * look.size;
      }
      s.kick = 1;
    }
    s.form += (1 - s.form) * (1 - Math.exp(-dt * 1.2));
    s.kick = Math.max(0, s.kick - dt * 1.6);

    // hand position -> world coordinates (z = 0)
    const cam = camera as THREE.PerspectiveCamera;
    const vh = 2 * Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)) * cam.position.z;
    const vw = vh * cam.aspect;
    // camera hand wins; otherwise mouse / touch pushes the snow the same way
    const usePointer = !input.active && input.pointerActive;
    const ax = usePointer ? input.px : input.x;
    const ay = usePointer ? input.py : input.y;
    const hx = (ax - 0.5) * vw;
    const hy = (0.5 - ay) * vh;
    s.hand.lerp(s.goal.set(hx, hy, 0), 1 - Math.exp(-dt * (usePointer ? 18 : 12)));
    if (input.active && want > 0) s.goal.set(hx * 0.3, hy * 0.3, 0);
    else s.goal.set(0, 0, 0);
    s.offset.lerp(s.goal, 1 - Math.exp(-dt * 4));

    const t = clock.elapsedTime;
    sim.vu.uTime.value = t;
    sim.vu.uDelta.value = dt;
    sim.vu.uForm.value = s.form;
    sim.vu.uKick.value = s.kick;
    sim.vu.uLevel.value = input.level;
    sim.vu.uHandActive.value = input.active || input.pointerActive ? 1 : 0;
    (sim.vu.uHand.value as THREE.Vector3).copy(s.hand);
    (sim.vu.uOffset.value as THREE.Vector3).copy(s.offset);
    sim.pu.uDelta.value = dt;
    sim.pu.uForm.value = s.form;

    sim.gpu.compute();

    const tex = sim.gpu.getCurrentRenderTarget(sim.posVar).texture;
    for (const m of [sim.core, sim.halo]) {
      const u = m.uniforms;
      u.tPos.value = tex;
      u.uForm.value = s.form;
      u.uTime.value = t;
      u.uLevel.value = input.level;
      u.uFlash.value = s.kick;
      u.uPixelRatio.value = gl.getPixelRatio();
    }
  });

  return (
    <>
      <points geometry={sim.geometry} material={sim.halo} frustumCulled={false} />
      <points geometry={sim.geometry} material={sim.core} frustumCulled={false} />
    </>
  );
}
