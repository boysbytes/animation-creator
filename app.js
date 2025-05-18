const { useState, useRef, useEffect } = React;



// --- Simple Modal ---
function SimpleModal({ title, onClose, children }) {
  return (
    React.createElement('div', { className: "fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-30" },
      React.createElement('div', { className: "bg-white rounded-lg shadow-lg p-4 min-w-[300px] max-w-[90vw]" },
        React.createElement('div', { className: "flex justify-between items-center mb-2" },
          React.createElement('div', { className: "font-bold" }, title),
          React.createElement('button', {
            onClick: onClose,
            className: "ml-2 px-2 py-1 text-gray-500 hover:text-black"
          }, '✕')
        ),
        children
      )
    )
  );
}


// --- Helper functions for flood fill ---
// ... (same as before; paste your helpers here) ...
function hexToRgba(hex) {
  if (!hex) return { r: 0, g: 0, b: 0, a: 255 };
  const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
  hex = hex.replace(shorthandRegex, (m, r, g, b) => r + r + g + g + b + b);
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
    a: 255
  } : { r: 0, g: 0, b: 0, a: 255 };
}



function getPixelColor(imageData, x, y) {
  if (x < 0 || y < 0 || x >= imageData.width || y >= imageData.height) {
    return { r: -1, g: -1, b: -1, a: -1 };
  }
  const offset = (Math.floor(y) * imageData.width + Math.floor(x)) * 4;
  return {
    r: imageData.data[offset],
    g: imageData.data[offset + 1],
    b: imageData.data[offset + 2],
    a: imageData.data[offset + 3]
  };
}


function setPixelColor(imageData, x, y, color) {
  const offset = (Math.floor(y) * imageData.width + Math.floor(x)) * 4;
  imageData.data[offset] = color.r;
  imageData.data[offset + 1] = color.g;
  imageData.data[offset + 2] = color.b;
  imageData.data[offset + 3] = color.a;
}


function colorsMatch(c1, c2) {
  return c1.r === c2.r && c1.g === c2.g && c1.b === c2.b && c1.a === c2.a;
}

function AnimationCreator() {
  const { useState, useRef, useEffect } = React;

  // ==== State ====
  const [frames, setFrames] = useState([{ id: Date.now(), data: null }]);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [isDrawing, setIsDrawing] = useState(false);
  const [tool, setTool] = useState('pen');
  const [color, setColor] = useState('#000000');
  const [lineWidth, setLineWidth] = useState(5);
  const [isPlaying, setIsPlaying] = useState(false);
  const [fps, setFps] = useState(12);
  const [moveStartPos, setMoveStartPos] = useState({ x: 0, y: 0 });
  const [selectedArea, setSelectedArea] = useState(null);
  const [projectName, setProjectName] = useState('My Animation');
  const [isMobileView, setIsMobileView] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [savedProjects, setSavedProjects] = useState([]);
  const [showLoadModal, setShowLoadModal] = useState(false);

  const canvasRef = useRef(null);
  const canvasWrapperRef = useRef(null);
  const [canvasSize, setCanvasSize] = useState({ width: 600, height: 400 });

  // ==== Responsive breakpoints ====
  useEffect(() => {
    const checkMobileView = () => setIsMobileView(window.innerWidth < 1024);
    checkMobileView();
    window.addEventListener('resize', checkMobileView);
    return () => window.removeEventListener('resize', checkMobileView);
  }, []);

  // ==== Responsive Canvas ====
  useEffect(() => {
    const updateCanvasDimensions = () => {
      if (canvasWrapperRef.current) {
        const rect = canvasWrapperRef.current.getBoundingClientRect();
        let newWidth = rect.width;
        let newHeight = rect.width * (2 / 3);
        if (newHeight > rect.height) {
          newHeight = rect.height;
          newWidth = newHeight * (3 / 2);
        }
        newWidth = Math.max(150, Math.floor(newWidth));
        newHeight = Math.max(100, Math.floor(newHeight));
        const maxDrawingWidth = 1024;
        if (newWidth > maxDrawingWidth) {
          newWidth = maxDrawingWidth;
          newHeight = Math.floor(newWidth * (2 / 3));
        }
        if (canvasSize.width !== newWidth || canvasSize.height !== newHeight) {
          setCanvasSize({ width: newWidth, height: newHeight });
        }
      }
    };
    updateCanvasDimensions();
    let resizeObserver;
    if (canvasWrapperRef.current) {
      resizeObserver = new window.ResizeObserver(updateCanvasDimensions);
      resizeObserver.observe(canvasWrapperRef.current);
    }
    return () => {
      if (resizeObserver && canvasWrapperRef.current) {
        resizeObserver.unobserve(canvasWrapperRef.current);
      }
    };
    // eslint-disable-next-line
  }, []);

  // ==== Draw Frame ====
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (canvas.width !== canvasSize.width || canvas.height !== canvasSize.height) {
      canvas.width = canvasSize.width;
      canvas.height = canvasSize.height;
    }
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (frames[currentFrame] && frames[currentFrame].data) {
      const img = new window.Image();
      img.onload = () => ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      img.onerror = () => {};
      img.src = frames[currentFrame].data;
    }
  }, [currentFrame, frames, canvasSize]);

  // ==== Animation playback ====
  useEffect(() => {
    if (!isPlaying || frames.length === 0) return;
    const intervalId = setInterval(() => {
      setCurrentFrame(prev => (prev + 1) % frames.length);
    }, 1000 / fps);
    return () => clearInterval(intervalId);
  }, [isPlaying, fps, frames.length]);

  // ==== Load saved projects on mount ====
  useEffect(() => {
    try {
      const savedProjectsStr = localStorage.getItem('animationDrawProjects');
      if (savedProjectsStr) setSavedProjects(JSON.parse(savedProjectsStr));
    } catch (error) {}
  }, []);

  // ==== Canvas helpers ====
  const getCanvasCoordinates = (eventClientX, eventClientY) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (eventClientX - rect.left) * scaleX,
      y: (eventClientY - rect.top) * scaleY,
    };
  };

  // ==== Touch events ====
  const handleTouchStart = (e) => {
    const touch = e.touches[0];
    const { x, y } = getCanvasCoordinates(touch.clientX, touch.clientY);
    setIsDrawing(true);
    handleDrawStart(x, y);
  };

  const handleTouchMove = (e) => {
    if (!isDrawing) return;
    const touch = e.touches[0];
    const { x, y } = getCanvasCoordinates(touch.clientX, touch.clientY);
    handleDrawMove(x, y);
  };

  const handleTouchEnd = () => {
    if (isDrawing) {
      setIsDrawing(false);
      handleDrawEnd();
    }
  };

  // ==== Drawing Logic ====
  const handleDrawStart = (x, y) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (tool === 'pen' || tool === 'eraser') {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = tool === 'pen' ? color : '#ffffff';
      ctx.lineWidth = lineWidth;
    } else if (tool === 'fill') {
      floodFill(canvas, Math.round(x), Math.round(y), color);
      handleDrawEnd();
    } else if (tool === 'move') {
      setMoveStartPos({ x, y });
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = canvas.width;
      tempCanvas.height = canvas.height;
      const tempCtx = tempCanvas.getContext('2d');
      tempCtx.drawImage(canvas, 0, 0);
      setSelectedArea(tempCanvas);
    }
  };

  const handleDrawMove = (x, y) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if ((tool === 'pen' || tool === 'eraser') && isDrawing) {
      ctx.lineTo(x, y);
      ctx.stroke();
    } else if (tool === 'move' && selectedArea && isDrawing) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      const offsetX = x - moveStartPos.x;
      const offsetY = y - moveStartPos.y;
      ctx.drawImage(selectedArea, offsetX, offsetY);
    }
  };

  const handleDrawEnd = () => {
    if (tool === 'pen' || tool === 'eraser' || tool === 'move') {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const newFrames = [...frames];
      if (newFrames[currentFrame]) {
        newFrames[currentFrame].data = canvas.toDataURL();
        setFrames(newFrames);
      }
    }
    if (tool === 'move') setSelectedArea(null);
  };

  // ==== Mouse events ====
  const handleMouseDown = (e) => {
    if (e.button !== 0) return;
    setIsDrawing(true);
    const { x, y } = getCanvasCoordinates(e.clientX, e.clientY);
    handleDrawStart(x, y);
  };

  const handleMouseMove = (e) => {
    if (!isDrawing) return;
    const { x, y } = getCanvasCoordinates(e.clientX, e.clientY);
    handleDrawMove(x, y);
  };

  const handleMouseUp = () => {
    if (isDrawing) {
      setIsDrawing(false);
      handleDrawEnd();
    }
  };

  const handleMouseLeave = () => {
    if (isDrawing) {
      setIsDrawing(false);
      handleDrawEnd();
    }
  };

  // ==== Project Save/Load/Delete ====
  const saveProject = () => {
    if (!projectName.trim()) {
      alert("Please enter a project name.");
      return;
    }
    try {
      const projectData = {
        id: Date.now().toString(),
        name: projectName,
        frames: frames,
        date: new Date().toISOString(),
        thumbnail: frames[0]?.data || null
      };
      const currentSavedProjects = JSON.parse(localStorage.getItem('animationDrawProjects') || '[]');
      let updatedProjects = [projectData, ...currentSavedProjects];
      if (updatedProjects.length > 20) updatedProjects = updatedProjects.slice(0, 20);
      localStorage.setItem('animationDrawProjects', JSON.stringify(updatedProjects));
      setSavedProjects(updatedProjects);
      setShowSaveModal(false);
      alert(`Project "${projectName}" saved successfully!`);
    } catch (error) {
      if (error.name === 'QuotaExceededError') {
        alert('Failed to save project: Storage quota exceeded. Please free up some space or manage existing projects.');
      } else {
        alert('Failed to save project. Please try again.');
      }
    }
  };

  const loadProject = (projectToLoad) => {
    setFrames(projectToLoad.frames);
    setCurrentFrame(0);
    setProjectName(projectToLoad.name);
    setFps(projectToLoad.fps || 12);
    setShowLoadModal(false);
    alert(`Project "${projectToLoad.name}" loaded.`);
  };

  const deleteSavedProject = (projectId) => {
    try {
      const updatedProjects = savedProjects.filter(project => project.id !== projectId);
      localStorage.setItem('animationDrawProjects', JSON.stringify(updatedProjects));
      setSavedProjects(updatedProjects);
      alert('Project deleted.');
    } catch (error) {
      alert('Failed to delete project.');
    }
  };

  // ==== Frame Operations ====
  const addFrame = () => {
    const newFrame = { id: Date.now(), data: null };
    const newFrames = [...frames];
    newFrames.splice(currentFrame + 1, 0, newFrame);
    setFrames(newFrames);
    setCurrentFrame(currentFrame + 1);
  };

  const deleteFrame = () => {
    if (frames.length <= 1) {
      alert("Cannot delete the last frame.");
      return;
    }
    const newFrames = frames.filter((_, index) => index !== currentFrame);
    setFrames(newFrames);
    setCurrentFrame(prev => Math.max(0, Math.min(prev, newFrames.length - 1)));
  };

  const duplicateFrame = () => {
    if (!frames[currentFrame]) return;
    const newFrame = { id: Date.now(), data: frames[currentFrame].data };
    const newFrames = [...frames];
    newFrames.splice(currentFrame + 1, 0, newFrame);
    setFrames(newFrames);
    setCurrentFrame(currentFrame + 1);
  };

  const togglePlay = () => setIsPlaying(!isPlaying);

  // ==== Export GIF ====
  const exportGif = () => {
    if (typeof window.GIF === 'undefined') {
      alert('Error: GIF export library is missing. Please ensure GIF.js is included in your project.');
      return;
    }
    try {
      const gif = new window.GIF({
        workers: 2,
        quality: 10,
        width: canvasSize.width,
        height: canvasSize.height,
        workerScript: 'https://cdnjs.cloudflare.com/ajax/libs/gif.js/0.2.0/gif.worker.js'
      });
      frames.forEach(frame => {
        if (frame.data) {
          const img = document.createElement('img');
          img.src = frame.data;
          gif.addFrame(img, { delay: 1000 / fps });
        } else {
          const emptyCanvas = document.createElement('canvas');
          emptyCanvas.width = canvasSize.width;
          emptyCanvas.height = canvasSize.height;
          const ctx = emptyCanvas.getContext('2d');
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvasSize.width, canvasSize.height);
          gif.addFrame(emptyCanvas, { delay: 1000 / fps });
        }
      });
      gif.on('finished', blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${projectName || 'animation'}.gif`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      });
      gif.render();
    } catch (error) {
      alert('Failed to export GIF. Please try again.');
    }
  };

  // ==== Export Video (WebM) ====
  const exportVideo = () => {
    if (typeof window.MediaRecorder === 'undefined') {
      alert('Video recording is not supported in your browser.');
      return;
    }
    try {
      const videoCanvas = document.createElement('canvas');
      videoCanvas.width = canvasSize.width;
      videoCanvas.height = canvasSize.height;
      const ctx = videoCanvas.getContext('2d');
      const stream = videoCanvas.captureStream(fps);
      const recorder = new window.MediaRecorder(stream, { mimeType: 'video/webm' });
      const chunks = [];
      recorder.ondataavailable = e => e.data.size > 0 && chunks.push(e.data);
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${projectName || 'animation'}.webm`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      };
      recorder.start();
      let currentFrameIndex = 0;
      const frameInterval = 1000 / fps;
      const drawNextFrameForVideo = () => {
        if (currentFrameIndex >= frames.length) {
          recorder.stop();
          return;
        }
        const frame = frames[currentFrameIndex];
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, videoCanvas.width, videoCanvas.height);
        if (frame.data) {
          const img = new window.Image();
          img.onload = () => {
            ctx.drawImage(img, 0, 0, videoCanvas.width, videoCanvas.height);
            currentFrameIndex++;
            setTimeout(drawNextFrameForVideo, frameInterval);
          };
          img.onerror = () => {
            currentFrameIndex++;
            setTimeout(drawNextFrameForVideo, frameInterval);
          }
          img.src = frame.data;
        } else {
          currentFrameIndex++;
          setTimeout(drawNextFrameForVideo, frameInterval);
        }
      };
      drawNextFrameForVideo();
    } catch (error) {
      alert('Failed to export video. Please try again or use a different browser.');
    }
  };

  // ==== Flood fill ====
  function floodFill(canvas, startX, startY, newColorHex) {
    const ctx = canvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const targetColor = getPixelColor(imageData, startX, startY);
    const fillColor = hexToRgba(newColorHex);
    if (targetColor.a === -1) return;
    if (colorsMatch(targetColor, fillColor)) return;
    const queue = [[startX, startY]];
    const visited = new Set();
    const getKey = (x, y) => `${x},${y}`;
    while (queue.length > 0) {
      const [px, py] = queue.shift();
      const currentPixelKey = getKey(px, py);
      if (px < 0 || px >= canvas.width || py < 0 || py >= canvas.height || visited.has(currentPixelKey)) continue;
      const pixelColor = getPixelColor(imageData, px, py);
      if (colorsMatch(pixelColor, targetColor)) {
        setPixelColor(imageData, px, py, fillColor);
        visited.add(currentPixelKey);
        queue.push([px + 1, py]);
        queue.push([px - 1, py]);
        queue.push([px, py + 1]);
        queue.push([px, py - 1]);
      }
    }
    ctx.putImageData(imageData, 0, 0);
  }

  // ==== UI ====
  return (
    <div className="flex flex-col h-dvh p-2 sm:p-4 bg-gray-100 font-sans text-gray-800">
      <h1 className="text-xl sm:text-2xl font-bold mb-2 sm:mb-4 text-center">
        Frame Animation Creator
      </h1>
      {/* Workspace */}
      <div className="flex flex-col lg:flex-row flex-1 gap-3 sm:gap-4 overflow-hidden">
        {/* Toolbar */}
        <div className="w-full lg:w-56 flex flex-col gap-4 p-3 bg-white rounded-lg shadow-md order-2 lg:order-1 overflow-y-auto">
          {/* Project Name */}
          <div>
            <label htmlFor="projectName" className="font-semibold text-sm">Project Name</label>
            <input
              type="text"
              id="projectName"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded mt-1 text-sm"
              placeholder="My Animation"
            />
          </div>
          {/* Tools */}
          <div className="flex flex-col gap-2">
            <h2 className="font-semibold text-sm border-b pb-1 mb-1">Tools</h2>
            {['pen', 'eraser', 'fill', 'move'].map(toolName => (
              <button
                key={toolName}
                className={`p-2 rounded text-sm capitalize ${tool === toolName ? 'bg-blue-500 text-white' : 'bg-gray-200 hover:bg-gray-300'}`}
                onClick={() => setTool(toolName)}
              >
                {toolName}
              </button>
            ))}
          </div>
          <div className="flex flex-col gap-1">
            <h2 className="font-semibold text-sm">Color</h2>
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="w-full h-10 rounded border border-gray-300"
            />
          </div>
          <div className="flex flex-col gap-1">
            <h2 className="font-semibold text-sm">Line Width: <span className="font-normal">{lineWidth}px</span></h2>
            <input
              type="range" min="1" max="50" value={lineWidth}
              onChange={(e) => setLineWidth(parseInt(e.target.value))}
              className="w-full"
            />
          </div>
          <div className="flex flex-col gap-1">
            <h2 className="font-semibold text-sm">FPS: <span className="font-normal">{fps}</span></h2>
            <input
              type="range" min="1" max="30" value={fps}
              onChange={(e) => setFps(parseInt(e.target.value))}
              className="w-full"
            />
          </div>
          {/* Save/Load/Export */}
          <div className="flex flex-col gap-2 mt-auto border-t pt-2">
            <h2 className="font-semibold text-sm mb-1">Project</h2>
            <button
              onClick={() => setShowSaveModal(true)}
              className="flex items-center justify-center gap-2 p-2 bg-green-500 text-white rounded hover:bg-green-600 text-sm"
              dangerouslySetInnerHTML={{__html: lucide.createIcon('Save').outerHTML + " Save"}}
            />
            <button
              onClick={() => setShowLoadModal(true)}
              className="flex items-center justify-center gap-2 p-2 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
              dangerouslySetInnerHTML={{__html: lucide.createIcon('Upload').outerHTML + " Load"}}
            />
            <button
              onClick={exportGif}
              className="flex items-center justify-center gap-2 p-2 bg-pink-500 text-white rounded hover:bg-pink-600 text-sm"
              dangerouslySetInnerHTML={{__html: lucide.createIcon('Download').outerHTML + " Export GIF"}}
            />
            <button
              onClick={exportVideo}
              className="flex items-center justify-center gap-2 p-2 bg-yellow-500 text-white rounded hover:bg-yellow-600 text-sm"
              dangerouslySetInnerHTML={{__html: lucide.createIcon('Download').outerHTML + " Export Video"}}
            />
          </div>
        </div>
        {/* Canvas area */}
        <div ref={canvasWrapperRef} className="flex-1 flex flex-col items-center justify-center bg-white rounded-lg shadow-md p-2 relative overflow-hidden order-1 lg:order-2">
          <canvas
            ref={canvasRef}
            width={canvasSize.width}
            height={canvasSize.height}
            style={{ width: "100%", height: "auto", border: "1px solid #ccc", background: "#fff", touchAction: "none" }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseLeave}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          />
          {/* Frame Controls */}
          <div className="flex flex-row gap-2 mt-2">
            <button
              onClick={() => setCurrentFrame(f => Math.max(0, f - 1))}
              className="p-2 bg-gray-200 rounded hover:bg-gray-300"
              dangerouslySetInnerHTML={{__html: lucide.createIcon('ChevronRight').outerHTML.replace('rotate(0 12 12)', 'rotate(180 12 12)')}}
            />
            <span className="text-sm font-semibold flex items-center">
              Frame {currentFrame + 1} / {frames.length}
            </span>
            <button
              onClick={() => setCurrentFrame(f => Math.min(frames.length - 1, f + 1))}
              className="p-2 bg-gray-200 rounded hover:bg-gray-300"
              dangerouslySetInnerHTML={{__html: lucide.createIcon('ChevronRight').outerHTML}}
            />
            <button
              onClick={addFrame}
              className="p-2 bg-blue-200 rounded hover:bg-blue-300"
              dangerouslySetInnerHTML={{__html: lucide.createIcon('Plus').outerHTML}}
            />
            <button
              onClick={duplicateFrame}
              className="p-2 bg-yellow-200 rounded hover:bg-yellow-300"
              dangerouslySetInnerHTML={{__html: lucide.createIcon('Copy').outerHTML}}
            />
            <button
              onClick={deleteFrame}
              className="p-2 bg-red-200 rounded hover:bg-red-300"
              dangerouslySetInnerHTML={{__html: lucide.createIcon('Trash2').outerHTML}}
            />
            <button
              onClick={togglePlay}
              className={`p-2 rounded ${isPlaying ? 'bg-green-200 hover:bg-green-300' : 'bg-gray-200 hover:bg-gray-300'}`}
              dangerouslySetInnerHTML={{__html: lucide.createIcon(isPlaying ? 'Pause' : 'Play').outerHTML}}
            />
          </div>
        </div>
      </div>
      {/* Save Modal */}
      {showSaveModal && React.createElement(SimpleModal, {
        title: "Save Project",
        onClose: () => setShowSaveModal(false)
      }, (
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
      ))}
      {/* Load Modal */}
      {showLoadModal && React.createElement(SimpleModal, {
        title: "Load Project",
        onClose: () => setShowLoadModal(false)
      }, (
        <div className="flex flex-col gap-3">
          {savedProjects.length === 0 && (
            <span className="text-gray-500 text-sm">No saved projects.</span>
          )}
          {savedProjects.map(project => (
            <div key={project.id} className="flex flex-row gap-2 items-center border rounded p-2">
              {project.thumbnail ? (
                <img src={project.thumbnail} alt="" className="w-10 h-10 object-cover rounded border" />
              ) : (
                <div className="w-10 h-10 bg-gray-200 rounded flex items-center justify-center text-xs">No Image</div>
              )}
              <div className="flex-1">
                <div className="font-bold text-sm">{project.name}</div>
                <div className="text-xs text-gray-400">{new Date(project.date).toLocaleString()}</div>
              </div>
              <button onClick={() => loadProject(project)} className="p-1 text-green-700 hover:bg-green-100 rounded"
                dangerouslySetInnerHTML={{__html: lucide.createIcon('Check').outerHTML}}
              />
              <button onClick={() => deleteSavedProject(project.id)} className="p-1 text-red-700 hover:bg-red-100 rounded"
                dangerouslySetInnerHTML={{__html: lucide.createIcon('Trash2').outerHTML}}
              />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}


