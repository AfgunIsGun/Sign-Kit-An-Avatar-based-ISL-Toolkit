import React, { useState, useEffect, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";

const AnimationCombiner = () => {
  const [animations, setAnimations] = useState([]);
  const [model, setModel] = useState(null);
  const [exportedData, setExportedData] = useState('');
  const [fileName, setFileName] = useState('');
  const [combinationList, setCombinationList] = useState([]);
  const [selectedAnimation, setSelectedAnimation] = useState(null);
  const mountRef = useRef(null);
  const scene = useRef(new THREE.Scene());
  const camera = useRef(new THREE.PerspectiveCamera(75, 500 / 400, 0.1, 1000));
  const renderer = useRef(new THREE.WebGLRenderer({ antialias: true }));
  const controls = useRef(null);
  const mixer = useRef(null);

  useEffect(() => {
    const mount = mountRef.current;
    renderer.current.setSize(500, 400);
    mount.appendChild(renderer.current.domElement);
    
    scene.current.background = new THREE.Color(0xdddddd);
    camera.current.position.z = 5;

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.current.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(0, 1, 1);
    scene.current.add(directionalLight);

    controls.current = new OrbitControls(camera.current, renderer.current.domElement);

    const clock = new THREE.Clock();
    const animate = () => {
      requestAnimationFrame(animate);
      if (mixer.current) {
        mixer.current.update(clock.getDelta());
      }
      controls.current.update();
      renderer.current.render(scene.current, camera.current);
    };
    animate();

    return () => {
      mount.removeChild(renderer.current.domElement);
    };
  }, []);

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      setFileName(file.name.replace('.glb', ''));
      const reader = new FileReader();
      reader.onload = (e) => {
        const loader = new GLTFLoader();
        loader.parse(e.target.result, "", (gltf) => {
          const loadedModel = gltf.scene;
          setAnimations(gltf.animations);

          // Clear previous model
          if (model) {
            scene.current.remove(model);
          }

          // Center and scale the new model
          const box = new THREE.Box3().setFromObject(loadedModel);
          const center = box.getCenter(new THREE.Vector3());
          const size = box.getSize(new THREE.Vector3());
          const maxDim = Math.max(size.x, size.y, size.z);
          const scale = 5 / maxDim;
          loadedModel.scale.set(scale, scale, scale);
          loadedModel.position.sub(center.multiplyScalar(scale));

          scene.current.add(loadedModel);
          setModel(loadedModel);

          if (gltf.animations.length > 0) {
            mixer.current = new THREE.AnimationMixer(loadedModel);
          }
        });
      };
      reader.readAsArrayBuffer(file);
    }
  };

  const handleAnimationFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const loader = new GLTFLoader();
        loader.parse(e.target.result, "", (gltf) => {
          setAnimations([...animations, ...gltf.animations]);
        });
      };
      reader.readAsArrayBuffer(file);
    }
  };

  const formatRadian = (radian) => {
    if (Math.abs(radian) < 0.0001) return "0";

    const tolerance = 0.001;
    const sign = radian < 0 ? "-" : "";
    const absRad = Math.abs(radian);

    const fractions = {
        "Math.PI": Math.PI,
        "Math.PI/2": Math.PI / 2,
        "Math.PI/3": Math.PI / 3,
        "Math.PI/4": Math.PI / 4,
        "Math.PI/6": Math.PI / 6,
        "Math.PI/8": Math.PI / 8,
        "Math.PI/9": Math.PI / 9,
        "Math.PI/10": Math.PI / 10,
        "Math.PI/12": Math.PI / 12,
        "Math.PI/18": Math.PI / 18,
        "Math.PI/36": Math.PI / 36,
        "Math.PI/72": Math.PI / 72,
    };

    for (const [str, val] of Object.entries(fractions)) {
        if (Math.abs(absRad - val) < tolerance) {
            return sign + str;
        }
    }

    return radian.toFixed(4);
  };

  const exportPose = () => {
    if (!model) {
      return;
    }
    
    let output = `export const ${fileName.toUpperCase()} = (ref) => {\n\n`;
    output += `    let animations = []\n\n`;

    model.traverse((child) => {
      if (child.isBone) {
        const rotation = child.rotation;
        
        const generateLine = (axis, value) => {
            if (Math.abs(value) < 0.0001) return; 
            
            const formattedValue = formatRadian(value);
            const signChar = value >= 0 ? '+' : '-';
            output += `    animations.push(["${child.name}", "rotation", "${axis}", ${formattedValue}, "${signChar}"]);\n`;
        };

        generateLine("x", rotation.x);
        generateLine("y", rotation.y);
        generateLine("z", rotation.z);
      }
    });

    output += `\n    ref.animations.push(animations);\n\n`;
    output += `    if(ref.pending === false){
`;
    output += `        ref.pending = true;
`;
    output += `        ref.animate();
`;
    output += `    }\n\n`;
    output += `}\n`;

    setExportedData(output);
  };

  const playAnimation = (clip) => {
    if (!model || !mixer.current) return;

    mixer.current.stopAllAction();

    const action = mixer.current.clipAction(clip);
    action.play();
    setSelectedAnimation(clip);
  };

  const combineAnimations = () => {
    if (combinationList.length < 2) return;

    const clips = combinationList;
    let totalDuration = 0;
    const newTracks = [];

    for (const clip of clips) {
      for (const originalTrack of clip.tracks) {
        const newValues = originalTrack.values.slice();
        const newTimes = originalTrack.times.slice().map(t => t + totalDuration);
        const newTrack = new originalTrack.constructor(originalTrack.name, newTimes, newValues);
        newTracks.push(newTrack);
      }
      totalDuration += clip.duration;
    }

    const combinedClip = new THREE.AnimationClip("combined", totalDuration, newTracks);
    
    setAnimations([...animations, combinedClip]);
    setCombinationList([]);
  };

  const handleDownload = () => {
    const element = document.createElement("a");
    const file = new Blob([exportedData], {type: 'text/javascript'});
    element.href = URL.createObjectURL(file);
    element.download = `${fileName.toUpperCase()}.js`;
    document.body.appendChild(element); // Required for Firefox
    element.click();
    document.body.removeChild(element); // Clean up
  };

  return (
    <div className="container mt-5 pt-5">
      <h1>Animation Combiner</h1>
      <div className="row">
        <div className="col-md-8">
          <div ref={mountRef} style={{ width: "500px", height: "400px" }}></div>
        </div>
        <div className="col-md-4">
          <input type="file" accept=".glb" onChange={handleFileChange} />
          <h5 className="mt-3">Import Animations</h5>
          <input type="file" accept=".glb" onChange={handleAnimationFileChange} />
          <h3 className="mt-3">Animations</h3>
          <ul className="list-group">
            {animations.map((anim) => (
              <li key={anim.name} className="list-group-item d-flex justify-content-between align-items-center">
                {anim.name}
                <div>
                  <button className="btn btn-sm btn-info me-2" onClick={() => playAnimation(anim)}>Play</button>
                  <button className="btn btn-sm btn-success" onClick={() => setCombinationList([...combinationList, anim])}>Add</button>
                </div>
              </li>
            ))}
          </ul>
          <h3 className="mt-3">Combination</h3>
          <ul className="list-group">
            {combinationList.map((anim, index) => (
              <li key={`${anim.name}-${index}`} className="list-group-item">
                {anim.name}
              </li>
            ))}
          </ul>
          <button className="btn btn-primary mt-2" onClick={combineAnimations} disabled={combinationList.length < 2}>Combine Animations</button>
          <button className="btn btn-primary mt-3" onClick={exportPose} disabled={!model}>Export Pose</button>
        </div>
      </div>
      {exportedData && (
        <div className="mt-3">
          <h3>Exported Data</h3>
          <textarea className="form-control" rows="10" value={exportedData} readOnly />
          <button className="btn btn-secondary mt-2 me-2" onClick={() => navigator.clipboard.writeText(exportedData)}>Copy to Clipboard</button>
          <button className="btn btn-success mt-2" onClick={handleDownload}>Download as .js</button>
        </div>
      )}
    </div>
  );
};

export default AnimationCombiner;