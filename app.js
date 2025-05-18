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

// ... All helper functions unchanged ...

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

  // ... All effects and helper logic unchanged ...

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

// All helper functions (hexToRgba, getPixelColor, setPixelColor, colorsMatch, generateSvgString, floodFill, etc.) remain unchanged.
