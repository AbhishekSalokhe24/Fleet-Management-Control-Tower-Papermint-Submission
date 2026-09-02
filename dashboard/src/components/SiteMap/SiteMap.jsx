import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Button, Space, Tooltip, Typography, Tag, Select, Segmented } from 'antd';
import { 
  ZoomInOutlined, 
  ZoomOutOutlined, 
  ReloadOutlined, 
  InfoCircleOutlined,
  CompassOutlined,
  FilterOutlined,
  EyeOutlined,
  EyeInvisibleOutlined,
  AppstoreOutlined,
  AlertOutlined,
  WarningOutlined,
  CheckCircleOutlined,
  ThunderboltOutlined,
  DotChartOutlined,
  PictureOutlined 
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
const MAX_ZOOM = 3.5;
const ZOOM_STEP = 0.25;

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

  // Large Fleet / LOD Visualization Controls
  // viewMode: 'auto' (switches to dots on high density/zoom-out), 'dots' (always compact dots), 'detailed' (always full sprites)
  const [viewMode, setViewMode] = useState('auto');
  // labelMode: 'auto' (labels only on zoom >= 1.6 or hover/selected), 'always' (show all), 'none' (hide all except selected)
  const [labelMode, setLabelMode] = useState('auto');
  // statusFilter: 'all', 'critical', 'attention', 'working', 'low_battery'
  const [statusFilter, setStatusFilter] = useState('all');

  // Hover state
  const [hoveredRobot, setHoveredRobot] = useState(null);
  const [hoverPos, setHoverPos] = useState({ x: 0, y: 0 });

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
    setZoom(prev => Math.min(MAX_ZOOM, Math.round((prev + ZOOM_STEP) * 100) / 100));
  };

  const handleZoomOut = () => {
    setZoom(prev => Math.max(MIN_ZOOM, Math.round((prev - ZOOM_STEP) * 100) / 100));
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
    if (isDragging) {
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;
      if (Math.hypot(dx, dy) > 4) {
        hasDraggedRef.current = true;
      }
      setPan({
        x: dragStartRef.current.panX + dx,
        y: dragStartRef.current.panY + dy,
      });
      setHoveredRobot(null);
      return;
    }

    // Hit-test on mouse hover to show tooltip
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    const mouseX = (e.clientX - rect.left) * scaleX - INNER_PADDING;
    const mouseY = (e.clientY - rect.top) * scaleY - INNER_PADDING;

    // Detect closest robot within hover radius
    const hitRadius = zoom >= 1.6 ? 24 : 14;
    const hit = Object.values(robots).find(r => Math.hypot(r.x - mouseX, r.y - mouseY) <= hitRadius);

    if (hit) {
      setHoveredRobot(hit);
      setHoverPos({ x: e.clientX, y: e.clientY });
    } else {
      setHoveredRobot(null);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseLeave = () => {
    setIsDragging(false);
    setHoveredRobot(null);
  };

  // Determine whether to use compact dot representation
  const robotCount = Object.keys(robots).length;
  const isDotMode = useMemo(() => {
    if (viewMode === 'dots') return true;
    if (viewMode === 'detailed') return false;
    // 'auto' mode: switch to dots if fleet is dense and not zoomed in
    return robotCount > 35 && zoom < 1.6;
  }, [viewMode, robotCount, zoom]);

  // Determine whether to display labels for a given robot
  const shouldShowLabel = useCallback((robotId, isSelected, isHovered) => {
    if (isSelected || isHovered) return true;
    if (labelMode === 'none') return false;
    if (labelMode === 'always') return true;
    // 'auto' mode: only show all labels if zoomed in or small fleet
    return zoom >= 1.6 || robotCount <= 35;
  }, [labelMode, zoom, robotCount]);

  // Check if robot matches the active status filter
  const matchesFilter = useCallback((robot) => {
    if (statusFilter === 'all') return true;
    if (statusFilter === 'critical') return robot.status === 'error' || robot.status === 'offline';
    if (statusFilter === 'attention') return robot.status === 'blocked' || robot.status === 'maintenance';
    if (statusFilter === 'working') return robot.status === 'active' || robot.status === 'on_mission';
    if (statusFilter === 'low_battery') return (robot.battery || 0) < 20;
    return robot.status === statusFilter;
  }, [statusFilter]);

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
      const hoveredId = hoveredRobot?.robot_id;

      // Draw non-selected and non-hovered robots first
      for (let i = 0; i < robotList.length; i++) {
        const robot = robotList[i];
        if (robot.robot_id === selectedRobotId || robot.robot_id === hoveredId) continue;
        drawRobot(ctx, robot, false, false);
      }

      // Draw hovered robot on top
      if (hoveredId && robots[hoveredId] && hoveredId !== selectedRobotId) {
        drawRobot(ctx, robots[hoveredId], false, true);
      }

      // Draw selected robot on topmost layer
      if (selectedRobotId && robots[selectedRobotId]) {
        drawRobot(ctx, robots[selectedRobotId], true, hoveredId === selectedRobotId);
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [robots, selectedRobotId, hoveredRobot, imagesLoaded, isDotMode, labelMode, statusFilter, zoom]);

  const drawRobot = (ctx, robot, isSelected, isHovered) => {
    const { status, robot_type, robot_id } = robot;
    const x = robot.x + INNER_PADDING;
    const y = robot.y + INNER_PADDING;
    
    const color = STATUS_CONFIG[status]?.color || '#ffffff';
    const isFiltered = !matchesFilter(robot);
    
    // Save context for opacity filter
    ctx.save();
    if (isFiltered) {
      ctx.globalAlpha = 0.15; // Dim non-matching robots
    }

    // ─────────────────────────────────────────────────────────────
    // 1. COMPACT DOT / SWARM MODE (For 100 - 1000+ robots)
    // ─────────────────────────────────────────────────────────────
    if (isDotMode && !isSelected && !isHovered) {
      const dotRadius = robotCount > 300 ? 4 : (robotCount > 100 ? 5 : 6.5);
      
      // Highlight critical issues with subtle outer glow
      if (status === 'error' || status === 'offline' || robot.battery < 20) {
        ctx.beginPath();
        ctx.arc(x, y, dotRadius + 3.5, 0, 2 * Math.PI);
        ctx.fillStyle = 'rgba(255, 77, 79, 0.4)';
        ctx.fill();
      } else if (status === 'blocked') {
        ctx.beginPath();
        ctx.arc(x, y, dotRadius + 2.5, 0, 2 * Math.PI);
        ctx.fillStyle = 'rgba(250, 140, 22, 0.35)';
        ctx.fill();
      }

      // Shape: Hauler is small rounded box, Picker/Forklift is circle
      ctx.beginPath();
      if (robot_type === 'hauler') {
        const half = dotRadius;
        if (ctx.roundRect) {
          ctx.roundRect(x - half, y - half, half * 2, half * 2, 2);
        } else {
          ctx.rect(x - half, y - half, half * 2, half * 2);
        }
      } else {
        ctx.arc(x, y, dotRadius, 0, 2 * Math.PI);
      }
      ctx.fillStyle = color;
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.stroke();

      // If user enabled 'always' labels, render tiny label
      if (shouldShowLabel(robot_id, isSelected, isHovered)) {
        renderLabelPill(ctx, robot_id, x, y, dotRadius, false);
      }

      ctx.restore();
      return;
    }

    // ─────────────────────────────────────────────────────────────
    // 2. DETAILED SPRITE MODE (Or Selected / Hovered in Dot Mode)
    // ─────────────────────────────────────────────────────────────
    const img = robot_type === 'picker' ? imagesRef.current.picker : imagesRef.current.hauler;
    const baseSize = isSelected ? 48 : (isHovered ? 40 : 34);
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

    // Outer glow for selected or hovered
    if (isSelected || isHovered) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(x, y, radius + (isSelected ? 7 : 4), 0, 2 * Math.PI);
      ctx.fillStyle = isSelected ? 'rgba(24, 144, 255, 0.35)' : 'rgba(255, 255, 255, 0.2)';
      ctx.fill();
      ctx.restore();
    }

    // Draw robot sprite
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
    ctx.lineWidth = isSelected ? 3.5 : (isHovered ? 2.5 : 2);
    ctx.strokeStyle = isHovered ? '#ffffff' : color;
    ctx.stroke();

    // Render Label if enabled or selected/hovered
    if (shouldShowLabel(robot_id, isSelected, isHovered)) {
      renderLabelPill(ctx, robot_id, x, y, radius, isSelected, isHovered);
    }

    ctx.restore();
  };

  const renderLabelPill = (ctx, robot_id, x, y, radius, isSelected, isHovered) => {
    // Smart boundary placement: if near top edge, place label below the robot
    let labelY = y - radius - 5;
    if (labelY < 14) {
      labelY = y + radius + 13;
    }
    const labelX = Math.max(20, Math.min(STAGE_WIDTH - 20, x));

    ctx.save();
    ctx.font = isSelected 
      ? 'bold 13px sans-serif' 
      : (isHovered ? 'bold 12px sans-serif' : 'bold 10px sans-serif');
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const textMetrics = ctx.measureText(robot_id);
    const textWidth = textMetrics.width;
    const pillPadding = 4;
    const pillHeight = isSelected ? 17 : 15;
    const pillX = labelX - textWidth / 2 - pillPadding;
    const pillY = labelY - pillHeight / 2;
    const pillW = textWidth + pillPadding * 2;
    const pillH = pillHeight;

    // Background pill
    ctx.fillStyle = isSelected 
      ? '#1890ff' 
      : (isHovered ? 'rgba(30, 30, 30, 0.95)' : 'rgba(18, 18, 18, 0.85)');
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(pillX, pillY, pillW, pillH, 4);
    } else {
      ctx.rect(pillX, pillY, pillW, pillH);
    }
    ctx.fill();

    // Subtle border
    ctx.strokeStyle = isSelected 
      ? '#ffffff' 
      : (isHovered ? '#1890ff' : 'rgba(255, 255, 255, 0.25)');
    ctx.lineWidth = 1;
    ctx.stroke();

    // Text
    ctx.fillStyle = '#ffffff';
    ctx.fillText(robot_id, labelX, labelY);
    ctx.restore();
  };

  const handleCanvasClick = (e) => {
    if (hasDraggedRef.current) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    const clickX = (e.clientX - rect.left) * scaleX - INNER_PADDING;
    const clickY = (e.clientY - rect.top) * scaleY - INNER_PADDING;

    // Find clicked robot (wider hit radius for easy clicking even in dot mode)
    const hitRadius = isDotMode ? 16 : 24;
    const clickedRobot = Object.values(robots).find(r => {
      const dx = r.x - clickX;
      const dy = r.y - clickY;
      return Math.hypot(dx, dy) <= hitRadius;
    });

    if (clickedRobot) {
      dispatch(selectRobot(clickedRobot.robot_id));
    } else {
      dispatch(selectRobot(null));
    }
  };

  const isTransformed = zoom !== 1 || pan.x !== 0 || pan.y !== 0;

  // Calculate status counts for quick filter dropdown
  const statusCounts = useMemo(() => {
    const counts = { all: robotCount, critical: 0, attention: 0, working: 0, low_battery: 0 };
    for (const r of Object.values(robots)) {
      if (r.status === 'error' || r.status === 'offline') counts.critical++;
      if (r.status === 'blocked' || r.status === 'maintenance') counts.attention++;
      if (r.status === 'active' || r.status === 'on_mission') counts.working++;
      if ((r.battery || 0) < 20) counts.low_battery++;
    }
    return counts;
  }, [robots, robotCount]);

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
      {/* Header Section with Title, Notes, and Multi-Tool Control Bar */}
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column',
        gap: '10px',
        borderBottom: '1px solid var(--border-color)',
        paddingBottom: '12px'
      }}>
        {/* Top Header Row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <CompassOutlined style={{ color: 'var(--color-mission)', fontSize: '18px' }} />
              <Title level={5} style={{ margin: 0, color: 'var(--text-primary)', letterSpacing: '0.3px' }}>
                Fleet
              </Title>
              <Tag color="blue" style={{ borderRadius: '12px', padding: '0 8px', fontSize: '11px', fontWeight: 500 }}>
                {robotCount} {robotCount === 1 ? 'Robot' : 'Robots'}
              </Tag>
              {robotCount > 40 && (
                <Tag color={isDotMode ? 'cyan' : 'default'} style={{ borderRadius: '12px', padding: '0 8px', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  {isDotMode ? <><DotChartOutlined /> Swarm Dot Mode</> : <><PictureOutlined /> Detailed Sprites</>}
                </Tag>
              )}
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

        {/* Second Row: Large-Fleet Optimization Controls (Density, Labels, Status Filter) */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
          <Space size="middle" style={{ flexWrap: 'wrap' }}>
            {/* Status Filter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <FilterOutlined style={{ color: 'var(--text-secondary)', fontSize: '12px' }} />
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Filter:</span>
              <Select
                size="small"
                value={statusFilter}
                onChange={setStatusFilter}
                style={{ width: 170 }}
                options={[
                  { 
                    value: 'all', 
                    label: (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        <AppstoreOutlined style={{ color: 'var(--color-mission)' }} />
                        <span>All Robots ({statusCounts.all})</span>
                      </span>
                    ) 
                  },
                  { 
                    value: 'critical', 
                    label: (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        <AlertOutlined style={{ color: 'var(--color-error)' }} />
                        <span>Critical ({statusCounts.critical})</span>
                      </span>
                    ) 
                  },
                  { 
                    value: 'attention', 
                    label: (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        <WarningOutlined style={{ color: 'var(--color-blocked)' }} />
                        <span>Attention ({statusCounts.attention})</span>
                      </span>
                    ) 
                  },
                  { 
                    value: 'working', 
                    label: (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        <CheckCircleOutlined style={{ color: 'var(--color-active)' }} />
                        <span>Working ({statusCounts.working})</span>
                      </span>
                    ) 
                  },
                  { 
                    value: 'low_battery', 
                    label: (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        <ThunderboltOutlined style={{ color: 'var(--color-charging)' }} />
                        <span>Low Battery ({statusCounts.low_battery})</span>
                      </span>
                    ) 
                  },
                ]}
              />
            </div>

            {/* View Mode Toggle */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <AppstoreOutlined style={{ color: 'var(--text-secondary)', fontSize: '12px' }} />
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Display:</span>
              <Segmented
                size="small"
                value={viewMode}
                onChange={setViewMode}
                options={[
                  { label: 'Auto (LOD)', value: 'auto' },
                  { label: 'Dots (Swarm)', value: 'dots' },
                  { label: 'Sprites', value: 'detailed' },
                ]}
              />
            </div>

            {/* Labels Mode Toggle */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              {labelMode === 'none' ? <EyeInvisibleOutlined style={{ color: 'var(--text-secondary)', fontSize: '12px' }} /> : <EyeOutlined style={{ color: 'var(--text-secondary)', fontSize: '12px' }} />}
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Labels:</span>
              <Segmented
                size="small"
                value={labelMode}
                onChange={setLabelMode}
                options={[
                  { label: 'Auto', value: 'auto' },
                  { label: 'Hidden', value: 'none' },
                  { label: 'Always', value: 'always' },
                ]}
              />
            </div>
          </Space>

          {statusFilter !== 'all' && (
            <Button size="small" type="link" onClick={() => setStatusFilter('all')} style={{ padding: 0, fontSize: '12px' }}>
              Clear Filter
            </Button>
          )}
        </div>
      </div>

      {/* Map Viewport Container */}
      <div 
        ref={viewportRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
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
          cursor: isDragging ? 'grabbing' : (hoveredRobot ? 'pointer' : (zoom > 1 ? 'grab' : 'default')),
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
              cursor: isDragging ? 'grabbing' : (hoveredRobot ? 'pointer' : 'default')
            }}
          />
        </div>

        {/* Hover Inspect Tooltip Card */}
        {hoveredRobot && !isDragging && (
          <div style={{
            position: 'fixed',
            left: hoverPos.x + 14,
            top: hoverPos.y - 14,
            zIndex: 1000,
            pointerEvents: 'none',
            background: 'rgba(20, 20, 24, 0.94)',
            backdropFilter: 'blur(8px)',
            border: '1px solid var(--border-color)',
            boxShadow: '0 6px 18px rgba(0,0,0,0.6)',
            borderRadius: '6px',
            padding: '8px 12px',
            fontSize: '12px',
            minWidth: '150px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <span style={{ fontWeight: 700, color: '#fff', fontSize: '13px' }}>
                {hoveredRobot.robot_id}
              </span>
              <Tag 
                color={STATUS_CONFIG[hoveredRobot.status]?.color} 
                style={{ color: '#000', fontWeight: 600, fontSize: '10px', margin: 0 }}
              >
                {STATUS_CONFIG[hoveredRobot.status]?.label || hoveredRobot.status}
              </Tag>
            </div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '11px', lineHeight: '1.4' }}>
              <div>Type: <span style={{ color: '#fff' }}>{hoveredRobot.robot_type === 'picker' ? 'Forklift' : 'Hauler'}</span></div>
              <div>Battery: <span style={{ color: hoveredRobot.battery < 20 ? 'var(--color-error)' : '#fff' }}>{Math.round(hoveredRobot.battery)}%</span></div>
              <div>Pos: X {Math.round(hoveredRobot.x)}, Y {Math.round(hoveredRobot.y)}</div>
            </div>
          </div>
        )}

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
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              {isDotMode ? <DotChartOutlined /> : <PictureOutlined />}
              <span>{isDotMode ? 'Swarm Dot View' : 'Full Detail View'} • {robotCount} units • {INNER_PADDING}px clearance</span>
            </span>
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
