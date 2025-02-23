import type { FC } from '../../lib/teact/teact';
import React, { useEffect, useMemo, useRef } from '../../lib/teact/teact';
import { requestMutation } from '../../lib/fasterdom/fasterdom';
import { fastRaf } from '../../util/schedulers';

import './WebGLBackground.scss';
import { maskImages } from '../left/settings/helpers/patterns';

export const DEFAULT_PATTERN = 'animals';
export const DEFAULT_PATTERN_SIZE = 420;
export const DEFAULT_GRADIENT = {
  color1: '#fec496',
  color2: '#dd6cb9',
  color3: '#962fbf',
  color4: '#4f5bd5',
};

const KEY_POINTS = [
  [0.265, 0.582],
  [0.176, 0.918],
  [0.415, 0.836],
  [0.644, 0.755],
  [0.735, 0.418],
  [0.824, 0.082],
  [0.585, 0.164],
  [0.356, 0.245],
];

interface BackgroundState {
  keyShift: number;
  color1Pos: number[];
  color2Pos: number[];
  color3Pos: number[];
  color4Pos: number[];
  targetColor1Pos: number[];
  targetColor2Pos: number[];
  targetColor3Pos: number[];
  targetColor4Pos: number[];
}

const vertexShaderSrc = `
  attribute vec2 position;
  void main() {
    gl_Position = vec4(position, 0, 1);
  }
`;

const fragmentShaderSrc = `
  precision mediump float;
  uniform vec2 uResolution;
  uniform float uTime;
  uniform vec3 color1;
  uniform vec3 color2;
  uniform vec3 color3;
  uniform vec3 color4;
  uniform vec2 color1Pos;
  uniform vec2 color2Pos;
  uniform vec2 color3Pos;
  uniform vec2 color4Pos;

  void main() {
    vec2 st = gl_FragCoord.xy / uResolution;
    float d1 = distance(st, color1Pos);
    float d2 = distance(st, color2Pos);
    float d3 = distance(st, color3Pos);
    float d4 = distance(st, color4Pos);
    
    float total = 1.0 / (d1 * d1) + 1.0 / (d2 * d2) + 1.0 / (d3 * d3) + 1.0 / (d4 * d4);
    
    vec3 color = (color1 / (d1 * d1) + color2 / (d2 * d2) + color3 / (d3 * d3) + color4 / (d4 * d4)) / total;
    
    gl_FragColor = vec4(color, 1.0);
  }
`;

function createProgram(gl: WebGLRenderingContext, vertexShaderSrc: string, fragmentShaderSrc: string) {
  const program = gl.createProgram()!;
  const vertexShader = gl.createShader(gl.VERTEX_SHADER)!;
  const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER)!;

  gl.shaderSource(vertexShader, vertexShaderSrc);
  gl.compileShader(vertexShader);
  if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
    console.error('Vertex shader compilation failed:', gl.getShaderInfoLog(vertexShader));
    return null;
  }

  gl.shaderSource(fragmentShader, fragmentShaderSrc);
  gl.compileShader(fragmentShader);
  if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
    console.error('Fragment shader compilation failed:', gl.getShaderInfoLog(fragmentShader));
    return null;
  }

  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error('Unable to initialize the shader program:', gl.getProgramInfoLog(program));
    return null;
  }

  return program;
}

export function loadShaders(
  gl: WebGLRenderingContext,
  shaderSources: [vertexShader: string, fragmentShader: string]
): readonly [WebGLShader, WebGLShader] {
  const [vertexShader, fragmentShader] = shaderSources
  return [
    loadShader(gl, vertexShader, gl.VERTEX_SHADER),
    loadShader(gl, fragmentShader, gl.FRAGMENT_SHADER)
  ] as const
}

function loadShader(
  gl: WebGLRenderingContext,
  shaderSource: string,
  shaderType: number
): WebGLShader {
  const shader = gl.createShader(shaderType)!
  gl.shaderSource(shader, shaderSource)
  gl.compileShader(shader)
  gl.getShaderParameter(shader, gl.COMPILE_STATUS)
  return shader
}

export function hexToVec3(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return [r, g, b];
}

export type Pattern = {
  maskImage?: string;
  size?: number;
  patternColor?: string;
  gradient?: {
    color1: string;
    color2: string;
    color3: string;
    color4: string;
  };
};

type OwnProps = {
  pattern: Pattern;
}

const WebGLBackground: FC<OwnProps> = ({
  pattern = {
    maskImage: DEFAULT_PATTERN,
    size: DEFAULT_PATTERN_SIZE,
    patternColor: '#000000',
    gradient: DEFAULT_GRADIENT,
  },
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const glRef = useRef<WebGLRenderingContext | null>(null);
  const animationFrameRef = useRef<number>();

  const colorEntries = useMemo(() => {
    return Object.entries(pattern.gradient ?? DEFAULT_GRADIENT)
  }, [pattern]);

  const colors = useMemo(() => {
    return Object.fromEntries(
      colorEntries.map(([key, value]) => [key, hexToVec3(value)])
    ) as {
      color1: [number, number, number];
      color2: [number, number, number];
      color3: [number, number, number];
      color4: [number, number, number];
    }
  }, [colorEntries]);

  // Handle canvas resize and initial setup
  useEffect(() => {
    let gl: WebGLRenderingContext | null = null;
    let program: WebGLProgram | null = null;
    let vertexBuffer: WebGLBuffer | null = null;

    const setupWebGL = () => {
      if (!canvasRef.current) return;

      const canvas = canvasRef.current;
      gl = canvas.getContext('webgl', { antialias: true });
      if (!gl) {
        console.error('WebGL not supported');
        return;
      }
      glRef.current = gl;

      // Vertex buffer setup
      const vertices = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);
      vertexBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

      // Shader program
      program = createProgram(gl, vertexShaderSrc, fragmentShaderSrc);
      if (!program) return;
      gl.useProgram(program);

      // Attribute/uniform locations
      const positionLocation = gl.getAttribLocation(program, 'position');
      gl.enableVertexAttribArray(positionLocation);
      gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
    };

    const handleResize = () => {
      fastRaf(() => {
        if (!containerRef.current || !canvasRef.current || !gl || !program) return;

        const canvas = canvasRef.current;
        const container = containerRef.current;
        const rect = container.getBoundingClientRect();

        const dpr = window.devicePixelRatio || 1;
        const width = rect.width * dpr;
        const height = rect.height * dpr;

        requestMutation(() => {
          if (canvas.width !== width) {
            canvas.width = width;
          }
          if (canvas.height !== height) {
            canvas.height = height;
          }
        });

        gl.viewport(0, 0, width, height);
      });
    };

    setupWebGL();
    handleResize();

    // Start animation
    let lastTime = 0;
    let lastShiftTime = 0;
    const SHIFT_INTERVAL = 5000; // Shift every 5 seconds

    const state = {
      keyShift: 0,
      color1Pos: [...KEY_POINTS[0]],
      color2Pos: [...KEY_POINTS[2]],
      color3Pos: [...KEY_POINTS[4]],
      color4Pos: [...KEY_POINTS[6]],
      targetColor1Pos: [...KEY_POINTS[0]],
      targetColor2Pos: [...KEY_POINTS[2]],
      targetColor3Pos: [...KEY_POINTS[4]],
      targetColor4Pos: [...KEY_POINTS[6]],
    };

    const updateTargetPositions = () => {
      const shift = state.keyShift;
      state.targetColor1Pos = [...KEY_POINTS[(0 + shift) % 8]];
      state.targetColor2Pos = [...KEY_POINTS[(2 + shift) % 8]];
      state.targetColor3Pos = [...KEY_POINTS[(4 + shift) % 8]];
      state.targetColor4Pos = [...KEY_POINTS[(6 + shift) % 8]];
    };

    const shiftPositions = () => {
      state.keyShift = (state.keyShift + 1) % 32;
      updateTargetPositions();
    };

    const handleClick = () => {
      shiftPositions();
      lastShiftTime = performance.now(); // Reset shift timer on click
    };

    containerRef.current?.addEventListener('click', handleClick);

    const animate = (time: number) => {
      if (!gl || !program || !canvasRef.current) return;

      const deltaTime = Math.min((time - lastTime) / 1000, 0.1); // Cap delta time
      lastTime = time;

      // Check if it's time to shift positions
      if (time - lastShiftTime > SHIFT_INTERVAL) {
        shiftPositions();
        lastShiftTime = time;
      }

      // Update color positions with animation
      const lerp = (start: number, end: number, t: number) => {
        return start + (end - start) * Math.min(t * 2.5, 1.0); // Increase animation speed
      };

      const updatePos = (current: number[], target: number[]) => {
        current[0] = lerp(current[0], target[0], deltaTime);
        current[1] = lerp(current[1], target[1], deltaTime);
      };

      updatePos(state.color1Pos, state.targetColor1Pos);
      updatePos(state.color2Pos, state.targetColor2Pos);
      updatePos(state.color3Pos, state.targetColor3Pos);
      updatePos(state.color4Pos, state.targetColor4Pos);

      // Clear the canvas
      gl.clear(gl.COLOR_BUFFER_BIT);

      // Set uniforms
      gl.uniform1f(gl.getUniformLocation(program, 'uTime'), time / 1000);
      gl.uniform2fv(gl.getUniformLocation(program, 'uResolution'), [canvasRef.current.width, canvasRef.current.height]);
      gl.uniform3fv(gl.getUniformLocation(program, 'color1'), colors.color1);
      gl.uniform3fv(gl.getUniformLocation(program, 'color2'), colors.color2);
      gl.uniform3fv(gl.getUniformLocation(program, 'color3'), colors.color3);
      gl.uniform3fv(gl.getUniformLocation(program, 'color4'), colors.color4);
      gl.uniform2fv(gl.getUniformLocation(program, 'color1Pos'), state.color1Pos);
      gl.uniform2fv(gl.getUniformLocation(program, 'color2Pos'), state.color2Pos);
      gl.uniform2fv(gl.getUniformLocation(program, 'color3Pos'), state.color3Pos);
      gl.uniform2fv(gl.getUniformLocation(program, 'color4Pos'), state.color4Pos);

      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animate(performance.now());
    lastShiftTime = performance.now();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      containerRef.current?.removeEventListener('click', handleClick);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (gl) {
        if (vertexBuffer) gl.deleteBuffer(vertexBuffer);
        if (program) gl.deleteProgram(program);
      }
    };
  }, [colors]);

  return (
    <div
      ref={containerRef}
      className="WebGLBackground"
      style={`
        --bgp-size: ${pattern.size}px;
        --bgp-background: ${pattern.patternColor};
        --bgp-image: url(${maskImages[pattern.maskImage || DEFAULT_PATTERN]});
      `}
    >
      <canvas ref={canvasRef} />
      {pattern.maskImage && (
        <div className="WebGLBackground-pattern" />
      )}
    </div>
  );
};

export default WebGLBackground;
export type { BackgroundState };
