import React, { useEffect, useRef, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { selectRobot } from '../../store/slices/uiSlice';
import { CONSTANTS } from '../../utils/constants';
import { STATUS_CONFIG } from '../../utils/statusConfig';

const SiteMap = () => {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const robots = useSelector(state => state.fleet.robots);
  const selectedRobotId = useSelector(state => state.ui.selectedRobotId);
  const dispatch = useDispatch();

  const [imagesLoaded, setImagesLoaded] = useState(false);
  const imagesRef = useRef({ picker: null, hauler: null });

  // Load images once on mount
  useEffect(() => {
    let loadedCount = 0;
    const checkLoaded = () => {
      loadedCount++;
      if (loadedCount === 2) setImagesLoaded(true);
    };

    const imgPicker = new Image();
    imgPicker.src = '/forklift.png';
    imgPicker.onload = checkLoaded;
    imgPicker.onerror = () => {
      console.error("Failed to load forklift.png");
      checkLoaded();
    };

    const imgHauler = new Image();
    imgHauler.src = '/hauler.png';
    imgHauler.onload = checkLoaded;
    imgHauler.onerror = () => {
      console.error("Failed to load hauler.png");
      checkLoaded();
    };

    imagesRef.current.picker = imgPicker;
    imagesRef.current.hauler = imgHauler;
  }, []);

  useEffect(() => {
    if (!imagesLoaded) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    let animationFrameId;

    const render = () => {
      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // We use CSS background for layout.png, so we only draw robots here.
      
      const robotList = Object.values(robots);

      // Render non-selected robots first
      robotList.forEach(robot => {
        if (robot.robot_id === selectedRobotId) return;
        drawRobot(ctx, robot, false);
      });

      // Render selected robot last (on top)
      if (selectedRobotId && robots[selectedRobotId]) {
        drawRobot(ctx, robots[selectedRobotId], true);
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [robots, selectedRobotId, imagesLoaded]);

  const drawRobot = (ctx, robot, isSelected) => {
    const { x, y, status, robot_type, robot_id } = robot;
    const color = STATUS_CONFIG[status]?.color || '#ffffff';
    
    // Choose image based on robot_type (picker -> forklift.png, hauler -> hauler.png)
    const img = robot_type === 'picker' ? imagesRef.current.picker : imagesRef.current.hauler;
    
    const size = isSelected ? 32 : 24; // Base size
    const half = size / 2;

    if (img && img.complete && img.naturalWidth > 0) {
      // Preserve aspect ratio
      const baseSize = isSelected ? 48 : 36;
      let drawWidth = baseSize;
      let drawHeight = baseSize;
      
      if (img.naturalWidth > img.naturalHeight) {
        drawHeight = baseSize * (img.naturalHeight / img.naturalWidth);
      } else {
        drawWidth = baseSize * (img.naturalWidth / img.naturalHeight);
      }

      const drawHalfW = drawWidth / 2;
      const drawHalfH = drawHeight / 2;

      // Draw image
      ctx.drawImage(img, x - drawHalfW, y - drawHalfH, drawWidth, drawHeight);
      
      // Draw a colored ring around it to indicate status
      const radius = Math.max(drawHalfW, drawHalfH) + 4;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, 2 * Math.PI);
      ctx.lineWidth = isSelected ? 3 : 2;
      ctx.strokeStyle = color;
      ctx.stroke();

      // Draw ID label above the robot
      ctx.fillStyle = '#000000';
      ctx.font = isSelected ? 'bold 14px Arial' : '12px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(robot_id, x, y - radius - 4);
    } else {
      // Fallback if image fails to load
      ctx.beginPath();
      ctx.arc(x, y, isSelected ? 12 : 8, 0, 2 * Math.PI);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.lineWidth = isSelected ? 3 : 1;
      ctx.strokeStyle = isSelected ? '#ffffff' : '#000000';
      ctx.stroke();

      // Always draw ID label above the robot
      ctx.fillStyle = '#000000';
      ctx.font = isSelected ? 'bold 14px Arial' : '12px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(robot_id, x, y - (isSelected ? 12 : 8) - 4);
    }
  };

  const handleCanvasClick = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    const clickX = (e.clientX - rect.left) * scaleX;
    const clickY = (e.clientY - rect.top) * scaleY;

    // Find clicked robot (hit radius 16)
    const clickedRobot = Object.values(robots).find(r => {
      const dx = r.x - clickX;
      const dy = r.y - clickY;
      return Math.sqrt(dx * dx + dy * dy) <= 16;
    });

    if (clickedRobot) {
      dispatch(selectRobot(clickedRobot.robot_id));
    } else {
      dispatch(selectRobot(null));
    }
  };

  return (
    <div 
      ref={containerRef}
      className="panel" 
      style={{ 
        position: 'relative', 
        width: '100%', 
        overflow: 'hidden',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '600px'
      }}
    >
      <div style={{
        position: 'relative',
        width: CONSTANTS.SITE_WIDTH,
        height: CONSTANTS.SITE_HEIGHT,
        maxWidth: '100%',
        maxHeight: '100%',
        boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
      }}>
        {/* Background Map Image */}
        <img 
          src="/layout.png" 
          alt="Site Map" 
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            opacity: 0.6,
            pointerEvents: 'none'
          }}
        />
        {/* Robot Canvas */}
        <canvas
          ref={canvasRef}
          width={CONSTANTS.SITE_WIDTH}
          height={CONSTANTS.SITE_HEIGHT}
          onClick={handleCanvasClick}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            cursor: 'pointer'
          }}
        />
      </div>
    </div>
  );
};

export default SiteMap;
