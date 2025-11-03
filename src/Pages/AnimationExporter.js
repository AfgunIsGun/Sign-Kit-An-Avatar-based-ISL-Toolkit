import React, { useState, useRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';

const AnimationExporter = () => {
  const [animations, setAnimations] = useState([]);
  const [selectedAnimation, setSelectedAnimation] = useState(null);
  const [exportedData, setExportedData] = useState('');
  const [fileName, setFileName] = useState('');
  const mixer = useRef(null);
  const model = useRef(null);
  const clock = useRef(new THREE.Clock());

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      setFileName(file.name.replace('.glb', ''));
      const reader = new FileReader();
      reader.onload = (e) => {
        const loader = new GLTFLoader();
        loader.parse(e.target.result, '', (gltf) => {
          model.current = gltf.scene;
          setAnimations(gltf.animations);
          if (gltf.animations.length > 0) {
            mixer.current = new THREE.AnimationMixer(model.current);
            setSelectedAnimation(gltf.animations[0]);
          }
        });
      };
      reader.readAsArrayBuffer(file);
    }
  };

  const exportPose = () => {
    if (!model.current || !selectedAnimation) {
      return;
    }

    mixer.current.stopAllAction();
    const action = mixer.current.clipAction(selectedAnimation);
    action.play();

    // This is a bit of a hack. We need to advance the animation to the desired frame.
    // Here we are just taking the pose at the start of the animation.
    // A more complete solution would have a slider to select the frame.
    mixer.current.update(0.1); 
    
    let output = `export const ${fileName.toUpperCase()} = (ref) => {\n\n`;
    output += `    let animations = []\n\n`;

    model.current.traverse((child) => {
      if (child.isBone) {
        const rotation = child.rotation;
        if (rotation.x !== 0) {
            output += `    animations.push(["${child.name}", "rotation", "x", ${rotation.x.toFixed(4)}, "${rotation.x > 0 ? '+' : '-'}"]);\n`;
        }
        if (rotation.y !== 0) {
            output += `    animations.push(["${child.name}", "rotation", "y", ${rotation.y.toFixed(4)}, "${rotation.y > 0 ? '+' : '-'}"]);\n`;
        }
        if (rotation.z !== 0) {
            output += `    animations.push(["${child.name}", "rotation", "z", ${rotation.z.toFixed(4)}, "${rotation.z > 0 ? '+' : '-'}"]);\n`;
        }
      }
    });

    output += `\n    ref.animations.push(animations);\n\n`;
    output += `    if(ref.pending === false){\n`;
    output += `        ref.pending = true;\n`;
    output += `        ref.animate();\n`;
    output += `    }\n\n`;
    output += `}\n`;


    setExportedData(output);
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
      <h1>Animation Exporter</h1>
      <p>Import a .glb model to export its animations.</p>
      <div className="mb-3">
        <input className="form-control" type="file" accept=".glb" onChange={handleFileChange} />
      </div>
      {animations.length > 0 && (
        <div className="mb-3">
          <select className="form-select" onChange={(e) => setSelectedAnimation(animations[e.target.value])}>
            {animations.map((anim, index) => (
              <option key={anim.name} value={index}>{anim.name}</option>
            ))}
          </select>
        </div>
      )}
      <button className="btn btn-primary" onClick={exportPose} disabled={!model.current}>Export Pose</button>
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

export default AnimationExporter;