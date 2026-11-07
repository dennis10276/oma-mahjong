// Where the builder loop's GPU Python lives (this worktree's own venv, git-ignored).
// Rebuild it with:
//   cd source/tools/gpu-probe
//   uv venv .venv --python 3.11.15
//   uv pip install --python .venv/Scripts/python.exe cuda-pathfinder==1.8.6 cupy-cuda12x==14.2.0 \
//     llvmlite==0.50.0 numba==0.68.1 numpy==2.4.6 nvidia-cuda-nvrtc-cu12==12.9.86 nvidia-cuda-runtime-cu12==12.9.79
// (the same stack as Gemini's G1 probe; nvidia-cuda-runtime-cu12 supplies the headers NVRTC needs).
'use strict';
const path = require('path');
const fs = require('fs');

const PYTHON = path.resolve(__dirname, '..', '..', 'gpu-probe', '.venv', 'Scripts', 'python.exe');

function python() {
  if (!fs.existsSync(PYTHON)) throw new Error(`GPU venv missing: ${PYTHON} (see gpu_env.js for the rebuild commands)`);
  return PYTHON;
}

module.exports = { PYTHON, python };
