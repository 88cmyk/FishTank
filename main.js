import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js";
import { OrbitControls } from "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/controls/OrbitControls.js";

const canvas = document.querySelector("#c");
const toast = document.querySelector("#toast");

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x061022, 4, 18);

const camera = new THREE.PerspectiveCamera(45, window.innerWidth/window.innerHeight, 0.1, 100);
camera.position.set(0, 2.2, 7.5);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.enablePan = false;
controls.minDistance = 5;
controls.maxDistance = 11;
controls.maxPolarAngle = Math.PI * 0.48;

function addLights(){
  const a = new THREE.AmbientLight(0xffffff, 0.55);
  scene.add(a);

  const key = new THREE.DirectionalLight(0xffffff, 0.9);
  key.position.set(4, 6, 2);
  scene.add(key);

  const fill = new THREE.PointLight(0x5ad1e6, 0.9, 30);
  fill.position.set(-3, 2, 3);
  scene.add(fill);
}
addLights();

// 바닥(테이블 느낌)
const floor = new THREE.Mesh(
  new THREE.CircleGeometry(6, 64),
  new THREE.MeshStandardMaterial({ color: 0x0b1426, roughness: 0.95, metalness: 0.0 })
);
floor.rotation.x = -Math.PI/2;
floor.position.y = -1.2;
scene.add(floor);

const glass = new THREE.Mesh(
  new THREE.BoxGeometry(tankW, tankH, tankD),
  new THREE.MeshStandardMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.15,
  })
);

const water = new THREE.Mesh(
  new THREE.BoxGeometry(tankW*0.97, tankH*0.88, tankD*0.97),
  new THREE.MeshStandardMaterial({
    color: 0x1aa6b8,
    transparent: true,
    opacity: 0.25,
  })
);

// 모래
const sand = new THREE.Mesh(
  new THREE.BoxGeometry(tankW*0.94, tankH*0.18, tankD*0.94),
  new THREE.MeshStandardMaterial({ color: 0xd9c38a, roughness: 0.95 })
);
sand.position.y = 0.2 - tankH*0.41;
scene.add(sand);

// 물고기(도형 기반 로우폴리)
function makeFish(color=0xffd166){
  const group = new THREE.Group();

  const body = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 16, 16),
    new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.0 })
  );
  body.scale.set(1.35, 0.85, 0.9);
  group.add(body);

  const tail = new THREE.Mesh(
    new THREE.ConeGeometry(0.16, 0.32, 16),
    new THREE.MeshStandardMaterial({ color: 0xff9f1c, roughness: 0.4 })
  );
  tail.rotation.z = Math.PI/2;
  tail.position.x = -0.33;
  group.add(tail);

  const fin = new THREE.Mesh(
    new THREE.ConeGeometry(0.09, 0.18, 12),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.65, transparent:true, opacity:0.55 })
  );
  fin.rotation.z = -Math.PI/2;
  fin.position.set(0.05, 0.02, 0.12);
  group.add(fin);

  // 눈
  const eye = new THREE.Mesh(
    new THREE.SphereGeometry(0.03, 12, 12),
    new THREE.MeshStandardMaterial({ color: 0x101010 })
  );
  eye.position.set(0.22, 0.05, 0.10);
  group.add(eye);

  // 움직임 파라미터
  group.userData = {
    v: new THREE.Vector3((Math.random()*2-1)*0.015, (Math.random()*2-1)*0.01, (Math.random()*2-1)*0.015),
    t: Math.random()*1000,
  };

  return group;
}

const fishes = [];
const colors = [0xffd166, 0xa0c4ff, 0xcaffbf, 0xffadad, 0xbdb2ff];
for(let i=0;i<6;i++){
  const f = makeFish(colors[i%colors.length]);
  f.position.set((Math.random()*2-1)*1.4, 0.2 + (Math.random()*2-1)*0.7, (Math.random()*2-1)*0.9);
  scene.add(f);
  fishes.push(f);
}

function clamp(v, a, b){ return Math.max(a, Math.min(b, v)); }

// 탱크 내부 bounds
const bounds = {
  x: tankW*0.43,
  yMin: 0.2 - tankH*0.38,
  yMax: 0.2 + tankH*0.30,
  z: tankD*0.40
};

let mode = "normal";
document.querySelector("#modeFeed").onclick = () => { mode="feed"; toast.textContent="Feed mode: 클릭하면 먹이(효과)"; };
document.querySelector("#modeDecor").onclick = () => { mode="decor"; toast.textContent="Decor mode: 다음 단계에서 배치 구현"; };
document.querySelector("#modeSave").onclick = () => { toast.textContent="Save: (다음 단계) 배치/상태 저장"; };

canvas.addEventListener("click", (e)=>{
  if(mode !== "feed") return;
  // 먹이 느낌: 클릭 위치 근처로 물고기들이 살짝 모이게 목표점 생성
  const rect = canvas.getBoundingClientRect();
  const nx = ((e.clientX-rect.left)/rect.width)*2-1;
  const ny = -(((e.clientY-rect.top)/rect.height)*2-1);
  const ray = new THREE.Raycaster();
  ray.setFromCamera({x:nx,y:ny}, camera);

  // 물 plane을 가정하고 교차점 계산(대충 y=0.1 부근)
  const plane = new THREE.Plane(new THREE.Vector3(0,1,0), -0.1);
  const p = new THREE.Vector3();
  ray.ray.intersectPlane(plane, p);

  fishes.forEach((f, idx)=>{
    const dir = p.clone().sub(f.position).multiplyScalar(0.003 + idx*0.0002);
    f.userData.v.add(dir);
  });

  toast.textContent = "🍤 feed!";
});

function animate(){
  requestAnimationFrame(animate);
  controls.update();

  // 물 살짝 흔들리는 느낌
  const t = performance.now()*0.001;
  water.material.opacity = 0.50 + Math.sin(t*1.2)*0.03;

  // 물고기 이동 + 꼬리 흔들기
  fishes.forEach((f)=>{
    f.userData.t += 0.06;
    const wob = Math.sin(f.userData.t)*0.25;

    // heading
    f.rotation.y = Math.atan2(f.userData.v.x, f.userData.v.z);
    // tail wag (tail is child #1)
    if(f.children[1]) f.children[1].rotation.y = wob;

    // move
    f.position.add(f.userData.v);

    // 부드러운 감속 + 랜덤 워블
    f.userData.v.multiplyScalar(0.985);
    f.userData.v.x += (Math.random()*2-1)*0.0006;
    f.userData.v.y += (Math.random()*2-1)*0.0004;
    f.userData.v.z += (Math.random()*2-1)*0.0006;

    // bounds bounce
    f.position.x = clamp(f.position.x, -bounds.x, bounds.x);
    f.position.y = clamp(f.position.y, bounds.yMin, bounds.yMax);
    f.position.z = clamp(f.position.z, -bounds.z, bounds.z);

    if(Math.abs(f.position.x) >= bounds.x) f.userData.v.x *= -0.9;
    if(f.position.y <= bounds.yMin || f.position.y >= bounds.yMax) f.userData.v.y *= -0.9;
    if(Math.abs(f.position.z) >= bounds.z) f.userData.v.z *= -0.9;
  });

  renderer.render(scene, camera);
}
animate();

window.addEventListener("resize", ()=>{
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth/window.innerHeight;
  camera.updateProjectionMatrix();

});

