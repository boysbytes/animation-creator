const { useState, useRef, useEffect } = React;
const importInputRef = useRef();


// ----- Constants -----
const SPRITE_SIZE = 32; // Change to 16/64 as desired
const DISPLAY_SIZE = 512; // Canvas shown at this size (for editing)
const DEFAULT_COLORS = [
  '#000000', '#7f7f7f', '#ffffff',
  '#c62828', '#ffb300', '#ffeb3b',
  '#388e3c', '#0288d1', '#6a1b9a'
];

// ----- Utils -----
const blankFrame = () => Array(SPRITE_SIZE * SPRITE_SIZE).fill('#00000000'); // Transparent by default
const getIndex = (x, y) => y * SPRITE_SIZE + x;
const copyFrame = (frame) => [...frame];

// ----- Modal Component -----
function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-30">
      <div className="bg-white rounded-lg shadow-lg p-4 min-w-[300px] max-w-[95vw]">
        <div className="flex justify-between items-center mb-2">
          <span className="font-bold">{title}</span>
          <button onClick={onClose} className="ml-2 px-2 py-1 text-gray-500 hover:text-black">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ----- Main Sprite Editor -----
function SpriteEditor() {
  // --- Animation/Frame State ---
  const [frames, setFrames] = useState([blankFrame()]);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [fps, setFps] = useState(8);

  // --- Drawing State ---
  const [currentColor, setCurrentColor] = useState(DEFAULT_COLORS[0]);
  const [palette, setPalette] = useState(DEFAULT_COLORS);
  const [tool, setTool] = useState('brush'); // brush | eraser | fill
  const [mouseDown, setMouseDown] = useState(false);

  // --- UI State ---
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showLoadModal, setShowLoadModal] = useState(false);
  const [projectName, setProjectName] = useState('My Sprite');
  const [savedProjects, setSavedProjects] = useState([]);
  const [previewScale, setPreviewScale] = useState(3);

  // -- Onion Skin ---
  const [showOnion, setShowOnion] = useState(true); // Onion skin toggle
  const onionAlpha = 0.35; // Opacity for onion skin frames


  // --- Canvas Ref ---
  const canvasRef = useRef();

  // --- Draw frame to canvas ---
  useEffect(() => {
    drawCanvas();
    // eslint-disable-next-line
  }, [frames, currentFrame, previewScale]);

  // --- Animation playback ---
  useEffect(() => {
    if (!isPlaying) return;
    const id = setInterval(() => {
      setCurrentFrame(f => (f + 1) % frames.length);
    }, 1000 / fps);
    return () => clearInterval(id);
  }, [isPlaying, fps, frames.length]);

  // --- Load saved projects on mount ---
  useEffect(() => {
    try {
      const saved = localStorage.getItem('spriteProjects');
      if (saved) setSavedProjects(JSON.parse(saved));
    } catch {}
  }, []);

  // --- Keyboard shortcuts ---
  useEffect(() => {
    function onKeyDown(e) {
      if (e.ctrlKey || e.metaKey) return;
      if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;
      if (e.key === 'ArrowRight') setCurrentFrame(f => Math.min(frames.length - 1, f + 1));
      if (e.key === 'ArrowLeft') setCurrentFrame(f => Math.max(0, f - 1));
      if (e.key.toLowerCase() === 'b') setTool('brush');
      if (e.key.toLowerCase() === 'e') setTool('eraser');
      if (e.key.toLowerCase() === 'f') setTool('fill');
      if (e.key.toLowerCase() === 'd') duplicateFrame();
      if (e.key === ' ') { setIsPlaying(p => !p); e.preventDefault(); }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line
  }, [frames.length, tool]);

  // --- Draw on canvas (helper) ---
function drawCanvas() {
  const canvas = canvasRef.current;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, DISPLAY_SIZE, DISPLAY_SIZE);
  ctx.imageSmoothingEnabled = false;
  const pxSize = DISPLAY_SIZE / SPRITE_SIZE;

  // === Onion skin: Draw previous/next frame under current ===
  if (showOnion && frames.length > 1) {
    // Previous frame (red tint, left side of timeline)
    if (currentFrame > 0) {
      ctx.globalAlpha = onionAlpha;
      drawFrame(ctx, frames[currentFrame - 1], '#ff3333');
    }
    // Next frame (blue tint, right side of timeline)
    if (currentFrame < frames.length - 1) {
      ctx.globalAlpha = onionAlpha;
      drawFrame(ctx, frames[currentFrame + 1], '#3385ff');
    }
    ctx.globalAlpha = 1.0;
  }

  // --- Draw current frame pixels (full opacity, no tint) ---
  drawFrame(ctx, frames[currentFrame]);
  
  // --- Draw grid ---
  ctx.strokeStyle = '#bbb';
  ctx.lineWidth = 1;
  for (let i = 0; i <= SPRITE_SIZE; i++) {
    ctx.beginPath();
    ctx.moveTo(i * pxSize, 0);
    ctx.lineTo(i * pxSize, DISPLAY_SIZE);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i * pxSize);
    ctx.lineTo(DISPLAY_SIZE, i * pxSize);
    ctx.stroke();
  }
}

// Helper: Draw a frame with optional tint
function drawFrame(ctx, frame, tintColor) {
  const pxSize = DISPLAY_SIZE / SPRITE_SIZE;
  for (let y = 0; y < SPRITE_SIZE; y++) {
    for (let x = 0; x < SPRITE_SIZE; x++) {
      let color = frame[getIndex(x, y)] || '#00000000';
      // Don't draw transparent pixels
      if (color.length === 9 && color.endsWith('00')) continue;
      ctx.fillStyle = color;
      ctx.fillRect(x * pxSize, y * pxSize, pxSize, pxSize);
      // Overlay tint for onion skin
      if (tintColor) {
        ctx.fillStyle = tintColor;
        ctx.globalAlpha = 0.15;
        ctx.fillRect(x * pxSize, y * pxSize, pxSize, pxSize);
        ctx.globalAlpha = onionAlpha;
      }
    }
  }
  ctx.globalAlpha = 1.0;
}


  // --- Get pixel position from mouse event ---
  function getPixelPos(e) {
    const rect = canvasRef.current.getBoundingClientRect();
    const scale = SPRITE_SIZE / rect.width;
    let clientX, clientY;
    if (e.touches && e.touches.length) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    const x = Math.floor((clientX - rect.left) * scale);
    const y = Math.floor((clientY - rect.top) * scale);
    return [x, y];
  }


  // --- Draw a pixel ---
  function setPixel(x, y, color) {
    if (x < 0 || x >= SPRITE_SIZE || y < 0 || y >= SPRITE_SIZE) return;
    setFrames(prev => {
      const newFrames = [...prev];
      const newFrame = [...newFrames[currentFrame]];
      newFrame[getIndex(x, y)] = color;
      newFrames[currentFrame] = newFrame;
      return newFrames;
    });
  }

  // --- Mouse/touch drawing handlers ---
  function handleDraw(e) {
    if (!mouseDown) return;
    const [x, y] = getPixelPos(e);
    if (tool === 'brush') setPixel(x, y, currentColor);
    if (tool === 'eraser') setPixel(x, y, '#00000000');
    if (tool === 'fill') fill(x, y, frames[currentFrame][getIndex(x, y)], currentColor);
  }

  function handleDown(e) {
    setMouseDown(true);
    handleDraw(e);
  }
  function handleUp() { setMouseDown(false); }
  function handleMove(e) { if (mouseDown) handleDraw(e); }
  function handleLeave() { setMouseDown(false); }

  // --- Flood Fill (simple iterative, no recursion) ---
  function fill(x, y, targetColor, replacementColor) {
    if (targetColor === replacementColor) return;
    setFrames(prev => {
      const newFrames = [...prev];
      const frame = [...newFrames[currentFrame]];
      const stack = [[x, y]];
      while (stack.length) {
        const [px, py] = stack.pop();
        if (
          px >= 0 && px < SPRITE_SIZE && py >= 0 && py < SPRITE_SIZE &&
          frame[getIndex(px, py)] === targetColor
        ) {
          frame[getIndex(px, py)] = replacementColor;
          stack.push([px + 1, py], [px - 1, py], [px, py + 1], [px, py - 1]);
        }
      }
      newFrames[currentFrame] = frame;
      return newFrames;
    });
  }

  // --- Frame management ---
  function addFrame() {
    const newFrames = [...frames];
    newFrames.splice(currentFrame + 1, 0, blankFrame());
    setFrames(newFrames);
    setCurrentFrame(currentFrame + 1);
  }
  function duplicateFrame() {
    const newFrames = [...frames];
    newFrames.splice(currentFrame + 1, 0, copyFrame(frames[currentFrame]));
    setFrames(newFrames);
    setCurrentFrame(currentFrame + 1);
  }
  function deleteFrame() {
    if (frames.length <= 1) return;
    const newFrames = frames.filter((_, idx) => idx !== currentFrame);
    setFrames(newFrames);
    setCurrentFrame(f => Math.max(0, Math.min(f, newFrames.length - 1)));
  }

  // --- Palette management ---
  function addPaletteColor(color) {
    if (!palette.includes(color)) setPalette([...palette, color]);
  }
  function removePaletteColor(color) {
    if (palette.length > 2) setPalette(palette.filter(c => c !== color));
  }

  // --- Save/Load ---
  function saveProject() {
    if (!projectName.trim()) return alert('Name required!');
    const thumb = renderFrameToDataURL(frames[0], 3);
    const proj = {
      id: Date.now().toString(),
      name: projectName,
      frames,
      palette,
      date: new Date().toISOString(),
      thumbnail: thumb,
      fps
    };
    let saved = [];
    try {
      saved = JSON.parse(localStorage.getItem('spriteProjects') || '[]');
    } catch {}
    const existing = saved.findIndex(p => p.name === projectName);
    if (existing >= 0) saved[existing] = proj;
    else saved.unshift(proj);
    if (saved.length > 20) saved = saved.slice(0, 20);
    localStorage.setItem('spriteProjects', JSON.stringify(saved));
    setSavedProjects(saved);
    setShowSaveModal(false);
    alert('Project saved!');
  }

  function loadProject(project) {
    setFrames(project.frames);
    setCurrentFrame(0);
    setPalette(project.palette || DEFAULT_COLORS);
    setProjectName(project.name);
    setFps(project.fps || 8);
    setShowLoadModal(false);
  }

  function deleteProject(id) {
    if (!window.confirm('Delete this project?')) return;
    const updated = savedProjects.filter(p => p.id !== id);
    localStorage.setItem('spriteProjects', JSON.stringify(updated));
    setSavedProjects(updated);
  }

  // --- Export GIF ---
  function exportGif() {
    if (!window.GIF) {
      alert('GIF.js not loaded!');
      return;
    }
    const gif = new window.GIF({
      workers: 2,
      quality: 10,
      width: SPRITE_SIZE * 3,
      height: SPRITE_SIZE * 3,
      workerScript: 'gif.worker.js'
    });
    frames.forEach(f => {
      const img = new window.Image();
      img.src = renderFrameToDataURL(f, 3);
      gif.addFrame(img, { delay: 1000 / fps, copy: true });
    });
    gif.on('finished', (blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${projectName || 'sprite'}.gif`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
    gif.render();
  }

  // --- Export to File ---
  function exportToFile() {
  const data = {
    name: projectName,
    frames,
    palette,
    fps,
    date: new Date().toISOString()
  };
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `${projectName || 'sprite'}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// --- Import From File ---
function importFromFile(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (event) => {
    try {
      const data = JSON.parse(event.target.result);
      if (!data.frames || !data.palette) throw new Error('Invalid file');
      setFrames(data.frames);
      setPalette(data.palette);
      setProjectName(data.name || 'Imported Sprite');
      setFps(data.fps || 8);
      setCurrentFrame(0);
      alert('Project imported!');
    } catch (err) {
      alert('Error importing file: ' + err.message);
    }
  };
  reader.readAsText(file);
}


  // --- Render frame as data URL (for export and preview) ---
  function renderFrameToDataURL(frame, scale = 1) {
    const s = SPRITE_SIZE * scale;
    const c = document.createElement('canvas');
    c.width = c.height = s;
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    for (let y = 0; y < SPRITE_SIZE; y++) {
      for (let x = 0; x < SPRITE_SIZE; x++) {
        ctx.fillStyle = frame[getIndex(x, y)] || '#00000000';
        ctx.fillRect(x * scale, y * scale, scale, scale);
      }
    }
    return c.toDataURL();
  }

  // --- UI ---
  return (
    <div className="flex flex-col min-h-screen bg-gray-100">
      <h1 className="text-xl sm:text-2xl font-bold mb-2 sm:mb-4 text-center">
        Pixel Art Sprite Editor
      </h1>
      <div className="flex flex-col md:flex-row flex-1 gap-3 sm:gap-4 px-2 pb-4">
        {/* Tools */}
        <div className="w-full md:w-60 flex flex-col gap-4 p-3 bg-white rounded-lg shadow-md order-2 md:order-1 overflow-y-auto">
          {/* Project Name */}
          <div>
            <label className="font-semibold text-sm">Project Name</label>
            <input
              type="text"
              className="w-full p-2 border border-gray-300 rounded mt-1 text-sm"
              value={projectName}
              onChange={e => setProjectName(e.target.value)}
              placeholder="Sprite name"
            />
          </div>
          {/* Tools */}
          <div>
            <h2 className="font-semibold text-sm mb-1">Tools</h2>
            <div className="flex gap-2 mb-1">
              {[
                ['brush', '🖌️'], ['eraser', '🧽'], ['fill', '🪣']
              ].map(([t, icon]) => (
                <button
                  key={t}
                  className={`px-2 py-1 rounded ${tool === t ? 'bg-blue-500 text-white' : 'bg-gray-200 hover:bg-gray-300'}`}
                  onClick={() => setTool(t)}
                  title={t[0].toUpperCase() + t.slice(1)}
                >{icon}</button>
              ))}
            </div>
            <span className="text-xs text-gray-500">
              B: Brush, E: Eraser, F: Fill, D: Duplicate, ←/→: Frames, Space: Play
            </span>
          </div>
          {/* Palette */}
          <div>
            <h2 className="font-semibold text-sm mb-1">Palette</h2>
            <div className="flex flex-wrap gap-1">
              {palette.map(c => (
                <button
                  key={c}
                  className={`w-6 h-6 rounded border-2 ${currentColor === c ? 'border-black' : 'border-gray-300'}`}
                  style={{ background: c }}
                  onClick={() => setCurrentColor(c)}
                  onContextMenu={e => { e.preventDefault(); removePaletteColor(c); }}
                  title={c}
                />
              ))}
              <input
                type="color"
                value={currentColor}
                onChange={e => { setCurrentColor(e.target.value); addPaletteColor(e.target.value); }}
                className="w-6 h-6 p-0 border border-gray-300 rounded"
                title="Pick color"
              />
            </div>
            <span className="text-xs text-gray-500">Right-click swatch to remove.</span>
          </div>
          {/* Animation */}
          <div>
            <h2 className="font-semibold text-sm">Animation</h2>
            <div className="flex items-center gap-2">
              <label className="text-sm">FPS:</label>
              <input
                type="range" min="1" max="24" value={fps}
                onChange={e => setFps(+e.target.value)} />
              <span className="text-xs">{fps}</span>
            </div>
          </div>
          <div>
            <label className="flex items-center gap-2 mt-2 text-sm">
              <input type="checkbox" checked={showOnion} onChange={e => setShowOnion(e.target.checked)} />
              Onion Skin
            </label>
            <span className="text-xs text-gray-500">Shows prev/next frames faintly</span>
          </div>

          {/* Save/Load/Export */}
          <div className="flex flex-col gap-2 border-t pt-2 mt-2">
            <button className="bg-green-500 text-white rounded p-2 hover:bg-green-600" onClick={() => setShowSaveModal(true)}>💾 Save</button>
            <button className="bg-blue-500 text-white rounded p-2 hover:bg-blue-600" onClick={() => setShowLoadModal(true)}>📂 Load</button>
            <button className="bg-pink-500 text-white rounded p-2 hover:bg-pink-600" onClick={exportGif}>🎞️ Export GIF</button>
            <button className="bg-purple-500 text-white rounded p-2 hover:bg-purple-600" onClick={exportToFile}>⬇️ Export File</button>
            <input
              type="file"
              accept=".json"
              style={{ display: 'none' }}
              ref={importInputRef}
              onChange={importFromFile}
            />
            <button
              className="bg-indigo-500 text-white rounded p-2 hover:bg-indigo-600"
              onClick={() => importInputRef.current.click()}
            >
              ⬆️ Import File
            </button>
          </div>
        </div>
        {/* Main Canvas Area */}
        <div className="flex-1 flex flex-col items-center justify-center bg-white rounded-lg shadow-md p-2 order-1 md:order-2">
          {/* Sprite Editing Canvas */}
          <canvas
            ref={canvasRef}
            width={DISPLAY_SIZE}
            height={DISPLAY_SIZE}
            style={{ width: '100%', maxWidth: 512, height: 'auto', touchAction: 'none', background: '#fff', cursor: tool === 'brush' ? 'crosshair' : tool === 'eraser' ? 'not-allowed' : 'cell', imageRendering: 'pixelated' }}
            onMouseDown={handleDown}
            onMouseMove={handleMove}
            onMouseUp={handleUp}
            onMouseLeave={handleLeave}
            onTouchStart={handleDown}
            onTouchMove={handleMove}
            onTouchEnd={handleUp}
            tabIndex={0}
          />
          {/* Frame Controls */}
          <div className="flex gap-1 mt-2 items-center flex-wrap">
            <button className="p-2 bg-gray-200 rounded hover:bg-gray-300" onClick={() => setCurrentFrame(f => Math.max(0, f - 1))}>←</button>
            <span className="font-semibold text-sm">Frame {currentFrame + 1} / {frames.length}</span>
            <button className="p-2 bg-gray-200 rounded hover:bg-gray-300" onClick={() => setCurrentFrame(f => Math.min(frames.length - 1, f + 1))}>→</button>
            <button className="p-2 bg-blue-200 rounded hover:bg-blue-300" onClick={addFrame} title="Add frame">＋</button>
            <button className="p-2 bg-yellow-200 rounded hover:bg-yellow-300" onClick={duplicateFrame} title="Duplicate">⧉</button>
            <button className="p-2 bg-red-200 rounded hover:bg-red-300" onClick={deleteFrame} title="Delete">🗑️</button>
            <button className={`p-2 rounded ${isPlaying ? 'bg-green-300' : 'bg-gray-200'} hover:bg-green-400`} onClick={() => setIsPlaying(p => !p)}>{isPlaying ? '⏸️ Pause' : '▶️ Play'}</button>
          </div>
          {/* Preview */}
          <div className="mt-3 flex flex-col items-center gap-1">
            <div className="flex gap-3">
              <div>
                <div className="text-xs text-gray-600 text-center">1x</div>
                <img src={renderFrameToDataURL(frames[currentFrame], 1)} style={{ width: SPRITE_SIZE * 3, height: SPRITE_SIZE * 3, imageRendering: 'pixelated' }} alt="preview" />
              </div>
              <div>
                <div className="text-xs text-gray-600 text-center">{previewScale}x</div>
                <img src={renderFrameToDataURL(frames[currentFrame], previewScale)} style={{ width: SPRITE_SIZE * 3 * previewScale, height: SPRITE_SIZE * 3 * previewScale, imageRendering: 'pixelated', border: '1px solid #aaa' }} alt="preview" />
              </div>
            </div>
            <div className="flex gap-1 mt-1">
              {[1, 2, 3, 4, 6, 8].map(s =>
                <button key={s} className={`p-1 rounded border ${previewScale === s ? 'border-blue-500' : 'border-gray-200'}`} onClick={() => setPreviewScale(s)}>{s}x</button>
              )}
            </div>
          </div>
        </div>
      </div>
      {/* Save Modal */}
      {showSaveModal &&
        <Modal title="Save Project" onClose={() => setShowSaveModal(false)}>
          <div className="flex flex-col gap-3">
            <label className="text-sm font-semibold">
              Project Name
              <input
                type="text"
                value={projectName}
                onChange={e => setProjectName(e.target.value)}
                className="w-full border border-gray-300 rounded px-2 py-1 mt-1"
              />
            </label>
            <button
              onClick={saveProject}
              className="bg-green-500 text-white rounded p-2 font-semibold hover:bg-green-600"
            >
              Save
            </button>
          </div>
        </Modal>
      }
      {/* Load Modal */}
      {showLoadModal &&
        <Modal title="Load Project" onClose={() => setShowLoadModal(false)}>
          <div className="flex flex-col gap-3 max-h-[60vh] overflow-y-auto">
            {savedProjects.length === 0 &&
              <span className="text-gray-500 text-sm">No saved projects.</span>}
            {savedProjects.map(project => (
              <div key={project.id} className="flex flex-row gap-2 items-center border rounded p-2">
                {project.thumbnail ?
                  <img src={project.thumbnail} alt="" className="w-10 h-10 object-cover rounded border" /> :
                  <div className="w-10 h-10 bg-gray-200 rounded flex items-center justify-center text-xs">No Image</div>}
                <div className="flex-1">
                  <div className="font-bold text-sm">{project.name}</div>
                  <div className="text-xs text-gray-400">{new Date(project.date).toLocaleString()}</div>
                </div>
                <button onClick={() => loadProject(project)} className="p-1 text-green-700 hover:bg-green-100 rounded">✔️</button>
                <button onClick={() => deleteProject(project.id)} className="p-1 text-red-700 hover:bg-red-100 rounded">🗑️</button>
              </div>
            ))}
          </div>
        </Modal>
      }
      {/* Footer */}
      <footer className="w-full text-center text-xs text-gray-400 mt-4 mb-1">
        Pixel Sprite Editor · Mouse/touch to paint · Keyboard: B/E/F/D/←/→/Space
      </footer>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(SpriteEditor));
