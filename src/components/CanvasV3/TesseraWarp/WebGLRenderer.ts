/**
 * Tessera Warp - WebGL2 Renderer
 * 
 * High-performance mesh deformation renderer using WebGL2.
 * Draws the deformed render mesh with texture mapping at 60 FPS.
 */

import type { RenderMesh, ControlGraph, Vec2 } from './types';

// ============================================
// SHADER SOURCES
// ============================================

const VERTEX_SHADER_SOURCE = `#version 300 es
precision highp float;

in vec2 a_position;    // Deformed vertex position
in vec2 a_texCoord;    // Texture coordinate (rest position normalized)

uniform mat3 u_transform;  // View transform matrix
uniform vec2 u_resolution; // Canvas resolution

out vec2 v_texCoord;

void main() {
  // Apply view transform
  vec3 transformed = u_transform * vec3(a_position, 1.0);
  
  // Convert to clip space
  vec2 clipSpace = (transformed.xy / u_resolution) * 2.0 - 1.0;
  gl_Position = vec4(clipSpace * vec2(1, -1), 0, 1);
  
  v_texCoord = a_texCoord;
}
`;

const FRAGMENT_SHADER_SOURCE = `#version 300 es
precision highp float;

in vec2 v_texCoord;

uniform sampler2D u_texture;
uniform float u_opacity;
uniform bool u_showMesh;
uniform vec3 u_meshColor;

out vec4 fragColor;

void main() {
  vec4 texColor = texture(u_texture, v_texCoord);
  fragColor = vec4(texColor.rgb, texColor.a * u_opacity);
}
`;

const MESH_VERTEX_SHADER = `#version 300 es
precision highp float;

in vec2 a_position;

uniform mat3 u_transform;
uniform vec2 u_resolution;

void main() {
  vec3 transformed = u_transform * vec3(a_position, 1.0);
  vec2 clipSpace = (transformed.xy / u_resolution) * 2.0 - 1.0;
  gl_Position = vec4(clipSpace * vec2(1, -1), 0, 1);
}
`;

const MESH_FRAGMENT_SHADER = `#version 300 es
precision highp float;

uniform vec4 u_color;
out vec4 fragColor;

void main() {
  fragColor = u_color;
}
`;

// ============================================
// TYPES
// ============================================

export interface WebGLRendererOptions {
  showMesh?: boolean;
  meshColor?: [number, number, number];
  meshOpacity?: number;
  opacity?: number;
}

export interface TransformMatrix {
  a: number; b: number; c: number;
  d: number; e: number; f: number;
}

// ============================================
// SHADER HELPERS
// ============================================

function createShader(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error('Shader compile error:', gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  
  return shader;
}

function createProgram(gl: WebGL2RenderingContext, vs: WebGLShader, fs: WebGLShader): WebGLProgram | null {
  const program = gl.createProgram();
  if (!program) return null;
  
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error('Program link error:', gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
    return null;
  }
  
  return program;
}

// ============================================
// WEBGL RENDERER CLASS
// ============================================

export class WebGLWarpRenderer {
  private gl: WebGL2RenderingContext;
  private textureProgram: WebGLProgram | null = null;
  private meshProgram: WebGLProgram | null = null;
  
  // Buffers
  private positionBuffer: WebGLBuffer | null = null;
  private texCoordBuffer: WebGLBuffer | null = null;
  private indexBuffer: WebGLBuffer | null = null;
  private meshLineBuffer: WebGLBuffer | null = null;
  
  // Texture
  private texture: WebGLTexture | null = null;
  private textureWidth: number = 0;
  private textureHeight: number = 0;
  
  // State
  private triangleCount: number = 0;
  private meshLineCount: number = 0;
  private options: Required<WebGLRendererOptions>;
  private destroyed: boolean = false;
  
  // Uniform locations
  private textureUniforms: {
    transform: WebGLUniformLocation | null;
    resolution: WebGLUniformLocation | null;
    texture: WebGLUniformLocation | null;
    opacity: WebGLUniformLocation | null;
    showMesh: WebGLUniformLocation | null;
    meshColor: WebGLUniformLocation | null;
  } = { transform: null, resolution: null, texture: null, opacity: null, showMesh: null, meshColor: null };
  
  private meshUniforms: {
    transform: WebGLUniformLocation | null;
    resolution: WebGLUniformLocation | null;
    color: WebGLUniformLocation | null;
  } = { transform: null, resolution: null, color: null };
  
  constructor(canvas: HTMLCanvasElement | OffscreenCanvas, options: WebGLRendererOptions = {}) {
    const gl = canvas.getContext('webgl2', {
      alpha: true,
      antialias: true,
      premultipliedAlpha: false,
    });
    
    if (!gl) {
      throw new Error('WebGL2 not supported');
    }
    
    this.gl = gl;
    this.options = {
      showMesh: options.showMesh ?? false,
      meshColor: options.meshColor ?? [0.3, 0.6, 1.0],
      meshOpacity: options.meshOpacity ?? 0.5,
      opacity: options.opacity ?? 1.0,
    };
    
    this.initShaders();
    this.initBuffers();
  }
  
  private initShaders(): void {
    const gl = this.gl;
    
    // Texture program
    const textureVS = createShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER_SOURCE);
    const textureFS = createShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER_SOURCE);
    
    if (textureVS && textureFS) {
      this.textureProgram = createProgram(gl, textureVS, textureFS);
      
      if (this.textureProgram) {
        this.textureUniforms.transform = gl.getUniformLocation(this.textureProgram, 'u_transform');
        this.textureUniforms.resolution = gl.getUniformLocation(this.textureProgram, 'u_resolution');
        this.textureUniforms.texture = gl.getUniformLocation(this.textureProgram, 'u_texture');
        this.textureUniforms.opacity = gl.getUniformLocation(this.textureProgram, 'u_opacity');
        this.textureUniforms.showMesh = gl.getUniformLocation(this.textureProgram, 'u_showMesh');
        this.textureUniforms.meshColor = gl.getUniformLocation(this.textureProgram, 'u_meshColor');
      }
      
      gl.deleteShader(textureVS);
      gl.deleteShader(textureFS);
    }
    
    // Mesh wireframe program
    const meshVS = createShader(gl, gl.VERTEX_SHADER, MESH_VERTEX_SHADER);
    const meshFS = createShader(gl, gl.FRAGMENT_SHADER, MESH_FRAGMENT_SHADER);
    
    if (meshVS && meshFS) {
      this.meshProgram = createProgram(gl, meshVS, meshFS);
      
      if (this.meshProgram) {
        this.meshUniforms.transform = gl.getUniformLocation(this.meshProgram, 'u_transform');
        this.meshUniforms.resolution = gl.getUniformLocation(this.meshProgram, 'u_resolution');
        this.meshUniforms.color = gl.getUniformLocation(this.meshProgram, 'u_color');
      }
      
      gl.deleteShader(meshVS);
      gl.deleteShader(meshFS);
    }
  }
  
  private initBuffers(): void {
    const gl = this.gl;
    
    this.positionBuffer = gl.createBuffer();
    this.texCoordBuffer = gl.createBuffer();
    this.indexBuffer = gl.createBuffer();
    this.meshLineBuffer = gl.createBuffer();
  }
  
  /**
   * Upload texture from image
   */
  uploadTexture(image: HTMLImageElement | HTMLCanvasElement | ImageBitmap): void {
    const gl = this.gl;
    
    if (this.texture) {
      gl.deleteTexture(this.texture);
    }
    
    this.texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    
    // Upload image
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    
    // Set parameters
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    
    this.textureWidth = 'width' in image ? image.width : (image as HTMLCanvasElement).width;
    this.textureHeight = 'height' in image ? image.height : (image as HTMLCanvasElement).height;
  }
  
  /**
   * Upload mesh geometry
   * RenderMesh has: positions, uvs, indices, deformed, skin
   */
  uploadMesh(mesh: RenderMesh): void {
    const gl = this.gl;
    const vertexCount = mesh.positions.length / 2;
    
    // Build position array from deformed positions
    const positions = new Float32Array(vertexCount * 2);
    for (let i = 0; i < vertexCount; i++) {
      positions[i * 2] = mesh.deformed[i * 2];
      positions[i * 2 + 1] = mesh.deformed[i * 2 + 1];
    }
    
    // Upload positions
    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.DYNAMIC_DRAW);
    
    // Upload tex coords (UVs)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, mesh.uvs, gl.STATIC_DRAW);
    
    // Upload indices
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.indices, gl.STATIC_DRAW);
    
    this.triangleCount = mesh.indices.length / 3;
    
    // Build mesh wireframe lines for debug display
    const lineSet = new Set<string>();
    const lines: number[] = [];
    
    for (let i = 0; i < mesh.indices.length; i += 3) {
      const i0 = mesh.indices[i];
      const i1 = mesh.indices[i + 1];
      const i2 = mesh.indices[i + 2];
      
      // Add unique edges
      const edges = [[i0, i1], [i1, i2], [i2, i0]];
      for (const [a, b] of edges) {
        const key = a < b ? `${a}-${b}` : `${b}-${a}`;
        if (!lineSet.has(key)) {
          lineSet.add(key);
          lines.push(a, b);
        }
      }
    }
    
    // Build line buffer
    const linePositions = new Float32Array(lines.length * 2);
    for (let i = 0; i < lines.length; i++) {
      const vi = lines[i];
      linePositions[i * 2] = mesh.deformed[vi * 2];
      linePositions[i * 2 + 1] = mesh.deformed[vi * 2 + 1];
    }
    
    gl.bindBuffer(gl.ARRAY_BUFFER, this.meshLineBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, linePositions, gl.DYNAMIC_DRAW);
    
    this.meshLineCount = lines.length;
  }
  
  /**
   * Update deformed positions without rebuilding entire mesh
   */
  updateDeformedPositions(mesh: RenderMesh): void {
    const gl = this.gl;
    const vertexCount = mesh.positions.length / 2;
    
    // Update position buffer
    const positions = new Float32Array(vertexCount * 2);
    for (let i = 0; i < vertexCount; i++) {
      positions[i * 2] = mesh.deformed[i * 2];
      positions[i * 2 + 1] = mesh.deformed[i * 2 + 1];
    }
    
    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.DYNAMIC_DRAW);
    
    // Update mesh lines if showing wireframe
    if (this.options.showMesh) {
      const lines: number[] = [];
      const lineSet = new Set<string>();
      
      for (let i = 0; i < mesh.indices.length; i += 3) {
        const i0 = mesh.indices[i];
        const i1 = mesh.indices[i + 1];
        const i2 = mesh.indices[i + 2];
        
        const edges = [[i0, i1], [i1, i2], [i2, i0]];
        for (const [a, b] of edges) {
          const key = a < b ? `${a}-${b}` : `${b}-${a}`;
          if (!lineSet.has(key)) {
            lineSet.add(key);
            lines.push(a, b);
          }
        }
      }
      
      const linePositions = new Float32Array(lines.length * 2);
      for (let i = 0; i < lines.length; i++) {
        const vi = lines[i];
        linePositions[i * 2] = mesh.deformed[vi * 2];
        linePositions[i * 2 + 1] = mesh.deformed[vi * 2 + 1];
      }
      
      gl.bindBuffer(gl.ARRAY_BUFFER, this.meshLineBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, linePositions, gl.DYNAMIC_DRAW);
    }
  }
  
  /**
   * Render the deformed mesh
   */
  render(transform: TransformMatrix): void {
    if (this.destroyed || !this.textureProgram || !this.texture) return;
    
    const gl = this.gl;
    const canvas = gl.canvas;
    const width = 'width' in canvas ? canvas.width : (canvas as OffscreenCanvas).width;
    const height = 'height' in canvas ? canvas.height : (canvas as OffscreenCanvas).height;
    
    gl.viewport(0, 0, width, height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    
    // Use texture program
    gl.useProgram(this.textureProgram);
    
    // Set transform matrix (column-major for WebGL)
    const transformMatrix = new Float32Array([
      transform.a, transform.b, 0,
      transform.c, transform.d, 0,
      transform.e, transform.f, 1,
    ]);
    
    gl.uniformMatrix3fv(this.textureUniforms.transform, false, transformMatrix);
    gl.uniform2f(this.textureUniforms.resolution, width, height);
    gl.uniform1f(this.textureUniforms.opacity, this.options.opacity);
    
    // Bind texture
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.uniform1i(this.textureUniforms.texture, 0);
    
    // Setup attributes
    const positionLoc = gl.getAttribLocation(this.textureProgram, 'a_position');
    const texCoordLoc = gl.getAttribLocation(this.textureProgram, 'a_texCoord');
    
    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    gl.enableVertexAttribArray(positionLoc);
    gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);
    
    gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
    gl.enableVertexAttribArray(texCoordLoc);
    gl.vertexAttribPointer(texCoordLoc, 2, gl.FLOAT, false, 0, 0);
    
    // Draw triangles
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
    gl.drawElements(gl.TRIANGLES, this.triangleCount * 3, gl.UNSIGNED_INT, 0);
    
    // Draw wireframe if enabled
    if (this.options.showMesh && this.meshProgram && this.meshLineCount > 0) {
      gl.useProgram(this.meshProgram);
      
      gl.uniformMatrix3fv(this.meshUniforms.transform, false, transformMatrix);
      gl.uniform2f(this.meshUniforms.resolution, width, height);
      gl.uniform4f(
        this.meshUniforms.color,
        this.options.meshColor[0],
        this.options.meshColor[1],
        this.options.meshColor[2],
        this.options.meshOpacity
      );
      
      const meshPosLoc = gl.getAttribLocation(this.meshProgram, 'a_position');
      gl.bindBuffer(gl.ARRAY_BUFFER, this.meshLineBuffer);
      gl.enableVertexAttribArray(meshPosLoc);
      gl.vertexAttribPointer(meshPosLoc, 2, gl.FLOAT, false, 0, 0);
      
      gl.drawArrays(gl.LINES, 0, this.meshLineCount);
    }
  }
  
  /**
   * Update render options
   */
  setOptions(options: Partial<WebGLRendererOptions>): void {
    Object.assign(this.options, options);
  }
  
  /**
   * Clean up resources
   */
  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    
    const gl = this.gl;
    
    if (this.positionBuffer) gl.deleteBuffer(this.positionBuffer);
    if (this.texCoordBuffer) gl.deleteBuffer(this.texCoordBuffer);
    if (this.indexBuffer) gl.deleteBuffer(this.indexBuffer);
    if (this.meshLineBuffer) gl.deleteBuffer(this.meshLineBuffer);
    if (this.texture) gl.deleteTexture(this.texture);
    if (this.textureProgram) gl.deleteProgram(this.textureProgram);
    if (this.meshProgram) gl.deleteProgram(this.meshProgram);
  }
}
