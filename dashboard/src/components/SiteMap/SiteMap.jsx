import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Button, Space, Tooltip, Typography, Tag } from 'antd';
import { 
  ZoomInOutlined, 
  ZoomOutOutlined, 
  ReloadOutlined, 
  InfoCircleOutlined,
  CompassOutlined 
} from '@ant-design/icons';
import { selectRobot } from '../../store/slices/uiSlice';
import { CONSTANTS } from '../../utils/constants';
import { STATUS_CONFIG } from '../../utils/statusConfig';

const { Title, Text } = Typography;

// Inner padding in pixels to ensure robot labels, halos, and icons
// are never clipped when robots approach or touch the site boundary.
const INNER_PADDING = 36;
const STAGE_WIDTH = CONSTANTS.SITE_WIDTH + INNER_PADDING * 2;
const STAGE_HEIGHT = CONSTANTS.SITE_HEIGHT + INNER_PADDING * 2;

const MIN_ZOOM = 0.6;
const MAX_ZOOM = 3.0;
const ZOOM_STEP = 0.2;

const SiteMap = () => {
  const canvasRef = useRef(null);
  const viewportRef = useRef(null);
  const robots = useSelector(state => state.fleet.robots);
  const selectedRobotId = useSelector(state => state.ui.selectedRobotId);
  const dispatch = useDispatch();

  const [imagesLoaded, setImagesLoaded] = useState(false);
  const imagesRef = useRef({ picker: null, hauler: null });

  // Zoom & Pan state
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const hasDraggedRef = useRef(false);

  // Load robot icons on mount
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

  // Mouse wheel zoom listener (attached as non-passive to allow e.preventDefault)
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;

    const handleWheel = (e) => {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.15 : 0.87;
      setZoom(prev => {
        const next = Math.round(Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, prev * zoomFactor)) * 100) / 100;
        return next;
      });
    };

    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, []);

  // Zoom control handlers
  const handleZoomIn = () => {
    setZoom(prev => Math.min(MAX_ZOOM, Math.round((prev + ZOOM_STEP) * 10) / 10));
  };

  const handleZoomOut = () => {
    setZoom(prev => Math.max(MIN_ZOOM, Math.round((prev - ZOOM_STEP) * 10) / 10));
  };

  const handleResetZoom = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  // Pan handlers (drag)
  const handleMouseDown = (e) => {
    if (e.button !== 0) return; // Only primary button
    setIsDragging(true);
    hasDraggedRef.current = false;
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      panX: pan.x,
      panY: pan.y,
    };
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    if (Math.hypot(dx, dy) > 4) {
      hasDraggedRef.current = true;
    }
    setPan({
      x: dragStartRef.current.panX + dx,
      y: dragStartRef.current.panY + dy,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Canvas render loop
  useEffect(() => {
    if (!imagesLoaded) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    let animationFrameId;

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      const robotList = Object.values(robots);

      // Render non-selected robots first
      robotList.forEach(robot => {
        if (robot.robot_id === selectedRobotId) return;
        drawRobot(ctx, robot, false);
      });

      // Render selected robot on top
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
    const { status, robot_type, robot_id } = robot;
    // Map robot coordinates with INNER_PADDING offset so edges never clip
    const x = robot.x + INNER_PADDING;
    const y = robot.y + INNER_PADDING;
    
    const color = STATUS_CONFIG[status]?.color || '#ffffff';
    const img = robot_type === 'picker' ? imagesRef.current.picker : imagesRef.current.hauler;
    
    const baseSize = isSelected ? 48 : 36;
    let drawWidth = baseSize;
    let drawHeight = baseSize;

    if (img && img.complete && img.naturalWidth > 0) {
      if (img.naturalWidth > img.naturalHeight) {
        drawHeight = baseSize * (img.naturalHeight / img.naturalWidth);
      } else {
        drawWidth = baseSize * (img.naturalWidth / img.naturalHeight);
      }
    }

    const drawHalfW = drawWidth / 2;
    const drawHalfH = drawHeight / 2;
    const radius = Math.max(drawHalfW, drawHalfH) + 4;

    // Outer glow for selected robot
    if (isSelected) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(x, y, radius + 6, 0, 2 * Math.PI);
      ctx.fillStyle = 'rgba(24, 144, 255, 0.25)';
      ctx.fill();
      ctx.restore();
    }

    // Robot sprite
    if (img && img.complete && img.naturalWidth > 0) {
      ctx.drawImage(img, x - drawHalfW, y - drawHalfH, drawWidth, drawHeight);
    } else {
      ctx.beginPath();
      ctx.arc(x, y, isSelected ? 14 : 10, 0, 2 * Math.PI);
      ctx.fillStyle = color;
      ctx.fill();
    }

    // Status ring
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, 2 * Math.PI);
    ctx.lineWidth = isSelected ? 3.5 : 2;
    ctx.strokeStyle = color;
    ctx.stroke();

    // Robot ID label with high-contrast pill backdrop
    // Smart boundary placement: if near top edge, place label below the robot
    let labelY = y - radius - 5;
    if (labelY < 14) {
      labelY = y + radius + 13;
    }
    const labelX = Math.max(20, Math.min(STAGE_WIDTH - 20, x));

    ctx.save();
    ctx.font = isSelected ? 'bold 13px sans-serif' : 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const textMetrics = ctx.measureText(robot_id);
    const textWidth = textMetrics.width;
    const pillPadding = 4;
    const pillHeight = 16;
    const pillX = labelX - textWidth / 2 - pillPadding;
    const pillY = labelY - pillHeight / 2;
    const pillW = textWidth + pillPadding * 2;
    const pillH = pillHeight;

    // Draw pill background
    ctx.fillStyle = isSelected ? '#1890ff' : 'rgba(18, 18, 18, 0.85)';
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(pillX, pillY, pillW, pillH, 4);
    } else {
      ctx.rect(pillX, pillY, pillW, pillH);
    }
    ctx.fill();

    // Subtle pill border
    ctx.strokeStyle = isSelected ? '#ffffff' : 'rgba(255, 255, 255, 0.25)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Text
    ctx.fillStyle = '#ffffff';
    ctx.fillText(robot_id, labelX, labelY);
    ctx.restore();
  };

  const handleCanvasClick = (e) => {
    // If dragged/panned, do not trigger robot selection
    if (hasDraggedRef.current) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    // Convert click point back to robot site coordinates (subtracting INNER_PADDING)
    const clickX = (e.clientX - rect.left) * scaleX - INNER_PADDING;
    const clickY = (e.clientY - rect.top) * scaleY - INNER_PADDING;

    // Find clicked robot (hit radius 22)
    const clickedRobot = Object.values(robots).find(r => {
      const dx = r.x - clickX;
      const dy = r.y - clickY;
      return Math.hypot(dx, dy) <= 22;
    });

    if (clickedRobot) {
      dispatch(selectRobot(clickedRobot.robot_id));
    } else {
      dispatch(selectRobot(null));
    }
  };

  const robotCount = Object.keys(robots).length;
  const isTransformed = zoom !== 1 || pan.x !== 0 || pan.y !== 0;

  return (
    <div 
      className="panel" 
      style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        gap: '12px',
        padding: '16px',
        height: '100%'
      }}
    >
      {/* Header with Title, Instructions, and Zoom Controls */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        flexWrap: 'wrap', 
        gap: '12px',
        borderBottom: '1px solid var(--border-color)',
        paddingBottom: '12px'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CompassOutlined style={{ color: 'var(--color-mission)', fontSize: '18px' }} />
            <Title level={5} style={{ margin: 0, color: 'var(--text-primary)', letterSpacing: '0.3px' }}>
              Fleet
            </Title>
            <Tag color="blue" style={{ borderRadius: '12px', padding: '0 8px', fontSize: '11px', fontWeight: 500 }}>
              {robotCount} {robotCount === 1 ? 'Robot' : 'Robots'}
            </Tag>
            {selectedRobotId && (
              <Tag 
                closable 
                onClose={() => dispatch(selectRobot(null))}
                color="processing"
                style={{ borderRadius: '12px', padding: '0 8px', fontSize: '11px' }}
              >
                Selected: {selectedRobotId}
              </Tag>
            )}
          </div>
          <Text style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginTop: '4px' }}>
            <b style={{ color: 'var(--color-error)' }}>*Note:</b> Use zoom buttons or scroll to zoom in/out, drag to pan. Click any robot to view details.
          </Text>
        </div>

        {/* Zoom Controls Bar */}
        <Space size="small" style={{ 
          background: 'rgba(255, 255, 255, 0.04)', 
          padding: '4px 8px', 
          borderRadius: '8px', 
          border: '1px solid var(--border-color)' 
        }}>
          <Tooltip title="Zoom Out (or scroll down)">
            <Button 
              size="small" 
              icon={<ZoomOutOutlined />} 
              onClick={handleZoomOut} 
              disabled={zoom <= MIN_ZOOM}
              style={{ backgroundColor: 'transparent', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
            />
          </Tooltip>
          <span style={{ 
            fontSize: '12px', 
            fontWeight: 600, 
            minWidth: '46px', 
            textAlign: 'center', 
            color: 'var(--text-primary)',
            display: 'inline-block' 
          }}>
            {Math.round(zoom * 100)}%
          </span>
          <Tooltip title="Zoom In (or scroll up)">
            <Button 
              size="small" 
              icon={<ZoomInOutlined />} 
              onClick={handleZoomIn} 
              disabled={zoom >= MAX_ZOOM}
              style={{ backgroundColor: 'transparent', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
            />
          </Tooltip>
          <Tooltip title="Reset Zoom & Pan">
            <Button 
              size="small" 
              icon={<ReloadOutlined />} 
              onClick={handleResetZoom}
              disabled={!isTransformed}
              style={{ backgroundColor: 'transparent', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
            >
              Reset
            </Button>
          </Tooltip>
        </Space>
      </div>

      {/* Map Viewport */}
      <div 
        ref={viewportRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{ 
          position: 'relative', 
          width: '100%', 
          height: '590px',
          overflow: 'hidden',
          borderRadius: '8px',
          background: '#131518',
          border: '1px solid var(--border-color)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          cursor: isDragging ? 'grabbing' : zoom > 1 ? 'grab' : 'default',
          userSelect: 'none'
        }}
      >
        {/* Transform Container with Inner Padding Space */}
        <div 
          style={{
            position: 'relative',
            width: STAGE_WIDTH,
            height: STAGE_HEIGHT,
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: 'center center',
            transition: isDragging ? 'none' : 'transform 0.12s ease-out',
            flexShrink: 0,
          }}
        >
          {/* Inner Warehouse Boundary Box with subtle border */}
          <div style={{
            position: 'absolute',
            left: INNER_PADDING,
            top: INNER_PADDING,
            width: CONSTANTS.SITE_WIDTH,
            height: CONSTANTS.SITE_HEIGHT,
            border: '1.5px solid rgba(255, 255, 255, 0.18)',
            borderRadius: '4px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
            overflow: 'hidden'
          }}>
            {/* Background Layout Image */}
            <img 
              src="/layout.png" 
              alt="Warehouse Layout" 
              style={{
                width: '100%',
                height: '100%',
                display: 'block',
                opacity: 0.65,
                pointerEvents: 'none'
              }}
            />
          </div>

          {/* Robot Canvas — spans full stage (including inner padding) */}
          <canvas
            ref={canvasRef}
            width={STAGE_WIDTH}
            height={STAGE_HEIGHT}
            onClick={handleCanvasClick}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: STAGE_WIDTH,
              height: STAGE_HEIGHT,
              cursor: isDragging ? 'grabbing' : 'pointer'
            }}
          />
        </div>

        {/* Floating status & scale helper footer */}
        <div style={{
          position: 'absolute',
          bottom: '10px',
          left: '12px',
          right: '12px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          pointerEvents: 'none'
        }}>
          <div style={{
            background: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(6px)',
            padding: '4px 10px',
            borderRadius: '6px',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            fontSize: '11px',
            color: 'var(--text-secondary)'
          }}>
            900 × 560 units • Inner clearance: {INNER_PADDING}px
          </div>

          {isTransformed && (
            <div 
              style={{
                pointerEvents: 'auto',
                background: 'rgba(24, 144, 255, 0.2)',
                border: '1px solid var(--color-mission)',
                backdropFilter: 'blur(6px)',
                padding: '3px 10px',
                borderRadius: '6px',
                fontSize: '11px',
                color: '#40a9ff',
                cursor: 'pointer'
              }}
              onClick={handleResetZoom}
            >
              Zoom: {Math.round(zoom * 100)}% (Click to reset)
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SiteMap;
