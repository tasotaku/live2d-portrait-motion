// AI_NOTE: Both demos use the same grid and alpha handling while supplying their own deformation shaders.
export function createMesh(canvas, { size, vertex, fragment, images, samplers, rows = Math.ceil(48 * size[1] / size[0]) }) {
  const gl = canvas.getContext("webgl2", { alpha: true, premultipliedAlpha: false, antialias: true });
  if (!gl) throw new Error("WebGL 2 を利用できません");
  const program = gl.createProgram();
  for (const [type, source] of [[gl.VERTEX_SHADER, vertex], [gl.FRAGMENT_SHADER, fragment]]) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
    gl.attachShader(program, shader);
  }
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
  gl.useProgram(program);

  const grid = [];
  const cols = 48;
  for (let row=0; row<rows; row++) {
    const y0 = row*size[1]/rows, y1 = (row+1)*size[1]/rows;
    for (let col=0; col<cols; col++) {
      const x0 = col*size[0]/cols, x1 = (col+1)*size[0]/cols;
      grid.push(x0,y0, x1,y0, x0,y1, x1,y0, x1,y1, x0,y1);
    }
  }
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(grid), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
  for (const [i, image] of images.entries()) {
    if (image.naturalWidth!==size[0] || image.naturalHeight!==size[1]) {
      throw new Error("画像のピクセル寸法が設定と一致しません");
    }
    const texture = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0 + i);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.uniform1i(gl.getUniformLocation(program,samplers[i]),i);
  }
  gl.viewport(0, 0, canvas.width, canvas.height);
  return {
    gl,
    uniform: name => gl.getUniformLocation(program, name),
    // AI_NOTE: Clear the previous silhouette before drawing any new deformation.
    draw() {
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, grid.length / 2);
    },
  };
}
