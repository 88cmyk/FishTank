import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js";
import { OrbitControls } from "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/controls/OrbitControls.js";

const canvas = document.querySelector("#c");
const toast = document.querySelector("#toast");

function setToast(msg){ if(toast) toast.textContent = msg; }
setToast("Loading 3D...");

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = null;
scene.fog = new THREE.Fog(0x061022, 6, 22);

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 2.2, 7.5);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.enablePan = false;
controls.minDistance = 5;
controls.maxDistance = 12;
controls.maxPolarAngle = Math.PI * 0.48;

// ✅ “보이는지” 즉시 확인용 디버그 오브젝트
scene.add(new THREE.AxesHelper(3));
scene.add(new THREE.GridHelper(8, 8));
const testBox = new THREE.Mesh(
  new THREE.BoxGeometry(0.6, 0.6, 0.6),
  new THREE.MeshBasicMaterial({ color: 0xff00ff })
);
testBox.position.set(0, 0.2, 0);
scene.add(testBox);

const ambient = new THREE.AmbientLight(0xffffff, 0.8);
scene.add(ambient);
const dir = new THREE.DirectionalLight(0xffffff, 1.0);
dir.position.set(4, 6, 2);
scene.add(dir);

// 어항(단순한 박스 형태)
const tankW = 4.4, tankH = 2.8, tankD = 2.6;
const tankFrame = new THREE.Mesh(
  new THREE.BoxGeometry(tankW, tankH, tankD),
  new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.10 })
);
tankFrame.position.y = 0.2;
scene.add(tankFrame);

// 바닥 모래
const sand = new THREE.Mesh(
  new THREE.BoxGeometry(tankW*0.94, tankH*0.18, tankD*0.94),
  new THREE.MeshStandardMaterial({ color: 0xd9c38a, roughness: 0.95 })
);
sand.position.y = 0.2 - tankH*0.41;
scene.add(sand);

// 물고기(로우폴리)
function makeFish(color=0xffd166){
  const g = new THREE.Group();

  const body = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 16, 16),
    new THREE.MeshStandardMaterial({ color, roughness: 0.35 })
  );
  body.scale.set(1.35, 0.85, 0.9);
  g.add(body);

  const tail = new THREE.Mesh(
    new THREE.ConeGeometry(0.16, 0.32, 16),
    new THREE.MeshStandardMaterial({ color: 0xff9f1c, roughness: 0.4 })
  );
  tail.rotation.z = Math.PI/2;
  tail.position.x = -0.33;
  g.add(tail);

  const eye = new THREE.Mesh(
    new THREE.SphereGeometry(0.03, 12, 12),
    new THREE.MeshStandardMaterial({ color: 0x101010 })
  );
  eye.position.set(0.22, 0.05, 0.10);
  g.add(eye);

  g.userData = {
    v: new THREE.Vector3((Math.random()*2-1)*0.015, (Math.random()*2-1)*0.01, (Math.random()*2-1)*0.015),
    t: Math.random()*1000,
  };
  return g;
}

const fishes = [];
const colors = [0xffd166, 0xa0c4ff, 0xcaffbf, 0xffadad, 0xbdb2ff];
for(let i=0;i<6;i++){
  const f = makeFish(colors[i%colors.length]);
  f.position.set((Math.random()*2-1)*1.4, 0.2 + (Math.random()*2-1)*0.7, (Math.random()*2-1)*0.9);
  scene.add(f);
  fishes.push(f);
}

const bounds = {
  x: tankW*0.43,
  yMin: 0.2 - tankH*0.38,
  yMax: 0.2 + tankH*0.30,
  z: tankD*0.40
};
const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));

let mode = "normal";
document.querySelector("#modeFeed").onclick = () => { mode="feed"; setToast("Feed mode: 클릭하면 물고기가 살짝 모여"); };
document.querySelector("#modeDecor").onclick = () => { mode="decor"; setToast("Decor mode: 다음 단계에서 배치 구현"); };
document.querySelector("#modeSave").onclick = () => { setToast("Save: 다음 단계에서 저장 구현"); };

canvas.addEventListener("click", (e)=>{
  if(mode !== "feed") return;
  const rect = canvas.getBoundingClientRect();
  const nx = ((e.clientX-rect.left)/rect.width)*2-1;
  const ny = -(((e.clientY-rect.top)/rect.height)*2-1);

  const ray = new THREE.Raycaster();
  ray.setFromCamera({x:nx,y:ny}, camera);
  const plane = new THREE.Plane(new THREE.Vector3(0,1,0), -0.1);
  const p = new THREE.Vector3();
  ray.ray.intersectPlane(plane, p);

  fishes.forEach((f, idx)=>{
    const dir = p.clone().sub(f.position).multiplyScalar(0.003 + idx*0.0002);
    f.userData.v.add(dir);
  });

  setToast("🍤 feed!");
});

function animate(){
  requestAnimationFrame(animate);
  controls.update();

  fishes.forEach((f)=>{
    f.userData.t += 0.06;
    const wob = Math.sin(f.userData.t)*0.25;

    f.rotation.y = Math.atan2(f.userData.v.x, f.userData.v.z);
    if(f.children[1]) f.children[1].rotation.y = wob;

    f.position.add(f.userData.v);

    f.userData.v.multiplyScalar(0.985);
    f.userData.v.x += (Math.random()*2-1)*0.0006;
    f.userData.v.y += (Math.random()*2-1)*0.0004;
    f.userData.v.z += (Math.random()*2-1)*0.0006;

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
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
});

setToast("Ready");
