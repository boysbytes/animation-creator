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
    return { r: -1, g: -1, b: -1, a: -1 }; // Indicate out of bounds
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

// Helper function to generate SVG string from Lucide icon data array
function generateSvgString(iconData) {
  if (!Array.isArray(iconData)) {
    console.error("Invalid icon data format:", iconData);
    return ''; // Return empty string for invalid data
  }

  let svgContent = '';

  iconData.forEach(elementData => {
    if (!Array.isArray(elementData) || elementData.length !== 2) {
      console.warn("Unexpected element data format:", elementData);
      return; // Skip malformed element data
    }

    const elementType = elementData[0]; // e.g., 'path', 'circle'
    const attributes = elementData[1]; // e.g., { d: '...', stroke: '...' }

    let attributeString = '';
    for (const attrName in attributes) {
      // Use hasOwnProperty to ensure we only get object's own properties
      if (Object.prototype.hasOwnProperty.call(attributes, attrName)) {
        // Basic attribute serialization
        attributeString += ` ${attrName}="${attributes[attrName]}"`;
      }
    }

    // Construct the element tag. Assuming common SVG icon elements.
    svgContent += `<${elementType}${attributeString}></${elementType}>`;
  });

  // Wrap the content in an SVG tag with standard Lucide attributes
  const svgAttributes = 'xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';

  return `<svg ${svgAttributes}>${svgContent}</svg>`;
}


function AnimationCreator() {
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
  const [isMobileView, setIsMobileView] = useState(false); // State seems unused in provided UI, but kept
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [savedProjects, setSavedProjects] = useState([]);
  const [showLoadModal, setShowLoadModal] = useState(false);

  const canvasRef = useRef(null);
  const canvasWrapperRef = useRef(null);
  const [canvasSize, setCanvasSize] = useState({ width: 600, height: 400 }); // Initial size

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
        // Maintain 3:2 aspect ratio (common for canvas/animation)
        let newHeight = Math.floor(newWidth * (2 / 3));
        // Ensure canvas fits within wrapper height if needed
        if (newHeight > rect.height) {
          newHeight = rect.height;
          newWidth = Math.floor(newHeight * (3 / 2));
        }

        // Set minimum dimensions
        newWidth = Math.max(150, newWidth);
        newHeight = Math.max(100, newHeight);

        // Set a maximum drawing resolution, independent of display size
        const maxDrawingWidth = 800; // Maximum pixel width for drawing

        // Calculate the target drawing dimensions based on the display size, capped by maxDrawingWidth
        let targetDrawingWidth = Math.min(maxDrawingWidth, Math.floor(newWidth));
        let targetDrawingHeight = Math.floor(targetDrawingWidth * (2/3)); // Maintain aspect ratio for drawing

        // Ensure drawing height doesn't exceed calculated display height (could happen if display is very tall and narrow)
        targetDrawingHeight = Math.min(targetDrawingHeight, Math.floor(newHeight));
        targetDrawingWidth = Math.floor(targetDrawingHeight * (3/2)); // Adjust width based on height cap


        if (canvasSize.width !== targetDrawingWidth || canvasSize.height !== targetDrawingHeight) {
          setCanvasSize({ width: targetDrawingWidth, height: targetDrawingHeight });
        }
      }
    };

    updateCanvasDimensions(); // Call on mount

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasSize.width, canvasSize.height]); // Re-run when canvasSize changes, to potentially cap it


  // ==== Draw Frame ====
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Ensure canvas element dimensions match state
    if (canvas.width !== canvasSize.width || canvas.height !== canvasSize.height) {
      canvas.width = canvasSize.width;
      canvas.height = canvasSize.height;
    }

    const ctx = canvas.getContext('2d');
    // Clear canvas
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw the current frame data
    if (frames[currentFrame] && frames[currentFrame].data) {
      const img = new window.Image();
      img.onload = () => {
          // Clear again before drawing image to ensure no artifacts
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      };
      img.onerror = () => {
          console.error("Failed to load frame image:", frames[currentFrame].data);
      };
      img.src = frames[currentFrame].data;
    }
  }, [currentFrame, frames, canvasSize]); // Depend on currentFrame, frames, and canvasSize

  // ==== Animation playback ====
  useEffect(() => {
    if (!isPlaying || frames.length === 0) return;
    const intervalId = setInterval(() => {
      setCurrentFrame(prev => (prev + 1) % frames.length);
    }, 1000 / fps);
    return () => clearInterval(intervalId);
  }, [isPlaying, fps, frames.length]); // Depend on isPlaying, fps, and frames.length

  // ==== Load saved projects on mount ====
  useEffect(() => {
    try {
      const savedProjectsStr = localStorage.getItem('animationDrawProjects');
      if (savedProjectsStr) setSavedProjects(JSON.parse(savedProjectsStr));
    } catch (error) {
        console.error("Failed to load projects from localStorage:", error);
    }
  }, []); // Run only on mount

  // ==== Canvas helpers ====
  const getCanvasCoordinates = (eventClientX, eventClientY) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    // Calculate scale factor based on *display* size vs *drawing* size
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (eventClientX - rect.left) * scaleX,
      y: (eventClientY - rect.top) * scaleY,
    };
  };

  // ==== Touch events ====
  const handleTouchStart = (e) => {
    if (e.touches.length > 1) return; // Ignore multi-touch
    e.preventDefault(); // Prevent scrolling
    const touch = e.touches[0];
    const { x, y } = getCanvasCoordinates(touch.clientX, touch.clientY);
    setIsDrawing(true);
    handleDrawStart(x, y);
  };

  const handleTouchMove = (e) => {
    if (!isDrawing || e.touches.length > 1) return;
    e.preventDefault(); // Prevent scrolling
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
      ctx.strokeStyle = tool === 'pen' ? color : '#ffffff'; // Eraser draws with white
      ctx.lineWidth = lineWidth;
    } else if (tool === 'fill') {
      // Ensure coordinates are integers for pixel operations
      floodFill(canvas, Math.round(x), Math.round(y), color);
      // Flood fill is a single action, save frame immediately
      handleDrawEnd();
    } else if (tool === 'move') {
      setMoveStartPos({ x, y });
      // Capture current canvas state before moving
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
      // Redraw background and captured area as the "move" happens
      ctx.fillStyle = '#ffffff'; // Clear with background color
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      const offsetX = x - moveStartPos.x;
      const offsetY = y - moveStartPos.y;
      ctx.drawImage(selectedArea, offsetX, offsetY);
    }
  };

  const handleDrawEnd = () => {
    // For pen, eraser, and move, save the frame data after drawing ends
    if (tool === 'pen' || tool === 'eraser' || tool === 'move') {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const newFrames = [...frames];
      if (newFrames[currentFrame]) {
        newFrames[currentFrame].data = canvas.toDataURL();
        setFrames(newFrames);
      }
    }
    // Clear the selected area temporary canvas after move ends
    if (tool === 'move') setSelectedArea(null);
  };

  // ==== Mouse events ====
  const handleMouseDown = (e) => {
    if (e.button !== 0) return; // Only left mouse button
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
    // End drawing if mouse leaves canvas area while drawing
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
        id: Date.now().toString(), // Unique ID
        name: projectName,
        frames: frames,
        date: new Date().toISOString(),
        thumbnail: frames[0]?.data || null // Use first frame as thumbnail
      };

      const currentSavedProjects = JSON.parse(localStorage.getItem('animationDrawProjects') || '[]');

      // Update if ID exists, otherwise add as new.
      let updatedProjects;
      const existingProjectIndex = currentSavedProjects.findIndex(p => p.name === projectName); // Check by name for simplicity

      if (existingProjectIndex > -1) {
          // Update existing project (replace it)
          updatedProjects = [...currentSavedProjects];
          updatedProjects[existingProjectIndex] = projectData;
      } else {
          // Add new project to the beginning
          updatedProjects = [projectData, ...currentSavedProjects];
           // Limit the number of saved projects
           if (updatedProjects.length > 20) { // Keep a max of 20 projects
               updatedProjects = updatedProjects.slice(0, 20);
           }
      }

      localStorage.setItem('animationDrawProjects', JSON.stringify(updatedProjects));
      setSavedProjects(updatedProjects); // Update state to reflect saved projects
      setShowSaveModal(false);
      alert(`Project "${projectName}" saved successfully!`);
    } catch (error) {
      if (error.name === 'QuotaExceededError') {
        alert('Failed to save project: Storage quota exceeded. Please free up some space or manage existing projects.');
      } else {
        alert('Failed to save project. Please try again.');
        console.error("Save project error:", error);
      }
    }
  };

  const loadProject = (projectToLoad) => {
    // Consider clearing current canvas or confirming with user before loading
    setFrames(projectToLoad.frames);
    setCurrentFrame(0); // Start at the first frame
    setProjectName(projectToLoad.name);
    setFps(projectToLoad.fps || 12); // Load FPS, default to 12 if not saved
    setShowLoadModal(false);
    alert(`Project "${projectToLoad.name}" loaded.`);
  };

  const deleteSavedProject = (projectId) => {
    if (window.confirm("Are you sure you want to delete this project?")) {
      try {
        const updatedProjects = savedProjects.filter(project => project.id !== projectId);
        localStorage.setItem('animationDrawProjects', JSON.stringify(updatedProjects));
        setSavedProjects(updatedProjects);
        alert('Project deleted.');
      } catch (error) {
        alert('Failed to delete project.');
        console.error("Delete project error:", error);
      }
    }
  };

  // ==== Frame Operations ====
  const addFrame = () => {
    const newFrame = { id: Date.now(), data: null }; // New frame is initially blank
    const newFrames = [...frames];
    newFrames.splice(currentFrame + 1, 0, newFrame); // Insert after current frame
    setFrames(newFrames);
    setCurrentFrame(currentFrame + 1); // Move to the new frame
  };

  const deleteFrame = () => {
    if (frames.length <= 1) {
      alert("Cannot delete the last frame.");
      return;
    }
    const newFrames = frames.filter((_, index) => index !== currentFrame);
    setFrames(newFrames);
    // Adjust current frame index if the last frame was deleted
    setCurrentFrame(prev => Math.max(0, Math.min(prev, newFrames.length - 1)));
  };

  const duplicateFrame = () => {
    if (!frames[currentFrame]) return;
    // Create a new frame with the data of the current frame
    const newFrame = { id: Date.now(), data: frames[currentFrame].data };
    const newFrames = [...frames];
    newFrames.splice(currentFrame + 1, 0, newFrame); // Insert duplicated frame after current
    setFrames(newFrames);
    setCurrentFrame(currentFrame + 1); // Move to the duplicated frame
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
        workers: 2, // Number of web workers to use
        quality: 10, // Lower is better quality (higher number of colors)
        width: canvasSize.width,
        height: canvasSize.height,
        // Specify the path to the worker script relative to the HTML page
        workerScript: 'https://cdnjs.cloudflare.com/ajax/libs/gif.js/0.2.0/gif.worker.js'
      });

      frames.forEach(frame => {
        if (frame.data) {
          const img = document.createElement('img');
          img.src = frame.data;
          gif.addFrame(img, { delay: 1000 / fps, copy: true }); // Use delay based on FPS
        } else {
          // Add a blank frame if frame data is null
          const emptyCanvas = document.createElement('canvas');
          emptyCanvas.width = canvasSize.width;
          emptyCanvas.height = canvasSize.height;
          const ctx = emptyCanvas.getContext('2d');
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvasSize.width, canvasSize.height);
          gif.addFrame(emptyCanvas, { delay: 1000 / fps, copy: true });
        }
      });

      gif.on('finished', blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${projectName || 'animation'}.gif`; // Default filename
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url); // Clean up
      });

      gif.on('progress', progress => {
         console.log(`GIF rendering progress: ${Math.round(progress * 100)}%`);
         // Could update a UI element here
      });

      gif.on('error', error => {
          console.error("GIF rendering error:", error);
          alert('Failed to export GIF during rendering.');
      });


      gif.render(); // Start the rendering process

    } catch (error) {
      alert('Failed to initialize GIF export. Please try again.');
      console.error("GIF export initialization error:", error);
    }
  };

  // ==== Export Video (WebM) ====
  const exportVideo = () => {
    if (typeof window.MediaRecorder === 'undefined') {
      alert('Video recording is not supported in your browser.');
      return;
    }

    // Need a canvas to record from
    const videoCanvas = document.createElement('canvas');
    videoCanvas.width = canvasSize.width;
    videoCanvas.height = canvasSize.height;
    const ctx = videoCanvas.getContext('2d');

    // Create a stream from the canvas at the desired frame rate
    const stream = videoCanvas.captureStream(fps);
    const recorder = new window.MediaRecorder(stream, { mimeType: 'video/webm' });

    const chunks = [];
    recorder.ondataavailable = e => {
      if (e.data.size > 0) {
        chunks.push(e.data);
      }
    };

    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${projectName || 'animation'}.webm`; // Default filename
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url); // Clean up
      console.log('Video export finished.');
    };

    recorder.onerror = (event) => {
        console.error("MediaRecorder error:", event.error);
        alert("Error occurred during video recording.");
    };


    recorder.start(); // Start recording

    let currentFrameIndex = 0;
    const frameInterval = 1000 / fps; // Time in ms for each frame

    const drawNextFrameForVideo = () => {
      if (currentFrameIndex >= frames.length) {
        recorder.stop(); // Stop recording when all frames are drawn
        return;
      }

      const frame = frames[currentFrameIndex];
      // Draw frame to the recording canvas
      ctx.fillStyle = '#ffffff'; // Clear with background color
      ctx.fillRect(0, 0, videoCanvas.width, videoCanvas.height);

      if (frame.data) {
        const img = new window.Image();
        img.onload = () => {
          ctx.drawImage(img, 0, 0, videoCanvas.width, videoCanvas.height);
          currentFrameIndex++;
          // Schedule drawing the next frame after the correct interval
          setTimeout(drawNextFrameForVideo, frameInterval);
        };
        img.onerror = () => {
          console.error("Failed to load frame image for video export:", frame.data);
          // Still advance to the next frame even if image fails to load
          currentFrameIndex++;
          setTimeout(drawNextFrameForVideo, frameInterval);
        }
        img.src = frame.data;
      } else {
        // If frame has no data, just draw a blank frame and move to next
        currentFrameIndex++;
        setTimeout(drawNextFrameForVideo, frameInterval);
      }
    };

    // Start the process of drawing frames for the video
    drawNextFrameForVideo();

  };

  // ==== Flood fill implementation ====
  function floodFill(canvas, startX, startY, newColorHex) {
    const ctx = canvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const targetColor = getPixelColor(imageData, startX, startY);
    const fillColor = hexToRgba(newColorHex);

    // If start pixel is out of bounds or target color matches fill color, do nothing
    if (targetColor.a === -1 || colorsMatch(targetColor, fillColor)) {
      return;
    }

    const queue = [[startX, startY]];
    const visited = new Set(); // Use a Set to track visited pixels efficiently
    const getKey = (x, y) => `${x},${y}`; // Helper to create a unique key for visited set

    while (queue.length > 0) {
      const [px, py] = queue.shift(); // Get the next pixel from the front of the queue

      // Check bounds and if already visited
      if (px < 0 || px >= canvas.width || py < 0 || py >= canvas.height || visited.has(getKey(px, py))) {
        continue;
      }

      const pixelColor = getPixelColor(imageData, px, py);

      // If the pixel's color matches the target color
      if (colorsMatch(pixelColor, targetColor)) {
        setPixelColor(imageData, px, py, fillColor); // Set the pixel to the fill color
        visited.add(getKey(px, py)); // Mark as visited

        // Add neighboring pixels to the queue
        queue.push([px + 1, py]);
        queue.push([px - 1, py]);
        queue.push([px, py + 1]);
        queue.push([px, py - 1]);
      }
    }

    // Put the modified image data back onto the canvas
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
              dangerouslySetInnerHTML={{__html: generateSvgString(lucide.icons['Save']) + " Save"}}
            />
            <button
              onClick={() => setShowLoadModal(true)}
              className="flex items-center justify-center gap-2 p-2 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
              dangerouslySetInnerHTML={{__html: generateSvgString(lucide.icons['Upload']) + " Load"}}
            />
            <button
              onClick={exportGif}
              className="flex items-center justify-center gap-2 p-2 bg-pink-500 text-white rounded hover:bg-pink-600 text-sm"
              dangerouslySetInnerHTML={{__html: generateSvgString(lucide.icons['Download']) + " Export GIF"}}
            />
            <button
              onClick={exportVideo}
              className="flex items-center justify-center gap-2 p-2 bg-yellow-500 text-white rounded hover:bg-yellow-600 text-sm"
              dangerouslySetInnerHTML={{__html: generateSvgString(lucide.icons['Download']) + " Export Video"}}
            />
          </div>
        </div>
        {/* Canvas area (SINGLE instance) */}
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
              dangerouslySetInnerHTML={{__html: generateSvgString(lucide.icons['ChevronRight']).replace('rotate(0 12 12)', 'rotate(180 12 12)')}}
            />
            <span className="text-sm font-semibold flex items-center">
              Frame {currentFrame + 1} / {frames.length}
            </span>
            <button
              onClick={() => setCurrentFrame(f => Math.min(frames.length - 1, f + 1))}
              className="p-2 bg-gray-200 rounded hover:bg-gray-300"
              dangerouslySetInnerHTML={{__html: generateSvgString(lucide.icons['ChevronRight'])}}
            />
            <button
              onClick={addFrame}
              className="p-2 bg-blue-200 rounded hover:bg-blue-300"
              dangerouslySetInnerHTML={{__html: generateSvgString(lucide.icons['Plus'])}}
            />
            <button
              onClick={duplicateFrame}
              className="p-2 bg-yellow-200 rounded hover:bg-yellow-300"
              dangerouslySetInnerHTML={{__html: generateSvgString(lucide.icons['Copy'])}}
            />
            <button
              onClick={deleteFrame}
              className="p-2 bg-red-200 rounded hover:bg-red-300"
              dangerouslySetInnerHTML={{__html: generateSvgString(lucide.icons['Trash2'])}}
            />
            <button
              onClick={togglePlay}
              className={`p-2 rounded ${isPlaying ? 'bg-green-200 hover:bg-green-300' : 'bg-gray-200 hover:bg-gray-300'}`}
              dangerouslySetInnerHTML={{__html: generateSvgString(lucide.icons[isPlaying ? 'Pause' : 'Play'])}}
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
                dangerouslySetInnerHTML={{__html: generateSvgString(lucide.icons['Check'])}}
              />
              <button onClick={() => deleteSavedProject(project.id)} className="p-1 text-red-700 hover:bg-red-100 rounded"
                dangerouslySetInnerHTML={{__html: generateSvgString(lucide.icons['Trash2'])}}
              />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(AnimationCreator));
