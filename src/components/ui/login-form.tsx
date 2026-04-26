"use client";
import { useEffect, useRef, useState } from "react";
import { User, Lock, ArrowRight } from "@phosphor-icons/react";
import * as db from "@/lib/db";

// ── WebGL shaders ─────────────────────────────────────────────────────────────
const vertexSource = `
  attribute vec4 a_position;
  void main() { gl_Position = a_position; }
`;

const fragmentSource = `
precision mediump float;
uniform vec2 iResolution;
uniform float iTime;
uniform vec2 iMouse;
uniform vec3 u_color;

void mainImage(out vec4 fragColor, in vec2 fragCoord){
  vec2 uv = fragCoord / iResolution;
  vec2 centeredUV = (2.0 * fragCoord - iResolution.xy) / min(iResolution.x, iResolution.y);
  float time = iTime * 0.5;
  vec2 mouse = iMouse / iResolution;
  vec2 rippleCenter = 2.0 * mouse - 1.0;
  vec2 distortion = centeredUV;
  for (float i = 1.0; i < 8.0; i++) {
    distortion.x += 0.5 / i * cos(i * 2.0 * distortion.y + time + rippleCenter.x * 3.1415);
    distortion.y += 0.5 / i * cos(i * 2.0 * distortion.x + time + rippleCenter.y * 3.1415);
  }
  float wave = abs(sin(distortion.x + distortion.y + time));
  float glow = smoothstep(0.9, 0.2, wave);
  fragColor = vec4(u_color * glow, 1.0);
}

void main() { mainImage(gl_FragColor, gl_FragCoord.xy); }
`;

// ── SmokeyBackground ──────────────────────────────────────────────────────────
interface SmokeyBackgroundProps {
  color?: string;
  className?: string;
}

export function SmokeyBackground({
  color = "#0F4C5C",
  className = "",
}: SmokeyBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: 0, y: 0, hovering: false });

  const hexToRgb = (hex: string): [number, number, number] => [
    parseInt(hex.slice(1, 3), 16) / 255,
    parseInt(hex.slice(3, 5), 16) / 255,
    parseInt(hex.slice(5, 7), 16) / 255,
  ];

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext("webgl");
    if (!gl) return;

    const compile = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      return s;
    };

    const prog = gl.createProgram()!;
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, vertexSource));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, fragmentSource));
    gl.linkProgram(prog);
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]), gl.STATIC_DRAW);
    const pos = gl.getAttribLocation(prog, "a_position");
    gl.enableVertexAttribArray(pos);
    gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);

    const uRes   = gl.getUniformLocation(prog, "iResolution");
    const uTime  = gl.getUniformLocation(prog, "iTime");
    const uMouse = gl.getUniformLocation(prog, "iMouse");
    const uColor = gl.getUniformLocation(prog, "u_color");

    const [r, g, b] = hexToRgb(color);
    gl.uniform3f(uColor, r, g, b);

    const t0 = Date.now();
    let rafId: number;

    const render = () => {
      const w = canvas.clientWidth, h = canvas.clientHeight;
      canvas.width = w; canvas.height = h;
      gl.viewport(0, 0, w, h);
      const { x, y, hovering } = mouseRef.current;
      gl.uniform2f(uRes, w, h);
      gl.uniform1f(uTime, (Date.now() - t0) / 1000);
      gl.uniform2f(uMouse, hovering ? x : w / 2, hovering ? h - y : h / 2);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      rafId = requestAnimationFrame(render);
    };

    const onMove  = (e: MouseEvent) => { const r = canvas.getBoundingClientRect(); mouseRef.current = { x: e.clientX - r.left, y: e.clientY - r.top, hovering: true }; };
    const onLeave = () => { mouseRef.current.hovering = false; };

    canvas.addEventListener("mousemove", onMove);
    canvas.addEventListener("mouseleave", onLeave);
    render();

    return () => {
      cancelAnimationFrame(rafId);
      canvas.removeEventListener("mousemove", onMove);
      canvas.removeEventListener("mouseleave", onLeave);
    };
  }, [color]);

  return (
    <div className={`absolute inset-0 w-full h-full overflow-hidden ${className}`}>
      <canvas ref={canvasRef} className="w-full h-full" />
      <div className="absolute inset-0 backdrop-blur-sm" />
    </div>
  );
}

// ── LoginForm ─────────────────────────────────────────────────────────────────
export function LoginForm() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [name, setName]   = useState("");
  const [email, setEmail] = useState("");
  const [pass, setPass]   = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState("");
  const [info, setInfo]     = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setInfo("");
    if (!email || !pass || (mode === "signup" && !name)) {
      setError("Preencha todos os campos."); return;
    }
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error: err } = await db.signUp(email, pass, name);
        if (err) throw err;
        setInfo("Conta criada! Verifique seu e-mail para confirmar o cadastro.");
      } else {
        const { error: err } = await db.signIn(email, pass);
        if (err) throw err;
      }
    } catch (e: any) {
      const msg: string = e?.message || "";
      if (msg.includes("Invalid login"))      setError("E-mail ou senha incorretos.");
      else if (msg.includes("already registered")) setError("E-mail já cadastrado. Faça login.");
      else setError(msg || "Erro ao autenticar.");
    } finally {
      setLoading(false);
    }
  }

  const toggle = () => { setMode(m => m === "login" ? "signup" : "login"); setError(""); setInfo(""); };

  return (
    <div className="w-full max-w-sm p-8 space-y-6 bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 shadow-2xl">
      {/* Header */}
      <div className="text-center">
        <div className="flex items-center justify-center mb-3">
          <img src="/brand/auri-logo-full.svg" alt="Auri" style={{ height: 36, filter: 'brightness(0) invert(1)' }} />
        </div>
        <p className="text-sm text-gray-300">
          {mode === "login" ? "Acesse seu consultório" : "Crie sua conta"}
        </p>
      </div>

      <form className="space-y-7" onSubmit={handleSubmit}>
        {/* Name — signup only */}
        {mode === "signup" && (
          <div className="relative z-0">
            <input
              type="text"
              id="f_name"
              value={name}
              onChange={e => setName(e.target.value)}
              className="block py-2.5 px-0 w-full text-sm text-white bg-transparent border-0 border-b-2 border-gray-400 appearance-none focus:outline-none focus:ring-0 focus:border-primary peer"
              placeholder=" "
            />
            <label htmlFor="f_name" className="absolute text-sm text-gray-300 duration-300 transform -translate-y-6 scale-75 top-3 -z-10 origin-[0] peer-focus:text-white peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0 peer-focus:scale-75 peer-focus:-translate-y-6">
              <User className="inline-block mr-2 -mt-1" size={14} />
              Nome completo
            </label>
          </div>
        )}

        {/* Email */}
        <div className="relative z-0">
          <input
            type="email"
            id="f_email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="block py-2.5 px-0 w-full text-sm text-white bg-transparent border-0 border-b-2 border-gray-400 appearance-none focus:outline-none focus:ring-0 focus:border-primary peer"
            placeholder=" "
          />
          <label htmlFor="f_email" className="absolute text-sm text-gray-300 duration-300 transform -translate-y-6 scale-75 top-3 -z-10 origin-[0] peer-focus:text-white peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0 peer-focus:scale-75 peer-focus:-translate-y-6">
            <User className="inline-block mr-2 -mt-1" size={14} />
            E-mail
          </label>
        </div>

        {/* Password */}
        <div className="relative z-0">
          <input
            type="password"
            id="f_pass"
            value={pass}
            onChange={e => setPass(e.target.value)}
            className="block py-2.5 px-0 w-full text-sm text-white bg-transparent border-0 border-b-2 border-gray-400 appearance-none focus:outline-none focus:ring-0 focus:border-primary peer"
            placeholder=" "
          />
          <label htmlFor="f_pass" className="absolute text-sm text-gray-300 duration-300 transform -translate-y-6 scale-75 top-3 -z-10 origin-[0] peer-focus:text-white peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0 peer-focus:scale-75 peer-focus:-translate-y-6">
            <Lock className="inline-block mr-2 -mt-1" size={14} />
            Senha
          </label>
        </div>

        {/* Feedback */}
        {error && (
          <div className="text-xs text-red-300 bg-red-500/20 border border-red-400/30 rounded-lg px-3 py-2">
            {error}
          </div>
        )}
        {info && (
          <div className="text-xs text-white/90 bg-white/10 border border-white/20 rounded-lg px-3 py-2">
            {info}
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={loading}
          className="group w-full flex items-center justify-center py-3 px-4 bg-primary hover:opacity-90 disabled:opacity-60 rounded-lg text-white font-semibold focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-transparent transition-all duration-300"
        >
          {loading ? "Aguarde…" : mode === "login" ? "Entrar" : "Criar conta"}
          {!loading && <ArrowRight className="ml-2 h-5 w-5 transform group-hover:translate-x-1 transition-transform" />}
        </button>
      </form>

      {/* Divider */}
      <div className="relative flex items-center">
        <div className="flex-grow border-t border-white/20" />
        <span className="flex-shrink mx-4 text-gray-400 text-xs">OU CONTINUE COM</span>
        <div className="flex-grow border-t border-white/20" />
      </div>

      {/* Google */}
      <button
        type="button"
        onClick={() => db.signInWithGoogle()}
        className="w-full flex items-center justify-center py-2.5 px-4 bg-white/90 hover:bg-white rounded-lg text-gray-700 font-semibold focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-transparent transition-all duration-300 text-sm"
      >
        <svg className="w-5 h-5 mr-2 flex-shrink-0" viewBox="0 0 48 48">
          <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039L38.802 8.841C34.553 4.806 29.613 2.5 24 2.5C11.983 2.5 2.5 11.983 2.5 24s9.483 21.5 21.5 21.5S45.5 36.017 45.5 24c0-1.538-.135-3.022-.389-4.417z"/>
          <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12.5 24 12.5c3.059 0 5.842 1.154 7.961 3.039l5.839-5.841C34.553 4.806 29.613 2.5 24 2.5C16.318 2.5 9.642 6.723 6.306 14.691z"/>
          <path fill="#4CAF50" d="M24 45.5c5.613 0 10.553-2.306 14.802-6.341l-5.839-5.841C30.842 35.846 27.059 38 24 38c-5.039 0-9.345-2.608-11.124-6.481l-6.571 4.819C9.642 41.277 16.318 45.5 24 45.5z"/>
          <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571l5.839 5.841C44.196 35.123 45.5 29.837 45.5 24c0-1.538-.135-3.022-.389-4.417z"/>
        </svg>
        Entrar com Google
      </button>

      <p className="text-center text-xs text-gray-400">
        {mode === "login" ? "Ainda não tem conta? " : "Já tem conta? "}
        <button onClick={toggle} className="font-semibold text-white/90 hover:text-white transition bg-transparent border-0 cursor-pointer">
          {mode === "login" ? "Criar conta" : "Fazer login"}
        </button>
      </p>
    </div>
  );
}
